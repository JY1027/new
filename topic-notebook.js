(() => {
  'use strict';

  const scriptUrl = document.currentScript.src;
  const assetUrl = (path) => new URL(path, scriptUrl).href;
  const path = location.pathname;
  const match = path.match(/\/(travel|food|draw|challenge|outfit)\/\1-(card|claw|gacha|slot|wheel)\.html$/);
  if (!match) return;

  const [, topic, tool] = match;
  const topicNames = {
    travel: '大臺北景點',
    food: '大臺北美食',
    draw: '畫畫靈感',
    challenge: '社牛挑戰',
    outfit: '穿搭風格',
  };
  const topicFavoriteNames = {
    travel: '假日去哪逛',
    food: '三餐吃什麼',
    draw: '畫畫沒靈感',
    challenge: '社牛大挑戰',
    outfit: '穿什麼',
  };
  const toolNames = {
    card: '抽卡機',
    claw: '娃娃機',
    gacha: '扭蛋機',
    slot: '拉霸機',
    wheel: '轉盤',
  };
  const storageKey = `pickme_notebook:${encodeURIComponent(topic)}:${encodeURIComponent(tool)}:`;
  const signedInUser = window.Auth?.user?.();
  const persistentKey = signedInUser?.email
    ? `${storageKey}${encodeURIComponent(signedInUser.email)}`
    : null;
  const optionLimits = { gacha: 10, wheel: 5, claw: 5 };
  const defaults = readPageOptions().slice(0, optionLimits[tool] || Infinity);
  const defaultGroups = readPageGroups();
  const defaultRarities = readPageCardRarities();
  const defaultOptions = defaults.map((value) => ({
    value,
    quantity: 1,
    ...(tool === 'card' ? { rarity: defaultRarities.get(value) || 'R' } : {}),
  }));
  const state = {
    options: defaultOptions.map((option) => ({ ...option })),
    groups: defaultGroups.map((group) => ({
      ...group,
      options: group.options
        .slice(0, optionLimits[tool] || Infinity)
        .map((option) => ({ ...option })),
      remaining: expandOptions(group.options.slice(0, optionLimits[tool] || Infinity)),
    })),
    slotOverrides: [],
    noReplacement: false,
    sound: true,
    remaining: expandOptions(defaultOptions),
    records: [],
  };
  let activeTab = 0;
  let resultObserver = null;
  let lastAppliedResult = '';
  let noteStatus;
  let optionsList;
  let recordList;
  let book;
  let overlay;
  let cover;
  let returnFocus;
  let closeTimer;
  let resultTimer;

  function readPageOptions() {
    const scripts = [...document.scripts].map((script) => script.textContent).join('\n');
    const names = [
      'options', 'destinations', 'species', 'colors', 'accessories', 'people',
      'locations', 'activities', 'styles', 'luckyItems', 'fashionStyles',
      'outfitStyles', 'characterStyles', 'desserts', 'mains', 'drinks',
    ];
    const values = [];

    for (const name of names) {
      const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*\\[`, 'g');
      let found;
      while ((found = declaration.exec(scripts))) {
        const content = readBalanced(scripts, declaration.lastIndex - 1, '[', ']');
        if (content !== null) values.push(...readStringValues(content));
      }
    }

    const poolMatch = /\b(?:const|let|var)\s+cardPool\s*=\s*\{/g.exec(scripts);
    if (poolMatch) {
      const content = readBalanced(scripts, poolMatch.index + poolMatch[0].lastIndexOf('{'), '{', '}');
      if (content !== null) values.push(...readStringValues(content));
    }

    const uniqueValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
      .filter((value) => !value.startsWith('#') && !/^(?:SSR|SR|R)$/.test(value));

    if (uniqueValues.length) return uniqueValues;

    console.error('找不到此主題工具的選項資料，請確認頁面資料設定。');
    return ['請新增自訂選項'];
  }

  function readPageCardRarities() {
    if (tool !== 'card') return new Map();
    const scripts = [...document.scripts].map((script) => script.textContent).join('\n');
    const rarities = new Map();
    const declaration = /\b(?:SSR|SR|R)\s*:\s*\[/g;
    let found;
    while ((found = declaration.exec(scripts))) {
      const rarity = found[0].match(/SSR|SR|R/)[0];
      const content = readBalanced(scripts, declaration.lastIndex - 1, '[', ']');
      if (content === null) continue;
      readStringValues(content).forEach((value) => {
        if (!rarities.has(value)) rarities.set(value, rarity);
      });
    }
    return rarities;
  }

  function readPageGroups() {
    const groupNames = {
      'food:claw': [
        ['desserts', '甜點'],
        ['mains', '主食'],
        ['drinks', '飲品'],
      ],
      'draw:claw': [
        ['species', '角色'],
        ['colors', '顏色'],
        ['accessories', '特徵'],
      ],
      'draw:slot': [
        ['species', '角色'],
        ['colors', '顏色'],
        ['accessories', '特徵'],
      ],
      'challenge:slot': [
        ['people', '人數'],
        ['locations', '地點'],
        ['activities', '挑戰'],
      ],
      'outfit:claw': [
        ['fashionStyles', '穿搭風格'],
        ['colors', '顏色'],
        ['luckyItems', '幸運配件'],
      ],
      'outfit:slot': [
        ['styles', '穿搭風格'],
        ['colors', '顏色'],
        ['luckyItems', '幸運配件'],
      ],
    };
    const definitions = groupNames[`${topic}:${tool}`];
    if (!definitions) return [];
    const scripts = [...document.scripts].map((script) => script.textContent).join('\n');
    return definitions.map(([name, label]) => {
      const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*\\[`, 'g');
      const found = declaration.exec(scripts);
      if (!found) {
        console.error(`找不到「${label}」選項資料，請確認頁面資料設定。`);
        return { key: name, label, options: [] };
      }
      const values = readStringValues(readBalanced(scripts, declaration.lastIndex - 1, '[', ']') || '');
      return {
        key: name,
        label,
        options: [...new Set(values.map((value) => value.trim()).filter(Boolean))]
          .map((value) => ({ value, quantity: 1 })),
      };
    });
  }

  function readBalanced(source, start, opening, closing) {
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
      } else if (character === opening) {
        depth += 1;
      } else if (character === closing && --depth === 0) {
        return source.slice(start + 1, index);
      }
    }
    return null;
  }

  function readStringValues(source) {
    const values = [];
    const strings = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
    let found;
    while ((found = strings.exec(source))) {
      const raw = found[0];
      const value = raw.slice(1, -1).replace(/\\(['"`\\])/g, '$1').trim();
      if (value && !value.startsWith('#')) values.push(value);
    }
    return values;
  }

  function loadSavedState() {
    if (!persistentKey) return;
    let raw;
    try {
      raw = localStorage.getItem(persistentKey);
    } catch (error) {
      console.error('讀取自訂筆記本資料失敗。', error);
      return;
    }
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.options)) state.options = normalizeSavedOptions(saved.options, saved.optionLimit);
      if (state.groups.length) loadSavedGroups(saved);
      if (tool === 'slot' && Array.isArray(saved.slotOverrides)) {
        state.slotOverrides = saved.slotOverrides.filter((key) =>
          state.groups.some((group) => group.key === key));
      }
      if (typeof saved.noReplacement === 'boolean') state.noReplacement = saved.noReplacement;
      if (typeof saved.sound === 'boolean') state.sound = saved.sound;
      if (Array.isArray(saved.remaining)) state.remaining = saved.remaining;
      if (Array.isArray(saved.records)) state.records = saved.records;
      clampState();
    } catch (error) {
      console.error('讀取自訂筆記本資料失敗。', error);
      try {
        localStorage.removeItem(persistentKey);
      } catch (removeError) {
        console.error('無法移除損毀的自訂筆記本資料。', removeError);
      }
    }
  }

  function normalizeSavedOptions(options, optionLimit) {
    return options.map((item, index) => {
      if (typeof item === 'string' && item.trim()) {
        const quantity = Number.isInteger(optionLimit) && index >= optionLimit ? 0 : 1;
        const value = item.trim();
        return { value, quantity, ...(tool === 'card' ? { rarity: defaultRarities.get(value) || 'R' } : {}) };
      }
      if (item && typeof item.value === 'string' && item.value.trim()) {
        const quantity = Number.isInteger(item.quantity) ? Math.max(0, item.quantity) : 1;
        const value = item.value.trim();
        const rarity = ['SSR', 'SR', 'R'].includes(item.rarity)
          ? item.rarity
          : defaultRarities.get(value) || 'R';
        return { value, quantity, ...(tool === 'card' ? { rarity } : {}) };
      }
      return null;
    }).filter(Boolean);
  }

  function loadSavedGroups(saved) {
    if (Array.isArray(saved.groups)) {
      state.groups = state.groups.map((group) => {
        const stored = saved.groups.find((item) => item.key === group.key);
        if (!stored || !Array.isArray(stored.options)) return group;
        if (tool === 'slot') {
          const hasOverrideState = Array.isArray(saved.slotOverrides);
          const isOverridden = hasOverrideState
            ? saved.slotOverrides.includes(group.key)
            : false;
          if (hasOverrideState && !isOverridden) return group;

          const options = normalizeSavedOptions(stored.options);
          if (!hasOverrideState) {
            const defaultValues = new Set(
              (defaultGroups.find((item) => item.key === group.key)?.options || [])
                .map((option) => option.value),
            );
            const customOptions = options.filter((option) => !defaultValues.has(option.value));
            if (!customOptions.length) return group;
            state.slotOverrides.push(group.key);
            return { ...group, options: customOptions, remaining: expandOptions(customOptions) };
          }
          return {
            ...group,
            options,
            remaining: Array.isArray(stored.remaining) ? stored.remaining : [],
          };
        }
        return {
          ...group,
          options: normalizeSavedOptions(stored.options),
          remaining: Array.isArray(stored.remaining) ? stored.remaining : [],
        };
      });
      return;
    }

    if (!Array.isArray(saved.options)) return;
    const oldOptions = normalizeSavedOptions(saved.options, saved.optionLimit);
    state.groups = state.groups.map((group) => {
      const options = group.options.map((option) => {
        const stored = oldOptions.find((item) => item.value === option.value);
        return stored ? { ...option, quantity: stored.quantity } : option;
      });
      const remainingCounts = new Map();
      (saved.remaining || []).forEach((value) =>
        remainingCounts.set(value, (remainingCounts.get(value) || 0) + 1));
      const remaining = [];
      options.forEach(({ value, quantity }) => {
        const count = Math.min(quantity, remainingCounts.get(value) || 0);
        remaining.push(...Array(count).fill(value));
        remainingCounts.set(value, (remainingCounts.get(value) || 0) - count);
      });
      return { ...group, options, remaining };
    });
    const knownValues = new Set(state.groups.flatMap((group) => group.options.map((option) => option.value)));
    const customOptions = oldOptions.filter((option) => !knownValues.has(option.value));
    if (customOptions.length && state.groups.length) {
      state.groups[0].options.push(...customOptions);
      state.groups[0].remaining.push(...expandOptions(customOptions));
    }
  }

  function clampState() {
    state.options.forEach((option) => { option.quantity = Math.min(999, option.quantity); });
    state.remaining = clampRemaining(state.options, state.remaining);
    state.groups.forEach((group) => {
      group.options.forEach((option) => { option.quantity = Math.min(999, option.quantity); });
      group.remaining = clampRemaining(group.options, group.remaining);
    });
  }

  function clampRemaining(options, remaining) {
    const remainingCounts = new Map();
    remaining.forEach((value) => remainingCounts.set(value, (remainingCounts.get(value) || 0) + 1));
    const allowedCounts = new Map();
    options.forEach(({ value, quantity }) => {
      allowedCounts.set(value, (allowedCounts.get(value) || 0) + quantity);
    });
    return [...allowedCounts].flatMap(([value, quantity]) =>
      Array(Math.min(quantity, remainingCounts.get(value) || 0)).fill(value));
  }

  function expandOptions(options) {
    return options.flatMap(({ value, quantity }) => Array(quantity).fill(value));
  }

  function saveState() {
    if (!persistentKey) {
      updateStatus('未登入：自訂內容只會保留在目前頁面。');
      return;
    }
    try {
      localStorage.setItem(persistentKey, JSON.stringify(state));
      updateStatus('已儲存於此帳號的瀏覽器資料。');
    } catch (error) {
      console.error('儲存自訂筆記本資料失敗。', error);
      updateStatus('儲存失敗，請檢查瀏覽器儲存空間設定。');
    }
  }

  function createNotebook() {
    loadSavedState();
    const actions = document.createElement('div');
    actions.className = 'topic-page-actions';

    const button = document.createElement('button');
    button.className = 'topic-customize-button';
    button.type = 'button';
    button.setAttribute('aria-label', '開啟自訂筆記本');
    button.title = '自訂筆記本';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M7 3.5v17M9 8h7M9 12h7"/></svg><span>自訂</span>';
    button.addEventListener('click', openNotebook);

    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'topic-favorite-button';
    favoriteButton.type = 'button';
    favoriteButton.dataset.topicFavorite = `category-${topic}`;
    favoriteButton.setAttribute('aria-label', `收藏${topicFavoriteNames[topic]}`);
    favoriteButton.addEventListener('click', () => {
      if (!window.Auth?.user?.()) {
        const next = `${path.split('/').slice(-2).join('/')}${location.search}${location.hash}`;
        location.href = `${assetUrl('login.html')}?next=${encodeURIComponent(next)}`;
        return;
      }
      window.Auth.toggleTopicFav(favoriteButton.dataset.topicFavorite);
      updateTopicFavorite();
    });

    function updateTopicFavorite() {
      const saved = window.Auth?.user?.()
        ? window.Auth.favs().includes(`topic:${favoriteButton.dataset.topicFavorite}`)
        : false;
      favoriteButton.setAttribute('aria-pressed', String(saved));
      favoriteButton.classList.toggle('is-saved', saved);
      favoriteButton.textContent = saved ? '★ 已收藏主題' : '☆ 收藏主題';
    }

    window.addEventListener('storage', updateTopicFavorite);
    updateTopicFavorite();
    actions.append(favoriteButton, button);
    document.body.appendChild(actions);

    overlay = document.createElement('div');
    overlay.className = 'topic-notebook-overlay';
    overlay.hidden = true;
    overlay.addEventListener('click', closeNotebook);

    book = document.createElement('section');
    book.className = 'topic-notebook';
    book.setAttribute('role', 'dialog');
    book.setAttribute('aria-modal', 'true');
    book.setAttribute('aria-label', `${topicNames[topic]}自訂筆記本`);
    book.tabIndex = -1;
    book.addEventListener('click', (event) => event.stopPropagation());

    cover = document.createElement('div');
    cover.className = 'topic-notebook-cover';
    cover.innerHTML = `<span class="topic-notebook-cover-kicker">PICKME / NOTEBOOK</span><strong>${topicNames[topic]}</strong><img src="${assetUrl(`images/tool-${tool}.png`)}" alt="${toolNames[tool]}" draggable="false"><span>${toolNames[tool]}・自訂手帳</span>`;

    const pages = document.createElement('div');
    pages.className = 'topic-notebook-pages';
    pages.innerHTML = `
      <nav class="topic-notebook-tabs" aria-label="筆記本頁面">
        <button type="button" class="is-active" data-page="0">抽取記錄</button>
        <button type="button" data-page="1">選項編輯</button>
        <button type="button" data-page="2">其他設定</button>
      </nav>
      <div class="topic-notebook-page-wrap">
        <article class="topic-notebook-page is-active" data-page-panel="0">
          <div class="topic-notebook-page-title"><span>01</span><h2>抽取記錄</h2></div>
          <p class="topic-notebook-help">每次完成抽取後，結果會記錄在這裡。</p>
          <ol class="topic-notebook-records"></ol>
          <button type="button" class="topic-notebook-clear">清除記錄</button>
        </article>
        <article class="topic-notebook-page" data-page-panel="1">
          <div class="topic-notebook-page-title"><span>02</span><h2>選項編輯</h2></div>
          <p class="topic-notebook-help">設定每個項目放入工具的數量；數量越多，抽中的機率越高。</p>
          <p class="topic-notebook-slot-note" hidden>預設選項沿用拉霸機原本內容；新增自訂選項後，該分類改用你的選項。</p>
          <div class="topic-notebook-option-list"></div>
          <form class="topic-notebook-add-form">
            <input type="text" maxlength="60" placeholder="留白會自動新增「選項1」" aria-label="新選項">
            <button type="submit">新增選項</button>
          </form>
          <button type="button" class="topic-notebook-reset-options">重設項目</button>
        </article>
        <article class="topic-notebook-page" data-page-panel="2">
          <div class="topic-notebook-page-title"><span>03</span><h2>其他設定</h2></div>
          <p class="topic-notebook-help">調整抽取方式與筆記本提示音效。</p>
          <label class="topic-notebook-switch-row">
            <span><strong>抽取後不放回</strong><small>已抽取的選項暫不重複，抽完後可重新補回。</small></span>
            <input type="checkbox" role="switch" data-setting="noReplacement">
            <i aria-hidden="true"></i>
          </label>
          <label class="topic-notebook-switch-row">
            <span><strong>提示音效</strong><small>自訂抽取結果時播放輕柔提示音。</small></span>
            <input type="checkbox" role="switch" data-setting="sound">
            <i aria-hidden="true"></i>
          </label>
          <div class="topic-notebook-reset-pool-row">
            <button type="button" class="topic-notebook-reset-pool">補回所有抽取選項</button>
            <small>抽完後按此按鈕，可將已抽取的項目重新放回抽選池。</small>
          </div>
        </article>
      </div>
      <div class="topic-notebook-page-number"><span>PickMe</span><b>01 / 03</b></div>
    `;

    book.append(cover, pages);
    overlay.appendChild(book);
    document.body.appendChild(overlay);

    optionsList = book.querySelector('.topic-notebook-option-list');
    if (state.groups.length) {
      book.querySelector('[data-page-panel="1"] .topic-notebook-help').textContent =
        '每個分類各抽一項；可分別編輯分類內容與數量，數量越多，該項目在分類中的機率越高。';
    }
    if (tool === 'slot') {
      book.querySelector('.topic-notebook-slot-note').hidden = false;
    }
    if (tool === 'card') optionsList.classList.add('is-card-options');
    let groupSelect;
    if (state.groups.length) {
      optionsList.classList.add('is-grouped-options');
      groupSelect = document.createElement('select');
      groupSelect.className = 'topic-notebook-add-group';
      groupSelect.setAttribute('aria-label', '新增至分類');
      state.groups.forEach((group) => {
        const option = document.createElement('option');
        option.value = group.key;
        option.textContent = group.label;
        groupSelect.appendChild(option);
      });
      book.querySelector('.topic-notebook-add-form').insertBefore(
        groupSelect,
        book.querySelector('.topic-notebook-add-form button'),
      );
    }
    if (tool === 'card') {
      const raritySelect = document.createElement('select');
      raritySelect.className = 'topic-notebook-add-rarity';
      raritySelect.setAttribute('aria-label', '新卡牌等級');
      raritySelect.innerHTML = '<option value="SSR">SSR 等級</option><option value="SR">SR 等級</option><option value="R" selected>R 等級</option>';
      book.querySelector('.topic-notebook-add-form').insertBefore(
        raritySelect,
        book.querySelector('.topic-notebook-add-form button'),
      );
    }
    recordList = book.querySelector('.topic-notebook-records');
    noteStatus = document.createElement('p');
    noteStatus.className = 'topic-notebook-status';
    noteStatus.setAttribute('aria-live', 'polite');
    book.querySelector('.topic-notebook-pages').appendChild(noteStatus);

    book.querySelectorAll('.topic-notebook-tabs button').forEach((tab) => {
      tab.addEventListener('click', () => showPage(Number(tab.dataset.page)));
    });
    book.querySelector('.topic-notebook-add-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input');
      const rawValue = input.value.trim();
      const targetGroup = state.groups.length
        ? state.groups.find((item) => item.key === groupSelect.value)
        : null;
      const optionsForNaming = targetGroup && tool === 'slot' && !state.slotOverrides.includes(targetGroup.key)
        ? []
        : targetGroup?.options || state.options;
      const value = rawValue || (
        tool === 'slot' && targetGroup?.key === 'people'
          ? nextNumericOption(targetGroup.options)
          : nextOptionName(optionsForNaming)
      );
      if (tool === 'card' && state.options.some((option) => option.value === value)) {
        updateStatus('此卡牌項目已存在，請調整原項目的數量以提高抽中機率。');
        return;
      }
      if (state.groups.length) {
        const group = targetGroup;
        const groupOptionsForCheck = tool === 'slot' && !state.slotOverrides.includes(group.key)
          ? []
          : group.options;
        if (groupOptionsForCheck.some((option) => option.value === value)) {
          updateStatus(`「${value}」已在「${group.label}」分類中。`);
          return;
        }
        if (tool === 'slot' && !state.slotOverrides.includes(group.key)) {
          group.options = [];
          group.remaining = [];
          state.slotOverrides.push(group.key);
        }
        group.options.push({ value, quantity: 1 });
        group.remaining = expandOptions(group.options);
        input.value = '';
        saveState();
        renderOptions();
        syncWheelOptions();
        return;
      }
      const rarity = tool === 'card' ? event.currentTarget.querySelector('.topic-notebook-add-rarity').value : undefined;
      state.options.push({
        value,
        quantity: 1,
        ...(tool === 'card' ? { rarity } : {}),
      });
      state.remaining = expandOptions(state.options);
      input.value = '';
      saveState();
      renderOptions();
      syncWheelOptions();
    });
    book.querySelector('.topic-notebook-reset-options').addEventListener('click', () => {
      if (state.groups.length) {
        state.groups = defaultGroups.map((group) => ({
          ...group,
          options: group.options
            .slice(0, optionLimits[tool] || Infinity)
            .map((option) => ({ ...option })),
          remaining: expandOptions(group.options.slice(0, optionLimits[tool] || Infinity)),
        }));
        state.slotOverrides = [];
      }
      state.options = defaultOptions.map((option) => ({ ...option }));
      state.remaining = expandOptions(state.options);
      saveState();
      renderOptions();
      syncWheelOptions();
      updateStatus('項目已還原為預設內容及數量。');
    });
    book.querySelector('.topic-notebook-clear').addEventListener('click', () => {
      state.records = [];
      saveState();
      renderRecords();
    });
    book.querySelectorAll('[data-setting]').forEach((input) => {
      input.checked = state[input.dataset.setting];
      input.addEventListener('change', () => {
        state[input.dataset.setting] = input.checked;
        if (input.dataset.setting === 'noReplacement') {
          state.remaining = expandOptions(state.options);
          state.groups.forEach((group) => { group.remaining = expandOptions(group.options); });
          syncWheelOptions();
        }
        saveState();
      });
    });
    book.querySelector('.topic-notebook-reset-pool').addEventListener('click', () => {
      state.remaining = expandOptions(state.options);
      state.groups.forEach((group) => { group.remaining = expandOptions(group.options); });
      saveState();
      syncWheelOptions();
      updateStatus('已補回所有參與抽選的選項。');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeNotebook();
    });

    renderOptions();
    renderRecords();
    if (tool !== 'slot') syncWheelOptions();
    installResultTracking();
    installSoundSetting();
  }

  function syncWheelOptions() {
    if (tool === 'slot') {
      if (typeof window.setNotebookSlotOptions !== 'function') {
        console.error('找不到拉霸選項更新功能，無法同步自訂項目。');
        return;
      }
      const groups = state.groups.map((group, index) => {
        if (!state.slotOverrides.includes(group.key)) {
          return state.noReplacement
            ? group.remaining.slice()
            : expandOptions(defaultGroups[index].options);
        }
        return state.noReplacement
          ? group.remaining.slice()
          : expandOptions(group.options);
      });
      window.setNotebookSlotOptions(groups);
      return;
    }
    if (tool !== 'wheel') return;
    if (typeof window.setNotebookWheelOptions !== 'function') {
      console.error('找不到轉盤選項更新功能，無法同步自訂項目。');
      return;
    }
    const options = state.noReplacement ? state.remaining : expandOptions(state.options);
    window.setNotebookWheelOptions(options);
  }

  function updateStatus(message) {
    if (noteStatus) noteStatus.textContent = message;
  }

  function nextOptionName(options) {
    const values = new Set(options.map((option) => option.value));
    let number = 1;
    while (values.has(`選項${number}`)) number += 1;
    return `選項${number}`;
  }

  function nextNumericOption(options) {
    const numbers = options.map((option) => Number(option.value)).filter(Number.isInteger);
    return String(Math.max(0, ...numbers) + 1);
  }

  function renderOptions() {
    if (!optionsList) return;
    optionsList.replaceChildren();
    if (state.groups.length) {
      state.groups.forEach((group) => {
        const section = document.createElement('section');
        section.className = 'topic-notebook-option-group';
        const heading = document.createElement('h3');
        heading.textContent = group.label;
        section.appendChild(heading);
        if (tool !== 'slot' || state.slotOverrides.includes(group.key)) {
          group.options.forEach((option, index) => {
            section.appendChild(createOptionRow(option, index, group));
          });
        }
        optionsList.appendChild(section);
      });
      return;
    }
    state.options.forEach((option, index) => {
      optionsList.appendChild(createOptionRow(option, index));
    });
  }

  function createOptionRow(option, index, group = null) {
    const row = document.createElement('div');
    row.className = `topic-notebook-option${option.quantity === 0 ? ' is-inactive' : ''}`;
    const number = document.createElement('span');
    number.className = 'topic-notebook-option-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('span');
    text.className = 'topic-notebook-option-text';
    text.textContent = option.value;
    let rarity;
    if (tool === 'card') {
      rarity = document.createElement('span');
      rarity.className = `topic-notebook-option-rarity is-${option.rarity}`;
      rarity.textContent = option.rarity;
      rarity.setAttribute('aria-label', `${option.rarity}等級`);
    }
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '0';
    quantity.max = '999';
    quantity.inputMode = 'numeric';
    quantity.className = 'topic-notebook-option-quantity';
    quantity.setAttribute('aria-label', `${option.value}的抽選數量`);
    quantity.value = String(option.quantity);
    quantity.addEventListener('change', () => {
      const value = Number(quantity.value);
      if (!Number.isInteger(value) || value < 0 || value > 999) {
        updateStatus('項目數量請設定為 0 到 999。');
        quantity.value = String(option.quantity);
        return;
      }
      if (
        tool === 'slot' &&
        group &&
        value === 0 &&
        group.options.every((item) => item === option || item.quantity === 0)
      ) {
        updateStatus(`「${group.label}」分類至少要保留一個數量大於 0 的項目。`);
        quantity.value = String(option.quantity);
        return;
      }
      option.quantity = value;
      if (group) group.remaining = expandOptions(group.options);
      else state.remaining = expandOptions(state.options);
      saveState();
      renderOptions();
      syncWheelOptions();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'topic-notebook-remove';
    remove.setAttribute('aria-label', `刪除選項：${option.value}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      if (group) {
        if (tool === 'slot' && group.options.length === 1) {
          updateStatus(`「${group.label}」分類至少要保留一個項目。`);
          return;
        }
        group.options.splice(index, 1);
        group.remaining = expandOptions(group.options);
      } else {
        state.options.splice(index, 1);
        state.remaining = expandOptions(state.options);
      }
      saveState();
      renderOptions();
      syncWheelOptions();
    });
    row.append(number, text);
    if (rarity) row.appendChild(rarity);
    row.append(quantity, remove);
    return row;
  }

  function renderRecords() {
    if (!recordList) return;
    recordList.replaceChildren();
    if (!state.records.length) {
      const empty = document.createElement('li');
      empty.className = 'topic-notebook-empty';
      empty.textContent = '還沒有抽取記錄，開始使用工具後結果會出現在這裡。';
      recordList.appendChild(empty);
      return;
    }
    [...state.records].reverse().forEach((record) => {
      const item = document.createElement('li');
      const date = document.createElement('time');
      date.textContent = record.date;
      const result = document.createElement('strong');
      result.textContent = record.result;
      item.append(date, result);
      recordList.appendChild(item);
    });
  }

  function openNotebook() {
    clearTimeout(closeTimer);
    returnFocus = document.activeElement;
    overlay.hidden = false;
    book.classList.remove('is-open', 'is-page-flipping');
    cover.hidden = false;
    showPage(activeTab, false);
    book.focus();
    closeTimer = setTimeout(() => {
      book.classList.add('is-open');
      cover.hidden = true;
      showPage(0);
    }, 850);
  }

  function closeNotebook() {
    if (overlay.hidden) return;
    clearTimeout(closeTimer);
    overlay.hidden = true;
    returnFocus?.focus?.();
  }

  function showPage(index, animate = true) {
    activeTab = index;
    const tabs = book.querySelectorAll('.topic-notebook-tabs button');
    const panels = book.querySelectorAll('.topic-notebook-page');
    tabs.forEach((tab, tabIndex) => {
      tab.classList.toggle('is-active', tabIndex === index);
      tab.setAttribute('aria-current', tabIndex === index ? 'page' : 'false');
    });
    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle('is-active', panelIndex === index);
      panel.classList.remove('is-flipping');
      if (panelIndex === index && animate) {
        void panel.offsetWidth;
        panel.classList.add('is-flipping');
      }
    });
    book.querySelector('.topic-notebook-page-number b').textContent = `${String(index + 1).padStart(2, '0')} / 03`;
    if (index === 0) renderRecords();
  }

  function getResultTarget() {
    if (tool === 'slot') return document.querySelector('#msg');
    if (tool === 'card') return document.querySelector('#card-name, #card-image');
    if (tool === 'gacha') return document.querySelector('#cardNumber');
    if (tool === 'wheel') return document.querySelector('#resultText');
    if (tool === 'claw') {
      return document.querySelector('.pickme-result-text') || document.querySelector('#result');
    }
    return null;
  }

  function isInProgress(text) {
    return !text || /READY TO PLAY|正在|旋轉中|生成中|抽選中|等待|重新開始|娃娃已重新排列|抓一隻娃娃|抓娃娃來決定|本輪.*已全部使用|自訂選項已抽完|沒有抓到/.test(text);
  }

  function installResultTracking() {
    const target = getResultTarget();
    if (!target) {
      console.error(`找不到${toolNames[tool]}的抽取結果區，無法記錄自訂結果。`);
      return;
    }
    resultObserver = new MutationObserver(() => {
      const text = readResultText(target);
      if (isInProgress(text)) {
        lastAppliedResult = '';
        return;
      }
      if (text === lastAppliedResult) return;
      clearTimeout(resultTimer);
      resultTimer = setTimeout(() => applyCustomResult(target, text), 140);
    });
    resultObserver.observe(target, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: target.tagName === 'IMG',
      attributeFilter: target.tagName === 'IMG' ? ['src', 'alt'] : undefined,
    });
  }

  function readResultText(target) {
    if (target.tagName !== 'IMG') return target.textContent.trim();
    if (target.alt && target.alt !== '穿搭風格圖片') return target.alt.trim();
    if (!target.getAttribute('src')) return '';
    const filename = new URL(target.src).pathname.split('/').pop();
    return decodeURIComponent(filename.replace(/\.[^.]+$/, ''));
  }

  function chooseOptions(count) {
    if (state.groups.length) {
      const selected = [];
      for (const group of state.groups) {
        const available = group.options.filter(({ quantity }) => quantity > 0);
        if (!available.length) {
          updateStatus(`請在「${group.label}」分類中至少保留一個數量大於 0 的項目。`);
          return [];
        }
        if (!state.noReplacement) {
          selected.push(chooseWeightedOption(available));
          continue;
        }
        if (!group.remaining.length) {
          updateStatus(`「${group.label}」分類已抽完，請至設定頁補回所有抽取選項。`);
          return [];
        }
        const index = Math.floor(Math.random() * group.remaining.length);
        selected.push(group.remaining.splice(index, 1)[0]);
      }
      if (state.noReplacement) {
        saveState();
        if (state.groups.some((group) => !group.remaining.length)) {
          updateStatus('有分類的選項已抽完；可在設定頁補回所有抽取選項。');
        }
      }
      return selected;
    }

    const available = state.options.filter(({ quantity }) => quantity > 0);
    if (!available.length) {
      updateStatus('請至少為一個項目設定大於 0 的數量。');
      return [];
    }
    if (!state.noReplacement) {
      return Array.from({ length: count }, () => chooseWeightedOption(available));
    }

    const selected = [];
    for (let index = 0; index < count; index += 1) {
      if (!state.remaining.length) break;
      const position = Math.floor(Math.random() * state.remaining.length);
      selected.push(state.remaining.splice(position, 1)[0]);
    }
    saveState();
    if (!state.remaining.length) updateStatus('選項已抽完；可在設定頁補回所有選項。');
    return selected;
  }

  function chooseWeightedOption(options) {
    const total = options.reduce((sum, option) => sum + option.quantity, 0);
    let selected = Math.random() * total;
    return options.find(({ quantity }) => (selected -= quantity) < 0).value;
  }

  function applyCustomResult(target, original) {
    if (tool === 'slot') {
      lastAppliedResult = original;
      if (state.noReplacement) {
        const reels = [...document.querySelectorAll('.symbol')].slice(0, 3);
        reels.forEach((reel, index) => {
          const value = reel.querySelector('.symbol-label')?.textContent.trim();
          const remaining = state.groups[index]?.remaining;
          const position = remaining?.indexOf(value) ?? -1;
          if (position >= 0) remaining.splice(position, 1);
        });
        if (state.groups.some((group) => !group.remaining.length)) {
          updateStatus('有分類的選項已抽完；可在設定頁補回所有抽取選項。');
        }
        saveState();
        syncWheelOptions();
      }
      state.records.push({
        date: new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
        result: original,
        original,
      });
      if (state.records.length > 100) state.records.splice(0, state.records.length - 100);
      saveState();
      renderRecords();
      if (state.sound) playNotebookSound();
      return;
    }

    if (tool === 'wheel') {
      lastAppliedResult = original;
      if (state.noReplacement) {
        const index = state.remaining.indexOf(original);
        if (index >= 0) state.remaining.splice(index, 1);
        if (!state.remaining.length) updateStatus('選項已抽完；可在設定頁補回所有選項。');
        syncWheelOptions();
      }
      state.records.push({
        date: new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
        result: original,
        original,
      });
      if (state.records.length > 100) state.records.splice(0, state.records.length - 100);
      saveState();
      renderRecords();
      if (state.sound) playNotebookSound();
      return;
    }

    const count = tool === 'claw' ? 3 : 1;
    const selected = chooseOptions(count);
    if (!selected.length) return;

    const result = selected.join(' × ');
    lastAppliedResult = result;
    const selectedOption = state.options.find((option) => option.value === selected[0]);
    const rarity = selectedOption?.rarity || defaultRarities.get(selected[0]) || 'R';
    target.textContent = result;
    if (tool === 'card') {
      const rarityElement = document.querySelector('#card-rarity');
      if (rarityElement) rarityElement.textContent = getCardRarityLabel(rarity);
      const card = document.querySelector('#card-output');
      if (card) {
        card.classList.remove('SSR', 'SR', 'R');
        card.classList.add(rarity);
      }
      if (target.tagName === 'IMG') {
        let label = document.querySelector('.topic-notebook-card-result');
        if (!label) {
          label = document.createElement('span');
          label.className = 'topic-notebook-card-result';
          target.parentElement.appendChild(label);
        }
        let rarityLabel = document.querySelector('.topic-notebook-card-rarity');
        if (!rarityLabel) {
          rarityLabel = document.createElement('span');
          rarityLabel.className = 'topic-notebook-card-rarity';
          target.parentElement.appendChild(rarityLabel);
        }
        const imagePath = topic === 'outfit'
          ? window.getOutfitCardImage?.(selected[0])
          : null;
        if (imagePath) {
          target.classList.remove('image-error');
          target.style.display = '';
          target.alt = selected[0];
          target.src = imagePath;
          target.parentElement.classList.remove('is-text-result');
          label.hidden = true;
          rarityLabel.hidden = true;
        } else {
          target.alt = result;
          target.style.display = 'none';
          target.parentElement.classList.add('is-text-result');
          label.textContent = result;
          label.hidden = false;
          rarityLabel.className = `topic-notebook-card-rarity is-${rarity}`;
          rarityLabel.textContent = rarity;
          rarityLabel.hidden = false;
        }
      }
    }
    if (tool === 'claw') {
      const modalResult = document.querySelector('.pickme-result-text');
      if (modalResult) modalResult.textContent = result;
    }

    state.records.push({
      date: new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
      result,
      original,
    });
    if (state.records.length > 100) state.records.splice(0, state.records.length - 100);
    saveState();
    renderRecords();
    if (state.sound) playNotebookSound();
  }

  function getCardRarityLabel(rarity) {
    const rarityElement = document.querySelector('#card-rarity');
    const existingLabel = rarityElement?.textContent.trim() || '';
    const category = existingLabel.replace(/^(SSR|SR|R)\s*/, '').trim()
      || ({ travel: 'COLLECTION', draw: 'CHARACTER', challenge: 'CHALLENGE', outfit: 'STYLE' }[topic] || '');
    return [rarity, category].filter(Boolean).join(' ');
  }

  function installSoundSetting() {
    if (typeof window.playBeep !== 'function' || window.playBeep.__pickMeWrapped) return;
    const originalPlayBeep = window.playBeep;
    const wrapped = function (...args) {
      if (!state.sound) return;
      return originalPlayBeep.apply(this, args);
    };
    wrapped.__pickMeWrapped = true;
    window.playBeep = wrapped;
  }

  function playNotebookSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.addEventListener('ended', () => context.close(), { once: true });
    } catch (error) {
      console.error('無法播放自訂提示音效。', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNotebook, { once: true });
  } else {
    createNotebook();
  }
})();
