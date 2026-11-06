(() => {
  'use strict';

  const scriptUrl = document.currentScript.src;
  const assetUrl = (path) => new URL(path, scriptUrl).href;

  function initializeSharedEffects() {
    if (!document.body.classList.contains('topics-page') && !document.querySelector('.pickme-tool-nav')) {
      const nav = document.createElement('header');
      nav.className = 'pickme-tool-nav';
      nav.setAttribute('aria-label', 'PickMe 導覽');

      const logoLink = document.createElement('a');
      logoLink.className = 'pickme-tool-logo';
      logoLink.href = assetUrl('index.html');
      logoLink.setAttribute('aria-label', 'PickMe 首頁');

      const logo = document.createElement('img');
      logo.src = assetUrl('images/pickme-logo.png');
      logo.alt = 'PickMe!';
      logo.draggable = false;
      logoLink.appendChild(logo);

      const homeLink = document.createElement('a');
      homeLink.className = 'pickme-tool-home';
      homeLink.href = assetUrl('index.html');
      homeLink.setAttribute('aria-label', '回首頁');
      homeLink.title = '回首頁';
      homeLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';

      nav.append(logoLink, homeLink);
      document.body.prepend(nav);
    }

    if (!window.PickMeCursorLoaded && !document.querySelector('script[data-pickme-cursor]')) {
      const cursorScript = document.createElement('script');
      cursorScript.src = assetUrl('cursor.js');
      cursorScript.dataset.pickmeCursor = '';
      document.body.appendChild(cursorScript);
    }

    const result = document.querySelector('#game-machine #result');
    if (!result) return;

    const overlay = document.createElement('div');
    overlay.className = 'pickme-result-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'presentation');

    const box = document.createElement('section');
    box.className = 'pickme-result-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'pickme-result-title');
    box.tabIndex = -1;

    const title = document.createElement('div');
    title.className = 'pickme-result-title';
    title.id = 'pickme-result-title';
    title.textContent = '✦ 結果揭曉 ✦';

    const text = document.createElement('div');
    text.className = 'pickme-result-text';

    box.append(title, text);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let previousFocus = null;
    let resultTimer = 0;
    const closeResult = () => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      previousFocus?.focus();
    };
    const showResult = (message) => {
      text.textContent = message;
      result.textContent = '';
      overlay.hidden = true;
      window.clearTimeout(resultTimer);
      // Let the notebook replace the built-in result before revealing the dialog.
      resultTimer = window.setTimeout(() => {
        if (!text.textContent.trim()) return;
        previousFocus = document.activeElement;
        overlay.hidden = false;
        box.focus();
      }, 240);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeResult();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeResult();
    });

    new MutationObserver(() => {
      const message = result.textContent.trim();
      if (!message) return;
      if (/正在|來看看會夾到什麼|抓娃娃來決定|重新開始！抓一隻娃娃吧|娃娃已重新排列|本輪.*已全部使用|自訂選項已抽完/.test(message)) {
        window.clearTimeout(resultTimer);
        return;
      }
      showResult(message);
    }).observe(result, { childList: true, characterData: true, subtree: true });
  }

  function initializeTopicNotebook() {
    const match = location.pathname.match(
      /\/(travel|food|draw|challenge|outfit)\/\1-(card|claw|gacha|slot|wheel)\.html$/
    );
    if (!match) return;

    const loadNotebook = () => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = assetUrl('topic-notebook.css');
      stylesheet.addEventListener('error', () => {
        console.error('無法載入主題自訂筆記本樣式。');
      }, { once: true });
      document.head.appendChild(stylesheet);

      const script = document.createElement('script');
      script.src = assetUrl('topic-notebook.js');
      script.addEventListener('error', () => {
        console.error('無法載入主題自訂筆記本功能。');
      }, { once: true });
      document.body.appendChild(script);
    };

    if (window.Auth) {
      loadNotebook();
      return;
    }

    const authScript = document.createElement('script');
    authScript.src = assetUrl('auth.js');
    authScript.addEventListener('load', loadNotebook, { once: true });
    authScript.addEventListener('error', () => {
      console.error('無法載入登入狀態，主題自訂筆記本未啟用。');
    }, { once: true });
    document.body.appendChild(authScript);
  }

  function initializeToolIntroNotebook() {
    if (!/\/tool\/(gacha|slot|claw|wheel|card)\.html$/.test(location.pathname)) return;

    const loadNotebook = () => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = assetUrl('tool-intro-notebook.css');
      stylesheet.addEventListener('error', () => {
        console.error('無法載入工具介紹自訂筆記本樣式。');
      }, { once: true });
      document.head.appendChild(stylesheet);

      const script = document.createElement('script');
      script.src = assetUrl('tool-intro-notebook.js');
      script.addEventListener('error', () => {
        console.error('無法載入工具介紹自訂筆記本功能。');
      }, { once: true });
      document.body.appendChild(script);
    };

    if (window.Auth) {
      loadNotebook();
      return;
    }

    const authScript = document.createElement('script');
    authScript.src = assetUrl('auth.js');
    authScript.addEventListener('load', loadNotebook, { once: true });
    authScript.addEventListener('error', () => {
      console.error('無法載入登入狀態，工具介紹自訂筆記本未啟用。');
    }, { once: true });
    document.body.appendChild(authScript);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSharedEffects();
      initializeTopicNotebook();
      initializeToolIntroNotebook();
    }, { once: true });
  } else {
    initializeSharedEffects();
    initializeTopicNotebook();
    initializeToolIntroNotebook();
  }

  if (new URLSearchParams(location.search).get('curtain') !== 'open') return;

  const root = document.documentElement;
  const loader = document.createElement('div');
  const isToolPage = /(?:^|\/)(?:[^/]+-)?(?:gacha|slot|claw|wheel|card)\.html$/i.test(location.pathname);
  loader.className = `pickme-curtain-loader${isToolPage ? ' pickme-tool-loader' : ''}`;
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');

  const body = document.createElement('div');
  body.className = 'pickme-curtain-body';

  const logo = document.createElement('img');
  logo.className = 'pickme-curtain-logo';
  logo.src = assetUrl('images/pickme-logo.png');
  logo.alt = 'PickMe!';
  logo.draggable = false;

  const tools = document.createElement('div');
  tools.className = 'pickme-curtain-tools';
  tools.setAttribute('aria-hidden', 'true');
  ['gacha', 'slot', 'claw', 'wheel', 'card'].forEach((tool, index) => {
    const image = document.createElement('img');
    image.src = assetUrl(`images/tool-${tool}.png`);
    image.alt = '';
    image.draggable = false;
    image.style.setProperty('--i', index);
    tools.appendChild(image);
  });

  const text = document.createElement('p');
  text.className = 'pickme-curtain-text';
  text.append('GO!GO!GO!', ...Array.from({ length: 3 }, () => {
    const dot = document.createElement('span');
    dot.textContent = '.';
    return dot;
  }));
  body.append(logo, tools, text);

  const wave = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wave.setAttribute('class', 'pickme-curtain-wave');
  wave.setAttribute('viewBox', '0 0 1440 120');
  wave.setAttribute('preserveAspectRatio', 'none');
  wave.setAttribute('aria-hidden', 'true');
  const wavePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wavePath.setAttribute('d', 'M0 0H1440V50C1360 100 1280 100 1200 60S1040 20 960 60 800 110 720 70 560 20 480 60 320 105 240 70 80 30 0 70Z');
  wave.appendChild(wavePath);
  loader.append(body, wave);

  root.classList.add('pickme-curtain-pending');
  root.appendChild(loader);

  const reveal = () => {
    const revealDelay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 50;
    setTimeout(() => {
      root.classList.add('pickme-curtain-revealing');
      void loader.offsetWidth;
      loader.classList.add('done');
    }, revealDelay);
    loader.addEventListener('transitionend', (event) => {
      if (event.target !== loader || event.propertyName !== 'transform') return;
      loader.remove();
      root.classList.remove('pickme-curtain-pending', 'pickme-curtain-revealing');
    });
    setTimeout(() => {
      loader.remove();
      root.classList.remove('pickme-curtain-pending', 'pickme-curtain-revealing');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 1500);
  };

  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal, { once: true });
})();
