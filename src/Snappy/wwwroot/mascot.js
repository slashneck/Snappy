// Snappy the camera: one SVG, many moods. Every element with class "mascot" gets its own copy.
//   Mascot.mount(el)            turn an element into a mascot
//   Mascot.setBase(mood)        idle | recording | paused | starting | problem
//   Mascot.hold(key, mood)      keep a mood while something runs (working, trimming, clipping)
//   Mascot.release(key)
//   Mascot.flash(mood, ms)      one-shot reaction (happy, error)
(() => {
  // Deliberately simple: white body, ink outline, two pill eyes. All expression lives in the eyes and the motion.
  const eye = (x) => `
    <g transform="translate(${x} 120)"><g class="m-eye">
      <g class="m-eye-open">
        <ellipse rx="14" ry="20" fill="#0a0a0a"/>
        <ellipse class="m-tiny-hide" cx="-4.5" cy="-8" rx="4" ry="5.5" fill="#fff"/>
      </g>
      <path class="m-ink m-eye-happy" d="M-15 6 Q0 -14 15 6" fill="none" stroke-width="8"/>
      <path class="m-ink m-eye-sleep" d="M-15 1 Q0 9 15 1" fill="none" stroke-width="8"/>
      <path class="m-ink m-eye-x" d="M-10 -10 L10 10 M10 -10 L-10 10" fill="none" stroke-width="8"/>
    </g></g>`;

  const svg = () => `
<svg viewBox="-16 -18 232 222" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="m-shadow" cx="100" cy="194" rx="62" ry="7"/>

  <g class="m-body">
    <g transform="translate(62 14)"><g class="m-flash">
      <path d="M0 -28 L7 -9 L27 -13 L11 2 L22 20 L2 11 L-8 28 L-9 8 L-28 8 L-11 -3 L-21 -20 L-2 -11 Z"
            fill="#fff" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>
    </g></g>

    <g class="m-shutter"><rect class="m-ink" x="40" y="34" width="44" height="28" rx="9" fill="#f4f4f4"/></g>
    <rect class="m-ink" x="10" y="54" width="180" height="128" rx="44" fill="#f4f4f4"/>

    <rect class="m-tiny-hide" x="38" y="76" width="30" height="12" rx="6" fill="#0a0a0a"/>
    <circle class="m-ink m-rec" cx="158" cy="82" r="7.5" stroke-width="4.5"/>

    ${eye(72)}
    ${eye(128)}

    <g class="m-dots" fill="#0a0a0a">
      <circle class="m-dot d1" cx="87" cy="160" r="4.5"/>
      <circle class="m-dot d2" cx="100" cy="160" r="4.5"/>
      <circle class="m-dot d3" cx="113" cy="160" r="4.5"/>
    </g>
  </g>

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

  const instances = new Set();
  const holds = [];
  let base = 'idle';
  let flashMood = null, flashTimer = 0;
  let pointer = null;
  let frozen = false;

  const current = () => flashMood || (holds.length ? holds[holds.length - 1].mood : base);

  function applyTo(el, restart) {
    const mood = current();
    if (el.dataset.mood === mood && !restart) return;
    if (restart) { el.dataset.mood = ''; void el.offsetWidth; }
    el.dataset.mood = mood;
  }
  function applyAll(restart = false) {
    for (const el of instances) {
      if (!el.isConnected && !frozen) { instances.delete(el); continue; }
      applyTo(el, restart);
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

  function setBase(mood) { base = mood; applyAll(); }

  function hold(key, mood) {
    const existing = holds.findIndex((h) => h.key === key);
    if (existing >= 0) holds.splice(existing, 1);
    holds.push({ key, mood });
    applyAll(!flashMood);
  }

  function release(key) {
    const i = holds.findIndex((h) => h.key === key);
    if (i >= 0) { holds.splice(i, 1); applyAll(); }
  }

  function flash(mood, ms = 1300) {
    clearTimeout(flashTimer);
    flashMood = mood;
    applyAll(true);
    flashTimer = setTimeout(() => { flashMood = null; applyAll(); }, ms);
  }

  // ----- eyes follow the pointer, glance around when it's away -----
  function look() {
    for (const el of instances) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      let lx = 0, ly = 0;
      if (pointer) {
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
    if (pointer || frozen) return;
    for (const el of instances) el._glance = Math.random() < 0.45 ? [0, 0] : [Math.random() * 1.6 - 0.8, Math.random() * 0.8 - 0.3];
    look();
  }, 2600);

  // ----- blinking -----
  const noBlink = new Set(['paused', 'happy', 'error', 'clipping']);
  (function scheduleBlink() {
    setTimeout(() => {
      if (!frozen) {
        const twice = Math.random() < 0.2;
        for (const el of instances) {
          if (noBlink.has(el.dataset.mood)) continue;
          el.classList.add('blink');
          setTimeout(() => el.classList.remove('blink'), 120);
          if (twice) setTimeout(() => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 110); }, 260);
        }
      }
      scheduleBlink();
    }, 2200 + Math.random() * 3800);
  })();

  // ----- it notices when you poke it, and gets excited if you keep going -----
  let pets = 0, petTimer = 0;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('.mascot');
    if (!el || frozen || !instances.has(el)) return;
    el.classList.remove('pet');
    void el.offsetWidth;
    el.classList.add('pet');
    setTimeout(() => el.classList.remove('pet'), 620);
    clearTimeout(petTimer);
    petTimer = setTimeout(() => { pets = 0; }, 1800);
    if (++pets >= 3) { pets = 0; flash('happy', 1100); }
  }, { passive: true });

  // ----- a stretch now and then, only when nothing else is going on -----
  (function scheduleStretch() {
    setTimeout(() => {
      if (!frozen && !flashMood && !holds.length && (base === 'idle' || base === 'recording')) {
        for (const el of instances) {
          if (el.isConnected && el.getBoundingClientRect().width >= 56) {
            el.classList.add('stretch');
            setTimeout(() => el.classList.remove('stretch'), 1500);
          }
        }
      }
      scheduleStretch();
    }, 26000 + Math.random() * 34000);
  })();

  // ----- deterministic rendering for icon / overlay frame generation (build tooling only) -----
  function freeze(mood, timeMs, lx = 0, ly = 0) {
    frozen = true;
    clearTimeout(flashTimer);
    flashMood = null;
    holds.length = 0;
    base = mood;
    pointer = null;
    for (const el of instances) {
      el._glance = null;
      el.dataset.mood = '';
      void el.offsetWidth;
      el.dataset.mood = mood;
      el.classList.remove('blink');
      el.classList.add('frozen');
      el.style.setProperty('--lx', lx);
      el.style.setProperty('--ly', ly);
    }
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = timeMs; }
  }

  window.Mascot = { mount, setBase, hold, release, flash, freeze, get mood() { return current(); } };
})();
