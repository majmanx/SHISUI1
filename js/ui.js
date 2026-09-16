/* ============================================================
   石髓 SHISUI · 控件库
   液态金属旋钮 / 选择器 / 开关 / 键盘 / XY 板 / 示波器 / 查找面板
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SHISUI; const UI = (S.UI = {});
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  UI.el = el; UI.svgEl = svgEl;

  function arcPath(cx, cy, r, a0, a1) {
    const xy = (a) => { const rad = ((a - 90) * Math.PI) / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; };
    const [x0, y0] = xy(a0), [x1, y1] = xy(a1); const large = a1 - a0 > 180 ? 1 : 0;
    return 'M' + x0.toFixed(2) + ',' + y0.toFixed(2) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2);
  }

  /* ---------- 旋钮 ---------- */
  class Knob {
    constructor(spec, opts) {
      this.spec = spec; this.opts = opts || {}; this.value = S.norm(spec, spec.def); this.modValue = null; this.locked = false;
      const r = (this.el = el('div', 'knob' + (this.opts.big ? ' big' : '')));
      r.dataset.param = spec.id; r.title = (spec.tip ? spec.tip + ' ' : '') + '(' + spec.en + ')  拖动/滚轮调节 · Shift 微调 · 双击复位 · 右键锁定';
      const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'knob-svg' });
      // 每个旋钮自己的鎏金图案: 同一贴图, 随机位移 + 旋转 + 缩放 → 没有两个旋钮相同
      const uid = 'kp' + (Knob.seq = (Knob.seq || 0) + 1); const defs = svgEl('defs', {});
      // 图案通过 <use> 引用全局那一张贴图 (不复制数据), 只有位移/旋转/缩放各不相同
      const mk = (id, ref, scale) => { const ang = Math.floor(Math.random() * 360), tx = Math.floor(Math.random() * 200), ty = Math.floor(Math.random() * 200); const pat = svgEl('pattern', { id, patternUnits: 'userSpaceOnUse', width: 200, height: 200, patternTransform: 'rotate(' + ang + ' 50 50) translate(' + -tx + ' ' + -ty + ') scale(' + scale + ')' }); const u = svgEl('use', {}); u.setAttribute('href', '#' + ref); u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + ref); pat.appendChild(u); defs.appendChild(pat); };
      const sc = (0.85 + Math.random() * 0.5).toFixed(2); mk(uid + 'l', 'mkImgWhite', sc); mk(uid + 'd', 'mkImgBlack', sc); mk(uid + 'p', 'mkImgCream', (1.1 + Math.random() * 0.5).toFixed(2)); mk(uid + 'q', 'mkImgObsidian', 1);
      svg.appendChild(defs); svg.style.setProperty('--kp', 'url(#' + uid + 'l)'); svg.style.setProperty('--kpd', 'url(#' + uid + 'd)'); svg.style.setProperty('--kpp', 'url(#' + uid + 'p)'); svg.style.setProperty('--kpq', 'url(#' + uid + 'q)');
      svg.appendChild(svgEl('circle', { class: 'k-plate', cx: 50, cy: 50, r: 47 }));
      svg.appendChild(svgEl('circle', { class: 'k-plate-shade', cx: 50, cy: 50, r: 47 }));
      svg.appendChild(svgEl('path', { class: 'k-track', d: arcPath(50, 50, 40, -135, 135) }));
      this.modArc = svgEl('path', { class: 'k-mod', d: '' }); svg.appendChild(this.modArc);
      this.arc = svgEl('path', { class: 'k-arc', d: '' }); svg.appendChild(this.arc);
      svg.appendChild(svgEl('circle', { class: 'k-rim', cx: 50, cy: 50, r: 33 }));
      svg.appendChild(svgEl('circle', { class: 'k-body', cx: 50, cy: 50, r: 29 }));
      svg.appendChild(svgEl('circle', { class: 'k-shade', cx: 50, cy: 50, r: 29 }));
      svg.appendChild(svgEl('circle', { class: 'k-bevel', cx: 50, cy: 50, r: 27.5 }));
      svg.appendChild(svgEl('ellipse', { class: 'k-gloss', cx: 44, cy: 38, rx: 16, ry: 9 }));
      this.ptr = svgEl('line', { class: 'k-ptr', x1: 50, y1: 46, x2: 50, y2: 25 }); svg.appendChild(this.ptr);
      this.modDot = svgEl('circle', { class: 'k-moddot', cx: 50, cy: 5, r: 3.2, visibility: 'hidden' }); svg.appendChild(this.modDot);
      this.lockIcon = svgEl('text', { class: 'k-lock', x: 50, y: 57, 'text-anchor': 'middle', 'font-size': 18, visibility: 'hidden' }); this.lockIcon.textContent = '🔒'; svg.appendChild(this.lockIcon);
      r.appendChild(svg);
      this.labelEl = el('div', 'knob-label', spec.label); r.appendChild(this.labelEl);
      r.appendChild(el('div', 'knob-en', spec.en));
      this.valEl = el('div', 'knob-val', ''); r.appendChild(this.valEl);
      this.render(); this.bind();
    }
    render() {
      const v = this.value; const a = -135 + 270 * v;
      if (this.spec.bipolar) this.arc.setAttribute('d', Math.abs(v - 0.5) > 0.004 ? arcPath(50, 50, 40, Math.min(0, a), Math.max(0, a)) : ''); else this.arc.setAttribute('d', v > 0.003 ? arcPath(50, 50, 40, -135, a) : '');
      this.ptr.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' 50 50)');
      this.valEl.textContent = S.fmt(this.spec, S.denorm(this.spec, v));
      if (this.modValue != null && Math.abs(this.modValue - v) > 0.004) {
        const m = -135 + 270 * this.modValue;
        this.modArc.setAttribute('d', arcPath(50, 50, 46, Math.min(a, m), Math.max(a, m)));
        this.modDot.setAttribute('visibility', 'visible'); this.modDot.setAttribute('transform', 'rotate(' + m.toFixed(2) + ' 50 50)');
      } else { this.modArc.setAttribute('d', ''); this.modDot.setAttribute('visibility', 'hidden'); }
    }
    set(v01, silent) { this.value = v01 < 0 ? 0 : v01 > 1 ? 1 : v01; this.render(); if (!silent && this.opts.onChange) this.opts.onChange(this.value); }
    setMod(v) { this.modValue = v; this.render(); }
    setLocked(b) { this.locked = b; this.lockIcon.setAttribute('visibility', b ? 'visible' : 'hidden'); this.el.classList.toggle('locked', b); }
    flash() { this.el.classList.remove('flash'); void this.el.offsetWidth; this.el.classList.add('flash'); this.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    bind() {
      const r = this.el; let startY = 0, startV = 0, dragging = false;
      r.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return; e.preventDefault();
        if (this.opts.onPick && this.opts.onPick(this)) return; // 指派调制时拦截
        r.setPointerCapture(e.pointerId); startY = e.clientY; startV = this.value; dragging = true; r.classList.add('active'); r.focus();
      });
      r.addEventListener('pointermove', (e) => { if (!dragging) return; const dy = startY - e.clientY; this.set(startV + dy / (e.shiftKey ? 2400 : 220)); });
      const end = () => { if (!dragging) return; dragging = false; r.classList.remove('active'); if (this.opts.onCommit) this.opts.onCommit(this.value); };
      r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
      r.addEventListener('dblclick', (e) => { e.preventDefault(); this.set(S.norm(this.spec, this.spec.def)); if (this.opts.onCommit) this.opts.onCommit(this.value); });
      r.addEventListener('wheel', (e) => { e.preventDefault(); this.set(this.value + (e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? 0.003 : 0.025)); clearTimeout(this._wt); this._wt = setTimeout(() => this.opts.onCommit && this.opts.onCommit(this.value), 300); }, { passive: false });
      r.addEventListener('contextmenu', (e) => { e.preventDefault(); this.setLocked(!this.locked); if (this.opts.onLock) this.opts.onLock(this.locked); });
      r.tabIndex = 0;
      r.addEventListener('keydown', (e) => { let d = 0; if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 1; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -1; if (!d) return; e.preventDefault(); e.stopPropagation(); this.set(this.value + d * (e.shiftKey ? 0.003 : 0.025)); if (this.opts.onCommit) this.opts.onCommit(this.value); });
      r.addEventListener('mouseenter', () => { if (this.opts.onHover) this.opts.onHover(this.spec); });
    }
  }
  UI.Knob = Knob;

  /* ---------- 选择器 ---------- */
  class Select {
    constructor(spec, opts) {
      this.spec = spec; this.opts = opts || {}; const w = (this.el = el('div', 'sel')); w.dataset.param = spec.id; w.title = (spec.tip || '') + ' (' + spec.en + ')';
      const lab = el('div', 'sel-label', UI.bi(spec.label, spec.en)); w.appendChild(lab);
      const s = (this.sel = document.createElement('select'));
      for (const o of spec.options) { const op = document.createElement('option'); op.value = String(o[0]); op.dataset.zh = o[1]; op.dataset.en = o[2] || ''; op.textContent = UI.optText(o[1], o[2]); s.appendChild(op); }
      s.value = String(spec.def); w.appendChild(s);
      s.addEventListener('change', () => { if (this.opts.onChange) this.opts.onChange(this.real()); });
      w.addEventListener('mouseenter', () => { if (this.opts.onHover) this.opts.onHover(spec); });
    }
    real() { const v = this.sel.value; const o = this.spec.options.find((o) => String(o[0]) === v); return o ? o[0] : v; }
    set(v) { this.sel.value = String(v); }
    setMod(n) { if (n == null) { this.el.classList.remove('modded'); return; } this.el.classList.add('modded'); this.sel.value = String(S.denorm(this.spec, n)); }
    flash() { this.el.classList.remove('flash'); void this.el.offsetWidth; this.el.classList.add('flash'); this.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    setLocked() {}
  }
  UI.Select = Select;
  /* ---------- 语言模式: both | zh | en ---------- */
  UI.lang = 'both';
  UI.optText = (zh, en) => (UI.lang === 'zh' || !en ? zh : UI.lang === 'en' ? en : zh + ' ' + en);
  UI.applyLang = (mode) => {
    UI.lang = mode; document.body.classList.remove('lang-both', 'lang-zh', 'lang-en'); document.body.classList.add('lang-' + mode);
    document.querySelectorAll('option[data-zh]').forEach((op) => { op.textContent = UI.optText(op.dataset.zh, op.dataset.en); });
  };

  /* ---------- 开关 ---------- */
  class Toggle {
    constructor(spec, opts) {
      this.spec = spec; this.opts = opts || {}; this.value = spec.def ? 1 : 0;
      const b = (this.el = el('button', 'toggle' + (this.opts.big ? ' big' : ''))); b.dataset.param = spec.id; b.title = (spec.tip || '') + ' (' + spec.en + ')';
      b.innerHTML = '<span class="tg-led"></span><span class="tg-label">' + UI.bi(spec.label, spec.en) + '</span>';
      b.addEventListener('click', () => { this.set(this.value ? 0 : 1); if (this.opts.onChange) this.opts.onChange(this.value); });
      b.addEventListener('mouseenter', () => { if (this.opts.onHover) this.opts.onHover(spec); });
      this.render();
    }
    render() { this.el.classList.toggle('on', !!this.value); }
    set(v) { this.value = v ? 1 : 0; this.render(); }
    setMod(n) { if (n == null) { this.el.classList.remove('modded'); this.render(); return; } this.el.classList.add('modded'); this.el.classList.toggle('on', n >= 0.5); }
    flash() { this.el.classList.remove('flash'); void this.el.offsetWidth; this.el.classList.add('flash'); this.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    setLocked() {}
  }
  UI.Toggle = Toggle;

  /* ---------- 面板 ---------- */
  UI.panel = (id, title, sub, level, cls) => {
    const p = el('section', 'panel lvl' + level + (cls ? ' ' + cls : '')); p.id = id;
    p.appendChild(el('div', 'panel-title', '<span class="pt-main">' + title + '</span>' + (sub ? '<span class="pt-sub">' + sub + '</span>' : '')));
    const body = el('div', 'panel-body'); p.appendChild(body); p.body = body; return p;
  };
  UI.row = (children, cls) => { const r = el('div', 'row' + (cls ? ' ' + cls : '')); for (const c of children) if (c) r.appendChild(c.el || c); return r; };
  UI.bi = (zh, en) => '<span class="zh">' + zh + '</span>' + (en ? ' <span class="en">' + en + '</span>' : '');
  UI.group = (title, children, cls) => { const g = el('div', 'grp' + (cls ? ' ' + cls : '')); if (title) g.appendChild(el('div', 'grp-title', UI.bi(title, S.TITLE_EN && S.TITLE_EN[title]))); const r = el('div', 'row'); for (const c of children) if (c) r.appendChild(c.el || c); g.appendChild(r); return g; };
  UI.btn = (label, cls, onClick, title) => { const b = el('button', 'btn' + (cls ? ' ' + cls : ''), label); if (title) b.title = title; if (onClick) b.addEventListener('click', onClick); return b; };

  /* ---------- 键盘 ---------- */
  const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  UI.noteName = (n) => KEY_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
  class Keyboard {
    constructor(container, opts) {
      this.c = container; this.opts = opts || {}; this.base = 36; this.count = 58; this.keys = new Map(); this.down = new Set(); this.pointerNote = new Map(); this.build();
    }
    build() {
      this.c.innerHTML = ''; this.keys.clear();
      const whites = []; for (let i = 0; i < this.count; i++) { const n = this.base + i; if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n); }
      const ww = 100 / whites.length;
      whites.forEach((n, i) => { const k = el('div', 'key white'); k.style.left = i * ww + '%'; k.style.width = ww + '%'; k.dataset.note = n; k.dataset.name = UI.noteName(n); k.style.backgroundPosition = 'center, ' + (-Math.floor(Math.random() * 300)) + 'px ' + (-Math.floor(Math.random() * 300)) + 'px'; if (n % 12 === 0) k.appendChild(el('span', 'key-name', 'C' + (n / 12 - 1))); this.c.appendChild(k); this.keys.set(n, k); });
      for (let i = 0; i < this.count; i++) { const n = this.base + i; if (![1, 3, 6, 8, 10].includes(n % 12)) continue; const wi = whites.filter((w) => w < n).length; const k = el('div', 'key black'); k.style.left = (wi * ww - ww * 0.3) + '%'; k.style.width = ww * 0.6 + '%'; k.dataset.note = n; k.dataset.name = UI.noteName(n); k.style.backgroundPosition = 'center, ' + (-Math.floor(Math.random() * 300)) + 'px ' + (-Math.floor(Math.random() * 300)) + 'px'; this.c.appendChild(k); this.keys.set(n, k); }
      const noteAt = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.dataset && t.dataset.note ? +t.dataset.note : null; };
      const velAt = (e, k) => { const r = k.getBoundingClientRect(); return Math.min(1, Math.max(0.15, (e.clientY - r.top) / r.height * 0.9 + 0.2)); };
      this.c.addEventListener('pointerdown', (e) => { const n = noteAt(e); if (n == null) return; e.preventDefault(); this.c.setPointerCapture(e.pointerId); const v = velAt(e, this.keys.get(n)); this.pointerNote.set(e.pointerId, n); this.press(n, v, 'mouse'); });
      this.c.addEventListener('pointermove', (e) => { if (!this.pointerNote.has(e.pointerId)) return; const n = noteAt(e); const prev = this.pointerNote.get(e.pointerId); if (n != null && n !== prev) { this.release(prev, 'mouse'); this.pointerNote.set(e.pointerId, n); this.press(n, velAt(e, this.keys.get(n)), 'mouse'); } });
      const up = (e) => { if (!this.pointerNote.has(e.pointerId)) return; this.release(this.pointerNote.get(e.pointerId), 'mouse'); this.pointerNote.delete(e.pointerId); };
      this.c.addEventListener('pointerup', up); this.c.addEventListener('pointercancel', up);
    }
    press(n, v, src) { if (this.down.has(n)) return; this.down.add(n); const k = this.keys.get(n); if (k) k.classList.add('down'); if (this.opts.onNote) this.opts.onNote(n, v, src); }
    release(n, src) { if (!this.down.has(n)) return; this.down.delete(n); const k = this.keys.get(n); if (k) k.classList.remove('down'); if (this.opts.onOff) this.opts.onOff(n, src); }
    light(n, on) { const k = this.keys.get(n); if (k) k.classList.toggle('lit', !!on); }
    setBase(b) { for (const n of Array.from(this.down)) this.release(n, 'sys'); this.base = b; this.build(); }
  }
  UI.Keyboard = Keyboard;

  /* ---------- XY 板 ---------- */
  class XYPad {
    constructor(container, onMove) {
      this.c = container; this.onMove = onMove; this.x = 0.5; this.y = 0.5;
      this.dot = el('div', 'xy-dot'); container.appendChild(this.dot); container.appendChild(el('div', 'xy-grid'));
      let drag = false; const mv = (e) => { const r = container.getBoundingClientRect(); this.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height); };
      container.addEventListener('pointerdown', (e) => { drag = true; container.setPointerCapture(e.pointerId); mv(e); });
      container.addEventListener('pointermove', (e) => { if (drag) mv(e); });
      const end = () => { drag = false; };
      container.addEventListener('pointerup', end); container.addEventListener('pointercancel', end);
      this.render();
    }
    set(x, y) { this.x = Math.min(1, Math.max(0, x)); this.y = Math.min(1, Math.max(0, y)); this.render(); if (this.onMove) this.onMove(this.x, this.y); }
    render() { this.dot.style.left = this.x * 100 + '%'; this.dot.style.top = (1 - this.y) * 100 + '%'; }
  }
  UI.XYPad = XYPad;

  /* ---------- 石窗: 克拉尼沙图 (振型浮雕 + 金沙) / 谐波金字塔 / 波形 ----------
     振型: w(x,y) = cos(nπx)cos(mπy) − cos(mπx)cos(nπy)  (方板, 自由边近似)
     振型选择: Chladni 定律 f ∝ (m+2n)²  → 主峰频率决定 m+2n, 次峰决定 n
     参考: Gander & Kwok, SIAM Review 54 (2012); paulbourke.net/geometry/chladni; en.wikipedia.org/wiki/Chladni's_law */
  class Scope {
    constructor(canvas, analyser) {
      this.cv = canvas; this.an = analyser; this.td = new Uint8Array(analyser.fftSize); this.fd = new Uint8Array(analyser.frequencyBinCount);
      this.mode = 'sand'; this.N = 1600; this.px = new Float32Array(this.N); this.py = new Float32Array(this.N); this.pv = new Float32Array(this.N);
      for (let i = 0; i < this.N; i++) { this.px[i] = Math.random(); this.py[i] = Math.random(); }
      this.m = 2; this.n = 3; this.tm = 2; this.tn = 3; this.amp = 0; this.frame = 0; this.f1 = 0; this.harm = new Float32Array(12);
      this.relief = null; this.reliefKey = ''; this.tile = null; this.reliefPrev = null; this.reliefFade = 1; this.stable = 0;
      if (S.marble) { this.tileLight = new Image(); this.tileLight.src = S.marble.plate || S.marble.cream; this.tileDark = new Image(); this.tileDark.src = S.marble.obsidian; }
    }
    analyse() {
      this.an.getByteFrequencyData(this.fd); this.an.getByteTimeDomainData(this.td);
      const sr = this.an.context.sampleRate, bins = this.fd.length; const hz = (b) => (b * sr) / (2 * bins);
      let sum = 0; for (let i = 0; i < this.td.length; i++) { const v = (this.td[i] - 128) / 128; sum += v * v; } const rms = Math.sqrt(sum / this.td.length);
      this.amp += (rms - this.amp) * (rms > this.amp ? 0.5 : 0.04);
      const lo = Math.max(1, Math.floor(40 / (sr / 2 / bins)));
      let b1 = 0, v1 = 0; for (let b = lo; b < bins / 2; b++) if (this.fd[b] > v1) { v1 = this.fd[b]; b1 = b; }
      let b2 = 0, v2 = 0; for (let b = lo; b < bins / 2; b++) { if (Math.abs(b - b1) < 6) continue; if (this.fd[b] > v2) { v2 = this.fd[b]; b2 = b; } }
      if (v1 > 40) {
        const f1 = hz(b1), f2 = Math.max(hz(b2), 56); this.f1 = f1;
        // Chladni 定律: f ∝ (m+2n)²  → s = m+2n 随 √f 增长 (55 Hz → 3, 5 kHz → 27)
        const s = Math.round(3 + 24 * Math.sqrt(Math.min(1, Math.max(0, (f1 - 55) / 4945))));
        const nPref = Math.max(1, Math.min(9, 1 + Math.round(Math.log2(f2 / 55))));
        let best = null, bd = 1e9;
        for (let n = 1; n <= 9; n++) { const m = s - 2 * n; if (m < 1 || m > 9 || m === n) continue; const d = Math.abs(n - nPref); if (d < bd) { bd = d; best = [m, n]; } }
        if (!best) { const mm = Math.max(1, Math.min(9, Math.round(s / 3))); best = [mm, mm % 9 + 1]; }
        this.tm = best[0]; this.tn = best[1];
        // 谐波: 基频整数倍附近的能量
        for (let k = 1; k <= 12; k++) { const bk = Math.round((f1 * k) / (sr / 2 / bins)); let mx = 0; for (let d = -2; d <= 2; d++) { const v = this.fd[bk + d] || 0; if (v > mx) mx = v; } this.harm[k - 1] += (mx / 255 - this.harm[k - 1]) * 0.3; }
      }
      // 振型切换带滞回: 目标连续稳定 24 帧才切, 切换时浮雕交叉淡入 (Issue #10)
      if (this.tm === this.m && this.tn === this.n) this.stable = 0; else if (++this.stable >= 24) { this.reliefPrev = this.relief; this.reliefFade = 0; this.m = this.tm; this.n = this.tn; this.stable = 0; }
    }
    /* 振型浮雕: 峰亮谷暗 + 斜向光照, 低分辨率渲染后放大, 只在 (m,n,主题,尺寸) 变化时重算 */
    buildRelief(W, H, venom) {
      const key = this.m + ',' + this.n + ',' + venom + ',' + W + 'x' + H; if (key === this.reliefKey && this.relief) return this.relief;
      const sw = Math.max(64, Math.round(W / 4)), sh = Math.max(40, Math.round(H / 4)); const off = document.createElement('canvas'); off.width = sw; off.height = sh; const c = off.getContext('2d');
      const img = c.createImageData(sw, sh); const d = img.data; const PI = Math.PI, m = this.m, n = this.n;
      const base = venom ? [24, 22, 32] : [236, 231, 220], peak = venom ? [70, 92, 66] : [252, 249, 241], valley = venom ? [8, 8, 12] : [186, 176, 158];
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const u = x / sw, v = y / sh;
        const f = Math.cos(n * PI * u) * Math.cos(m * PI * v) - Math.cos(m * PI * u) * Math.cos(n * PI * v);
        const fx = -n * PI * Math.sin(n * PI * u) * Math.cos(m * PI * v) + m * PI * Math.sin(m * PI * u) * Math.cos(n * PI * v);
        const fy = -m * PI * Math.cos(n * PI * u) * Math.sin(m * PI * v) + n * PI * Math.cos(m * PI * u) * Math.sin(n * PI * v);
        const h = Math.abs(f) / 2; const light = Math.max(-1, Math.min(1, (fx - fy) * Math.sign(f) / (PI * (m + n)))); // 斜向光
        const t = Math.min(1, h * 1.15); const i = (y * sw + x) * 4;
        for (let k = 0; k < 3; k++) { let col = base[k] + (peak[k] - base[k]) * t + (valley[k] - base[k]) * (1 - t) * 0.55; col += light * 14; d[i + k] = col < 0 ? 0 : col > 255 ? 255 : col; }
        d[i + 3] = 255;
      }
      c.putImageData(img, 0, 0); if (this.relief && this.reliefFade >= 1) this.reliefPrev = this.relief; this.relief = off; this.reliefKey = key; return off;
    }
    drawSand(ctx, W, H, venom) {
      const a = this.amp; const m = this.m, n = this.n; const PI = Math.PI;
      // 石板: 大理石贴图 × 振型浮雕
      const tile = venom ? this.tileDark : this.tileLight;
      if (tile && tile.complete && tile.naturalWidth) { const pat = ctx.createPattern(tile, 'repeat'); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = venom ? '#14121b' : '#ece7db'; ctx.fillRect(0, 0, W, H); }
      const cur = this.buildRelief(W, H, venom); const base = venom ? 0.82 : 0.78; ctx.imageSmoothingEnabled = true;
      if (this.reliefFade < 1 && this.reliefPrev && this.reliefPrev !== cur) { this.reliefFade = Math.min(1, this.reliefFade + 1 / 50); const f = this.reliefFade; const e = f * f * (3 - 2 * f);
        ctx.save(); ctx.globalAlpha = base * (1 - e); ctx.drawImage(this.reliefPrev, 0, 0, W, H); ctx.globalAlpha = base * e; ctx.drawImage(cur, 0, 0, W, H); ctx.restore(); }
      else { ctx.save(); ctx.globalAlpha = base; ctx.drawImage(cur, 0, 0, W, H); ctx.restore(); }
      // 粒子
      const k = 0.0016 * (0.6 + a * 2.5), jit = 0.00035 + a * 0.003; const px = this.px, py = this.py, pv = this.pv;
      for (let i = 0; i < this.N; i++) {
        let x = px[i], y = py[i];
        const cnx = Math.cos(n * PI * x), cmy = Math.cos(m * PI * y), cmx = Math.cos(m * PI * x), cny = Math.cos(n * PI * y);
        const f = cnx * cmy - cmx * cny;
        const fx = -n * PI * Math.sin(n * PI * x) * cmy + m * PI * Math.sin(m * PI * x) * cny;
        const fy = -m * PI * cnx * Math.sin(m * PI * y) + n * PI * cmx * Math.sin(n * PI * y);
        let dx = -f * fx * k + (Math.random() - 0.5) * jit, dy = -f * fy * k + (Math.random() - 0.5) * jit;
        const sp = Math.sqrt(dx * dx + dy * dy); if (sp > 0.015) { dx *= 0.015 / sp; dy *= 0.015 / sp; }
        x += dx; y += dy; if (x < 0) x = -x; if (x > 1) x = 2 - x; if (y < 0) y = -y; if (y > 1) y = 2 - y;
        px[i] = x; py[i] = y; pv[i] = sp;
      }
      const dpr = W / Math.max(1, this.cv.clientWidth); const r = Math.max(1.4, Math.min(2.8, 1.5 * dpr)); const sh = 0.9 * dpr;
      // 阴影层: 让金沙在白大理石上也立得起来
      ctx.fillStyle = venom ? 'rgba(0,0,0,0.65)' : 'rgba(60,40,10,0.42)';
      for (let i = 0; i < this.N; i++) ctx.fillRect(px[i] * W + sh, py[i] * H + sh, r, r);
      const gold = venom ? [140, 255, 90] : [196, 140, 32], hot = venom ? [220, 160, 255] : [255, 226, 130];
      for (let i = 0; i < this.N; i++) {
        const t = Math.min(1, pv[i] * 80); const c0 = (gold[0] + (hot[0] - gold[0]) * t) | 0, c1 = (gold[1] + (hot[1] - gold[1]) * t) | 0, c2 = (gold[2] + (hot[2] - gold[2]) * t) | 0;
        ctx.fillStyle = 'rgb(' + c0 + ',' + c1 + ',' + c2 + ')'; ctx.fillRect(px[i] * W, py[i] * H, r, r);
      }
      // 振动时板面泛光
      if (a > 0.01) { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6); g.addColorStop(0, 'rgba(' + gold.join(',') + ',' + Math.min(0.14, a * 0.4) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = venom ? 'rgba(140,255,90,0.75)' : 'rgba(90,64,10,0.75)'; ctx.font = (10 * dpr) + 'px Menlo, monospace'; ctx.fillText('m' + this.m + ' n' + this.n + (this.f1 ? '  ' + Math.round(this.f1) + ' Hz' : '') + '  ' + (a * 100).toFixed(0), 8 * dpr, H - 8 * dpr);
    }
    /* 谐波金字塔: 基频的 1..12 次分音, 由下往上逐层叠加 (傅里叶级数) */
    drawHarm(ctx, W, H, venom) {
      ctx.fillStyle = venom ? '#0e0d14' : '#1e1a14'; ctx.fillRect(0, 0, W, H);
      const rows = 12, rowH = H / (rows + 1); const dpr = W / Math.max(1, this.cv.clientWidth);
      const gold = venom ? [140, 255, 90] : [232, 193, 90], hot = venom ? [200, 120, 255] : [255, 246, 200];
      const t = this.frame * 0.05;
      for (let row = 0; row < rows; row++) {
        const y0 = H - (row + 1) * rowH; const partials = row + 1; const width = W * (0.35 + 0.65 * (1 - row / rows));
        const x0 = (W - width) / 2; let energy = 0;
        ctx.beginPath();
        for (let px = 0; px <= width; px += 2) {
          const ph = (px / width) * 2 * Math.PI * 2 + t; let v = 0;
          for (let k = 1; k <= partials; k++) { const ak = this.harm[k - 1]; energy += ak; v += (ak / k) * Math.sin(k * ph); }
          const y = y0 - v * rowH * 0.9; if (px === 0) ctx.moveTo(x0 + px, y); else ctx.lineTo(x0 + px, y);
        }
        const e = Math.min(1, energy / (width / 2) / 1.5); const c = [gold[0] + (hot[0] - gold[0]) * e, gold[1] + (hot[1] - gold[1]) * e, gold[2] + (hot[2] - gold[2]) * e];
        ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (0.35 + 0.6 * e) + ')'; ctx.lineWidth = (0.8 + 1.2 * e) * dpr; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 6 * e * dpr; ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.fillStyle = venom ? 'rgba(140,255,90,0.7)' : 'rgba(232,193,90,0.7)'; ctx.font = (10 * dpr) + 'px Menlo, monospace';
      ctx.fillText('f₀ ' + (this.f1 ? Math.round(this.f1) + ' Hz' : '—') + '  分音 partials 1–12', 8 * dpr, H - 8 * dpr);
    }
    drawWave(ctx, W, H, venom) {
      ctx.clearRect(0, 0, W, H);
      const gold = venom ? '#8cff5a' : '#e8c15a', gold2 = venom ? 'rgba(140,255,90,0.18)' : 'rgba(232,193,90,0.22)';
      const bins = this.fd.length; const bars = 72; ctx.fillStyle = gold2;
      for (let i = 0; i < bars; i++) { const b0 = Math.floor(Math.pow(bins, i / bars)), b1 = Math.max(b0 + 1, Math.floor(Math.pow(bins, (i + 1) / bars))); let mx = 0; for (let b = b0; b < b1 && b < bins; b++) mx = Math.max(mx, this.fd[b]); const h = (mx / 255) * H * 0.9; ctx.fillRect((i / bars) * W, H - h, W / bars - 1, h); }
      ctx.lineWidth = 2 * (devicePixelRatio > 1 ? 2 : 1); ctx.strokeStyle = gold; ctx.shadowColor = gold; ctx.shadowBlur = 8; ctx.beginPath();
      const n = this.td.length; let start = 0; for (let i = 1; i < n / 2; i++) if (this.td[i - 1] < 128 && this.td[i] >= 128) { start = i; break; }
      for (let i = 0; i < n / 2; i++) { const x = (i / (n / 2)) * W, y = H / 2 - ((this.td[start + i] - 128) / 128) * H * 0.45; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    draw(venom) {
      const cv = this.cv, ctx = cv.getContext('2d'); const dpr = devicePixelRatio > 1 ? 2 : 1; const W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      this.frame++; this.analyse();
      if (this.mode === 'sand') this.drawSand(ctx, W, H, venom); else if (this.mode === 'harm') this.drawHarm(ctx, W, H, venom); else this.drawWave(ctx, W, H, venom);
    }
  }
  UI.Scope = Scope;

  /* ---------- 查找面板 (⌘K) ---------- */
  class Palette {
    constructor(container, opts) {
      this.c = container; this.opts = opts; this.entries = []; this.sel = 0;
      container.innerHTML = '<div class="pal-box"><input class="pal-input" placeholder="查找参数 / 预设 / 动作 · Find any parameter, preset or action (中文 / English)"><div class="pal-list"></div><div class="pal-hint">↑↓ 选择 Select · Enter 执行 Run · Esc 关闭 Close</div></div>';
      this.input = container.querySelector('.pal-input'); this.list = container.querySelector('.pal-list');
      this.input.addEventListener('input', () => this.render());
      this.input.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { this.sel++; this.render(); e.preventDefault(); } else if (e.key === 'ArrowUp') { this.sel--; this.render(); e.preventDefault(); } else if (e.key === 'Enter') { this.pick(); } else if (e.key === 'Escape') this.close(); });
      container.addEventListener('click', (e) => { if (e.target === container) this.close(); });
    }
    setEntries(e) { this.entries = e; }
    open() { this.c.classList.add('open'); this.input.value = ''; this.sel = 0; this.render(); setTimeout(() => this.input.focus(), 10); }
    close() { this.c.classList.remove('open'); }
    toggle() { this.c.classList.contains('open') ? this.close() : this.open(); }
    score(q, e) { if (!q) return 1; const hay = (e.label + ' ' + (e.en || '') + ' ' + (e.kind || '') + ' ' + (e.abbr || '')).toLowerCase(); if (hay.includes(q)) return 10 + (e.label.toLowerCase().startsWith(q) ? 5 : 0); let i = 0; for (const ch of hay) { if (ch === q[i]) i++; if (i === q.length) return 1; } return 0; }
    render() {
      const q = this.input.value.trim().toLowerCase();
      this.res = this.entries.map((e) => [this.score(q, e), e]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 14).map((x) => x[1]);
      if (this.sel < 0) this.sel = this.res.length - 1; if (this.sel >= this.res.length) this.sel = 0;
      this.list.innerHTML = '';
      this.res.forEach((e, i) => { const d = el('div', 'pal-item' + (i === this.sel ? ' sel' : ''), '<span class="pal-kind">' + e.kind + '</span><span class="pal-label">' + e.label + '</span><span class="pal-en">' + (e.en || '') + '</span>'); d.addEventListener('click', () => { this.sel = i; this.pick(); }); this.list.appendChild(d); });
    }
    pick() { const e = this.res && this.res[this.sel]; if (!e) return; this.close(); if (this.opts.onPick) this.opts.onPick(e); }
  }
  UI.Palette = Palette;
})(window);
