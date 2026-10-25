// Snappy talks: a speech bubble next to her, the text typed out with a little voice like an RPG text box.
//   Speech.say(text | [pages], { face, action: { label, fn }, kind: 'chatter' | 'news', key })
//   Speech.typewriter(el, text, opts)   the typing engine, also used by the tour
// She only ever talks while the Snappy window is in front, and stays quiet while a clip plays.
(() => {
  // ----- her voice: one soft blip per letter, pitched a little differently each time -----
  // The blips play in Snappy's own little sound player, which recordings leave out, so her voice never lands in a clip.
  let lastBlip = 0;
  function blip(force, higher = 1) {
    if ((!Speech.sounds && !force) || Speech.volume <= 0) return;
    const now = performance.now();
    if (now - lastBlip < 52) return; // a blip per letter is too busy when she types fast
    lastBlip = now;
    snappy.call('sound.blip', { pitch: 880 * higher * (0.93 + Math.random() * 0.16), volume: Speech.volume }).catch(() => {});
  }
  // She shouts: higher, and faster.
  const shoutBlip = () => blip(false, 1.22);

  // The Program's voice: flat and even, a few fixed notes, one per word, like a synthesizer reading aloud.
  const PROGRAM_NOTES = [523, 523, 494, 587, 523, 466];
  let programNote = 523, lastProgram = 0;
  function programWord() { programNote = PROGRAM_NOTES[Math.floor(Math.random() * PROGRAM_NOTES.length)]; }
  function programBlip() {
    if (!Speech.sounds || Speech.volume <= 0) return;
    const now = performance.now();
    if (now - lastProgram < 58) return;
    lastProgram = now;
    snappy.call('sound.pblip', { pitch: programNote, volume: Speech.volume * 0.9 }).catch(() => {});
  }

  // Claude's voice: soft and round, a warm note per word.
  const CLAUDE_NOTES = [330, 349, 370, 392, 349, 311];
  let claudeNote = 349, lastClaude = 0;
  function claudeWord() { claudeNote = CLAUDE_NOTES[Math.floor(Math.random() * CLAUDE_NOTES.length)]; }
  function claudeBlip() {
    if (!Speech.sounds || Speech.volume <= 0) return;
    const now = performance.now();
    if (now - lastClaude < 64) return;
    lastClaude = now;
    snappy.call('sound.cblip', { pitch: claudeNote, volume: Speech.volume }).catch(() => {});
  }

  // A jingle: chime, fanfare, anthem, crash, scan, coin, sting, whoosh, tick, fizz, key, glitch, boot, fly.
  function tune(name, louder = 1) {
    if (Speech.volume <= 0) return;
    snappy.call('sound.play', { name, volume: Math.min(1, Speech.volume * louder) }).catch(() => {});
  }

  // ----- typewriter -----
  // The full text is laid out from the start (the untyped rest is invisible), so the bubble never jumps in size.
  // Cues in braces change things right at that point of the sentence: {happy} or any other face, {open} for her
  // normal eyes, {hop} for a happy jump, {pause} to hold a beat.
  const pauseAfter = (ch, next) => {
    if (next && !/\s/.test(next)) return 0;
    if (ch === ',') return 130;
    if (ch === '.' || ch === '!' || ch === '?') return 300;
    return 0;
  };
  function typewriter(el, source, { speed = 27, onWord, onCue, quiet = false, voice = blip, pauses = pauseAfter } = {}) {
    const cues = [];
    let text = '';
    for (const part of source.split(/(\{[a-z]+\})/)) {
      const cue = part.match(/^\{([a-z]+)\}$/);
      if (cue) cues.push({ at: text.length, name: cue[1] });
      else text += part;
    }
    el.innerHTML = '<span class="typed"></span><span class="untyped"></span>';
    const typed = el.firstChild, rest = el.lastChild;
    rest.textContent = text;
    let i = 0, c = 0, timer = 0, finished = false, resolve;
    const done = new Promise((r) => { resolve = r; });
    // Fires the cues up to here; true when one of them asks for a pause.
    const cuesUntil = (index) => {
      let pause = false;
      for (; c < cues.length && cues[c].at <= index; c++) {
        if (cues[c].name === 'pause') pause = true;
        else onCue?.(cues[c].name);
      }
      return pause;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cuesUntil(Infinity); // skipping ahead still lands on the face the line ends with
      typed.textContent = text;
      rest.textContent = '';
      resolve();
    };
    const step = () => {
      if (finished) return;
      if (cuesUntil(i)) { timer = setTimeout(step, 480); return; }
      const ch = text[i];
      if (i === 0 || (/\S/.test(ch) && /\s/.test(text[i - 1]))) onWord?.();
      i++;
      typed.textContent = text.slice(0, i);
      rest.textContent = text.slice(i);
      if (/[a-z0-9]/i.test(ch) && !quiet) voice();
      if (i >= text.length) { finish(); return; }
      // ellipses are typed slowly, dot by dot
      const dots = ch === '.' && text[i] === '.';
      timer = setTimeout(step, dots ? 170 : speed + pauses(ch, text[i]));
    };
    timer = setTimeout(step, 90);
    return { done, finish, get finished() { return finished; } };
  }

  // What a cue does to her.
  const cue = (name) => {
    if (name === 'hop') Mascot.flash('happy', 1150);
    else if (name === 'sneeze') Mascot.flash('clipping', 950); // the flash goes off by accident
    else Mascot.face(name === 'open' ? null : name);
  };

  // ----- the bubble next to her in the sidebar -----
  const queue = [];
  let current = null;
  let focused = document.hasFocus();
  let lastChatter = 0, quietUntil = 0;

  const anchor = () => document.getElementById('mascot');
  const playing = () => { const v = document.getElementById('video'); return v && !v.paused && !v.ended && state.view === 'player'; };
  // force: her goodbye when you switch her talking off still gets through
  const canTalk = (force) => (Speech.enabled || force) && !Speech.waiting && focused && !document.hidden && !window.Tour?.active && !document.querySelector('.modal-backdrop:not([hidden])');

  function say(text, opts = {}) {
    // she hasn't found her voice yet (an early bird's welcome-back story is still to come)
    if (Speech.waiting) return;
    const pages = Array.isArray(text) ? text : [text];
    const actions = opts.actions || (opts.action ? [opts.action] : []);
    const item = { pages, face: opts.face || null, actions, kind: opts.kind || 'chatter', key: opts.key || null, hold: opts.hold, force: !!opts.force, at: Date.now() };
    if (opts.interrupt) { queue.length = 0; current?.close('dismissed'); quietUntil = 0; }
    if (item.key && (queue.some((q) => q.key === item.key) || current?.item.key === item.key)) return;
    if (item.kind === 'chatter') {
      // chatter is only worth saying right away, and not too often
      if (!canTalk(item.force) || current || Date.now() - lastChatter < 35000) return;
      lastChatter = Date.now();
    }
    queue.push(item);
    pump();
  }

  function pump() {
    if (current || !queue.length || !canTalk(queue[0].force) || Date.now() < quietUntil) return;
    const i = queue.findIndex((q) => q.kind === 'news' || !playing());
    if (i < 0) return;
    const [item] = queue.splice(i, 1);
    if (item.kind === 'chatter' && Date.now() - item.at > 6000) { pump(); return; }
    show(item);
  }

  function show(item) {
    const host = anchor();
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'speech';
    el.setAttribute('role', 'status');
    el.innerHTML = `<button class="speech-close" aria-label="Close">${icon('close')}</button>
      <div class="speech-text"></div>
      ${item.actions.length ? `<div class="speech-actions" hidden>${item.actions.map((a, i) => `<button class="speech-action${i ? ' ghost' : ''}" data-answer="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
      <span class="speech-more" hidden></span>`;
    document.body.appendChild(el);
    place(el);
    const textEl = el.querySelector('.speech-text');
    const more = el.querySelector('.speech-more');
    const me = { item, el, page: 0, writer: null, hideTimer: 0, hovering: false };
    current = me;

    const close = (why) => {
      if (current !== me) return;
      current = null;
      clearTimeout(me.hideTimer);
      me.writer?.finish();
      Mascot.talking(false);
      Mascot.face(null);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
      // news she couldn't finish (the window lost focus) comes back later
      if (why === 'blur' && item.kind === 'news' && (me.page < item.pages.length - 1 || !me.writer?.finished)) queue.unshift(item);
      quietUntil = why === 'dismissed' ? Date.now() + 250 : Date.now() + 1200;
      setTimeout(pump, why === 'dismissed' ? 300 : 1300);
    };
    me.close = close;

    // long enough to read, then out of the way
    const holdFor = () => {
      const chars = textEl.textContent.length;
      const hold = item.hold || Math.min(item.actions.length ? 9000 : 7000, Math.max(3200, 1800 + chars * 40) + (item.actions.length ? 2500 : 0));
      return Math.max(1400, hold - 2000);
    };
    const armHide = (ms = holdFor()) => {
      clearTimeout(me.hideTimer);
      if (!me.hovering) me.hideTimer = setTimeout(() => close('timeout'), ms);
    };
    const typePage = async () => {
      more.hidden = true;
      const page = item.pages[me.page];
      Mascot.face(typeof page === 'object' ? page.face : item.face);
      Mascot.talking(true);
      me.writer = typewriter(textEl, typeof page === 'object' ? page.text : page, { onWord: () => Mascot.hop(), onCue: cue });
      await me.writer.done;
      if (current !== me) return;
      Mascot.talking(false);
      if (me.page < item.pages.length - 1) {
        more.hidden = false;
        clearTimeout(me.hideTimer);
        me.hideTimer = setTimeout(next, 1500 + textEl.textContent.length * 18);
      } else {
        const actions = el.querySelector('.speech-actions');
        if (actions) actions.hidden = false;
        armHide();
      }
    };
    const next = () => {
      if (!me.writer?.finished) { me.writer?.finish(); return; }
      if (me.page < item.pages.length - 1) { me.page++; typePage(); }
    };

    el.addEventListener('click', (e) => {
      if (e.target.closest('.speech-close')) { close('dismissed'); return; }
      const answer = e.target.closest('[data-answer]');
      if (answer) { close('action'); item.actions[Number(answer.dataset.answer)].fn(); return; }
      next();
    });
    el.addEventListener('pointerenter', () => { me.hovering = true; clearTimeout(me.hideTimer); });
    el.addEventListener('pointerleave', () => {
      me.hovering = false;
      if (me.writer?.finished && me.page >= item.pages.length - 1) armHide(2200);
    });
    requestAnimationFrame(() => el.classList.add('in'));
    typePage();
  }

  // To the right of her head, the tail pointing back at her, but never tucked up under the window's top edge.
  function place(el) {
    const r = anchor()?.getBoundingClientRect();
    if (!r) return;
    const eyes = r.top + r.height * 0.5;
    const top = Math.max(14, eyes - 27);
    el.style.left = `${Math.round(r.right + 4)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.setProperty('--tail', `${Math.round(eyes - top - 8)}px`);
  }
  addEventListener('resize', () => { if (current) place(current.el); });

  function setFocused(on) {
    focused = on;
    if (!on && current) current.close('blur');
    if (on) setTimeout(pump, 700); // let the window come up before she starts talking
  }
  addEventListener('focus', () => setFocused(true));
  addEventListener('blur', () => setFocused(document.hasFocus()));
  document.addEventListener('visibilitychange', () => setFocused(!document.hidden && document.hasFocus()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) current.close('dismissed'); });
  setInterval(pump, 2000);

  window.Speech = {
    enabled: true, sounds: true, volume: 1, waiting: false,
    // a quick "hi hi" at the current volume, for the volume slider
    sample() { [0, 90, 180].forEach((ms) => setTimeout(() => { lastBlip = 0; blip(true); }, ms)); },
    say, typewriter, blip, shoutBlip, programBlip, programWord, claudeBlip, claudeWord, tune, cue,
    // How long a line stays up once it's typed: you've read most of it while it typed, so a beat under a second to
    // finish it (a little longer for a long one), or whatever the scene asked for if that's longer. Only a hold of
    // exactly 0 (a line that gets cut off) is let through.
    readTime(text, hold) {
      if (hold === 0) return 0;
      const plain = text.replace(/\{[a-z]+\}/g, '');
      return Math.max(hold ?? 0, Math.min(1300, 650 + plain.length * 5));
    },
    setFocused,
    hush() { queue.length = 0; current?.close('dismissed'); },
    get talking() { return !!current; },
  };
})();
