// Snappy the camera: one SVG, many moods. Every element with class "mascot" gets its own copy.
//   Mascot.mount(el)            turn an element into a mascot
//   Mascot.setBase(mood)        idle | recording | paused | starting | problem
//   Mascot.hold(key, mood)      keep a mood while something runs (working, trimming, clipping)
//   Mascot.release(key)
//   Mascot.flash(mood, ms)      one-shot reaction (happy, error)
//   Mascot.face(face)           an expression while she talks: wink | shine | worried | happy | love, null to clear
//   Mascot.talking(on)          while she talks; Mascot.hop() is a little jump for each word
(() => {
  // Deliberately simple: white body, ink outline, two pill eyes, no mouth. All expression lives in the eyes, the cheeks and
  // the motion. She moves in layers that never fight each other: breathing never stops,
  // moods play on top of it, petting on top of that, and talking on top of everything.
  const eye = (side, x) => `
    <g transform="translate(${x} 120)"><g class="m-eye m-eye-${side}">
      <g class="m-eye-look"><g class="m-eye-open">
        <ellipse rx="14" ry="20" fill="#0a0a0a"/>
        <ellipse class="m-gloss m-tiny-hide" cx="-4.5" cy="-8" rx="4" ry="5.5" fill="#fff"/>
        <circle class="m-joy-gloss m-tiny-hide" cx="5" cy="7" r="2.6" fill="#fff"/>
        <path class="m-lid m-lid-angry" fill="#f4f4f4" d="${side === 'l' ? 'M-20 -26 H20 V-1 L-20 -15 Z' : 'M-20 -26 H20 V-15 L-20 -1 Z'}"/>
        <path class="m-lid m-lid-sad" fill="#f4f4f4" d="${side === 'l' ? 'M-20 -26 H20 V-15 L-20 -3 Z' : 'M-20 -26 H20 V-3 L-20 -15 Z'}"/>
        <path class="m-shine m-tiny-hide" fill="#fff" d="M-4 -17 Q-3 -9.5 4.5 -8.5 Q-3 -7.5 -4 0 Q-5 -7.5 -12.5 -8.5 Q-5 -9.5 -4 -17 Z"/>
      </g></g>
      <path class="m-ink m-eye-happy" d="M-15 6 Q0 -14 15 6" fill="none"/>
      <path class="m-ink m-eye-sleep" d="M-15 1 Q0 9 15 1" fill="none"/>
      <path class="m-ink m-eye-wince" d="${side === 'l' ? 'M-11 -11 L10 0 L-11 11' : 'M11 -11 L-10 0 L11 11'}" fill="none"/>
      <path class="m-eye-heart" fill="#ff6f8e" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"
            d="M0 15 C-21 2 -22 -12 -12 -16 C-6 -18.5 -1.5 -15 0 -10 C1.5 -15 6 -18.5 12 -16 C22 -12 21 2 0 15 Z"/>
      <path class="m-ink m-eye-dizzy" d="M1.4 0 a2.1 2.1 0 1 1 4.2 0 a5.6 5.6 0 1 1 -11.2 0 a9.1 9.1 0 1 1 18.2 0 a12.6 12.6 0 1 1 -25.2 0" fill="none"/>
      <g class="m-eye-load" fill="#0a0a0a">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${(Math.cos((i * Math.PI) / 3) * 11).toFixed(1)}" cy="${(Math.sin((i * Math.PI) / 3) * 11).toFixed(1)}" r="${(2 + i * 0.55).toFixed(1)}"/>`).join('')}</g>
      <g class="m-eye-dollar" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 -9 C7 -15 -10 -15.5 -10 -6.5 C-10 2 10 -2 10 7 C10 16 -8.5 15.5 -11 9 M0 -20 V20" stroke="#0a0a0a" stroke-width="10"/>
        <path d="M9.5 -9 C7 -15 -10 -15.5 -10 -6.5 C-10 2 10 -2 10 7 C10 16 -8.5 15.5 -11 9 M0 -20 V20" stroke="#35d06f" stroke-width="5"/>
      </g>
    </g></g>`;

  const heart = (cls, x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})"><path class="m-heart ${cls}" fill="#ff7a93" stroke="#0a0a0a" stroke-width="2.4"
      stroke-linejoin="round" d="M0 5 C-7 0 -8 -5.5 -4 -7.5 C-2 -8.5 0 -7 0 -5 C0 -7 2 -8.5 4 -7.5 C8 -5.5 7 0 0 5 Z"/></g>`;

  const sparkle = (cls, x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})"><path class="m-sparkle ${cls}" fill="#fff"
      d="M0 -10 Q1.2 -1.2 10 0 Q1.2 1.2 0 10 Q-1.2 1.2 -10 0 Q-1.2 -1.2 0 -10 Z"/></g>`;

  const svg = () => `
<svg viewBox="-16 -18 232 222" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g class="m-shadow-mood"><ellipse class="m-shadow" cx="100" cy="194" rx="62" ry="7"/></g>

  <g class="m-breath"><g class="m-mood"><g class="m-react"><g class="m-talk">
    <g transform="translate(62 14)"><g class="m-flash">
      <circle class="m-flash-glow" r="30" fill="#fff"/>
      <g class="m-flash-rays" stroke="#fff" stroke-width="6" stroke-linecap="round">
        <path d="M0 -34 V-46"/><path d="M24 -24 L32.5 -32.5"/><path d="M34 0 H46"/><path d="M24 24 L32.5 32.5"/>
        <path d="M-24 24 L-32.5 32.5"/><path d="M-34 0 H-46"/><path d="M-24 -24 L-32.5 -32.5"/>
      </g>
    </g></g>

    <g class="m-shutter"><rect class="m-ink" x="40" y="34" width="44" height="28" rx="9" fill="#f4f4f4"/></g>
    <rect class="m-ink" x="10" y="54" width="180" height="128" rx="44" fill="#f4f4f4"/>

    <rect class="m-tiny-hide" x="38" y="76" width="30" height="12" rx="6" fill="#0a0a0a"/>
    <circle class="m-ink m-rec" cx="158" cy="82" r="7.5" stroke-width="4.5"/>

    <g class="m-face">
      <ellipse class="m-blush" cx="50" cy="147" rx="11" ry="6.5" fill="#ff9db0"/>
      <ellipse class="m-blush" cx="150" cy="147" rx="11" ry="6.5" fill="#ff9db0"/>
      ${eye('l', 72)}
      ${eye('r', 128)}

      <g class="m-dots" fill="#0a0a0a">
        <circle class="m-dot d1" cx="87" cy="158" r="4.5"/>
        <circle class="m-dot d2" cx="100" cy="158" r="4.5"/>
        <circle class="m-dot d3" cx="113" cy="158" r="4.5"/>
      </g>

      <g transform="translate(173 104)"><path class="m-sweat" fill="#cfe9ff" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"
        d="M0 -11 C4 -4 8 1 8 5.5 C8 10 4.5 13 0 13 C-4.5 13 -8 10 -8 5.5 C-8 1 -4 -4 0 -11 Z"/></g>

      <g transform="translate(136 148)"><path class="m-tear" fill="#9fd4ff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"
        d="M0 -9 C3 -3 6.5 1 6.5 4.5 C6.5 8 3.6 10.5 0 10.5 C-3.6 10.5 -6.5 8 -6.5 4.5 C-6.5 1 -3 -3 0 -9 Z"/></g>

      <g class="m-ew m-tiny-hide" fill="none" stroke="#7cc27a" stroke-width="4" stroke-linecap="round">
        <path d="M88 64 V80"/><path d="M100 62 V84"/><path d="M112 64 V80"/>
      </g>
    </g>

    <g transform="translate(182 44)"><g class="m-anger" fill="none" stroke-linecap="round">
      <path d="M-12 -12 Q0 -1 12 -12 M13 -11 Q2 0 13 11 M12 12 Q0 1 -12 12 M-13 11 Q-2 0 -13 -11" stroke="#0a0a0a" stroke-width="9"/>
      <path d="M-12 -12 Q0 -1 12 -12 M13 -11 Q2 0 13 11 M12 12 Q0 1 -12 12 M-13 11 Q-2 0 -13 -11" stroke="#ff3b30" stroke-width="5"/>
    </g></g>

    <g class="m-orbit m-tiny-hide">${sparkle('o1', 100, 30, 0.75)}${sparkle('o2', 100, 30, 0.75)}${sparkle('o3', 100, 30, 0.75)}</g>
  </g></g></g></g>

  <g class="m-hearts">${heart('h1', 30, 26, 1.5)}${heart('h2', 100, 0, 1.9)}${heart('h3', 170, 22, 1.4)}</g>
  <g class="m-sparkles">${sparkle('s1', 2, 40, 1.1)}${sparkle('s2', 196, 30, 0.9)}${sparkle('s3', 182, 150, 0.7)}${sparkle('s4', 14, 150, 0.65)}</g>

  <g class="m-pop m-pop-l" stroke="#f4f4f4" stroke-width="6" stroke-linecap="round">
    <path d="M-2 62 L-12 52"/><path d="M-6 98 L-18 98"/><path d="M-2 134 L-12 144"/>
  </g>
  <g class="m-pop m-pop-r" stroke="#f4f4f4" stroke-width="6" stroke-linecap="round">
    <path d="M202 62 L212 52"/><path d="M206 98 L218 98"/><path d="M202 134 L212 144"/>
  </g>

  <g class="m-zzz" fill="none" stroke="#8c8c8c" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
    <g transform="translate(170 30)"><path class="m-z z1" d="M-8 -8 H8 L-8 8 H8"/></g>
    <g transform="translate(190 6)"><path class="m-z z2" d="M-6 -6 H6 L-6 6 H6"/></g>
    <g transform="translate(206 -11)"><path class="m-z z3" d="M-4.5 -4.5 H4.5 L-4.5 4.5 H4.5"/></g>
  </g>

  <g class="m-scissors">
    <g class="m-blade-a">
      <path d="M188 174 L152 152" stroke="#0a0a0a" stroke-width="11" stroke-linecap="round"/>
      <path d="M188 174 L152 152" stroke="#f4f4f4" stroke-width="5" stroke-linecap="round"/>
      <circle cx="198" cy="181" r="8" fill="#0a0a0a" stroke="#f4f4f4" stroke-width="3.5"/>
    </g>
    <g class="m-blade-b">
      <path d="M188 174 L150 179" stroke="#0a0a0a" stroke-width="11" stroke-linecap="round"/>
      <path d="M188 174 L150 179" stroke="#f4f4f4" stroke-width="5" stroke-linecap="round"/>
      <circle cx="200" cy="167" r="8" fill="#0a0a0a" stroke="#f4f4f4" stroke-width="3.5"/>
    </g>
  </g>
</svg>`;

  // Her eyes in each mood. Moods with a timed sequence (clipping) animate the shapes in CSS.
  const MOOD_EYES = { paused: 'sleep', happy: 'happy', error: 'wince' };
  const REACT_EYES = { love: 'heart', dizzy: 'dizzy', pet: 'happy', rub: 'happy' };
  // {love} is heart eyes, for when she's flattered or fond; {joy} is bright, sparkly eyes for when she's just thrilled
  const SPEECH_EYES = { wink: 'wink', shine: 'shine', worried: 'open', happy: 'happy', love: 'heart', joy: 'joy', heart: 'heart', dollar: 'dollar',
    flat: 'flat', shock: 'shock', angry: 'angry', sad: 'sad', smug: 'smug', ew: 'ew', load: 'load' };
  const ONE_SHOT = new Set(['clipping', 'happy', 'error']);
  const reactions = ['pet', 'love', 'dizzy', 'rub'];

  const instances = new Set();
  const holds = [];
  let base = 'idle';
  let flashMood = null, flashTimer = 0;
  let speechFace = null, isTalking = false;
  let pointer = null;
  let frozen = false;

  const current = () => flashMood || (holds.length ? holds[holds.length - 1].mood : base);
  // A second Snappy on screen (her future self, a photo of her) has a face of her own: she only hops and changes
  // expression while she herself is the one talking.
  let speaker = null;
  const faceOf = (el) => (el._own ? el._face || null : speechFace);
  const followers = () => [...instances].filter((el) => !el._own);
  // The Snappy out on a tour or in a surprise is always wide awake, even while recording is paused or she was dozing.
  const moodOf = (el) => { const mood = current(); return mood === 'paused' && el.classList.contains('awake') ? 'idle' : mood; };

  function eyesFor(el, mood) {
    const react = reactions.find((r) => el.classList.contains(r));
    if (react) return REACT_EYES[react];
    // An expression from talking wins over the mood, but not over a one-shot like a clip, or sleep.
    const f = faceOf(el);
    if (f && !ONE_SHOT.has(mood) && mood !== 'paused') return SPEECH_EYES[f] || 'open';
    return MOOD_EYES[mood] || 'open';
  }

  // Eyes change shape behind a quick blink, so one shape never smears into the next.
  function setEyes(el, eyes, instant) {
    el.dataset.worried = faceOf(el) === 'worried' ? '1' : '';
    if (el.dataset.eyes === eyes) return;
    clearTimeout(el._swap);
    if (instant || !el.dataset.eyes) { el.dataset.eyes = eyes; return; }
    el.classList.add('swap');
    el.classList.remove('emote');
    el._swap = setTimeout(() => {
      el.dataset.eyes = eyes;
      el.classList.add('emote');
      el._swap = setTimeout(() => el.classList.remove('swap'), 45);
      clearTimeout(el._emote);
      el._emote = setTimeout(() => el.classList.remove('emote'), 520);
    }, 105);
  }

  function applyTo(el, restart) {
    const mood = moodOf(el);
    if (restart && el.dataset.mood === mood) { el.dataset.mood = ''; void el.getBoundingClientRect(); }
    el.dataset.mood = mood;
    setEyes(el, eyesFor(el, mood), frozen);
  }
  function applyAll(restartMood = null) {
    for (const el of instances) {
      if (!el.isConnected && !frozen) { instances.delete(el); continue; }
      applyTo(el, restartMood !== null && restartMood === current() && ONE_SHOT.has(restartMood));
    }
  }

  function mount(el) {
    if (!el || instances.has(el)) return el;
    el.classList.add('mascot');
    el.innerHTML = svg();
    instances.add(el);
    applyTo(el, false);
    return el;
  }

  function setBase(mood) { if (base === mood) return; base = mood; applyAll(); }

  function hold(key, mood) {
    const existing = holds.findIndex((h) => h.key === key);
    if (existing >= 0) holds.splice(existing, 1);
    holds.push({ key, mood });
    applyAll(flashMood ? null : mood);
  }

  function release(key) {
    const i = holds.findIndex((h) => h.key === key);
    if (i >= 0) { holds.splice(i, 1); applyAll(); }
  }

  function flash(mood, ms = 1300) {
    clearTimeout(flashTimer);
    const again = flashMood === mood;
    flashMood = mood;
    applyAll(again ? mood : null);
    flashTimer = setTimeout(() => { flashMood = null; applyAll(); }, ms);
  }

  function face(name) {
    if (speaker) { speaker._face = name || null; applyTo(speaker, false); return; }
    speechFace = name || null;
    applyAll();
  }

  // Animations off: she still changes expression, but holds still otherwise.
  let still = false;
  function setStill(on) {
    still = !!on;
    document.documentElement.classList.toggle('snappy-still', still);
  }

  function talking(on) {
    if (speaker) { speaker.classList.toggle('talking', !!on); return; }
    isTalking = !!on;
    for (const el of followers()) el.classList.toggle('talking', isTalking);
  }

  // She has no mouth, so she talks with her whole body: a little jump for each word.
  function hop() {
    if (still) return;
    for (const el of speaker ? [speaker] : followers()) {
      if (!el.isConnected) continue;
      el.classList.remove('hop');
      void el.getBoundingClientRect();
      el.classList.add('hop');
    }
  }

  // ----- eyes follow the pointer, glance around when it's away -----
  function look() {
    for (const el of instances) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      let lx = 0, ly = 0;
      if (el._gaze) {
        [lx, ly] = el._gaze;
      } else if (pointer) {
        const dx = pointer.x - (r.left + r.width / 2);
        const dy = pointer.y - (r.top + r.height * 0.52);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / Math.max(160, r.width * 3));
        lx = (dx / d) * k;
        ly = (dy / d) * k;
      } else if (el._glance) {
        [lx, ly] = el._glance;
      }
      el.style.setProperty('--lx', lx.toFixed(3));
      el.style.setProperty('--ly', ly.toFixed(3));
    }
  }
  let lookQueued = false;
  const queueLook = () => { if (!lookQueued) { lookQueued = true; requestAnimationFrame(() => { lookQueued = false; look(); }); } };
  document.addEventListener('pointermove', (e) => { if (!frozen) { pointer = { x: e.clientX, y: e.clientY }; queueLook(); } }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; queueLook(); });
  setInterval(() => {
    if (pointer || frozen || document.hidden) return;
    for (const el of instances) {
      // While she talks she mostly looks over at what she's saying.
      el._glance = isTalking ? [0.55 + Math.random() * 0.3, 0.35]
        : Math.random() < 0.45 ? [0, 0] : [Math.random() * 1.6 - 0.8, Math.random() * 0.8 - 0.3];
    }
    look();
  }, 2600);

  // ----- blinking -----
  const noBlink = new Set(['sleep', 'happy', 'wince', 'heart', 'dizzy', 'dollar']);
  (function scheduleBlink() {
    setTimeout(() => {
      if (!frozen && !document.hidden) {
        const twice = Math.random() < 0.2;
        for (const el of instances) {
          if (noBlink.has(el.dataset.eyes) || el.dataset.mood === 'clipping' || el.classList.contains('swap')) continue;
          el.classList.add('blink');
          setTimeout(() => el.classList.remove('blink'), 120);
          if (twice) setTimeout(() => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 110); }, 260);
        }
      }
      scheduleBlink();
    }, 2200 + Math.random() * 3800);
  })();

  // ----- being fussed over -----
  // A tap squishes her, three quick taps get a hop and heart eyes, and if you keep going she gets dizzy. Rubbing the
  // pointer back and forth over her makes her close her eyes and lean into it.
  const listeners = new Set();
  const emit = (name, el) => { for (const fn of listeners) fn(name, el); };
  const mascotAt = (target) => {
    const el = target?.closest?.('.mascot');
    return el && !frozen && instances.has(el) ? el : null;
  };
  function react(el, cls, ms) {
    for (const other of reactions) if (other !== cls) el.classList.remove(other);
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    applyTo(el, false);
    el._timers ||= {};
    clearTimeout(el._timers[cls]);
    el._timers[cls] = setTimeout(() => { el.classList.remove(cls); applyTo(el, false); }, ms);
    emit(cls, el);
  }

  document.addEventListener('pointerdown', (e) => {
    const el = mascotAt(e.target);
    if (!el || el.classList.contains('dizzy')) return;
    const now = performance.now();
    el._taps = (el._taps || []).filter((t) => now - t < 2400);
    el._taps.push(now);
    if (el._taps.length >= 6) {
      el._taps = [];
      react(el, 'dizzy', 1900);
    } else if (el._taps.length === 3) {
      react(el, 'love', 1500);
    } else if (!el.classList.contains('love')) {
      react(el, 'pet', 620);
    }
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    const el = mascotAt(e.target);
    const dir = Math.sign(e.movementX);
    if (!el || !dir || el.classList.contains('dizzy') || el.classList.contains('love')) return;
    const now = performance.now();
    if (dir !== el._dir) {
      el._dir = dir;
      el._turns = (el._turns || []).filter((t) => now - t < 900);
      el._turns.push(now);
    }
    if (el._turns.length < 4) return;
    if (!el.classList.contains('rub')) { el.classList.add('rub'); applyTo(el, false); emit('rub', el); }
    clearTimeout(el._rubEnd);
    el._rubEnd = setTimeout(() => { el.classList.remove('rub'); applyTo(el, false); }, 500);
  }, { passive: true });

  document.addEventListener('pointerover', (e) => mascotAt(e.target)?.classList.add('curious'), { passive: true });
  document.addEventListener('pointerout', (e) => {
    const el = mascotAt(e.target);
    if (el && !el.contains(e.relatedTarget)) el.classList.remove('curious');
  }, { passive: true });

  // ----- little things she does on her own, only when nothing else is going on -----
  const fidgets = [['stretch', 1500], ['wiggle', 1300], ['peek', 2600]];
  (function scheduleFidget() {
    setTimeout(() => {
      if (!frozen && !still && !document.hidden && !flashMood && !holds.length && !isTalking && (base === 'idle' || base === 'recording')) {
        const [cls, ms] = fidgets[Math.floor(Math.random() * fidgets.length)];
        for (const el of instances) {
          if (el.isConnected && el.getBoundingClientRect().width >= 56 && !reactions.some((r) => el.classList.contains(r))) {
            el.classList.add(cls);
            setTimeout(() => el.classList.remove(cls), ms);
          }
        }
      }
      scheduleFidget();
    }, 22000 + Math.random() * 30000);
  })();

  // ----- deterministic rendering for icon / overlay frame generation (build tooling only) -----
  function freeze(mood, timeMs, lx = 0, ly = 0) {
    frozen = true;
    clearTimeout(flashTimer);
    flashMood = null;
    speechFace = null;
    isTalking = false;
    holds.length = 0;
    base = mood;
    pointer = null;
    for (const el of instances) {
      el._glance = null;
      clearTimeout(el._swap);
      el.classList.remove('blink', 'swap', 'emote', 'hop', 'talking', 'curious', 'stretch', 'wiggle', 'peek', ...reactions);
      el.dataset.mood = '';
      void el.getBoundingClientRect();
      el.dataset.mood = mood;
      el.dataset.eyes = MOOD_EYES[mood] || 'open';
      el.classList.add('frozen');
      el.style.setProperty('--lx', lx);
      el.style.setProperty('--ly', ly);
    }
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = timeMs; }
  }

  // An outfit (SVG in her own coordinates) drawn on her body, so it moves with her. Null takes it off. Worn means
  // she already had it on (another copy of her is taking over), so it doesn't pop on again.
  function dress(el, markup, worn = false) {
    const host = el?.querySelector('.m-talk');
    if (!host) return;
    // one coming off is on its way out: a new one gets drawn fresh
    let outfit = host.querySelector('.m-outfit:not(.off)');
    if (!markup) { outfit?.classList.add('off'); setTimeout(() => outfit?.remove(), 350); return; }
    if (outfit?.dataset.markup === markup) return;
    // a different one: the old one comes off and the new one goes on (unless she walked in wearing it)
    if (outfit && !worn) {
      const old = outfit;
      old.classList.add('off');
      setTimeout(() => old.remove(), 350);
      outfit = null;
    }
    if (!outfit) {
      outfit = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      outfit.setAttribute('class', worn ? 'm-outfit worn' : 'm-outfit');
      host.appendChild(outfit);
    }
    outfit.innerHTML = markup;
    outfit.dataset.markup = markup;
  }

  // Only one Snappy on screen: while a big one is out (a tour, a surprise, her work bubble), every other copy of her
  // steps out of view. Returns what brings them back.
  let soloCount = 0;
  function solo(el) {
    el?.classList.add('lead', 'awake');
    if (el && instances.has(el)) applyTo(el, false);
    soloCount++;
    document.documentElement.classList.add('snappy-solo');
    let done = false;
    return () => {
      if (done) return;
      done = true;
      el?.classList.remove('lead', 'awake');
      soloCount = Math.max(0, soloCount - 1);
      if (!soloCount) document.documentElement.classList.remove('snappy-solo');
    };
  }

  // Back to her own spot in the corner: a few little hops over, shrinking to fit, and a soft landing. The box is the
  // fixed element she moves in, the body the one that hops. When recording is paused she nods off on arrival.
  async function goHome(box, body) {
    const slot = document.getElementById('mascot');
    const r = slot?.getBoundingClientRect();
    if (!r?.width || !box.isConnected) return false;
    const from = box.getBoundingClientRect();
    const dist = Math.hypot(r.left - from.left, r.top - from.top);
    const ms = Math.round(Math.min(1250, Math.max(560, 380 + dist * 0.75)));
    const hops = Math.max(2, Math.round(ms / 290));
    box.style.setProperty('--home-ms', `${ms}ms`);
    body.style.setProperty('--hop-ms', `${ms / hops}ms`);
    body.style.setProperty('--hops', String(hops));
    body.classList.remove('home-land');
    box.classList.add('homing');
    body.classList.add('home-hops');
    void box.offsetWidth;
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    await new Promise((res) => setTimeout(res, ms));
    body.classList.remove('home-hops');
    void body.offsetWidth;
    body.classList.add('home-land');
    await new Promise((res) => setTimeout(res, 380));
    const her = box.querySelector('.mascot');
    if (her && current() === 'paused') {
      her.classList.remove('awake');
      applyTo(her, false);
      await new Promise((res) => setTimeout(res, 520));
    }
    return true;
  }

  // The copy in the corner takes over from a big Snappy in the very same frame, so there is only ever one of her.
  function swap(fn) {
    const html = document.documentElement;
    html.classList.add('snappy-swap');
    fn();
    for (const el of instances) if (el.isConnected) applyTo(el, false);
    void document.body.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('snappy-swap')));
  }

  // Where she looks, whatever the pointer does: [x, y] from -1 to 1, null to follow the pointer again.
  function gaze(el, at, slow = false) {
    for (const her of el ? [el] : instances) {
      her._gaze = at;
      her.classList.toggle('slow-look', !!slow);
    }
    look();
  }

  // Back to plain: no expression left over, not talking, eyes on the pointer.
  function reset() {
    speechFace = null;
    isTalking = false;
    speaker = null;
    for (const el of instances) {
      el._gaze = null;
      el._face = null;
      el.classList.remove('talking', 'hop', 'slow-look');
    }
    applyAll();
  }

  // A reaction on purpose, e.g. to replay one from her achievements.
  function act(cls) {
    const ms = { pet: 620, love: 1500, dizzy: 1900 }[cls];
    for (const el of instances) if (el.isConnected && el.getBoundingClientRect().width >= 40) react(el, cls, ms);
  }

  // One of her little fidgets, right now.
  function fidget(el, cls) {
    const ms = Object.fromEntries(fidgets)[cls];
    if (!ms || still) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  window.Mascot = {
    mount, setBase, hold, release, flash, face, talking, hop, freeze, still: setStill, act, dress, solo, goHome, swap, gaze, reset, fidget,
    // a copy with a face of her own, and who's talking among those (null: the usual Snappy)
    own(el) { if (el) el._own = true; },
    speaker(el) { speaker = el?._own ? el : null; },
    on: (fn) => listeners.add(fn),
    get mood() { return current(); },
    get expression() { return speechFace; },
    get isTalking() { return isTalking; },
  };
})();
