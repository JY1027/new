/* =========================================================
   PickMe 可愛滑鼠 + 點擊特效（所有頁面共用）
   ① 星星小臉游標：會眨眼、跟著移動方向歪頭/拉伸、碰到可點的東西會開心、按下去會瞇眼
   ② 外圈虛線小圓環：慢半拍跟著游標
   ③ 移動時拖出小亮點；點擊時炸開星星 / 愛心 / 小圓點，偶爾蹦出 "Pick!"
   ④ window.PickFX.burst(x, y, opts) 提供給其他腳本（例如小精靈）放特效
   只在「有滑鼠」的裝置換游標；觸控裝置只會有點擊特效。
   ========================================================= */
(() => {
  'use strict';
  if (window.PickMeCursorLoaded) return;
  window.PickMeCursorLoaded = true;

  const cursorScriptUrl = document.currentScript?.src || new URL('cursor.js', location.href).href;
  const assetUrl = (path) => new URL(path, cursorScriptUrl).href;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  const INK = '#2b2b2b';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- 特效層 ---------- */
  const fx = document.createElement('div');
  fx.className = 'pm-fx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fx);

  const COLORS = ['#fdd070', '#ffb347', '#ff8fa3', '#8cc8ff', '#9be3b8', '#fffdf6'];
  const SHAPES = {
    star: (c) => `<svg viewBox="0 0 24 24"><path d="M12 1.6 14.6 9.4 22.4 12 14.6 14.6 12 22.4 9.4 14.6 1.6 12 9.4 9.4Z" fill="${c}" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
    heart: (c) => `<svg viewBox="0 0 24 24"><path d="M12 21C5 15.6 2.5 12.2 2.5 8.5 2.5 5.7 4.6 3.6 7.2 3.6c1.9 0 3.6 1 4.8 2.8 1.2-1.8 2.9-2.8 4.8-2.8 2.6 0 4.7 2.1 4.7 4.9 0 3.7-2.5 7.1-9.5 12.5Z" fill="${c}" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
    dot: (c) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${c}" stroke="${INK}" stroke-width="2"/></svg>`,
    note: (c) => `<svg viewBox="0 0 24 24"><path d="M9 18.5V5.5l10-2.2v12.7" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 18.5V5.5l10-2.2v12.7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="6.5" cy="18.6" rx="3.4" ry="2.8" fill="${c}" stroke="${INK}" stroke-width="1.9"/><ellipse cx="16.5" cy="16" rx="3.4" ry="2.8" fill="${c}" stroke="${INK}" stroke-width="1.9"/></svg>`,
    ghost: () => `<img src="${assetUrl(`images/ghost-${Math.random() < .5 ? 'y' : 'b'}.png`)}" alt="" draggable="false">`,
  };
  const MAX_P = 140;

  function particle(x, y, kind, o) {
    if (fx.childElementCount > MAX_P) return;
    const s = rnd(o.size[0], o.size[1]);
    const el = document.createElement('span');
    el.className = 'pm-p';
    el.innerHTML = SHAPES[kind](pick(o.colors));
    el.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${kind === 'ghost' ? 'auto' : s + 'px'};margin:${-s / 2}px 0 0 ${-s / 2}px`;
    fx.appendChild(el);
    const ang = o.angle != null ? o.angle + rnd(-.5, .5) : rnd(0, Math.PI * 2);
    const d = rnd(o.dist[0], o.dist[1]);
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d;
    const rot = rnd(-140, 140), g = o.grav;
    el.animate([
      { transform: 'translate(0,0) scale(.2) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(1) rotate(${rot * .6}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx * 1.12}px,${dy * 1.12 + g}px) scale(.25) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: rnd(o.dur[0], o.dur[1]), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
  }

  /* 公開：burst(x, y, { kinds, colors, count, dist, size, dur, grav, angle }) —— x/y 為視窗座標 */
  function burst(x, y, opt = {}) {
    if (reduce) return;
    const o = Object.assign({
      kinds: ['star', 'heart', 'dot'], colors: COLORS, count: 9,
      dist: [34, 84], size: [11, 21], dur: [650, 1000], grav: 26,
    }, opt);
    for (let i = 0; i < o.count; i++) particle(x, y, pick(o.kinds), o);
  }

  const WORDS = ['Pick!', 'Me!', 'Hi！', 'Wow！', 'Yay!', 'Yaho！'];
  function word(x, y) {
    const el = document.createElement('span');
    el.className = 'pm-word';
    el.textContent = pick(WORDS);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    fx.appendChild(el);
    const r = rnd(-12, 12);
    el.animate([
      { transform: `translate(-50%,-30%) scale(.3) rotate(${r - 18}deg)`, opacity: 0 },
      { transform: `translate(-50%,-115%) scale(1.15) rotate(${r}deg)`, opacity: 1, offset: .35 },
      { transform: `translate(-50%,-190%) scale(1) rotate(${r}deg)`, opacity: 0 },
    ], { duration: 950, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
  }

  function ring(x, y) {
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('i');
      el.className = 'pm-ring' + (i ? ' thin' : '');
      el.style.left = x + 'px'; el.style.top = y + 'px';
      fx.appendChild(el);
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: .95 },
        { transform: `translate(-50%,-50%) scale(${reduce ? 1 : 1.5 + i * .5})`, opacity: 0 },
      ], { duration: 520 + i * 120, delay: i * 70, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }).onfinish = () => el.remove();
    }
  }

  function clickFx(x, y) {
    ring(x, y);
    if (reduce) return;
    burst(x, y, { count: 8, dist: [30, 76], kinds: ['star', 'heart', 'dot', 'star'] });
    const r = Math.random();
    if (r < .2) word(x, y - 6);
    else if (r < .3) burst(x, y, { kinds: ['ghost'], count: 1, size: [22, 28], dist: [40, 70], angle: -Math.PI / 2, grav: -10, dur: [900, 1200], colors: [''] });
  }

  window.PickFX = { burst, ring, word, clickFx };

  window.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    clickFx(e.clientX, e.clientY);
  }, { passive: true });

  /* ---------- 游標（只有滑鼠才有） ---------- */
  if (!fine) return;
  root.classList.add('pm-cursor');

  const cur = document.createElement('div');
  cur.className = 'pm-cur';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = `
    <div class="pm-cur-ringpos"><i class="pm-cur-ring"></i></div>
    <div class="pm-cur-star"><div class="pm-cur-state">
      <svg viewBox="0 0 48 48" width="100%" height="100%" overflow="visible">
        <path d="m24 5 5.8 12 13.2 1.9-9.5 9.2 2.2 13L24 35l-11.7 6.1 2.2-13L5 18.9 18.2 17 24 5Z" fill="#fdd070" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M14.4 20.3 18.6 19.6" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" fill="none"/>
        <g fill="#ff8fa3" opacity=".9"><ellipse cx="15.2" cy="28.4" rx="2.6" ry="1.6"/><ellipse cx="32.8" cy="28.4" rx="2.6" ry="1.6"/></g>
        <g class="f f-idle">
          <ellipse class="eye" cx="19.4" cy="24" rx="1.9" ry="2.4" fill="${INK}"/><ellipse class="eye" cx="28.6" cy="24" rx="1.9" ry="2.4" fill="${INK}"/>
          <path d="M21.8 28.2q2.2 2.3 4.4 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="f f-happy">
          <path d="M16.6 25.2q2.8-3.8 5.6 0M25.8 25.2q2.8-3.8 5.6 0" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>
          <path d="M20.6 27.4q3.4 6 6.8 0Z" fill="#ff6b81" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        </g>
        <g class="f f-wow">
          <ellipse cx="19.4" cy="23.6" rx="2.3" ry="3" fill="${INK}"/><ellipse cx="28.6" cy="23.6" rx="2.3" ry="3" fill="${INK}"/>
          <ellipse cx="24" cy="29.6" rx="1.8" ry="2.3" fill="${INK}"/>
        </g>
        <g class="f f-press">
          <path d="M16.8 22l4 2.4-4 2.4M31.2 22l-4 2.4 4 2.4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21.6 29.2q2.4-2 4.8 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
        </g>
      </svg>
    </div></div>`;
  document.body.appendChild(cur);
  const ringPos = cur.querySelector('.pm-cur-ringpos');
  const star = cur.querySelector('.pm-cur-star');
  const svg = cur.querySelector('svg');

  const INTERACTIVE = 'a, button, [role="button"], [role="tab"], summary, select, label[for], .cloud, .node, .node-btn, .fav, [tabindex]:not([tabindex="-1"])';
  const TEXT = 'input, textarea, [contenteditable="true"]';

  let px = -100, py = -100, rx = -100, ry = -100, ox = -100, oy = -100;
  let tilt = 0, sv = 0, seen = false, lastTrail = { x: 0, y: 0 };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY;
    if (!seen) { seen = true; rx = ox = px; ry = oy = py; cur.classList.add('on'); }
    const t = e.target instanceof Element ? e.target : null;
    cur.classList.toggle('is-hover', !!(t && t.closest(INTERACTIVE) && !t.closest(TEXT)));
    cur.classList.toggle('is-text', !!(t && t.closest(TEXT)));
    if (!reduce) {
      const dx = px - lastTrail.x, dy = py - lastTrail.y;
      if (dx * dx + dy * dy > 1500) {
        lastTrail = { x: px, y: py };
        burst(px + rnd(-6, 6), py + rnd(-6, 6), {
          kinds: ['star', 'dot', 'star'], count: 1, size: [6, 11], dist: [8, 22], dur: [520, 820], grav: 18,
          colors: ['#fdd070', '#ffe7a3', '#ff8fa3', '#8cc8ff'],
        });
      }
    }
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') cur.classList.add('is-down'); }, { passive: true });
  window.addEventListener('pointerup', () => cur.classList.remove('is-down'), { passive: true });
  window.addEventListener('pointercancel', () => cur.classList.remove('is-down'), { passive: true });
  document.addEventListener('mouseleave', () => cur.classList.remove('on'));
  document.addEventListener('mouseenter', () => { if (seen) cur.classList.add('on'); });
  window.addEventListener('blur', () => cur.classList.remove('is-down'));

  function loop() {
    requestAnimationFrame(loop);
    cur.classList.toggle('is-ghost', root.classList.contains('pm-over-ghost'));
    const vx = px - ox, vy = py - oy;
    ox = px; oy = py;
    sv += (Math.hypot(vx, vy) - sv) * .25;
    star.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
    rx += (px - rx) * .17; ry += (py - ry) * .17;
    ringPos.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    if (reduce) return;
    tilt += (clamp(vx * 1.1, -22, 22) - tilt) * .2;
    const s = clamp(sv * .011, 0, .28), ang = Math.atan2(vy, vx);
    svg.style.transform = `rotate(${tilt.toFixed(1)}deg) rotate(${ang.toFixed(3)}rad) scale(${(1 + s).toFixed(3)},${(1 - s * .55).toFixed(3)}) rotate(${(-ang).toFixed(3)}rad)`;
  }
  requestAnimationFrame(loop);
})();
