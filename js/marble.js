/* ============================================================
   石髓 SHISUI · 程序化大理石纹理
   用值噪声 + 等值线在 Canvas 里生成白/黑大理石贴图（带液态金属脉络），
   输出 data URL，供 CSS 变量与 SVG pattern 使用。只在启动时生成一次。
   ============================================================ */
(function (root) {
  'use strict';
  const S = (root.SHISUI = root.SHISUI || {});
  function makeNoise(seed) {
    const perm = new Uint8Array(512); let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const grad = (h, x, y) => { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } };
    function noise(x, y) { // 2D Perlin, 周期 256
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y); const A = perm[X] + Y, B = perm[X + 1] + Y;
      const l1 = grad(perm[A], x, y) + u * (grad(perm[B], x - 1, y) - grad(perm[A], x, y));
      const l2 = grad(perm[A + 1], x, y - 1) + u * (grad(perm[B + 1], x - 1, y - 1) - grad(perm[A + 1], x, y - 1));
      return (l1 + v * (l2 - l1)) * 0.5 + 0.5;
    }
    return function fbm(x, y, oct) { let a = 0.5, f = 1, sum = 0, norm = 0; for (let i = 0; i < oct; i++) { sum += a * noise(x * f, y * f); norm += a; a *= 0.5; f *= 2; } return sum / norm; };
  }
  /* 生成一张 size×size 的大理石贴图 */
  function genMarble(o) {
    const size = o.size || 256; const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size); const d = img.data;
    const fbmA = makeNoise(o.seed || 1), fbmB = makeNoise((o.seed || 1) * 7 + 3), fbmC = makeNoise((o.seed || 1) * 13 + 5);
    const base = o.base, vein = o.vein, metal = o.metal, tone = o.tone || [0, 0, 0];
    const f = (o.freq || 2.2) / size, veinW = o.veinW || 0.035, metalW = o.metalW || 0.012;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = x * f, ny = y * f;
      const n1 = fbmA(nx, ny, 4); const n2 = fbmB(nx * 0.7 + 3.1, ny * 0.7 + 1.7, 3); const n3 = fbmC(nx * 0.35, ny * 0.35, 2);
      const v1 = Math.exp(-Math.pow((n1 - 0.5) / veinW, 2));          // 主脉
      const v2 = 0.35 * Math.exp(-Math.pow((n2 - 0.52) / (veinW * 1.8), 2)); // 次脉 (更淡更宽)
      const m = Math.exp(-Math.pow((n2 - 0.47) / metalW, 2));          // 液态金属脉络
      const shade = (n3 - 0.5) * (o.shade || 0.16);                      // 大尺度明暗
      const grain = ((x * 7 + y * 13) % 11) / 11 - 0.5;                  // 雾面颗粒
      let r = base[0], g = base[1], b = base[2];
      const vv = Math.min(1, v1 + v2);
      r += (vein[0] - r) * vv; g += (vein[1] - g) * vv; b += (vein[2] - b) * vv;
      const spec = 0.6 + 0.4 * Math.sin((x + y) * 0.35 + n1 * 12); // 金属高光起伏
      const mm = m * 0.85; r += (metal[0] * spec - r) * mm; g += (metal[1] * spec - g) * mm; b += (metal[2] * spec - b) * mm;
      const k = 1 + shade; r = r * k + tone[0] + grain * 3; g = g * k + tone[1] + grain * 3; b = b * k + tone[2] + grain * 3;
      const i = (y * size + x) * 4; d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return cv.toDataURL('image/png');
  }
  /* 锻造碳纤维: 随机叠放的碳片, 各向异性高光 */
  function genForgedCarbon(size, seed) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
    let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    ctx.fillStyle = '#08080b'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 300; i++) {
      const x = rnd() * size, y = rnd() * size, w = 9 + rnd() * 22, h = 4 + rnd() * 10, a = rnd() * Math.PI; const g = 16 + rnd() * 70;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      grad.addColorStop(0, 'rgb(' + (g * 0.45 | 0) + ',' + (g * 0.45 | 0) + ',' + (g * 0.55 | 0) + ')'); grad.addColorStop(0.4, 'rgb(' + (g | 0) + ',' + (g | 0) + ',' + (g * 1.1 | 0) + ')'); grad.addColorStop(0.55, 'rgb(' + (g * 1.35 | 0) + ',' + (g * 1.35 | 0) + ',' + (g * 1.45 | 0) + ')'); grad.addColorStop(1, 'rgb(' + (g * 0.4 | 0) + ',' + (g * 0.4 | 0) + ',' + (g * 0.5 | 0) + ')');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2 - h * 0.35, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + h * 0.35, h / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore();
    }
    // 树脂层: 柔和的斜向光泽
    const sheen = ctx.createLinearGradient(0, 0, size, size); sheen.addColorStop(0, 'rgba(255,255,255,0.07)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.65, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.06)'); ctx.fillStyle = sheen; ctx.fillRect(0, 0, size, size);
    return cv.toDataURL('image/png');
  }
  function build() {
    if (S.marble) return S.marble;
    const t0 = performance.now();
    // 白玉: 极淡灰脉 + 细金痕 (旋钮 / 琴键 / 按钮)
    const white = genMarble({ seed: 11, size: 256, base: [248, 246, 240], vein: [205, 198, 186], metal: [222, 186, 96], freq: 5.5, veinW: 0.016, metalW: 0.0045, shade: 0.05 });
    // 奶白: 面板底纹, 脉络稍明显但仍柔和
    const cream = genMarble({ seed: 23, size: 256, base: [245, 241, 231], vein: [200, 190, 172], metal: [214, 178, 92], freq: 4.2, veinW: 0.02, metalW: 0.005, shade: 0.06 });
    // 黑玉: 黑键 / 毒液旋钮, 银灰细脉 + 银痕
    const black = genMarble({ seed: 37, size: 256, base: [26, 24, 32], vein: [66, 62, 78], metal: [196, 196, 206], freq: 5.5, veinW: 0.016, metalW: 0.0045, shade: 0.12 });
    // 黑曜石: 毒液面板底纹, 暗绿脉 + 酸绿痕
    const obsidian = genMarble({ seed: 41, size: 256, base: [15, 14, 21], vein: [44, 52, 46], metal: [120, 220, 80], freq: 4.2, veinW: 0.02, metalW: 0.005, shade: 0.16 });
    const carbon = genForgedCarbon(192, 77);
    S.marble = { white, cream, black, obsidian, carbon, ms: Math.round(performance.now() - t0) };
    document.documentElement.style.setProperty('--carbon-img', 'url("' + carbon + '")');
    const st = document.documentElement.style;
    st.setProperty('--marble-white-img', 'url("' + white + '")'); st.setProperty('--marble-cream-img', 'url("' + cream + '")');
    st.setProperty('--marble-black-img', 'url("' + black + '")'); st.setProperty('--marble-obsidian-img', 'url("' + obsidian + '")');
    const set = (id, url) => { const im = document.querySelector('#' + id + ' image'); if (im) { im.setAttribute('href', url); im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url); } };
    set('marbleKnob', white); set('marbleKnobDark', black);
    document.body.classList.add('marble-ready');
    return S.marble;
  }
  S.buildMarble = build;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})(window);
