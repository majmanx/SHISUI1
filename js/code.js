/* ============================================================
   石髓 SHISUI · 走带调度器 + 琶音器 + 代码控制台
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SHISUI;

  /* ---------- 调度器 (基于 AudioContext 时钟的前瞻调度) ---------- */
  class Scheduler {
    constructor(engine) {
      this.engine = engine; this.bpm = 96; this.tasks = []; this.nextId = 1; this.lookahead = 0.15; this.running = false;
      this.held = []; this.arp = { mode: 'off', rate: 2, oct: 1, gate: 0.6 }; this.arpIdx = 0; this.arpDir = 1; this.arpNextTime = 0; this.piPos = 0;
      this.onArpNote = null; this.piDigit = null; this.pending = new Set(); this.onBeat = null; this.beatCount = 0; this.nextBeatTime = 0;
    }
    get spb() { return 60 / this.bpm; }
    start() { if (this.running) return; this.running = true; const now = this.engine.ctx.currentTime + 0.05; this.arpNextTime = now; this.nextBeatTime = now; for (const t of this.tasks) t.nextTime = now; this._timer = setInterval(() => this.tick(), 25); }
    stop() { if (!this.running) return; this.running = false; clearInterval(this._timer); for (const p of this.pending) clearTimeout(p); this.pending.clear(); this.engine.allOff(); }
    _timeout(fn, delaySec) { const id = setTimeout(() => { this.pending.delete(id); fn(); }, Math.max(0, delaySec * 1000)); this.pending.add(id); return id; }
    playAt(note, vel, dur, when) {
      const now = this.engine.ctx.currentTime; if (when == null) when = now;
      this._timeout(() => { this.engine.noteOn(note, vel); if (this.onArpNote) this.onArpNote(note, true); }, when - now);
      this._timeout(() => { this.engine.noteOff(note); if (this.onArpNote) this.onArpNote(note, false); }, when - now + Math.max(0.02, dur));
    }
    every(beats, fn) { const t = { id: this.nextId++, beats, fn, count: 0, nextTime: this.engine.ctx.currentTime + 0.05 }; this.tasks.push(t); if (!this.running) this.start(); return t.id; }
    clear(id) { this.tasks = this.tasks.filter((t) => t.id !== id); }
    clearAll() { this.tasks = []; }
    hold(note) { if (!this.held.includes(note)) this.held.push(note); if (!this.running) this.start(); }
    unhold(note) { this.held = this.held.filter((n) => n !== note); }
    arpNotes() { const base = this.held.slice().sort((a, b) => a - b); const out = []; for (let o = 0; o < Math.round(this.arp.oct); o++) for (const n of base) out.push(n + 12 * o); return out; }
    arpPick(notes) {
      const n = notes.length; if (!n) return null; const m = this.arp.mode;
      if (m === 'random') return notes[Math.floor(Math.random() * n)];
      if (m === 'pi') { const d = this.piDigit ? this.piDigit(this.piPos++) : Math.floor(Math.random() * 10); return notes[d % n]; }
      if (m === 'down') { this.arpIdx = (this.arpIdx - 1 + n) % n; return notes[this.arpIdx]; }
      if (m === 'updown') { if (n === 1) return notes[0]; this.arpIdx += this.arpDir; if (this.arpIdx >= n) { this.arpIdx = n - 2; this.arpDir = -1; } if (this.arpIdx < 0) { this.arpIdx = 1; this.arpDir = 1; } return notes[this.arpIdx]; }
      this.arpIdx = (this.arpIdx + 1) % n; return notes[this.arpIdx]; // up / c14
    }
    arpStepDur() { const r = +this.arp.rate; return r === 3 ? this.spb / 3 : this.spb / r; }
    /* 外部触发一步 (碳衰变) */
    arpStep(vel) { const notes = this.arpNotes(); const n = this.arpPick(notes); if (n == null) return; this.playAt(n, vel || 0.8, this.arpStepDur() * this.arp.gate, null); }
    tick() {
      const ctx = this.engine.ctx; const horizon = ctx.currentTime + this.lookahead;
      while (this.nextBeatTime < horizon) { if (this.onBeat) this.onBeat(this.beatCount, this.nextBeatTime); this.beatCount++; this.nextBeatTime += this.spb; }
      if (this.arp.mode !== 'off' && this.arp.mode !== 'c14') {
        const step = this.arpStepDur();
        while (this.arpNextTime < horizon) {
          const notes = this.arpNotes(); if (notes.length) { const n = this.arpPick(notes); if (n != null) this.playAt(n, 0.8, step * this.arp.gate, this.arpNextTime); }
          this.arpNextTime += step;
        }
      } else this.arpNextTime = Math.max(this.arpNextTime, ctx.currentTime);
      for (const t of this.tasks.slice()) {
        let guard = 0;
        while (t.nextTime < horizon && guard++ < 64) { try { t.fn(t.nextTime, t.count++); } catch (e) { console.error(e); this.clear(t.id); break; } t.nextTime += t.beats * this.spb; }
      }
    }
  }
  S.Scheduler = Scheduler;

  /* ---------- 音符解析 ---------- */
  const NOTE_IDX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function parseNote(tok) {
    if (typeof tok === 'number') return tok;
    const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(String(tok).trim()); if (!m) { const n = parseFloat(tok); return isNaN(n) ? null : n; }
    let n = NOTE_IDX[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12; return n;
  }
  S.parseNote = parseNote;

  /* ---------- 代码控制台 ---------- */
  const EXAMPLES = [
    ['五声音阶琶音', "// 每 1/4 拍从宫调五声音阶里按 π 的数字挑一个音\nconst sc = scale('penta');\nevery(0.25, (t, i) => {\n  const d = pi(i);            // 第 i 位 π 数字\n  note(60 + sc[d % sc.length] + 12 * (d > 6 ? 1 : 0), 0.7, 0.2, t);\n});"],
    ['衰变触发音符', "// 每次碳-14 衰变事件 → 触发一个羽调音，音高由衰变值决定\ninst('guzheng'); set('rev.mix', 0.5);\nonDecay((k, v) => {\n  const sc = scale('yu');\n  note(48 + sc[Math.floor(v * sc.length)] + 12 * Math.floor(k % 3), 0.5 + v * 0.5, 1.5);\n});"],
    ['序列 + 随机接口调制', "// 序列 (. 为休止) + 用真随机刷新截止频率\nbpm(108); inst('strings');\nseq('C3 . G3 Bb3 . F3 . Eb3', 0.25);\nevery(1, () => set('flt.cutoff', 400 + rnd() * 4000));"],
    ['毒液二胡滑音', "// 二胡 + 毒液，随机长滑音\ninst('erhu'); set('mono', 1); set('glide', 0.4); venom(true); set('vn.amt', 0.6);\nevery(2, (t) => note(55 + Math.floor(c14() * 14), 0.9, 1.8, t));"],
    ['宏调制矩阵', "// 用代码接线: 接口 R1 → 拨弦位置, LFO2 → 折叠\nmod('R1', 'gz.pos', 0.6);\nmod('LFO2', 'vn.fold', 0.4);\nset('rnd.source', 'pi'); set('rnd.rate', 1.5);\nlog('已接线，按琴键试试');"],
  ];
  class CodeConsole {
    constructor(container, api) {
      this.c = container; this.api = api;
      container.innerHTML = '<div class="code-bar"><select class="code-ex"><option value="">示例…</option></select><button class="btn gold code-run" title="Ctrl/⌘+Enter">▶ 运行</button><button class="btn code-stop">■ 停止全部</button><button class="btn code-help">API</button></div><textarea class="code-ta" spellcheck="false" placeholder="// 在这里写代码控制合成器。Ctrl/⌘+Enter 运行。点 API 查看接口。"></textarea><pre class="code-out"></pre>';
      this.ta = container.querySelector('.code-ta'); this.out = container.querySelector('.code-out'); const ex = container.querySelector('.code-ex');
      EXAMPLES.forEach((e, i) => { const o = document.createElement('option'); o.value = i; o.textContent = e[0]; ex.appendChild(o); });
      ex.addEventListener('change', () => { if (ex.value !== '') { this.ta.value = EXAMPLES[+ex.value][1]; ex.value = ''; } });
      container.querySelector('.code-run').addEventListener('click', () => this.run());
      container.querySelector('.code-stop').addEventListener('click', () => { api.stopAll(); this.log('■ 已停止所有任务'); });
      container.querySelector('.code-help').addEventListener('click', () => this.help());
      this.ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.run(); } e.stopPropagation(); });
      this.ta.addEventListener('keyup', (e) => e.stopPropagation());
      this.ta.value = EXAMPLES[0][1];
    }
    log(...a) { this.out.textContent += a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ') + '\n'; this.out.scrollTop = this.out.scrollHeight; }
    run() {
      const code = this.ta.value; const names = Object.keys(this.api); const vals = names.map((k) => this.api[k]);
      try { const fn = new Function(...names, '"use strict";\n' + code); const r = fn(...vals); this.log('▶ 运行 ' + new Date().toLocaleTimeString() + (r !== undefined ? ' → ' + JSON.stringify(r) : '')); }
      catch (e) { this.log('✖ ' + (e && e.message ? e.message : e)); }
    }
    help() {
      this.log([
        '—— 代码 API ——',
        "note(n, vel=0.8, dur=0.5, when?)  播放音符, n 可为 60 或 'C4'",
        'off(n)                             松开音符',
        "set('flt.cutoff', 2000) / get(id)  设置/读取参数(真实值)",
        'every(beats, fn(time, i))  → id    按拍循环; stop(id); stopAll()',
        "seq('C4 E4 . G4', step=0.25) → id  序列 ( . 休止, [C4 E4] 和弦 )",
        'bpm(v)  inst(name)  venom(bool)  preset(name)',
        'rnd() pi(i?) c14()                 随机源: 真随机 / π 第 i 位数字(无参=0..1) / 碳衰变',
        'onDecay(fn(k, v))                  每次衰变事件回调',
        'mod(src, dst, amt)  unmod(dst?)    调制矩阵接线',
        "scale('penta'|'yu'|'minor'|'whole'|'chrom') → 半音数组",
        'refresh()  surprise()  log(...)',
      ].join('\n'));
    }
  }
  S.CodeConsole = CodeConsole; S.CODE_EXAMPLES = EXAMPLES;
})(window);
