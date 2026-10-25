// Snappy shows you around: the page dims, the setting she talks about stays lit, and she hops over to it.
//   Tour.start(name)   run a tour ('settings'); Tour.seen(name) tells whether it ran before
// A tour is a list of steps: what to light up, and what she says (pages of text, each with its own face). On a step
// with tryIt, the lit setting can be changed right there, and she reacts when you do.
(() => {
  const SIZE = 112; // how big she is during a tour
  const seenKey = (name) => `snappy.tour.${name}`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private storage off: the tour just shows again */ } },
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  const tours = {};
  let run = null;

  // The rows a step is about, or just their controls (the dropdown, the hotkey, the switch) when it's your turn.
  function rectOf(targets, part = '.row') {
    const els = targets.map((sel) => { const el = document.querySelector(sel); return el && (el.closest(part) || el); })
      .filter((el) => el && el.getClientRects().length); // only what's actually on screen
    if (!els.length) return null;
    const rs = els.map((e) => e.getBoundingClientRect());
    return {
      left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)),
      right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)),
    };
  }

  // Scrolls the row to the upper third of the page and waits until it stops moving.
  async function bringIntoView(step) {
    const scroller = document.getElementById(run.scroller);
    const r = rectOf(step.targets);
    if (!scroller || !r) return;
    const box = scroller.getBoundingClientRect();
    const want = scroller.scrollTop + (r.top - box.top) - box.height * 0.22;
    scroller.scrollTo({ top: Math.max(0, want), behavior: 'smooth' });
    let last = -1, still = 0;
    for (let i = 0; i < 60 && still < 3; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      still = scroller.scrollTop === last ? still + 1 : 0;
      last = scroller.scrollTop;
    }
  }

  // Where the light, Snappy and her bubble go for a step.
  function layout(step) {
    const vw = innerWidth, vh = innerHeight, pad = 8;
    const r = step.targets ? rectOf(step.targets) : null;
    const spot = run.root.querySelector('.tour-spot');
    const block = run.root.querySelector('.tour-block');
    const bw = Math.min(400, vw - 48);
    let x, y;
    if (r) {
      const below = r.bottom + pad + 18;
      y = below + SIZE + 24 < vh ? below : r.top - pad - 18 - SIZE;
      x = Math.max(24, Math.min(r.left + 28, vw - SIZE - bw - 48));
    } else {
      x = Math.max(24, vw / 2 - (SIZE + bw + 16) / 2);
      y = vh / 2 - SIZE / 2 - 20;
    }

    // On your turn the light narrows from the whole row down to the thing to click.
    const lit = (run.trying && step.targets && rectOf(step.targets, '.row-control')) || r;
    const hole = lit && { l: lit.left - pad, t: lit.top - pad, w: lit.right - lit.left + pad * 2, h: lit.bottom - lit.top + pad * 2 };
    // Without a setting to light, the light shrinks to a dot hidden behind her (an empty box casts no shade).
    const s = hole || { l: x + SIZE / 2 - 1, t: y + SIZE / 2 - 1, w: 2, h: 2 };
    Object.assign(spot.style, { left: `${s.l}px`, top: `${s.t}px`, width: `${s.w}px`, height: `${s.h}px` });
    spot.classList.toggle('lit', !!hole);
    // Clicks inside the lit row reach the real setting, but only on steps where you can try it.
    block.style.clipPath = hole && step.tryIt
      ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${hole.l}px ${hole.t}px, ${hole.l + hole.w}px ${hole.t}px, ${hole.l + hole.w}px ${hole.t + hole.h}px, ${hole.l}px ${hole.t + hole.h}px, ${hole.l}px ${hole.t}px)`
      : '';

    const her = run.root.querySelector('.tour-snappy');
    const moved = run.x != null && Math.abs(x - run.x) + Math.abs(y - run.y) > 30;
    run.x = x; run.y = y;
    her.style.left = `${x}px`;
    her.style.top = `${y}px`;
    if (moved && run.entered) { her.classList.remove('travel'); void her.offsetWidth; her.classList.add('travel'); }

    const bubble = run.root.querySelector('.tour-bubble');
    const bx = x + SIZE + 14;
    const flip = bx + bw > vw - 16;
    bubble.style.width = `${bw}px`;
    bubble.style.left = `${flip ? Math.max(16, x - bw - 14) : bx}px`;
    bubble.classList.toggle('tail-right', flip);
    bubble.style.top = `${Math.min(vh - 16 - bubble.offsetHeight, Math.max(16, y + SIZE * 0.42 - 34))}px`;
  }

  const pagesOf = (step) => (step.tryIt ? [...step.pages, { text: step.tryIt, face: 'shine', tryIt: true }] : step.pages);

  async function show(index, dir = 1) {
    run.index = index;
    run.page = 0;
    run.changed = false;
    run.trying = false;
    const step = run.steps[index];
    const bubble = run.root.querySelector('.tour-bubble');
    bubble.classList.remove('pop');
    run.root.querySelector('.tour-spot').classList.remove('try');
    if (step.before) {
      await step.before();
      // wait for what she wants to show to appear (audio lanes load in the background)
      for (let i = 0; i < 40 && step.targets && !rectOf(step.targets); i++) await wait(100);
      if (!run) return;
    }
    if (step.targets && !rectOf(step.targets)) {
      const nextIndex = index + dir;
      if (nextIndex >= 0 && nextIndex < run.steps.length) show(nextIndex, dir);
      else finish(true);
      return;
    }
    if (step.targets) await bringIntoView(step);
    if (!run) return;
    layout(step);
    run.root.querySelector('.tour-count').textContent = `${index + 1} / ${run.steps.length}`;
    run.root.querySelector('.tour-back').hidden = index === 0;
    setNextLabel();
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    await typePage();
  }

  function setNextLabel() {
    const step = run.steps[run.index];
    run.root.querySelector('.tour-next').textContent = run.index === run.steps.length - 1 ? 'Done'
      : step.tryIt && !run.changed && run.page === pagesOf(step).length - 1 ? 'Later' : 'Next';
  }

  async function say(text, face) {
    Mascot.face(face || null);
    Mascot.talking(true);
    run.root.querySelector('.tour-hint').hidden = true;
    const writer = Speech.typewriter(run.root.querySelector('.tour-text'), text, { onWord: () => Mascot.hop(), onCue: Speech.cue });
    run.writer = writer;
    await writer.done;
    if (!run || run.writer !== writer) return false;
    Mascot.talking(false);
    layout(run.steps[run.index]);
    return true;
  }

  async function typePage() {
    const step = run.steps[run.index];
    const page = pagesOf(step)[run.page];
    const text = typeof page === 'string' ? page : page.text;
    if (page.react) Mascot.flash(page.react, 1200);
    setNextLabel();
    run.trying = !!page.tryIt;
    if (page.tryIt) { run.root.querySelector('.tour-spot').classList.add('try'); layout(step); }
    if (await say(text, page.face || step.face) && !page.tryIt) run.root.querySelector('.tour-hint').hidden = false;
  }

  // You changed the setting she lit up: she's delighted, and the button says Next instead of Later.
  async function changed() {
    if (!run) return;
    const step = run.steps[run.index];
    if (step?.done?.()) { run.writer?.finish(); show(run.index + 1); return; }
    if (!step?.tryIt || step.done) return;
    await wait(120);
    if (!run) return;
    layout(step);
    if (run.changed && Date.now() - run.changedAt < 2500) return;
    run.changed = true;
    run.changedAt = Date.now();
    run.page = pagesOf(step).length - 1;
    setNextLabel();
    Mascot.flash('happy', 1150);
    await say(pick(step.liked || ['Ooh, good choice!', 'Nice pick!', "Done and done! I'll remember that.", 'Perfect!']), 'happy');
  }

  function next() {
    if (!run) return;
    if (!run.writer?.finished) { run.writer?.finish(); return; }
    const step = run.steps[run.index];
    if (run.page < pagesOf(step).length - 1) { run.page++; typePage(); return; }
    if (run.index < run.steps.length - 1) show(run.index + 1);
    else finish(true);
  }

  function back() {
    if (!run || run.index === 0) return;
    run.writer?.finish();
    show(run.index - 1, -1);
  }

  // At the end she does a happy hop and hops back home to her corner.
  function finish(completed) {
    if (!run) return;
    const r = run;
    run = null;
    store.set(seenKey(r.name), '1');
    r.writer?.finish();
    Mascot.talking(false);
    Mascot.face(null);
    removeEventListener('keydown', r.onKey, true);
    removeEventListener('resize', r.onResize);
    document.removeEventListener('snappy:changed', changed);
    tours[r.name].onEnd?.();
    r.root.querySelector('.tour-bubble').classList.add('leaving');
    if (completed) Mascot.flash('happy', 1150);
    setTimeout(async () => {
      r.root.classList.add('leaving');
      const her = r.root.querySelector('.tour-snappy');
      her.classList.remove('enter', 'travel');
      const gone = () => { r.root.remove(); r.unsolo(); };
      if (await Mascot.goHome(her, her.querySelector('.tour-body'))) Mascot.swap(gone);
      else gone();
    }, completed ? 750 : 150);
  }

  async function start(name) {
    if (run || !tours[name] || window.Speech?.waiting || window.Events?.running) return;
    const def = tours[name];
    const steps = def.steps().filter((s) => !s.targets || s.before || rectOf(s.targets));
    if (!steps.length) return;
    window.Speech?.hush();
    const root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = `<div class="tour-spot"></div><div class="tour-block"></div>
      <div class="tour-snappy"><div class="tour-body"><div class="tour-mascot"></div></div></div>
      <div class="tour-bubble">
        <button class="tour-skip">Skip</button>
        <div class="tour-text"></div>
        <div class="tour-foot">
          <span class="tour-count"></span><span class="tour-hint" hidden>click to continue</span>
          <button class="tour-btn ghost tour-back">Back</button><button class="tour-btn tour-next">Next</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    Mascot.mount(root.querySelector('.tour-mascot'));
    run = { name, steps, root, index: 0, page: 0, scroller: def.scroller, entered: false, unsolo: Mascot.solo(root.querySelector('.tour-mascot')) };
    const me = run;

    root.addEventListener('click', (e) => {
      if (e.target.closest('.tour-skip')) finish(false);
      else if (e.target.closest('.tour-back')) back();
      else if (!e.target.closest('.tour-snappy')) next(); // poking her is just petting
    });
    run.onKey = (e) => {
      // typing a hotkey or using a dropdown she lit up is for the setting, not for the tour
      if (document.querySelector('.hotkey-input.listening') || e.target.closest?.('#settingsForm, input, select')) return;
      if (['Enter', ' ', 'ArrowRight'].includes(e.key)) next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') finish(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    addEventListener('keydown', run.onKey, true);
    run.onResize = () => run && layout(run.steps[run.index]);
    addEventListener('resize', run.onResize);
    document.addEventListener('snappy:changed', changed);
    def.onStart?.();

    // She runs in from the right, trips over her own feet, catches herself, and then says hi.
    layout(steps[0]);
    const her = root.querySelector('.tour-snappy');
    requestAnimationFrame(() => root.classList.add('in'));
    her.classList.add('enter');
    Mascot.face('worried');
    await wait(1450);
    if (run !== me) return;
    her.classList.remove('enter');
    run.entered = true;
    await show(0);
  }

  window.Tour = {
    start,
    define(name, def) { tours[name] = def; },
    seen: (name) => store.get(seenKey(name)) === '1',
    get active() { return !!run; },
  };
})();
