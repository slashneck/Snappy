// Deep Scan: Snappy "improves the app" by scanning your browser history, takes one look at the results and leaves.
// All pretend: she can't see your browser, and nothing on this PC is read. The Program says so afterwards.
(() => {
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };

  async function deepScan(ctx) {
    const W = innerWidth, H = innerHeight, size = 124;
    const stage = Program.cine(ctx, { bars: false, light: true });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    await a.zoomTo(Math.max(28, W * 0.2 - size / 2), H * 0.42 - size / 2, size);
    await S('{shine}Good news! {pause}I am improving the app.', { hold: 600 });
    await S("{open}To get to know you better, I'll just analyze your browser history real quick.", { hold: 400 });
    a.hush();

    const panel = stage.add('ds-panel', `<div class="ds-title"><i></i>SNAPPY DEEP SCAN</div>
      <div class="ds-what">Browser history</div>
      <div class="ds-bar"><i></i></div><div class="ds-row"><span class="ds-step">Starting...</span><b class="ds-pct">0%</b></div>`);
    pop(panel);
    Speech.tune('scan', 0.7);
    const r = panel.getBoundingClientRect();
    a.lookAt(r.left + r.width / 2, r.top + r.height / 2, true);
    await ctx.wait(900);
    // one smooth fill that slows down now and then, while her eyes buffer and the step changes under the bar
    Mascot.face('load');
    const STEPS = [[0, 'Reading your browser history...'], [18, 'Grabbing cookies...'], [36, 'Eating some of the cookies...'],
      [55, 'Sorting your searches...'], [74, 'Checking what you searched at 3 AM...'], [92, 'Almost done...']];
    const LEGS = [[0, 24, 1300], [24, 37, 1500], [37, 70, 1400], [70, 91, 1600], [91, 100, 1100]];
    const bar = panel.querySelector('.ds-bar i'), pctEl = panel.querySelector('.ds-pct'), stepEl = panel.querySelector('.ds-step');
    bar.style.transition = 'none';
    let tick = 0;
    for (const [from, to, ms] of LEGS) {
      const start = performance.now();
      for (;;) {
        ctx.check();
        const k = Math.min(1, (performance.now() - start) / ms);
        const p = from + (to - from) * (1 - (1 - k) ** 2);
        bar.style.width = `${p}%`;
        pctEl.textContent = `${Math.floor(p)}%`;
        stepEl.textContent = STEPS.filter(([at]) => p >= at).pop()[1];
        if (performance.now() - tick > 650) { tick = performance.now(); Speech.tune('tick', 0.35); }
        if (k >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
    }
    stepEl.textContent = 'Done.';
    pctEl.textContent = '100%';
    Mascot.face(null);
    panel.classList.add('done');
    Speech.tune('coin', 0.6);
    await S('{shine}Scan complete!', { keepLook: true, hold: 900 });
    a.look([0, 0.12], true);
    await ctx.wait(400);
    await S('. {pause}. {pause}.', { keepLook: true, hold: 800 });
    a.look([0.15, 0.25], true);
    await S('{ew}...freak.', { keepLook: true, hold: 1300 });
    a.hush();
    panel.classList.remove('in');
    panel.classList.add('out');
    stage.end();
    // and off she goes, without another word
    await a.home();
    // the aftermath, a moment later, right next to her corner
    await ctx.wait(2000);
    const slot = document.getElementById('mascot').getBoundingClientRect();
    const prog = Program.program(ctx);
    await prog.say('By the way, that was a joke. {pause}Nothing was scanned. {pause}We would never do that.',
      { near: { center: { x: slot.left + slot.width / 2 }, y: slot.top, size: slot.height }, hold: 2600 });
    prog.hush();
    await prog.leave();
  }

  Events.define('deepscan', {
    tier: 'uncommon', title: 'Deep Scan', hint: 'She wants to get to know you better.', run: deepScan, weight: 3,
  });
})();
