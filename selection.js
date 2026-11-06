(() => {
  'use strict';

  const tools = {
    slot: { name: '拉霸機', image: 'images/tool-slot.png' },
    card: { name: '抽卡機', image: 'images/tool-card.png' },
    claw: { name: '娃娃機', image: 'images/tool-claw.png' },
    gacha: { name: '扭蛋機', image: 'images/tool-gacha.png' },
    wheel: { name: '轉盤', image: 'images/tool-wheel.png' },
  };
  const categories = {
    draw: { name: '畫畫沒靈感', tools: ['slot', 'card', 'claw'] },
    challenge: { name: '社牛大挑戰', tools: ['slot', 'card', 'gacha'] },
    travel: { name: '假日去哪逛', tools: ['wheel', 'card', 'gacha'] },
    food: { name: '三餐吃什麼', tools: ['wheel', 'gacha', 'claw'] },
    outfit: { name: '穿什麼', tools: ['slot', 'card', 'claw'] },
  };
  const categoryId = new URLSearchParams(location.search).get('category');
  const category = categories[categoryId];
  const title = document.querySelector('#selectionTitle');
  const grid = document.querySelector('#toolChoices');
  const error = document.querySelector('#selectionError');
  const loader = document.querySelector('#toolNavigationLoader');
  const loaderLabel = document.querySelector('#toolNavigationLabel');
  let navigating = false;

  if (!category) {
    title.textContent = '選擇工具';
    error.hidden = false;
    grid.hidden = true;
    return;
  }

  title.textContent = category.name;
  for (const toolId of category.tools) {
    const tool = tools[toolId];
    const card = document.createElement('a');
    card.className = 'tool-select-card';
    card.href = `${categoryId}/${categoryId}-${toolId}.html`;
    card.setAttribute('aria-label', `選擇${tool.name}`);

    const image = document.createElement('img');
    image.src = tool.image;
    image.alt = '';
    image.draggable = false;

    const name = document.createElement('span');
    name.textContent = tool.name;

    card.append(image, name);
    grid.appendChild(card);
  }

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('.tool-select-card');
    if (!card || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (navigating) return;

    navigating = true;
    loaderLabel.textContent = `正在前往${card.getAttribute('aria-label').replace('選擇', '')}`;
    loader.hidden = false;
    document.body.classList.add('loading');
    card.setAttribute('aria-busy', 'true');

    const destination = new URL(card.href);
    destination.searchParams.set('curtain', 'open');
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1500;
    setTimeout(() => location.assign(destination.href), delay);
  });

  window.addEventListener('pageshow', () => {
    navigating = false;
    loader.hidden = true;
    document.body.classList.remove('loading');
    grid.querySelectorAll('[aria-busy="true"]').forEach((card) => card.removeAttribute('aria-busy'));
  });
})();
