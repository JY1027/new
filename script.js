/* =========================================================
   choice header — 動態視覺
   ① 舞臺縮放：用固定「設計座標」排版，再整體 scale
   ② 問號沿橢圓弧移動：角度 = 雲朵相對頭部的方位，用 lerp 平滑追蹤
   ③ 思考泡泡：在「雲朵邊緣 ↔ 頭髮邊緣」之間自動排列
   ④ 雲朵手繪線條「呼吸」：hover 時輪流切換三組 SVG 濾鏡
   ⑤ 滑鼠視差：只更新 --mx / --my 兩個 CSS 變數，由 CSS 決定每層移動多少
   ⑥ 輪盤：一個連續的 rot 數值決定所有圖示的角度，滾輪/拖曳只是在改 target
   ========================================================= */
(() => {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero      = $('#hero');
  const track     = $('#track');
  const scene     = $('#scene');
  const qmark     = $('#qmark');
  const dotsLayer = $('#dots');
  const wheelEl   = $('#wheel');
  const nodesBox  = $('#nodes');
  const toolsBox  = $('#tools');
  const footerPage = $('#footerPage');
  const footerTop = $('#footerTop');
  const ringMain  = $('#ringMain');
  const ringDash  = $('#ringDash');
  const live      = $('#toolLive');
  const topicButton = $('#topicButton');
  const favButton = $('#favButton');
  const favPanel  = $('#favPanel');
  const favCount  = $('#favCount');
  const loginLink = $('#loginLink');
  const toast     = $('#toast');
  let favoriteCategory = 'custom';
  const hasIntro  = Boolean(track && toolsBox && footerPage && footerTop && topicButton && favButton && favPanel && favCount && loginLink && toast && window.Auth);

  /* ---------- 設計座標（要和 CSS 的 .scene / .girl 一致） ---------- */
  const SCENE_W = 880, SCENE_H = 800;
  const HEAD = { x: 400, y: 530 };     // 女孩頭部中心
  const HAIR = { rx: 150, ry: 125 };   // 頭髮大概的範圍（泡泡從這裡開始排）
  const ARC  = { rx: 190, ry: 165 };   // 問號移動的橢圓弧半徑
  const Q_DEFAULT = deg2rad(38);       // 沒有 hover 時，問號停在右上方

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  let W = 0, H = 0, K = 1, stageProgress = 0; // 視窗尺寸、輪盤比例、舞臺進度

  /* =========================================================
     ① 版面：場景縮放 + 輪盤位置
     ========================================================= */
  let R = 400, cx = 0, cy = 0;

  function layout() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    K = clamp(Math.min(H / 860, W / 1300), 0.55, 1.1);

    // 左邊場景可用寬度 = 視窗 - 輪盤佔的寬度
    const zone  = 250 * K + 20;
    const areaW = W - zone;
    const s     = Math.min(areaW / SCENE_W, (H - 70) / SCENE_H, 1.35);
    const left  = (areaW - SCENE_W * s) / 2;
    const top   = H - SCENE_H * s;       // 貼著底部，女孩的下半身才不會浮空
    scene.style.transform = `translate(${left}px, ${top}px) scale(${s})`;

    // 輪盤：大圓的圓心在畫面右側外面，只露出左邊一段弧
    R = clamp(H * 0.55, 300, 540);
    const activeX = W - 165 * K + (135 * K - (W - 165 * K)) * clamp(stageProgress, 0, 1);
    cx = activeX + R;
    cy = H * 0.53;
    wheelEl.style.transformOrigin = `${cx}px ${cy}px`;
    for (const c of [ringMain, ringDash]) { c.setAttribute('cx', cx); c.setAttribute('cy', cy); }
    ringMain.setAttribute('r', R);
    ringMain.setAttribute('stroke-width', 9 * K);
    ringDash.setAttribute('r', R - 125 * K);
    ringDash.setAttribute('stroke-width', 4 * K);
    ringDash.setAttribute('stroke-dasharray', `1 ${22 * K}`);
    wheelEl.style.setProperty('--zone', `${zone + 40 * K}px`);

    updateDots();
    updateWheel();
  }

  /* =========================================================
     ② 雲朵：資料、hover、手繪呼吸
     ========================================================= */
  const clouds = $$('.cloud').map((el) => {
    const w = el.offsetWidth, h = el.offsetHeight;
    const ccx = el.offsetLeft + w / 2, ccy = el.offsetTop + h / 2;
    return {
      el, w, h, cx: ccx, cy: ccy,
      // 雲朵相對頭部的方位角（數學座標：y 往上為正，所以 dy 要取負）
      ang: Math.atan2(-(ccy - HEAD.y), ccx - HEAD.x),
      shape: $('.cloud-shape', el),
      dots: [],
      timer: null,
    };
  });

  const Q = { a: Q_DEFAULT, target: Q_DEFAULT, energy: 0, energyTarget: 0, paint: 0, paintTarget: 0 };
  let activeTopic = null;

  function enter(c) {
    activeTopic = c.el.dataset.topic;
    Q.target = activeTopic === 'paint' ? deg2rad(205) : c.ang;
    Q.paintTarget = activeTopic === 'paint' ? 1 : 0;
    Q.energyTarget = 1;
    c.el.classList.add('is-hover');
    c.dots.forEach((d) => d.classList.add('on'));
    if (!reduceMotion && !c.timer) {  // 線條「呼吸」：每 140ms 換一組位移濾鏡
      let n = 0;
      c.timer = setInterval(() => {
        n = (n + 1) % 3;
        c.shape.style.filter = `url(#rough${n + 1})`;
      }, 140);
    }
  }
  function leave(c) {
    activeTopic = null;
    Q.target = Q_DEFAULT;
    Q.paintTarget = 0;
    Q.energyTarget = 0;
    c.el.classList.remove('is-hover');
    c.dots.forEach((d) => d.classList.remove('on'));
    clearInterval(c.timer); c.timer = null;
    c.shape.style.filter = 'url(#rough1)';
  }

  clouds.forEach((c) => {
    c.el.addEventListener('pointerenter', () => enter(c));
    c.el.addEventListener('pointerleave', () => leave(c));
    c.el.addEventListener('focus', () => enter(c));
    c.el.addEventListener('blur',  () => leave(c));
    const openSelection = () => {
      location.href = `select.html?category=${encodeURIComponent(c.el.dataset.category)}`;
    };
    c.el.addEventListener('click', openSelection);
    c.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      openSelection();
    });
  });

  /* ---------- ③ 思考泡泡：從頭髮邊緣排到雲朵邊緣 ---------- */
  const DOT_SIZES = [12, 18, 26];      // 靠近頭 → 靠近雲，越來越大（漫畫思考泡泡慣例）
  clouds.forEach((c) => {
    DOT_SIZES.forEach((size, n) => {
      const d = document.createElement('i');
      d.className = 'dot';
      d.style.width = d.style.height = size + 'px';
      d.style.setProperty('--n', n);
      dotsLayer.appendChild(d);
      c.dots.push(d);
    });
  });

  // 橢圓在某個方向上的半徑
  const ellipseR = (rx, ry, ux, uy) => 1 / Math.hypot(ux / rx, uy / ry);

  function updateDots() {
    clouds.forEach((c) => {
      const dx = c.cx - HEAD.x, dy = c.cy - HEAD.y;
      const dist = Math.hypot(dx, dy);
      const ux = dx / dist, uy = dy / dist;
      const rHair  = ellipseR(HAIR.rx, HAIR.ry, ux, uy);
      const rCloud = ellipseR(c.w / 2, c.h / 2, ux, uy) * 0.92;
      const gap = Math.max(dist - rHair - rCloud, 30);
      [0.2, 0.5, 0.8].forEach((t, n) => {
        const r = rHair + gap * t;
        const size = DOT_SIZES[n];
        c.dots[n].style.left = HEAD.x + ux * r - size / 2 + 'px';
        c.dots[n].style.top  = HEAD.y + uy * r - size / 2 + 'px';
      });
    });
  }

  /* =========================================================
     ⑤ 滑鼠視差
     ========================================================= */
  let tx = 0, ty = 0, mx = 0, my = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;    // -1 ~ 1
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  /* =========================================================
     ⑥ 輪盤
     N 個位置、每個相隔 STEP 度。5 個工具重複 3 輪 → 看起來是無限轉動。
     rot 是「目前轉到第幾格」（可以是小數），位置完全由它算出來。
     ========================================================= */
  const TOOLS = [
    { id: 'gacha', name: '扭蛋機', img: 'images/tool-gacha.png', bg: '#ffd9d4', en: 'GACHA', desc: '把選項放進扭蛋裡，轉一下、打開驚喜，讓今天的選擇多一點期待感。' },
    { id: 'slot', name: '拉霸機', img: 'images/tool-slot.png', bg: '#ffe8a8', en: 'SLOT', desc: '把煩惱交給轉動的輪軸，等圖案停下來，看看命運替你排出的答案。' },
    { id: 'claw', name: '娃娃機', img: 'images/tool-claw.png', bg: '#d4efdf', en: 'CLAW', desc: '瞄準心裡猶豫的選項，伸出爪子抓一個上來，今天就由它陪你出發。' },
    { id: 'wheel', name: '轉盤', img: 'images/tool-wheel.png', bg: '#d3e6ff', en: 'WHEEL', desc: '把所有可能攤在轉盤上，轉出一個方向，下一步就從這裡開始。' },
    { id: 'card', name: '抽卡機', img: 'images/tool-card.png', bg: '#ffe0bd', en: 'CARD', desc: '安靜地抽出一張卡，讓簡單的小小儀式，替你的選擇畫下句點。' },
  ];
  const N = TOOLS.length * 3;          // 15 格
  const STEP = 360 / N;                // 24°
  const wrap = (d) => ((d + N / 2) % N + N) % N - N / 2;   // 把差值收進 [-N/2, N/2)

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function starIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm24 5 5.8 12 13.2 1.9-9.5 9.2 2.2 13L24 35l-11.7 6.1 2.2-13L5 18.9 18.2 17 24 5Z');
    svg.appendChild(path);
    return svg;
  }

  function buildSlides() {
    for (const [index, tool] of TOOLS.entries()) {
      const slide = make('article', 'slide');
      slide.dataset.tool = tool.id;
      slide.style.setProperty('--sbg', tool.bg);
      slide.setAttribute('aria-label', `${tool.name}工具介紹`);

      const wave = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wave.setAttribute('class', 'slide-wave');
      wave.setAttribute('viewBox', '0 0 1440 120');
      wave.setAttribute('preserveAspectRatio', 'none');
      wave.setAttribute('aria-hidden', 'true');
      const wavePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      wavePath.setAttribute('d', 'M0 0H1440V50C1360 100 1280 100 1200 60S1040 20 960 60 800 110 720 70 560 20 480 60 320 105 240 70 80 30 0 70Z');
      wave.appendChild(wavePath);
      slide.appendChild(wave);

      slide.appendChild(make('span', 's-ghost', tool.en));
      const art = make('div', 's-art');
      art.setAttribute('aria-hidden', 'true');
      art.append(make('span', 's-ring'), make('span', 's-blob'));
      const image = make('img', 's-img');
      image.src = tool.img;
      image.alt = '';
      image.draggable = false;
      art.appendChild(image);
      slide.appendChild(art);

      const body = make('div', 's-body');
      const tag = make('span', 's-tag', `PICK ME  /  0${index + 1}`);
      tag.style.setProperty('--n', '0');
      const title = make('h2', 's-title', tool.name);
      title.style.setProperty('--n', '1');
      const desc = make('p', 's-desc', tool.desc);
      desc.style.setProperty('--n', '2');
      const actions = make('div', 's-actions');
      actions.style.setProperty('--n', '3');

      const tryLink = make('a', 'btn-kick', '踹踹看');
      tryLink.href = `tool/${encodeURIComponent(tool.id)}.html?curtain=open`;
      const star = make('button', 'btn-star', '收藏');
      star.type = 'button';
      star.dataset.toolId = tool.id;
      star.setAttribute('aria-pressed', 'false');
      star.prepend(starIcon());
      actions.append(tryLink, star);
      body.append(tag, title, desc, actions);
      slide.appendChild(body);
      toolsBox.appendChild(slide);
    }
  }

  if (hasIntro) buildSlides();

  const nodes = Array.from({ length: N }, (_, i) => {
    const tool = TOOLS[i % TOOLS.length];
    const el = document.createElement('div');
    el.className = 'node';
    el.style.setProperty('--nbg', tool.bg);
    el.innerHTML =
      `<button class="node-btn" type="button" aria-label="${tool.name}">` +
      `<img src="${tool.img}" alt="" draggable="false"></button>` +
      `<span class="node-label">${tool.name}</span>`;
    nodesBox.appendChild(el);
    return { el, tool, i, label: $('.node-label', el) };
  });

  let rot = 0.4;                       // 目前（會慢慢追上 target）
  let target = 0.4;                    // 目標
  let activeTool = null;

  function updateWheel() {
    for (const n of nodes) {
      const d = wrap(n.i - rot);       // 這個圖示距離「選中位置」幾格
      const ad = Math.abs(d);
      const a = deg2rad(d * STEP);
      const x = cx - R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      const near = Math.max(0, 1 - ad);                      // 越靠近選中位置越大
      const scale = (0.613 + 0.387 * near) * K;              // 92px → 150px
      const fade = ad < 2.6 ? 1 : Math.max(0, 1 - (ad - 2.6) / 0.8);

      n.el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      n.el.style.opacity = fade;
      n.el.style.visibility = fade > 0 ? 'visible' : 'hidden';
      n.el.style.zIndex = Math.round(100 - ad * 10);
      n.el.style.pointerEvents = fade > 0.2 ? 'auto' : 'none';
      n.label.style.opacity = 0.45 + 0.55 * near;
      n.el.classList.toggle('is-active', near > 0.55);
    }
    // 內圈虛線跟著轉
    ringDash.setAttribute('stroke-dashoffset', (-rot * STEP * Math.PI / 180 * (R - 125 * K)).toFixed(1));

    const tool = TOOLS[((Math.round(rot) % TOOLS.length) + TOOLS.length) % TOOLS.length];
    if (tool !== activeTool) {
      activeTool = tool;
      live.textContent = tool.name;
      hero.dataset.tool = tool.id;
      hero.dispatchEvent(new CustomEvent('tool-change', { detail: tool }));
    }
  }

  let updateStage = () => {};
  if (hasIntro) {
  const stageHeight = () => track.querySelector('.pin').clientHeight || window.innerHeight || 1;
  const goToHome = () => {
    window.scrollTo({
      top: track.offsetTop,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };
  topicButton.addEventListener('click', () => {
    const navigationLoader = loader.cloneNode(true);
    navigationLoader.id = 'topicNavigationLoader';
    navigationLoader.classList.remove('done');
    navigationLoader.querySelector('.loader-text').textContent = '主題區準備中...';
    document.body.appendChild(navigationLoader);
    document.body.classList.add('loading');
    const destination = new URL('topics.html?curtain=open', location.href);
    setTimeout(() => location.assign(destination.href), reduceMotion ? 150 : 650);
  });
  footerTop.addEventListener('click', () => {
    if (footerTop.classList.contains('is-launching')) return;
    footerTop.classList.add('is-launching');
    setTimeout(() => {
      footerTop.classList.remove('is-launching');
      goToHome();
    }, reduceMotion ? 0 : 700);
  });
  const topGhostPupils = $$('.top-ghost-pupil', footerTop);
  document.addEventListener('pointermove', (event) => {
    const bounds = footerTop.getBoundingClientRect();
    const x = clamp((event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.42), -1, 1);
    const y = clamp((event.clientY - (bounds.top + bounds.height * 0.43)) / (bounds.height * 0.3), -1, 1);
    topGhostPupils.forEach((pupil) => {
      pupil.style.left = `${28.7 + x * 25}%`;
      pupil.style.top = `${29.7 + y * 24}%`;
    });
  }, { passive: true });

  function blinkTopGhost() {
    if (!footerTop.classList.contains('is-visible')) {
      setTimeout(blinkTopGhost, 800);
      return;
    }
    footerTop.classList.add('is-blinking');
    setTimeout(() => footerTop.classList.remove('is-blinking'), 140);
    setTimeout(blinkTopGhost, 1800 + Math.random() * 3200);
  }
  setTimeout(blinkTopGhost, 1200 + Math.random() * 1800);

  function goToTool(id) {
    const index = TOOLS.findIndex((tool) => tool.id === id);
    if (index < 0) return;
    window.scrollTo({
      top: track.offsetTop + (index + 1) * stageHeight(),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  updateStage = function () {
    stageProgress = clamp((window.scrollY - track.offsetTop) / stageHeight(), 0, TOOLS.length + 1);
    hero.style.transform = `translate3d(${-clamp(stageProgress, 0, 1) * 100}%, 0, 0)`;
    hero.classList.toggle('is-away', stageProgress > 0.02);
    wheelEl.classList.toggle('is-intro', stageProgress > 0.08);

    const slidesProgress = Math.min(stageProgress, TOOLS.length);
    const currentIndex = Math.round(slidesProgress - 1);
    $$('.slide', toolsBox).forEach((slide, index) => {
      const offset = index + 1 - slidesProgress;
      slide.style.transform = `translate3d(0, ${offset * 100}%, 0)`;
      const isCurrent = stageProgress >= 0.5 && index === currentIndex;
      slide.classList.toggle('is-current', isCurrent);
      slide.classList.toggle('is-in', Math.abs(offset) < 0.8);
      slide.setAttribute('aria-hidden', String(Math.abs(offset) >= 0.5));
    });

    const footerProgress = clamp(stageProgress - TOOLS.length, 0, 1);
    footerPage.style.transform = `translate3d(${(1 - footerProgress) * 100}%, 0, 0)`;
    footerPage.classList.toggle('is-sliding', footerProgress < 1);
    footerPage.setAttribute('aria-hidden', String(footerProgress < 0.5));
    const showTopGhost = stageProgress >= 0.5;
    footerTop.classList.toggle('is-visible', showTopGhost);
    footerTop.setAttribute('aria-hidden', String(!showTopGhost));
    footerTop.tabIndex = showTopGhost ? 0 : -1;

    if (stageProgress <= 1) {
      const entry = clamp(stageProgress, 0, 1);
      const eased = entry * entry * (3 - 2 * entry);
      target = 3 * (1 - eased);
    } else {
      target = clamp(stageProgress - 1, 0, TOOLS.length - 1);
    }
    if (stageProgress > 0.01) rot = target;
    layout();
    wheelEl.style.transform = `rotate(${360 * clamp(stageProgress, 0, 1)}deg)`;
  };

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function refreshFavoriteButtons() {
    const signedIn = Boolean(Auth.user());
    const favorites = signedIn ? Auth.favs() : [];
    const customCount = signedIn ? Auth.customFavorites().length : 0;
    favCount.textContent = String(favorites.length + customCount);
    favCount.hidden = favorites.length + customCount === 0;
    $$('.btn-star', toolsBox).forEach((button) => {
      const saved = favorites.includes(button.dataset.toolId);
      button.classList.toggle('on', saved);
      button.setAttribute('aria-pressed', String(saved));
      button.lastChild.textContent = saved ? '已收藏' : '收藏';
    });
  }

  function renderFavorites() {
    favPanel.replaceChildren();
    favPanel.appendChild(make('h2', 'fp-h', '我的收藏'));
    const tabs = make('nav', 'fp-tabs');
    tabs.setAttribute('aria-label', '收藏分類');
    [
      ['custom', '自訂收藏'],
      ['tools', '工具收藏'],
      ['topics', '主題收藏'],
    ].forEach(([category, label]) => {
      const tab = make('button', `fp-tab${favoriteCategory === category ? ' is-active' : ''}`, label);
      tab.type = 'button';
      tab.dataset.favoriteCategory = category;
      tab.setAttribute('aria-pressed', String(favoriteCategory === category));
      tabs.appendChild(tab);
    });
    favPanel.appendChild(tabs);

    const favorites = Auth.user() ? Auth.favs() : [];
    if (favoriteCategory === 'custom') {
      const saved = Auth.user() ? Auth.customFavorites() : [];
      if (!saved.length) {
        favPanel.appendChild(make('p', 'fp-empty', '尚無自訂收藏，可在工具自訂筆記本儲存設定。'));
        return;
      }
      saved.forEach((config) => {
        const tool = TOOLS.find((item) => item.id === config.tool);
        if (!tool) return;
        const item = make('div', 'fp-item');
        item.style.setProperty('--nbg', tool.bg);
        const image = make('img');
        image.src = tool.img;
        image.alt = '';
        const name = make('span', 'fp-name', config.name || `${tool.name}自訂設定`);
        const go = make('button', 'fp-go', '載入');
        go.type = 'button';
        go.dataset.goFavorite = config.id;
        const remove = make('button', 'fp-rm', '移除');
        remove.type = 'button';
        remove.dataset.removeFavorite = config.id;
        item.append(image, name, go, remove);
        favPanel.appendChild(item);
      });
      return;
    }

    if (favoriteCategory === 'tools') {
      const savedTools = TOOLS.filter((tool) => favorites.includes(tool.id));
      if (!savedTools.length) {
        favPanel.appendChild(make('p', 'fp-empty', '尚無工具收藏，可從工具介紹頁收藏喜歡的工具。'));
        return;
      }
      savedTools.forEach((tool) => {
        const item = make('div', 'fp-item');
        item.style.setProperty('--nbg', tool.bg);
        const image = make('img');
        image.src = tool.img;
        image.alt = '';
        const name = make('span', 'fp-name', tool.name);
        const go = make('button', 'fp-go', '介紹');
        go.type = 'button';
        go.dataset.goTool = tool.id;
        const remove = make('button', 'fp-rm', '移除');
        remove.type = 'button';
        remove.dataset.removeTool = tool.id;
        item.append(image, name, go, remove);
        favPanel.appendChild(item);
      });
      return;
    }

    const topics = [
      { id: 'food', name: '大臺北食物', href: 'topics.html#food-guide', image: 'images/tool-claw.png', bg: '#fff0d4' },
      { id: 'attraction', name: '大臺北景點', href: 'topics.html#attraction-guide', image: 'images/tool-wheel.png', bg: '#f4e9ff' },
      { id: 'category-travel', name: '假日去哪逛', href: 'select.html?category=travel', image: 'images/tool-wheel.png', bg: '#e5f3df' },
      { id: 'category-food', name: '三餐吃什麼', href: 'select.html?category=food', image: 'images/tool-gacha.png', bg: '#fff0d4' },
      { id: 'category-draw', name: '畫畫沒靈感', href: 'select.html?category=draw', image: 'images/tool-card.png', bg: '#f4e9ff' },
      { id: 'category-challenge', name: '社牛大挑戰', href: 'select.html?category=challenge', image: 'images/tool-claw.png', bg: '#ffe5ed' },
      { id: 'category-outfit', name: '穿什麼', href: 'select.html?category=outfit', image: 'images/tool-slot.png', bg: '#e8eefc' },
    ].filter((topic) => favorites.includes(`topic:${topic.id}`));
    if (!topics.length) {
      favPanel.appendChild(make('p', 'fp-empty', '尚無主題收藏，可在主題導覽頁收藏喜愛的主題。'));
      return;
    }
    topics.forEach((topic) => {
      const item = make('div', 'fp-item');
      item.style.setProperty('--nbg', topic.bg);
      const image = make('img');
      image.src = topic.image;
      image.alt = '';
      const name = make('span', 'fp-name', topic.name);
      const go = make('a', 'fp-go', '查看');
      go.href = topic.href;
      const remove = make('button', 'fp-rm', '移除');
      remove.type = 'button';
      remove.dataset.removeTopic = topic.id;
      item.append(image, name, go, remove);
      favPanel.appendChild(item);
    });
  }

  function updateAccount() {
    const user = Auth.user();
    if (user) {
      loginLink.querySelector('span').textContent = 'logout';
      loginLink.setAttribute('aria-label', `已登入：${user.name}，點擊登出`);
      loginLink.href = '#logout';
    } else {
      loginLink.querySelector('span').textContent = 'login';
      loginLink.setAttribute('aria-label', '登入');
      loginLink.href = 'login.html';
    }
    refreshFavoriteButtons();
  }

  favButton.addEventListener('click', () => {
    if (!Auth.user()) {
      location.href = 'login.html?next=index.html';
      return;
    }
    const opening = favPanel.hidden;
    if (opening) renderFavorites();
    favPanel.hidden = !opening;
    favButton.setAttribute('aria-expanded', String(opening));
  });
  loginLink.addEventListener('click', (event) => {
    if (loginLink.getAttribute('href') !== '#logout') return;
    event.preventDefault();
    Auth.logout();
    updateAccount();
    showToast('已安全登出。');
  });
  toolsBox.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-star');
    if (!button) return;
    if (!Auth.user()) {
      location.href = 'login.html?next=index.html';
      return;
    }
    const saved = Auth.toggleFav(button.dataset.toolId);
    refreshFavoriteButtons();
    if (!favPanel.hidden) renderFavorites();
    const tool = TOOLS.find((item) => item.id === button.dataset.toolId);
    showToast(saved ? `已收藏「${tool.name}」` : `已取消收藏「${tool.name}」`);
  });
  favPanel.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-favorite-category]');
    if (tab) {
      favoriteCategory = tab.dataset.favoriteCategory;
      renderFavorites();
      return;
    }
    const goFavorite = event.target.closest('[data-go-favorite]');
    if (goFavorite) {
      const config = Auth.customFavorites().find((item) => item.id === goFavorite.dataset.goFavorite);
      if (!config) {
        showToast('找不到這組自訂收藏。');
        renderFavorites();
        return;
      }
      location.href = `tool/${encodeURIComponent(config.tool)}.html?favorite=${encodeURIComponent(config.id)}&curtain=open`;
      return;
    }
    const removeFavorite = event.target.closest('[data-remove-favorite]');
    if (removeFavorite) {
      Auth.removeCustomFavorite(removeFavorite.dataset.removeFavorite);
      renderFavorites();
      refreshFavoriteButtons();
      return;
    }
    const removeTopic = event.target.closest('[data-remove-topic]');
    if (removeTopic) {
      Auth.toggleTopicFav(removeTopic.dataset.removeTopic);
      renderFavorites();
      refreshFavoriteButtons();
      return;
    }
    const go = event.target.closest('[data-go-tool]');
    if (go) {
      favPanel.hidden = true;
      favButton.setAttribute('aria-expanded', 'false');
      goToTool(go.dataset.goTool);
      return;
    }
    const remove = event.target.closest('[data-remove-tool]');
    if (remove) {
      Auth.toggleFav(remove.dataset.removeTool);
      renderFavorites();
      refreshFavoriteButtons();
    }
  });
  document.addEventListener('click', (event) => {
    if (favPanel.hidden || event.target.closest('#favButton, #favPanel')) return;
    favPanel.hidden = true;
    favButton.setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('scroll', () => {
    if (favPanel.hidden) return;
    favPanel.hidden = true;
    favButton.setAttribute('aria-expanded', 'false');
  }, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !favPanel.hidden) {
      favPanel.hidden = true;
      favButton.setAttribute('aria-expanded', 'false');
      favButton.focus();
    }
  });
  window.addEventListener('storage', updateAccount);
  updateAccount();

  nodesBox.addEventListener('click', (event) => {
    const nodeEl = event.target.closest('.node');
    if (!nodeEl) return;
    const node = nodes.find((item) => item.el === nodeEl);
    if (node) goToTool(node.tool.id);
  });
  }

  /* ---------- 拖曳輪盤（頁面捲動由固定舞臺接手） ---------- */
  let snapTimer = null;
  const scheduleSnap = () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = Math.round(target); }, 140);   // 停下來後吸附到最近一格
  };

  wheelEl.addEventListener('wheel', (e) => {
    if (hasIntro) return;
    e.preventDefault();                                    // 在輪盤上滾動時不要捲動頁面
    const unit = e.deltaMode === 1 ? 16 : 1;
    target += clamp(e.deltaY * unit, -120, 120) * 0.006;   // 滑鼠一格約 0.6 格 → 吸附成 1 格
    scheduleSnap();
  }, { passive: false });

  /* ---------- 拖曳（手機 / 觸控板 / 滑鼠都能用）+ 點擊圖示轉過去 ---------- */
  let drag = null;
  const slotPx = () => R * deg2rad(STEP);                  // 一格在螢幕上的弧長

  wheelEl.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.wheel-hit, .node')) return;
    const node = e.target.closest('.node');
    drag = { lastY: e.clientY, moved: 0, node: node ? nodes[nodes.findIndex((n) => n.el === node)] : null };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.lastY;
    drag.lastY = e.clientY;
    drag.moved += Math.abs(dy);
    if (drag.moved > 6) {
      wheelEl.classList.add('dragging');
      target -= dy / slotPx();                             // 往下拖 → 圖示往下移
      clearTimeout(snapTimer);
    }
  });
  const endDrag = () => {
    if (!drag) return;
    if (drag.moved > 6) {
      target = Math.round(target);
      scheduleSnap();
    }
    drag = null;
    wheelEl.classList.remove('dragging');
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* =========================================================
     主迴圈：每幀更新 輪盤 / 問號 / 視差
     用 1 - exp(-dt * k) 做「與幀率無關」的平滑追蹤
     ========================================================= */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const ease = (k) => 1 - Math.exp(-dt * k);

    // 輪盤
    if (Math.abs(target - rot) > 0.0005) {
      rot += (target - rot) * ease(9);
      updateWheel();
    }

    // 視差
    if (Math.abs(tx - mx) > 0.0005 || Math.abs(ty - my) > 0.0005) {
      mx += (tx - mx) * ease(5);
      my += (ty - my) * ease(5);
      scene.style.setProperty('--mx', mx.toFixed(4));
      hero.style.setProperty('--mx', mx.toFixed(4));
      hero.style.setProperty('--my', my.toFixed(4));
      scene.style.setProperty('--my', my.toFixed(4));
    }

    // 問號：沿主題弧線移到目標角度，附帶上下浮動和搖晃
    Q.a += (Q.target - Q.a) * ease(7);
    Q.energy += (Q.energyTarget - Q.energy) * ease(8);
    Q.paint += (Q.paintTarget - Q.paint) * ease(7);
    const bob = reduceMotion ? 0 : Math.sin(t * 2.2) * 5;
    const rx = ARC.rx + (140 - ARC.rx) * Q.paint + bob;
    const ry = ARC.ry + (140 - ARC.ry) * Q.paint + bob;
    const x = HEAD.x + rx * Math.cos(Q.a);
    const y = HEAD.y - ry * Math.sin(Q.a);
    const normalTilt = (90 - rad2deg(Q.a)) * 0.28;
    const tilt = normalTilt + (-8 - normalTilt) * Q.paint
      + (reduceMotion ? 0 : Math.sin(t * 7) * 7 * Q.energy);
    qmark.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(${(1 + 0.18 * Q.energy).toFixed(3)})`;

    requestAnimationFrame(frame);
  }

  /* =========================================================
     進場 Loading：圖片+字體都好了、且至少顯示 1.6 秒，才拉開
     拉開時才移除 body.loading，主畫面的進場動畫會在這一刻開始
     ========================================================= */
  const loader = $('#loader');
  const homepageIntroScreen = $('#homepageIntroScreen');
  const homepageIntroVideo = $('#homepageIntroVideo');
  const reloadIntentKey = 'pickme_home_intro_reload';
  let reloadRequested = false;
  try {
    reloadRequested = sessionStorage.getItem(reloadIntentKey) === 'true';
    sessionStorage.removeItem(reloadIntentKey);
  } catch (error) {
    console.error('無法讀取首頁重新載入狀態。', error);
  }
  window.addEventListener('keydown', (event) => {
    const isReloadShortcut = event.key === 'F5'
      || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');
    if (!isReloadShortcut) return;
    try {
      sessionStorage.setItem(reloadIntentKey, 'true');
    } catch (error) {
      console.error('無法記錄首頁重新載入狀態。', error);
    }
  });
  const navigationEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
  const legacyNavigationType = window.performance?.navigation?.type;
  const shouldPlayHomepageIntro = reloadRequested
    || navigationEntry?.type === 'reload'
    || legacyNavigationType === 1;
  const startHomepageIntro = () => {
    if (!homepageIntroScreen || !homepageIntroVideo) {
      document.body.classList.remove('loading');
      return;
    }

    homepageIntroScreen.hidden = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      homepageIntroVideo.pause();
      homepageIntroScreen.hidden = true;
      document.body.classList.remove('loading');
    };

    homepageIntroVideo.addEventListener('ended', finish, { once: true });
    homepageIntroVideo.addEventListener('error', () => {
      console.error('首頁影片載入或播放失敗。', homepageIntroVideo.error);
      finish();
    }, { once: true });
    if (homepageIntroVideo.error) {
      console.error('首頁影片載入或播放失敗。', homepageIntroVideo.error);
      finish();
      return;
    }

    homepageIntroVideo.currentTime = 0;
    const playback = homepageIntroVideo.play();
    if (playback) {
      playback.catch((error) => {
        console.error('首頁影片無法自動播放。', error);
        finish();
      });
    }
  };
  const imgsReady = Promise.all($$('img').map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1600));
  const maxWait = new Promise((r) => setTimeout(r, 5000));      // 網路很慢也不要卡住
  Promise.race([Promise.all([imgsReady, fontsReady, minWait]), maxWait]).then(() => {
    loader.classList.add('done');
    if (shouldPlayHomepageIntro) {
      setTimeout(() => {
        loader.remove();
        startHomepageIntro();
      }, reduceMotion ? 150 : 1150);
    } else {
      setTimeout(() => document.body.classList.remove('loading'), reduceMotion ? 0 : 250);
      setTimeout(() => loader.remove(), 1400);
    }
  });

  /* ---------- 啟動 ---------- */
  window.addEventListener('resize', layout);
  layout();
  if (hasIntro) {
    let stageFrame = 0;
    window.addEventListener('scroll', () => {
      if (stageFrame) return;
      stageFrame = requestAnimationFrame(() => {
        stageFrame = 0;
        updateStage();
      });
    }, { passive: true });
    updateStage();
  }
  requestAnimationFrame(frame);
  // 進場：輪盤從第 0 格「轉」到「轉盤」那一格
  if (!hasIntro) setTimeout(() => { target = 3; }, reduceMotion ? 0 : 700);
  if (reduceMotion) { rot = target = 3; updateWheel(); }
})();
