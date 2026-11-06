/* =========================================================
   背景小精靈：布丁（黃）＆ 藍莓（藍）
   ① 飄移：漫遊 / 繞圈 / 8 字形，三種模式輪流，速度平順（用「期望速度」慢慢追）
   ② 表情：瞳孔跟著滑鼠 / 對方 / 移動方向，會眨眼（含連眨）、開心、害羞、驚訝、頭暈、想睡
   ③ 互動：滑鼠靠近 → 看你 + 說話；點擊 → 跳、轉圈、幫你「選一個」，還可能叫朋友來
   ④ 兩隻碰面：打招呼 → 擊掌 / 玩鬼抓人 / 繞圈跳舞 / 撞頭，輪流上演
   ⑤ 尊重「減少動態效果」：不亂飄、不碰面，只保留眨眼和滑鼠互動
   ========================================================= */
(() => {
  'use strict';
  const hero = document.getElementById('hero');
  const layer = document.getElementById('ghostLayer');
  if (!hero || !layer) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndR = (a, b) => (a < b ? rnd(a, b) : (a + b) / 2);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v, t) => (v / t * 100).toFixed(3) + '%';
  const BLOCK = '.cloud, .girl, .nav, .fav-panel, .node, .toast, .tools, a, button';
  const startAt = performance.now();

  /* ---------- 圖檔量測出的眼睛位置（單位：原圖像素） ---------- */
  const GEO = {
    y: { name: '布丁', fill: '#fdbc02', src: 'images/ghost-y.png', size: [190, 206], eyes: [[40, 73, 47, 64], [101, 73, 47, 64]], pupil: [20, 26], fx: ['#fdd070', '#ffb347', '#ffffff', '#ff8fa3'] },
    b: { name: '藍莓', fill: '#7cbbff', src: 'images/ghost-b.png', size: [190, 207], eyes: [[40, 74, 48, 64], [101, 74, 47, 64]], pupil: [20, 26], fx: ['#8cc8ff', '#bfe0ff', '#ffffff', '#ff8fa3'] },
  };

  /* ---------- 臺詞 ---------- */
  const LINES = {
    y: {
      hover: ['Pick me! Pick me!', '要不要選我？', '今天我幫你選！', '嘿～你好呀！', '摸摸我也可以喔', '我是選擇困難剋星！', '哈哈好癢～'],
      pick: ['今天吃拉麵！', '穿白色那件！', '去海邊走走吧', '選左邊！', '就決定是你了！', '先吃甜點！', '假日去看展～'],
      idle: ['飄～飄～', '今天要選什麼呢', '哼哼～♪', '好天氣～'],
    },
    b: {
      hover: ['…你、你好', '嗚…別一直戳我', '我在想要不要理你…', '嗯？有事嗎？', '讓我再想一下…', '被發現了！', '心跳加速中…'],
      pick: ['我覺得…吃火鍋', '在家看劇也行', '選右邊…大概', '去咖啡廳吧', '直覺說：A！', '畫一隻小貓吧', '試著跟陌生人聊天'],
      idle: ['…嗯', '(發呆中)', '好想睡…', '今天也沒決定'],
    },
  };
  const GREET = [
    ['嗨～藍莓！', '哈囉，布丁…'],
    ['你也在這裡呀？', '我一直都在啊…'],
    ['一起去玩吧！', '好、好啊…'],
    ['晚餐吃什麼？', '都可以…'],
    ['那就拉麵！', '咦…我想吃火鍋'],
  ];

  /* ---------- 小工具：延遲執行（跟著畫面幀走，切分頁不會亂掉） ---------- */
  const tasks = [];
  const at = (ms, fn) => tasks.push({ t: performance.now() + ms, fn });

  /* ---------- 版面 ---------- */
  let W = 0, H = 0, GW = 70, GH = 76;
  const bounds = () => ({
    x0: GW * 0.6, x1: Math.max(GW * 0.6 + 10, W - GW * 0.6),
    y0: 84 + GH * 0.45, y1: Math.max(84 + GH * 0.45 + 10, H - GH * 0.6),
  });
  const toClient = (x, y) => { const r = hero.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; };
  const fxAt = (x, y, opt) => { if (window.PickFX) { const p = toClient(x, y); window.PickFX.burst(p.x, p.y, opt); } };

  /* ---------- 避開有字、有圖的地方 ----------
     每 0.35 秒量一次雲朵、女孩、問號、小圖示、logo、導覽按鈕、輪盤圖示的位置，
     向外多留「小精靈身體 + 頭上對話泡泡」的空間，變成禁區；
     ① 挑目的地時只挑禁區外  ② 飄進禁區邊緣會被輕輕推開  ③ 碰面只在空曠處發生 */
  const OBST_SEL = '.cloud, .girl, .qmark, .ico, .nav .logo, .nav .fav, .nav .login, .node, .fav-panel';
  let obst = [], obstAt = 0;
  function refreshObst(now) {
    if (now - obstAt < 350) return;
    obstAt = now;
    const hr = hero.getBoundingClientRect();
    obst = [];
    document.querySelectorAll(OBST_SEL).forEach((el) => {
      if (el.hidden || (el.classList.contains('node') && el.style.visibility === 'hidden')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      obst.push({ l: r.left - hr.left, t: r.top - hr.top, r: r.right - hr.left, b: r.bottom - hr.top });
    });
  }
  const zone = (o) => ({ l: o.l - GW * .5 - 14, r: o.r + GW * .5 + 14, t: o.t - GH * .5 - 50, b: o.b + GH * .5 + 10 });
  const isFree = (x, y) => !obst.some((o) => { const z = zone(o); return x > z.l && x < z.r && y > z.t && y < z.b; });
  function randomFree(b) {
    let x = 0, y = 0;
    for (let i = 0; i < 40; i++) {
      x = rnd(b.x0, b.x1); y = rnd(b.y0, b.y1);
      if (isFree(x, y)) return { x, y };
    }
    return { x, y };
  }
  function pushOut(x, y) {                         // 在禁區裡 → 往最近的邊推出去
    let px = 0, py = 0;
    for (const o of obst) {
      const z = zone(o);
      if (!(x > z.l && x < z.r && y > z.t && y < z.b)) continue;
      const dl = x - z.l, dr = z.r - x, dt = y - z.t, db = z.b - y, m = Math.min(dl, dr, dt, db), sp = 90 + m * 3;
      if (m === dl) px -= sp; else if (m === dr) px += sp; else if (m === dt) py -= sp; else py += sp;
    }
    return { x: px, y: py };
  }

  /* ---------- 控制器：meet 期間用來「接管」小精靈的移動 ---------- */
  const holdCtrl = () => ({ x: 0, y: 0, k: 4 });
  const gotoCtrl = (getPt, speed, k = 4) => (g) => {
    const p = getPt(), dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1, s = Math.min(speed, d * 3);
    return { x: dx / d * s, y: dy / d * s, k };
  };
  const limit = (x, y, m) => { const d = Math.hypot(x, y); return d > m ? { x: x / d * m, y: y / d * m } : { x, y }; };

  /* =========================================================
     Ghost
     ========================================================= */
  class Ghost {
    constructor(key, x, y) {
      this.key = key; this.g = GEO[key]; this.name = this.g.name;
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.by = 0;
      this.phase = rnd(0, 6.28);
      this.look = { x: 0, y: 0 }; this.glance = { x: 0, y: 0 }; this.glanceEnd = 0;
      this.mode = null; this.modeEnd = 0; this.ctrl = null; this.lookAt = null;
      this.hover = false; this.holdUntil = 0; this.lastHoverSay = 0;
      this.expr = 'normal'; this.exprEnd = 0;
      this.sayEnd = 0; this.sayW = 120;
      this.nextBlink = performance.now() + rnd(1500, 3500); this.blinkEnd = 0;
      this.nextIdle = performance.now() + rnd(9000, 16000);
      this.build();
    }

    build() {
      const { size: [SW, SH], eyes, pupil } = this.g;
      const el = this.el = document.createElement('div');
      el.className = 'ghost'; el.dataset.ghost = this.key; el.dataset.expr = 'normal';
      el.style.setProperty('--fill', this.g.fill);
      const eyeHTML = eyes.map(([x, y, w, h]) =>
        `<i class="g-eye" style="left:${pct(x, SW)};top:${pct(y, SH)};width:${pct(w, SW)};height:${pct(h, SH)}">` +
        `<i class="g-pupil" style="width:${pct(pupil[0], w)};height:${pct(pupil[1], h)}"></i><i class="g-lid t"></i><i class="g-lid b"></i></i>`).join('');
      el.innerHTML =
        `<i class="g-shadow"></i><div class="g-pop"><div class="g-tilt"><div class="g-fx">` +
        `<img class="g-img" src="${this.g.src}" alt="" draggable="false">${eyeHTML}` +
        `<i class="g-blush l"></i><i class="g-blush r"></i><i class="g-mouth"></i></div></div></div><div class="g-say"></div>`;
      layer.appendChild(el);
      this.tilt = el.querySelector('.g-tilt'); this.fx = el.querySelector('.g-fx');
      this.shadow = el.querySelector('.g-shadow'); this.sayEl = el.querySelector('.g-say');
      this.pupils = [...el.querySelectorAll('.g-pupil')];
    }

    /* ----- 表情 / 臺詞 / 動作 ----- */
    setExpr(name, ms = 0) {
      this.expr = name; this.el.dataset.expr = name;
      this.exprEnd = ms ? performance.now() + ms : 0;
    }
    say(text, ms = 2200) {
      this.sayEl.textContent = text; this.sayEl.classList.add('on');
      this.sayEnd = performance.now() + ms; this.sayW = this.sayEl.offsetWidth || 120;
    }
    hop(h = 1) {
      this.fx.animate([
        { transform: 'translateY(0) scale(1,1)' },
        { transform: 'translateY(0) scale(1.12,.86)', offset: .18 },
        { transform: `translateY(${-GW * .45 * h}px) scale(.92,1.1)`, offset: .55 },
        { transform: 'translateY(0) scale(1.1,.88)', offset: .85 },
        { transform: 'translateY(0) scale(1,1)' },
      ], { duration: 620, easing: 'ease-out' });
    }
    spin() {
      if (reduce) return;
      this.fx.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 650, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    }

    /* ----- 想去哪：漫遊 / 繞圈 / 8 字形 ----- */
    pickMode(now) {
      const b = bounds(), r = Math.random();
      if (r < .5) {
        this.mode = { type: 'wander', wp: null, speed: rnd(45, 80) * (this.key === 'b' ? .85 : 1) };
        this.modeEnd = now + rnd(6000, 10000);
      } else if (r < .78) {
        const rad = Math.min(rnd(90, 150), Math.max(40, Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 * .9));
        const c = randomFree(b); c.x = clamp(c.x, b.x0 + rad, Math.max(b.x0 + rad, b.x1 - rad)); c.y = clamp(c.y, b.y0 + rad, Math.max(b.y0 + rad, b.y1 - rad));
        this.mode = { type: 'orbit', c, r: rad, a: Math.atan2(this.y - c.y, this.x - c.x), w: (Math.random() < .5 ? -1 : 1) * rnd(.7, 1.15) };
        this.modeEnd = now + rnd(5000, 8000);
      } else {
        const A = Math.min(rnd(150, 240), (b.x1 - b.x0) / 2 * .9), B = Math.min(rnd(70, 110), (b.y1 - b.y0) / 2 * .9);
        const c = randomFree(b); c.x = clamp(c.x, b.x0 + A, Math.max(b.x0 + A, b.x1 - A)); c.y = clamp(c.y, b.y0 + B, Math.max(b.y0 + B, b.y1 - B));
        this.mode = { type: 'eight', c, A, B, th: 0, w: rnd(.55, .85) };
        this.modeEnd = now + rnd(6000, 9000);
      }
    }
    desire(dt, now) {
      if (reduce || this.hover || now < this.holdUntil) return { x: 0, y: 0, k: 5 };
      if (!this.mode || now > this.modeEnd) this.pickMode(now);
      const m = this.mode, b = bounds();
      if (m.type === 'wander') {
        if (!m.wp || Math.hypot(m.wp.x - this.x, m.wp.y - this.y) < 28) m.wp = randomFree(b);
        const dx = m.wp.x - this.x, dy = m.wp.y - this.y, d = Math.hypot(dx, dy) || 1, s = m.speed * Math.min(1, d / 140);
        return { x: dx / d * s, y: dy / d * s, k: 2 };
      }
      if (m.type === 'orbit') {
        m.a += m.w * dt;
        const v = limit((m.c.x + Math.cos(m.a) * m.r - this.x) * 3.2, (m.c.y + Math.sin(m.a) * m.r - this.y) * 3.2, 300);
        return { x: v.x, y: v.y, k: 3.5 };
      }
      if (m.type === 'eight') {
        m.th += m.w * dt;
        const v = limit((m.c.x + Math.sin(m.th) * m.A - this.x) * 3.2, (m.c.y + Math.sin(m.th * 2) * m.B - this.y) * 3.2, 300);
        return { x: v.x, y: v.y, k: 3.5 };
      }
      if (m.type === 'seek') {                       // 好奇：慢慢飄向另一隻
        const o = m.target, dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy) || 1;
        return { x: dx / d * 105, y: dy / d * 105, k: 2 };
      }
      return { x: 0, y: 0, k: 3 };
    }

    /* ----- 滑鼠碰到 ----- */
    onHoverStart(now) {
      if (this.ctrl) return;
      this.hop(.45);
      this.setExpr(this.key === 'y' ? 'happy' : 'shy');
      this.say(pick(LINES[this.key].hover), 2400); this.lastHoverSay = now;
      if (this.key === 'b') fxAt(this.x, this.y - GH * .45, { kinds: ['heart'], count: 2, size: [10, 14], dist: [18, 36], colors: ['#ff8fa3'], angle: -Math.PI / 2 });
    }
    onHoverEnd() { if (!this.ctrl) { this.setExpr('normal'); this.holdUntil = performance.now() + 700; } }
    onClick() {
      const now = performance.now();
      this.hop(1.1); this.spin();
      this.setExpr('wow', 500); at(520, () => { if (!this.ctrl) this.setExpr('happy', 1800); });
      this.say(pick(LINES[this.key].pick), 2800); this.lastHoverSay = now;
      fxAt(this.x, this.y - GH * .2, { kinds: ['heart', 'star', 'star'], colors: this.g.fx, count: 9 });
      const other = ghosts[this.key === 'y' ? 1 : 0];
      if (!reduce && !meet.active && !other.ctrl && Math.random() < .55) {      // 叫朋友過來
        const dir = this.x < W / 2 ? 1 : -1, b = bounds();
        const target = { x: clamp(this.x + dir * GW * 1.9, b.x0, b.x1), y: clamp(this.y, b.y0, b.y1) };
        const t0 = performance.now();
        other.say(other.key === 'y' ? '來了來了！' : '等、等我…', 1500);
        other.ctrl = (g, dt, n) => {
          if (n - t0 > 3200 || Math.hypot(target.x - g.x, target.y - g.y) < GW * .35) { other.ctrl = null; meet.cool = 0; return holdCtrl(); }
          return gotoCtrl(() => target, 230, 4)(g);
        };
      }
    }

    /* ----- 每幀更新 ----- */
    update(dt, t, now, P) {
      /* 移動 */
      let d = this.ctrl ? this.ctrl(this, dt, now) : this.desire(dt, now);
      const po = pushOut(this.x, this.y), pw = this.ctrl ? .6 : 1;
      d = { x: d.x + po.x * pw, y: d.y + po.y * pw, k: d.k };
      const k = 1 - Math.exp(-(d.k || 3) * dt);
      this.vx += (d.x - this.vx) * k; this.vy += (d.y - this.vy) * k;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const b = bounds();
      if (this.x < b.x0) { this.x = b.x0; this.vx = Math.abs(this.vx) * .4; }
      if (this.x > b.x1) { this.x = b.x1; this.vx = -Math.abs(this.vx) * .4; }
      if (this.y < b.y0) { this.y = b.y0; this.vy = Math.abs(this.vy) * .4; }
      if (this.y > b.y1) { this.y = b.y1; this.vy = -Math.abs(this.vy) * .4; }

      /* 表情計時 */
      if (this.exprEnd && now > this.exprEnd) this.setExpr('normal');
      const dizzy = this.expr === 'dizzy';

      /* 眨眼：偶爾連眨兩下 */
      if (now > this.nextBlink && !dizzy) {
        this.blinkEnd = now + 130;
        this.nextBlink = Math.random() < .2 ? now + 280 : now + rnd(2200, 5600);
      }
      this.el.classList.toggle('is-blink', now < this.blinkEnd);

      /* 視線：頭暈 > 看著對方 > 看著滑鼠 > 看著前進方向（偶爾東張西望） */
      let lx = 0, ly = 0;
      const gx = this.x, gy = this.y - GH * .1;
      if (dizzy) { lx = Math.cos(t * 9); ly = Math.sin(t * 9); }
      else if (this.lookAt) { const dx = this.lookAt.x - gx, dy = this.lookAt.y - gy, m = Math.hypot(dx, dy) || 1; lx = dx / m; ly = dy / m * .6; }
      else if (P.seen && Math.hypot(P.x - gx, P.y - gy) < 320) {
        const dx = P.x - gx, dy = P.y - gy, m = Math.hypot(dx, dy) || 1;
        if (this.hover && this.expr === 'shy') { lx = -dx / m * .9; ly = .85; }        // 害羞：眼神飄開
        else { lx = dx / m; ly = dy / m; }
      } else {
        if (now > this.glanceEnd) { this.glance = Math.random() < .5 ? { x: rnd(-1, 1), y: rnd(-.7, .7) } : { x: 0, y: 0 }; this.glanceEnd = now + rnd(1500, 3500); }
        const sp = Math.hypot(this.vx, this.vy);
        lx = sp > 14 ? this.vx / 80 + this.glance.x * .3 : this.glance.x;
        ly = sp > 14 ? this.vy / 80 + this.glance.y * .3 : this.glance.y;
      }
      lx = clamp(lx, -1, 1); ly = clamp(ly, -1, 1);
      const lk = 1 - Math.exp(-(dizzy ? 18 : 10) * dt);
      this.look.x += (lx - this.look.x) * lk; this.look.y += (ly - this.look.y) * lk;
      const { eyes, pupil } = this.g;
      for (let i = 0; i < 2; i++) {
        const [, , ew, eh] = eyes[i], cx = (ew - pupil[0]) / 2, cy = (eh - pupil[1]) / 2;
        this.pupils[i].style.left = pct(cx + this.look.x * cx * .92, ew);
        this.pupils[i].style.top = pct(cy + this.look.y * cy * .8, eh);
      }

      /* 身體：傾斜 + 浮動 + 影子 */
      const wob = dizzy ? Math.sin(t * 10) * 9 : 0;
      const rot = reduce ? 0 : clamp(this.vx * .05, -10, 10) + Math.sin(t * 1.3 + this.phase) * 2 + wob;
      this.tilt.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      this.by = reduce ? 0 : Math.sin(t * 1.7 + this.phase) * GH * .035;
      this.shadow.style.setProperty('--sh', (1 - this.by / (GH * .035) * .12).toFixed(3));
      this.el.style.transform = `translate3d(${(this.x - GW / 2).toFixed(1)}px,${(this.y - GH / 2 + this.by).toFixed(1)}px,0)`;

      /* 泡泡：收起 + 不超出畫面 */
      if (this.sayEnd && now > this.sayEnd) { this.sayEl.classList.remove('on'); this.sayEnd = 0; }
      if (this.sayEnd) {
        const half = this.sayW / 2;
        const bx = this.x - half < 10 ? 10 - (this.x - half) : this.x + half > W - 10 ? -(this.x + half - (W - 10)) : 0;
        this.sayEl.style.setProperty('--bx', bx.toFixed(1) + 'px');
      }

      /* 滑鼠停久一點會再說一句；沒事時偶爾碎碎念 */
      if (this.hover && !this.ctrl && now - this.lastHoverSay > 3600) { this.say(pick(LINES[this.key].hover), 2400); this.lastHoverSay = now; this.hop(.35); }
      if (now > this.nextIdle) {
        this.nextIdle = now + rnd(14000, 26000);
        if (!this.ctrl && !this.hover && !meet.active && !this.sayEnd) this.say(pick(LINES[this.key].idle), 2200);
      }
    }
  }

  /* =========================================================
     兩隻碰面
     ========================================================= */
  let ghosts = [];
  const meet = { active: false, id: 0, cool: performance.now() + 8000, tick: null, seek: false };

  function endMeet(id) {
    if (meet.id !== id) return;
    const [A, B] = ghosts, now = performance.now(), b = bounds();
    meet.active = false; meet.tick = null; meet.seek = false;
    meet.cool = now + rnd(9000, 15000);
    [A, B].forEach((g, i) => {
      g.ctrl = null; g.lookAt = null; g.setExpr('normal'); g.holdUntil = 0;
      const dir = (g.x < (i ? A.x : B.x)) ? -1 : 1;                       // 各自往不同方向散開
      g.mode = { type: 'wander', wp: randomFree(b), speed: 75 };
      g.modeEnd = now + 6000;
    });
  }

  function startMeet() {
    const [A, B] = ghosts, id = ++meet.id, ok = () => meet.id === id;
    meet.active = true; meet.tick = null;
    [A, B].forEach((g, i) => { g.ctrl = holdCtrl; g.lookAt = i ? A : B; g.setExpr('happy'); });
    const [la, lb] = pick(GREET);
    A.say(la, 1600); at(900, () => ok() && B.say(lb, 1600));
    at(2400, () => ok() && runKind(pick(['highfive', 'tag', 'dance', 'bump']), id));
  }

  function midPoint(margin = 0) {
    const [A, B] = ghosts, b = bounds();
    return { x: clamp((A.x + B.x) / 2, b.x0 + margin, b.x1 - margin), y: clamp((A.y + B.y) / 2, b.y0 + margin, b.y1 - margin) };
  }

  function runKind(kind, id) {
    const [A, B] = ghosts, ok = () => meet.id === id, t0 = performance.now();
    const both = (fn) => [A, B].forEach(fn);

    if (kind === 'highfive') {                     // 擊掌：靠近 → 一起跳 → Yeah!
      const m = midPoint(), L = A.x < B.x ? A : B, R = L === A ? B : A;
      L.ctrl = gotoCtrl(() => ({ x: m.x - GW * .6, y: m.y }), 170);
      R.ctrl = gotoCtrl(() => ({ x: m.x + GW * .6, y: m.y }), 170);
      at(800, () => { if (!ok()) return; both((g) => { g.hop(1); g.say('Yeah！', 1100); }); fxAt(m.x, m.y - GH * .2, { count: 13, kinds: ['star', 'heart', 'star'], dist: [40, 100] }); });
      at(2100, () => endMeet(id));
    }

    if (kind === 'tag') {                          // 鬼抓人
      const C = Math.random() < .5 ? A : B, R = C === A ? B : A;
      C.say('等等我～', 1400); R.say('來抓我呀！', 1400);
      C.ctrl = (g) => { const dx = R.x - g.x, dy = R.y - g.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d * 205, y: dy / d * 205, k: 5 }; };
      R.ctrl = (g) => {
        const b = bounds(), m = GW * 1.2;
        let ax = g.x - C.x, ay = g.y - C.y; const d0 = Math.hypot(ax, ay) || 1; ax /= d0; ay /= d0;
        if (g.x < b.x0 + m) ax += 1.6; if (g.x > b.x1 - m) ax -= 1.6;
        if (g.y < b.y0 + m) ay += 1.6; if (g.y > b.y1 - m) ay -= 1.6;
        ax += -ay * .5; ay += ax * .35;           // 被逼到牆角時會繞開
        const d = Math.hypot(ax, ay) || 1; return { x: ax / d * 185, y: ay / d * 185, k: 4 };
      };
      meet.tick = (now) => {
        const el = now - t0, d = Math.hypot(A.x - B.x, A.y - B.y);
        if (el > 900 && d < GW * .8) {
          meet.tick = null; both((g) => { g.ctrl = holdCtrl; g.setExpr('happy'); g.hop(1); });
          C.say('抓到囉！', 1400); R.say('被抓到了～', 1400);
          const m = midPoint(); fxAt(m.x, m.y - GH * .2, { count: 11, kinds: ['heart', 'star'], dist: [36, 90] });
          at(1800, () => endMeet(id));
        } else if (el > 5200) {
          meet.tick = null; both((g) => { g.ctrl = holdCtrl; });
          C.setExpr('sleepy', 1600); C.say('呼…呼…', 1500); R.say('你好慢喔～', 1500);
          at(1800, () => endMeet(id));
        }
      };
    }

    if (kind === 'dance') {                        // 繞圈跳舞
      const m = midPoint(GW * 1.1), r = GW * .95, w = 2.6 * (Math.random() < .5 ? 1 : -1);
      let th = Math.atan2(A.y - m.y, A.x - m.x), lastNote = 0;
      A.ctrl = (g) => { const v = limit((m.x + Math.cos(th) * r - g.x) * 5, (m.y + Math.sin(th) * r - g.y) * 5, 340); return { x: v.x, y: v.y, k: 6 }; };
      B.ctrl = (g) => { const v = limit((m.x - Math.cos(th) * r - g.x) * 5, (m.y - Math.sin(th) * r - g.y) * 5, 340); return { x: v.x, y: v.y, k: 6 }; };
      A.say('♪ 轉圈圈～', 1800); B.say('♪ ♪ ♪', 1800);
      meet.tick = (now, dt) => {
        th += w * dt;
        if (now - lastNote > 460) { lastNote = now; fxAt((A.x + B.x) / 2, (A.y + B.y) / 2 - GH * .3, { kinds: ['note', 'heart'], count: 2, size: [14, 20], dist: [30, 70], colors: ['#ff8fa3', '#8cc8ff', '#fdd070'], angle: -Math.PI / 2, grav: -10 }); }
        if (now - t0 > 3800) {
          meet.tick = null; both((g) => { g.ctrl = holdCtrl; g.setExpr('dizzy', 1400); });
          at(1600, () => endMeet(id));
        }
      };
    }

    if (kind === 'bump') {                         // 撞頭
      const m = midPoint();
      both((g) => { g.ctrl = gotoCtrl(() => m, 380, 8); g.setExpr('wow'); });
      meet.tick = (now) => {
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < GW * .72 || now - t0 > 1100) {
          meet.tick = null;
          const s = A.x < B.x ? -1 : 1;
          A.vx = s * 340; A.vy = -150; B.vx = -s * 340; B.vy = -150;
          both((g) => { g.ctrl = () => ({ x: 0, y: 0, k: 1.6 }); g.setExpr('dizzy', 1500); });
          A.say('咚！', 1300); B.say('好痛…', 1500);
          fxAt((A.x + B.x) / 2, (A.y + B.y) / 2 - GH * .2, { count: 10, kinds: ['star'], colors: ['#fdd070', '#ffffff', '#ffb347'], dist: [30, 80] });
          at(1900, () => endMeet(id));
        }
      };
    }
  }

  /* =========================================================
     滑鼠
     ========================================================= */
  const ptr = { cx: 0, cy: 0, target: null, seen: false };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.target = e.target instanceof Element ? e.target : null; ptr.seen = true;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { ptr.seen = false; });

  let P = { x: 0, y: 0, seen: false, hit: false };
  const hitGhost = (lx, ly) => {
    let best = null, bd = GW * .62;
    ghosts.forEach((g) => { const d = Math.hypot(lx - g.x, ly - (g.y + g.by)); if (d < bd) { bd = d; best = g; } });
    return best;
  };
  window.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || hero.classList.contains('is-away') || !ghosts.length) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && t.closest(BLOCK)) return;
    const r = hero.getBoundingClientRect(), g = hitGhost(e.clientX - r.left, e.clientY - r.top);
    if (g) g.onClick();
  }, { passive: true });

  /* 輪盤換工具時，小精靈會喊一聲 */
  let lastTool = 0;
  hero.addEventListener('tool-change', (e) => {
    const now = performance.now();
    if (now - startAt < 3500 || now - lastTool < 1500 || meet.active || !ghosts.length) return;
    const g = pick(ghosts.filter((x) => !x.ctrl && !x.hover));
    const n = e.detail && e.detail.name; if (!g || !n) return;
    lastTool = now; g.say(g.key === 'y' ? `選${n}！` : `${n}…好像不錯`, 1800); g.hop(.5);
  });

  /* =========================================================
     主迴圈
     ========================================================= */
  function measure() {
    const first = !ghosts.length;
    W = hero.clientWidth; H = hero.clientHeight;
    GW = layer.querySelector('.ghost') ? layer.querySelector('.ghost').offsetWidth : Math.max(58, Math.min(88, W * .054));
    GH = GW * 206 / 190;
    if (first && W > 0) {
      ghosts = [new Ghost('y', W * .5, H * .22), new Ghost('b', W * .82, H * .64)];
      GW = ghosts[0].el.offsetWidth || GW; GH = GW * 206 / 190;
    }
  }
  new ResizeObserver(measure).observe(hero);
  measure();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!ghosts.length || document.hidden || hero.classList.contains('is-away')) return;

    for (let i = 0; i < tasks.length;) { if (tasks[i].t <= now) { const f = tasks.splice(i, 1)[0].fn; f(); } else i++; }

    /* 指標 → 小精靈本地座標 */
    const r = hero.getBoundingClientRect();
    const lx = ptr.cx - r.left, ly = ptr.cy - r.top;
    const inside = ptr.seen && lx >= 0 && ly >= 0 && lx <= W && ly <= H;
    const blocked = ptr.target && ptr.target.closest(BLOCK);
    P = { x: lx, y: ly, seen: inside, hit: inside && !blocked };
    const over = P.hit ? hitGhost(lx, ly) : null;
    ghosts.forEach((g) => {
      const on = g === over;
      if (on && !g.hover) { g.hover = true; g.onHoverStart(now); }
      else if (!on && g.hover) { g.hover = false; g.onHoverEnd(); }
    });
    root.classList.toggle('pm-over-ghost', !!over);

    refreshObst(now);
    const t = now / 1000;
    if (meet.tick) meet.tick(now, dt);
    ghosts.forEach((g) => g.update(dt, t, now, P));

    /* 碰面：夠近就打招呼；放著太久會好奇地飄過去 */
    if (!reduce && !meet.active && now > meet.cool && !ghosts.some((g) => g.ctrl || g.hover) && now - startAt > 3500) {
      const [A, B] = ghosts, d = Math.hypot(A.x - B.x, A.y - B.y);
      if (d < GW * 2.3) { if (isFree(A.x, A.y) && isFree(B.x, B.y) && isFree((A.x + B.x) / 2, (A.y + B.y) / 2)) startMeet(); }
      else if (now > meet.cool + 3000 && !meet.seek) {
        meet.seek = true; B.mode = { type: 'seek', target: A }; B.modeEnd = now + 9000;
      }
    }
  }
  requestAnimationFrame(frame);
})();
