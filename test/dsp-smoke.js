const { DSP_WORKLET_MAIN } = require('../js/dsp.worklet.js');
global.sampleRate = 48000;
const procs = {};
global.registerProcessor = (n, c) => (procs[n] = c);
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
DSP_WORKLET_MAIN();
const Synth = procs['shisui-synth'], Amp = procs['shisui-amp'];
function run(setup, label, secs = 1.2, hold = 0.6) {
  const s = new Synth(); setup(s);
  const N = 128; const L = new Float32Array(N), R = new Float32Array(N);
  let peak = 0, sumsq = 0, cnt = 0, nan = false; const blocks = Math.floor(secs * 48000 / N);
  const holdB = Math.floor(hold * 48000 / N);
  let segs = [];
  for (let b = 0; b < blocks; b++) {
    if (b === 2) { s.onMsg({ type: 'noteOn', note: 62, vel: 0.8 }); s.onMsg({ type: 'noteOn', note: 69, vel: 0.9 }); }
    if (b === holdB) { s.onMsg({ type: 'noteOff', note: 62 }); s.onMsg({ type: 'noteOff', note: 69 }); }
    s.process([], [[L, R]]);
    let bp = 0;
    for (let i = 0; i < N; i++) { const v = L[i]; if (!isFinite(v)) nan = true; const a = Math.abs(v); if (a > peak) peak = a; if (a > bp) bp = a; sumsq += v * v; cnt++; }
    if (b % Math.floor(blocks / 8) === 0) segs.push(bp.toFixed(3));
  }
  const active = s.voices.filter(v => v.active).length;
  console.log(label.padEnd(26), 'peak', peak.toFixed(3), 'rms', Math.sqrt(sumsq / cnt).toFixed(4), 'nan', nan, 'activeEnd', active, 'env:', segs.join(' '));
}
run(s => { s.P.inst = 'guzheng'; }, 'guzheng', 2.5, 1.0);
run(s => { s.P.inst = 'guzheng'; s.P.gzYaozhi = 12; s.P.gzSlide = 2; }, 'guzheng yaozhi+slide', 2.0, 1.2);
run(s => { s.P.inst = 'erhu'; s.P.mono = 1; s.P.envA = 0.08; }, 'erhu mono', 2.0, 1.3);
run(s => { s.P.inst = 'erhu'; s.P.erPressure = 0.9; s.P.erPos = 0.3; }, 'erhu hard');
run(s => { s.P.inst = 'dizi'; s.P.envA = 0.03; }, 'dizi');
run(s => { s.P.inst = 'dizi'; s.P.dzJet = 0.55; s.P.dzMembrane = 1; s.P.dzNoise = 0.5; }, 'dizi overblow');
run(s => { s.P.inst = 'guan'; s.P.envA = 0.03; }, 'guan');
run(s => { s.P.inst = 'guan'; s.P.gnBell = 1; s.P.gnReed = 0; s.P.gnBreath = 1.2; }, 'guan extreme');
run(s => { s.P.inst = 'strings'; s.P.envA = 0.3; }, 'strings');
run(s => { s.P.inst = 'guzheng'; s.P.elBlend = 1; s.P.elDrive = 1; s.P.elSynth = 1; s.P.elSub = 1; s.P.vnOn = 1; s.P.vnAmt = 1; s.P.vnFold = 1; s.P.vnFm = 1; s.P.vnOoze = 1; }, 'guzheng venom max', 2.0, 1.0);
run(s => { s.P.inst = 'erhu'; s.P.vnOn = 1; s.P.vnAmt = 1; s.P.vnFold = 1; s.P.vnFm = 1; s.P.elBlend = 1; s.P.elDrive = 1; }, 'erhu venom max');
// amp
const a = new Amp(); a.A.dioMix = 1; a.A.tubeMix = 1; a.A.tubeDrive = 1; a.A.dioDrive = 1; a.A.cabType = 3; a.A.cabMix = 1; a.A.vnOn = 1; a.A.vnCrush = 0.8; a.A.ampHum = 1; a.A.ampHiss = 1; a.A.tubeXover = 1;
const xin = new Float32Array(128), yo = new Float32Array(128), yo2 = new Float32Array(128);
let pk = 0, bad = false; for (let b = 0; b < 400; b++) { for (let i = 0; i < 128; i++) xin[i] = Math.sin(i * 0.2 + b) * 0.5; a.process([[xin, xin]], [[yo, yo2]]); for (let i = 0; i < 128; i++) { if (!isFinite(yo[i])) bad = true; pk = Math.max(pk, Math.abs(yo[i])); } }
console.log('amp extreme'.padEnd(26), 'peak', pk.toFixed(3), 'nan', bad);
const a2 = new Amp(); pk = 0; for (let b = 0; b < 100; b++) { for (let i = 0; i < 128; i++) xin[i] = Math.sin(i * 0.2 + b) * 0.5; a2.process([[xin, xin]], [[yo, yo2]]); for (let i = 0; i < 128; i++) pk = Math.max(pk, Math.abs(yo[i])); }
console.log('amp default'.padEnd(26), 'peak', pk.toFixed(3));
// perf
const s = new Synth(); s.P.inst = 'erhu'; for (let n = 0; n < 8; n++) s.onMsg({ type: 'noteOn', note: 60 + n, vel: 0.8 });
const L = new Float32Array(128), R = new Float32Array(128); const t0 = Date.now(); for (let b = 0; b < 3750; b++) s.process([], [[L, R]]);
console.log('perf: 8 erhu voices, 10s audio in', Date.now() - t0, 'ms');
