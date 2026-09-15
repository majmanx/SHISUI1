/* ============================================================
   石髓 SHISUI · 参数注册表
   每个参数: id, label(中文), en, group, target(synth|amp|native|host),
   min/max/def, curve(lin|log|exp), unit, fmt, tip(提示), rnd(随机安全范围, 归一化)
   ============================================================ */
(function (root) {
  'use strict';
  const K = (id, label, en, group, target, min, max, def, extra) =>
    Object.assign({ id, label, en, group, target, min, max, def, type: 'knob', curve: 'lin' }, extra || {});
  const S = (id, label, en, group, target, options, def, extra) =>
    Object.assign({ id, label, en, group, target, options, def, type: 'select' }, extra || {});
  const T = (id, label, en, group, target, def, extra) =>
    Object.assign({ id, label, en, group, target, def, type: 'toggle', min: 0, max: 1 }, extra || {});

  const s = (v) => v.toFixed(2) + ' s';
  const ms = (v) => (v < 1 ? (v * 1000).toFixed(0) + ' ms' : v.toFixed(2) + ' s');
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + ' kHz' : v.toFixed(v < 10 ? 2 : 1) + ' Hz');
  const pct = (v) => Math.round(v * 100) + '%';
  const ct = (v) => Math.round(v) + ' ct';
  const st = (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st';

  const PARAMS = [
    /* ---- 乐器与演奏 ---- */
    S('inst', '乐器', 'Instrument', 'inst', 'synth', [['guzheng', '古筝 Guzheng'], ['erhu', '二胡 Erhu'], ['dizi', '竹笛 Dizi'], ['guan', '管子·唢呐 Guan / Suona'], ['strings', '弦乐群 Strings']], 'guzheng', { tip: '物理建模核心：拨弦(古筝)、拉弦(二胡)、吹孔(竹笛)、簧片(管子/唢呐)、弦乐群(减法合成)。' }),
    T('mono', '单音连奏', 'Mono legato', 'inst', 'synth', 0, { tip: '单音模式：新音不重触发，用滑音连接。拉弦/管乐建议打开。' }),
    K('glide', '滑音', 'Glide', 'inst', 'synth', 0, 1.5, 0.05, { curve: 'exp', fmt: ms, tip: '音高过渡时间。二胡的"抹音"、唢呐的"滑腔"靠它。', rnd: [0, 0.5] }),
    K('spread', '声场', 'Spread', 'inst', 'synth', 0, 1, 0.5, { fmt: pct, tip: '每个发声单元随机左右分布。' }),
    K('voices', '复音数', 'Voices', 'inst', 'synth', 1, 8, 8, { fmt: (v) => Math.round(v) + '', step: 1, tip: '同时发声上限。CPU 紧张时降低。' }),
    K('vib.rate', '颤音速度', 'Vibrato rate', 'vib', 'synth', 0.3, 12, 5.5, { curve: 'log', fmt: hz, tip: '揉弦/颤音的速度。', rnd: [0.3, 0.8] }),
    K('vib.depth', '颤音深度', 'Vibrato depth', 'vib', 'synth', 0, 120, 20, { fmt: ct, tip: '揉弦深度(音分)。二胡 20-40，古筝按颤 10-30。', rnd: [0, 0.5] }),
    K('vib.delay', '颤音延迟', 'Vibrato delay', 'vib', 'synth', 0, 2, 0.4, { fmt: s, tip: '起音后多久才开始揉弦。' }),
    K('env.a', '起音', 'Attack', 'env', 'synth', 0.001, 4, 0.01, { curve: 'exp', fmt: ms, tip: '弓/气/合成层的起始时间。', rnd: [0, 0.5] }),
    K('env.d', '衰减', 'Decay', 'env', 'synth', 0.01, 6, 0.8, { curve: 'exp', fmt: ms, rnd: [0.2, 0.8] }),
    K('env.s', '延音', 'Sustain', 'env', 'synth', 0, 1, 0.7, { fmt: pct }),
    K('env.r', '释音', 'Release', 'env', 'synth', 0.01, 8, 0.4, { curve: 'exp', fmt: ms, rnd: [0.2, 0.7] }),
    /* ---- 古筝 ---- */
    K('gz.bright', '亮度', 'Brightness', 'guzheng', 'synth', 0, 1, 0.7, { fmt: pct, tip: '弦环路高频损耗。低=老丝弦，高=钢丝尼龙弦。', rnd: [0.3, 1] }),
    K('gz.decay', '余音', 'Decay time', 'guzheng', 'synth', 0.2, 15, 5, { curve: 'exp', fmt: s, tip: '弦的自然衰减时间。', rnd: [0.2, 0.9] }),
    K('gz.pos', '拨弦位置', 'Pluck position', 'guzheng', 'synth', 0.02, 0.5, 0.18, { fmt: pct, tip: '离岳山的距离比例。靠近琴码更亮更硬。', rnd: [0.1, 0.9] }),
    K('gz.stiff', '弦刚度', 'Stiffness', 'guzheng', 'synth', 0, 1, 0.15, { fmt: pct, tip: '钢弦的非谐性(色散)，带来金属光泽。', rnd: [0, 0.6] }),
    K('gz.nail', '义甲', 'Nail', 'guzheng', 'synth', 0, 1, 0.6, { fmt: pct, tip: '义甲硬度：拨弦噪声与攻击力。', rnd: [0.2, 1] }),
    K('gz.slide', '按滑', 'Press slide', 'guzheng', 'synth', -12, 12, 0, { fmt: st, tip: '左手按弦滑音：起音时从偏离的音高滑到目标音。正=上滑。', rnd: [0.35, 0.65] }),
    K('gz.slideTime', '按滑时长', 'Slide time', 'guzheng', 'synth', 0.02, 1.5, 0.25, { curve: 'exp', fmt: ms }),
    K('gz.yaozhi', '摇指', 'Tremolo (yaozhi)', 'guzheng', 'synth', 0, 24, 0, { fmt: (v) => (v < 0.2 ? '关 Off' : v.toFixed(1) + ' Hz'), tip: '摇指：按住琴键时以此速度反复拨弦。', rnd: [0, 0.6] }),
    K('gz.damp', '止音', 'Damping', 'guzheng', 'synth', 0, 1, 0.4, { fmt: pct, tip: '松键后手掌止音的力度。0=任其回响。' }),
    /* ---- 二胡 ---- */
    K('er.pressure', '弓压', 'Bow pressure', 'erhu', 'synth', 0, 1, 0.55, { fmt: pct, tip: '弓毛压力。低=飘、气声；高=粗、嘶哑。', rnd: [0.2, 0.9] }),
    K('er.pos', '弓位', 'Bow position', 'erhu', 'synth', 0.05, 0.45, 0.13, { fmt: pct, tip: '弓与琴码的距离。靠码(小)更亮更尖。', rnd: [0.1, 0.8] }),
    K('er.rosin', '松香噪', 'Rosin noise', 'erhu', 'synth', 0, 1, 0.2, { fmt: pct, tip: '弓毛摩擦的颗粒感。', rnd: [0, 0.6] }),
    K('er.body', '琴筒共鸣', 'Body resonance', 'erhu', 'synth', 0, 1, 0.6, { fmt: pct, tip: '蟒皮琴筒的鼻音共鸣。', rnd: [0.2, 1] }),
    /* ---- 竹笛 ---- */
    K('dz.breath', '气息', 'Breath', 'dizi', 'synth', 0.6, 2, 1.4, { fmt: (v) => v.toFixed(2), tip: '吹气压力。过强会跳到泛音。', rnd: [0.3, 0.8] }),
    K('dz.jet', '风门', 'Jet ratio', 'dizi', 'synth', 0.15, 0.7, 0.32, { fmt: pct, tip: '气流射流长度比：改变泛音/超吹。', rnd: [0.2, 0.7] }),
    K('dz.noise', '气声', 'Breath noise', 'dizi', 'synth', 0, 0.6, 0.15, { fmt: pct, rnd: [0, 0.7] }),
    K('dz.membrane', '笛膜', 'Membrane', 'dizi', 'synth', 0, 1, 0.3, { fmt: pct, tip: '笛膜的嗡鸣：竹笛最有辨识度的"沙"。', rnd: [0, 1] }),
    /* ---- 管子 / 唢呐 ---- */
    K('gn.breath', '气压', 'Air pressure', 'guan', 'synth', 0, 1, 0.5, { fmt: pct, tip: '相对于簧片闭合阈值的气压。', rnd: [0, 1] }),
    K('gn.reed', '簧片硬度', 'Reed stiffness', 'guan', 'synth', 0, 1, 0.5, { fmt: pct, rnd: [0, 1] }),
    K('gn.noise', '气声', 'Breath noise', 'guan', 'synth', 0, 0.6, 0.1, { fmt: pct, rnd: [0, 0.6] }),
    K('gn.bell', '喇叭口', 'Bell', 'guan', 'synth', 0, 1, 0.3, { fmt: pct, tip: '铜碗的辉煌感（波折叠增亮）。往上就是唢呐。', rnd: [0, 1] }),
    /* ---- 弦乐群 ---- */
    K('st.detune', '失谐', 'Detune', 'strings', 'synth', 0, 40, 12, { fmt: ct, rnd: [0.1, 0.8] }),
    K('st.pw', '方波混合', 'Pulse mix', 'strings', 'synth', 0, 1, 0.2, { fmt: pct, rnd: [0, 0.8] }),
    /* ---- 插电 ---- */
    K('el.blend', '插电', 'Electric blend', 'elec', 'synth', 0, 1, 0, { fmt: pct, tip: '拾音器混合量：0=原声，1=全电。', rnd: [0, 1] }),
    K('el.drive', '拾音增益', 'Pickup drive', 'elec', 'synth', 0, 1, 0.3, { fmt: pct, tip: '拾音器前级饱和。', rnd: [0, 1] }),
    K('el.bias', '偏置', 'Bias', 'elec', 'synth', 0, 1, 0.2, { fmt: pct, tip: '非对称偏置 → 偶次谐波，更"暖"。', rnd: [0, 1] }),
    K('el.synth', '合成层', 'Synth layer', 'elec', 'synth', 0, 1, 0, { fmt: pct, tip: '叠加一个振荡器层，让声学乐器像插了电一样厚。', rnd: [0, 0.7] }),
    S('el.wave', '合成波形', 'Layer wave', 'elec', 'synth', [[0, '锯齿 Saw'], [1, '方波 Square'], [2, '正弦 Sine']], 0),
    K('el.detune', '合成移调', 'Layer transpose', 'elec', 'synth', -24, 24, 0, { step: 1, fmt: st, rnd: [0.25, 0.75] }),
    K('el.sub', '次低音', 'Sub', 'elec', 'synth', 0, 1, 0, { fmt: pct, tip: '低八度正弦，给"斗破"的底气。', rnd: [0, 0.8] }),
    /* ---- 毒液 ---- */
    T('vn.on', '毒液模式', 'Venom mode', 'venom', 'both', 0, { tip: '毒液：反馈FM、波折叠、碎裂与流淌漂移一起上。' }),
    K('vn.amt', '毒液量', 'Venom amount', 'venom', 'synth', 0, 1, 0.5, { fmt: pct, rnd: [0.1, 1] }),
    K('vn.fold', '折叠', 'Fold', 'venom', 'synth', 0, 1, 0.3, { fmt: pct, rnd: [0, 1] }),
    K('vn.fm', '反馈FM', 'Feedback FM', 'venom', 'synth', 0, 1, 0.3, { fmt: pct, rnd: [0, 1] }),
    K('vn.crush', '碎裂', 'Crush', 'venom', 'amp', 0, 1, 0.2, { fmt: pct, rnd: [0, 0.8] }),
    K('vn.ooze', '流淌', 'Ooze drift', 'venom', 'synth', 0, 1, 0.3, { fmt: pct, tip: '液态金属般的随机音高漂移。', rnd: [0, 1] }),
    /* ---- 滤波 ---- */
    S('flt.type', '滤波类型', 'Filter type', 'filter', 'native', [['lowpass', '低通 Lowpass'], ['bandpass', '带通 Bandpass'], ['highpass', '高通 Highpass']], 'lowpass'),
    K('flt.cutoff', '截止', 'Cutoff', 'filter', 'native', 40, 18000, 9000, { curve: 'log', fmt: hz, rnd: [0.4, 1] }),
    K('flt.res', '共振', 'Resonance', 'filter', 'native', 0.1, 20, 0.8, { curve: 'log', fmt: (v) => 'Q ' + v.toFixed(2), rnd: [0, 0.6] }),
    K('flt.lfoRate', '滤波LFO速度', 'Filter LFO rate', 'filter', 'native', 0.05, 20, 0.5, { curve: 'log', fmt: hz, rnd: [0, 0.7] }),
    K('flt.lfoDepth', '滤波LFO深度', 'Filter LFO depth', 'filter', 'native', 0, 1, 0, { fmt: pct, rnd: [0, 0.6] }),
    /* ---- 放大器 ---- */
    K('amp.in', '输入', 'Input', 'amp', 'amp', 0, 2, 1, { fmt: (v) => (20 * Math.log10(Math.max(v, 1e-3))).toFixed(1) + ' dB' }),
    K('dio.drive', '二极管驱动', 'Diode drive', 'diode', 'amp', 0, 1, 0.2, { fmt: pct, tip: '模拟二极管削波(Shockley 曲线)。', rnd: [0, 1] }),
    K('dio.asym', '二极管非对称', 'Diode asymmetry', 'diode', 'amp', 0, 1, 0.3, { fmt: pct, tip: '锗/硅二极管不对称阈值 → 偶次谐波。', rnd: [0, 1] }),
    K('dio.mix', '二极管混合', 'Diode mix', 'diode', 'amp', 0, 1, 0, { fmt: pct, rnd: [0, 0.8] }),
    K('tube.drive', '电子管驱动', 'Tube drive', 'tube', 'amp', 0, 1, 0.25, { fmt: pct, tip: '三极管级增益。', rnd: [0, 0.9] }),
    K('tube.bias', '栅偏压', 'Grid bias', 'tube', 'amp', 0, 1, 0.2, { fmt: pct, tip: '偏压偏离 → 非对称、更多偶次谐波。', rnd: [0, 1] }),
    K('tube.sag', '电源下垂', 'Sag', 'tube', 'amp', 0, 1, 0.3, { fmt: pct, tip: '整流管电源下垂：大动态时压缩、"喘息"。', rnd: [0, 1] }),
    K('tube.xover', '交越失真', 'Crossover', 'tube', 'amp', 0, 1, 0, { fmt: pct, tip: '推挽功放冷偏置的交越失真。', rnd: [0, 0.3] }),
    K('tube.mix', '电子管混合', 'Tube mix', 'tube', 'amp', 0, 1, 0.5, { fmt: pct, rnd: [0.2, 1] }),
    S('cab.type', '箱体', 'Cabinet', 'cab', 'amp', [[0, '直出 Bypass'], [1, '琴身 Body'], [2, '吉他箱 Guitar cab'], [3, '毒液箱 Venom cab']], 1),
    K('cab.mix', '箱体混合', 'Cabinet mix', 'cab', 'amp', 0, 1, 0.5, { fmt: pct, rnd: [0, 1] }),
    K('amp.hum', '电源哼声', 'Hum', 'amp', 'amp', 0, 1, 0, { fmt: pct, tip: '50Hz 电源哼声，真实老设备味。', rnd: [0, 0.3] }),
    K('amp.hiss', '底噪', 'Hiss', 'amp', 'amp', 0, 1, 0, { fmt: pct, rnd: [0, 0.3] }),
    K('amp.out', '输出', 'Output', 'amp', 'amp', 0, 1.5, 0.8, { fmt: (v) => (20 * Math.log10(Math.max(v, 1e-3))).toFixed(1) + ' dB' }),
    /* ---- 效果 ---- */
    K('cho.rate', '合唱速度', 'Chorus rate', 'chorus', 'native', 0.05, 8, 0.6, { curve: 'log', fmt: hz, rnd: [0, 0.6] }),
    K('cho.depth', '合唱深度', 'Chorus depth', 'chorus', 'native', 0, 1, 0.3, { fmt: pct, rnd: [0, 0.8] }),
    K('cho.mix', '合唱混合', 'Chorus mix', 'chorus', 'native', 0, 1, 0, { fmt: pct, rnd: [0, 0.6] }),
    K('dly.time', '延迟时间', 'Delay time', 'delay', 'native', 0.02, 2, 0.375, { curve: 'exp', fmt: ms, rnd: [0.2, 0.8] }),
    K('dly.fb', '延迟反馈', 'Delay feedback', 'delay', 'native', 0, 0.95, 0.35, { fmt: pct, rnd: [0, 0.8] }),
    K('dly.mix', '延迟混合', 'Delay mix', 'delay', 'native', 0, 1, 0.15, { fmt: pct, rnd: [0, 0.6] }),
    K('rev.size', '石厅大小', 'Hall size', 'reverb', 'native', 0.3, 8, 2.5, { curve: 'exp', fmt: s, rnd: [0, 1] }),
    K('rev.damp', '石厅阻尼', 'Hall damping', 'reverb', 'native', 0, 1, 0.5, { fmt: pct, rnd: [0, 1] }),
    K('rev.mix', '石厅混合', 'Hall mix', 'reverb', 'native', 0, 1, 0.3, { fmt: pct, rnd: [0, 0.7] }),
    K('comp.amount', '压缩', 'Compress', 'master', 'native', 0, 1, 0.3, { fmt: pct }),
    K('master.vol', '主音量', 'Master', 'master', 'native', 0, 1, 0.8, { fmt: pct, noRnd: true }),
    /* ---- 宏 (调制源) ---- */
    K('mac.1', '力 · 驱动', 'Macro 1 Force', 'macro', 'host', 0, 1, 0.3, { fmt: pct, tip: '宏1：默认推动电子管/二极管驱动。' }),
    K('mac.2', '光 · 亮度', 'Macro 2 Light', 'macro', 'host', 0, 1, 0.6, { fmt: pct, tip: '宏2：默认推动滤波截止与乐器亮度。' }),
    K('mac.3', '空 · 空间', 'Macro 3 Space', 'macro', 'host', 0, 1, 0.3, { fmt: pct, tip: '宏3：默认推动石厅混响与延迟。' }),
    K('mac.4', '毒 · 毒液', 'Macro 4 Venom', 'macro', 'host', 0, 1, 0, { fmt: pct, tip: '宏4：默认推动毒液量。' }),
    /* ---- LFO (主线程调制源) ---- */
    K('lfo1.rate', 'LFO1 速度', 'LFO1 rate', 'lfo', 'host', 0.02, 20, 0.25, { curve: 'log', fmt: hz }),
    S('lfo1.shape', 'LFO1 波形', 'LFO1 shape', 'lfo', 'host', [['sine', '正弦 Sine'], ['tri', '三角 Tri'], ['square', '方波 Square'], ['saw', '锯齿 Saw'], ['random', '随机 S&H']], 'sine'),
    K('lfo2.rate', 'LFO2 速度', 'LFO2 rate', 'lfo', 'host', 0.02, 20, 3, { curve: 'log', fmt: hz }),
    S('lfo2.shape', 'LFO2 波形', 'LFO2 shape', 'lfo', 'host', [['sine', '正弦 Sine'], ['tri', '三角 Tri'], ['square', '方波 Square'], ['saw', '锯齿 Saw'], ['random', '随机 S&H']], 'tri'),
    /* ---- 随机接口 ---- */
    S('rnd.source', '随机源', 'Random source', 'random', 'host', [['crypto', '真随机 Crypto'], ['pi', '圆周率 π Pi'], ['c14', '碳-14 衰变 C-14 decay'], ['mix', '三源混合 Mix']], 'c14', { tip: '给 R1-R4 接口供数的随机源。' }),
    K('rnd.rate', '自动刷新', 'Auto refresh', 'random', 'host', 0, 8, 0, { fmt: (v) => (v < 0.05 ? '手动 Manual' : v.toFixed(2) + ' Hz'), tip: '0=只在按"刷新"时取新数；否则按此频率自动刷新。' }),
    K('rnd.slew', '平滑', 'Slew', 'random', 'host', 0, 1, 0.3, { fmt: pct, tip: '接口数值变化的平滑时间。0=瞬变。' }),
    K('rnd.wild', '惊喜幅度', 'Surprise amount', 'random', 'host', 0, 1, 0.35, { fmt: pct, tip: '"惊喜"随机化整套音色时的偏离程度。' }),
    K('c14.atoms', '碳-14 原子数', 'C14 atoms', 'c14', 'host', 1e2, 1e8, 1e4, { curve: 'log', fmt: (v) => v.toExponential(1), tip: '模拟样本中的碳-14 原子数。' }),
    K('c14.speed', '时间加速', 'Time scale', 'c14', 'host', 0.1, 1e4, 20, { curve: 'log', fmt: (v) => v.toFixed(0) + ' 年/秒 yr/s', tip: '每现实秒模拟多少年（半衰期 5730 年）。' }),
    K('c14.prob', '衰变触发', 'Decay → note', 'c14', 'host', 0, 1, 0, { fmt: pct, tip: '每次衰变事件以此概率触发一个音（用下方音阶）。' }),
    S('c14.scale', '触发音阶', 'Trigger scale', 'c14', 'host', [['penta', '宫调五声 Pentatonic gong'], ['yu', '羽调五声 Pentatonic yu'], ['minor', '自然小调 Minor'], ['whole', '全音 Whole-tone'], ['chrom', '半音 Chromatic']], 'penta'),
    T('c14.click', '盖革咔嗒', 'Geiger click', 'c14', 'host', 0, { tip: '每次衰变发出盖革计数器的咔嗒声。' }),
    /* ---- 琶音 / 走带 ---- */
    K('bpm', '速度', 'BPM', 'seq', 'host', 40, 240, 96, { step: 1, fmt: (v) => Math.round(v) + ' BPM', noRnd: true }),
    S('arp.mode', '琶音', 'Arp mode', 'seq', 'host', [['off', '关 Off'], ['up', '上行 Up'], ['down', '下行 Down'], ['updown', '上下 Up-down'], ['random', '随机 Random'], ['pi', 'π 序 Pi order'], ['c14', '碳衰变触发 C-14 trigger']], 'off'),
    S('arp.rate', '琶音速率', 'Arp rate', 'seq', 'host', [[1, '1/4'], [2, '1/8'], [4, '1/16'], [3, '1/8T'], [8, '1/32']], 2),
    K('arp.oct', '琶音八度', 'Arp octaves', 'seq', 'host', 1, 3, 1, { step: 1, fmt: (v) => Math.round(v) + ' oct' }),
    K('arp.gate', '琶音门限', 'Arp gate', 'seq', 'host', 0.1, 1, 0.6, { fmt: pct }),
  ];

  const PARAM_MAP = {}; for (const p of PARAMS) PARAM_MAP[p.id] = p;
  const keyOf = (id) => id.replace(/\.(\w)/g, (m, c) => c.toUpperCase());
  for (const p of PARAMS) p.key = keyOf(p.id);

  function norm(p, v) {
    if (p.type === 'select') { const i = p.options.findIndex((o) => o[0] == v); return Math.max(0, i) / Math.max(1, p.options.length - 1); }
    if (p.type === 'toggle') return v ? 1 : 0;
    if (p.curve === 'log') return (Math.log(v) - Math.log(p.min)) / (Math.log(p.max) - Math.log(p.min));
    if (p.curve === 'exp') return Math.sqrt((v - p.min) / (p.max - p.min));
    return (v - p.min) / (p.max - p.min);
  }
  function denorm(p, n) {
    n = n < 0 ? 0 : n > 1 ? 1 : n;
    if (p.type === 'select') return p.options[Math.round(n * (p.options.length - 1))][0];
    if (p.type === 'toggle') return n >= 0.5 ? 1 : 0;
    let v;
    if (p.curve === 'log') v = Math.exp(Math.log(p.min) + n * (Math.log(p.max) - Math.log(p.min)));
    else if (p.curve === 'exp') v = p.min + n * n * (p.max - p.min);
    else v = p.min + n * (p.max - p.min);
    if (p.step) v = Math.round(v / p.step) * p.step;
    return v;
  }
  function fmt(p, v) {
    if (p.type === 'select') { const o = p.options.find((o) => o[0] == v); return o ? o[1] : String(v); }
    if (p.type === 'toggle') return v ? '开 On' : '关 Off';
    return p.fmt ? p.fmt(v) : (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(0));
  }
  const defaults = () => { const o = {}; for (const p of PARAMS) o[p.id] = p.def; return o; };

  const GROUPS = {
    inst: '演奏', vib: '揉弦 / 颤音', env: '包络', guzheng: '古筝', erhu: '二胡', dizi: '竹笛', guan: '管子 · 唢呐', strings: '弦乐群',
    elec: '插电 · 拾音器', venom: '毒液', filter: '滤波', amp: '放大器', diode: '二极管', tube: '电子管', cab: '箱体',
    chorus: '合唱', delay: '延迟', reverb: '石厅混响', master: '总线', macro: '宏', lfo: 'LFO', random: '随机接口', c14: '碳-14', seq: '琶音',
  };
  const GROUPS_EN = {
    inst: 'Play', vib: 'Vibrato', env: 'Envelope', guzheng: 'Guzheng', erhu: 'Erhu', dizi: 'Dizi', guan: 'Guan · Suona', strings: 'Strings',
    elec: 'Electric · Pickup', venom: 'Venom', filter: 'Filter', amp: 'Amplifier', diode: 'Diode', tube: 'Tube', cab: 'Cabinet',
    chorus: 'Chorus', delay: 'Delay', reverb: 'Hall reverb', master: 'Master', macro: 'Macros', lfo: 'LFO', random: 'Random bay', c14: 'Carbon-14', seq: 'Arp',
  };
  /* 中文分组标题 → 英文 (UI.group 自动附加) */
  const TITLE_EN = {
    '演奏': 'Play', '揉弦 · 颤音': 'Vibrato', '包络': 'Envelope', '拾音器': 'Pickup', '合成层': 'Synth layer', '毒液': 'Venom', '滤波': 'Filter', '二极管': 'Diode', '电子管': 'Tube', '箱体 · 电': 'Cabinet · Power',
    '合唱': 'Chorus', '乒乓延迟': 'Ping-pong delay', '石厅混响': 'Hall reverb', '琶音 · 走带': 'Arp · Transport', '碳-14 衰变': 'Carbon-14 decay',
    '古筝': 'Guzheng', '二胡': 'Erhu', '竹笛': 'Dizi', '管子 · 唢呐': 'Guan · Suona', '弦乐群': 'Strings',
  };
  const SCALES = { penta: [0, 2, 4, 7, 9], yu: [0, 3, 5, 7, 10], minor: [0, 2, 3, 5, 7, 8, 10], whole: [0, 2, 4, 6, 8, 10], chrom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
  const MOD_SOURCES = [
    ['R1', '接口 R1 · Port R1'], ['R2', '接口 R2 · Port R2'], ['R3', '接口 R3 · Port R3'], ['R4', '接口 R4 · Port R4'],
    ['LFO1', 'LFO 1'], ['LFO2', 'LFO 2'], ['DECAY', '衰变脉冲 · Decay'], ['X', 'XY 板 X · Pad X'], ['Y', 'XY 板 Y · Pad Y'],
    ['M1', '宏 力 · Macro Force'], ['M2', '宏 光 · Macro Light'], ['M3', '宏 空 · Macro Space'], ['M4', '宏 毒 · Macro Venom'], ['KEY', '键位 · Key'], ['VEL', '力度 · Velocity'], ['WHEEL', '调制轮 · Mod wheel'],
  ];
  root.SHISUI = root.SHISUI || {};
  Object.assign(root.SHISUI, { PARAMS, PARAM_MAP, GROUPS, GROUPS_EN, TITLE_EN, SCALES, MOD_SOURCES, norm, denorm, fmt, defaults, keyOf });
})(typeof window !== 'undefined' ? window : globalThis);
