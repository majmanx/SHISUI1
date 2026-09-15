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
  /* 原声: 每件乐器最接近真实乐器的设置 + 它像哪件传世乐器 */
  const ACOUSTIC = {
    guzheng: { name: '原声 · 古筝', patch: { inst: 'guzheng', 'gz.bright': 0.66, 'gz.decay': 6.5, 'gz.pos': 0.16, 'gz.stiff': 0.12, 'gz.nail': 0.4, 'gz.damp': 0.5, 'vib.depth': 12, 'rev.mix': 0.18, 'rev.size': 2.2, 'rev.damp': 0.6, 'cab.type': 1, 'cab.mix': 0.35, 'tone.pure': 0.55 },
      like: '二十一弦 S 形岳山钢丝尼龙缠弦筝（上海敦煌 / 扬州式）', why: '钢芯尼龙弦的明亮起音、6–7 秒的长余音和轻微的金属色散，都来自钢丝弦筝；把"弦刚度"再抬一点更像老式钢丝弦，降到 0 则接近古法丝弦的柔暗。' },
    erhu: { name: '原声 · 二胡', patch: { inst: 'erhu', mono: 1, glide: 0.09, 'env.a': 0.07, 'env.s': 1, 'env.r': 0.2, 'vib.rate': 5.4, 'vib.depth': 30, 'vib.delay': 0.3, 'er.pressure': 0.5, 'er.pos': 0.13, 'er.rosin': 0.15, 'er.body': 0.7, 'rev.mix': 0.22, 'rev.size': 2.6, 'cab.type': 1, 'cab.mix': 0.3, 'tone.pure': 0.5 },
      like: '老红木六角琴筒蟒皮二胡（苏州式）', why: '鼻音来自六角筒 + 蟒皮在 450–900 Hz 的共振峰，弓压 50% 左右是"揉而不燥"的中庸弓法；弓压降到 30% 更飘更软，升到 80% 则接近京胡的紧张感。' },
    dizi: { name: '原声 · 竹笛', patch: { inst: 'dizi', mono: 1, glide: 0.03, 'env.a': 0.05, 'env.s': 1, 'env.r': 0.12, 'vib.rate': 5.6, 'vib.depth': 16, 'dz.breath': 1.35, 'dz.jet': 0.32, 'dz.noise': 0.12, 'dz.membrane': 0.42, 'rev.mix': 0.22, 'rev.size': 2.4, 'cab.type': 0, 'tone.pure': 0.45 },
      like: 'C 调苦竹曲笛（余杭 / 玉屏工艺），贴芦苇笛膜', why: '"笛膜"旋钮就是芦苇膜的嗡鸣，42% 是南派曲笛的温润；拧到 70% 以上、风门抬到 0.45 就成了北派梆笛的亮与脆。' },
    guan: { name: '原声 · 唢呐', patch: { inst: 'guan', mono: 1, glide: 0.05, 'env.a': 0.02, 'env.s': 1, 'env.r': 0.08, 'vib.rate': 6.2, 'vib.depth': 24, 'gn.breath': 0.7, 'gn.reed': 0.4, 'gn.noise': 0.08, 'gn.bell': 0.7, 'rev.mix': 0.2, 'rev.size': 2.4, 'cab.type': 1, 'cab.mix': 0.25, 'tone.pure': 0.45 },
      like: 'D 调高音唢呐（河北 / 山东民间制式，铜碗杆身）', why: '"喇叭口"是铜碗的辉煌，70% 是喜庆吹打的亮度；降到 10% 并把簧片硬度抬到 0.8，就是同一家族里深沉的管子（筚篥）。' },
    strings: { name: '原声 · 弦乐群', patch: { inst: 'strings', 'env.a': 0.6, 'env.d': 1, 'env.s': 0.85, 'env.r': 1.2, 'st.detune': 10, 'st.pw': 0.15, 'cho.mix': 0.45, 'cho.depth': 0.35, 'cho.rate': 0.5, 'flt.cutoff': 5200, 'flt.res': 0.5, 'rev.mix': 0.3, 'rev.size': 3.5, 'cab.type': 0, 'tone.pure': 0.4 },
      like: '七十年代弦乐机（Solina / ARP String Ensemble 一类）', why: '这一路不是真弦乐，而是分频振荡器 + 三相合唱的"弦乐机"味道；合唱混合 45% 与三路失谐 10 音分正是那种丝绸感的来源。想更像真弦乐群就把合唱降到 20%、起音拉长到 1 秒。' },
  };
  const PRESETS = [
    { name: '清筝 · 初雪', tags: ['古筝', '干净', '入门'], patch: { inst: 'guzheng', 'gz.bright': 0.72, 'gz.decay': 6, 'gz.nail': 0.45, 'rev.mix': 0.28, 'rev.size': 3, 'dly.mix': 0.06, 'tube.mix': 0.15, 'tone.pure': 0.35 } },
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
  Object.assign(root.SHISUI, { PRESETS, DEFAULT_MODS, ACOUSTIC });
})(typeof window !== 'undefined' ? window : globalThis);
