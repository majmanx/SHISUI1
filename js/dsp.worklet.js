/* ============================================================
   石髓 SHISUI · DSP 内核 (AudioWorklet)
   这里的函数体会被 toString() 后以 Blob 形式载入 AudioWorklet，
   因此可以直接从 file:// 打开，无需服务器。
   模型参考 STK (Cook & Scavone) 的 Plucked / Bowed / Flute / Clarinet，
   并加入古筝摇指、按滑、笛膜、簧片、拾音器、毒液等自定义扩展。
   ============================================================ */
function DSP_WORKLET_MAIN() {
  'use strict';
  const SR = sampleRate;
  const TWO_PI = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- 基础构件 ---------- */
  class DelayL {
    constructor(max) {
      this.max = max; this.buf = new Float32Array(max);
      this.inP = 0; this.outP = 0; this.alpha = 0; this.omAlpha = 1; this.out = 0;
      this.setDelay(1);
    }
    clear() { this.buf.fill(0); this.out = 0; }
    setDelay(d) {
      if (!(d >= 0.5)) d = 0.5;
      if (d > this.max - 2) d = this.max - 2;
      let o = this.inP - d;
      while (o < 0) o += this.max;
      const fl = Math.floor(o);
      this.outP = fl >= this.max ? fl - this.max : fl;
      this.alpha = o - fl; this.omAlpha = 1 - this.alpha;
    }
    tick(x) {
      const b = this.buf;
      b[this.inP] = x; if (++this.inP >= this.max) this.inP = 0;
      const o = this.outP; let n = o + 1; if (n >= this.max) n = 0;
      this.out = b[o] * this.omAlpha + b[n] * this.alpha;
      this.outP = n;
      return this.out;
    }
  }
  class OnePole {
    constructor(pole, gain) { this.y = 0; this.g = gain; this.setPole(pole); }
    setPole(p) { this.b0 = 1 - Math.abs(p); this.a1 = -p; }
    tick(x) { this.y = this.b0 * this.g * x - this.a1 * this.y; return this.y; }
  }
  class DCBlock { constructor() { this.x1 = 0; this.y1 = 0; } reset() { this.x1 = this.y1 = 0; }
    tick(x) { const y = x - this.x1 + 0.995 * this.y1; this.x1 = x; this.y1 = y; return y; } }
  class Biquad {
    constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
    reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
    _set(b0, b1, b2, a0, a1, a2) { this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; }
    peak(f, Q, db) { const A = Math.pow(10, db / 40), w = TWO_PI * f / SR, s = Math.sin(w), c = Math.cos(w), al = s / (2 * Q);
      this._set(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A); }
    lp(f, Q) { const w = TWO_PI * f / SR, s = Math.sin(w), c = Math.cos(w), al = s / (2 * Q);
      this._set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al); }
    hp(f, Q) { const w = TWO_PI * f / SR, s = Math.sin(w), c = Math.cos(w), al = s / (2 * Q);
      this._set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al); }
    bp(f, Q) { const w = TWO_PI * f / SR, s = Math.sin(w), c = Math.cos(w), al = s / (2 * Q);
      this._set(al, 0, -al, 1 + al, -2 * c, 1 - al); }
    tick(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
  }
  class ADSR {
    constructor() { this.v = 0; this.state = 0; this.set(0.01, 0.5, 0.7, 0.3); }
    set(a, d, s, r) { this.aR = 1 / (Math.max(0.0005, a) * SR); this.dR = 1 / (Math.max(0.002, d) * SR); this.s = s; this.rR = 1 / (Math.max(0.003, r) * SR); }
    on() { this.state = 1; }
    off() { if (this.state !== 0) this.state = 4; }
    get done() { return this.state === 0; }
    tick() {
      switch (this.state) {
        case 1: this.v += this.aR; if (this.v >= 1) { this.v = 1; this.state = 2; } break;
        case 2: this.v -= this.dR; if (this.v <= this.s) { this.v = this.s; this.state = 3; } break;
        case 3: this.v = this.s; break;
        case 4: this.v -= this.rR; if (this.v <= 0) { this.v = 0; this.state = 0; } break;
        default: break;
      }
      return this.v;
    }
  }
  function polyblep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }
  const saw = (ph, dt) => (2 * ph - 1) - polyblep(ph, dt);
  function fold(x) { let n = 0; while ((x > 1 || x < -1) && n++ < 8) { x = x > 1 ? 2 - x : -2 - x; } return x; }

  /* ---------- 语音 (一个发声单元) ---------- */
  class Voice {
    constructor() {
      this.active = false; this.gate = false; this.model = 'guzheng';
      this.note = 60; this.vel = 1; this.age = 0; this.t = 0; this.offT = 0;
      this.target = 440; this.cur = 440; this.env = new ADSR(); this.vibPh = Math.random();
      // 古筝
      this.ks = new DelayL(8192); this.exc = null; this.excIdx = 0; this.lpY = 0; this.apX = 0; this.apY = 0; this.yz = 0; this.slideT = -1;
      // 二胡
      this.neck = new DelayL(4096); this.bridge = new DelayL(2048);
      this.strF = new OnePole(0.6 - 0.1 * 22050 / SR, 0.95);
      this.body = [new Biquad(), new Biquad(), new Biquad()];
      this.body[0].peak(450, 2.2, 8); this.body[1].peak(920, 3, 6); this.body[2].peak(1900, 3, 4);
      // 竹笛
      this.jet = new DelayL(2048); this.bore = new DelayL(4096); this.flF = new OnePole(0.7, -1); this.dc = new DCBlock();
      this.memF = new Biquad(); this.memF.bp(2800, 3);
      // 管子
      this.reed = new DelayL(4096); this.clX1 = 0;
      // 合成层 / 弦乐群 / 毒液
      this.ph = [Math.random(), Math.random(), Math.random()]; this.synPh = 0; this.subPh = 0; this.fmPh = 0; this.fmLast = 0; this.ooze = 0;
      this.panL = 0.707; this.panR = 0.707; this.lim = 0; this.outDC = new DCBlock();
    }
    noteOn(model, note, vel, P, startFreq) {
      this.model = model; this.note = note; this.vel = vel; this.active = true; this.gate = true;
      this.age = 0; this.t = 0; this.lim = 1; this.slideT = -1;
      this.target = mtof(note); this.cur = startFreq || this.target;
      this.env.set(P.envA, P.envD, P.envS, P.envR); this.env.v = 0; this.env.on();
      const f = this.target;
      const sp = (P.spread || 0) * (Math.random() * 2 - 1) * 0.8; const ang = (sp + 1) * Math.PI / 4;
      this.panL = Math.cos(ang); this.panR = Math.sin(ang);
      if (model === 'guzheng') {
        this.ks.clear(); this.lpY = this.apX = this.apY = 0; this.yz = 0;
        const n = Math.max(4, Math.floor(SR / f));
        const pure = P.pure || 0; const e = new Float32Array(n); let lp = 0; const k = (0.05 + P.gzNail * 0.45) * (1 - pure * 0.6); const pos = P.gzPos;
        for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * k; e[i] = lp; }
        const pp = Math.max(1, Math.round(pos * n));
        for (let i = n - 1; i >= pp; i--) e[i] -= e[i - pp];
        // 三角形位移(拨弦点处最大) + 义甲噪声: 稳定的响度与真实的拨弦感
        const nz = (0.12 + 0.45 * P.gzNail) * (1 - pure * 0.85);
        for (let i = 0; i < n; i++) { const x = i / n; const tri = (x < pos ? x / pos : (1 - x) / (1 - pos)) - 0.5; e[i] = tri * (1 - nz) * 1.6 + e[i] * nz; }
        const g = (0.35 + 0.65 * vel) * 1.1; for (let i = 0; i < n; i++) e[i] *= g;
        this.exc = e; this.excIdx = 0;
        if (P.gzSlide !== 0 && P.gzSlideTime > 0) this.slideT = 0;
      } else if (model === 'erhu') {
        this.neck.clear(); this.bridge.clear(); this.strF.y = 0; for (const b of this.body) b.reset();
      } else if (model === 'dizi') {
        this.jet.clear(); this.bore.clear(); this.flF.y = 0; this.dc.reset(); this.memF.reset();
      } else if (model === 'guan') {
        this.reed.clear(); this.clX1 = 0;
      }
      this.outDC.reset();
    }
    legato(note) { this.note = note; this.target = mtof(note); this.gate = true; if (this.env.state === 4 || this.env.state === 0) this.env.on(); }
    off() { this.gate = false; this.env.off(); this.offT = 0; }
    tick(P) {
      this.t++;
      if (this.cur !== this.target) {
        const c = P.glide > 0.002 ? 1 - Math.exp(-1 / (P.glide * SR)) : 1;
        this.cur += (this.target - this.cur) * c;
        if (Math.abs(this.cur - this.target) < 0.005) this.cur = this.target;
      }
      const wm = P.warmth || 0; const cold = wm < 0 ? -wm : 0, warm = wm > 0 ? wm : 0; const pu = P.pure || 0, pk = 1 - pu * 0.85;
      const vd = P.vibDepth * (1 + warm * 0.35 - cold * 0.3) * Math.min(1, this.t / (P.vibDelay * SR + 1));
      this.vibPh += P.vibRate * (1 + cold * 0.35 - warm * 0.15) / SR; if (this.vibPh >= 1) this.vibPh -= 1;
      const vib = Math.sin(TWO_PI * this.vibPh) * vd;
      let cents = vib + P.bend * 100;
      if (this.slideT >= 0) {
        const p = this.slideT / (P.gzSlideTime * SR);
        if (p >= 1) this.slideT = -1; else { cents -= P.gzSlide * 100 * (1 - p) * (1 - p); this.slideT++; }
      }
      if (P.vnOn > 0.5 && P.vnOoze > 0) {
        this.ooze += (Math.random() - 0.5) * 0.004 * P.vnOoze; this.ooze *= 0.9992; cents += this.ooze * 100;
      }
      const f = clamp(this.cur * Math.pow(2, cents / 1200), 20, 12000);
      const e = this.env.tick(); const ea = e * e; const vel = this.vel;
      let y = 0;
      switch (this.model) {
        case 'guzheng': {
          let inp = 0;
          if (this.exc) {
            if (this.excIdx < this.exc.length) inp = this.exc[this.excIdx++];
            if (P.gzYaozhi > 0.2 && this.gate) { if (++this.yz >= SR / P.gzYaozhi) { this.yz = 0; this.excIdx = 0; } }
          }
          const yy = this.ks.out;
          let c = Math.max(0.02, 0.05 + (1 - P.gzBright) * 0.6 + warm * 0.12 - cold * 0.04); if (!this.gate) c = Math.min(0.95, c + P.gzDamp * 0.3);
          this.lpY = yy * (1 - c) + this.lpY * c;
          const a = P.gzStiff * 0.5;
          const ap = a * this.lpY + this.apX - a * this.apY; this.apX = this.lpY; this.apY = ap;
          let g = Math.exp(Math.log(0.001) / (f * P.gzDecay));
          if (!this.gate) g *= 1 - P.gzDamp * 0.004;
          const d = SR / f - c / (1 - c) - (1 - a) / (1 + a);
          this.ks.setDelay(d);
          this.ks.tick(inp + ap * g);
          y = yy * 1.4;
          break;
        }
        case 'erhu': {
          const bd = Math.max(8, SR / f - 4); const beta = P.erPos;
          this.bridge.setDelay(bd * beta); this.neck.setDelay(bd * (1 - beta));
          const maxV = 0.03 + 0.2 * (0.4 + 0.6 * vel);
          const bowVel = maxV * e * (1 + (Math.random() * 2 - 1) * Math.min(1, P.erRosin * (1 + cold * 1.2) + cold * 0.12) * 0.35 * pk);
          const bridgeRefl = -this.strF.tick(this.bridge.out);
          const nutRefl = -this.neck.out;
          const dv = bowVel - (bridgeRefl + nutRefl);
          const slope = 5 - 4 * P.erPressure;
          let bt = Math.abs((dv + 0.001) * slope) + 0.75; bt = Math.pow(bt, -4); if (bt > 1) bt = 1;
          const nv = dv * bt;
          this.neck.tick(bridgeRefl + nv); this.bridge.tick(nutRefl + nv);
          let s = this.bridge.out; let bs = s;
          for (let i = 0; i < 3; i++) bs = this.body[i].tick(bs);
          { const bm = Math.min(1, P.erBody * (1 + warm * 0.4)); y = (s * (1 - bm) + bs * bm * 0.4) * 2.2; }
          break;
        }
        case 'dizi': {
          const len = Math.max(6, SR / f - 2);
          this.bore.setDelay(len); this.jet.setDelay(Math.max(2, len * P.dzJet));
          let bp = P.dzBreath * (0.8 + 0.2 * vel) * e;
          bp += bp * (Math.min(0.7, P.dzNoise * (1 + cold * 1.5) + cold * 0.08) * pk * (Math.random() * 2 - 1) + 0.03 * Math.sin(TWO_PI * this.vibPh) * (vd > 0 ? 1 : 0));
          let temp = -this.flF.tick(this.bore.out); temp = this.dc.tick(temp);
          let pd = bp - 0.5 * temp;
          pd = this.jet.tick(pd);
          let jt = pd * (pd * pd - 1); if (jt > 1) jt = 1; else if (jt < -1) jt = -1;
          pd = jt + 0.5 * temp;
          let s = 0.3 * this.bore.tick(pd);
          if (P.dzMembrane > 0) { const m = this.memF.tick(s * Math.abs(s) * 6); s += m * P.dzMembrane * 0.8; }
          y = s * (0.5 + 0.5 * vel) * 1.6;
          break;
        }
        case 'guan': {
          this.reed.setDelay(Math.max(4, (SR / f) * 0.5 - 1.5));
          // 簧片: 硬度决定斜率, 气压按"闭簧阈值"的比例给出, 保证整个旋钮范围都能起振
          const slope = -0.5 + 0.2 * P.gnReed; const closure = 0.3 / -slope;
          let bp = closure * (0.83 + 0.17 * P.gnBreath) * (0.97 + 0.03 * e);
          if (e < 0.03) bp *= e * 33.3; // 起音/收音包络
          bp += bp * Math.min(0.7, P.gnNoise * (1 + cold * 1.5) + cold * 0.06) * pk * (Math.random() * 2 - 1);
          const lo = 0.5 * (this.reed.out + this.clX1); this.clX1 = this.reed.out; // 单零点低通(闭管反射)
          const pd = -0.95 * lo - bp;
          let rt = 0.7 + slope * pd; if (rt > 1) rt = 1; else if (rt < -1) rt = -1;
          this.reed.tick(bp + pd * rt);
          let s = this.reed.out * 1.3 * (0.55 + 0.45 * e);
          if (P.gnBell > 0) { const b = P.gnBell; s = s * (1 - b) + fold(s * (1 + 3 * b)) * b; }
          y = s * (0.4 + 0.6 * vel);
          break;
        }
        default: { // strings
          const dt = f / SR; let s = 0;
          for (let k = 0; k < 3; k++) {
            const det = (k - 1) * P.stDetune;
            const d = dt * Math.pow(2, det / 1200);
            this.ph[k] += d; if (this.ph[k] >= 1) this.ph[k] -= 1;
            let w = saw(this.ph[k], d);
            if (P.stPw > 0) { let p2 = this.ph[k] + 0.5; if (p2 >= 1) p2 -= 1; w = w * (1 - P.stPw) + (saw(this.ph[k], d) - saw(p2, d)) * P.stPw; }
            s += w;
          }
          y = s * 0.28 * ea * (0.3 + 0.7 * vel);
        }
      }
      /* ---- 插电 / 拾音器 / 合成层 ---- */
      let out = y;
      const eb = P.elBlend * (1 - pu);
      if (eb > 0) {
        const g = 1 + P.elDrive * P.elDrive * 12; const bias = P.elBias * 0.7;
        let d = (Math.tanh(y * g + bias) - Math.tanh(bias)) / Math.sqrt(g);
        out = y * (1 - eb) + d * eb * 1.2;
      }
      if (P.elSynth > 0) {
        const dt = f * Math.pow(2, P.elDetune / 12) / SR;
        this.synPh += dt; if (this.synPh >= 1) this.synPh -= 1;
        let w; const wv = Math.round(P.elWave);
        if (wv === 0) w = saw(this.synPh, dt);
        else if (wv === 1) { let p2 = this.synPh + 0.5; if (p2 >= 1) p2 -= 1; w = saw(this.synPh, dt) - saw(p2, dt); }
        else w = Math.sin(TWO_PI * this.synPh);
        out += w * P.elSynth * ea * (0.3 + 0.7 * vel) * 0.45;
      }
      if (P.elSub > 0) {
        this.subPh += f * 0.5 / SR; if (this.subPh >= 1) this.subPh -= 1;
        out += Math.sin(TWO_PI * this.subPh) * P.elSub * ea * (0.3 + 0.7 * vel) * 0.6;
      }
      /* ---- 毒液 ---- */
      if (P.vnOn > 0.5) {
        const amt = P.vnAmt;
        if (P.vnFm > 0) {
          this.fmPh += f / SR; if (this.fmPh >= 1) this.fmPh -= 1;
          const fb = Math.sin(TWO_PI * this.fmPh + P.vnFm * 4 * this.fmLast + out * 3 * amt);
          this.fmLast = fb; out += fb * amt * 0.35 * (this.model === 'guzheng' ? Math.min(1, this.lim * 3) : ea) * (0.3 + 0.7 * vel);
        }
        if (P.vnFold > 0) { const k = 1 + P.vnFold * 7 * amt; out = out * (1 - amt) + fold(out * k) / Math.pow(k, 0.35) * amt; }
      }
      if (warm > 0) out = out * (1 - warm * 0.35) + Math.tanh(out * 1.6) * warm * 0.35 * 0.9;
      out = this.outDC.tick(out);
      if (out > 1.5) out = 1.5 + Math.tanh(out - 1.5) * 0.4; else if (out < -1.5) out = -1.5 + Math.tanh(out + 1.5) * 0.4;
      const ab = Math.abs(out); this.lim = ab > this.lim ? ab : this.lim * 0.99995;
      if (!this.gate) { this.offT++; if (this.env.done && (this.lim < 3e-4 || this.offT > SR * 20)) this.active = false; }
      return out;
    }
  }

  /* ---------- 合成器处理器 ---------- */
  class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.P = {
        inst: 'guzheng', mono: 0, glide: 0.05, spread: 0.5, bend: 0,
        vibRate: 5.5, vibDepth: 20, vibDelay: 0.4, envA: 0.01, envD: 0.8, envS: 0.7, envR: 0.4,
        gzBright: 0.7, gzDecay: 5, gzPos: 0.18, gzStiff: 0.15, gzNail: 0.6, gzSlide: 0, gzSlideTime: 0.25, gzYaozhi: 0, gzDamp: 0.4,
        erPressure: 0.55, erPos: 0.13, erRosin: 0.2, erBody: 0.6,
        dzBreath: 1.4, dzJet: 0.32, dzNoise: 0.15, dzMembrane: 0.3,
        gnBreath: 0.5, gnReed: 0.5, gnNoise: 0.1, gnBell: 0.3,
        stDetune: 12, stPw: 0.2,
        elBlend: 0, elDrive: 0.3, elBias: 0.2, elSynth: 0, elWave: 0, elDetune: 0, elSub: 0,
        vnOn: 0, vnAmt: 0.5, vnFold: 0.3, vnFm: 0.3, vnOoze: 0.3, voices: 8, warmth: 0, pure: 0,
      };
      this.voices = []; for (let i = 0; i < 8; i++) this.voices.push(new Voice());
      this.noteStack = []; this.lastFreq = 0; this.geiger = 0; this.geigerLvl = 0;
      this.port.onmessage = (e) => this.onMsg(e.data);
    }
    onMsg(m) {
      switch (m.type) {
        case 'params': Object.assign(this.P, m.P); break;
        case 'noteOn': this.noteOn(m.note, m.vel === undefined ? 0.8 : m.vel); break;
        case 'noteOff': this.noteOff(m.note); break;
        case 'allOff': for (const v of this.voices) if (v.active) v.off(); this.noteStack.length = 0; break;
        case 'panic': for (const v of this.voices) { v.active = false; v.gate = false; } this.noteStack.length = 0; break;
        case 'click': this.geiger = 1; this.geigerLvl = m.level || 0.3; break;
        default: break;
      }
    }
    noteOn(note, vel) {
      const P = this.P; const model = P.inst; const mono = P.mono > 0.5;
      const sustained = model === 'erhu' || model === 'dizi' || model === 'guan' || model === 'strings';
      let v;
      if (mono) {
        v = this.voices[0];
        this.noteStack = this.noteStack.filter((n) => n !== note); this.noteStack.push(note);
        if (v.active && v.gate && sustained) { v.legato(note); this.lastFreq = mtof(note); return; }
        const start = P.glide > 0.002 && this.lastFreq ? (v.active ? v.cur : this.lastFreq) : null;
        v.noteOn(model, note, vel, P, start);
      } else {
        const maxV = Math.max(1, Math.min(8, Math.round(P.voices || 8)));
        for (let i = 0; i < maxV; i++) if (!this.voices[i].active) { v = this.voices[i]; break; }
        if (!v) { // steal: released first, then quietest/oldest
          let best = null, bestScore = -1;
          for (let i = 0; i < maxV; i++) { const c = this.voices[i]; const sc = (c.gate ? 0 : 1e6) + c.age / (c.lim + 1e-3); if (sc > bestScore) { bestScore = sc; best = c; } }
          v = best;
        }
        const start = P.glide > 0.002 && this.lastFreq ? this.lastFreq : null;
        v.noteOn(model, note, vel, P, start);
      }
      this.lastFreq = mtof(note);
    }
    noteOff(note) {
      const P = this.P;
      if (P.mono > 0.5) {
        this.noteStack = this.noteStack.filter((n) => n !== note);
        const v = this.voices[0];
        if (v.active && v.note === note) {
          const sustained = v.model === 'erhu' || v.model === 'dizi' || v.model === 'guan' || v.model === 'strings';
          if (this.noteStack.length && sustained) v.legato(this.noteStack[this.noteStack.length - 1]); else v.off();
        }
        return;
      }
      for (const v of this.voices) if (v.active && v.gate && v.note === note) v.off();
    }
    process(inputs, outputs) {
      const o = outputs[0]; if (!o || !o[0]) return true;
      const L = o[0], R = o[1] || o[0]; const n = L.length; const P = this.P;
      L.fill(0); if (R !== L) R.fill(0);
      for (const v of this.voices) {
        if (!v.active) continue; v.age++;
        const pl = v.panL, pr = v.panR;
        for (let i = 0; i < n; i++) { const s = v.tick(P); L[i] += s * pl; if (R !== L) R[i] += s * pr; }
      }
      if (this.geiger > 0) { // 盖革计数器咔嗒声
        for (let i = 0; i < n; i++) {
          const s = (Math.random() * 2 - 1) * this.geiger * this.geigerLvl;
          this.geiger *= 0.985; L[i] += s; if (R !== L) R[i] += s;
        }
        if (this.geiger < 1e-3) this.geiger = 0;
      }
      return true;
    }
  }

  /* ---------- 放大器: 二极管 / 电子管 / 箱体 ---------- */
  function dclip(v, thP, thN) {
    const a = Math.abs(v); const th = v >= 0 ? thP : thN;
    if (a < th) return v;
    const nVt = 0.24;
    return Math.sign(v) * (th + nVt * Math.log(1 + (a - th) / nVt));
  }
  class AmpChannel {
    constructor() {
      this.env = 0; this.prev = 0; this.dc = new DCBlock(); this.tLP = new OnePole(Math.exp(-TWO_PI * 9000 / SR), 1);
      this.cab = [new Biquad(), new Biquad(), new Biquad()]; this.cabType = -1;
      this.crushHold = 0; this.crushCnt = 0; this.humPh = 0;
    }
    setCab(t) {
      this.cabType = t; for (const b of this.cab) b.reset();
      if (t === 1) { this.cab[0].peak(220, 1.5, 4); this.cab[1].peak(1200, 2, 3); this.cab[2].lp(7500, 0.7); }
      else if (t === 2) { this.cab[0].hp(80, 0.7); this.cab[1].peak(2400, 1.5, 5); this.cab[2].lp(4200, 0.9); }
      else if (t === 3) { this.cab[0].peak(90, 2, 6); this.cab[1].peak(3500, 4, 6); this.cab[2].lp(6000, 1.2); }
    }
    run(x, y, A) {
      const n = x.length; const cabT = Math.round(A.cabType);
      if (cabT !== this.cabType) this.setCab(cabT);
      const crush = A.vnOn > 0.5 && A.vnCrush > 0;
      const step = 1 + Math.floor(A.vnCrush * 40); const q = Math.pow(2, 16 - A.vnCrush * 12);
      const pu = A.pure || 0, pk = 1 - pu; const dioMix = A.dioMix * pk, tubeMix = A.tubeMix * pk, cabMix = A.cabMix * (1 - pu * 0.7);
      const dg = 1 + A.dioDrive * A.dioDrive * 24, thP = 0.3 + A.dioAsym * 0.4, thN = 0.7 - A.dioAsym * 0.4;
      const dNorm = 1 / (0.5 + (thP + thN) * 0.5);
      const tb = Math.min(1.2, A.tubeBias * 0.8 + (A.tubeBiasOffset || 0)), tbT = Math.tanh(tb), xo = A.tubeXover * 0.2;
      const humInc = TWO_PI * 50 / SR;
      for (let i = 0; i < n; i++) {
        let s = x[i] * A.ampIn;
        if (crush) { if (++this.crushCnt >= step) { this.crushCnt = 0; this.crushHold = Math.round(s * q) / q; } s = this.crushHold; }
        if (dioMix > 0) {
          const s0 = (this.prev + s) * 0.5; this.prev = s;
          const d = (dclip(s0 * dg, thP, thN) + dclip(s * dg, thP, thN)) * 0.5 * dNorm * 0.6;
          s = s * (1 - dioMix) + d * dioMix;
        } else this.prev = s;
        if (tubeMix > 0) {
          const g = (1 + A.tubeDrive * A.tubeDrive * 30) / (1 + A.tubeSag * 3 * this.env);
          let t = Math.tanh(s * g + tb) - tbT;
          if (xo > 0) { t = t > xo ? t - xo : t < -xo ? t + xo : 0; t /= 1 - xo; }
          const at = Math.abs(t); this.env += (at - this.env) * (at > this.env ? 0.003 : 0.00004);
          t = this.tLP.tick(t); t = this.dc.tick(t);
          t *= 0.85 / Math.pow(g, 0.25);
          s = s * (1 - tubeMix) + t * tubeMix;
        }
        if (cabT > 0 && cabMix > 0) { let c = s; for (let k = 0; k < 3; k++) c = this.cab[k].tick(c); s = s * (1 - cabMix) + c * cabMix; }
        if (A.ampHum > 0 && pu < 0.99) { this.humPh += humInc; if (this.humPh > TWO_PI) this.humPh -= TWO_PI; s += (Math.sin(this.humPh) * 0.02 + Math.sin(2 * this.humPh) * 0.008) * A.ampHum; }
        if (A.ampHiss > 0) s += (Math.random() - 0.5) * A.ampHiss * 0.012 * pk;
        y[i] = s * A.ampOut;
      }
    }
  }
  class AmpProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.A = { ampIn: 1, dioDrive: 0.2, dioAsym: 0.3, dioMix: 0, tubeDrive: 0.25, tubeBias: 0.2, tubeSag: 0.3, tubeXover: 0, tubeMix: 0.5, cabType: 1, cabMix: 0.5, ampHum: 0, ampHiss: 0, ampOut: 0.8, vnOn: 0, vnCrush: 0 };
      this.ch = [new AmpChannel(), new AmpChannel()];
      this.port.onmessage = (e) => { if (e.data.type === 'params') Object.assign(this.A, e.data.A); };
    }
    process(inputs, outputs) {
      const inp = inputs[0], out = outputs[0];
      if (!out || !out[0]) return true;
      if (!inp || !inp.length) { for (const c of out) c.fill(0); return true; }
      for (let c = 0; c < out.length; c++) this.ch[c].run(inp[c] || inp[0], out[c], this.A);
      return true;
    }
  }

  /* ---------- 录音: 把主输出的 PCM 分块送回主线程 ---------- */
  class RecProcessor extends AudioWorkletProcessor {
    constructor() { super(); this.on = false; this.L = []; this.R = []; this.n = 0; this.port.onmessage = (e) => { if (e.data.type === 'rec') { this.on = !!e.data.on; if (!this.on) this.flush(); } }; }
    flush() { if (!this.n) return; const l = new Float32Array(this.n), r = new Float32Array(this.n); let o = 0; for (let i = 0; i < this.L.length; i++) { l.set(this.L[i], o); r.set(this.R[i], o); o += this.L[i].length; } this.L = []; this.R = []; this.n = 0; this.port.postMessage({ l, r }, [l.buffer, r.buffer]); }
    process(inputs, outputs) {
      const i = inputs[0]; const o = outputs[0]; if (o && o[0]) for (const c of o) c.fill(0);
      if (this.on && i && i[0]) { this.L.push(i[0].slice()); this.R.push((i[1] || i[0]).slice()); this.n += i[0].length; if (this.n >= 8192) this.flush(); }
      return true;
    }
  }
  registerProcessor('shisui-synth', SynthProcessor);
  registerProcessor('shisui-amp', AmpProcessor);
  registerProcessor('shisui-rec', RecProcessor);
}
if (typeof window !== 'undefined') window.DSP_WORKLET_SRC = '(' + DSP_WORKLET_MAIN.toString() + ')();';
if (typeof module !== 'undefined') module.exports = { DSP_WORKLET_MAIN };
