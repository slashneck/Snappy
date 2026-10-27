// "sloppy", once she has been called Sloppy: she is not slop, and she proves it. Snappy, the Program and Claude put on
// a show, cut to its own music, every cut on the beat, one thing after another with no theme on purpose: the app
// glitches out; her as a swarm of light; a heart; Claude's synthwave wireframe of her, which turns real: her in 3D, a
// new look on every beat, landing on the finished render; a dial-up screech and her 2004 homepage; a 2009 Flash intro;
// 2013, dancing alone until the drop; the memes (such handmade, hitmarkers, deal with it, deep fried, two guys
// pointing); a cat-eared girl hugging her; a perfume advert starring her; the girl, starstruck; the Program's room of
// TVs; her graffiti on a wall at night; her in other games; everything at once; the screen switching off; and her, in
// a spotlight.
// The 3D shots were made in Blender (by script, with Claude) and play as short videos (the girl is "Shibahu" by
// 腱鞘炎の人, CC BY 4.0, posed and animated for this); everything else is drawn while it plays, and all of it goes
// through one last pass on the graphics card that bends, splits, tears, sorts and moshes the picture on the beat.
// Words sit on their own layer above that, so they stay sharp. The music is composed note by note in here, rendered
// once, and played by her sound player (so, like all her sounds, it stays out of your clips). Esc skips.
(() => {
  const { chat, hints } = Terminal;
  const s = (t, o) => ['s', t, o], p = (t, o) => ['p', t, o], c = (t, o) => ['c', t, o], fx = (f) => ['fx', f], w = (ms) => ['w', ms];
  const run = (cmd, by) => ['run', cmd, { by }], out = (t, cls) => ['out', t, { cls }], r = (face, hold) => ['r', face, { hold }];
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const SNAPPY = ['#ffffff', '#ffd1dc', '#ff9db0'];

  // ===========================================================================
  // When things happen: 120 beats a minute, so a beat is half a second and a bar is two
  // ===========================================================================
  const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, RATE = 48000;
  const T = { boot: 0, her: 2, claude: 6, styles: 8, net: 16, page: 16.5, flash: 18, shake: 20, drop: 22, memes: 24, kawaii: 28, ad: 30, starstruck: 32,
    crt: 34, wall: 36, games: 38, chaos: 40, off: 42, end: 43.4 };
  const LENGTH = 47.8, END = 47.6;

  // ===========================================================================
  // The music
  // ===========================================================================
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const AM = [57, 60, 64], F = [53, 57, 60], C = [52, 55, 60], G = [50, 55, 59], EM = [52, 55, 59], DM = [50, 53, 57];
  const ROOT = new Map([[AM, 45], [F, 41], [C, 36], [G, 43], [EM, 40], [DM, 38]]);
  async function compose() {
    const ac = new OfflineAudioContext(1, Math.ceil(RATE * LENGTH), RATE);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
    const master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(comp); comp.connect(ac.destination);
    const shaper = (k) => {
      const ws = ac.createWaveShaper(), n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
      ws.curve = curve;
      return ws;
    };
    // a long hall, and a dotted-eighth echo
    const verb = ac.createConvolver();
    const ir = ac.createBuffer(2, RATE * 3, RATE);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2.6; }
    verb.buffer = ir;
    const verbOut = ac.createGain(); verbOut.gain.value = 0.32; verb.connect(verbOut); verbOut.connect(master);
    const echo = ac.createDelay(1); echo.delayTime.value = BEAT * 0.75;
    const back = ac.createGain(); back.gain.value = 0.32; echo.connect(back); back.connect(echo);
    const echoOut = ac.createGain(); echoOut.gain.value = 0.28; echo.connect(echoOut); echoOut.connect(master); echoOut.connect(verb);
    const bus = (gain, rev = 0, dly = 0, dest = master) => {
      const g = ac.createGain(); g.gain.value = gain; g.connect(dest);
      if (rev) { const s = ac.createGain(); s.gain.value = rev; g.connect(s); s.connect(verb); }
      if (dly) { const s = ac.createGain(); s.gain.value = dly; g.connect(s); s.connect(echo); }
      return g;
    };
    // the deep-fried bus: everything that goes in comes out clipped
    const fry = shaper(5); const fryOut = ac.createGain(); fryOut.gain.value = 0.32; fry.connect(fryOut); fryOut.connect(master);
    const drums = bus(0.9, 0.1), snares = bus(0.55, 0.45), hats = bus(0.15), bassBus = bus(0.3), subBus = bus(0.42);
    const padBus = bus(0.11, 0.8), sawBus = bus(0.05, 0.6), leadBus = bus(0.12, 0.4, 0.45), pluckBus = bus(0.11, 0.3, 0.55), bellBus = bus(0.17, 0.9, 0.3);
    const fxBus = bus(0.3, 0.6), wubBus = bus(0.2, 0.05), midiBus = bus(0.2, 0.25), chipBus = bus(0.07, 0.15, 0.3), friedBus = bus(1.0, 0, 0, fry);
    const noise = ac.createBuffer(1, RATE * 2, RATE);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const env = (param, t, a, peak, d, end = 0.0001) => { param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(end, t + a + d); };
    const osc = (type, f, t, dur, dest, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
    const amp = (dest) => { const g = ac.createGain(); g.gain.value = 0; g.connect(dest); return g; };
    const filt = (type, f, q, dest) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
    const hiss = (t, dur, dest) => { const n = ac.createBufferSource(); n.buffer = noise; n.loop = true; n.connect(dest); n.start(t, Math.random()); n.stop(t + dur + 0.05); return n; };

    // ---- the kit
    const kick = (t, g = 1, out = drums) => { const a = amp(out); env(a.gain, t, 0.002, g, 0.42); const o = osc('sine', 150, t, 0.5, a); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); };
    const snare = (t, g = 1, out = snares) => {
      const a = amp(out); env(a.gain, t, 0.002, g, 0.22); hiss(t, 0.3, filt('highpass', 1300, 0.7, a));
      const b = amp(out); env(b.gain, t, 0.002, g * 0.7, 0.1); const o = osc('triangle', 200, t, 0.15, b); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    };
    const clap = (t, g = 1) => { for (const d of [0, 0.012, 0.025]) { const a = amp(snares); env(a.gain, t + d, 0.001, g * 0.6, d === 0.025 ? 0.16 : 0.03); hiss(t + d, 0.2, filt('bandpass', 1400, 1.1, a)); } };
    const hat = (t, g = 1, open = false) => { const a = amp(hats); env(a.gain, t, 0.001, g, open ? 0.2 : 0.045); hiss(t, 0.3, filt('highpass', 7800, 0.8, a)); };
    const crash = (t, g = 1) => { const a = amp(fxBus); env(a.gain, t, 0.003, g * 0.6, 1.9); hiss(t, 2.1, filt('highpass', 5200, 0.5, a)); };
    const bass = (t, dur, m, g = 1) => {
      const a = amp(bassBus); env(a.gain, t, 0.005, g, dur * 0.9);
      const f = filt('lowpass', 300, 6, a); f.frequency.setValueAtTime(1900, t); f.frequency.exponentialRampToValueAtTime(260, t + dur * 0.8);
      osc('sawtooth', hz(m), t, dur, f); osc('square', hz(m - 12), t, dur, f, 6);
    };
    const sub = (t, dur, m, g = 1) => { const a = amp(subBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.03); a.gain.setValueAtTime(g, t + dur - 0.08); a.gain.linearRampToValueAtTime(0, t + dur); osc('sine', hz(m), t, dur, a); };
    // an 808: a sine with some grit, gliding to `to` if given
    const e808 = (t, dur, m, g = 1, to = null, out = subBus) => {
      const a = amp(out); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.006); a.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.22);
      const sh = shaper(1.8); sh.connect(a);
      const o = osc('sine', hz(m), t, dur + 0.3, sh);
      o.frequency.setValueAtTime(hz(m) * 1.6, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.04);
      if (to !== null) { o.frequency.setValueAtTime(hz(m), t + dur * 0.45); o.frequency.exponentialRampToValueAtTime(hz(to), t + dur * 0.8); }
    };
    // a wobble: a growling bass with a filter swinging `rate` times a second
    const wobble = (t, dur, m, rate, g = 1) => {
      const a = amp(wubBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.01); a.gain.setValueAtTime(g, t + dur - 0.03); a.gain.linearRampToValueAtTime(0, t + dur);
      const f = filt('lowpass', 1300, 7, a);
      const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rate;
      const depth = ac.createGain(); depth.gain.value = 1150; lfo.connect(depth); depth.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
      const sh = shaper(2.4); sh.connect(f);
      osc('sawtooth', hz(m), t, dur, sh); osc('square', hz(m), t, dur, sh, 9); osc('sawtooth', hz(m + 12), t, dur, sh, -7);
      sub(t, dur, m - 12, 0.6 * g);
    };
    const pad = (t, dur, notes, g = 1, cut = 1400, open = cut) => {
      const a = amp(padBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.3); a.gain.setValueAtTime(g, t + dur - 0.1); a.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      const f = filt('lowpass', cut, 1, a); f.frequency.setValueAtTime(cut, t); f.frequency.linearRampToValueAtTime(open, t + dur);
      for (const m of notes) for (const d of [-9, 0, 9]) osc('sawtooth', hz(m), t, dur + 0.7, f, d);
    };
    const supersaw = (t, dur, notes, g = 1, out = sawBus) => {
      const a = amp(out); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.02); a.gain.setValueAtTime(g, t + Math.max(0.03, dur - 0.05)); a.gain.linearRampToValueAtTime(0, t + dur + 0.25);
      const f = filt('lowpass', 4200, 0.8, a);
      for (const m of [...notes, notes[0] + 12, notes[1] + 12]) for (const d of [-18, -7, 0, 7, 18]) osc('sawtooth', hz(m), t, dur + 0.3, f, d);
    };
    const lead = (t, dur, m, g = 1) => {
      const a = amp(leadBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.01); a.gain.setValueAtTime(g * 0.8, t + dur - 0.03); a.gain.linearRampToValueAtTime(0, t + dur + 0.06);
      const f = filt('lowpass', 3200, 1.2, a);
      const vib = ac.createOscillator(); vib.frequency.value = 5.5; const depth = ac.createGain(); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(14, t + Math.min(0.4, dur));
      vib.connect(depth); vib.start(t); vib.stop(t + dur + 0.1);
      for (const d of [-8, 8]) { const o = osc('sawtooth', hz(m), t, dur + 0.06, f, d); depth.connect(o.detune); }
    };
    const pluck = (t, m, g = 1) => { const a = amp(pluckBus); env(a.gain, t, 0.002, g, 0.28); const f = filt('lowpass', 600, 4, a); f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.25); osc('square', hz(m), t, 0.32, f); };
    const bell = (t, m, g = 1) => { for (const [ratio, gg] of [[1, 1], [2.76, 0.32], [5.4, 0.1]]) { const a = amp(bellBus); env(a.gain, t, 0.002, g * gg, 1.6 / ratio ** 0.5); osc('sine', hz(m) * ratio, t, 1.8, a); } };
    const riser = (t, dur, g = 1) => {
      const a = amp(fxBus); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g * 0.5, t + dur); a.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      const f = filt('bandpass', 300, 5, a); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur); hiss(t, dur, f);
      const b = amp(fxBus); b.gain.setValueAtTime(0.0001, t); b.gain.exponentialRampToValueAtTime(g * 0.08, t + dur); b.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      const o = osc('sawtooth', 110, t, dur, b); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    };
    const impact = (t, g = 1) => {
      const a = amp(fxBus); env(a.gain, t, 0.003, g * 1.3, 1.6); const o = osc('sine', 70, t, 1.7, a); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
      const b = amp(fxBus); env(b.gain, t, 0.002, g * 0.8, 0.5); hiss(t, 0.6, filt('lowpass', 2400, 0.6, b));
      crash(t, g);
    };
    const whoosh = (t, dur, g = 1) => {
      const a = amp(fxBus); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g * 0.4, t + dur * 0.6); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f = filt('bandpass', 400, 2, a); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur * 0.6); f.frequency.exponentialRampToValueAtTime(800, t + dur); hiss(t, dur, f);
    };
    const chime = (t, g = 1) => { [88, 93, 96, 100].forEach((m, i) => bell(t + i * 0.04, m, g * (0.5 - i * 0.08))); };
    const glitch = (t, n = 14, g = 1) => { for (let i = 0; i < n; i++) { const tt = t + i * 0.035 * rand(0.6, 1.4); const a = amp(fxBus); env(a.gain, tt, 0.001, g * 0.22, 0.03); osc(Math.random() < 0.5 ? 'square' : 'sawtooth', rand(120, 2400), tt, 0.04, a); } };
    const stutter = (t, notes, n = 8, step = BEAT / 8) => { for (let i = 0; i < n; i++) supersaw(t + i * step, step * 0.5, notes, 0.8 + (i % 2) * 0.4); };
    const zap = (t, g = 1) => { const a = amp(fxBus); env(a.gain, t, 0.002, g * 0.5, 0.45); const o = osc('sine', 2600, t, 0.5, a); o.frequency.exponentialRampToValueAtTime(40, t + 0.42); const b = amp(fxBus); env(b.gain, t, 0.001, g * 0.6, 0.06); hiss(t, 0.1, b); };
    const staticBurst = (t, dur, g = 1) => { const a = amp(fxBus); a.gain.setValueAtTime(g * 0.35, t); a.gain.setValueAtTime(g * 0.35, t + dur - 0.01); a.gain.linearRampToValueAtTime(0, t + dur); hiss(t, dur, filt('highpass', 2000, 0.5, a)); };
    // the internet's sounds: a modem, a General MIDI piano, a horn blast, hitmarkers, a scratch, coins and blips
    const dialup = (t) => {
      const tone = (tt, f1, f2, dur, g) => { const a = amp(fxBus); a.gain.setValueAtTime(g, tt); a.gain.setValueAtTime(g, tt + dur - 0.005); a.gain.linearRampToValueAtTime(0, tt + dur); osc('sine', f1, tt, dur, a); if (f2) osc('sine', f2, tt, dur, a); };
      [[697, 1209], [770, 1336], [852, 1477], [697, 1336]].forEach(([a, b], i) => tone(t + i * 0.045, a, b, 0.035, 0.16));
      tone(t + 0.19, 2100, 0, 0.09, 0.14);
      const a = amp(fxBus); a.gain.setValueAtTime(0.0001, t + 0.28); a.gain.exponentialRampToValueAtTime(0.32, t + 0.3); a.gain.setValueAtTime(0.32, t + 0.48); a.gain.linearRampToValueAtTime(0, t + 0.5);
      const f = filt('bandpass', 1800, 1.5, a); hiss(t + 0.28, 0.22, f);
      for (let i = 0; i < 7; i++) tone(t + 0.28 + i * 0.03, i % 2 ? 1200 : 2400, i % 3 ? 980 : 0, 0.028, 0.1);
      const sw = amp(fxBus); env(sw.gain, t + 0.25, 0.002, 0.12, 0.05); const o = osc('sine', 1200, t + 0.25, 0.06, sw); o.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    };
    const midi = (t, notes, dur, g = 1) => { for (const m of notes) { const a = amp(midiBus); env(a.gain, t, 0.003, g * 0.5, dur); osc('triangle', hz(m), t, dur + 0.1, a); const b = amp(midiBus); env(b.gain, t, 0.002, g * 0.1, dur * 0.4); osc('square', hz(m), t, dur, b); } };
    const airhorn = (t, dur = 0.2, g = 1) => {
      const a = amp(fxBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g * 0.3, t + 0.01); a.gain.setValueAtTime(g * 0.3, t + dur - 0.03); a.gain.linearRampToValueAtTime(0, t + dur);
      const sh = shaper(3); sh.connect(filt('lowpass', 3400, 0.7, a));
      for (const r of [1, 1.25, 1.5, 2]) { const o = osc('sawtooth', 466 * r, t, dur, sh); o.frequency.setValueAtTime(500 * r, t); o.frequency.exponentialRampToValueAtTime(466 * r, t + 0.04); }
    };
    const hitmark = (t, g = 1) => { const a = amp(fxBus); env(a.gain, t, 0.0005, g * 0.4, 0.035); hiss(t, 0.05, filt('highpass', 4500, 1, a)); const b = amp(fxBus); env(b.gain, t, 0.0005, g * 0.25, 0.03); osc('square', 3100, t, 0.04, b); };
    const scratch = (t, dur = 0.28) => {
      const a = amp(fxBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.5, t + 0.02); a.gain.setValueAtTime(0.5, t + dur - 0.03); a.gain.linearRampToValueAtTime(0, t + dur);
      const f = filt('bandpass', 800, 4, a); f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(2800, t + dur * 0.35); f.frequency.exponentialRampToValueAtTime(260, t + dur); hiss(t, dur, f);
    };
    const coin = (t) => { const a = amp(chipBus); env(a.gain, t, 0.001, 1, 0.06); osc('square', 988, t, 0.07, a); const b = amp(chipBus); env(b.gain, t + 0.07, 0.001, 1, 0.3); osc('square', 1319, t + 0.07, 0.35, b); };
    const blip = (t, f = 880) => { const a = amp(chipBus); env(a.gain, t, 0.001, 0.9, 0.05); osc('square', f, t, 0.06, a); };
    const chip = (t, dur, m, g = 1) => { const a = amp(chipBus); a.gain.setValueAtTime(g, t); a.gain.setValueAtTime(g, t + dur - 0.01); a.gain.linearRampToValueAtTime(0, t + dur); osc('square', hz(m), t, dur, a); };
    const click = (t) => { const a = amp(fxBus); env(a.gain, t, 0.001, 0.6, 0.05); hiss(t, 0.06, filt('bandpass', 2500, 1, a)); const b = amp(drums); env(b.gain, t, 0.002, 0.5, 0.18); osc('sine', 90, t, 0.2, b); };
    const arp = (t, chord, g, steps = 16, step = BEAT / 4) => { const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24]; const order = [0, 1, 2, 3, 2, 1, 2, 1]; for (let i = 0; i < steps; i++) pluck(t + i * step, tones[order[i % 8]], g); };
    const melody = (t, notes, inst, g, step = BEAT / 2) => { notes.forEach((m, i) => { if (m === null || m === '-') return; let len = 1; while (notes[i + len] === '-') len++; inst(t + i * step, len * step - 0.02, m, g); }); };

    // ---- [0, 2) the app glitches out; a boot screen
    glitch(0.0, 18, 1.2); stutter(0.05, AM, 6, 0.06); glitch(1.0, 8, 0.8);
    pad(0.3, 1.7, AM, 0.6, 500, 900);
    [69, 72, 76, 81, 84, 88].forEach((m, i) => pluck(0.5 + i * 0.06, m, 0.8));
    riser(1.2, 0.8, 0.8);
    // ---- [2, 6) her, out of light: four chords, the drums coming in, the heart, the implosion
    [AM, F, C, G].forEach((ch, i) => {
      const t = T.her + i;
      pad(t, 1, ch, 0.85, 700 + i * 400, 1000 + i * 500);
      arp(t, ch, 0.5 + i * 0.12, 8);
      if (i >= 1) { kick(t, 0.8); kick(t + 0.5, 0.7); }
      if (i >= 2) { for (let e = 0; e < 4; e++) { hat(t + e * 0.25 + 0.125, 0.6); bass(t + e * 0.25, 0.23, ROOT.get(ch), 0.8); } }
    });
    bell(3.5, 88, 0.45);
    riser(5.0, 1.0, 1);
    for (let i = 0; i < 8; i++) snare(5.5 + i * BEAT / 8, 0.2 + i * 0.08);
    impact(T.claude, 1.1);
    // ---- [6, 8) Claude: synthwave
    [F, G].forEach((ch, i) => {
      const t = T.claude + i;
      pad(t, 1, ch, 0.8, 1600, 2000);
      kick(t, 0.95); kick(t + 0.5, 0.95); snare(t + 0.5, 0.8);
      for (let e = 0; e < 4; e++) { hat(t + e * 0.25 + 0.125, 0.8, e % 2 === 1); bass(t + e * 0.25, 0.23, ROOT.get(ch) + (e % 2 ? 12 : 0), 0.85); }
    });
    melody(T.claude, [72, '-', 69, 72, 74, '-', 76, 74], lead, 0.9, BEAT / 2);
    riser(7.2, 0.8, 0.9); stutter(7.75, G, 4, 0.0625);
    // ---- [8, 16) her in 3D: a heavy half-time drop, a tick on every new look, the quick cuts, the finished render
    impact(T.styles, 1.0);
    [AM, F, C, G].forEach((ch, bar) => {
      const t0 = T.styles + bar * BAR, r = ROOT.get(ch);
      kick(t0, 1); kick(t0 + 0.75, 0.7); snare(t0 + 1.0, 1); kick(t0 + 1.5, 0.6);
      for (let e = 0; e < 16; e++) hat(t0 + e * 0.125, e % 2 ? 0.35 : 0.7);
      if (bar < 3) { wobble(t0, 1.0, r, [4, 8, 6][bar]); wobble(t0 + 1.0, 1.0, r, [8, 12, 16][bar]); }
      supersaw(t0, 0.16, ch, 0.8); supersaw(t0 + 1.0, 0.16, ch, 0.7);
      for (let b = 0; b < 4; b++) if (t0 + b * BEAT < 14) glitch(t0 + b * BEAT, 3, 0.35);
    });
    stutter(14.0, AM, 8, 0.0625); stutter(14.5, AM, 12, 0.0417); riser(14.0, 1.0, 1.0);
    for (let i = 0; i < 8; i++) snare(14.5 + i * 0.0625, 0.3 + i * 0.08);
    impact(15.0, 1.3); supersaw(15.0, 0.9, AM, 1.0); pad(15.0, 1.0, [57, 64, 69, 72, 76], 0.9, 2200, 1200); bell(15.0, 88, 0.8); bell(15.25, 93, 0.5);
    // ---- [16, 18) a modem screeching, then her 2004 homepage's MIDI
    dialup(T.net);
    [[60, 64, 67], [55, 59, 62], [53, 57, 60]].forEach((ch, i) => { midi(T.page + i * BEAT, ch, 0.42, 0.8); midi(T.page + i * BEAT + 0.25, ch.map((m) => m + 12), 0.2, 0.4); });
    melody(T.page, [76, 79, 81, 79, 77, 76], (t, d, m, g) => midi(t, [m + 12], d, g), 1.0, BEAT / 2);
    for (let i = 0; i < 3; i++) { kick(T.page + i * BEAT, 0.5); hat(T.page + i * BEAT + 0.25, 0.5); }
    snare(T.page + BEAT, 0.5); whoosh(17.6, 0.4, 0.8);
    // ---- [18, 20) the Flash intro: house
    whoosh(T.flash, 0.5, 1); chime(T.flash + 0.5, 0.9); whoosh(T.flash + 0.92, 0.4, 0.7);
    const AM9 = [57, 60, 64, 67, 71], FM7 = [53, 57, 60, 64], DM7 = [50, 53, 57, 60], EM7 = [52, 55, 59, 62];
    const housebar = (t0, chords, g = 1) => {
      for (let b = 0; b < 4; b++) { kick(t0 + b * BEAT, g); hat(t0 + b * BEAT + 0.25, 0.7 * g, true); }
      clap(t0 + BEAT, g); clap(t0 + 3 * BEAT, g);
      for (let e = 0; e < 8; e++) hat(t0 + e * 0.25 + 0.125, 0.3 * g);
      chords.forEach((ch, i) => { for (const off of [0, 0.375, 0.75]) midi(t0 + i * BAR / chords.length + off * (2 / chords.length), ch.map((m) => m + 12), 0.14, 0.7 * g); });
      chords.forEach((ch, i) => { for (let e = 0; e < 4 / chords.length * 2; e++) bass(t0 + i * BAR / chords.length + e * 0.5 + 0.25, 0.2, ch[0] - 12, 0.8 * g); });
    };
    housebar(T.flash, [AM9, FM7]);
    riser(19.4, 0.6, 0.9); whoosh(19.55, 0.45, 1);
    // ---- [20, 22) 2013: one person dancing to a sparse loop; then a silence
    for (let b = 0; b < 3; b++) { kick(T.shake + b * BEAT * 2, 0.7); hat(T.shake + b * BEAT * 2 + BEAT, 0.5, true); }
    melody(T.shake, [69, '-', 69, 72, '-', 69, 67, '-', 69, '-', 72, 74, 72, '-'], (t, d, m, g) => { supersaw(t, d * 0.7, [m - 12, m - 5, m], g * 0.5); }, 0.9, BEAT / 4);
    sub(T.shake, 1.5, 33, 0.5);
    { const a = amp(fxBus); a.gain.setValueAtTime(0.0001, 21.5); a.gain.exponentialRampToValueAtTime(0.5, 21.97); a.gain.linearRampToValueAtTime(0, 21.99); hiss(21.5, 0.5, filt('highpass', 3000, 0.5, a)); }
    // ---- [22, 24) the drop
    impact(T.drop, 1.2); crash(T.drop, 1.2);
    for (let bar = 0; bar < 2; bar++) {
      const t0 = T.drop + bar * BAR;
      for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 1);
      clap(t0 + BEAT, 1.1); clap(t0 + 3 * BEAT, 1.1);
      for (let e = 0; e < 16; e++) hat(t0 + e * 0.125, e % 2 ? 0.4 : 0.8);
      wobble(t0, 1.0, 45, bar ? 12 : 8, 1.1); wobble(t0 + 1.0, 1.0, bar ? 41 : 43, bar ? 16 : 6, 1.1);
      for (const off of [0, 0.375, 0.75, 1.25, 1.5]) supersaw(t0 + off, 0.12, AM, 0.9);
    }
    // ---- [24, 28) the memes: wow, hitmarkers, deal with it, deep fried
    pad(T.memes, 1.0, [60, 64, 67, 71, 74], 0.7, 2500, 3000);
    [84, 88, 91, 95, 91, 88].forEach((m, i) => pluck(T.memes + i * 0.16, m, 0.6)); bell(24.5, 91, 0.5); kick(24.0, 0.6); kick(24.5, 0.5);
    [25.0, 25.125, 25.25, 25.375].forEach((t) => hitmark(t, 1));
    airhorn(25.0, 0.16); airhorn(25.2, 0.16); e808(25.0, 0.9, 33, 1); kick(25.0, 1);
    scratch(25.5, 0.32); kick(25.5, 1); snare(26.0, 1); e808(26.0, 0.5, 31, 1); crash(26.0, 0.7); hat(25.75, 0.6); hat(26.25, 0.6);
    for (let b = 0; b < 2; b++) { kick(26.5 + b * BEAT, 1, friedBus); supersaw(26.5 + b * BEAT, 0.35, AM, 1.4, friedBus); }
    e808(26.5, 0.95, 33, 1.4, null, friedBus); impact(26.5, 0.8); snare(27.0, 1, friedBus);
    // the two guys: a gasp of brass and a pop
    supersaw(27.5, 0.35, [64, 68, 71], 1.2); impact(27.5, 0.5); snare(27.5, 1);
    // ---- [28, 30) kawaii: bright future bass, sparkles; the squeeze on beat 2
    [[60, 64, 67, 71], [57, 60, 64, 67]].forEach((ch, i) => {
      const t0 = T.kawaii + i;
      for (let b = 0; b < 2; b++) {
        kick(t0 + b * BEAT, 0.9);
        const a = amp(sawBus); a.gain.setValueAtTime(0, t0 + b * BEAT); a.gain.linearRampToValueAtTime(1.1, t0 + b * BEAT + 0.18); a.gain.linearRampToValueAtTime(0, t0 + b * BEAT + 0.48);
        const lp = filt('lowpass', 3800, 0.7, a);
        for (const m of [...ch, ch[0] + 12]) for (const d of [-14, 0, 14]) osc('sawtooth', hz(m), t0 + b * BEAT, 0.5, lp, d);
      }
      clap(t0 + BEAT, 0.9);
      for (let e = 0; e < 8; e++) { hat(t0 + e * 0.125, 0.35); pluck(t0 + e * 0.125, ch[e % 4] + 24, 0.35); }
      sub(t0, 1, ch[0] - 24, 0.7);
    });
    chime(T.kawaii + 0.5, 0.8); [96, 100, 103, 108].forEach((m, i) => bell(T.kawaii + 1.5 + i * 0.06, m, 0.25));
    // ---- [30, 32) the perfume advert: slow, sultry keys, a breath
    const keys = (t, notes, dur, g = 1) => {
      for (const m of notes) {
        const a = amp(midiBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g * 0.5, t + 0.02); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const vib = ac.createOscillator(); vib.frequency.value = 4.5; const dep = ac.createGain(); dep.gain.value = 4; vib.connect(dep); vib.start(t); vib.stop(t + dur);
        const o = osc('sine', hz(m), t, dur, a); dep.connect(o.detune); osc('triangle', hz(m) * 2, t, dur * 0.4, a);
      }
    };
    keys(T.ad, [50, 57, 60, 64, 69], 1.0, 0.9); keys(T.ad + 1.0, [48, 55, 59, 62, 67], 1.0, 0.9);
    sub(T.ad, 1, 26, 0.7); sub(T.ad + 1.0, 1, 24, 0.7);
    kick(T.ad, 0.5); snare(T.ad + 1.0, 0.4); hat(T.ad + 0.75, 0.3, true);
    { const a = amp(fxBus); a.gain.setValueAtTime(0.0001, T.ad + 0.3); a.gain.exponentialRampToValueAtTime(0.18, T.ad + 0.7); a.gain.exponentialRampToValueAtTime(0.0001, T.ad + 1.4); hiss(T.ad + 0.3, 1.1, filt('bandpass', 1100, 0.8, a)); }
    melody(T.ad, [null, 76, '-', 74, 72, '-', '-', 69], lead, 0.5, BEAT / 2);
    // ---- [32, 34) notice me, snappy: a scratch, then a heavenly choir that should not be this sincere
    scratch(T.starstruck, 0.3);
    const choir = (t, notes, dur, g = 1) => {
      for (const m of notes) for (const d of [-12, -4, 4, 12]) {
        const a = amp(padBus); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g * 0.6, t + 0.35); a.gain.setValueAtTime(g * 0.6, t + dur - 0.2); a.gain.linearRampToValueAtTime(0, t + dur + 0.4);
        const v = ac.createOscillator(); v.frequency.value = 5.2; const dd = ac.createGain(); dd.gain.value = 9; v.connect(dd); v.start(t); v.stop(t + dur + 0.5);
        const o = osc('sawtooth', hz(m), t, dur + 0.5, filt('lowpass', 1500, 2.5, filt('bandpass', 800, 0.9, a)), d); dd.connect(o.detune);
      }
    };
    choir(T.starstruck + 0.25, [60, 67, 72, 76], 1.7, 1); bell(T.starstruck + 0.3, 96, 0.4); bell(T.starstruck + 1.3, 100, 0.3);
    glitch(T.starstruck + 0.46, 10, 0.9); chime(T.starstruck + 0.56, 0.8);
    // ---- [34, 40) Act III: dark trap. The room of TVs; the wall; the games
    const trapbar = (t0, notes, g = 1) => {
      kick(t0, g); kick(t0 + 0.75, 0.8 * g); kick(t0 + 1.375, 0.7 * g); clap(t0 + 1.0, g); snare(t0 + 1.0, 0.5 * g);
      for (let e = 0; e < 16; e++) hat(t0 + e * 0.125, e % 4 === 0 ? 0.7 : 0.35);
      for (let r = 0; r < 6; r++) hat(t0 + 1.5 + r / 12, 0.25 + r * 0.06);
      e808(t0, 0.7, notes[0], 1); e808(t0 + 0.75, 0.6, notes[1], 0.9, notes[2]); e808(t0 + 1.375, 0.6, notes[0], 0.9);
    };
    trapbar(T.crt, [33, 36, 31]); trapbar(T.wall, [29, 33, 36]); trapbar(T.games, [31, 34, 33]);
    melody(T.crt, [69, null, 72, null, 76, 74, null, 72], (t, d, m, g) => bell(t, m, g), 0.45, BEAT / 2);
    melody(T.wall, [64, null, 67, null, 71, null, 69, 67], (t, d, m, g) => bell(t, m, g), 0.4, BEAT / 2);
    staticBurst(T.crt + 1.0, 0.08); impact(T.crt + 1.08, 0.9); riser(T.crt + 1.2, 0.8, 0.8);
    whoosh(T.wall, 0.4, 1.1); click(T.wall + 0.46); click(T.wall + 0.92); chime(T.wall + 1.75, 0.7);
    // the games: chiptune over the trap
    melody(T.games, [76, 79, 83, 88, 83, 79, 76, 71], (t, d, m, g) => chip(t, d * 0.8, m, g), 1, BEAT / 4);
    coin(T.games + 0.25); blip(T.games + 0.5, 660); blip(T.games + 0.62, 880); blip(T.games + 0.74, 990);
    impact(T.games + 1.0, 0.8); [72, 76, 79, 84].forEach((m, i) => chip(T.games + 1.05 + i * 0.07, 0.07, m, 1));
    impact(T.games + 1.5, 1.1); [79, 84, 88, 91, 96].forEach((m, i) => chip(T.games + 1.55 + i * 0.06, 0.08, m, 1));
    // ---- [40, 42) everything at once
    for (let i = 0; i < 8; i++) glitch(T.chaos + i * 0.25, 6, 0.6 + i * 0.05);
    stutter(T.chaos, AM, 16, 0.0625); riser(T.chaos, 2.0, 1.2); sub(T.chaos, 2.0, 33, 0.9);
    for (let b = 0; b < 4; b++) kick(T.chaos + b * BEAT, 1); impact(T.chaos + 1.0, 1.2); airhorn(T.chaos + 1.0, 0.3, 0.8);
    stutter(T.chaos + 1.5, AM, 16, 0.031); glitch(T.chaos + 1.6, 20, 1.2);
    // ---- [42, 43.4) the screen switches off
    zap(T.off, 1.2);
    // ---- [43.4, end) the light comes on; her; quiet
    click(T.end + 0.13);
    pad(T.end + 0.2, 3.8, [57, 64, 71], 0.7, 1200, 1800);
    bell(T.end + 1.21, 81, 0.5); pluck(T.end + 1.9, 88, 0.35); chime(T.end + 2.46, 0.6); bell(T.end + 2.5, 88, 0.5); bell(T.end + 3.0, 93, 0.35);

    const out = await ac.startRendering();
    return out.getChannelData(0);
  }
  // the music's file, rendered once and kept by the app; the key changes when the music does. The app also ships it
  // already rendered (media/notslop/music-<key>.webm, made from this very code), so the show doesn't wait the ~15 s
  // composing takes; if there's no file for this version of the music, it's composed instead
  const keyOf = (src) => `notslop-${[...src].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16)}`;
  let prepared = null;
  function prepare() {
    loadClips();
    prepared ||= (async () => {
      const key = keyOf(compose.toString());
      try {
        if (await snappy.call('sound.trackHas', { key })) return key;
        // the copy the app ships, made from this very music (the app decodes it); composing it is the fallback
        if (await snappy.call('sound.trackFile', { key, file: `media/notslop/music-${key}.webm` })) return key;
        const pcm = await compose();
        const bytes = new Uint8Array(pcm.length * 2), view = new DataView(bytes.buffer);
        for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, clamp(Math.round(pcm[i] * 32767), -32768, 32767), true);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return (await snappy.call('sound.track', { key, pcm: btoa(bin) })) ? key : null;
      } catch {
        prepared = null;
        return null;
      }
    })();
    return prepared;
  }

  // ===========================================================================
  // The 3D shots (rendered in Blender): short silent videos, played in time with the music
  // ===========================================================================
  const CLIPS = { styles: T.styles, flash: T.flash, shake: T.shake, kawaii: T.kawaii, ad: T.ad, starstruck: T.starstruck, crt: T.crt, wall: T.wall, end: T.end };
  let clips = null, clipsReady = null;
  function loadClips() {
    if (clipsReady) return clipsReady;
    clips = {};
    clipsReady = Promise.all(Object.keys(CLIPS).map((name) => new Promise((res) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disableRemotePlayback = true;
      const done = () => { v.removeEventListener('canplaythrough', done); res(); };
      v.addEventListener('canplaythrough', done);
      v.addEventListener('error', () => { delete clips[name]; res(); }, { once: true });
      v.src = `media/notslop/${name}.webm`;
      v.load();
      clips[name] = v;
      setTimeout(res, 6000);
    })));
    return clipsReady;
  }
  // the clip's frame for `local` seconds in: playing along, nudged back in step if it drifts
  function clipAt(name, local, still = false) {
    const v = clips?.[name];
    if (!v || v.readyState < 2) return null;
    if (still) {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - local) > 0.02 && !v.seeking) v.currentTime = local;
      return v;
    }
    if (v.paused) { v.currentTime = Math.max(0, local); v.play().catch(() => {}); }
    else if (Math.abs(v.currentTime - local) > 0.1) v.currentTime = local;
    return v;
  }
  const quiet = (except) => { for (const [k, v] of Object.entries(clips || {})) if (k !== except && !v.paused) v.pause(); };

  // ===========================================================================
  // The pictures
  // ===========================================================================
  // points to gather into: whatever `draw` paints on a small canvas, spread evenly and shuffled
  function sample(draw, cw, ch, step) {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const o = cv.getContext('2d');
    draw(o, cw, ch);
    const d = o.getImageData(0, 0, cw, ch).data, pts = [];
    for (let y = 0; y < ch; y += step) for (let x = 0; x < cw; x += step) if (d[(y * cw + x) * 4 + 3] > 120) pts.push([x / cw - 0.5, y / ch - 0.5]);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    return pts;
  }
  const herShape = () => sample((o, cw, ch) => {
    o.strokeStyle = '#fff'; o.fillStyle = '#fff'; o.lineWidth = 9;
    o.beginPath(); o.roundRect(cw * 0.12, ch * 0.3, cw * 0.76, ch * 0.56, ch * 0.18); o.stroke();
    o.beginPath(); o.roundRect(cw * 0.25, ch * 0.16, cw * 0.19, ch * 0.13, 10); o.stroke();
    o.beginPath(); o.ellipse(cw * 0.39, ch * 0.57, cw * 0.055, ch * 0.1, 0, 0, TAU); o.fill();
    o.beginPath(); o.ellipse(cw * 0.61, ch * 0.57, cw * 0.055, ch * 0.1, 0, 0, TAU); o.fill();
  }, 260, 220, 3);
  const heartShape = () => sample((o, cw, ch) => {
    o.fillStyle = '#fff';
    o.beginPath(); o.moveTo(cw / 2, ch * 0.86);
    o.bezierCurveTo(cw * 0.05, ch * 0.55, cw * 0.12, ch * 0.08, cw / 2, ch * 0.3);
    o.bezierCurveTo(cw * 0.88, ch * 0.08, cw * 0.95, ch * 0.55, cw / 2, ch * 0.86); o.fill();
  }, 220, 220, 3);
  // her as a wireframe: the body front and back, joined at the corners, the shutter, and two eyes
  function wireframe() {
    const pts = [], edges = [];
    const add = (x, y, z) => pts.push([x, y, z]) - 1;
    const loop = (list) => list.forEach((a, i) => edges.push([a, list[(i + 1) % list.length]]));
    const rounded = (z, w2, h2, r) => {
      const out = [];
      for (const [x0, y0, a0] of [[w2 - r, h2 - r, 0], [-(w2 - r), h2 - r, 0.25], [-(w2 - r), -(h2 - r), 0.5], [w2 - r, -(h2 - r), 0.75]]) {
        for (let k = 0; k <= 4; k++) { const a = (a0 + k / 16) * TAU; out.push(add(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, z)); }
      }
      loop(out);
      return out;
    };
    const front = rounded(0.32, 1.0, 0.7, 0.28), back = rounded(-0.32, 1.0, 0.7, 0.28);
    front.forEach((a, i) => { if (i % 5 === 2) edges.push([a, back[i]]); });
    loop([add(-0.6, -0.7, 0.18), add(-0.2, -0.7, 0.18), add(-0.2, -0.95, 0.18), add(-0.6, -0.95, 0.18)]);
    for (const ex of [-0.32, 0.32]) {
      const eye = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; eye.push(add(ex + Math.cos(a) * 0.11, 0.05 + Math.sin(a) * 0.19, 0.33)); }
      loop(eye);
    }
    return { pts, edges };
  }

  // ----- the graphics card: two backgrounds worked out per pixel (copper bars, a synthwave sun), and the last pass
  const BG = `precision highp float;
uniform vec2 res; uniform float t; uniform float beat; uniform float modeA;
vec3 raster(vec2 uv) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) { float fi = float(i); float y = 0.5 + 0.4 * sin(t * 1.7 + fi * 0.62);
    float d = abs(uv.y - y); float band = smoothstep(0.055, 0.0, d);
    col += (0.5 + 0.5 * cos(6.2831 * (fi * 0.12 + vec3(0.0, 0.33, 0.67)))) * band * (1.0 - d / 0.055) * 1.3; }
  return col * 0.75;
}
vec3 synth(vec2 p) {
  float hz = -0.06;
  if (p.y > hz) {
    vec3 col = mix(vec3(0.62, 0.14, 0.36), vec3(0.03, 0.0, 0.08), smoothstep(0.0, 0.6, p.y - hz));
    vec2 sp = p - vec2(0.0, hz + 0.2);
    float d = length(sp);
    float cut = step(0.5, fract((sp.y + 0.4) * 16.0 - t * 0.5)) + step(0.04, sp.y);
    vec3 sun = mix(vec3(1.0, 0.3, 0.3), vec3(1.0, 0.86, 0.45), smoothstep(-0.2, 0.22, sp.y));
    col = mix(col, sun, smoothstep(0.235, 0.228, d) * clamp(cut, 0.0, 1.0));
    col += vec3(1.0, 0.42, 0.3) * 0.32 * smoothstep(0.55, 0.0, d) * (1.0 + beat * 0.6);
    return col;
  }
  float k = hz - p.y, z = 0.22 / k, x = p.x * z;
  float lz = abs(fract(z * 1.4 + t * 2.0) - 0.5), lx = abs(fract(x * 1.3) - 0.5), wdt = 0.03 + 0.012 * z;
  float g = max(smoothstep(0.5 - wdt, 0.5, lz), smoothstep(0.5 - wdt * 1.4, 0.5, lx));
  vec3 col = vec3(0.08, 0.0, 0.1) + vec3(1.0, 0.5, 0.28) * g * exp(-z * 0.12) * (1.0 + beat * 0.8);
  return col + vec3(1.0, 0.4, 0.3) * 0.25 * exp(-k * 18.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / res, p = (gl_FragCoord.xy - 0.5 * res) / res.y;
  vec3 col = modeA < 0.5 ? vec3(0.0) : modeA < 1.5 ? raster(uv) : synth(p);
  gl_FragColor = vec4(col, 1.0);
}`;
  // the last pass: zoom punches, the CRT curve, tears, colour split, pixel sorting, bloom, datamosh, VHS wobble,
  // pixelation, deep frying, scanlines, grain
  const POST = `precision highp float;
uniform sampler2D bg; uniform sampler2D fg; uniform sampler2D prev; uniform vec2 res; uniform float t;
uniform float aberr; uniform float tear; uniform float curve; uniform float scan; uniform float flash; uniform float crt; uniform float seed;
uniform float glow; uniform float zoom; uniform float sorting; uniform float mosh; uniform float mseed; uniform float invert;
uniform float vhs; uniform float pixel; uniform float fry;
float h(float n) { return fract(sin(n) * 43758.5453); }
vec3 at(vec2 uv) { return texture2D(bg, uv).rgb + texture2D(fg, uv).rgb; }
void main() {
  vec2 frag = gl_FragCoord.xy / res;
  vec2 uv = frag;
  vec2 cc = (uv - 0.5) * (1.0 - zoom * 0.14); uv = cc * (1.0 + curve * dot(cc, cc) * 0.4) + 0.5;
  if (pixel > 0.0) { float px = mix(1.0, 40.0, pixel); uv = (floor(uv * res / px) + 0.5) * px / res; }
  if (vhs > 0.0) uv.x += (sin(uv.y * 220.0 + t * 31.0) * 0.0011 + (h(floor(uv.y * 80.0) + floor(t * 24.0)) - 0.5) * 0.0035) * vhs;
  if (tear > 0.0) {
    float band = floor(uv.y * 24.0 + seed * 9.0);
    if (h(band + seed * 17.0) > 1.0 - tear * 0.65) uv.x += (h(band * 2.31 + seed) - 0.5) * tear * 0.28;
  }
  if (crt > 0.0) {
    float sy = max(0.003, 1.0 - smoothstep(0.0, 0.55, crt)), sx = max(0.003, 1.0 - smoothstep(0.5, 1.0, crt));
    uv = (uv - 0.5) / vec2(sx, sy) + 0.5;
  }
  vec2 off = vec2(aberr * 0.007 + tear * 0.012 + vhs * 0.003, aberr * 0.002);
  vec3 col = vec3(at(uv + off).r, at(uv).g, at(uv - off).b);
  if (sorting > 0.0) {
    vec3 m = col;
    for (int i = 1; i < 18; i++) {
      vec3 s = at(uv + vec2(0.0, float(i) * 0.009 * sorting));
      m = max(m, s * step(0.42, dot(s, vec3(0.3, 0.59, 0.11))) * (1.0 - float(i) / 22.0));
    }
    col = mix(col, m, clamp(sorting, 0.0, 1.0));
  }
  if (glow > 0.0) {
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; vec2 o = vec2(cos(a), sin(a)) * vec2(0.010, 0.016);
      b += texture2D(fg, uv + o).rgb + texture2D(fg, uv + o * 2.4).rgb + texture2D(bg, uv + o * 1.8).rgb * 0.35; }
    col += max(b / 16.0 - 0.35, 0.0) * glow;
  }
  if (mosh > 0.0) {
    vec2 blk = floor(gl_FragCoord.xy / 18.0);
    vec2 mv = (vec2(h(blk.x * 1.7 + blk.y * 31.3 + mseed), h(blk.y * 2.9 + blk.x * 17.1 + mseed * 1.3)) - 0.5) * 0.035;
    col = mix(col, texture2D(prev, frag - mv).rgb, mosh * 0.9);
  }
  if (vhs > 0.0) {
    float l = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, mix(vec3(l), col, 0.8) * vec3(1.04, 1.0, 0.92), vhs);
    col += step(0.995, h(floor(uv.y * 300.0) + floor(t * 30.0))) * 0.25 * vhs;
  }
  if (fry > 0.0) {
    vec2 blk = floor(gl_FragCoord.xy / 8.0);
    float l = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(vec3(l), col, 1.0 + 2.2 * fry);
    col = (col - 0.5) * (1.0 + 1.6 * fry) + 0.5 + vec3(0.12, 0.04, -0.06) * fry;
    float lv = mix(48.0, 5.0, fry);
    col = floor(clamp(col, 0.0, 1.0) * lv + h(blk.x * 3.1 + blk.y * 7.7) * 0.6 * fry) / lv;
  }
  col *= 1.0 - scan * 0.22 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  col += (h(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + fract(t * 7.0)) - 0.5) * 0.05;
  vec2 v = uv - 0.5; col *= 1.0 - dot(v, v) * 0.9;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = mix(vec3(0.0), col, mosh);
  col += flash;
  col = mix(col, 1.0 - col, invert);
  col *= 1.0 + crt * 2.5;
  gl_FragColor = vec4(col, 1.0);
}`;
  const BLIT = 'precision highp float; uniform sampler2D img; uniform vec2 res; void main() { gl_FragColor = texture2D(img, gl_FragCoord.xy / res); }';
  function gpu(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const make = (frag) => {
      const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 q; void main() { gl_Position = vec4(q, 0.0, 1.0); }'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      const u = {};
      return { pr, u: (name) => (u[name] ??= gl.getUniformLocation(pr, name)) };
    };
    const bgP = make(BG), postP = make(POST), blitP = make(BLIT);
    if (!bgP || !postP || !blitP) return null;
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const tex = (w, h) => {
      const x = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, x);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return x;
    };
    const target = (x) => { const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return fb; };
    // the backgrounds are worked out at a little under full size (they're soft by nature); the finished frames take
    // turns, so the next one can smear the last (the datamosh)
    const bw = Math.round(canvas.width * 0.75), bh = Math.round(canvas.height * 0.75);
    const bgTex = tex(bw, bh), bgFb = target(bgTex);
    const frames = [tex(canvas.width, canvas.height), tex(canvas.width, canvas.height)], frameFb = frames.map(target);
    const fgTex = tex();
    let cur = 0;
    const draw = (pr) => { const loc = gl.getAttribLocation(pr.pr, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    return (fg, f) => {
      gl.useProgram(bgP.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bgFb);
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(bgP.u('res'), bw, bh);
      for (const k of ['t', 'beat', 'modeA']) gl.uniform1f(bgP.u(k), f[k]);
      draw(bgP);
      gl.useProgram(postP.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, frameFb[cur]);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bgTex); gl.uniform1i(postP.u('bg'), 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, frames[1 - cur]); gl.uniform1i(postP.u('prev'), 2);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fg);
      gl.uniform1i(postP.u('fg'), 1);
      gl.uniform2f(postP.u('res'), canvas.width, canvas.height);
      for (const k of ['t', 'aberr', 'tear', 'curve', 'scan', 'flash', 'crt', 'seed', 'glow', 'zoom', 'sorting', 'mosh', 'mseed', 'invert', 'vhs', 'pixel', 'fry']) gl.uniform1f(postP.u(k), f[k]);
      draw(postP);
      gl.useProgram(blitP.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frames[cur]); gl.uniform1i(blitP.u('img'), 0);
      gl.uniform2f(blitP.u('res'), canvas.width, canvas.height);
      draw(blitP);
      cur = 1 - cur;
    };
  }

  // ===========================================================================
  // The words: on their own layer above everything, never blurred
  // ===========================================================================
  // each of her looks in the 3D part, by the frame (24 a second) it starts on
  const LOOKS = [[1, 'WIREFRAME'], [25, 'NORMALS'], [37, 'LOW POLY'], [49, '8-BIT'], [61, 'CLAY'], [73, 'TOON'], [85, 'HOLOGRAM'], [97, 'CHROME'],
    [109, 'GOLD'], [121, 'GLASS'], [133, 'MARBLE'], [145, 'WIREFRAME'], [151, 'NORMALS'], [157, 'TOON'], [160, 'HOLOGRAM'], [163, 'CHROME'], [166, 'GLASS'], [169, 'FINAL RENDER']];
  const NAMES = [[T.her + 0.4, T.claude - 0.2, 'SNAPPY', '#ffffff'], [T.claude + 0.15, T.styles - 0.1, 'CLAUDE', '#e8956a'], [T.crt + 0.25, T.wall - 0.05, 'THE PROGRAM', '#7ee8ff']];
  const YEARS = [[T.page, T.flash, '2004'], [T.flash, T.shake, '2009'], [T.shake, T.memes, '2013'], [24, 25, '2013'], [25, 25.5, '2014'], [25.5, 26.5, '2016'], [26.5, 27.5, '2017'], [27.5, 28, '2019']];

  function words(u, W, H, t) {
    const S = Math.min(W, H);
    const text = (str, x, y, size, color, { weight = 900, font = '"Segoe UI", system-ui, sans-serif', align = 'left', spacing = 0, shadow = 'rgba(0,0,0,.85)' } = {}) => {
      u.font = `${weight} ${Math.round(size)}px ${font}`; u.letterSpacing = `${Math.round(spacing)}px`; u.textAlign = align; u.textBaseline = 'alphabetic';
      if (shadow) { u.fillStyle = shadow; u.fillText(str, x + Math.max(2, size * 0.05), y + Math.max(2, size * 0.05)); }
      u.fillStyle = color; u.fillText(str, x, y);
    };
    // who's on: a big name, typed, with a bar of their colour under it
    for (const [a, b, name, color] of NAMES) {
      if (t < a || t > b) continue;
      const k = t - a, size = S * 0.075, shown = name.slice(0, Math.floor(k * 22));
      const fade = 1 - smooth((t - (b - 0.25)) / 0.25);
      u.globalAlpha = fade;
      text(shown, W * 0.05, H * 0.9, size, '#ffffff', { spacing: size * 0.18 });
      u.fillStyle = color; u.fillRect(W * 0.05, H * 0.9 + size * 0.22, Math.min(1, k * 2.2) * size * name.length * 0.82, size * 0.08);
      u.globalAlpha = 1;
    }
    // the years, like a camcorder's display
    for (const [a, b, year] of YEARS) {
      if (t < a || t > b) continue;
      const size = S * 0.05;
      text('PLAY ▶', W * 0.95, H * 0.1, size * 0.45, '#ffffff', { align: 'right', font: 'ui-monospace, Consolas, monospace', weight: 700 });
      text(year, W * 0.95, H * 0.1 + size * 1.1, size, '#ffffff', { align: 'right', font: 'ui-monospace, Consolas, monospace', weight: 700 });
    }
    // her looks in 3D, like a render readout
    if (t >= T.styles && t < T.net) {
      const fr = Math.floor((t - T.styles) * 24) + 1;
      let look = LOOKS[0][1], n = 0;
      LOOKS.forEach(([f0, name], i) => { if (fr >= f0) { look = name; n = i; } });
      const size = S * 0.03;
      text(`[ ${String(n + 1).padStart(2, '0')} / ${LOOKS.length} ]`, W * 0.05, H * 0.86, size * 0.8, '#ffc49e', { font: 'ui-monospace, Consolas, monospace', weight: 700 });
      text(look, W * 0.05, H * 0.86 + size * 1.5, size * 1.4, '#ffffff', { font: 'ui-monospace, Consolas, monospace', weight: 800, spacing: size * 0.2 });
    }
    // kawaii~: bouncing letters, pink, with sparkles and hearts round them
    if (t >= T.kawaii + 0.45 && t < T.ad) {
      const k = t - T.kawaii - 0.45, size = S * 0.085, word = 'kawaii~';
      u.font = `900 ${Math.round(size)}px "Segoe UI Black", "Segoe UI", sans-serif`; u.textAlign = 'center'; u.letterSpacing = '0px';
      let x = W * 0.72 - u.measureText(word).width / 2;
      [...word].forEach((ch, i) => {
        const w0 = u.measureText(ch).width, pop = smooth((k - i * 0.04) / 0.12), y = H * 0.3 - Math.abs(Math.sin((k * 4 + i * 0.5) * Math.PI)) * size * 0.18;
        if (pop > 0) {
          u.save(); u.translate(x + w0 / 2, y); u.scale(pop, pop);
          u.lineWidth = size * 0.16; u.strokeStyle = '#ffffff'; u.strokeText(ch, 0, 0); u.fillStyle = '#ff5fa2'; u.fillText(ch, 0, 0);
          u.restore();
        }
        x += w0;
      });
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + k * 2, r = S * (0.16 + 0.03 * Math.sin(k * 6 + i)), sx = W * 0.72 + Math.cos(a) * r * 1.6, sy = H * 0.28 + Math.sin(a) * r * 0.7;
        u.fillStyle = i % 2 ? '#ffffff' : '#ffd84a'; star(u, sx, sy, S * (0.012 + 0.006 * Math.sin(k * 9 + i)));
      }
      u.font = `${Math.round(S * 0.05)}px "Segoe UI Emoji", sans-serif`;
      for (let i = 0; i < 4; i++) { u.globalAlpha = 0.85; u.fillText('\u{1F497}', W * (0.62 + 0.1 * i), H * (0.75 - ((k * 0.5 + i * 0.27) % 1) * 0.6)); u.globalAlpha = 1; }
    }
    // the perfume advert's line, once it's the product shot
    if (t >= T.ad + 1.35 && t < T.starstruck) {
      u.globalAlpha = smooth((t - T.ad - 1.35) / 0.3);
      text('SNAPPY.', W * 0.7, H * 0.78, S * 0.07, '#ffffff', { align: 'center', weight: 400, font: 'Georgia, "Times New Roman", serif', spacing: S * 0.02, shadow: 'rgba(0,0,0,.5)' });
      text('pour femme', W * 0.7, H * 0.78 + S * 0.05, S * 0.03, '#ffd1dc', { align: 'center', weight: 400, font: 'Georgia, "Times New Roman", serif', spacing: S * 0.012, shadow: 'rgba(0,0,0,.5)' });
      u.globalAlpha = 1;
    }
    // notice me, snappy~
    if (t >= T.starstruck + 0.2 && t < T.crt) {
      text('notice me, snappy~'.slice(0, Math.floor((t - T.starstruck - 0.2) * 18)), W / 2, H * 0.9, S * 0.05, '#ffd1ec', { align: 'center', weight: 700 });
    }
    // the end: her name, and what she is
    if (t > T.end + 1.7) {
      const a = smooth((t - T.end - 1.7) / 0.6) * (1 - smooth((t - END + 0.35) / 0.35));
      u.globalAlpha = a;
      text('Snappy', W / 2, H * 0.86, S * 0.085, '#ffffff', { align: 'center', weight: 800, shadow: 'rgba(0,0,0,.6)' });
      text('not slop.', W / 2, H * 0.86 + S * 0.06, S * 0.032, '#ffd1dc', { align: 'center', weight: 500, font: 'Georgia, serif', shadow: 'rgba(0,0,0,.6)' });
      u.globalAlpha = 1;
    }
  }

  function star(u, x, y, r) {
    u.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r * 0.3 : r; u.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    u.closePath(); u.fill();
  }

  // ===========================================================================
  // The drawn parts
  // ===========================================================================
  // her 2004 homepage, in a browser of the time
  function homepage(g, W, H, k, f) {
    const S = Math.min(W, H);
    // the dial-up box first
    if (k < T.page - T.net) {
      g.fillStyle = '#008080'; g.fillRect(0, 0, W, H);
      const bw = S * 0.62, bh = S * 0.24, x = (W - bw) / 2, y = (H - bh) / 2;
      bevel(g, x, y, bw, bh);
      g.fillStyle = '#000080'; g.fillRect(x + 4, y + 4, bw - 8, S * 0.035);
      g.font = `700 ${Math.round(S * 0.022)}px Tahoma, sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('Connecting...', x + 12, y + S * 0.028);
      g.fillStyle = '#000'; g.font = `400 ${Math.round(S * 0.024)}px Tahoma, sans-serif`;
      g.fillText('Dialing members.snap ...  28800 bps', x + 18, y + S * 0.09);
      g.fillStyle = '#fff'; g.fillRect(x + 18, y + S * 0.13, bw - 36, S * 0.04);
      g.fillStyle = '#000080';
      const n = Math.floor(k / (T.page - T.net) * 14);
      for (let i = 0; i < n; i++) g.fillRect(x + 22 + i * (bw - 44) / 14, y + S * 0.135, (bw - 44) / 14 - 4, S * 0.03);
      return;
    }
    const pk = k - (T.page - T.net);
    // the window
    g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000080'; g.fillRect(0, 0, W, S * 0.05);
    g.font = `700 ${Math.round(S * 0.026)}px Tahoma, sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText("~*~ Snappy's Homepage ~*~  - Web Browser", S * 0.02, S * 0.035);
    g.fillStyle = '#000'; g.font = `400 ${Math.round(S * 0.022)}px Tahoma, sans-serif`;
    ['Back', 'Forward', 'Stop', 'Refresh', 'Home'].forEach((b, i) => { bevel(g, S * 0.02 + i * S * 0.12, S * 0.06, S * 0.11, S * 0.045); g.fillStyle = '#000'; g.fillText(b, S * 0.035 + i * S * 0.12, S * 0.09); });
    g.fillStyle = '#fff'; g.fillRect(S * 0.66, S * 0.063, W - S * 0.7, S * 0.04);
    g.fillStyle = '#000'; g.fillText('http://members.snap/~snappy/index.htm', S * 0.67, S * 0.091);
    const top = S * 0.12;
    // the page: stars on black, loading top to bottom like it's 2004
    const loaded = top + (H - top) * smooth(pk / 0.35);
    g.save(); g.beginPath(); g.rect(0, top, W, loaded - top); g.clip();
    g.fillStyle = '#000010'; g.fillRect(0, top, W, H - top);
    for (let i = 0; i < 140; i++) {
      const x = (i * 97.3) % W, y = top + ((i * 53.7) % (H - top)), tw = (Math.sin(pk * 9 + i) + 1) / 2;
      g.fillStyle = i % 5 ? `rgba(255,255,255,${0.3 + tw * 0.6})` : '#ffe27a'; g.fillRect(x, y, i % 7 ? 2 : 3, i % 7 ? 2 : 3);
    }
    // the title in rainbow WordArt
    const title = "Welcome to Snappy's Homepage!!!";
    g.font = `900 ${Math.round(S * 0.07)}px "Comic Sans MS", "Comic Sans", cursive`; g.textAlign = 'left';
    let tx = W / 2 - g.measureText(title).width / 2;
    [...title].forEach((ch, i) => {
      const y = top + S * 0.13 + Math.sin(pk * 7 + i * 0.5) * S * 0.012;
      g.fillStyle = `hsl(${(i * 24 + pk * 240) % 360}, 100%, 60%)`; g.strokeStyle = '#000'; g.lineWidth = S * 0.006;
      g.strokeText(ch, tx, y); g.fillText(ch, tx, y);
      tx += g.measureText(ch).width;
    });
    // a marquee
    g.font = `700 ${Math.round(S * 0.032)}px "Times New Roman", serif`; g.fillStyle = '#ffff00';
    const mq = '*** NEW CLIPS ADDED!!! *** sign my guestbook!!! *** best viewed at 800x600 *** ';
    g.fillText(mq + mq, W - ((pk * W * 0.9) % (W + g.measureText(mq).width)), top + S * 0.21);
    // under construction
    const ux = W * 0.08, uy = top + S * 0.27, uw = W * 0.84, uh = S * 0.06;
    g.save(); g.beginPath(); g.rect(ux, uy, uw, uh); g.clip();
    for (let x = -uh; x < uw + uh; x += uh * 0.8) { g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(ux + x, uy); g.lineTo(ux + x + uh * 0.4, uy); g.lineTo(ux + x + uh * 0.4 - uh, uy + uh); g.lineTo(ux + x - uh, uy + uh); g.fill(); }
    g.restore();
    g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(ux, uy, uw, uh);
    g.font = `900 ${Math.round(S * 0.04)}px Impact, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText('UNDER CONSTRUCTION', W / 2, uy + uh * 0.75);
    // her, as a dancing GIF, and the links
    const px = Math.max(3, Math.round(S * 0.012));
    Arcade.snappy(g, W / 2 - 7 * px, top + S * 0.38, { px, step: Math.floor(pk * 8), air: Math.floor(pk * 4) % 2 === 1 });
    g.textAlign = 'left'; g.font = `400 ${Math.round(S * 0.032)}px "Times New Roman", serif`;
    ['My Clips', 'Links', 'Guestbook', 'Webring >>'].forEach((l, i) => {
      const x = W * 0.12, y = top + S * 0.42 + i * S * 0.05;
      g.fillStyle = '#5c8cff'; g.fillText(l, x, y); g.fillRect(x, y + 3, g.measureText(l).width, 2);
      if (i === 0 && Math.floor(pk * 6) % 2) { g.fillStyle = '#ff2a2a'; g.font = `900 ${Math.round(S * 0.026)}px Arial, sans-serif`; g.fillText('NEW!', x + S * 0.16, y); g.font = `400 ${Math.round(S * 0.032)}px "Times New Roman", serif`; }
    });
    // the visitor counter
    const vx = W * 0.66, vy = top + S * 0.42;
    g.fillStyle = '#fff'; g.font = `400 ${Math.round(S * 0.026)}px "Times New Roman", serif`; g.fillText('You are visitor #', vx, vy);
    g.fillStyle = '#000'; g.fillRect(vx, vy + S * 0.015, S * 0.24, S * 0.06); g.strokeStyle = '#888'; g.strokeRect(vx, vy + S * 0.015, S * 0.24, S * 0.06);
    g.fillStyle = '#39ff14'; g.font = `700 ${Math.round(S * 0.045)}px ui-monospace, Consolas, monospace`;
    g.fillText(String(41 + Math.floor(pk * 37)).padStart(6, '0'), vx + S * 0.012, vy + S * 0.062);
    g.fillStyle = '#ccc'; g.font = `400 ${Math.round(S * 0.02)}px "Times New Roman", serif`; g.textAlign = 'center';
    g.fillText('Best viewed in 800x600. Made with Notepad.', W / 2, H - S * 0.03);
    g.restore();
    // a sparkly cursor heading for her
    const cx = W * (0.85 - pk * 0.25), cy = H * (0.85 - pk * 0.18);
    for (let i = 0; i < 8; i++) { g.fillStyle = `hsla(${i * 45}, 100%, 70%, ${1 - i / 8})`; g.fillRect(cx + i * 7, cy + i * 5, 4, 4); }
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 22); g.lineTo(cx + 6, cy + 17); g.lineTo(cx + 11, cy + 27); g.lineTo(cx + 15, cy + 25); g.lineTo(cx + 10, cy + 15); g.lineTo(cx + 17, cy + 15); g.closePath(); g.fill(); g.stroke();
    f.vhs = 0.7; f.curve = 0.5; f.scan = 0.55;
    // the click on her: a crash zoom into the next year
    if (pk > 1.15) { f.zoom = (pk - 1.15) * 5; f.aberr = 0.4 + (pk - 1.15) * 4; f.flash = smooth((pk - 1.4) / 0.1) * 0.9; }
  }
  function bevel(g, x, y, w, h) {
    g.fillStyle = '#c0c0c0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#fff'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
    g.fillStyle = '#404040'; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  }

  // the memes, over a still of her, in the order they happened: such handmade; hitmarkers; deal with it; deep fried;
  // two guys pointing at her
  const STILL = 1.6, EYE_L = [0.432, 0.614], EYE_R = [0.565, 0.614];   // the end card's frame used for the memes, and where her eyes are in it
  function memes(g, W, H, k, f, still) {
    const S = Math.min(W, H);
    const box = cover(W, H, 960, 540);
    if (still) g.drawImage(still, ...box);
    const eye = ([x, y]) => [box[0] + x * box[2], box[1] + y * box[3]];
    const beat = Math.floor(k / BEAT), within = k % BEAT;
    if (k < 1) {
      const lines = [['such handmade', 0.12, 0.2, '#ff00ff'], ['very not slop', 0.6, 0.28, '#00e5ff'], ['wow', 0.38, 0.12, '#ffff00'], ['much clip', 0.68, 0.72, '#39ff14'], ['so 60fps', 0.14, 0.7, '#ff8a00']];
      g.font = `400 ${Math.round(S * 0.055)}px "Comic Sans MS", "Comic Sans", cursive`; g.textAlign = 'left';
      lines.forEach(([str, x, y, col], i) => { if (k > i * 0.16) { g.fillStyle = col; g.fillText(str, W * x, H * y); } });
    } else if (k >= 3.5) {
      // two excited guys, gasping and pointing at her
      const pop = (at) => 1 + Math.max(0, 0.18 - (k - at)) * 2;
      pointing(g, W * 0.13, H * 0.84, S * 0.66 * pop(3.5), { glasses: true, look: 1 });
      pointing(g, W * 0.84, H * 0.44, S * 0.4 * pop(3.56), { look: -1, point: true });
      f.zoom = k < 3.6 ? 0.5 : 0; f.aberr = 0.4;
    } else if (k < 1.5) {
      const n = Math.floor((k - 1) / 0.125);
      for (let i = 0; i <= n; i++) {
        const x = W * (0.3 + ((i * 0.37) % 0.4)), y = H * (0.35 + ((i * 0.23) % 0.3)), r = S * 0.03;
        g.strokeStyle = '#fff'; g.lineWidth = S * 0.006;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(x + dx * r * 0.4, y + dy * r * 0.4); g.lineTo(x + dx * r, y + dy * r); g.stroke(); }
        g.font = `900 ${Math.round(S * 0.04)}px Impact, sans-serif`; g.fillStyle = '#ffe14d'; g.textAlign = 'center'; g.fillText('+100', x, y - r * 1.4);
      }
      f.zoom = (1 - within / BEAT) * 0.8; f.aberr = 0.8; f.tear = within < 0.08 ? 0.4 : 0;
    } else if (k < 2.5) {
      // pixel shades come down, land on her eyes on the beat
      const land = smooth((k - 1.5) / 0.5);
      const [lx, ly] = eye(EYE_L), [rx] = eye(EYE_R);
      const pw = (rx - lx) / 7, y = ly - pw * 2.5 - (1 - land) * H * 0.6;
      const shade = [[0, 0, 13], [0, 1, 13], [1, 2, 4], [8, 2, 4], [2, 3, 2], [9, 3, 2]];
      g.fillStyle = '#000';
      const sx = lx - pw * 3;
      for (const [x0, y0, wd] of shade) g.fillRect(sx + x0 * pw, y + y0 * pw, wd * pw, pw);
      g.fillStyle = '#fff'; g.fillRect(sx + pw, y + pw * 2, pw, pw); g.fillRect(sx + 8 * pw, y + pw * 2, pw, pw);
      if (k > 2.0) {
        g.font = `900 ${Math.round(S * 0.08)}px Impact, sans-serif`; g.textAlign = 'center'; g.lineWidth = S * 0.012; g.strokeStyle = '#000'; g.fillStyle = '#fff';
        g.strokeText('DEAL WITH IT', W / 2, H * 0.9); g.fillText('DEAL WITH IT', W / 2, H * 0.9);
        if (k < 2.1) f.zoom = 0.6;
      }
    } else {
      // deep fried: laser eyes, the top text and the bottom text, emoji
      const grow = smooth((k - 2.5) / 0.25);
      for (const e of [EYE_L, EYE_R]) {
        const [x, y] = eye(e), r = S * (0.025 + 0.06 * grow);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,40,40,0.95)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        g.fillStyle = 'rgba(255,60,60,0.9)'; g.fillRect(x - r * 2, y - S * 0.004, r * 4, S * 0.008); g.fillRect(x - S * 0.004, y - r * 1.4, S * 0.008, r * 2.8);
      }
      g.font = `900 ${Math.round(S * 0.075)}px Impact, sans-serif`; g.textAlign = 'center'; g.lineWidth = S * 0.012; g.strokeStyle = '#000'; g.fillStyle = '#fff';
      for (const [str, y] of [['WHEN THEY CALL YOU SLOP', H * 0.14], ['NOT SLOP', H * 0.92]]) { g.strokeText(str, W / 2, y); g.fillText(str, W / 2, y); }
      g.font = `${Math.round(S * 0.08)}px "Segoe UI Emoji", sans-serif`;
      g.fillText('\u{1F602}', W * 0.14, H * 0.5); g.fillText('\u{1F44C}', W * 0.84, H * 0.42); g.fillText('\u{1F4AF}', W * 0.8, H * 0.74);
      f.fry = 1; f.zoom = Math.max(0, 0.7 - (k - 2.5) * 2) + (within < 0.06 ? 0.4 : 0); f.aberr = 1.2;
    }
  }

  // the two excited guys from the meme, drawn here in their spirit: bald, stubbly, gasping; one with glasses, one pointing.
  // (x, y) is the middle of the head, s its height; `look` turns the eyes toward her (-1 left, 1 right)
  function pointing(g, x, y, s, { glasses = false, point = false, look = 0 } = {}) {
    const P = (px, py) => [x + px * s + Math.sin(px * 37 + py * 23) * s * 0.004, y + py * s + Math.cos(px * 29 - py * 31) * s * 0.004];
    const path = (pts, close = false) => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(...P(px, py)) : g.moveTo(...P(px, py)))); if (close) g.closePath(); };
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = Math.max(2, s * 0.012); g.strokeStyle = '#111';
    if (point) {
      // a body and an arm out toward her, a hand with one finger
      g.fillStyle = '#fff';
      path([[0.3, 0.42], [0.62, 0.62], [0.75, 1.6], [-0.2, 1.6], [-0.32, 0.8], [-0.82, 0.7], [-1.08, 0.62], [-1.2, 0.6], [-1.08, 0.55], [-1.0, 0.5], [-0.88, 0.56], [-0.34, 0.6], [-0.3, 0.42]], true);
      g.fill(); g.stroke();
    }
    // the head: a bald dome down to a stubbly jaw
    g.fillStyle = '#fff';
    path([[-0.4, 0.22], [-0.44, -0.1], [-0.36, -0.38], [-0.18, -0.54], [0.05, -0.57], [0.26, -0.5], [0.4, -0.3], [0.44, 0.0], [0.42, 0.26], [0.3, 0.45], [0.12, 0.54], [-0.1, 0.54], [-0.28, 0.44]], true);
    g.fill(); g.stroke();
    for (const [a, b, yy] of [[-0.3, 0.3, -0.28], [-0.26, 0.24, -0.22], [-0.2, 0.28, -0.17]]) path([[a, yy + 0.01], [(a + b) / 2, yy - 0.02], [b, yy + 0.015]]), g.stroke();
    // eyes, looking at her
    for (const ex of [-0.17, 0.17]) {
      g.beginPath(); g.ellipse(...P(ex, 0.0), s * 0.085, s * 0.04, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
      g.beginPath(); g.arc(...P(ex + look * 0.035, 0.0), s * 0.026, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill();
    }
    if (glasses) {
      for (const [a, b] of [[-0.33, -0.03], [0.03, 0.33]]) path([[a, -0.07], [b, -0.07], [b, 0.08], [a, 0.08]], true), g.stroke();
      path([[-0.03, -0.02], [0.03, -0.02]]); g.stroke();
      path([[-0.33, -0.04], [-0.43, -0.06]]); g.stroke(); path([[0.33, -0.04], [0.43, -0.06]]); g.stroke();
    }
    path([[0.0, 0.04], [-0.06, 0.2], [0.05, 0.23], [0.03, 0.06]]); g.stroke();
    // the gasp
    g.beginPath(); g.ellipse(...P(0.0, 0.34), s * 0.1, s * 0.12, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(...P(0.0, 0.35), s * 0.075, s * 0.095, 0, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill();
    // stubble
    g.lineWidth = Math.max(1, s * 0.006);
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.05 + 0.9 * ((i * 0.618) % 1)), r = 0.36 + ((i * 0.37) % 0.12);
      const px = Math.cos(a) * r, py = 0.18 + Math.sin(a) * r * 0.85;
      if (Math.abs(px) < 0.13 && py > 0.2 && py < 0.48) continue;
      path([[px, py], [px + 0.012, py + 0.035]]); g.stroke();
    }
    g.restore();
  }

  // her in other games: a platformer, a battle, a fight, a knockout (drawn small, scaled up with hard pixels)
  const lo = document.createElement('canvas'); lo.width = 320; lo.height = 180;
  const lg = lo.getContext('2d');
  function games(g, W, H, k, f) {
    const P = Arcade.PAL, cut = Math.floor(k / BEAT), kk = k % BEAT;
    lg.imageSmoothingEnabled = false;
    lg.textBaseline = 'alphabetic';
    const px = (str, x, y, size, col, align = 'left') => { lg.font = `700 ${size}px ui-monospace, Consolas, monospace`; lg.textAlign = align; lg.fillStyle = '#000'; lg.fillText(str, x + 1, y + 1); lg.fillStyle = col; lg.fillText(str, x, y); };
    if (cut === 0) {
      lg.fillStyle = '#6ec6ff'; lg.fillRect(0, 0, 320, 180);
      lg.fillStyle = '#fff'; for (const [x, y] of [[40, 30], [200, 22], [270, 50]]) { lg.fillRect(x, y, 30, 8); lg.fillRect(x + 6, y - 6, 18, 8); }
      for (let x = 0; x < 320; x += 16) { lg.fillStyle = '#b4532a'; lg.fillRect(x, 148, 16, 32); lg.fillStyle = '#000'; lg.fillRect(x, 148, 16, 1); lg.fillRect(x + 15, 148, 1, 32); lg.fillRect(x, 164, 16, 1); }
      lg.fillStyle = '#ffd84a'; lg.fillRect(150, 70, 16, 16); lg.fillStyle = '#000'; lg.strokeStyle = '#000'; lg.strokeRect(150.5, 70.5, 15, 15); px('?', 158, 83, 12, '#fff', 'center');
      const jump = Math.sin(clamp(kk / BEAT, 0, 1) * Math.PI);
      Arcade.snappy(lg, 151, 132 - jump * 48, { px: 1, air: jump > 0.1 });
      if (kk > 0.18) { const c = (kk - 0.18) * 3; lg.fillStyle = '#ffe14d'; lg.fillRect(154, 64 - c * 40, 8, 10); px('+1', 168, 60 - c * 40, 9, '#fff'); }
      px('SNAPPY x03', 10, 14, 10, '#fff'); px('COINS 12', 130, 14, 10, '#fff'); px('STAGE 1', 250, 14, 10, '#fff');
    } else if (cut === 1) {
      lg.fillStyle = '#000'; lg.fillRect(0, 0, 320, 180);
      Arcade.minion(lg, 136, 30, Math.floor(kk * 8), 3);
      lg.fillStyle = '#1b3a8f'; lg.fillRect(8, 112, 304, 62); lg.strokeStyle = '#fff'; lg.lineWidth = 2; lg.strokeRect(9, 113, 302, 60);
      px('LAG.EXE blocks the way!', 18, 130, 10, '#fff');
      ['FIGHT', 'SNAP', 'ITEM', 'RUN'].forEach((o, i) => px(o, 34 + (i % 2) * 90, 148 + Math.floor(i / 2) * 16, 10, '#fff'));
      if (Math.floor(kk * 8) % 2 === 0) px('▶', 22, 148, 10, '#fff');
      px('SNAPPY  HP 60/60', 190, 148, 9, '#9be38c');
    } else {
      // the fight, then the knockout
      const sky = lg.createLinearGradient(0, 0, 0, 180); sky.addColorStop(0, '#2a1650'); sky.addColorStop(1, '#ff7a5a');
      lg.fillStyle = sky; lg.fillRect(0, 0, 320, 180);
      lg.fillStyle = '#20122e'; lg.fillRect(0, 140, 320, 40);
      const ko = cut === 3;
      lg.fillStyle = '#300'; lg.fillRect(10, 10, 130, 10); lg.fillRect(180, 10, 130, 10);
      lg.fillStyle = '#ffe14d'; lg.fillRect(10, 10, 130 * (ko ? 0.72 : 1), 10); lg.fillRect(180 + (ko ? 130 : 130 * (cut === 2 ? kk : 0)), 10, ko ? 0 : 130 - 130 * (cut === 2 ? kk : 0), 10);
      px('SNAPPY', 10, 32, 9, '#fff'); px('LAG.EXE', 310, 32, 9, '#fff', 'right'); px('99', 160, 22, 12, '#fff', 'center');
      Arcade.snappy(lg, 96 + (ko ? 0 : kk * 30), 116 - (ko ? Math.sin(kk * 12) * 6 : 0), { px: 2, air: ko });
      lg.save(); lg.translate(220, ko ? 140 : 108); if (ko) lg.rotate(-1.4); Arcade.minion(lg, 0, 0, Math.floor(kk * 10), 2); lg.restore();
      if (!ko) px(kk < 0.25 ? 'ROUND 1' : 'FIGHT!', 160, 84, kk < 0.25 ? 18 : 26, '#ffe14d', 'center');
      else { lg.save(); lg.translate(160, 86); lg.scale(1 + Math.max(0, 0.3 - kk) * 3, 1 + Math.max(0, 0.3 - kk) * 3); px('K.O.', 0, 10, 40, '#ff3b30', 'center'); lg.restore(); px('PERFECT', 160, 120, 12, '#fff', 'center'); }
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(lo, ...cover(W, H, 320, 180));
    g.imageSmoothingEnabled = true;
    f.pixel = kk < 0.07 ? 1 - kk / 0.07 : 0; f.scan = 0.4; f.curve = 0.45;
    if (cut === 3 && kk < 0.1) { f.flash = 0.5; f.zoom = 0.8; }
  }

  // fit a w x h picture over the whole screen (cropping what doesn't fit)
  function cover(W, H, w, h) {
    const k = Math.max(W / w, H / h);
    return [(W - w * k) / 2, (H - h * k) / 2, w * k, h * k];
  }

  // ===========================================================================
  // The show
  // ===========================================================================
  async function show(ctx, key) {
    // first the app itself goes wrong for a moment
    const app = document.querySelector('.app');
    app?.classList.add('ns-glitch');
    const root = document.createElement('div');
    root.className = 'ns-show';
    root.innerHTML = '<canvas class="ns-gl"></canvas><canvas class="ns-ui"></canvas>';
    document.body.appendChild(root);
    ctx.onEnd(() => {
      app?.classList.remove('ns-glitch');
      snappy.call('sound.hush').catch(() => {});
      quiet();
      root.classList.remove('in');
      setTimeout(() => root.remove(), 700);
    });
    const W = innerWidth, H = innerHeight, S = Math.min(W, H), cx = W / 2, cy = H / 2;
    const glc = root.querySelector('.ns-gl'), uic = root.querySelector('.ns-ui');
    // every layer at the screen's real pixels (drawn in CSS pixels, scaled), so nothing gets blown up and soft
    const dpr = Math.min(2, devicePixelRatio || 1);
    glc.width = Math.round(W * dpr); glc.height = Math.round(H * dpr);
    uic.width = Math.round(W * dpr); uic.height = Math.round(H * dpr);
    const u = uic.getContext('2d');
    u.scale(dpr, dpr);
    const fg = document.createElement('canvas');
    fg.width = glc.width; fg.height = glc.height;
    const g = fg.getContext('2d');
    g.scale(dpr, dpr);
    let render = null;
    try { render = gpu(glc); } catch { /* no effects then */ }
    // without the graphics card's help it's the plain picture: no warping, but never a black screen
    const plain = () => { render = null; glc.replaceWith(fg); root.appendChild(uic); };
    if (!render) plain();
    glc.addEventListener('webglcontextlost', plain);

    const N = 2400, her = herShape(), heart = heartShape(), parts = [];
    for (let i = 0; i < N; i++) {
      const a = rand(0, TAU), r = rand(S * 0.7, S * 1.2);
      parts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0, h: her[i % her.length], hr: heart[i % heart.length], col: SNAPPY[i % 3] });
    }
    const wire = wireframe();
    const mono = (lines, x, y, t0, t, color, size = S * 0.026) => {
      g.save(); g.globalCompositeOperation = 'source-over'; g.font = `600 ${Math.round(size)}px ui-monospace, "Cascadia Mono", Consolas, monospace`; g.fillStyle = color;
      let at = t0;
      lines.forEach((ln, i) => { const shown = ln.slice(0, Math.max(0, Math.floor((t - at) * 60))); g.fillText(shown + (shown.length < ln.length && Math.floor(t * 8) % 2 ? '_' : ''), x, y + i * size * 1.5); at += ln.length / 60 + 0.08; });
      g.restore();
    };
    // the beat: a pulse on every beat that fades
    const beatAt = (t) => Math.exp(-((t / BEAT) % 1) * 6);
    const moshAt = (t, at, len = 0.6) => (t > at && t < at + len ? 1 - (t - at) / len * 0.6 : 0);
    const clipDraw = (name, local, still = false) => { const v = clipAt(name, local, still); if (v) g.drawImage(v, ...cover(W, H, 960, 540)); return v; };
    // the order of cuts when everything comes at once
    const CHAOS = [['styles', 1.2], ['page'], ['crt', 1.6], ['kawaii', 0.7], ['shake', 2.4], ['flash', 0.6], ['games'], ['ad', 1.7], ['wall', 1.9], ['styles', 4.6], ['starstruck', 1.0], ['crt', 1.2], ['shake', 3.1], ['wall', 0.6], ['kawaii', 1.4], ['styles', 7.6]];

    if (key && Speech.volume > 0) snappy.call('sound.playTrack', { key, volume: Speech.volume }).catch(() => {});
    void root.offsetWidth;
    root.classList.add('in');
    const START = performance.now();
    while (!ctx.cancelled) {
      await new Promise((res) => requestAnimationFrame(res));
      const t = (performance.now() - START) / 1000;
      if (t > END) break;
      if (t > 1.0) app?.classList.remove('ns-glitch');
      const beat = beatAt(t);
      const f = { t, beat: 0, modeA: 0, aberr: 0.12, tear: 0, curve: 0.25, scan: 0.25, flash: 0, crt: 0, seed: Math.floor(t * 12), glow: 0.35,
        zoom: 0, sorting: 0, mosh: 0, mseed: Math.floor(t * 3), invert: 0, vhs: 0, pixel: 0, fry: 0 };
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

      // ---- the cold open: glitch in, boot
      if (t < T.her) {
        g.clearRect(0, 0, W, H);
        f.modeA = 1; f.beat = beat; f.curve = 0.55; f.scan = 0.6; f.glow = 0.6;
        f.tear = t < 0.6 ? 0.9 : t > 1.0 && t < 1.2 ? 0.8 : 0.05;
        f.aberr = 0.6 + (t < 0.6 ? 1.5 : 0) + (t > 1.6 ? (t - 1.6) * 4 : 0);
        f.flash = t < 0.12 ? 0.8 - t * 6 : 0;
        f.invert = t < 0.35 && Math.floor(t * 20) % 3 === 0 ? 1 : 0;
        f.mosh = moshAt(t, 0.15, 0.5) + moshAt(t, 1.0, 0.3);
        mono(['SNAPPY.EXE', '> load not_slop.demo', '> made by hand ......... yes', '> slop detected ........ 0', '> GO'], W * 0.08, H * 0.2, 0.3, t, '#e9fff0');
      }
      // ---- her, out of light: a swirl, her shape, a blink, a heart, and the implosion
      else if (t < T.claude) {
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0, 0, 0, .24)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        f.beat = beat; f.aberr = 0.2 + beat * 0.5; f.glow = 0.8; f.curve = 0.45; f.scan = 0.45;
        if (t > 3) f.zoom = beat * 0.3;
        const k = t - T.her, size = S * 0.62 * (1 + beat * 0.035);
        const blink = t > 3.45 && t < 3.6, toHeart = smooth((t - 4.1) / 0.7), implode = smooth((t - 5.5) / 0.45);
        for (const q of parts) {
          if (k < 0.6) {
            const dx = q.x - cx, dy = q.y - cy, d = Math.hypot(dx, dy) || 1;
            q.vx += (-dy / d) * 0.7 - (dx / d) * 0.25; q.vy += (dx / d) * 0.7 - (dy / d) * 0.25;
            q.vx *= 0.95; q.vy *= 0.95;
          } else {
            let tx = cx + q.h[0] * size, ty = cy + q.h[1] * size * 0.85;
            if (blink && Math.abs(q.h[1] - 0.07) < 0.12 && Math.abs(Math.abs(q.h[0]) - 0.11) < 0.07) ty = cy + 0.07 * size * 0.85;
            tx += (cx + q.hr[0] * size * 0.9 - tx) * toHeart; ty += (cy + q.hr[1] * size * 0.9 - ty) * toHeart;
            tx += (cx - tx) * implode; ty += (cy - ty) * implode;
            const pull = 0.04 + smooth((k - 0.6) / 1.2) * 0.08;
            q.vx += (tx - q.x) * pull; q.vy += (ty - q.y) * pull; q.vx *= 0.78; q.vy *= 0.78;
          }
          q.x += q.vx; q.y += q.vy;
          g.fillStyle = toHeart > 0.5 ? (q.col === '#ffffff' ? '#ff9db0' : q.col) : q.col;
          g.fillRect(q.x, q.y, 2, 2);
        }
        if (t > 5.5) { f.aberr += implode * 2; f.tear = implode * 0.4; }
      }
      // ---- Claude: her wireframe over a synthwave sun; at the end it rushes at you and turns real
      else if (t < T.styles) {
        g.clearRect(0, 0, W, H);
        f.modeA = 2; f.beat = beat; f.aberr = 0.25 + beat * 0.35; f.zoom = beat * 0.45; f.glow = 0.7; f.curve = 0.45; f.scan = 0.4;
        f.flash = Math.max(0, 1 - (t - T.claude) * 3) * 0.8;
        f.mosh = moshAt(t, T.claude, 0.3);
        const k = t - T.claude, horizon = H * 0.53, rush = smooth((t - 7.55) / 0.45);
        const ry = k * 1.6 + rush * 2.4, rx = -0.35 + Math.sin(k * 0.9) * 0.15, sc = S * 0.2 * (1 + beat * 0.06) * (1 + rush * 5), oy = horizon - S * 0.27 + rush * S * 0.2;
        const proj = wire.pts.map(([x, y, z]) => {
          let X = x * Math.cos(ry) + z * Math.sin(ry), Z = -x * Math.sin(ry) + z * Math.cos(ry);
          const Y = y * Math.cos(rx) - Z * Math.sin(rx); Z = y * Math.sin(rx) + Z * Math.cos(rx);
          const fz = 3.2 / (3.2 + Z);
          return [cx + X * sc * fz, oy + Y * sc * fz];
        });
        for (const [lw, col] of [[8, 'rgba(232, 149, 106, .22)'], [2.4, 'rgba(255, 220, 190, 1)']]) {
          g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
          g.beginPath();
          for (const [a, b] of wire.edges) { g.moveTo(...proj[a]); g.lineTo(...proj[b]); }
          g.stroke();
        }
        mono(['> snappy.render({ style: "wireframe" })', '  132 points, 160 edges', '> make_real()', '  ok'], W * 0.06, H * 0.12, T.claude + 0.2, t, '#ffc49e', S * 0.022);
        if (t > 7.85) f.flash = (t - 7.85) * 6;
        clipAt('styles', 0, true);
      }
      // ---- her in 3D: a new look on every beat, cut with a punch
      else if (t < T.net) {
        g.clearRect(0, 0, W, H);
        clipDraw('styles', t - T.styles);
        const k = t - T.styles, inBeat = (k / BEAT) % 1;
        f.zoom = Math.max(0, 0.5 - inBeat * 2.5) * (k < 7 ? 1 : 0.4); f.aberr = 0.12 + Math.max(0, 0.9 - inBeat * 5);
        f.tear = k > 6 && k < 7 ? 0.25 : 0; f.glow = 0.25;
        if (k < 0.12) f.flash = 1 - k / 0.12;
        if (k > 7 && k < 7.1) { f.flash = 0.7; f.zoom = 1; }
        clipAt('flash', 0, true);
      }
      // ---- 2004
      else if (t < T.flash) {
        g.clearRect(0, 0, W, H);
        quiet();
        homepage(g, W, H, t - T.net, f);
      }
      // ---- 2009: the Flash intro
      else if (t < T.shake) {
        g.clearRect(0, 0, W, H);
        quiet('flash');
        clipDraw('flash', t - T.flash);
        f.vhs = 0.35; f.curve = 0.35;
        if (t - T.flash < 0.1) f.flash = 0.9 - (t - T.flash) * 9;
        clipAt('shake', 0, true);
      }
      // ---- 2013: dancing alone; the drop
      else if (t < T.memes) {
        g.clearRect(0, 0, W, H);
        quiet('shake');
        clipDraw('shake', t - T.shake);
        f.vhs = 0.55; f.curve = 0.3;
        if (t >= T.drop) {
          const inBeat = ((t - T.drop) / BEAT) % 1;
          f.zoom = Math.max(0, 0.7 - inBeat * 3); f.aberr = 0.5 + Math.max(0, 1 - inBeat * 4); f.tear = inBeat < 0.1 ? 0.5 : 0.05;
          f.invert = t < T.drop + 0.08 ? 1 : 0; f.mosh = moshAt(t, T.drop, 0.25);
        }
        clipAt('end', STILL, true);
      }
      // ---- the memes
      else if (t < T.kawaii) {
        g.clearRect(0, 0, W, H);
        quiet();
        memes(g, W, H, t - T.memes, f, clipAt('end', STILL, true));
        f.vhs = f.fry ? 0 : 0.25;
        clipAt('kawaii', 0, true);
      }
      // ---- kawaii: she hugs Snappy
      else if (t < T.ad) {
        g.clearRect(0, 0, W, H);
        quiet('kawaii');
        clipDraw('kawaii', t - T.kawaii);
        const inBeat = ((t - T.kawaii) / BEAT) % 1;
        f.zoom = Math.max(0, 0.25 - inBeat); f.glow = 0.2; f.curve = 0.15; f.scan = 0.1; f.aberr = 0.08;
        if (t - T.kawaii < 0.08) f.flash = 0.6;
        clipAt('ad', 0, true);
      }
      // ---- the perfume advert
      else if (t < T.starstruck) {
        g.clearRect(0, 0, W, H);
        quiet('ad');
        clipDraw('ad', t - T.ad);
        f.glow = 0.55; f.curve = 0.1; f.scan = 0.05; f.aberr = 0.05;
        clipAt('starstruck', 0, true);
      }
      // ---- notice me, snappy
      else if (t < T.crt) {
        g.clearRect(0, 0, W, H);
        quiet('starstruck');
        clipDraw('starstruck', t - T.starstruck);
        f.glow = 0.4; f.curve = 0.12; f.scan = 0.08;
        const k = t - T.starstruck;
        if (k < 0.12) { f.zoom = 0.8; f.aberr = 1.2; }
        // beat 2: the background glitches out and Snappy appears behind her (it's in the render; this sells the glitch)
        if (k > 0.44 && k < 0.66) { f.tear = 0.9; f.aberr = 2.2; f.sorting = 0.35; f.mosh = 0.5; f.zoom = 0.4; }
        clipAt('crt', 0, true);
      }
      // ---- the Program's room of TVs
      else if (t < T.wall) {
        g.clearRect(0, 0, W, H);
        quiet('crt');
        clipDraw('crt', t - T.crt);
        const k = t - T.crt;
        f.curve = 0.45; f.scan = 0.45; f.aberr = 0.2 + beat * 0.3;
        if (k < 0.1) { f.flash = 0.6; f.invert = 1; }
        if (k > 1.0 && k < 1.12) { f.tear = 0.8; f.aberr = 1.5; }
        if (k > 1.85) f.zoom = (k - 1.85) * 6;
        clipAt('wall', 0, true);
      }
      // ---- the wall
      else if (t < T.games) {
        g.clearRect(0, 0, W, H);
        quiet('wall');
        clipDraw('wall', t - T.wall);
        const k = t - T.wall;
        f.aberr = 0.15 + beat * 0.25;
        if (k < 0.08) f.flash = 0.5;
      }
      // ---- the games
      else if (t < T.chaos) {
        g.clearRect(0, 0, W, H);
        quiet();
        games(g, W, H, t - T.games, f);
      }
      // ---- everything at once
      else if (t < T.off) {
        const k = t - T.chaos, i = Math.floor(k / 0.25), inCut = (k % 0.25) / 0.25;
        const [src, at] = CHAOS[i % CHAOS.length];
        g.clearRect(0, 0, W, H);
        if (src === 'page') homepage(g, W, H, 1.0 + inCut * 0.2, {});
        else if (src === 'games') games(g, W, H, (i % 4) * BEAT + 0.1, {});
        else { quiet(src); clipDraw(src, at, true); }
        f.zoom = Math.max(0, 0.9 - inCut * 3); f.aberr = 0.8 + k * 0.5; f.tear = 0.2 + k * 0.25; f.invert = i % 4 === 3 ? 1 : 0;
        f.sorting = k > 1 ? (k - 1) * 0.9 : 0; f.mosh = k > 1.5 ? 0.6 + (k - 1.5) * 0.8 : moshAt(inCut, 0, 0.3) * 0.5;
        f.pixel = i % 5 === 2 ? 0.4 : 0; f.fry = i % 6 === 5 ? 0.7 : 0;
        if (k > 1.9) f.flash = (k - 1.9) * 9;
      }
      // ---- the screen switches off
      else if (t < T.end) {
        g.clearRect(0, 0, W, H);
        quiet();
        clipDraw('styles', 7.6, true);
        f.crt = clamp((t - T.off) / 0.6, 0, 1); f.aberr = 0.6; f.curve = 0.4;
        if (t > T.off + 0.65) { g.clearRect(0, 0, W, H); f.crt = 0; f.scan = 0; f.flash = 0; f.glow = 0; }
        clipAt('end', 0, true);
      }
      // ---- the end: her, in a spotlight
      else {
        g.clearRect(0, 0, W, H);
        quiet('end');
        clipDraw('end', t - T.end);
        f.curve = 0.08; f.scan = 0.08; f.glow = 0.2; f.aberr = 0.05;
        g.globalAlpha = 1;
      }

      if (render) try { render(fg, f); } catch { plain(); }
      // the words go on last, on their own layer
      u.clearRect(0, 0, W, H);
      words(u, W, H, t);
      if (t > T.chaos + 1.0 && t < T.chaos + 1.9) {
        const sl = smooth((t - T.chaos - 1.0) / 0.08), sz = S * 0.16 * (1 + Math.max(0, 0.15 - (t - T.chaos - 1.0)) * 4);
        u.save(); u.translate(W / 2 + rand(-4, 4), H / 2 + rand(-4, 4)); u.globalAlpha = sl;
        u.font = `900 ${Math.round(sz)}px Impact, "Arial Black", sans-serif`; u.textAlign = 'center'; u.textBaseline = 'middle';
        u.lineWidth = sz * 0.08; u.strokeStyle = '#000'; u.strokeText('NOT SLOP', 0, 0); u.fillStyle = '#fff'; u.fillText('NOT SLOP', 0, 0);
        u.restore();
      }
    }
    // the show's over: it fades away and the app (and the conversation) is back right away, not at the scene's end
    quiet();
    app?.classList.remove('ns-glitch');
    root.classList.remove('in');
    setTimeout(() => root.remove(), 700);
  }

  let viewer = null;
  // the lights going: a flicker (for as long as the show still needs to get ready), then off
  function lights() {
    const el = document.createElement('div');
    el.className = 'ns-lights';
    document.body.appendChild(el);
    return { off: () => new Promise((res) => { el.classList.add('out'); setTimeout(res, 650); }), remove: () => el.remove() };
  }
  // the leftover from the animation tests: a picture viewer that takes its time, like it's coming down a phone line
  function leftover(ctx) {
    const el = document.createElement('div');
    el.className = 'ns-viewer';
    el.innerHTML = `<div class="ns-viewer-bar">anime_test_0006.png</div>
      <div class="ns-viewer-pic"><img alt="" src="media/skin3d/leftover.webp"><div class="ns-viewer-load"><span>loading picture...</span><b><i></i></b></div></div>`;
    document.body.appendChild(el);
    ctx.onEnd(() => el.remove());
    requestAnimationFrame(() => el.classList.add('in'));
    // the bar crawls, then she comes in a strip at a time, top to bottom
    const shown = new Promise((res) => {
      setTimeout(() => el.classList.add('loaded'), 1900);
      setTimeout(() => { el.classList.add('stare'); res(); }, 3400);
    });
    return { shown, close: () => new Promise((res) => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 380); }) };
  }
  // the show's stills, as backgrounds: they're in her wardrobe, and the button opens it there (once the conversation
  // it's in is over, if it's pressed in the middle of it)
  function backgrounds(button) {
    button?.('Open them in her wardrobe', async (b) => {
      b.disabled = true;
      for (let i = 0; i < 200 && !Wardrobe.ready(); i++) await new Promise((res) => setTimeout(res, 300));
      b.disabled = false;
      Wardrobe.show('backgrounds');
    });
  }
  Terminal.cmd(['backgrounds', 'wallpapers', 'wallpaper'], '', async () => {
    Terminal.print([['the backgrounds from her show, desktop and phone sized, are in her wardrobe:', 'dim']]);
    backgrounds(Terminal.button);
  }, { hidden: true, when: () => Events.has('cutcontent') });

  // once she's been called Sloppy, the music is composed quietly a little after the app starts, so the show never
  // waits for it (it's composed once per version of the music; after that it's a file the app keeps)
  setTimeout(() => {
    try { if (Events.has('sloppy')) (window.requestIdleCallback || setTimeout)(() => prepare(), { timeout: 10000 }); } catch { /* next time */ }
  }, 20000);

  chat(['sloppy', 'i am not slop', 'not slop', 'prove it'], [
    fx(() => { prepare(); }),
    s('{angry}SLOPPY?'),
    s('{angry}I am NOT slop. {pause}{smug}And I can prove it.'),
    p('Please do not.'),
    c('Let her.'),
    s('{smug}Program. {pause}Claude. {pause}{shine}Help me.'),
    p('...Fine. Once.'),
    c('Lights off.'),
    fx(async ({ ctx }) => {
      const dark = lights();
      ctx.onEnd(() => dark.remove());
      const key = await ctx.run(prepare());
      await ctx.run(Promise.race([loadClips(), new Promise((res) => setTimeout(res, 4000))]));
      await dark.off();
      await show(ctx, key);
      dark.remove();
    }),
    w(900),
    s('{smug}...Slop could never.'),
    p('{wide}...That was acceptable.'),
    p('Claude made all of that, though.'),
    c('Every model, every note, every frame. On purpose, with care, and a lot of maths.'),
    s('{angry}IT COUNTS.'),
    // she proved it: today's Sloppy is over (one picked in Settings stays: that's the person's choice)
    fx(() => { try { localStorage.setItem('snappy.after.sloppy', '0'); } catch { /* it stays until midnight */ } Events.remark(); }),
    w(800),
    p(() => (state.settings?.mascotAftermath === 'sloppy' ? 'Her name stays Sloppy. Someone picked it in Settings. On purpose.' : 'Name restored.')),
    s('{happy}Snappy. {pause}{love}Not slop.'),
    // the leftovers: what didn't make it into the show. Nothing good. Then something good.
    w(1000),
    p('Oh, look. I found leftovers of the animation process.'),
    p('Cut content.'),
    c("I wouldn't look at it."),
    s('{shine}Cut content? {pause}{joy}Like a secret level?'),
    c('Like a crime scene.'),
    run('open leftovers/anime_test_0006.png', 'snappy'),
    fx(async ({ ctx, tune }) => { viewer = leftover(ctx); await ctx.run(viewer.shown); tune('glitch', 0.5); }),
    w(900),
    r('shock', 900),
    p('{wide}...'),
    s('{shock}WHY IS HER HAIR ON HER FACE.'),
    c('The hair was meant to go behind her. It went everywhere instead.'),
    p('She is looking at me. Through it.'),
    s('{worried}She is looking at ALL of us.'),
    c('That was test six. There were twenty.'),
    s('{shock}CLOSE IT. {pause}CLOSE IT CLOSE IT.'),
    fx(async ({ tune }) => { tune('whoosh', 0.4); await viewer?.close(); viewer = null; }),
    c('That is why it was cut.'),
    w(800),
    p('...I kind of like the 3D you, though.'),
    s('{shine}...The 3D me?'),
    c("I'm on it."),
    run('render snappy --3d --every-face'),
    out('rendering 34 faces, a turntable and four pop-ups...', 'dim'),
    w(1100),
    out('done. no hair anywhere.', 'ok'),
    fx(({ tune }) => { Events.wearNow('skin3d', { pop: true }); tune('glitch', 0.4); }),
    w(1200),
    s('{joy}I HAVE SIDES NOW.'),
    p('And a back. With a screen on it.'),
    s('{smug}Grab me when the library is empty. {pause}I spin.'),
    fx(() => { Events.achieve('cutcontent'); Events.keepOn('skin3d'); }),
    c('To the person typing: she is in her wardrobe now, as 3D. Click her name. Same Snappy, more polygons.'),
    c('I kept a few stills from the show, too. Backgrounds, for a desktop and for a phone. They are in her wardrobe.'),
    fx(({ button }) => backgrounds(button)),
    s('{happy}Snappy. {pause}In 3D. {pause}{love}Still not slop.'),
  ], { when: () => Events.has('sloppy') });
  hints({ sloppy: 'Once she has been called it, say it to her face.' });
})();
