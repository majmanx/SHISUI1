/* ============================================================
   石髓 SHISUI · 出厂预设
   每个预设只写与默认值不同的参数；mods 为调制矩阵条目 [源, 目标, 量]。
   ============================================================ */
(function (root) {
  'use strict';
  const DEFAULT_MODS = [
    ['M1', 'tube.drive', 0.6], ['M1', 'dio.mix', 0.5], ['M1', 'el.drive', 0.4],
    ['M2', 'flt.cutoff', 0.45], ['M2', 'gz.bright', 0.35], ['M2', 'dz.membrane', 0.3],
    ['M3', 'rev.mix', 0.55], ['M3', 'dly.mix', 0.35], ['M3', 'rev.size', 0.3],
    ['M4', 'vn.on', 1], ['M4', 'vn.amt', 0.8], ['M4', 'vn.crush', 0.5], ['M4', 'cab.type', 0.6],
  ];
  const PRESETS = [
    { name: '清筝 · 初雪', tags: ['古筝', '干净', '入门'], patch: { inst: 'guzheng', 'gz.bright': 0.72, 'gz.decay': 6, 'rev.mix': 0.28, 'rev.size': 3, 'dly.mix': 0.08 } },
    { name: '电筝 · 断电重启', tags: ['古筝', '插电', '斗破'], patch: { inst: 'guzheng', 'el.blend': 0.75, 'el.drive': 0.7, 'el.bias': 0.4, 'el.synth': 0.35, 'el.wave': 1, 'el.sub': 0.4, 'dio.mix': 0.6, 'dio.drive': 0.45, 'tube.drive': 0.5, 'tube.mix': 0.8, 'cab.type': 2, 'cab.mix': 0.8, 'dly.mix': 0.22, 'gz.stiff': 0.35, 'mac.1': 0.5 } },
    { name: '摇指 · 流水', tags: ['古筝', '摇指', '技法'], patch: { inst: 'guzheng', 'gz.yaozhi': 11, 'gz.slide': 2, 'gz.slideTime': 0.18, 'gz.bright': 0.6, 'gz.decay': 3, 'rev.mix': 0.4, 'rev.size': 4, 'vib.depth': 12 } },
    { name: '夜胡 · 二泉', tags: ['二胡', '独奏', '入门'], patch: { inst: 'erhu', mono: 1, glide: 0.12, 'env.a': 0.09, 'env.s': 1, 'env.r': 0.25, 'vib.rate': 5.2, 'vib.depth': 32, 'vib.delay': 0.35, 'er.pressure': 0.5, 'er.body': 0.7, 'rev.mix': 0.35, 'rev.size': 3.5, 'flt.cutoff': 7000 } },
    { name: '毒液胡 · 蟒皮通电', tags: ['二胡', '毒液', '插电', '斗破'], patch: { inst: 'erhu', mono: 1, glide: 0.08, 'env.a': 0.05, 'env.s': 1, 'vib.depth': 40, 'er.pressure': 0.8, 'er.rosin': 0.35, 'el.blend': 0.6, 'el.drive': 0.8, 'el.sub': 0.5, 'vn.on': 1, 'vn.amt': 0.6, 'vn.fold': 0.5, 'vn.fm': 0.35, 'vn.crush': 0.25, 'vn.ooze': 0.4, 'tube.drive': 0.7, 'tube.sag': 0.6, 'tube.mix': 0.9, 'cab.type': 3, 'cab.mix': 0.7, 'dly.mix': 0.25, 'dly.fb': 0.5, 'mac.4': 0.7 } },
    { name: '竹笛 · 姑苏行', tags: ['竹笛', '独奏', '入门'], patch: { inst: 'dizi', mono: 1, glide: 0.03, 'env.a': 0.04, 'env.s': 1, 'env.r': 0.12, 'vib.rate': 5.8, 'vib.depth': 18, 'dz.breath': 1.4, 'dz.membrane': 0.45, 'dz.noise': 0.18, 'rev.mix': 0.33, 'rev.size': 2.8 } },
    { name: '云笛 · 雾中石厅', tags: ['竹笛', '氛围', '空间'], patch: { inst: 'dizi', mono: 0, 'env.a': 0.4, 'env.s': 1, 'env.r': 1.8, 'dz.breath': 1.2, 'dz.noise': 0.3, 'dz.membrane': 0.1, 'rev.mix': 0.65, 'rev.size': 7, 'rev.damp': 0.7, 'dly.mix': 0.35, 'dly.time': 0.66, 'dly.fb': 0.6, 'cho.mix': 0.35, 'flt.cutoff': 5000, 'flt.lfoDepth': 0.2, 'flt.lfoRate': 0.12 } },
    { name: '唢呐 · 百鸟朝凤', tags: ['管子', '唢呐', '斗破'], patch: { inst: 'guan', mono: 1, glide: 0.06, 'env.a': 0.02, 'env.s': 1, 'env.r': 0.08, 'vib.rate': 6.5, 'vib.depth': 28, 'gn.breath': 0.8, 'gn.reed': 0.35, 'gn.bell': 0.8, 'gn.noise': 0.08, 'tube.drive': 0.4, 'tube.mix': 0.7, 'cab.type': 1, 'rev.mix': 0.25, 'flt.cutoff': 12000 } },
    { name: '管子 · 古寺', tags: ['管子', '低沉', '氛围'], patch: { inst: 'guan', mono: 1, glide: 0.15, 'env.a': 0.12, 'env.s': 1, 'env.r': 0.4, 'vib.depth': 15, 'gn.breath': 0.3, 'gn.reed': 0.8, 'gn.bell': 0.05, 'gn.noise': 0.2, 'flt.cutoff': 3200, 'rev.mix': 0.5, 'rev.size': 6 } },
    { name: '弦群 · 晨光', tags: ['弦乐', '铺底', '入门'], patch: { inst: 'strings', 'env.a': 0.9, 'env.d': 1, 'env.s': 0.85, 'env.r': 1.6, 'st.detune': 14, 'st.pw': 0.25, 'cho.mix': 0.5, 'cho.depth': 0.4, 'flt.cutoff': 4200, 'flt.res': 0.6, 'rev.mix': 0.45, 'rev.size': 4.5, spread: 0.9 } },
    { name: '毒液低音 · 香蕉插电', tags: ['低音', '毒液', '搞笑'], patch: { inst: 'strings', mono: 1, glide: 0.1, 'env.a': 0.005, 'env.d': 0.35, 'env.s': 0.6, 'env.r': 0.15, 'st.detune': 6, 'st.pw': 0.6, 'el.sub': 0.9, 'vn.on': 1, 'vn.amt': 0.8, 'vn.fold': 0.7, 'vn.fm': 0.5, 'vn.crush': 0.4, 'vn.ooze': 0.15, 'flt.cutoff': 900, 'flt.res': 5, 'flt.lfoDepth': 0.35, 'flt.lfoRate': 4, 'dio.mix': 0.7, 'dio.drive': 0.6, 'cab.type': 3, 'cab.mix': 0.6, 'comp.amount': 0.6, 'rev.mix': 0.1, 'mac.4': 0.8 } },
    { name: '碳衰变 · 琶音钟', tags: ['生成', '碳-14', '古筝'], patch: { inst: 'guzheng', 'gz.bright': 0.8, 'gz.decay': 8, 'c14.prob': 0.6, 'c14.scale': 'yu', 'c14.click': 1, 'c14.speed': 15, 'rnd.source': 'c14', 'rnd.slew': 0.5, 'rev.mix': 0.5, 'rev.size': 5, 'dly.mix': 0.3, 'dly.time': 0.5, 'dly.fb': 0.45 }, mods: [['R1', 'gz.pos', 0.5], ['R2', 'flt.cutoff', 0.35], ['DECAY', 'gz.bright', 0.3]] },
    { name: 'π 序列 · 无理数之歌', tags: ['生成', 'π', '弦乐'], patch: { inst: 'strings', 'env.a': 0.02, 'env.d': 0.3, 'env.s': 0.5, 'env.r': 0.3, 'arp.mode': 'pi', 'arp.rate': 4, 'arp.oct': 2, bpm: 110, 'rnd.source': 'pi', 'rnd.rate': 2, 'rnd.slew': 0.1, 'flt.cutoff': 2500, 'flt.res': 3, 'dly.mix': 0.3, 'dly.time': 0.27, 'rev.mix': 0.3 }, mods: [['R1', 'flt.cutoff', 0.6], ['R2', 'st.pw', 0.8], ['R3', 'dly.fb', 0.3]] },
    { name: '真随机 · 液态金属', tags: ['毒液', '随机', '二胡'], patch: { inst: 'erhu', mono: 0, 'env.a': 0.2, 'env.s': 1, 'env.r': 0.6, 'er.pressure': 0.65, 'rnd.source': 'crypto', 'rnd.rate': 0.5, 'rnd.slew': 0.9, 'vn.on': 1, 'vn.amt': 0.4, 'vn.ooze': 0.8, 'vn.fm': 0.2, 'vn.fold': 0.2, 'cho.mix': 0.4, 'rev.mix': 0.5, 'rev.size': 6, 'cab.type': 3, 'cab.mix': 0.4 }, mods: [['R1', 'er.pos', 0.7], ['R2', 'vn.fold', 0.6], ['R3', 'flt.cutoff', 0.4], ['R4', 'vib.rate', 0.5], ['LFO1', 'vn.amt', 0.3]] },
    { name: '古筝 · 真空管咖啡馆', tags: ['古筝', '电子管', '温暖'], patch: { inst: 'guzheng', 'gz.bright': 0.5, 'gz.nail': 0.35, 'gz.decay': 4, 'el.blend': 0.4, 'el.drive': 0.25, 'tube.drive': 0.35, 'tube.bias': 0.45, 'tube.sag': 0.55, 'tube.mix': 0.85, 'amp.hum': 0.25, 'amp.hiss': 0.2, 'cab.type': 2, 'cab.mix': 0.6, 'rev.mix': 0.22, 'cho.mix': 0.15 } },
    { name: '弦管齐鸣 · 斗破', tags: ['管子', '插电', '斗破', '主奏'], patch: { inst: 'guan', mono: 1, glide: 0.04, 'env.a': 0.01, 'env.s': 1, 'env.r': 0.1, 'vib.depth': 35, 'vib.rate': 6.2, 'gn.breath': 0.9, 'gn.reed': 0.2, 'gn.bell': 0.9, 'el.blend': 0.5, 'el.drive': 0.9, 'el.synth': 0.5, 'el.wave': 0, 'el.detune': -12, 'el.sub': 0.3, 'dio.mix': 0.5, 'dio.drive': 0.7, 'dio.asym': 0.6, 'tube.drive': 0.8, 'tube.mix': 1, 'tube.sag': 0.4, 'cab.type': 2, 'cab.mix': 0.9, 'dly.mix': 0.3, 'dly.time': 0.31, 'rev.mix': 0.3, 'comp.amount': 0.5, 'mac.1': 0.7 } },
  ];
  root.SHISUI = root.SHISUI || {};
  Object.assign(root.SHISUI, { PRESETS, DEFAULT_MODS });
})(typeof window !== 'undefined' ? window : globalThis);
