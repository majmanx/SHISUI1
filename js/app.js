/* ============================================================
   石髓 SHISUI · 应用粘合层
   状态 / 面板构建 / 调制循环 / 随机接口 / 预设 / 撤销 / A-B / 查找 / 键盘 / MIDI
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SHISUI, UI = S.UI, $ = (s) => document.querySelector(s);
  const state = {
    patch: S.defaults(), mods: [], locks: new Set(), undo: [], redo: [], ab: { A: null, B: null, cur: 'A' }, mode: 'shape', armed: null,
    presetIdx: -1, octave: 0, xy: [0.5, 0.5], wheel: 0, key: 0.5, vel: 0.8, decayEnv: 0, sustain: false, sustained: new Set(),
    slots: [], recTarget: 0, slotFx: false,
    lfo: [{ ph: 0, sh: Math.random() }, { ph: 0, sh: Math.random() }], effCache: {}, escAt: 0,
  };
  /* ---- 诊断记录: 最近错误 + 最近操作 (供"报错"上报) ---- */
  const diag = { errors: [], actions: [], t0: Date.now() };
  const stamp = () => ((Date.now() - diag.t0) / 1000).toFixed(1) + 's';
  function logAction(msg) { diag.actions.push(stamp() + ' ' + msg); if (diag.actions.length > 80) diag.actions.shift(); }
  function logError(kind, msg, extra) { diag.errors.push({ t: stamp(), kind, msg: String(msg).slice(0, 400), extra: extra ? String(extra).slice(0, 600) : '' }); if (diag.errors.length > 25) diag.errors.shift(); }
  root.addEventListener('error', (e) => logError('error', e.message, e.filename + ':' + e.lineno + ' ' + (e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 4).join(' | ') : '')));
  root.addEventListener('unhandledrejection', (e) => logError('promise', e.reason && e.reason.message ? e.reason.message : e.reason, e.reason && e.reason.stack ? e.reason.stack.split('\n').slice(0, 4).join(' | ') : ''));
  { const ce = console.error.bind(console); console.error = (...a) => { logError('console', a.map((x) => (x && x.message) || String(x)).join(' ')); ce(...a); }; const cw = console.warn.bind(console); console.warn = (...a) => { logError('warn', a.map((x) => (x && x.message) || String(x)).join(' ')); cw(...a); }; }
  const engine = new S.Engine(); const bus = new S.RandomBus();
  let sched = null, controls = {}, modIndex = {}, keyboard, xyPad, scope, palette, codeConsole;
  let instBody, modListEl, orbEls = [], rndViewEl, geigerLed, geigerCv, c14StatsEl, srcChipEls = {}, patchTA, arpChip;
  const KEYMAP = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24, 9: 25, o: 26, 0: 27, p: 28, '[': 29, '=': 30, ']': 31 };
  const KEYHINT = {}; for (const k in KEYMAP) KEYHINT[KEYMAP[k]] = k.toUpperCase();
  const USER_KEY = 'shisui.userPresets', LAST_KEY = 'shisui.last';
  const ICONS = {
    guzheng: '<svg viewBox="0 0 48 40"><path d="M4 12 L44 8 L44 30 L4 26 Z"/><path d="M8 15 L40 12 M8 18.5 L40 16 M8 22 L40 20 M8 25.5 L40 24"/><path class="fill" d="M14 13.5 l1.6 3 h-3.2z M22 16.5 l1.6 3 h-3.2z M30 19 l1.6 3 h-3.2z M18 22 l1.6 3 h-3.2z M34 22.8 l1.6 3 h-3.2z"/><path d="M4 26 L4 32 M44 30 L44 34"/></svg>',
    erhu: '<svg viewBox="0 0 48 40"><path d="M22 3 L22 27"/><path d="M18 6 L22 7 M18 10 L22 11"/><circle cx="24" cy="30" r="6"/><path d="M24 24 L24 36"/><path d="M8 34 C 16 22, 30 14, 44 6"/><path d="M42 8 L44 6 L43 4"/></svg>',
    dizi: '<svg viewBox="0 0 48 40"><rect x="3" y="16" width="42" height="8" rx="4"/><path d="M8 16 L8 24 M12 16 L12 24 M40 16 L40 24"/><circle class="fill" cx="19" cy="20" r="1.5"/><circle class="fill" cx="24" cy="20" r="1.5"/><circle class="fill" cx="29" cy="20" r="1.5"/><circle class="fill" cx="34" cy="20" r="1.5"/><circle cx="15" cy="20" r="1.2"/><path d="M6 10 Q 10 4 14 10"/></svg>',
    guan: '<svg viewBox="0 0 48 40"><path d="M6 20 L8 18 L30 16 L30 24 L8 22 Z"/><path d="M30 16 C 38 12, 44 8, 46 4 L46 36 C 44 32, 38 28, 30 24"/><circle class="fill" cx="14" cy="20" r="1.3"/><circle class="fill" cx="19" cy="20" r="1.3"/><circle class="fill" cx="24" cy="20" r="1.3"/><path d="M2 20 L6 20"/></svg>',
    strings: '<svg viewBox="0 0 48 40"><path d="M24 3 C 30 3, 33 8, 31 14 C 29 18, 30 20, 34 22 C 38 26, 36 36, 24 37 C 12 36, 10 26, 14 22 C 18 20, 19 18, 17 14 C 15 8, 18 3, 24 3 Z"/><path d="M24 3 L24 37"/><path d="M19 22 C 18 25, 19 28, 20 30 M29 22 C 30 25, 29 28, 28 30"/><path d="M6 12 L42 30"/></svg>',
  };
  const INST_TILES = [['guzheng', ICONS.guzheng, '古筝', 'GUZHENG'], ['erhu', ICONS.erhu, '二胡', 'ERHU'], ['dizi', ICONS.dizi, '竹笛', 'DIZI'], ['guan', ICONS.guan, '管子·唢呐', 'GUAN'], ['strings', ICONS.strings, '弦乐群', 'STRINGS']];
  const INST_GROUP = { guzheng: 'guzheng', erhu: 'erhu', dizi: 'dizi', guan: 'guan', strings: 'strings' };

  /* ================= 参数核心 ================= */
  const real = (id) => state.patch[id];
  const normOf = (id) => S.norm(S.PARAM_MAP[id], state.patch[id]);
  function hostApply(id, v) {
    switch (id) {
      case 'rnd.source': bus.source = v; updateSrcChips(); break;
      case 'rnd.rate': bus.rate = v; break;
      case 'rnd.slew': bus.slew = v; break;
      case 'c14.atoms': if (Math.abs(bus.c14.N0 - v) > 1) bus.c14.reset(v); break;
      case 'c14.speed': bus.c14.speed = v; break;
      case 'bpm': if (sched) sched.bpm = v; break;
      case 'arp.mode': if (sched) { sched.arp.mode = v; if (v === 'off') { sched.held = []; engine.allOff(); } } break;
      case 'arp.rate': if (sched) sched.arp.rate = v; break;
      case 'arp.oct': if (sched) sched.arp.oct = v; break;
      case 'arp.gate': if (sched) sched.arp.gate = v; break;
      default: break;
    }
  }
  function setParam(id, v, opts) {
    opts = opts || {}; const p = S.PARAM_MAP[id]; if (!p) return; state.patch[id] = v;
    if (id === 'rnd.depth') state.effCache = {};
    if (!modIndex[id]) { engine.apply(id, v); hostApply(id, v); }
    const c = controls[id]; if (c && !opts.fromControl) { if (c instanceof UI.Knob) c.set(S.norm(p, v), true); else c.set(v); }
    if (id === 'inst' && !opts.noRebuild) buildInstPanel();
    if (id === 'vn.on') { if (!v && (opts.fromControl || opts.commit)) releaseVenomDrivers(); setVenomUI(!!v); }
    if (opts.commit || opts.fromControl) { clearTimeout(diag._pt); diag._pt = setTimeout(() => logAction('set ' + id + ' = ' + (typeof v === 'number' ? +v.toFixed(3) : v)), 250); }
    if (opts.commit) pushUndo();
  }
  /* 用户手动关闭毒液时，开关必须赢：把驱动它的宏归零，其它源的接线拆掉 (Issue #2) */
  function releaseVenomDrivers() {
    const drivers = (modIndex['vn.on'] || []).filter((m) => m.amt > 0); if (!drivers.length) return;
    const zeroed = [], removed = [];
    for (const m of drivers) {
      if (/^M[1-4]$/.test(m.src)) { const mid = 'mac.' + m.src[1]; if (real(mid) > 0) { setParam(mid, 0); zeroed.push(S.PARAM_MAP[mid].label); } }
      else removed.push(m);
    }
    if (removed.length) { state.mods = state.mods.filter((m) => !removed.includes(m)); rebuildModIndex(); }
    delete state.effCache['vn.on']; const c = controls['vn.on']; if (c) c.setMod(null);
    const msg = (zeroed.length ? '宏「' + zeroed.join('、') + '」已归零' : '') + (removed.length ? (zeroed.length ? '；' : '') + '已拆除 ' + removed.map((m) => m.src + '→毒液').join('、') : '');
    if (msg) toast('毒液已关闭 · ' + msg + ' · Venom off, its drivers released');
  }
  function rebuildModIndex() {
    modIndex = {}; for (const m of state.mods) (modIndex[m.dst] = modIndex[m.dst] || []).push(m);
    for (const id in controls) if (!modIndex[id] && state.effCache[id] != null) { delete state.effCache[id]; controls[id].setMod(null); engine.apply(id, state.patch[id]); hostApply(id, state.patch[id]); }
    renderModList();
  }
  function addMod(src, dst, amt) { const ex = state.mods.find((m) => m.src === src && m.dst === dst); if (ex) ex.amt = amt; else state.mods.push({ src, dst, amt }); rebuildModIndex(); }
  function removeMod(i) { state.mods.splice(i, 1); rebuildModIndex(); pushUndo(); }

  /* ================= 调制循环 ================= */
  function sourceValues(dt) {
    const v = { R1: bus.get(0), R2: bus.get(1), R3: bus.get(2), R4: bus.get(3), X: state.xy[0], Y: state.xy[1], M1: real('mac.1'), M2: real('mac.2'), M3: real('mac.3'), M4: real('mac.4'), KEY: state.key, VEL: state.vel, WHEEL: state.wheel, DECAY: state.decayEnv };
    for (let i = 0; i < 2; i++) {
      const L = state.lfo[i]; const rate = real('lfo' + (i + 1) + '.rate'), sh = real('lfo' + (i + 1) + '.shape'); const prev = L.ph; L.ph = (L.ph + rate * dt) % 1; if (L.ph < prev) L.sh = bus.draw('crypto')[0];
      let x; switch (sh) { case 'tri': x = 1 - Math.abs(L.ph * 2 - 1); break; case 'square': x = L.ph < 0.5 ? 1 : 0; break; case 'saw': x = L.ph; break; case 'random': x = L.sh; break; default: x = (Math.sin(L.ph * 2 * Math.PI) + 1) / 2; }
      v['LFO' + (i + 1)] = x;
    }
    return v;
  }
  function modTick(dt) {
    const src = sourceValues(dt);
    for (const id in modIndex) {
      const p = S.PARAM_MAP[id]; let n = normOf(id); const depth = state.patch['rnd.depth'];
      for (const m of modIndex[id]) { const isRnd = m.src === 'DECAY' || (m.src[0] === 'R' && m.src.length === 2); n += m.amt * (src[m.src] || 0) * (isRnd ? depth : 1); }
      n = n < 0 ? 0 : n > 1 ? 1 : n;
      const prev = state.effCache[id]; if (prev == null || Math.abs(prev - n) > 0.0015) { state.effCache[id] = n; const v = S.denorm(p, n); engine.apply(id, v); hostApply(id, v); if (id === 'vn.on') setVenomUI(v >= 0.5); const c = controls[id]; if (c) c.setMod(n); }
    }
  }
  let lastT = performance.now(), frame = 0;
  function loop() {
    const now = performance.now(); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    bus.tick(dt); state.decayEnv *= Math.exp(-dt * 7); modTick(dt); frame++;
    if (scope && frame % 2 === 0) { scope.draw(document.body.classList.contains('venom')); drawVU(); }
    if (frame % 4 === 0) updateRandomViews();
    if (engine.recording && recTimeEl && frame % 3 === 0) { const t = engine.recordingTime; recTimeEl.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '.' + Math.floor((t % 1) * 10); }
    requestAnimationFrame(loop);
  }

  /* ================= 控件工厂 ================= */
  function info(spec) { const bar = $('#info-bar'); if (!spec) { bar.innerHTML = ''; return; } bar.innerHTML = '<b>' + spec.label + ' · ' + spec.en + '</b> ' + (spec.tip || '') + ' <span class="small">' + (spec.id || '') + '</span>'; }
  function makeControl(id, opts) {
    opts = opts || {}; const p = S.PARAM_MAP[id]; if (!p) return null;
    if (controls[id] && controls[id].el.parentNode) controls[id].el.parentNode.removeChild(controls[id].el);
    let c;
    const common = { onHover: info };
    if (p.type === 'knob') c = new UI.Knob(p, Object.assign(common, { big: opts.big, onChange: (n) => setParam(id, S.denorm(p, n), { fromControl: true }), onCommit: () => pushUndo(), onLock: (l) => { if (l) state.locks.add(id); else state.locks.delete(id); }, onPick: (k) => { if (!state.armed) return false; addMod(state.armed, id, 0.5); pushUndo(); toast(state.armed + ' → ' + p.label + ' 已接线'); disarm(); k.flash(); return true; } }));
    else if (p.type === 'select') c = new UI.Select(p, Object.assign(common, { onChange: (v) => setParam(id, v, { fromControl: true, commit: true }) }));
    else c = new UI.Toggle(p, Object.assign(common, { big: opts.big, onChange: (v) => setParam(id, v, { fromControl: true, commit: true }) }));
    if (p.type === 'knob') { c.set(normOf(id), true); c.setLocked(state.locks.has(id)); } else c.set(real(id));
    if (modIndex[id] && state.effCache[id] != null) c.setMod(state.effCache[id]);
    controls[id] = c; return c;
  }
  const K = (id, big) => makeControl(id, { big });

  /* ================= 面板 ================= */
  function buildPanels() {
    const main = $('#panels'); main.innerHTML = '';
    /* --- 宏 + XY --- */
    const pm = UI.panel('p-macro', '宏', 'MACROS · 先转这四个', 1, 'col-4');
    pm.body.appendChild(UI.row([K('mac.1', true), K('mac.2', true), K('mac.3', true), K('mac.4', true)], 'macros'));
    const wk = K('tone.warm', true); wk.el.classList.add('warm-knob');
    const wrow = UI.el('div', 'warm-row'); wrow.appendChild(UI.el('div', 'warm-side cold', '❄<br><span class="zh">寒风</span><span class="en">Cold</span>')); wrow.appendChild(wk.el); wrow.appendChild(UI.el('div', 'warm-side warm', '🔥<br><span class="zh">烤火</span><span class="en">Warm</span>'));
    const pk = K('tone.pure', true); pk.el.classList.add('pure-knob'); wrow.appendChild(pk.el);
    pm.body.appendChild(wrow);
    const xyWrap = UI.el('div'); const xyEl = UI.el('div', 'xy'); xyWrap.appendChild(xyEl); xyWrap.appendChild(UI.el('div', 'xy-labels', '<span>← X 源 · X source →</span><span>↑ Y 源 · Y source</span>'));
    pm.body.appendChild(xyWrap); main.appendChild(pm);
    xyPad = new UI.XYPad(xyEl, (x, y) => { state.xy = [x, y]; });
    xyEl.title = 'XY 板：X / Y 是两个调制源。在"深"模式的调制矩阵或用芯片把它们接到任何旋钮。';
    /* --- 示波器 --- */
    const ps = UI.panel('p-scope', '石窗', 'SCOPE · 共振沙图 / 波形', 1, 'col-4');
    const sw = UI.el('div', 'scope-wrap'); const cv = document.createElement('canvas'); sw.appendChild(cv);
    const sm = UI.el('div', 'scope-modes'); const modeBtns = [];
    const pick = (mode) => { scope.mode = mode; modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode)); store.set('shisui.scope', mode); };
    for (const [mode, zh, en, tip] of [['sand', '沙', 'Sand', '克拉尼共振沙图：主峰频率按 Chladni 定律 f∝(m+2n)² 选振型，峰谷浮雕 + 金沙沿节线聚集 · Chladni sand figure'], ['harm', '谐', 'Harm', '谐波金字塔：基频的 1–12 次分音逐层叠加（傅里叶级数） · Harmonic pyramid'], ['wave', '波', 'Wave', '波形 + 频谱 · Waveform']]) {
      const b = UI.btn(UI.bi(zh, en), '', () => pick(mode), tip); b.dataset.mode = mode; modeBtns.push(b); sm.appendChild(b);
    }
    sw.appendChild(sm); ps.body.appendChild(sw); setTimeout(() => pick(store.get('shisui.scope', 'sand')), 0);
    ps.body.appendChild(UI.row([K('master.vol'), K('comp.amount'), K('flt.cutoff'), K('rev.mix')]));
    arpChip = UI.el('div', 'small', '');
    const ga = UI.group('琶音 · 走带', [K('bpm'), K('arp.mode'), K('arp.rate'), K('arp.oct'), K('arp.gate')], 'lvl2-inline');
    ga.appendChild(UI.row([UI.btn(UI.bi('■ 停止全部', 'Stop all'), 'sm', () => { if (sched) { sched.clearAll(); sched.held = []; } engine.allOff(); }, '停止代码任务与琶音'), arpChip]));
    ps.body.appendChild(ga);
    main.appendChild(ps); scope = new UI.Scope(cv, engine.analyser);
    /* --- 随机接口 --- */
    const pr = UI.panel('p-random', '随机接口', 'RANDOM BAY · crypto / π / C-14', 1, 'col-4');
    const chips = UI.el('div', 'src-chips'); const srcSpec = S.PARAM_MAP['rnd.source'];
    for (const o of srcSpec.options) { const ch = UI.el('div', 'chip', o[1]); ch.title = '选择随机源'; ch.addEventListener('click', () => setParam('rnd.source', o[0], { commit: true })); chips.appendChild(ch); srcChipEls[o[0]] = ch; }
    pr.body.appendChild(chips);
    const orbs = UI.el('div', 'orbs'); orbEls = [];
    for (let i = 0; i < 4; i++) {
      const o = UI.el('div', 'orb', '<div class="orb-ball"><div class="porthole"><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><span class="bolt"></span><canvas width="100" height="100"></canvas></div></div><div class="orb-name">R' + (i + 1) + '</div><div class="orb-val">0.500</div><div class="orb-src">—</div>');
      o.title = '接口 R' + (i + 1) + '：点我，再点任意旋钮 → 接线调制 · Port R' + (i + 1) + ': click, then any knob to route'; o.addEventListener('click', () => arm('R' + (i + 1))); orbs.appendChild(o); orbEls.push(o);
    }
    pr.body.appendChild(orbs);
    const pauseBtn = UI.btn(UI.bi('⏸ 暂停衰变', 'Pause decay'), 'warn', () => setDecayPaused(!bus.paused), '停住碳-14 时钟：不再有衰变事件、不再自动刷新接口 · Freeze the C-14 clock: no decay events, no auto refresh');
    const stopBtn = UI.btn(UI.bi('■ 停止随机', 'Stop random'), 'warn', stopRandom, '暂停衰变 + 关掉自动刷新、衰变触发音符、碳衰变琶音 · Pause + turn off auto refresh, decay→note and C-14 arp');
    const ctlRow = UI.el('div', 'rand-stop'); ctlRow.appendChild(pauseBtn); ctlRow.appendChild(stopBtn); pr.body.appendChild(ctlRow); randPauseBtn = pauseBtn;
    pr.body.appendChild(UI.row([
      UI.btn(UI.bi('⟲ 复位', 'Reset'), '', resetRandom, '接口 R1–R4 归零到 0.5，重置碳-14 样本与 π 位置 · Reset ports to 0.5, reset the C-14 sample and π position'),
      UI.btn(UI.bi('⛓ 断开', 'Unroute'), '', unrouteRandom, '拆掉所有随机接口 / 衰变脉冲的接线 · Remove every routing from R1–R4 and Decay'),
      K('rnd.depth'),
    ]));
    rndViewEl = UI.el('div', 'rnd-view'); pr.body.appendChild(rndViewEl);
    const rb = UI.btn(UI.bi('⟳ 刷新', 'Refresh · Space'), 'gold', () => { bus.refresh(); pulseOrbs(); }, '从当前随机源取 4 个新数给 R1–R4');
    pr.body.appendChild(UI.row([rb, K('rnd.rate'), K('rnd.slew'), K('rnd.wild'), UI.btn(UI.bi('🎲 惊喜', 'Surprise'), '', surprise, '随机化整套音色（跳过锁定的旋钮） Randomize the whole patch (locked knobs are skipped)')]));
    const g14 = UI.group('碳-14 衰变', [K('c14.atoms'), K('c14.speed'), K('c14.prob'), K('c14.scale'), K('c14.click')], 'lvl2-inline');
    const gg = UI.el('div', 'geiger'); geigerLed = UI.el('div', 'led'); geigerCv = document.createElement('canvas'); c14StatsEl = UI.el('div', 'stat small');
    gg.appendChild(geigerLed); gg.appendChild(geigerCv); g14.appendChild(gg); g14.appendChild(c14StatsEl); pr.body.appendChild(g14);
    main.appendChild(pr);
    /* --- 乐器 --- */
    const pi = UI.panel('p-inst', '乐器', 'INSTRUMENT · 物理建模', 1, 'col-8'); instBody = pi.body; main.appendChild(pi); buildInstPanel();
    /* --- 插电 / 毒液 --- */
    const pe = UI.panel('p-elec', '插电 · 毒液', 'ELECTRIC · VENOM', 2, 'col-4');
    pe.body.appendChild(UI.group('拾音器', [K('el.blend'), K('el.drive'), K('el.bias')]));
    pe.body.appendChild(UI.group('合成层', [K('el.synth'), K('el.wave'), K('el.detune'), K('el.sub')]));
    pe.body.appendChild(UI.group('毒液', [K('vn.on'), K('vn.amt'), K('vn.fold'), K('vn.fm'), K('vn.crush'), K('vn.ooze')]));
    main.appendChild(pe);
    /* --- 滤波 + 放大器 --- */
    const pa = UI.panel('p-amp', '放大链', 'FILTER · DIODE · TUBE · CAB', 2, 'col-7');
    pa.body.appendChild(UI.group('滤波', [K('flt.type'), K('flt.res'), K('flt.lfoRate'), K('flt.lfoDepth')]));
    pa.body.appendChild(UI.group('二极管', [K('dio.drive'), K('dio.asym'), K('dio.mix')]));
    pa.body.appendChild(UI.group('电子管', [K('tube.drive'), K('tube.bias'), K('tube.sag'), K('tube.xover'), K('tube.mix')]));
    pa.body.appendChild(UI.group('箱体 · 电', [K('cab.type'), K('cab.mix'), K('amp.in'), K('amp.out'), K('amp.hum'), K('amp.hiss')]));
    main.appendChild(pa);
    /* --- 效果 --- */
    const pf = UI.panel('p-fx', '效果', 'CHORUS · DELAY · HALL', 2, 'col-5');
    pf.body.appendChild(UI.group('合唱', [K('cho.rate'), K('cho.depth'), K('cho.mix')]));
    pf.body.appendChild(UI.group('乒乓延迟', [K('dly.time'), K('dly.fb'), K('dly.mix')]));
    pf.body.appendChild(UI.group('石厅混响', [K('rev.size'), K('rev.damp')]));
    main.appendChild(pf);
    /* --- 调制矩阵 --- */
    const pmod = UI.panel('p-mod', '调制矩阵', 'MOD MATRIX · LFO', 3, 'col-8');
    pmod.body.appendChild(UI.row([K('lfo1.rate'), K('lfo1.shape'), K('lfo2.rate'), K('lfo2.shape')]));
    const srcChips = UI.el('div', 'src-chips');
    for (const [sid, name] of S.MOD_SOURCES) { const ch = UI.el('div', 'chip', name); ch.dataset.src = sid; ch.title = '点我，再点任意旋钮 → 接线'; ch.addEventListener('click', () => arm(sid)); srcChips.appendChild(ch); }
    pmod.body.appendChild(srcChips); modListEl = UI.el('div', 'mod-list'); pmod.body.appendChild(modListEl); main.appendChild(pmod);
    /* --- 代码台 --- */
    const pc = UI.panel('p-code', '代码台 · 音色 JSON', 'CODE · PATCH', 3, 'col-12');
    const wrap = UI.el('div'); wrap.style.display = 'grid'; wrap.style.gridTemplateColumns = 'minmax(0,3fr) minmax(0,2fr)'; wrap.style.gap = '12px';
    const codeEl = UI.el('div'); const jsonEl = UI.el('div');
    patchTA = document.createElement('textarea'); patchTA.className = 'patch-json'; patchTA.spellcheck = false;
    jsonEl.appendChild(UI.el('div', 'grp-title', UI.bi('音色 JSON（可编辑后应用 / 复制分享）', 'Patch JSON · edit & apply / share'))); jsonEl.appendChild(patchTA);
    jsonEl.appendChild(UI.row([UI.btn(UI.bi('应用 JSON', 'Apply'), 'gold', applyPatchJSON), UI.btn(UI.bi('复制', 'Copy'), '', () => { patchTA.select(); document.execCommand('copy'); toast('已复制音色 JSON · Copied'); }), UI.btn(UI.bi('刷新显示', 'Reload view'), '', renderPatchJSON)]));
    wrap.appendChild(codeEl); wrap.appendChild(jsonEl); pc.body.appendChild(wrap); main.appendChild(pc);
    codeConsole = new S.CodeConsole(codeEl, codeAPI());
    /* --- 录音 · 声音槽 --- */
    const prc = UI.panel('p-rec', '录音 · 声音槽', 'RECORD · 8 SLOTS · 叠录混合', 1, 'col-12');
    const bar = UI.el('div', 'rec-bar');
    recBtn = UI.el('button', 'btn rec-btn', '<span class="rec-led"></span><span>● 录音 <span class="en">Record</span></span>'); recBtn.title = '录下你听到的一切（含效果与正在播放的槽），停止后进入下一个空槽。快捷键 Shift+R'; recBtn.addEventListener('click', toggleRecord);
    recTimeEl = UI.el('span', 'rec-time', '00:00.0');
    const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'audio/*'; fileIn.multiple = true; fileIn.style.display = 'none';
    fileIn.addEventListener('change', async () => { for (const f of Array.from(fileIn.files)) { try { const buf = await engine.decodeFile(f); putSlot(nextFreeSlot(), buf, f.name.replace(/\.[^.]+$/, '')); } catch (e) { toast('无法解码 ' + f.name); } } fileIn.value = ''; });
    const slotFxT = UI.el('button', 'toggle', '<span class="tg-led"></span><span class="tg-label">槽过效果链 <span class="en">Slots thru FX</span></span>'); slotFxT.title = '打开：槽的声音经过滤波/放大/效果；关闭：直入总线（干净回放）'; slotFxT.addEventListener('click', () => { state.slotFx = !state.slotFx; slotFxT.classList.toggle('on', state.slotFx); });
    bar.appendChild(recBtn); bar.appendChild(recTimeEl);
    bar.appendChild(UI.btn(UI.bi('⬇ 导出上次录音', 'Export last take'), 'gold', () => { const sl = state.slots[state.lastRecSlot]; if (sl && sl.buffer) exportSlot(state.lastRecSlot); else toast('还没有录音'); }, '把最近一次录音导出为 WAV'));
    bar.appendChild(UI.btn(UI.bi('📂 导入音频到槽', 'Import audio'), '', () => fileIn.click(), '把 wav/mp3/ogg 放进一个槽，用来混合创作'));
    bar.appendChild(slotFxT); bar.appendChild(UI.btn(UI.bi('■ 停止所有槽', 'Stop slots'), '', () => engine.stopAllSlots()));
    bar.appendChild(UI.el('span', 'small', '提示：让几个槽循环播放，再弹奏并录音 = 叠录出新的音色素材。槽会保存在本浏览器（IndexedDB），刷新不丢；✕ 清空并删除存档。 Loop a few slots, play & record = overdub. Slots persist in this browser; ✕ clears and deletes.'));
    bar.appendChild(fileIn); prc.body.appendChild(bar);
    const grid = UI.el('div', 'slots'); state.slots = [];
    for (let i = 0; i < 8; i++) {
      const sl = { i, buffer: null, name: '', loop: false, gain: 0.8, rate: 1, voice: null, el: null, cv: null };
      const el = UI.el('div', 'slot empty'); const head = UI.el('div', 'slot-head', '<span class="slot-name">槽 ' + (i + 1) + ' <span class="en">Slot</span></span><span class="slot-len">空 Empty</span>'); el.appendChild(head);
      const cv = document.createElement('canvas'); cv.title = '点击：录到这个槽'; cv.addEventListener('click', () => { state.recTarget = i; renderSlots(); toast('下一次录音进入槽 ' + (i + 1)); }); el.appendChild(cv);
      const ctl = UI.el('div', 'slot-ctl');
      const play = UI.btn('▶', '', () => toggleSlot(i), '播放 / 停止 Play / Stop'); const loop = UI.btn(UI.bi('循环', 'Loop'), '', () => { sl.loop = !sl.loop; loop.classList.toggle('on', sl.loop); if (sl.voice) sl.voice.src.loop = sl.loop; if (sl.buffer) saveSlot(i); }, '循环播放 Loop');
      const exp = UI.btn('⬇', '', () => exportSlot(i), '导出 WAV · Export WAV'); const clr = UI.btn('✕', 'danger', () => { if (sl.buffer && !confirm('清空槽 ' + (i + 1) + '？本地存档也会删除。\nClear slot ' + (i + 1) + '? Its saved copy will be deleted too.')) return; stopSlot(i); sl.buffer = null; sl.name = ''; saveSlot(i, true); renderSlots(); }, '清空并删除存档 Clear & delete saved copy');
      ctl.appendChild(play); ctl.appendChild(loop); ctl.appendChild(exp); ctl.appendChild(clr);
      const gl = UI.el('label', '', '音量 <span class="en">Vol</span>'); const g = document.createElement('input'); g.type = 'range'; g.min = 0; g.max = 1.5; g.step = 0.01; g.value = sl.gain; g.addEventListener('input', () => { sl.gain = +g.value; if (sl.voice) sl.voice.gain.gain.setTargetAtTime(sl.gain, engine.ctx.currentTime, 0.01); }); g.addEventListener('change', () => { if (sl.buffer) saveSlot(i); }); gl.appendChild(g);
      const rl = UI.el('label', '', '速度 <span class="en">Rate</span>'); const r = document.createElement('input'); r.type = 'range'; r.min = 0.25; r.max = 2; r.step = 0.01; r.value = 1; r.title = '播放速度（连带变调）'; r.addEventListener('input', () => { sl.rate = +r.value; if (sl.voice) sl.voice.src.playbackRate.setTargetAtTime(sl.rate, engine.ctx.currentTime, 0.01); }); r.addEventListener('change', () => { if (sl.buffer) saveSlot(i); }); r.addEventListener('dblclick', () => { r.value = 1; sl.rate = 1; if (sl.voice) sl.voice.src.playbackRate.value = 1; if (sl.buffer) saveSlot(i); }); rl.appendChild(r);
      ctl.appendChild(gl); ctl.appendChild(rl); el.appendChild(ctl);
      sl.el = el; sl.cv = cv; sl.playBtn = play; sl.loopBtn = loop; sl.gainEl = g; sl.rateEl = r; state.slots.push(sl); grid.appendChild(el);
    }
    prc.body.appendChild(grid); main.appendChild(prc); renderSlots();
    renderModList(); updateSrcChips();
  }
  let recBtn, recTimeEl;
  const nextFreeSlot = () => { const f = state.slots.findIndex((s) => !s.buffer); return f >= 0 ? f : state.recTarget; };
  async function toggleRecord() {
    logAction(engine.recording ? 'record stop' : 'record start');
    if (!engine.recording) { engine.startRecording(); recBtn.classList.add('on'); recBtn.querySelector('span:last-child').innerHTML = '■ 停止 <span class="en">Stop</span>'; state.recTarget = state.slots[state.recTarget] && !state.slots[state.recTarget].buffer ? state.recTarget : nextFreeSlot(); renderSlots(); toast('录音中 Recording → 槽 Slot ' + (state.recTarget + 1)); return; }
    const buf = await engine.stopRecording(); recBtn.classList.remove('on'); recBtn.querySelector('span:last-child').innerHTML = '● 录音 <span class="en">Record</span>'; recTimeEl.textContent = '00:00.0';
    if (!buf) { toast('录音太短'); return; }
    putSlot(state.recTarget, buf, '录音 ' + new Date().toLocaleTimeString()); state.lastRecSlot = state.recTarget; state.recTarget = nextFreeSlot(); renderSlots();
  }
  function putSlot(i, buf, name) { const sl = state.slots[i]; stopSlot(i); sl.buffer = buf; sl.name = name; sl.saved = false; renderSlots(); saveSlot(i, true); toast('槽 ' + (i + 1) + '：' + name + ' · ' + buf.duration.toFixed(1) + ' s'); }
  function toggleSlot(i) { const sl = state.slots[i]; if (sl.voice && !sl.voice.done) { stopSlot(i); return; } if (!sl.buffer) { toast('槽 ' + (i + 1) + ' 是空的：录一段或导入音频'); return; } sl.voice = engine.playBuffer(sl.buffer, { loop: sl.loop, gain: sl.gain, rate: sl.rate, fx: state.slotFx, onEnd: () => { sl.voice = null; renderSlots(); } }); renderSlots(); }
  function stopSlot(i) { const sl = state.slots[i]; if (sl.voice) { sl.voice.stop(); sl.voice = null; } renderSlots(); }
  function exportSlot(i) { const sl = state.slots[i]; if (!sl.buffer) return; const blob = S.Engine.encodeWav(sl.buffer); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const ts = new Date(); a.download = 'shisui-slot' + (i + 1) + '-' + [ts.getHours(), ts.getMinutes(), ts.getSeconds()].map((x) => String(x).padStart(2, '0')).join('') + '.wav'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('已导出 WAV：' + a.download); }
  function renderSlots() {
    state.slots.forEach((sl, i) => {
      sl.el.classList.toggle('empty', !sl.buffer); sl.el.classList.toggle('target', i === state.recTarget); sl.el.classList.toggle('playing', !!(sl.voice && !sl.voice.done));
      sl.el.querySelector('.slot-len').textContent = sl.buffer ? sl.buffer.duration.toFixed(1) + ' s' + (sl.saved ? ' · 已存 saved' : '') : '空 Empty'; sl.el.querySelector('.slot-name').innerHTML = sl.buffer ? (sl.name.length > 9 ? sl.name.slice(0, 9) + '…' : sl.name) : '槽 ' + (i + 1) + ' <span class="en">Slot</span>';
      sl.playBtn.textContent = sl.voice && !sl.voice.done ? '■' : '▶';
      const cv = sl.cv, ctx = cv.getContext('2d'); const W = cv.width = Math.max(60, cv.clientWidth || 120), H = cv.height = 36; ctx.clearRect(0, 0, W, H);
      if (!sl.buffer) { ctx.fillStyle = 'rgba(232,193,90,0.35)'; ctx.font = '10px serif'; ctx.fillText(i === state.recTarget ? '● 下一次录音 Next take' : '空 Empty', 6, 22); return; }
      const d = sl.buffer.getChannelData(0); const step = Math.max(1, Math.floor(d.length / W)); ctx.fillStyle = document.body.classList.contains('venom') ? '#8cff5a' : '#e8c15a';
      for (let x = 0; x < W; x++) { let mx = 0; const o = x * step; for (let k = 0; k < step; k += 4) mx = Math.max(mx, Math.abs(d[o + k] || 0)); const h = Math.max(1, mx * H); ctx.fillRect(x, (H - h) / 2, 1, h); }
    });
  }
  function buildInstPanel() {
    if (!instBody) return; instBody.innerHTML = '';
    const tiles = UI.el('div', 'tiles');
    for (const [id, ico, name, en] of INST_TILES) { const t = UI.el('div', 'tile' + (real('inst') === id ? ' on' : ''), '<div class="t-ico">' + ico + '</div><div class="t-name">' + name + '</div><div class="t-en">' + en + '</div>'); t.addEventListener('click', () => { setParam('inst', id, { commit: true }); toast(name); }); t.addEventListener('mouseenter', () => info(S.PARAM_MAP.inst)); tiles.appendChild(t); }
    instBody.appendChild(tiles);
    const ar = UI.row([
      UI.btn(UI.bi('🎐 原声', 'Acoustic'), 'gold', acousticNow, '把当前乐器恢复为最接近真实乐器的原声设置，并告诉你它像哪件传世乐器 · Restore the natural acoustic sound and tell you which real instrument it resembles'),
      UI.btn(UI.bi('⟲ 全部重置', 'Reset everything'), 'reset-all', resetEverything, '把所有旋钮、接线、随机接口、宏全部恢复出厂（两次确认；我的预设与声音槽不受影响）'),
    ]);
    instBody.appendChild(ar);
    if (state.acousticCard) { const c = UI.el('div', 'acoustic-card', state.acousticCard); instBody.appendChild(c); }
    const g = INST_GROUP[real('inst')]; const ids = S.PARAMS.filter((p) => p.group === g).map((p) => p.id);
    instBody.appendChild(UI.group(S.GROUPS[g], ids.map((id) => K(id)), 'lvl2-inline'));
    instBody.appendChild(UI.row([UI.group('演奏', [K('mono'), K('glide'), K('spread'), K('voices')]), UI.group('揉弦 · 颤音', [K('vib.rate'), K('vib.depth'), K('vib.delay')]), UI.group('包络', [K('env.a'), K('env.d'), K('env.s'), K('env.r')])], 'lvl2-inline'));
  }
  function renderModList() {
    if (!modListEl) return; modListEl.innerHTML = '';
    if (!state.mods.length) { modListEl.appendChild(UI.el('div', 'mod-empty', '还没有接线。点一个源芯片（或随机接口 R1–R4），再点任意旋钮。 No routing yet: click a source chip (or a port R1–R4), then any knob.')); return; }
    state.mods.forEach((m, i) => {
      const p = S.PARAM_MAP[m.dst]; const srcName = (S.MOD_SOURCES.find((s) => s[0] === m.src) || [m.src, m.src])[1];
      const it = UI.el('div', 'mod-item'); it.innerHTML = '<span class="src">' + srcName + '</span><span class="dst">→ ' + (p ? p.label + ' <span class="small">' + p.id + '</span>' : m.dst) + '</span>';
      const r = document.createElement('input'); r.type = 'range'; r.min = -1; r.max = 1; r.step = 0.01; r.value = m.amt; r.title = '调制深度 ' + m.amt.toFixed(2); r.addEventListener('input', () => { m.amt = +r.value; r.title = '调制深度 ' + m.amt.toFixed(2); }); r.addEventListener('change', pushUndo);
      it.appendChild(r); const x = UI.el('button', 'x', '✕'); x.title = '删除'; x.addEventListener('click', () => removeMod(i)); it.appendChild(x); modListEl.appendChild(it);
    });
  }
  function arm(src) { state.armed = src; document.body.classList.add('arming'); $('#arm-banner').textContent = '已选中源 ' + src + '：点任意旋钮完成接线（Esc 取消） · Source armed: click any knob to route (Esc cancels)'; document.querySelectorAll('.chip[data-src], .orb').forEach((e) => e.classList.toggle('armed', e.dataset.src === src || e.querySelector('.orb-name') && e.querySelector('.orb-name').textContent === src)); }
  function disarm() { state.armed = null; document.body.classList.remove('arming'); document.querySelectorAll('.armed').forEach((e) => e.classList.remove('armed')); }
  let randPauseBtn;
  function setDecayPaused(on) { bus.paused = on; if (!on) bus.decayDrive = true; if (randPauseBtn) { randPauseBtn.classList.toggle('on', on); randPauseBtn.innerHTML = on ? UI.bi('▶ 继续衰变', 'Resume decay') : UI.bi('⏸ 暂停衰变', 'Pause decay'); } logAction('decay ' + (on ? 'paused' : 'resumed')); toast(on ? '碳-14 时钟已暂停 · Decay paused' : '碳-14 时钟继续 · Decay resumed'); }
  function stopRandom() {
    setDecayPaused(true); setParam('rnd.rate', 0); setParam('c14.prob', 0); if (real('arp.mode') === 'c14') setParam('arp.mode', 'off'); bus.decayDrive = false; state.decayEnv = 0; pushUndo();
    toast('随机已全部停止：自动刷新 / 衰变触发 / 碳衰变琶音都已关闭 · All randomness stopped');
  }
  function acousticNow() {
    const inst = real('inst'); const a = S.ACOUSTIC[inst]; if (!a) return;
    const patch = S.defaults(); Object.assign(patch, a.patch); const mods = S.DEFAULT_MODS.map((m) => ({ src: m[0], dst: m[1], amt: m[2] }));
    state.acousticCard = '<b>' + a.name + '</b> · 最接近：<b>' + a.like + '</b><br>' + a.why + '<span class="en-line">Closest real instrument: ' + a.like + '</span>';
    applySnapshot({ patch, mods }); state.presetIdx = -1; $('#preset-title').textContent = a.name; renderPresetList(); pushUndo(); logAction('acoustic ' + inst);
    if (state.mode === 'play') setMode('shape'); toast('原声：' + a.name + ' · 像 ' + a.like);
  }
  function resetEverything() {
    if (!confirm('全部重置？所有旋钮、接线、随机接口、宏都会恢复出厂。\nReset everything? All knobs, routings, ports and macros return to factory.')) return;
    if (!confirm('再确认一次：确定全部重置？（可用撤销回退；我的预设和声音槽不受影响）\nConfirm again. Undo is available; your saved presets and slots are kept.')) return;
    state.acousticCard = null; state.locks.clear(); for (const id in controls) if (controls[id].setLocked) controls[id].setLocked(false);
    const patch = S.defaults(); const mods = S.DEFAULT_MODS.map((m) => ({ src: m[0], dst: m[1], amt: m[2] }));
    applySnapshot({ patch, mods }); state.presetIdx = -1; $('#preset-title').textContent = '出厂状态 Factory'; renderPresetList();
    bus.decayDrive = true; setDecayPaused(false); resetRandom(); state.xy = [0.5, 0.5]; if (xyPad) xyPad.set(0.5, 0.5); state.wheel = 0;
    if (sched) { sched.clearAll(); sched.held = []; } engine.allOff(); pushUndo(); logAction('reset everything'); toast('已全部重置为出厂状态 · Everything reset');
  }
  function resetRandom() {
    for (let i = 0; i < 4; i++) { bus.raw[i] = 0.5; bus.val[i] = 0.5; } bus.lastSrcUsed = []; bus.c14.reset(real('c14.atoms')); bus.pi.seek(0); state.decayEnv = 0; state.effCache = {};
    pulseOrbs(); toast('随机接口已复位 · Ports reset');
  }
  function unrouteRandom() {
    const n = state.mods.filter((m) => m.src === 'DECAY' || (m.src[0] === 'R' && m.src.length === 2)).length;
    if (!n) { toast('没有随机接线 · Nothing to unroute'); return; }
    if (!confirm('拆掉 ' + n + ' 条随机接线？\nRemove ' + n + ' random routings?')) return;
    state.mods = state.mods.filter((m) => !(m.src === 'DECAY' || (m.src[0] === 'R' && m.src.length === 2))); rebuildModIndex(); pushUndo(); toast('已断开 ' + n + ' 条随机接线 · Unrouted');
  }
  /* 舷窗: 阳光 (crypto / π / mix) 或 碳矿石 (C-14) */
  const oreSeeds = []; for (let i = 0; i < 4; i++) { const a = []; for (let k = 0; k < 26; k++) a.push([Math.random(), Math.random(), 0.5 + Math.random() * 1.6, Math.random()]); oreSeeds.push(a); }
  function drawPorthole(cv, v, mode, venom, t) {
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); ctx.clip();
    if (mode === 'ore') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2622'); g.addColorStop(1, '#0e0c0a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, 10 + k * 16 + Math.sin(k) * 4); ctx.lineTo(W, 18 + k * 16 + Math.cos(k * 1.3) * 6); ctx.stroke(); }
      const seeds = oreSeeds[cv._idx || 0]; const count = Math.round(v * seeds.length); const col = venom ? [140, 255, 90] : [232, 193, 90];
      for (let k = 0; k < seeds.length; k++) {
        const [sx, sy, sr, ph] = seeds[k]; const on = k < count; const x = sx * W, y = sy * H; const r = sr * (W / 40);
        const pulse = on ? 0.7 + 0.3 * Math.sin(t * 2 + ph * 6.28) : 0.15;
        if (on) { const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 4); rg.addColorStop(0, 'rgba(' + col.join(',') + ',' + 0.35 * pulse + ')'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
        ctx.fillStyle = on ? 'rgba(' + col.join(',') + ',' + pulse + ')' : 'rgba(90,84,76,0.9)';
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 15px Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText(Math.round(v * 100) + '%', W / 2, H * 0.62);
    } else {
      const day = v; const top = [8 + 40 * day, 12 + 90 * day, 40 + 170 * day], bot = [60 + 190 * day, 40 + 140 * day, 30 + 60 * day];
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgb(' + top.map((x) => x | 0).join(',') + ')'); g.addColorStop(1, 'rgb(' + bot.map((x) => x | 0).join(',') + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sy = H * (0.9 - 0.75 * day), sx = W * 0.5, sr = W * (0.08 + 0.1 * day);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 4); glow.addColorStop(0, 'rgba(255,240,180,' + (0.35 + 0.5 * day) + ')'); glow.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = venom ? 'rgb(' + (140 + 60 * day) + ',255,' + (90 + 100 * day) + ')' : 'rgb(255,' + (200 + 50 * day) + ',' + (120 + 100 * day) + ')'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      // 海面
      const sea = ctx.createLinearGradient(0, H * 0.68, 0, H); sea.addColorStop(0, 'rgba(10,30,60,' + (0.6 - 0.2 * day) + ')'); sea.addColorStop(1, 'rgba(5,15,35,0.9)'); ctx.fillStyle = sea; ctx.fillRect(0, H * 0.68, W, H * 0.32);
      ctx.strokeStyle = 'rgba(255,240,200,' + (0.15 + 0.35 * day) + ')'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { const yy = H * 0.72 + k * 6; ctx.beginPath(); for (let x = W * 0.3; x < W * 0.7; x += 4) ctx.lineTo(x, yy + Math.sin(x * 0.3 + t * 3 + k) * 1.5); ctx.stroke(); }
      if (day < 0.35) { ctx.fillStyle = 'rgba(255,255,255,' + (0.35 - day) + ')'; for (let k = 0; k < 14; k++) ctx.fillRect(((k * 37) % 100) / 100 * W, ((k * 53) % 60) / 100 * H, 1.5, 1.5); }
    }
    ctx.restore();
  }
  function updateSrcChips() { for (const k in srcChipEls) srcChipEls[k].classList.toggle('on', k === real('rnd.source')); }
  function pulseOrbs(i) { orbEls.forEach((o, j) => { if (i == null || i === j) { o.classList.remove('pulse'); void o.offsetWidth; o.classList.add('pulse'); setTimeout(() => o.classList.remove('pulse'), 160); } }); }

  /* ================= 随机视图 ================= */
  function updateRandomViews() {
    const src = real('rnd.source'); const venom = document.body.classList.contains('venom'); const tnow = performance.now() / 1000;
    for (let i = 0; i < 4; i++) { const v = bus.get(i); const o = orbEls[i]; if (!o) continue; const cv = o.querySelector('canvas'); cv._idx = i; const su = bus.lastSrcUsed[i] || (src === 'c14' ? 'C14' : ''); drawPorthole(cv, v, su === 'C14' || (src === 'c14' && !su) ? 'ore' : 'sun', venom, tnow + i); o.querySelector('.orb-val').textContent = v.toFixed(3); o.querySelector('.orb-src').textContent = su === 'C14' ? '碳晶 ore' : su ? '阳光 sun · ' + su : '—'; }
    let html = '';
    if (src === 'pi') { const w = bus.pi.window(36, 24); html = '<span class="dim">π 第 ' + w.start + ' 位起 · 已取 ' + bus.pi.pos + ' 位 · 已算 ' + bus.pi.digits.length + ' 位</span><br>' + w.digits.map((d, k) => { const idx = w.start + k; return idx >= bus.pi.pos && idx < bus.pi.pos + 4 ? '<span class="hl">' + d + '</span>' : (idx < bus.pi.pos ? '<span class="dim">' + d + '</span>' : d); }).join(''); }
    else if (src === 'crypto') { html = '<span class="dim">crypto.getRandomValues · 32-bit 字</span><br>' + bus.crypto.hexLog.slice(-16).join(' '); }
    else { const c = bus.c14; html = '<span class="dim">碳-14 · 半衰期 5730 年 · λ = 1.21e-4 /年</span><br>剩余原子 <b>' + Math.round(c.N).toLocaleString() + '</b> / ' + Math.round(c.N0).toLocaleString() + '<br>已过 ' + c.age.toFixed(0) + ' 年 (' + c.halfLives.toFixed(3) + ' 个半衰期) · 累计衰变 ' + c.total.toLocaleString() + '<br>活度 ≈ ' + c.ratePerSec.toFixed(1) + ' 次/秒' + (src === 'mix' ? '<br><span class="dim">三源混合：每个接口随机取自 crypto / π / C-14</span>' : ''); }
    rndViewEl.innerHTML = html;
    // 盖革火花图
    if (geigerCv) { const cv = geigerCv, ctx = cv.getContext('2d'); const W = cv.width = cv.clientWidth || 200, H = cv.height = 34; ctx.clearRect(0, 0, W, H); const w = bus.c14.window; const mx = Math.max(1, ...w); ctx.fillStyle = document.body.classList.contains('venom') ? '#8cff5a' : '#e8c15a'; w.forEach((k, i) => { const h = (k / mx) * (H - 2); ctx.fillRect((i / 120) * W, H - h, Math.max(1, W / 120 - 1), h); }); }
    if (c14StatsEl) { const c = bus.c14; c14StatsEl.textContent = '剩余 ' + Math.round(c.N).toLocaleString() + ' 原子 · ' + c.ratePerSec.toFixed(1) + ' 次/秒 · ' + c.halfLives.toFixed(3) + ' 半衰期'; }
  }
  bus.onDecay = (k, v) => {
    state.decayEnv = 1; if (geigerLed) { geigerLed.classList.add('hit'); setTimeout(() => geigerLed.classList.remove('hit'), 60); }
    if (real('c14.click')) engine.click(Math.min(0.5, 0.12 + k * 0.04));
    const prob = real('c14.prob');
    if (prob > 0 && bus.draw('crypto')[0] < prob) { const sc = S.SCALES[real('c14.scale')] || S.SCALES.penta; const deg = Math.floor(v * sc.length * 2); const note = 48 + 12 * state.octave + 12 * Math.floor(deg / sc.length) + sc[deg % sc.length]; playNote(note, 0.4 + v * 0.5, 0.25 + (1 - v) * 1.2); }
    if (real('arp.mode') === 'c14' && sched) sched.arpStep(0.5 + v * 0.5);
  };
  bus.onRefresh = (raw, i) => pulseOrbs(i);

  /* ================= 演奏 ================= */
  function playNote(n, vel, dur) { engine.noteOn(n, vel); keyboard.light(n, true); setTimeout(() => { engine.noteOff(n); keyboard.light(n, false); }, dur * 1000); }
  function noteOn(n, vel) { state.key = n / 127; state.vel = vel; diag.notes = (diag.notes || 0) + 1; if (diag.notes % 16 === 1) logAction('noteOn ' + UI.noteName(n) + ' (' + diag.notes + ' 音)'); if (real('arp.mode') !== 'off') { sched.hold(n); return; } engine.noteOn(n, vel); }
  function noteOff(n) { if (real('arp.mode') !== 'off') { sched.unhold(n); return; } if (state.sustain) { state.sustained.add(n); return; } engine.noteOff(n); }
  function setSustain(on) { state.sustain = on; if (!on) { for (const n of state.sustained) engine.noteOff(n); state.sustained.clear(); } }
  function setOctave(o) {
    state.octave = Math.max(-2, Math.min(3, o)); const base = 36 + 12 * state.octave; keyboard.setBase(base);
    const kb = 48 + 12 * state.octave; $('#oct-label').textContent = UI.noteName(base) + ' – ' + UI.noteName(base + 57) + ' · 电脑键盘 ' + UI.noteName(kb) + ' 起';
    keyboard.keys.forEach((el, n) => { const h = KEYHINT[n - kb]; if (h) { el.appendChild(UI.el('span', 'key-hint', h)); el.classList.add('kbd-range'); } });
  }

  /* ================= 撤销 / A-B / 预设 ================= */
  const snapshot = () => ({ patch: Object.assign({}, state.patch), mods: state.mods.map((m) => Object.assign({}, m)) });
  let saveT; function pushUndo() { const s = JSON.stringify(snapshot()); if (state.undo.length && state.undo[state.undo.length - 1] === s) return; state.undo.push(s); if (state.undo.length > 80) state.undo.shift(); state.redo.length = 0; renderPatchJSON(); clearTimeout(saveT); saveT = setTimeout(() => store.set(LAST_KEY, { snap: snapshot(), presetIdx: state.presetIdx, name: $('#preset-title').textContent }), 400); }
  function applySnapshot(snap) { for (const id in snap.patch) if (S.PARAM_MAP[id]) setParam(id, snap.patch[id], { noRebuild: true }); state.mods = snap.mods.map((m) => Object.assign({}, m)); rebuildModIndex(); buildInstPanel(); setVenomUI(!!real('vn.on')); renderPatchJSON(); }
  function undo() { if (state.undo.length < 2) return; state.redo.push(state.undo.pop()); applySnapshot(JSON.parse(state.undo[state.undo.length - 1])); toast('撤销'); }
  function redo() { if (!state.redo.length) return; const s = state.redo.pop(); state.undo.push(s); applySnapshot(JSON.parse(s)); toast('重做'); }
  function abToggle() { const cur = state.ab.cur; state.ab[cur] = snapshot(); const nxt = cur === 'A' ? 'B' : 'A'; state.ab.cur = nxt; if (state.ab[nxt]) applySnapshot(state.ab[nxt]); $('#btn-ab').textContent = nxt === 'A' ? 'A/B' : 'B/A'; toast('切换到音色槽 ' + nxt); pushUndo(); }
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式等 */ } } };
  /* ---- IndexedDB：声音槽持久化 ---- */
  const idb = {
    open() { return new Promise((res, rej) => { if (!root.indexedDB) return rej(new Error('no idb')); const r = root.indexedDB.open('shisui', 1); r.onupgradeneeded = () => { r.result.createObjectStore('slots'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(v, k); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); }); },
    async del(k) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').delete(k); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); }); },
    async all() { const db = await this.open(); return new Promise((res, rej) => { const st = db.transaction('slots', 'readonly').objectStore('slots'); const rk = st.getAllKeys(), rv = st.getAll(); rv.onsuccess = () => { db.close(); res(rk.result.map((k, i) => [k, rv.result[i]])); }; rv.onerror = () => rej(rv.error); }); },
  };
  const slotSaveT = {};
  function saveSlot(i, immediate) {
    const sl = state.slots[i]; clearTimeout(slotSaveT[i]);
    const doSave = async () => {
      try {
        if (!sl.buffer) { await idb.del(i); sl.saved = false; return; }
        const b = sl.buffer; const data = []; for (let c = 0; c < b.numberOfChannels; c++) data.push(b.getChannelData(c).slice().buffer);
        await idb.put(i, { name: sl.name, sr: b.sampleRate, len: b.length, ch: b.numberOfChannels, data, loop: sl.loop, gain: sl.gain, rate: sl.rate, savedAt: Date.now() });
        sl.saved = true; renderSlots();
      } catch (e) { sl.saved = false; console.warn('slot save failed', e); toast('声音槽无法持久化（浏览器不支持或空间不足） Slot could not be saved'); }
    };
    if (immediate) return doSave(); slotSaveT[i] = setTimeout(doSave, 600);
  }
  async function restoreSlots() {
    let rows; try { rows = await idb.all(); } catch (e) { return; }
    let n = 0;
    for (const [k, r] of rows) {
      const sl = state.slots[k]; if (!sl || !r || !r.data) continue;
      try {
        const buf = engine.ctx.createBuffer(r.ch, r.len, r.sr); for (let c = 0; c < r.ch; c++) buf.copyToChannel(new Float32Array(r.data[c]), c);
        sl.buffer = buf; sl.name = r.name || ('槽 ' + (k + 1)); sl.loop = !!r.loop; sl.gain = r.gain == null ? 0.8 : r.gain; sl.rate = r.rate || 1; sl.saved = true;
        sl.loopBtn.classList.toggle('on', sl.loop); sl.gainEl.value = sl.gain; sl.rateEl.value = sl.rate; n++;
      } catch (e) { console.warn('slot restore failed', k, e); }
    }
    state.recTarget = nextFreeSlot(); renderSlots();
    if (n) toast('已从本地恢复 ' + n + ' 个声音槽 · ' + n + ' slots restored');
  }
  const userPresets = () => store.get(USER_KEY, []);
  const allPresets = () => S.PRESETS.concat(userPresets());
  function loadPreset(i, silent) {
    const all = allPresets(); const pr = all[((i % all.length) + all.length) % all.length]; state.presetIdx = all.indexOf(pr);
    const patch = S.defaults(); Object.assign(patch, pr.patch);
    const mods = (pr.user ? (pr.mods || []) : S.DEFAULT_MODS.concat(pr.mods || [])).map((m) => (Array.isArray(m) ? { src: m[0], dst: m[1], amt: m[2] } : m));
    state.acousticCard = null; applySnapshot({ patch, mods }); $('#preset-title').textContent = pr.name; renderPresetList(); pushUndo(); logAction('preset ' + pr.name); if (!silent) toast('预设：' + pr.name);
  }
  function saveUserPreset() {
    const name = prompt('给这个音色起个名字：', state.presetIdx >= 0 ? allPresets()[state.presetIdx].name + ' · 改' : '我的音色'); if (!name) return;
    const d = S.defaults(); const diff = {}; for (const k in state.patch) if (state.patch[k] !== d[k]) diff[k] = state.patch[k];
    const list = userPresets().filter((p) => p.name !== name); list.push({ name, user: true, tags: ['我的', S.PARAM_MAP.inst.options.find((o) => o[0] === state.patch.inst)[1]], patch: diff, mods: state.mods.map((m) => [m.src, m.dst, +m.amt.toFixed(2)]) });
    store.set(USER_KEY, list); state.presetIdx = allPresets().findIndex((p) => p.name === name && p.user); $('#preset-title').textContent = name; renderPresetList(); buildPalette(); toast('已保存到我的预设：' + name);
  }
  function deleteUserPreset(name) { store.set(USER_KEY, userPresets().filter((p) => p.name !== name)); renderPresetList(); buildPalette(); toast('已删除：' + name); }
  function renderPresetList() {
    const l = $('#preset-list'); l.innerHTML = ''; const all = allPresets(); let sec = '';
    all.forEach((p, i) => {
      const s2 = p.user ? '我的预设 (保存在此浏览器)' : '出厂预设'; if (s2 !== sec) { sec = s2; l.appendChild(UI.el('div', 'sec', sec)); }
      const d = UI.el('div', 'pi' + (i === state.presetIdx ? ' cur' : '') + (p.user ? ' user' : ''), '<span>' + p.name + '</span><span class="tags">' + p.tags.join(' · ') + '</span>');
      if (p.user) { const x = UI.el('button', 'del', '✕'); x.title = '删除'; x.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('删除预设「' + p.name + '」？')) deleteUserPreset(p.name); }); d.appendChild(x); }
      d.addEventListener('click', () => { loadPreset(i); l.classList.remove('open'); }); l.appendChild(d);
    });
  }
  function renderPatchJSON() { if (!patchTA) return; const d = S.defaults(); const diff = {}; for (const k in state.patch) if (state.patch[k] !== d[k]) diff[k] = state.patch[k]; patchTA.value = JSON.stringify({ name: state.presetIdx >= 0 && allPresets()[state.presetIdx] ? allPresets()[state.presetIdx].name : '自定义', patch: diff, mods: state.mods.map((m) => [m.src, m.dst, +m.amt.toFixed(2)]) }, null, 1); }
  function applyPatchJSON() { try { const o = JSON.parse(patchTA.value); const patch = S.defaults(); Object.assign(patch, o.patch || {}); const mods = (o.mods || []).map((m) => Array.isArray(m) ? { src: m[0], dst: m[1], amt: m[2] } : m); applySnapshot({ patch, mods }); pushUndo(); toast('已应用 JSON'); } catch (e) { toast('JSON 解析失败: ' + e.message); } }

  /* ================= 惊喜随机化 ================= */
  function surprise() {
    logAction('surprise'); pushUndo();
    const wild = real('rnd.wild'); const src = real('rnd.source'); const used = new Set(); let count = 0;
    for (const p of S.PARAMS) {
      if (p.noRnd || state.locks.has(p.id) || p.target === 'host' && !/^(lfo|rnd\.wild)/.test(p.id)) continue;
      if (p.id === 'inst') { if (wild > 0.6 && bus.draw(src)[0] < 0.35) { const opts = p.options; setParam('inst', opts[Math.floor(bus.draw(src)[0] * opts.length)][0], { noRebuild: true }); count++; } continue; }
      if (p.id === 'vn.on') { if (bus.draw(src)[0] < wild * 0.5) { setParam('vn.on', real('vn.on') ? 0 : 1); count++; } continue; }
      if (p.type === 'select') { if (bus.draw(src)[0] < wild * 0.6) { setParam(p.id, p.options[Math.floor(bus.draw(src)[0] * p.options.length)][0]); count++; } continue; }
      if (p.type === 'toggle') { if (bus.draw(src)[0] < wild * 0.4) { setParam(p.id, real(p.id) ? 0 : 1); count++; } continue; }
      if (p.group === 'macro') continue;
      const [r, s] = bus.draw(src); used.add(s);
      const lo = p.rnd ? p.rnd[0] : 0, hi = p.rnd ? p.rnd[1] : 1; const target = lo + r * (hi - lo);
      const cur = normOf(p.id); const n = cur + (target - cur) * Math.min(1, wild * 1.3);
      setParam(p.id, S.denorm(p, n)); count++;
    }
    buildInstPanel(); pushUndo(); toast('惊喜！改动了 ' + count + ' 个参数 · 随机来自 ' + Array.from(used).join('/'));
  }

  /* ================= 代码 API ================= */
  function codeAPI() {
    const api = {
      note: (n, vel, dur, when) => { const m = S.parseNote(n); if (m == null) return; sched.playAt(m, vel == null ? 0.8 : vel, dur == null ? 0.5 : dur, when); },
      off: (n) => engine.noteOff(S.parseNote(n)),
      set: (id, v) => { if (!S.PARAM_MAP[id]) throw new Error('未知参数 ' + id); setParam(id, v); },
      get: (id) => real(id),
      every: (beats, fn) => sched.every(beats, fn),
      seq: (str, step, opts) => { const toks = String(str).match(/\[[^\]]*\]|\S+/g) || []; step = step || 0.25; const vel = (opts && opts.vel) || 0.8, dur = (opts && opts.dur) || step * 0.8; return sched.every(step, (t, i) => { const tok = toks[i % toks.length]; if (tok === '.' || tok === '~') return; const notes = tok.startsWith('[') ? tok.slice(1, -1).split(/\s+/) : [tok]; for (const nn of notes) { const m = S.parseNote(nn); if (m != null) sched.playAt(m, vel, dur * sched.spb, t); } }); },
      stop: (id) => sched.clear(id), stopAll: () => { sched.clearAll(); engine.allOff(); },
      bpm: (v) => { if (v != null) setParam('bpm', v); return real('bpm'); },
      inst: (name) => setParam('inst', name), venom: (on) => setParam('vn.on', on ? 1 : 0),
      preset: (name) => { const i = S.PRESETS.findIndex((p) => p.name.includes(name)); if (i >= 0) loadPreset(i); },
      rnd: () => bus.draw('crypto')[0], pi: (i) => (i == null ? bus.pi.next() : bus.pi.digit(i)), c14: () => bus.c14.next(),
      onDecay: (fn) => { decayHooks.push(fn); }, mod: (src, dst, amt) => { addMod(src, dst, amt == null ? 0.5 : amt); pushUndo(); }, unmod: (dst) => { state.mods = dst ? state.mods.filter((m) => m.dst !== dst) : []; rebuildModIndex(); },
      scale: (name) => (S.SCALES[name] || S.SCALES.penta).slice(), refresh: () => bus.refresh(), surprise, log: (...a) => codeConsole.log(...a),
    };
    return api;
  }
  const decayHooks = []; const _origDecay = bus.onDecay; bus.onDecay = (k, v) => { _origDecay(k, v); for (const f of decayHooks.slice()) { try { f(k, v); } catch (e) { codeConsole && codeConsole.log('✖ onDecay: ' + e.message); decayHooks.splice(decayHooks.indexOf(f), 1); } } };

  /* ================= 界面杂项 ================= */
  let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  function setVenomUI(on) {
    const was = document.body.classList.contains('venom');
    document.body.classList.toggle('venom', on); $('#btn-venom').classList.toggle('on', on); document.querySelectorAll('.veins-light').forEach((e) => e.classList.toggle('hidden', on)); document.querySelectorAll('.veins-dark').forEach((e) => e.classList.toggle('hidden', !on));
    if (on && !was && !store.get('shisui.venomSeen', false)) { store.set('shisui.venomSeen', true); openVenomIntro(); }
  }
  function openVenomIntro() { $('#venom-intro').classList.add('open'); }
  function setPlain(on) { document.body.classList.toggle('plain', on); $('#btn-plain').classList.toggle('on', on); store.set('shisui.plain', on); logAction('plain ' + on); }
  function buildReport() {
    const d = S.defaults(); const diff = {}; for (const k in state.patch) if (state.patch[k] !== d[k]) diff[k] = state.patch[k];
    const ctx = engine.ctx || {};
    return {
      app: '石髓 SHISUI', version: root.SHISUI.VERSION || 'dev', url: location.href, time: new Date().toISOString(),
      description: $('#rep-desc').value.trim(), expectation: $('#rep-expect').value.trim(), steps: $('#rep-steps').value.trim(),
      state: { preset: $('#preset-title').textContent, inst: state.patch.inst, mode: state.mode, venom: !!state.patch['vn.on'], lang: UI.lang, plain: document.body.classList.contains('plain'), recording: !!engine.recording, slots: state.slots.filter((x) => x.buffer).length, mods: state.mods.map((m) => m.src + '→' + m.dst + '×' + m.amt.toFixed(2)), arp: state.patch['arp.mode'], rndSource: state.patch['rnd.source'], decayPaused: bus.paused, c14: { N: Math.round(bus.c14.N), N0: bus.c14.N0, rate: +bus.c14.ratePerSec.toFixed(2) } },
      env: { ua: navigator.userAgent, sampleRate: ctx.sampleRate, ctxState: ctx.state, latencyMs: ctx.baseLatency != null ? Math.round((ctx.baseLatency + (ctx.outputLatency || 0)) * 1000) : null, screen: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, midi: engine.midiName || '', marbleMs: S.marble && S.marble.ms },
      errors: diag.errors.slice(-12), actions: diag.actions.slice(-40), patch: diff,
    };
  }
  function reportMarkdown(r) {
    const errs = r.errors.length ? r.errors.map((e) => '- `' + e.t + '` **' + e.kind + '** ' + e.msg + (e.extra ? '\n  ' + e.extra : '')).join('\n') : '（无错误记录 · no errors captured）';
    return [
      '## 问题描述 · Description', r.description || '_（用户未填写 · 待 AI 分析：请根据下面的错误与操作记录推断问题）_', '',
      '## 当时想做什么 · Expectation', r.expectation || '_未填写_', '',
      '## 复现步骤 · Steps', r.steps || '_未填写_', '',
      '## 最近错误 · Recent errors', errs, '',
      '## 软件当时在做什么 · Recent actions', '```', r.actions.join('\n') || '(none)', '```', '',
      '## 状态 · State', '```json', JSON.stringify(r.state, null, 1), '```', '',
      '## 环境 · Environment', '```json', JSON.stringify(r.env, null, 1), '```', '',
      '## 音色差量 · Patch diff', '```json', JSON.stringify(r.patch), '```', '',
      '_由页内"报错"按钮生成 · ' + r.time + ' · ' + r.url + '_',
    ].join('\n');
  }
  function openReport() { $('#report').classList.add('open'); $('#rep-preview').textContent = reportMarkdown(buildReport()); setTimeout(() => $('#rep-desc').focus(), 50); }
  function submitReport() {
    const r = buildReport(); const md = reportMarkdown(r);
    const title = (r.description ? r.description.split('\n')[0].slice(0, 70) : '[自动 · 待 AI 分析] ' + (r.errors.length ? r.errors[r.errors.length - 1].msg.slice(0, 60) : '用户反馈 ' + new Date().toLocaleString()));
    let body = md; const max = 6500; if (body.length > max) body = body.slice(0, max) + '\n\n_（报告已截断，完整 JSON 请用"下载 JSON"附上）_';
    const url = 'https://github.com/majmanx/SHISUI1/issues/new?labels=bug-report&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    try { if (navigator.clipboard) navigator.clipboard.writeText(md).catch(() => {}); } catch (e) { /* 忽略 */ }
    logAction('report submitted'); const w = root.open(url, '_blank'); if (!w) toast('浏览器拦截了新窗口，报告已复制到剪贴板 · Popup blocked; report copied');
  }
  function copyReport() { const md = reportMarkdown(buildReport()); const ta = document.createElement('textarea'); ta.value = md; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('报告已复制 · Copied'); } catch (e) { toast('复制失败'); } ta.remove(); }
  function downloadReport() { const r = buildReport(); const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shisui-report-' + Date.now() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  function setLang(mode) { UI.applyLang(mode); document.querySelectorAll('#lang-toggle button').forEach((b) => b.classList.toggle('on', b.dataset.lang === mode)); store.set('shisui.lang', mode); }
  function setMode(m) { logAction('mode ' + m); state.mode = m; document.body.classList.remove('mode-play', 'mode-shape', 'mode-deep'); document.body.classList.add('mode-' + m); document.querySelectorAll('.mode-tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m)); }
  let vuPeak = 0; function drawVU() { const cv = $('#vu'); const ctx = cv.getContext('2d'); const W = cv.width = 90, H = cv.height = 26; const td = new Float32Array(engine.analyser.fftSize); engine.analyser.getFloatTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) s += td[i] * td[i]; const rms = Math.sqrt(s / td.length); const db = 20 * Math.log10(rms + 1e-6); const x = Math.max(0, Math.min(1, (db + 48) / 48)); vuPeak = Math.max(x, vuPeak * 0.96); ctx.clearRect(0, 0, W, H); const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#7fbf5a'); g.addColorStop(0.7, '#e8c15a'); g.addColorStop(1, '#ff5a3c'); ctx.fillStyle = g; ctx.fillRect(2, 6, (W - 4) * x, H - 12); ctx.fillStyle = '#fff'; ctx.fillRect(2 + (W - 4) * vuPeak - 1, 4, 2, H - 8); }
  function buildPalette() {
    const entries = [];
    for (const p of S.PARAMS) entries.push({ kind: '参数', label: p.label, en: p.en + ' ' + p.id, abbr: S.GROUPS[p.group] || '', act: () => { const c = controls[p.id]; if (!c) return; if (!c.el.offsetParent) setMode('deep'); setTimeout(() => c.flash(), 50); info(p); } });
    allPresets().forEach((pr, i) => entries.push({ kind: pr.user ? '我的预设' : '预设', label: pr.name, en: pr.tags.join(' '), act: () => loadPreset(i) }));
    for (const [id, , name, en] of INST_TILES) entries.push({ kind: '乐器', label: name, en, act: () => setParam('inst', id, { commit: true }) });
    const acts = [['毒液模式 切换', 'venom toggle', () => setParam('vn.on', real('vn.on') ? 0 : 1, { commit: true })], ['惊喜 随机化音色', 'surprise randomize', surprise], ['刷新随机接口', 'refresh random', () => bus.refresh()], ['模式：玩', 'mode play', () => setMode('play')], ['模式：塑', 'mode shape', () => setMode('shape')], ['模式：深', 'mode deep', () => setMode('deep')], ['帮助', 'help', () => $('#help').classList.add('open')], ['全部静音', 'panic all notes off', () => engine.panic()], ['撤销', 'undo', undo], ['重做', 'redo', redo], ['A/B 切换', 'ab compare', abToggle], ['低动效（省电）切换', 'low motion', () => document.body.classList.toggle('low-motion')], ['存为我的预设', 'save preset', saveUserPreset], ['毒液模式玩法引导', 'venom guide', openVenomIntro], ['报错 / 反馈', 'report bug feedback', openReport], ['原声：恢复当前乐器的真实音色', 'acoustic natural', acousticNow], ['全部重置（两次确认）', 'reset everything factory', resetEverything], ['素面切换', 'plain toggle', () => setPlain(!document.body.classList.contains('plain'))], ['暂停 / 继续 碳-14 衰变', 'pause decay', () => setDecayPaused(!bus.paused)], ['停止全部随机', 'stop random', stopRandom], ['复位随机接口', 'reset random ports', resetRandom], ['断开随机接线', 'unroute random', unrouteRandom], ['语言：双语', 'language both', () => setLang('both')], ['语言：中文', 'language chinese', () => setLang('zh')], ['Language: English', 'language english', () => setLang('en')], ['录音 开始/停止', 'record', toggleRecord], ['停止所有声音槽', 'stop slots', () => { engine.stopAllSlots(); }]];
    for (const [l, e, f] of acts) entries.push({ kind: '动作', label: l, en: e, act: f });
    if (!palette) palette = new UI.Palette($('#palette'), { onPick: (e) => e.act() }); palette.setEntries(entries);
  }
  function bindUI() {
    $('#preset-prev').addEventListener('click', () => loadPreset(state.presetIdx - 1));
    $('#preset-next').addEventListener('click', () => loadPreset(state.presetIdx + 1));
    $('#preset-name').addEventListener('click', (e) => { e.stopPropagation(); $('#preset-list').classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.preset-nav')) $('#preset-list').classList.remove('open'); });
    $('#btn-search').addEventListener('click', () => palette.open());
    document.querySelectorAll('.mode-tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('#btn-surprise').addEventListener('click', surprise); $('#btn-undo').addEventListener('click', undo); $('#btn-redo').addEventListener('click', redo); $('#btn-ab').addEventListener('click', abToggle);
    $('#btn-venom').addEventListener('click', () => setParam('vn.on', real('vn.on') ? 0 : 1, { commit: true }));
    $('#btn-help').addEventListener('click', () => $('#help').classList.add('open')); $('#help-close').addEventListener('click', () => $('#help').classList.remove('open'));
    $('#btn-venom-help').addEventListener('click', openVenomIntro); $('#venom-intro-close').addEventListener('click', () => $('#venom-intro').classList.remove('open'));
    $('#venom-intro').addEventListener('click', (e) => { if (e.target.id === 'venom-intro') $('#venom-intro').classList.remove('open'); });
    $('#venom-take-me').addEventListener('click', () => { $('#venom-intro').classList.remove('open'); const i = allPresets().findIndex((p) => p.name.startsWith('毒液胡')); if (i >= 0) loadPreset(i); setMode('shape'); setTimeout(() => { const c = controls['vn.amt']; if (c) c.flash(); toast('按住一个低音键 3 秒，再慢慢转"毒液量" · Hold a low note, then turn Venom amount'); }, 400); });
    $('#venom-preset-bass').addEventListener('click', () => { $('#venom-intro').classList.remove('open'); const i = allPresets().findIndex((p) => p.name.startsWith('毒液低音')); if (i >= 0) loadPreset(i); setMode('shape'); });
    document.querySelectorAll('#lang-toggle button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('#btn-plain').addEventListener('click', () => setPlain(!document.body.classList.contains('plain'))); setPlain(!!store.get('shisui.plain', false));

    $('#btn-report').addEventListener('click', openReport); $('#report-close').addEventListener('click', () => $('#report').classList.remove('open'));
    $('#report').addEventListener('click', (e) => { if (e.target.id === 'report') $('#report').classList.remove('open'); });
    $('#rep-submit').addEventListener('click', submitReport); $('#rep-copy').addEventListener('click', copyReport); $('#rep-download').addEventListener('click', downloadReport);
    ['rep-desc', 'rep-expect', 'rep-steps'].forEach((id) => { const el = $('#' + id); el.addEventListener('input', () => { $('#rep-preview').textContent = reportMarkdown(buildReport()); }); el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('keyup', (e) => e.stopPropagation()); });
    setLang(store.get('shisui.lang', 'both'));
    $('#help').addEventListener('click', (e) => { if (e.target.id === 'help') $('#help').classList.remove('open'); });
    $('#btn-panic').addEventListener('click', () => { engine.panic(); if (sched) { sched.clearAll(); sched.held = []; } toast('全部静音'); });
    $('#oct-down').addEventListener('click', () => setOctave(state.octave - 1)); $('#oct-up').addEventListener('click', () => setOctave(state.octave + 1));
    keyboard = new UI.Keyboard($('#keyboard'), { onNote: (n, v) => noteOn(n, v), onOff: (n) => noteOff(n) });
    setOctave(0);
    const heldKeys = new Set();
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase(); const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.toggle(); return; }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { if (state.armed) { disarm(); return; } if (palette.c.classList.contains('open')) { palette.close(); return; } if ($('#help').classList.contains('open')) { $('#help').classList.remove('open'); return; } if ($('#venom-intro').classList.contains('open')) { $('#venom-intro').classList.remove('open'); return; } if ($('#report').classList.contains('open')) { $('#report').classList.remove('open'); return; } const now = Date.now(); if (now - state.escAt < 500) { engine.panic(); toast('全部静音'); } state.escAt = now; return; }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); bus.refresh(); pulseOrbs(); return; }
      if (k === 'r' && e.shiftKey) { toggleRecord(); return; }
      if (k === ',') { setOctave(state.octave - 1); return; } if (k === '.') { setOctave(state.octave + 1); return; }
      if (k in KEYMAP) { e.preventDefault(); const n = 48 + 12 * state.octave + KEYMAP[k]; heldKeys.add(k); keyboard.press(n, 0.8, 'kbd'); }
    });
    document.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (heldKeys.has(k)) { heldKeys.delete(k); keyboard.release(48 + 12 * state.octave + KEYMAP[k], 'kbd'); } });
    window.addEventListener('blur', () => { for (const k of heldKeys) keyboard.release(48 + 12 * state.octave + KEYMAP[k], 'kbd'); heldKeys.clear(); });
    engine.onMidi = (type, a, b) => { if (type === 'on') keyboard.press(a, b, 'midi'); else if (type === 'off') keyboard.release(a, 'midi'); else if (type === 'cc') { if (a === 1) state.wheel = b; else if (a === 64) setSustain(b >= 0.5); else if (a === 74) setParam('flt.cutoff', S.denorm(S.PARAM_MAP['flt.cutoff'], b)); } else if (type === 'bend') { engine.P.bend = a * 2; engine.dirtyP = true; } };
    $('#btn-save').addEventListener('click', saveUserPreset);
    window.addEventListener('beforeunload', () => { if (state.slots.some((x) => x.buffer)) return; });
    engine.onMidiState = (name) => { $('#midi-dot').classList.toggle('on', !!name); $('#midi-name').textContent = name ? name.slice(0, 22) : 'MIDI'; };
    document.addEventListener('pointerdown', () => engine.resume(), { passive: true });
    setInterval(() => { const el = $('#cpu'); if (engine.ctx && engine.ctx.baseLatency != null) el.textContent = Math.round(engine.ctx.sampleRate / 1000) + 'k · ' + Math.round((engine.ctx.baseLatency + (engine.ctx.outputLatency || 0)) * 1000) + 'ms'; }, 2000);
  }

  /* ================= 启动 ================= */
  async function boot() {
    const btn = $('#enter'); btn.disabled = true; btn.textContent = '点石成金…';
    try { await engine.init(); await engine.resume(); }
    catch (e) { $('#splash-err').textContent = '无法启动音频：' + (e.message || e); btn.disabled = false; btn.textContent = '重试'; return; }
    sched = new S.Scheduler(engine); sched.piDigit = (i) => bus.pi.digit(i);
    sched.onArpNote = (n, on) => keyboard.light(n, on);
    buildPanels(); buildPalette(); bindUI();
    for (const p of S.PARAMS) { engine.apply(p.id, state.patch[p.id]); hostApply(p.id, state.patch[p.id]); }
    bus.refresh(); loadPreset(0, true); restoreSlots();
    const last = store.get(LAST_KEY, null);
    if (last && last.snap && last.snap.patch) { try { applySnapshot(last.snap); state.presetIdx = last.presetIdx; $('#preset-title').textContent = last.name || '上次的音色'; renderPresetList(); setTimeout(() => toast('已恢复上次的音色'), 2600); } catch (e) { /* 忽略损坏的存档 */ } }
    state.undo = [JSON.stringify(snapshot())];
    $('#splash').classList.add('hide'); $('#app').classList.add('on');
    requestAnimationFrame(loop);
    setTimeout(() => toast('欢迎。先转四个宏旋钮，按 Z X C V 弹奏，Shift+R 录音，空格刷新随机接口。'), 600);
    setInterval(() => { if (sched && arpChip) arpChip.textContent = real('arp.mode') === 'off' ? '' : '琶音中 Arp · 按住琴键 hold keys · ' + sched.held.length; }, 500);
  }
  $('#enter').addEventListener('click', boot);
  root.SHISUI.VERSION = '0.4.0';
  root.SHISUI.app = { state, engine, bus, setParam, loadPreset, surprise, diag, buildReport, setDecayPaused, stopRandom, setPlain, get sched() { return sched; } };
})(window);
