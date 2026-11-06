(() => {
  'use strict';

  const match = location.pathname.match(/\/tool\/(gacha|slot|claw|wheel|card)\.html$/);
  if (!match) return;

  const tool = match[1];
  const toolNames = { gacha: '扭蛋機', slot: '拉霸機', claw: '娃娃機', wheel: '轉盤', card: '抽卡機' };
  const limits = { slot: 3, claw: 5 };
  const defaultOptionCounts = { gacha: 10, slot: 3, claw: 5, wheel: 5 };
  const pageStateKey = `pickme_tool_notebook:${tool}:`;
  const user = window.Auth?.user?.();
  const pageStateId = user?.email ? `${pageStateKey}${encodeURIComponent(user.email)}` : null;
  const favorites = window.Auth?.customFavorites?.() || [];
  const params = new URLSearchParams(location.search);
  const favoriteId = params.get('favorite');
  const favoriteConfig = favoriteId ? favorites.find((item) => item.id === favoriteId && item.tool === tool) : null;
  let draftConfig = null;
  let sequence = 0;
  try {
    draftConfig = params.has('draft') ? JSON.parse(params.get('draft')) : null;
  } catch (error) {
    console.error('讀取待登入的工具設定失敗。', error);
  }
  const state = {
    groups: initialGroups(),
    mode: 'matching',
    noReplacement: false,
    sound: true,
    records: [],
  };
  let overlay;
  let book;
  let status;
  let recordsList;
  let optionsPanel;
  let openedFavorite = false;

  function initialGroups(mode = 'matching') {
    if (tool === 'card') {
      return ['SSR', 'SR', 'R'].map((label, index) => ({
        id: newId(),
        label,
        options: [{ id: newId(), value: `選項${['一', '二', '三'][index]}` }],
        used: [],
      }));
    }
    if (tool === 'slot' && mode === 'combination') {
      return ['一', '二', '三'].map((number, index) => ({
        id: newId(),
        label: `類別 ${index + 1}`,
        options: [{ id: newId(), value: `選項${number}` }],
        used: [],
      }));
    }
    return [{
      id: newId(),
      label: tool === 'slot' ? '選項類別' : '自訂選項',
      options: Array.from({ length: defaultOptionCounts[tool] || 3 }, (_, index) => ({
        id: newId(),
        value: `選項${toChineseNumber(index + 1)}`,
      })),
      used: [],
    }];
  }

  function toChineseNumber(number) {
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (number <= 10) return number === 10 ? '十' : digits[number];
    if (number < 20) return `十${digits[number % 10]}`;
    if (number < 100) return `${digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ''}`;
    return String(number);
  }

  function nextOptionName(group) {
    const names = new Set(group.options.map((option) => option.value));
    let number = 1;
    while (names.has(`選項${toChineseNumber(number)}`)) number += 1;
    return `選項${toChineseNumber(number)}`;
  }

  function newId() {
    sequence += 1;
    return `${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  function normalizeGroups(groups) {
    if (!Array.isArray(groups)) return initialGroups();
    const maximum = limits[tool] || (tool === 'card' ? 3 : 1);
    const normalized = groups.slice(0, maximum).map((group, index) => ({
      id: typeof group.id === 'string' ? group.id : newId(),
      label: tool === 'card' ? ['SSR', 'SR', 'R'][index] : String(group.label || `類別 ${index + 1}`).trim(),
      options: Array.isArray(group.options)
        ? group.options.map((option) => typeof option === 'string'
          ? { id: newId(), value: option.trim() }
          : { id: typeof option?.id === 'string' ? option.id : newId(), value: String(option?.value || '').trim() })
          .filter((option) => option.value)
        : [],
      used: Array.isArray(group.used) ? group.used.filter((id) => typeof id === 'string') : [],
    }));
    if (tool === 'card') {
      return ['SSR', 'SR', 'R'].map((label, index) =>
        normalized[index] || { id: newId(), label, options: [], used: [] });
    }
    return normalized.length ? normalized : initialGroups();
  }

  function getConfig() {
    return {
      tool,
      groups: state.groups.map((group) => ({
        id: group.id,
        label: group.label,
        options: group.options.filter((option) => option.value.trim()).map((option) => ({ ...option })),
        used: group.used.slice(),
      })),
      mode: state.mode,
      noReplacement: state.noReplacement,
      sound: state.sound,
    };
  }

  function synchronize() {
    if (typeof window.PickMeIntroTool?.configure !== 'function') return false;
    const applied = window.PickMeIntroTool.configure(getConfig());
    if (applied === false) return false;
    state.groups.forEach((group) => {
      const optionIds = new Set(group.options.map((option) => option.id));
      group.used = group.used.filter((id) => optionIds.has(id));
    });
    persist();
    renderOptions();
    return true;
  }

  function persist() {
    if (!pageStateId) return;
    try {
      localStorage.setItem(pageStateId, JSON.stringify({
        ...getConfig(),
        records: state.records.slice(-100),
      }));
    } catch (error) {
      console.error('儲存工具自訂筆記本失敗。', error);
      setStatus('設定無法儲存，請檢查瀏覽器儲存空間。');
    }
  }

  function loadState() {
    if (favoriteConfig) {
      state.groups = normalizeGroups(favoriteConfig.groups);
      state.mode = favoriteConfig.mode === 'combination' ? 'combination' : 'matching';
      state.noReplacement = favoriteConfig.noReplacement === true;
      state.sound = favoriteConfig.sound !== false;
      return;
    }
    if (draftConfig) {
      state.groups = normalizeGroups(draftConfig.groups);
      state.mode = draftConfig.mode === 'combination' ? 'combination' : 'matching';
      state.noReplacement = draftConfig.noReplacement === true;
      state.sound = draftConfig.sound !== false;
      return;
    }
    if (!pageStateId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(pageStateId) || 'null');
      if (!saved) return;
      state.groups = normalizeGroups(saved.groups);
      state.mode = saved.mode === 'combination' ? 'combination' : 'matching';
      state.noReplacement = saved.noReplacement === true;
      state.sound = saved.sound !== false;
      state.records = Array.isArray(saved.records) ? saved.records.slice(-100) : [];
    } catch (error) {
      console.error('讀取工具自訂筆記本失敗。', error);
      localStorage.removeItem(pageStateId);
    }
  }

  function tutorialFinished() {
    if (tool === 'gacha') {
      return !document.querySelector('#tutorialOverlay')?.classList.contains('show');
    }
    const card = document.querySelector('#tutorialCard, #tutorial-card');
    return Boolean(card?.classList.contains('hidden'));
  }

  function installTutorialObserver() {
    if (favoriteConfig || draftConfig) {
      const skip = document.querySelector('#tutorialSkip, #tutorial-skip');
      if (skip && !tutorialFinished()) skip.click();
    }
    if (tutorialFinished()) {
      revealButton();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!tutorialFinished()) return;
      observer.disconnect();
      revealButton();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  }

  function revealButton() {
    synchronize();
    const button = document.createElement('button');
    button.className = 'tool-notebook-button';
    button.type = 'button';
    button.setAttribute('aria-label', `開啟${toolNames[tool]}自訂筆記本`);
    button.innerHTML = '<span aria-hidden="true">✎</span><span>自訂</span>';
    button.addEventListener('click', openNotebook);
    document.body.appendChild(button);
    if ((favoriteConfig || draftConfig) && !openedFavorite) {
      openedFavorite = true;
      window.setTimeout(openNotebook, 120);
    }
  }

  function openNotebook() {
    overlay.hidden = false;
    document.body.classList.add('tool-notebook-open');
    book.classList.remove('is-opened');
    book.classList.add('is-opening');
    window.setTimeout(() => {
      book.classList.remove('is-opening');
      book.classList.add('is-opened');
    }, 620);
    book.focus();
    renderOptions();
    renderRecords();
  }

  function closeNotebook(event) {
    if (event && event.target !== overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('tool-notebook-open');
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function createNotebook() {
    overlay = document.createElement('div');
    overlay.className = 'tool-notebook-overlay';
    overlay.hidden = true;
    overlay.addEventListener('click', closeNotebook);

    book = document.createElement('section');
    book.className = 'tool-notebook';
    book.tabIndex = -1;
    book.setAttribute('role', 'dialog');
    book.setAttribute('aria-modal', 'true');
    book.setAttribute('aria-label', `${toolNames[tool]}自訂筆記本`);
    book.addEventListener('click', (event) => event.stopPropagation());

    const categoryEditor = tool === 'card'
      ? `<div class="tool-notebook-rarities">
          ${['SSR', 'SR', 'R'].map((rarity, index) => `<section class="tool-notebook-rarity is-${rarity}"><h4>${rarity}</h4><div class="tool-notebook-option-list" data-rarity="${index}"></div><button class="tool-notebook-add-option" data-add-option="${index}" type="button">＋ 新增${rarity}選項</button></section>`).join('')}
        </div>`
      : `<div class="tool-notebook-groups"></div>
         <button class="tool-notebook-add-group" type="button">＋ 新增類別</button>`;
    const slotMode = tool === 'slot'
      ? `<fieldset class="tool-notebook-mode"><legend>拉霸結果方式</legend>
          <label><input type="radio" name="tool-slot-mode" value="matching" checked><span><strong>同類連連看</strong><small>三個轉輪抽同一類選項，三項相同即連線。</small></span></label>
          <label><input type="radio" name="tool-slot-mode" value="combination"><span><strong>異類組合搭配</strong><small>各類別各抽一項，顯示搭配結果。</small></span></label>
        </fieldset>`
      : '';
    book.innerHTML = `
      <button class="tool-notebook-close" type="button" aria-label="關閉筆記本">×</button>
      <header class="tool-notebook-cover"><span>PICKME / NOTEBOOK</span><h2>${toolNames[tool]}</h2><img src="../images/tool-${tool}.png" alt=""><p>自訂選項筆記本</p></header>
      <nav class="tool-notebook-tabs" aria-label="筆記本頁面">
        <button type="button" data-page="records" class="is-active">抽取記錄</button>
        <button type="button" data-page="edit">選項編輯</button>
        <button type="button" data-page="settings">其他設定</button>
      </nav>
      <div class="tool-notebook-content">
        <section class="tool-notebook-page is-active" data-page-panel="records">
          <h3>抽取記錄</h3><p class="tool-notebook-help">每次完成抽取後，結果會記錄在這裡。</p>
          <ol class="tool-notebook-records"></ol><button class="tool-notebook-clear" type="button">清除記錄</button>
        </section>
        <section class="tool-notebook-page" data-page-panel="edit">
          <h3>選項編輯</h3>
          <p class="tool-notebook-help">內容完全依照你輸入的選項抽取，不會以預設項目補足。可調整每個項目的數量，數量越多越容易抽中。</p>
          ${slotMode}${categoryEditor}
        </section>
        <section class="tool-notebook-page" data-page-panel="settings">
          <h3>其他設定</h3>
          <label class="tool-notebook-switch"><span><strong>抽取後不放回</strong><small>抽過的選項在補回前不會重複。</small></span><input type="checkbox" data-setting="noReplacement"><i></i></label>
          <label class="tool-notebook-switch"><span><strong>提示音效</strong><small>自訂抽取結果時播放輕柔提示音。</small></span><input type="checkbox" data-setting="sound"><i></i></label>
          <button class="tool-notebook-save-favorite" type="button">☆ 儲存目前設定至 Favorite</button>
          <label class="tool-notebook-favorite-name">收藏名稱<input type="text" maxlength="60" placeholder="${toolNames[tool]}自訂設定"></label>
          <button class="tool-notebook-refill" type="button">補回所有抽取選項</button>
          <p class="tool-notebook-help">儲存到 Favorite 需要先登入；登入者的筆記本設定會保存在此瀏覽器。</p>
        </section>
      </div>
      <p class="tool-notebook-status" aria-live="polite"></p>`;

    const openingCover = document.createElement('div');
    openingCover.className = 'tool-notebook-opening-cover';
    const openingTitle = document.createElement('strong');
    openingTitle.textContent = toolNames[tool];
    const openingImage = document.createElement('img');
    openingImage.src = `../images/tool-${tool}.png`;
    openingImage.alt = '';
    openingCover.append(openingTitle, openingImage, document.createTextNode('自訂選項筆記本'));
    book.appendChild(openingCover);

    overlay.appendChild(book);
    document.body.appendChild(overlay);
    status = book.querySelector('.tool-notebook-status');
    recordsList = book.querySelector('.tool-notebook-records');
    optionsPanel = book.querySelector('.tool-notebook-groups');

    book.querySelector('.tool-notebook-close').addEventListener('click', () => closeNotebook());
    book.querySelectorAll('.tool-notebook-tabs button').forEach((tab) => tab.addEventListener('click', () => showPage(tab.dataset.page)));
    book.querySelector('.tool-notebook-clear').addEventListener('click', () => {
      state.records = [];
      persist();
      renderRecords();
    });
    book.querySelector('[data-setting="noReplacement"]').checked = state.noReplacement;
    book.querySelector('[data-setting="sound"]').checked = state.sound;
    book.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('change', () => {
      state[input.dataset.setting] = input.checked;
      synchronize();
    }));
    book.querySelector('.tool-notebook-refill').addEventListener('click', () => {
      state.groups.forEach((group) => { group.used = []; });
      setStatus('已補回所有抽取選項。');
      synchronize();
    });
    book.querySelector('.tool-notebook-save-favorite').addEventListener('click', saveFavorite);
    if (favoriteConfig?.name) {
      book.querySelector('.tool-notebook-favorite-name input').value = favoriteConfig.name;
    }
    book.querySelector('.tool-notebook-add-group')?.addEventListener('click', addGroup);
    book.querySelectorAll('[data-add-option]').forEach((button) => button.addEventListener('click', () => {
      addOption(state.groups[Number(button.dataset.addOption)]);
    }));
    book.querySelectorAll('.tool-notebook-mode input').forEach((input) => {
      input.checked = input.value === state.mode;
      input.addEventListener('change', () => {
        state.mode = input.value;
        if (state.mode === 'combination' && state.groups.length < 2) state.groups.push(emptyGroup());
        synchronize();
        renderOptions();
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeNotebook();
    });
  }

  function emptyGroup() {
    return { id: newId(), label: `類別 ${state.groups.length + 1}`, options: [], used: [] };
  }

  function addOption(group) {
    group.options.push({ id: newId(), value: nextOptionName(group) });
    renderOptions();
    synchronize();
  }

  function renderOptionList(group, container) {
    container.replaceChildren();
    const grouped = new Map();
    group.options.forEach((option) => {
      if (!grouped.has(option.value)) grouped.set(option.value, []);
      grouped.get(option.value).push(option);
    });
    grouped.forEach((options, value) => {
      const row = document.createElement('div');
      row.className = 'tool-notebook-option-row';
      const name = document.createElement('input');
      name.className = 'tool-notebook-option-value';
      name.type = 'text';
      name.maxLength = 500;
      name.value = value;
      name.placeholder = '輸入選項內容';
      name.setAttribute('aria-label', `${group.label}選項內容`);
      name.addEventListener('change', () => {
        const nextValue = name.value.trim();
        if (!nextValue) {
          group.options = group.options.filter((option) => option.value !== value);
        } else {
          options.forEach((option) => { option.value = nextValue; });
        }
        synchronize();
      });

      const quantityLabel = document.createElement('label');
      quantityLabel.className = 'tool-notebook-quantity';
      quantityLabel.appendChild(document.createTextNode('數量'));
      const quantity = document.createElement('input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.max = '999';
      quantity.value = String(options.length);
      quantity.setAttribute('aria-label', `${value || '新選項'}數量`);
      quantity.addEventListener('change', () => {
        const count = Math.max(1, Math.min(999, Math.trunc(Number(quantity.value) || 1)));
        quantity.value = String(count);
        const current = group.options.filter((option) => option.value === value);
        group.options = group.options.filter((option) => option.value !== value);
        const resized = current.slice(0, count);
        while (resized.length < count) resized.push({ id: newId(), value });
        group.options.push(...resized);
        synchronize();
      });
      quantityLabel.appendChild(quantity);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tool-notebook-remove-option';
      remove.textContent = '刪除';
      remove.setAttribute('aria-label', `刪除${value || '新選項'}`);
      remove.addEventListener('click', () => {
        group.options = group.options.filter((option) => option.value !== value);
        synchronize();
      });
      row.append(name, quantityLabel, remove);
      container.appendChild(row);
    });
  }

  function addGroup() {
    const maximum = limits[tool];
    if (tool === 'slot' && state.mode === 'matching') {
      setStatus('同類連連看模式只需設定一個選項類別。');
      return;
    }
    if (state.groups.length >= maximum) {
      setStatus(`${toolNames[tool]}最多設定 ${maximum} 個類別。`);
      return;
    }
    state.groups.push(emptyGroup());
    renderOptions();
    synchronize();
  }

  function renderOptions() {
    if (tool === 'card') {
      book.querySelectorAll('[data-rarity]').forEach((container, index) => {
        renderOptionList(state.groups[index], container);
      });
      return;
    }
    optionsPanel.replaceChildren();
    state.groups.forEach((group, index) => {
      const section = document.createElement('section');
      section.className = 'tool-notebook-group';
      section.hidden = tool === 'slot' && state.mode === 'matching' && index > 0;
      const heading = document.createElement('div');
      heading.className = 'tool-notebook-group-heading';
      const label = document.createElement('input');
      label.type = 'text';
      label.maxLength = 30;
      label.value = group.label;
      label.setAttribute('aria-label', `第 ${index + 1} 類別名稱`);
      label.addEventListener('change', () => {
        group.label = label.value.trim() || `類別 ${index + 1}`;
        synchronize();
      });
      heading.append(label);
      if (state.groups.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '刪除類別';
        remove.addEventListener('click', () => {
          state.groups.splice(index, 1);
          renderOptions();
          synchronize();
        });
        heading.appendChild(remove);
      }
      const optionList = document.createElement('div');
      optionList.className = 'tool-notebook-option-list';
      renderOptionList(group, optionList);
      const addOptionButton = document.createElement('button');
      addOptionButton.className = 'tool-notebook-add-option';
      addOptionButton.type = 'button';
      addOptionButton.textContent = '＋ 新增選項';
      addOptionButton.addEventListener('click', () => addOption(group));
      section.append(heading, optionList, addOptionButton);
      optionsPanel.appendChild(section);
    });
    book.querySelector('.tool-notebook-add-group').hidden =
      !limits[tool] || state.groups.length >= limits[tool] || (tool === 'slot' && state.mode === 'matching');
  }

  function showPage(page) {
    book.querySelectorAll('.tool-notebook-tabs button').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.page === page);
    });
    book.querySelectorAll('.tool-notebook-page').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.pagePanel === page);
    });
    if (page === 'records') renderRecords();
  }

  function renderRecords() {
    recordsList.replaceChildren();
    if (!state.records.length) {
      const empty = document.createElement('li');
      empty.className = 'tool-notebook-empty';
      empty.textContent = '還沒有抽取記錄，開始使用工具後結果會出現在這裡。';
      recordsList.appendChild(empty);
      return;
    }
    state.records.slice().reverse().forEach((record) => {
      const item = document.createElement('li');
      const date = document.createElement('time');
      date.textContent = record.date;
      const result = document.createElement('strong');
      result.textContent = record.result;
      item.append(date, result);
      recordsList.appendChild(item);
    });
  }

  function choose() {
    const selections = [];
    const targets = tool === 'card'
      ? state.groups.flatMap((group) => group.options.map((option) => ({ ...option, group })))
      : tool === 'slot' && state.mode === 'matching' ? [state.groups[0]] : state.groups;
    if (tool === 'card') {
      const available = targets.filter(({ group, id, value }) =>
        value.trim() && (!state.noReplacement || !group.used.includes(id)));
      if (!available.length) {
        setStatus('沒有可抽取卡牌，請編輯或補回選項。');
        return null;
      }
      const selected = available[Math.floor(Math.random() * available.length)];
      if (state.noReplacement) selected.group.used.push(selected.id);
      if (state.sound) playSound();
      persist();
      return [{ value: selected.value, rarity: selected.group.label, group: selected.group, id: selected.id, index: available.findIndex((option) => option.id === selected.id) }];
    }
    for (const group of targets) {
      let available = group.options.filter((option) => option.value.trim());
      if (state.noReplacement) available = available.filter((option) => !group.used.includes(option.id));
      if (!available.length) {
        setStatus(`「${group.label}」沒有可抽取項目，請編輯或補回選項。`);
        return null;
      }
      const selected = available[Math.floor(Math.random() * available.length)];
      selections.push({ value: selected.value, rarity: tool === 'card' ? group.label : null, group, id: selected.id, index: available.findIndex((option) => option.id === selected.id) });
      if (state.noReplacement) {
        group.used ||= [];
        group.used.push(selected.id);
      }
    }
    if (tool === 'slot' && state.mode === 'matching' && selections.length) {
      selections.push({ ...selections[0] }, { ...selections[0] });
    }
    if (state.sound) playSound();
    persist();
    return selections;
  }

  function canChoose() {
    if (tool === 'card') {
      return state.groups.some((group) => group.options.some((option) =>
        option.value.trim() && (!state.noReplacement || !group.used.includes(option.id))));
    }
    const targets = tool === 'slot' && state.mode === 'matching' ? state.groups.slice(0, 1) : state.groups;
    return targets.length > 0 && targets.every((group) => group.options.some((option) =>
      option.value.trim() && (!state.noReplacement || !group.used.includes(option.id))));
  }

  function record(result) {
    state.records.push({
      date: new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
      result: String(result),
    });
    if (state.records.length > 100) state.records.splice(0, state.records.length - 100);
    persist();
    renderRecords();
    window.PickMeIntroTool?.refresh?.(getConfig());
  }

  function playSound() {
    if (!state.sound) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      oscillator.addEventListener('ended', () => context.close(), { once: true });
    } catch (error) {
      console.error('播放筆記本提示音效失敗。', error);
    }
  }

  function saveFavorite() {
    if (!window.Auth?.user?.()) {
      const next = `tool/${tool}.html?draft=${encodeURIComponent(JSON.stringify(getConfig()))}`;
      location.href = `../login.html?next=${encodeURIComponent(next)}`;
      return;
    }
    if (!state.groups.some((group) => group.options.some((option) => option.value.trim()))) {
      setStatus('請先新增自訂選項，再儲存 Favorite。');
      return;
    }
    const config = getConfig();
    config.groups.forEach((group) => { group.used = []; });
    const saved = window.Auth.saveCustomFavorite({
      ...(favoriteConfig?.id ? { id: favoriteConfig.id } : {}),
      name: book.querySelector('.tool-notebook-favorite-name input').value.trim()
        || `${toolNames[tool]}設定 ${new Date().toLocaleDateString('zh-TW')}`,
      ...config,
    });
    if (!saved) {
      setStatus('儲存 Favorite 失敗，請確認登入狀態。');
      return;
    }
    setStatus('已儲存至「自訂收藏」。');
  }

  function installGlobalApi() {
    window.PickMeIntroNotebook = { choose, canChoose, record, getConfig };
  }

  loadState();
  if (!state.groups.some((group) => group.options.some((option) => option.value.trim()))) {
    state.groups = initialGroups(state.mode);
  }
  createNotebook();
  installGlobalApi();
  renderOptions();
  renderRecords();
  installTutorialObserver();
})();
