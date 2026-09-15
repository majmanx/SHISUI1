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
      svg.appendChild(svgEl('path', { class: 'k-track', d: arcPath(50, 50, 40, -135, 135) }));
      this.modArc = svgEl('path', { class: 'k-mod', d: '' }); svg.appendChild(this.modArc);
      this.arc = svgEl('path', { class: 'k-arc', d: '' }); svg.appendChild(this.arc);
      svg.appendChild(svgEl('circle', { class: 'k-rim', cx: 50, cy: 50, r: 33 }));
      svg.appendChild(svgEl('circle', { class: 'k-body', cx: 50, cy: 50, r: 29 }));
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
      this.arc.setAttribute('d', v > 0.003 ? arcPath(50, 50, 40, -135, a) : '');
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
      const lab = el('div', 'sel-label', spec.label + ' <span class="en">' + spec.en + '</span>'); w.appendChild(lab);
      const s = (this.sel = document.createElement('select'));
      for (const o of spec.options) { const op = document.createElement('option'); op.value = String(o[0]); op.textContent = o[1]; s.appendChild(op); }
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

  /* ---------- 开关 ---------- */
  class Toggle {
    constructor(spec, opts) {
      this.spec = spec; this.opts = opts || {}; this.value = spec.def ? 1 : 0;
      const b = (this.el = el('button', 'toggle' + (this.opts.big ? ' big' : ''))); b.dataset.param = spec.id; b.title = (spec.tip || '') + ' (' + spec.en + ')';
      b.innerHTML = '<span class="tg-led"></span><span class="tg-label">' + spec.label + ' <span class="en">' + spec.en + '</span></span>';
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
  UI.bi = (zh, en) => zh + (en ? ' <span class="en">' + en + '</span>' : '');
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
      whites.forEach((n, i) => { const k = el('div', 'key white'); k.style.left = i * ww + '%'; k.style.width = ww + '%'; k.dataset.note = n; if (n % 12 === 0) k.appendChild(el('span', 'key-name', 'C' + (n / 12 - 1))); this.c.appendChild(k); this.keys.set(n, k); });
      for (let i = 0; i < this.count; i++) { const n = this.base + i; if (![1, 3, 6, 8, 10].includes(n % 12)) continue; const wi = whites.filter((w) => w < n).length; const k = el('div', 'key black'); k.style.left = (wi * ww - ww * 0.3) + '%'; k.style.width = ww * 0.6 + '%'; k.dataset.note = n; this.c.appendChild(k); this.keys.set(n, k); }
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

  /* ---------- 示波器 / 频谱 ---------- */
  class Scope {
    constructor(canvas, analyser) { this.cv = canvas; this.an = analyser; this.td = new Uint8Array(analyser.fftSize); this.fd = new Uint8Array(analyser.frequencyBinCount); this.mode = 'both'; }
    draw(venom) {
      const cv = this.cv, ctx = cv.getContext('2d'); const W = cv.width = cv.clientWidth * (devicePixelRatio > 1 ? 2 : 1), H = cv.height = cv.clientHeight * (devicePixelRatio > 1 ? 2 : 1);
      ctx.clearRect(0, 0, W, H);
      this.an.getByteFrequencyData(this.fd); this.an.getByteTimeDomainData(this.td);
      const gold = venom ? '#8cff5a' : '#e8c15a', gold2 = venom ? 'rgba(140,255,90,0.18)' : 'rgba(232,193,90,0.22)';
      // 频谱 (对数轴)
      const bins = this.fd.length; const bars = 72;
      ctx.fillStyle = gold2;
      for (let i = 0; i < bars; i++) { const b0 = Math.floor(Math.pow(bins, i / bars)), b1 = Math.max(b0 + 1, Math.floor(Math.pow(bins, (i + 1) / bars))); let m = 0; for (let b = b0; b < b1 && b < bins; b++) m = Math.max(m, this.fd[b]); const h = (m / 255) * H * 0.9; ctx.fillRect((i / bars) * W, H - h, W / bars - 1, h); }
      // 波形
      ctx.lineWidth = 2 * (devicePixelRatio > 1 ? 2 : 1); ctx.strokeStyle = gold; ctx.shadowColor = gold; ctx.shadowBlur = 8; ctx.beginPath();
      const n = this.td.length; let start = 0; for (let i = 1; i < n / 2; i++) if (this.td[i - 1] < 128 && this.td[i] >= 128) { start = i; break; }
      for (let i = 0; i < n / 2; i++) { const x = (i / (n / 2)) * W, y = H / 2 - ((this.td[start + i] - 128) / 128) * H * 0.45; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
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
