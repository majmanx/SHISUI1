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
  /* 鎏金大理石: 白/炭黑底 + 云纹 + 灰脉与细裂纹 + 沿脉堆积的金箔簇 + 金粉闪点 */
  function genGilded(o) {
    const size = o.size || 384; const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size); const d = img.data; const dark = !!o.dark;
    const fCloud = makeNoise(o.seed), fVein = makeNoise(o.seed * 3 + 1), fCrack = makeNoise(o.seed * 5 + 2), fDet = makeNoise(o.seed * 7 + 3), fMask = makeNoise(o.seed * 11 + 4);
    let rs = (o.seed * 2654435761) >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const goldAmt = o.gold == null ? 1 : o.gold;
    const fCrin = makeNoise(o.seed * 13 + 6), fWidth = makeNoise(o.seed * 17 + 8);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const cloud = fCloud(u * 2.0, v * 2.0, 3);
      const vn = fVein(u * 3.0 + 7, v * 3.0 + 2, 4);
      const cr = fCrack(u * 5.5 + 3, v * 5.5 + 9, 4);
      const det = fDet(u * 30, v * 30, 2);
      const crin = fCrin(u * 60, v * 60, 2);
      const mask = fMask(u * 3.6 + 11, v * 3.6 + 5, 3);
      const wv = fWidth(u * 2.5 + 4, v * 2.5 + 6, 2); // 脉络宽窄变化
      // 底色: 云纹 (柔和灰白)
      let g = dark ? 30 + (cloud - 0.5) * 44 : 247 - (cloud - 0.5) * 64;
      // 灰脉: 宽而柔的晕 + 断续的深色芯
      const soft = Math.exp(-Math.pow((vn - 0.5) / (0.05 + 0.07 * wv), 2)) * (0.25 + 0.5 * wv);
      const core = Math.exp(-Math.pow((vn - 0.5) / 0.011, 2)) * sm(0.42, 0.55, mask + (det - 0.5) * 0.2);
      const crack = Math.exp(-Math.pow((cr - 0.5) / 0.006, 2)) * sm(0.45, 0.6, wv);
      g += dark ? soft * 70 + core * 95 + crack * 80 : -soft * 58 - core * 95 - crack * 80;
      let r = g, gg = g, bb = g + (dark ? 7 : 5);
      // 金箔: (1) 沿脉络的金丝带 (2) 团簇金箔; 边缘由高频噪声撕碎
      const ribbon = Math.exp(-Math.pow((cr - 0.5) / 0.03, 2)) * sm(0.5, 0.58, mask + (det - 0.5) * 0.3);
      const cluster = Math.exp(-Math.pow((vn - 0.5) / 0.09, 2)) * sm(0.56, 0.62, mask * 0.8 + det * 0.2 + crin * 0.08);
      let leaf = Math.min(1, (ribbon + cluster) * goldAmt);
      leaf = sm(0.18, 0.5, leaf); // 边缘更硬, 像真金箔的碎边
      if (leaf > 0.01) {
        // 金箔褶皱: 高频 crin 决定明暗, 加上斜向高光条纹 → 金属感
        const fold = crin * 0.6 + det * 0.4; const streak = 0.5 + 0.5 * Math.sin((u + v) * 140 + fold * 9); const grain = rnd();
        const l = Math.pow(fold, 1.2) * 0.75 + streak * 0.12 + grain * 0.22;
        const gr = 120 + 135 * l, gG = 78 + 150 * l, gB = 18 + 110 * l * l;
        r += (gr - r) * leaf; gg += (gG - gg) * leaf; bb += (gB - bb) * leaf;
        if (rnd() < 0.03 * leaf) { r = 255; gg = 240; bb = 170; } // 金箔上的闪点
      }
      // 金粉: 零散闪点
      if (rnd() < 0.002 * goldAmt * (0.3 + mask)) { r = 250; gg = 214; bb = 110; }
      const i = (y * size + x) * 4; d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg; d[i + 2] = bb < 0 ? 0 : bb > 255 ? 255 : bb; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // 金箔整体轻微高光 (斜向)
    const sheen = ctx.createLinearGradient(0, 0, size, size); sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.05)'); ctx.fillStyle = sheen; ctx.fillRect(0, 0, size, size);
    return cv.toDataURL('image/png');
  }
  S.marbleImages = []; // 需要随纹理重生成而更新的 <image> (每个旋钮各自的图案)
  S.registerMarbleImage = (img, kind) => { S.marbleImages.push({ img, kind }); if (S.marble && S.marble[kind]) { img.setAttribute('href', S.marble[kind]); img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', S.marble[kind]); } };
  function build(goldScale) {
    if (S.marble && goldScale == null) return S.marble;
    const gs = goldScale == null ? (S.marbleGold == null ? 1 : S.marbleGold) : goldScale; S.marbleGold = gs;
    const t0 = performance.now();
    const white = genGilded({ seed: 19, size: 384, gold: gs });            // 白鎏金: 琴键 / 旋钮 / 按钮
    const cream = genGilded({ seed: 23, size: 384, gold: 0.3 * gs });      // 面板底纹: 金箔少一点
    const plate = (S.marble && S.marble.plate) || genGilded({ seed: 29, size: 320, gold: 0 }); // 沙盘石板: 无金箔的白玉
    const black = genGilded({ seed: 31, size: 384, gold: 1.25 * gs, dark: true }); // 黑鎏金: 黑键 / 毒液旋钮
    const obsidian = (S.marble && S.marble.obsidian) || genMarble({ seed: 41, size: 256, base: [15, 14, 21], vein: [44, 52, 46], metal: [120, 220, 80], freq: 4.2, veinW: 0.02, metalW: 0.005, shade: 0.16 });
    const carbon = (S.marble && S.marble.carbon) || genForgedCarbon(192, 77);
    S.marble = { white, cream, black, obsidian, carbon, plate, ms: Math.round(performance.now() - t0) };
    const st = document.documentElement.style;
    st.setProperty('--marble-white-img', 'url("' + white + '")'); st.setProperty('--marble-cream-img', 'url("' + cream + '")');
    st.setProperty('--marble-black-img', 'url("' + black + '")'); st.setProperty('--marble-obsidian-img', 'url("' + obsidian + '")');
    st.setProperty('--carbon-img', 'url("' + carbon + '")');
    const set = (id, url) => { const im = document.querySelector('#' + id + ' image'); if (im) { im.setAttribute('href', url); im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url); } };
    set('marbleKnob', white); set('marbleKnobDark', black); set('marblePlate', cream); set('marblePlateDark', obsidian);
    for (const { img, kind } of S.marbleImages) if (S.marble[kind]) { img.setAttribute('href', S.marble[kind]); img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', S.marble[kind]); }
    document.body.classList.add('marble-ready');
    return S.marble;
  }
  S.rebuildMarble = (gold) => build(gold);
  S.buildMarble = build;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => build()); else build();
})(window);
