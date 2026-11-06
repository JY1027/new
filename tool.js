(() => {
  'use strict';

  const tools = {
    gacha: { name: '扭蛋機', image: 'images/tool-gacha.png', action: '轉出驚喜' },
    slot: { name: '拉霸機', image: 'images/tool-slot.png', action: '開始拉霸' },
    claw: { name: '娃娃機', image: 'images/tool-claw.png', action: '伸爪抓取' },
    wheel: { name: '轉盤', image: 'images/tool-wheel.png', action: '轉動命運' },
    sticks: { name: '抽籤', image: 'images/tool-sticks.png', action: '抽出一籤' },
    card: { name: '抽卡機', image: 'images/tool-card.png', action: '抽出一張卡' },
  };
  const id = new URLSearchParams(location.search).get('tool');
  const tool = tools[id] || tools.wheel;
  const app = document.querySelector('#toolApp');
  const name = document.querySelector('#toolName');
  const image = document.querySelector('#toolImage');
  const options = document.querySelector('#options');
  const error = document.querySelector('#toolError');
  const result = document.querySelector('#result');
  const resultText = document.querySelector('#resultText');
  const drawButton = document.querySelector('#drawButton');
  const favoriteButton = document.querySelector('#toolFavorite');
  const toolId = tools[id] ? id : 'wheel';

  document.title = `PickMe｜${tool.name}`;
  app.dataset.tool = toolId;
  name.textContent = tool.name;
  image.src = tool.image;
  image.alt = tool.name;
  drawButton.textContent = tool.action;

  function updateFavorite() {
    const saved = Boolean(Auth.user() && Auth.favs().includes(toolId));
    favoriteButton.classList.toggle('on', saved);
    favoriteButton.setAttribute('aria-pressed', String(saved));
    favoriteButton.querySelector('span').textContent = saved ? '已收藏' : 'Favorite';
  }

  favoriteButton.addEventListener('click', () => {
    if (!Auth.user()) {
      location.href = `login.html?next=${encodeURIComponent(`tool.html?tool=${toolId}`)}`;
      return;
    }
    Auth.toggleFav(toolId);
    updateFavorite();
  });
  window.addEventListener('storage', updateFavorite);
  updateFavorite();

  function draw() {
    const choices = options.value.split(/\r?\n/).map((choice) => choice.trim()).filter(Boolean);
    if (choices.length < 2) {
      error.textContent = '至少輸入兩個選項，才能開始遊戲喔！';
      result.hidden = true;
      options.focus();
      return;
    }
    error.textContent = '';
    resultText.textContent = choices[Math.floor(Math.random() * choices.length)];
    result.hidden = false;
    app.classList.remove('play');
    void image.offsetWidth;
    app.classList.add('play');
    clearTimeout(draw.animationTimer);
    draw.animationTimer = setTimeout(() => app.classList.remove('play'), 900);
    result.classList.remove('result-pop');
    void result.offsetWidth;
    result.classList.add('result-pop');
  }

  drawButton.addEventListener('click', draw);
  document.querySelector('#againButton').addEventListener('click', draw);
})();
