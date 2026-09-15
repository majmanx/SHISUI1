/* ============================================================
   石髓 SHISUI · 随机接口
   三种随机源：
   1) crypto  —— 浏览器真随机 (crypto.getRandomValues)
   2) pi      —— 圆周率数字流 (Gibbons 无界螺旋算法, BigInt, 即时计算)
   3) c14     —— 碳-14 放射性衰变过程模拟 (泊松过程, 半衰期 5730 年)
   随机总线 RandomBus 把它们汇成 4 个接口 R1..R4 (0..1)，
   支持手动刷新 / 自动刷新 / 平滑。
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 真随机 ---------- */
  const Crypto = {
    name: 'crypto',
    buf: new Uint32Array(64), idx: 64, hexLog: [],
    fill() { if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(this.buf); else for (let i = 0; i < this.buf.length; i++) this.buf[i] = (Math.random() * 4294967296) >>> 0; this.idx = 0; },
    next() { if (this.idx >= this.buf.length) this.fill(); const v = this.buf[this.idx++]; this.hexLog.push(v.toString(16).padStart(8, '0')); if (this.hexLog.length > 24) this.hexLog.shift(); return v / 4294967296; },
  };

  /* ---------- 圆周率螺旋 (Gibbons 2006, 无界) ---------- */
  class PiSpigot {
    constructor() { this.q = 1n; this.r = 0n; this.t = 1n; this.k = 1n; this.n = 3n; this.l = 3n; this.digits = []; this.pos = 0; this.busy = false; }
    _gen(count) {
      let out = 0;
      while (out < count) {
        if (4n * this.q + this.r - this.t < this.n * this.t) {
          this.digits.push(Number(this.n)); out++;
          const nq = 10n * this.q, nr = 10n * (this.r - this.n * this.t);
          const nn = (10n * (3n * this.q + this.r)) / this.t - 10n * this.n;
          this.q = nq; this.r = nr; this.n = nn;
        } else {
          const nq = this.q * this.k, nr = (2n * this.q + this.r) * this.l, nt = this.t * this.l;
          const nn = (this.q * (7n * this.k + 2n) + this.r * this.l) / (this.t * this.l);
          this.q = nq; this.r = nr; this.t = nt; this.n = nn; this.k += 1n; this.l += 2n;
        }
      }
    }
    ensure(n) { if (this.digits.length < n) this._gen(Math.min(400, n - this.digits.length + 100)); }
    /* 取 4 位数字 → 0..1 */
    next() { this.ensure(this.pos + 4); let v = 0; for (let i = 0; i < 4; i++) v = v * 10 + this.digits[this.pos + i]; this.pos += 4; return v / 10000; }
    digit(i) { this.ensure(i + 1); return this.digits[i]; }
    seek(p) { this.pos = Math.max(0, p | 0); this.ensure(this.pos + 4); }
    window(before, after) { const s = Math.max(0, this.pos - before); this.ensure(this.pos + after); return { start: s, digits: this.digits.slice(s, this.pos + after) }; }
  }

  /* ---------- 碳-14 衰变 (泊松过程) ---------- */
  const HALF_LIFE_YEARS = 5730;
  const LAMBDA = Math.LN2 / HALF_LIFE_YEARS; // 每年
  class C14 {
    constructor() { this.reset(1e4); this.speed = 20; this.events = []; this.lastCount = 0; this.window = []; this.total = 0; this.onDecay = null; this.lastT = 0; this.ratePerSec = 0; this.lastVal = 0.5; }
    reset(n) { this.N0 = n; this.N = n; this.t = 0; this.total = 0; this.window = []; this.lastVal = 0.5; }
    /* 泊松采样 (Knuth 小均值 / 正态近似大均值) */
    static poisson(mu, rnd) {
      if (mu <= 0) return 0;
      if (mu < 30) { const L = Math.exp(-mu); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
      let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return Math.max(0, Math.round(mu + Math.sqrt(mu) * z));
    }
    static pit(k, mu, r) {
      if (mu < 60) {
        let p = Math.exp(-mu), cdf = 0;
        for (let i = 0; i < k; i++) { cdf += p; p *= mu / (i + 1); }
        return Math.min(1, Math.max(0, cdf + r * p));
      }
      const z = (k - 0.5 + r - mu) / Math.sqrt(mu);
      return 0.5 * (1 + C14.erf(z / Math.SQRT2));
    }
    static erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
    /* 推进 dt 现实秒 → 模拟 dt*speed 年 */
    step(dt, rnd) {
      const years = dt * this.speed; this.t += years;
      const mu = this.N * LAMBDA * years;
      const k = Math.min(this.N, C14.poisson(mu, rnd));
      this.N -= k; this.total += k; this.lastCount = k;
      this.ratePerSec = this.ratePerSec * 0.9 + (k / Math.max(dt, 1e-3)) * 0.1;
      this.window.push(k); if (this.window.length > 120) this.window.shift();
      // 随机化概率积分变换 (randomized PIT)：
      // 观测到的衰变计数 k 相对泊松分布的 CDF 位置 → 严格均匀分布的 0..1 随机值。
      const r = rnd(); this.lastVal = C14.pit(k, mu, r);
      if (k > 0 && this.onDecay) { // 条件于"至少一次衰变"的 PIT, 保证事件值均匀分布
        const p0 = Math.exp(-mu); const cv = p0 < 0.999 ? Math.min(1, Math.max(0, (this.lastVal - p0) / (1 - p0))) : r;
        this.onDecay(k, cv);
      }
      return k;
    }
    next() { return this.lastVal; }
    get age() { return this.t; }
    get halfLives() { return this.t / HALF_LIFE_YEARS; }
  }

  /* ---------- 随机总线 ---------- */
  class RandomBus {
    constructor() {
      this.pi = new PiSpigot(); this.c14 = new C14(); this.crypto = Crypto;
      this.source = 'c14'; this.raw = [0.5, 0.5, 0.5, 0.5]; this.val = [0.5, 0.5, 0.5, 0.5];
      this.slew = 0.3; this.rate = 0; this._acc = 0; this.onRefresh = null; this.lastSrcUsed = [];
      this.decayDrive = true; this._rot = 0; this._lastDecayRefresh = 0; this.onDecay = null;
      this.pi.ensure(200);
      // 碳-14 源: 每次衰变事件轮流刷新一个接口 ("衰变即刷新")
      this.c14.onDecay = (k, v) => {
        if (this.onDecay) this.onDecay(k, v);
        if (!this.decayDrive || (this.source !== 'c14' && this.source !== 'mix')) return;
        const now = performance.now(); if (now - this._lastDecayRefresh < 50) return; this._lastDecayRefresh = now;
        const i = this._rot++ & 3; this.raw[i] = v; this.lastSrcUsed[i] = 'C14';
        if (this.onRefresh) this.onRefresh(this.raw.slice(), i);
      };
    }
    /* 取一个 0..1 随机数, 返回 [值, 来源] */
    draw(src) {
      src = src || this.source;
      if (src === 'mix') { const r = Crypto.next(); src = r < 0.34 ? 'crypto' : r < 0.67 ? 'pi' : 'c14'; }
      if (src === 'pi') return [this.pi.next(), 'π'];
      if (src === 'c14') { // 混入衰变值与真随机低位，避免长时间无衰变时数值死板
        const v = this.c14.next(); const j = Crypto.next() * 0.02; return [Math.min(1, Math.max(0, v * 0.98 + j)), 'C14'];
      }
      return [Crypto.next(), 'crypto'];
    }
    refresh() { this.lastSrcUsed = []; for (let i = 0; i < 4; i++) { const [v, s] = this.draw(); this.raw[i] = v; this.lastSrcUsed.push(s); } if (this.onRefresh) this.onRefresh(this.raw.slice()); }
    /* 每帧推进 */
    tick(dt) {
      this.c14.step(dt, () => Crypto.next());
      if (this.rate > 0.05) { this._acc += dt * this.rate; if (this._acc >= 1) { this._acc = 0; this.refresh(); } }
      const k = this.slew <= 0.001 ? 1 : 1 - Math.exp(-dt / (this.slew * 1.5 + 0.01));
      for (let i = 0; i < 4; i++) this.val[i] += (this.raw[i] - this.val[i]) * k;
    }
    get(i) { return this.val[i]; }
  }

  root.SHISUI = root.SHISUI || {};
  Object.assign(root.SHISUI, { Crypto, PiSpigot, C14, RandomBus, HALF_LIFE_YEARS, LAMBDA });
})(typeof window !== 'undefined' ? window : globalThis);
