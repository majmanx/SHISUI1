/* ============================================================
   石髓 SHISUI · 音频引擎
   合成器 Worklet → 滤波(原生, 带LFO) → 放大器 Worklet(二极管/电子管/箱体)
   → 合唱 → 乒乓延迟 → 石厅混响(生成脉冲响应) → 压缩 → 主音量 → 限幅 → 分析
   ============================================================ */
(function (root) {
  'use strict';
  const S = root.SHISUI;

  class Engine {
    constructor() { this.ctx = null; this.ready = false; this.P = {}; this.A = {}; this.dirtyP = false; this.dirtyA = false; this._revTimer = 0; this.onMidi = null; this.midiName = ''; }

    async init() {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('此浏览器不支持 Web Audio。');
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      if (!ctx.audioWorklet) throw new Error('此浏览器不支持 AudioWorklet，请使用最新的 Chrome / Edge / Firefox / Safari。');
      // data: URL 在 file:// 下也能加载 (Blob URL 在 file:// 下会被 Chrome 拒绝)，失败再退回 Blob
      const src = root.DSP_WORKLET_SRC;
      try { await ctx.audioWorklet.addModule('data:application/javascript;charset=utf-8,' + encodeURIComponent(src)); }
      catch (e) { await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); }
      const synth = this.synth = new AudioWorkletNode(ctx, 'shisui-synth', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      const amp = this.amp = new AudioWorkletNode(ctx, 'shisui-amp', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });

      /* 滤波 + LFO */
      const filter = this.filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 9000; filter.Q.value = 0.8;
      const lfo = this.lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.5;
      const lfoG = this.lfoG = ctx.createGain(); lfoG.gain.value = 0; lfo.connect(lfoG); lfoG.connect(filter.detune); lfo.start();

      /* 合唱 */
      const choIn = this.choIn = ctx.createGain(); const choDry = this.choDry = ctx.createGain(); const choWet = this.choWet = ctx.createGain(); const choOut = this.choOut = ctx.createGain();
      choWet.gain.value = 0; choIn.connect(choDry); choDry.connect(choOut);
      const dL = ctx.createDelay(0.1), dR = ctx.createDelay(0.1); dL.delayTime.value = 0.012; dR.delayTime.value = 0.017;
      const choLfo = this.choLfo = ctx.createOscillator(); choLfo.frequency.value = 0.6; const choLfoG = this.choLfoG = ctx.createGain(); choLfoG.gain.value = 0.3 * 0.004;
      const inv = ctx.createGain(); inv.gain.value = -1;
      choLfo.connect(choLfoG); choLfoG.connect(dL.delayTime); choLfoG.connect(inv); inv.connect(dR.delayTime); choLfo.start();
      const pL = ctx.createStereoPanner(), pR = ctx.createStereoPanner(); pL.pan.value = -0.7; pR.pan.value = 0.7;
      choIn.connect(dL); dL.connect(pL); pL.connect(choWet); choIn.connect(dR); dR.connect(pR); pR.connect(choWet); choWet.connect(choOut);

      /* 乒乓延迟 */
      const dlyIn = this.dlyIn = ctx.createGain(); const dlyDry = ctx.createGain(); const dlyWet = this.dlyWet = ctx.createGain(); const dlyOut = this.dlyOut = ctx.createGain();
      dlyWet.gain.value = 0.15; dlyIn.connect(dlyDry); dlyDry.connect(dlyOut);
      const dA = this.dA = ctx.createDelay(4), dB = this.dB = ctx.createDelay(4); dA.delayTime.value = 0.375; dB.delayTime.value = 0.375;
      const fb = this.dlyFb = ctx.createGain(); fb.gain.value = 0.35; const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 4500;
      const pA = ctx.createStereoPanner(), pB = ctx.createStereoPanner(); pA.pan.value = -0.8; pB.pan.value = 0.8;
      dlyIn.connect(dA); dA.connect(pA); pA.connect(dlyWet); dA.connect(dB); dB.connect(pB); pB.connect(dlyWet); dB.connect(fb); fb.connect(dLP); dLP.connect(dA); dlyWet.connect(dlyOut);

      /* 石厅混响 */
      const revIn = this.revIn = ctx.createGain(); const revDry = ctx.createGain(); const revWet = this.revWet = ctx.createGain(); const revOut = this.revOut = ctx.createGain();
      const conv = this.conv = ctx.createConvolver(); revWet.gain.value = 0.3;
      revIn.connect(revDry); revDry.connect(revOut); revIn.connect(conv); conv.connect(revWet); revWet.connect(revOut);
      this.revSize = 2.5; this.revDamp = 0.5; this.genIR();

      /* 压缩 / 主音量 / 限幅 / 分析 */
      const comp = this.comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2; comp.knee.value = 10;
      const master = this.master = ctx.createGain(); master.gain.value = 0.8;
      const lim = this.lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1; lim.knee.value = 0;
      const an = this.analyser = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.75;

      /* 冷暖: 倾斜 EQ (低架 / 高架) */
      const tLow = this.tiltLow = ctx.createBiquadFilter(); tLow.type = 'lowshelf'; tLow.frequency.value = 260; tLow.gain.value = 0;
      const tHigh = this.tiltHigh = ctx.createBiquadFilter(); tHigh.type = 'highshelf'; tHigh.frequency.value = 3200; tHigh.gain.value = 0;
      this.warmth = 0;
      synth.connect(filter); filter.connect(amp); amp.connect(tLow); tLow.connect(tHigh); tHigh.connect(choIn); choOut.connect(dlyIn); dlyOut.connect(revIn); revOut.connect(comp); comp.connect(master); master.connect(lim); lim.connect(an); an.connect(ctx.destination);

      /* 录音抓取 (限幅之后，与你听到的一致) */
      const rec = this.rec = new AudioWorkletNode(ctx, 'shisui-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const recSink = ctx.createGain(); recSink.gain.value = 0; lim.connect(rec); rec.connect(recSink); recSink.connect(ctx.destination);
      this.recording = false; this.recChunks = []; this.recStart = 0;
      rec.port.onmessage = (e) => { if (this.recording || this._recFlushing) this.recChunks.push(e.data); };
      /* 声音槽输入 (可选择过效果链 / 直入总线) */
      this.slotFx = ctx.createGain(); this.slotFx.connect(filter); this.slotDry = ctx.createGain(); this.slotDry.connect(comp); this.slotVoices = new Set();

      /* 盖革咔嗒 / 点击 */
      this.clickBus = ctx.createGain(); this.clickBus.gain.value = 0.5; this.clickBus.connect(revIn);
      this.ready = true;
      this._flushTimer = setInterval(() => this.flush(), 16);
      this.initMidi();
      return this;
    }

    resume() { if (this.ctx && this.ctx.state !== 'running') return this.ctx.resume(); return Promise.resolve(); }

    /* ---- 参数分发 ---- */
    apply(id, v) {
      if (!this.ready) return;
      const p = S.PARAM_MAP[id]; if (!p) return;
      const ctx = this.ctx, t = ctx.currentTime, tc = 0.012;
      if (p.target === 'synth') { this.P[p.key] = v; this.dirtyP = true; return; }
      if (p.target === 'amp') { this.A[p.key] = v; this.dirtyA = true; return; }
      if (p.target === 'both') { this.P[p.key] = v; this.A[p.key] = v; this.dirtyP = this.dirtyA = true; return; }
      if (p.target !== 'native') return;
      switch (id) {
        case 'flt.type': this.filter.type = v; break;
        case 'flt.cutoff': this.filter.frequency.setTargetAtTime(v, t, tc); break;
        case 'flt.res': this.filter.Q.setTargetAtTime(v, t, tc); break;
        case 'flt.lfoRate': this.lfo.frequency.setTargetAtTime(v, t, tc); break;
        case 'flt.lfoDepth': this.lfoG.gain.setTargetAtTime(v * 3600, t, tc); break;
        case 'cho.rate': this.choLfo.frequency.setTargetAtTime(v, t, tc); break;
        case 'cho.depth': this.choLfoG.gain.setTargetAtTime(v * 0.004, t, tc); break;
        case 'cho.mix': this.choWet.gain.setTargetAtTime(v, t, tc); this.choDry.gain.setTargetAtTime(1 - v * 0.4, t, tc); break;
        case 'dly.time': this.dA.delayTime.setTargetAtTime(v, t, 0.05); this.dB.delayTime.setTargetAtTime(v, t, 0.05); break;
        case 'dly.fb': this.dlyFb.gain.setTargetAtTime(v, t, tc); break;
        case 'dly.mix': this.dlyWet.gain.setTargetAtTime(v, t, tc); break;
        case 'tone.warm': {
          this.warmth = v; this.P.warmth = v; this.dirtyP = true; const cold = v < 0 ? -v : 0, warm = v > 0 ? v : 0;
          this.tiltLow.gain.setTargetAtTime(warm * 5 - cold * 3, t, 0.05); this.tiltHigh.gain.setTargetAtTime(cold * 6 - warm * 7, t, 0.05);
          this.A.tubeBiasOffset = warm * 0.35; this.dirtyA = true; this.scheduleIR(); break;
        }
        case 'rev.size': this.revSize = v; this.scheduleIR(); break;
        case 'rev.damp': this.revDamp = v; this.scheduleIR(); break;
        case 'rev.mix': this.revWet.gain.setTargetAtTime(v, t, tc); break;
        case 'comp.amount': this.comp.threshold.setTargetAtTime(-6 - v * 30, t, tc); this.comp.ratio.setTargetAtTime(1.5 + v * 10, t, tc); break;
        case 'master.vol': this.master.gain.setTargetAtTime(v * v, t, tc); break;
        default: break;
      }
    }
    flush() {
      if (!this.ready) return;
      if (this.dirtyP) { this.synth.port.postMessage({ type: 'params', P: this.P }); this.dirtyP = false; }
      if (this.dirtyA) { this.amp.port.postMessage({ type: 'params', A: this.A }); this.dirtyA = false; }
    }
    scheduleIR() { clearTimeout(this._revTimer); this._revTimer = setTimeout(() => this.genIR(), 180); }
    genIR() {
      const ctx = this.ctx, sr = ctx.sampleRate; const wz = this.warmth || 0; const len = Math.max(1000, Math.floor(sr * this.revSize * (1 + (wz < 0 ? -wz * 0.6 : -wz * 0.3))));
      const buf = ctx.createBuffer(2, len, sr); const w = this.warmth || 0; const damp = Math.min(1, Math.max(0, this.revDamp + (w > 0 ? w * 0.35 : w * 0.25)));
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) {
          const x = i / len; const env = Math.exp(-4.5 * x) * (1 - x);
          const n = Math.random() * 2 - 1; const a = 1 - damp * (0.15 + 0.83 * x);
          lp += (n - lp) * a; d[i] = lp * env;
        }
        // 石壁早期反射
        for (let k = 1; k <= 6; k++) { const at = Math.floor(sr * (0.007 * k + 0.003 * ch + Math.random() * 0.004)); if (at < len) d[at] += (0.6 / k) * (Math.random() > 0.5 ? 1 : -1); }
      }
      this.conv.buffer = buf;
    }

    /* ---- 演奏 ---- */
    noteOn(note, vel) { if (this.ready) this.synth.port.postMessage({ type: 'noteOn', note, vel: vel === undefined ? 0.8 : vel }); }
    noteOff(note) { if (this.ready) this.synth.port.postMessage({ type: 'noteOff', note }); }
    allOff() { if (this.ready) this.synth.port.postMessage({ type: 'allOff' }); }
    panic() { if (this.ready) this.synth.port.postMessage({ type: 'panic' }); }
    click(level) { if (this.ready) this.synth.port.postMessage({ type: 'click', level: level || 0.25 }); }

    /* ---- 录音 / 声音槽 ---- */
    startRecording() { if (!this.ready || this.recording) return; this.recChunks = []; this.recording = true; this.recStart = this.ctx.currentTime; this.rec.port.postMessage({ type: 'rec', on: true }); }
    async stopRecording() {
      if (!this.recording) return null; this.recording = false; this._recFlushing = true; this.rec.port.postMessage({ type: 'rec', on: false });
      await new Promise((r) => setTimeout(r, 60)); this._recFlushing = false;
      const n = this.recChunks.reduce((a, c) => a + c.l.length, 0); if (n < 256) return null;
      const buf = this.ctx.createBuffer(2, n, this.ctx.sampleRate); const L = buf.getChannelData(0), R = buf.getChannelData(1); let o = 0;
      for (const c of this.recChunks) { L.set(c.l, o); R.set(c.r, o); o += c.l.length; } this.recChunks = []; return buf;
    }
    get recordingTime() { return this.recording ? this.ctx.currentTime - this.recStart : 0; }
    playBuffer(buffer, o) {
      o = o || {}; const ctx = this.ctx; const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = !!o.loop; src.playbackRate.value = o.rate || 1;
      const g = ctx.createGain(); g.gain.value = o.gain == null ? 0.8 : o.gain; src.connect(g); g.connect(o.fx ? this.slotFx : this.slotDry);
      const v = { src, gain: g, stop() { try { src.stop(); } catch (e) { /* 已停止 */ } }, done: false };
      src.onended = () => { v.done = true; this.slotVoices.delete(v); if (o.onEnd) o.onEnd(); }; this.slotVoices.add(v); src.start(); return v;
    }
    stopAllSlots() { for (const v of Array.from(this.slotVoices)) v.stop(); }
    static encodeWav(buffer) {
      const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate; const bytes = 44 + n * ch * 2; const ab = new ArrayBuffer(bytes); const dv = new DataView(ab);
      const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
      const data = []; for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c)); let o = 44;
      for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { let v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
      return new Blob([ab], { type: 'audio/wav' });
    }
    decodeFile(file) { return file.arrayBuffer().then((ab) => this.ctx.decodeAudioData(ab)); }

    /* ---- MIDI ---- */
    initMidi() {
      if (!navigator.requestMIDIAccess) return;
      navigator.requestMIDIAccess().then((acc) => {
        const hook = () => { let names = []; acc.inputs.forEach((inp) => { names.push(inp.name); inp.onmidimessage = (e) => this._midi(e.data); }); this.midiName = names.join(', '); if (this.onMidiState) this.onMidiState(this.midiName); };
        acc.onstatechange = hook; hook();
      }).catch(() => {});
    }
    _midi(d) {
      const st = d[0] & 0xf0;
      if (st === 0x90 && d[2] > 0) { if (this.onMidi) this.onMidi('on', d[1], d[2] / 127); }
      else if (st === 0x80 || (st === 0x90 && d[2] === 0)) { if (this.onMidi) this.onMidi('off', d[1], 0); }
      else if (st === 0xb0) { if (this.onMidi) this.onMidi('cc', d[1], d[2] / 127); }
      else if (st === 0xe0) { const b = ((d[2] << 7) | d[1]) - 8192; if (this.onMidi) this.onMidi('bend', 0, b / 8192); }
    }
  }
  S.Engine = Engine;
})(window);
