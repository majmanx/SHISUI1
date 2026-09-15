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
  const engine = new S.Engine(); const bus = new S.RandomBus();
  let sched = null, controls = {}, modIndex = {}, keyboard, xyPad, scope, palette, codeConsole;
  let instBody, modListEl, orbEls = [], rndViewEl, geigerLed, geigerCv, c14StatsEl, srcChipEls = {}, patchTA, arpChip;
  const KEYMAP = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24, 9: 25, o: 26, 0: 27, p: 28, '[': 29, '=': 30, ']': 31 };
  const KEYHINT = {}; for (const k in KEYMAP) KEYHINT[KEYMAP[k]] = k.toUpperCase();
  const USER_KEY = 'shisui.userPresets', LAST_KEY = 'shisui.last';
  const INST_TILES = [['guzheng', '筝', '古筝', 'GUZHENG'], ['erhu', '胡', '二胡', 'ERHU'], ['dizi', '笛', '竹笛', 'DIZI'], ['guan', '管', '管子·唢呐', 'GUAN'], ['strings', '弦', '弦乐群', 'STRINGS']];
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
    if (!modIndex[id]) { engine.apply(id, v); hostApply(id, v); }
    const c = controls[id]; if (c && !opts.fromControl) { if (c instanceof UI.Knob) c.set(S.norm(p, v), true); else c.set(v); }
    if (id === 'inst' && !opts.noRebuild) buildInstPanel();
    if (id === 'vn.on') setVenomUI(!!v);
    if (opts.commit) pushUndo();
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
      const p = S.PARAM_MAP[id]; let n = normOf(id); for (const m of modIndex[id]) n += m.amt * (src[m.src] || 0); n = n < 0 ? 0 : n > 1 ? 1 : n;
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
  function info(spec) { const bar = $('#info-bar'); if (!spec) { bar.innerHTML = ''; return; } bar.innerHTML = '<b>' + spec.label + '</b> ' + (spec.tip || '') + ' <span class="small">' + spec.en + (spec.id ? ' · ' + spec.id : '') + '</span>'; }
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
    const xyWrap = UI.el('div'); const xyEl = UI.el('div', 'xy'); xyWrap.appendChild(xyEl); xyWrap.appendChild(UI.el('div', 'xy-labels', '<span>← X 源 →</span><span>↑ Y 源 (点接口再点旋钮可接线)</span>'));
    pm.body.appendChild(xyWrap); main.appendChild(pm);
    xyPad = new UI.XYPad(xyEl, (x, y) => { state.xy = [x, y]; });
    xyEl.title = 'XY 板：X / Y 是两个调制源。在"深"模式的调制矩阵或用芯片把它们接到任何旋钮。';
    /* --- 示波器 --- */
    const ps = UI.panel('p-scope', '石窗', 'SCOPE · 波形 / 频谱', 1, 'col-4');
    const sw = UI.el('div', 'scope-wrap'); const cv = document.createElement('canvas'); sw.appendChild(cv); ps.body.appendChild(sw);
    ps.body.appendChild(UI.row([K('master.vol'), K('comp.amount'), K('flt.cutoff'), K('rev.mix')]));
    arpChip = UI.el('div', 'small', '');
    const ga = UI.group('琶音 · 走带', [K('bpm'), K('arp.mode'), K('arp.rate'), K('arp.oct'), K('arp.gate')], 'lvl2-inline');
    ga.appendChild(UI.row([UI.btn('■ 停止全部', 'sm', () => { if (sched) { sched.clearAll(); sched.held = []; } engine.allOff(); }, '停止代码任务与琶音'), arpChip]));
    ps.body.appendChild(ga);
    main.appendChild(ps); scope = new UI.Scope(cv, engine.analyser);
    /* --- 随机接口 --- */
    const pr = UI.panel('p-random', '随机接口', 'RANDOM BAY · crypto / π / C-14', 1, 'col-4');
    const chips = UI.el('div', 'src-chips'); const srcSpec = S.PARAM_MAP['rnd.source'];
    for (const o of srcSpec.options) { const ch = UI.el('div', 'chip', o[1]); ch.title = '选择随机源'; ch.addEventListener('click', () => setParam('rnd.source', o[0], { commit: true })); chips.appendChild(ch); srcChipEls[o[0]] = ch; }
    pr.body.appendChild(chips);
    const orbs = UI.el('div', 'orbs'); orbEls = [];
    for (let i = 0; i < 4; i++) { const o = UI.el('div', 'orb', '<div class="orb-ball"><div class="orb-fill"></div></div><div class="orb-name">R' + (i + 1) + '</div><div class="orb-val">0.500</div><div class="orb-src">—</div>'); o.title = '接口 R' + (i + 1) + '：点我，再点任意旋钮 → 接线调制'; o.addEventListener('click', () => arm('R' + (i + 1))); orbs.appendChild(o); orbEls.push(o); }
    pr.body.appendChild(orbs);
    rndViewEl = UI.el('div', 'rnd-view'); pr.body.appendChild(rndViewEl);
    const rb = UI.btn('⟳ 刷新 (空格)', 'gold', () => { bus.refresh(); pulseOrbs(); }, '从当前随机源取 4 个新数给 R1–R4');
    pr.body.appendChild(UI.row([rb, K('rnd.rate'), K('rnd.slew'), K('rnd.wild'), UI.btn('🎲 惊喜', '', surprise, '随机化整套音色（跳过锁定的旋钮）')]));
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
    jsonEl.appendChild(UI.el('div', 'grp-title', '音色 JSON（可编辑后应用 / 复制分享）')); jsonEl.appendChild(patchTA);
    jsonEl.appendChild(UI.row([UI.btn('应用 JSON', 'gold', applyPatchJSON), UI.btn('复制', '', () => { patchTA.select(); document.execCommand('copy'); toast('已复制音色 JSON'); }), UI.btn('刷新显示', '', renderPatchJSON)]));
    wrap.appendChild(codeEl); wrap.appendChild(jsonEl); pc.body.appendChild(wrap); main.appendChild(pc);
    codeConsole = new S.CodeConsole(codeEl, codeAPI());
    /* --- 录音 · 声音槽 --- */
    const prc = UI.panel('p-rec', '录音 · 声音槽', 'RECORD · 8 SLOTS · 叠录混合', 1, 'col-12');
    const bar = UI.el('div', 'rec-bar');
    recBtn = UI.el('button', 'btn rec-btn', '<span class="rec-led"></span><span>● 录音</span>'); recBtn.title = '录下你听到的一切（含效果与正在播放的槽），停止后进入下一个空槽。快捷键 Shift+R'; recBtn.addEventListener('click', toggleRecord);
    recTimeEl = UI.el('span', 'rec-time', '00:00.0');
    const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'audio/*'; fileIn.multiple = true; fileIn.style.display = 'none';
    fileIn.addEventListener('change', async () => { for (const f of Array.from(fileIn.files)) { try { const buf = await engine.decodeFile(f); putSlot(nextFreeSlot(), buf, f.name.replace(/\.[^.]+$/, '')); } catch (e) { toast('无法解码 ' + f.name); } } fileIn.value = ''; });
    const slotFxT = UI.el('button', 'toggle', '<span class="tg-led"></span><span class="tg-label">槽过效果链</span>'); slotFxT.title = '打开：槽的声音经过滤波/放大/效果；关闭：直入总线（干净回放）'; slotFxT.addEventListener('click', () => { state.slotFx = !state.slotFx; slotFxT.classList.toggle('on', state.slotFx); });
    bar.appendChild(recBtn); bar.appendChild(recTimeEl);
    bar.appendChild(UI.btn('⬇ 导出上次录音', 'gold', () => { const sl = state.slots[state.lastRecSlot]; if (sl && sl.buffer) exportSlot(state.lastRecSlot); else toast('还没有录音'); }, '把最近一次录音导出为 WAV'));
    bar.appendChild(UI.btn('📂 导入音频到槽', '', () => fileIn.click(), '把 wav/mp3/ogg 放进一个槽，用来混合创作'));
    bar.appendChild(slotFxT); bar.appendChild(UI.btn('■ 停止所有槽', '', () => engine.stopAllSlots()));
    bar.appendChild(UI.el('span', 'small', '提示：让几个槽循环播放，再弹奏并录音 = 叠录出新的音色素材。槽只在内存里，想留就导出 WAV。'));
    bar.appendChild(fileIn); prc.body.appendChild(bar);
    const grid = UI.el('div', 'slots'); state.slots = [];
    for (let i = 0; i < 8; i++) {
      const sl = { i, buffer: null, name: '', loop: false, gain: 0.8, rate: 1, voice: null, el: null, cv: null };
      const el = UI.el('div', 'slot empty'); const head = UI.el('div', 'slot-head', '<span class="slot-name">槽 ' + (i + 1) + '</span><span class="slot-len">空</span>'); el.appendChild(head);
      const cv = document.createElement('canvas'); cv.title = '点击：录到这个槽'; cv.addEventListener('click', () => { state.recTarget = i; renderSlots(); toast('下一次录音进入槽 ' + (i + 1)); }); el.appendChild(cv);
      const ctl = UI.el('div', 'slot-ctl');
      const play = UI.btn('▶', '', () => toggleSlot(i), '播放 / 停止'); const loop = UI.btn('循环', '', () => { sl.loop = !sl.loop; loop.classList.toggle('on', sl.loop); if (sl.voice) sl.voice.src.loop = sl.loop; }, '循环播放');
      const exp = UI.btn('⬇', '', () => exportSlot(i), '导出 WAV'); const clr = UI.btn('✕', 'danger', () => { stopSlot(i); sl.buffer = null; sl.name = ''; renderSlots(); }, '清空');
      ctl.appendChild(play); ctl.appendChild(loop); ctl.appendChild(exp); ctl.appendChild(clr);
      const gl = UI.el('label', '', '音量'); const g = document.createElement('input'); g.type = 'range'; g.min = 0; g.max = 1.5; g.step = 0.01; g.value = sl.gain; g.addEventListener('input', () => { sl.gain = +g.value; if (sl.voice) sl.voice.gain.gain.setTargetAtTime(sl.gain, engine.ctx.currentTime, 0.01); }); gl.appendChild(g);
      const rl = UI.el('label', '', '速度'); const r = document.createElement('input'); r.type = 'range'; r.min = 0.25; r.max = 2; r.step = 0.01; r.value = 1; r.title = '播放速度（连带变调）'; r.addEventListener('input', () => { sl.rate = +r.value; if (sl.voice) sl.voice.src.playbackRate.setTargetAtTime(sl.rate, engine.ctx.currentTime, 0.01); }); r.addEventListener('dblclick', () => { r.value = 1; sl.rate = 1; if (sl.voice) sl.voice.src.playbackRate.value = 1; }); rl.appendChild(r);
      ctl.appendChild(gl); ctl.appendChild(rl); el.appendChild(ctl);
      sl.el = el; sl.cv = cv; sl.playBtn = play; state.slots.push(sl); grid.appendChild(el);
    }
    prc.body.appendChild(grid); main.appendChild(prc); renderSlots();
    renderModList(); updateSrcChips();
  }
  let recBtn, recTimeEl;
  const nextFreeSlot = () => { const f = state.slots.findIndex((s) => !s.buffer); return f >= 0 ? f : state.recTarget; };
  async function toggleRecord() {
    if (!engine.recording) { engine.startRecording(); recBtn.classList.add('on'); recBtn.querySelector('span:last-child').textContent = '■ 停止'; state.recTarget = state.slots[state.recTarget] && !state.slots[state.recTarget].buffer ? state.recTarget : nextFreeSlot(); renderSlots(); toast('录音中 → 槽 ' + (state.recTarget + 1)); return; }
    const buf = await engine.stopRecording(); recBtn.classList.remove('on'); recBtn.querySelector('span:last-child').textContent = '● 录音'; recTimeEl.textContent = '00:00.0';
    if (!buf) { toast('录音太短'); return; }
    putSlot(state.recTarget, buf, '录音 ' + new Date().toLocaleTimeString()); state.lastRecSlot = state.recTarget; state.recTarget = nextFreeSlot(); renderSlots();
  }
  function putSlot(i, buf, name) { const sl = state.slots[i]; stopSlot(i); sl.buffer = buf; sl.name = name; renderSlots(); toast('槽 ' + (i + 1) + '：' + name + ' · ' + buf.duration.toFixed(1) + ' s'); }
  function toggleSlot(i) { const sl = state.slots[i]; if (sl.voice && !sl.voice.done) { stopSlot(i); return; } if (!sl.buffer) { toast('槽 ' + (i + 1) + ' 是空的：录一段或导入音频'); return; } sl.voice = engine.playBuffer(sl.buffer, { loop: sl.loop, gain: sl.gain, rate: sl.rate, fx: state.slotFx, onEnd: () => { sl.voice = null; renderSlots(); } }); renderSlots(); }
  function stopSlot(i) { const sl = state.slots[i]; if (sl.voice) { sl.voice.stop(); sl.voice = null; } renderSlots(); }
  function exportSlot(i) { const sl = state.slots[i]; if (!sl.buffer) return; const blob = S.Engine.encodeWav(sl.buffer); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const ts = new Date(); a.download = 'shisui-slot' + (i + 1) + '-' + [ts.getHours(), ts.getMinutes(), ts.getSeconds()].map((x) => String(x).padStart(2, '0')).join('') + '.wav'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('已导出 WAV：' + a.download); }
  function renderSlots() {
    state.slots.forEach((sl, i) => {
      sl.el.classList.toggle('empty', !sl.buffer); sl.el.classList.toggle('target', i === state.recTarget); sl.el.classList.toggle('playing', !!(sl.voice && !sl.voice.done));
      sl.el.querySelector('.slot-len').textContent = sl.buffer ? sl.buffer.duration.toFixed(1) + ' s' : '空'; sl.el.querySelector('.slot-name').textContent = sl.buffer ? (sl.name.length > 9 ? sl.name.slice(0, 9) + '…' : sl.name) : '槽 ' + (i + 1);
      sl.playBtn.textContent = sl.voice && !sl.voice.done ? '■' : '▶';
      const cv = sl.cv, ctx = cv.getContext('2d'); const W = cv.width = Math.max(60, cv.clientWidth || 120), H = cv.height = 36; ctx.clearRect(0, 0, W, H);
      if (!sl.buffer) { ctx.fillStyle = 'rgba(232,193,90,0.35)'; ctx.font = '10px serif'; ctx.fillText(i === state.recTarget ? '● 下一次录音' : '空', 6, 22); return; }
      const d = sl.buffer.getChannelData(0); const step = Math.max(1, Math.floor(d.length / W)); ctx.fillStyle = document.body.classList.contains('venom') ? '#8cff5a' : '#e8c15a';
      for (let x = 0; x < W; x++) { let mx = 0; const o = x * step; for (let k = 0; k < step; k += 4) mx = Math.max(mx, Math.abs(d[o + k] || 0)); const h = Math.max(1, mx * H); ctx.fillRect(x, (H - h) / 2, 1, h); }
    });
  }
  function buildInstPanel() {
    if (!instBody) return; instBody.innerHTML = '';
    const tiles = UI.el('div', 'tiles');
    for (const [id, ico, name, en] of INST_TILES) { const t = UI.el('div', 'tile' + (real('inst') === id ? ' on' : ''), '<div class="t-ico">' + ico + '</div><div class="t-name">' + name + '</div><div class="t-en">' + en + '</div>'); t.addEventListener('click', () => { setParam('inst', id, { commit: true }); toast(name); }); t.addEventListener('mouseenter', () => info(S.PARAM_MAP.inst)); tiles.appendChild(t); }
    instBody.appendChild(tiles);
    const g = INST_GROUP[real('inst')]; const ids = S.PARAMS.filter((p) => p.group === g).map((p) => p.id);
    instBody.appendChild(UI.group(S.GROUPS[g], ids.map((id) => K(id)), 'lvl2-inline'));
    instBody.appendChild(UI.row([UI.group('演奏', [K('mono'), K('glide'), K('spread'), K('voices')]), UI.group('揉弦 · 颤音', [K('vib.rate'), K('vib.depth'), K('vib.delay')]), UI.group('包络', [K('env.a'), K('env.d'), K('env.s'), K('env.r')])], 'lvl2-inline'));
  }
  function renderModList() {
    if (!modListEl) return; modListEl.innerHTML = '';
    if (!state.mods.length) { modListEl.appendChild(UI.el('div', 'mod-empty', '还没有接线。点一个源芯片（或随机接口 R1–R4），再点任意旋钮。')); return; }
    state.mods.forEach((m, i) => {
      const p = S.PARAM_MAP[m.dst]; const srcName = (S.MOD_SOURCES.find((s) => s[0] === m.src) || [m.src, m.src])[1];
      const it = UI.el('div', 'mod-item'); it.innerHTML = '<span class="src">' + srcName + '</span><span class="dst">→ ' + (p ? p.label + ' <span class="small">' + p.id + '</span>' : m.dst) + '</span>';
      const r = document.createElement('input'); r.type = 'range'; r.min = -1; r.max = 1; r.step = 0.01; r.value = m.amt; r.title = '调制深度 ' + m.amt.toFixed(2); r.addEventListener('input', () => { m.amt = +r.value; r.title = '调制深度 ' + m.amt.toFixed(2); }); r.addEventListener('change', pushUndo);
      it.appendChild(r); const x = UI.el('button', 'x', '✕'); x.title = '删除'; x.addEventListener('click', () => removeMod(i)); it.appendChild(x); modListEl.appendChild(it);
    });
  }
  function arm(src) { state.armed = src; document.body.classList.add('arming'); $('#arm-banner').textContent = '已选中源 ' + src + '：点任意旋钮完成接线（Esc 取消）'; document.querySelectorAll('.chip[data-src], .orb').forEach((e) => e.classList.toggle('armed', e.dataset.src === src || e.querySelector('.orb-name') && e.querySelector('.orb-name').textContent === src)); }
  function disarm() { state.armed = null; document.body.classList.remove('arming'); document.querySelectorAll('.armed').forEach((e) => e.classList.remove('armed')); }
  function updateSrcChips() { for (const k in srcChipEls) srcChipEls[k].classList.toggle('on', k === real('rnd.source')); }
  function pulseOrbs(i) { orbEls.forEach((o, j) => { if (i == null || i === j) { o.classList.remove('pulse'); void o.offsetWidth; o.classList.add('pulse'); setTimeout(() => o.classList.remove('pulse'), 160); } }); }

  /* ================= 随机视图 ================= */
  function updateRandomViews() {
    for (let i = 0; i < 4; i++) { const v = bus.get(i); const o = orbEls[i]; if (!o) continue; o.querySelector('.orb-fill').style.height = (v * 76) + '%'; o.querySelector('.orb-val').textContent = v.toFixed(3); o.querySelector('.orb-src').textContent = bus.lastSrcUsed[i] || '—'; }
    const src = real('rnd.source'); let html = '';
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
  function noteOn(n, vel) { state.key = n / 127; state.vel = vel; if (real('arp.mode') !== 'off') { sched.hold(n); return; } engine.noteOn(n, vel); }
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
  const userPresets = () => store.get(USER_KEY, []);
  const allPresets = () => S.PRESETS.concat(userPresets());
  function loadPreset(i, silent) {
    const all = allPresets(); const pr = all[((i % all.length) + all.length) % all.length]; state.presetIdx = all.indexOf(pr);
    const patch = S.defaults(); Object.assign(patch, pr.patch);
    const mods = (pr.user ? (pr.mods || []) : S.DEFAULT_MODS.concat(pr.mods || [])).map((m) => (Array.isArray(m) ? { src: m[0], dst: m[1], amt: m[2] } : m));
    applySnapshot({ patch, mods }); $('#preset-title').textContent = pr.name; renderPresetList(); pushUndo(); if (!silent) toast('预设：' + pr.name);
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
    pushUndo();
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
  function setVenomUI(on) { document.body.classList.toggle('venom', on); $('#btn-venom').classList.toggle('on', on); document.querySelectorAll('.veins-light').forEach((e) => e.classList.toggle('hidden', on)); document.querySelectorAll('.veins-dark').forEach((e) => e.classList.toggle('hidden', !on)); }
  function setMode(m) { state.mode = m; document.body.classList.remove('mode-play', 'mode-shape', 'mode-deep'); document.body.classList.add('mode-' + m); document.querySelectorAll('.mode-tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m)); }
  let vuPeak = 0; function drawVU() { const cv = $('#vu'); const ctx = cv.getContext('2d'); const W = cv.width = 90, H = cv.height = 26; const td = new Float32Array(engine.analyser.fftSize); engine.analyser.getFloatTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) s += td[i] * td[i]; const rms = Math.sqrt(s / td.length); const db = 20 * Math.log10(rms + 1e-6); const x = Math.max(0, Math.min(1, (db + 48) / 48)); vuPeak = Math.max(x, vuPeak * 0.96); ctx.clearRect(0, 0, W, H); const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#7fbf5a'); g.addColorStop(0.7, '#e8c15a'); g.addColorStop(1, '#ff5a3c'); ctx.fillStyle = g; ctx.fillRect(2, 6, (W - 4) * x, H - 12); ctx.fillStyle = '#fff'; ctx.fillRect(2 + (W - 4) * vuPeak - 1, 4, 2, H - 8); }
  function buildPalette() {
    const entries = [];
    for (const p of S.PARAMS) entries.push({ kind: '参数', label: p.label, en: p.en + ' ' + p.id, abbr: S.GROUPS[p.group] || '', act: () => { const c = controls[p.id]; if (!c) return; if (!c.el.offsetParent) setMode('deep'); setTimeout(() => c.flash(), 50); info(p); } });
    allPresets().forEach((pr, i) => entries.push({ kind: pr.user ? '我的预设' : '预设', label: pr.name, en: pr.tags.join(' '), act: () => loadPreset(i) }));
    for (const [id, ico, name, en] of INST_TILES) entries.push({ kind: '乐器', label: name, en, act: () => setParam('inst', id, { commit: true }) });
    const acts = [['毒液模式 切换', 'venom toggle', () => setParam('vn.on', real('vn.on') ? 0 : 1, { commit: true })], ['惊喜 随机化音色', 'surprise randomize', surprise], ['刷新随机接口', 'refresh random', () => bus.refresh()], ['模式：玩', 'mode play', () => setMode('play')], ['模式：塑', 'mode shape', () => setMode('shape')], ['模式：深', 'mode deep', () => setMode('deep')], ['帮助', 'help', () => $('#help').classList.add('open')], ['全部静音', 'panic all notes off', () => engine.panic()], ['撤销', 'undo', undo], ['重做', 'redo', redo], ['A/B 切换', 'ab compare', abToggle], ['低动效（省电）切换', 'low motion', () => document.body.classList.toggle('low-motion')], ['存为我的预设', 'save preset', saveUserPreset], ['录音 开始/停止', 'record', toggleRecord], ['停止所有声音槽', 'stop slots', () => { engine.stopAllSlots(); }]];
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
      if (e.key === 'Escape') { if (state.armed) { disarm(); return; } if (palette.c.classList.contains('open')) { palette.close(); return; } if ($('#help').classList.contains('open')) { $('#help').classList.remove('open'); return; } const now = Date.now(); if (now - state.escAt < 500) { engine.panic(); toast('全部静音'); } state.escAt = now; return; }
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
    bus.refresh(); loadPreset(0, true);
    const last = store.get(LAST_KEY, null);
    if (last && last.snap && last.snap.patch) { try { applySnapshot(last.snap); state.presetIdx = last.presetIdx; $('#preset-title').textContent = last.name || '上次的音色'; renderPresetList(); setTimeout(() => toast('已恢复上次的音色'), 2600); } catch (e) { /* 忽略损坏的存档 */ } }
    state.undo = [JSON.stringify(snapshot())];
    $('#splash').classList.add('hide'); $('#app').classList.add('on');
    requestAnimationFrame(loop);
    setTimeout(() => toast('欢迎。先转四个宏旋钮，按 Z X C V 弹奏，Shift+R 录音，空格刷新随机接口。'), 600);
    setInterval(() => { if (sched && arpChip) arpChip.textContent = real('arp.mode') === 'off' ? '' : '琶音中 · 按住琴键 · ' + sched.held.length + ' 音'; }, 500);
  }
  $('#enter').addEventListener('click', boot);
  root.SHISUI.app = { state, engine, bus, setParam, loadPreset, surprise, get sched() { return sched; } };
})(window);
