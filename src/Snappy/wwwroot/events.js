// Snappy's events: little moments, adventures in her own world, and longer stories. Seeing one all the way through
// unlocks it as an achievement. Any of them can be skipped (the button at the bottom, or Esc); a skipped event doesn't
// count and may come back another day. They only ever happen while you're hanging around in the app, never during a
// clip, a tour, a task or a video, and not at all with "Events and surprises" off.
//   Events.define(id, { tier, title, hint, run(ctx), replay(), weight, when(), after, quick, planned, system, invite })
//     tier 'game': something you play along with (where it makes sense she asks first: invite is what she says)
//     after: the events this one talks about; it only comes up once you've seen all of them
//     again: a game with a best score to beat, which can come back now and then. Other games only ever come up once
//       by themselves (they can still be replayed from the achievements).
//     planned: happens on a date or after an update, not by chance, so it doesn't push back the next surprise
//     system: not an achievement at all (the patch notes)
//   Events.play(id)      play one right now
//   Events.achieve(id)   unlock one that isn't played out (a reaction, a secret)
//   Events.list()        the achievements window
(() => {
  const SKIP = Symbol('skip');
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* an achievement might show up again, that's all */ } },
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  const TIERS = {
    early: { name: 'Early Bird', group: 'Since the beginning' },
    common: { name: 'Common', group: 'Little moments' },
    uncommon: { name: 'Uncommon', group: "Snappy's world" },
    rare: { name: 'Rare', group: 'Stories' },
    holiday: { name: 'Special day', group: 'Special days' },
    legendary: { name: 'Legendary', group: 'Legends' },
    game: { name: 'Game', group: 'Games' },
  };
  const defs = new Map();
  const has = (id) => store.get(`snappy.ach.${id}`) === '1';
  let current = null;

  // a skipped event leaves promises behind that nobody waits for anymore
  addEventListener('unhandledrejection', (e) => { if (e.reason === SKIP) e.preventDefault(); });

  // ---------------------------------------------------------------------------
  // What an event runs with. Every wait goes through it, so skipping stops the event right where it is; whatever the
  // event put on screen is cleaned up by what it registered with onEnd.
  // ---------------------------------------------------------------------------
  function createCtx() {
    let reject;
    const gone = new Promise((_, rej) => { reject = rej; });
    gone.catch(() => {});
    const ends = [];
    const ctx = {
      cancelled: false,
      writers: new Set(),
      run(promise) { return ctx.cancelled ? Promise.reject(SKIP) : Promise.race([promise, gone]); },
      wait(ms) { return ctx.run(wait(ms)); },
      check() { if (ctx.cancelled) throw SKIP; },
      onEnd(fn) { ends.push(fn); },
      cancel() {
        if (ctx.cancelled) return;
        ctx.cancelled = true;
        for (const w of ctx.writers) w.finish();
        reject(SKIP);
      },
      async teardown(skipped) {
        await Promise.all(ends.splice(0).reverse().map(async (fn) => {
          try { await fn(skipped); } catch (err) { console.error(err); }
        }));
      },
    };
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // A pretend mouse pointer. While an event borrows it, the real one hides and this one shows up in exactly the same
  // spot. It follows your hand until she grabs it. After that your moves still count, as a tug against her.
  // ---------------------------------------------------------------------------
  const Cursor = (() => {
    let real = { x: innerWidth / 2, y: innerHeight / 2 };
    let el = null, mode = 'off', base = { x: 0, y: 0 }, tug = { x: 0, y: 0 }, pull = { x: 0, y: 0 }, strain = 0, frame = 0;
    let shake = 0;
    addEventListener('pointermove', (e) => {
      real = { x: e.clientX, y: e.clientY };
      if (mode === 'held') {
        pull.x += e.movementX;
        pull.y += e.movementY;
        strain += Math.abs(e.movementX) + Math.abs(e.movementY);
      }
    }, { passive: true, capture: true });

    function draw() {
      if (!el) return;
      if (mode === 'follow') base = { ...real };
      if (mode === 'held') {
        // your pull, held back by her: it gives a little, then springs back as soon as you ease off
        const max = 70;
        const want = { x: Math.max(-max, Math.min(max, pull.x * 0.45)), y: Math.max(-max, Math.min(max, pull.y * 0.45)) };
        tug.x = lerp(tug.x, want.x, 0.35);
        tug.y = lerp(tug.y, want.y, 0.35);
        pull.x *= 0.88;
        pull.y *= 0.88;
        strain *= 0.94;
      } else {
        tug.x = lerp(tug.x, 0, 0.3);
        tug.y = lerp(tug.y, 0, 0.3);
      }
      const jx = shake ? (Math.random() - 0.5) * shake : 0, jy = shake ? (Math.random() - 0.5) * shake : 0;
      el.style.transform = `translate(${base.x + tug.x + jx}px, ${base.y + tug.y + jy}px)`;
      frame = requestAnimationFrame(draw);
    }

    return {
      get real() { return real; },
      get pos() { return { x: base.x + tug.x, y: base.y + tug.y }; },
      get strain() { return strain; },
      set shake(v) { shake = v; },
      take() {
        if (el) return;
        snappy.call('gag.confine', { on: true }).catch(() => {});
        el = document.createElement('div');
        el.className = 'fake-cursor';
        el.innerHTML = '<svg width="20" height="28" viewBox="0 0 20 28"><path d="M1.5 1.5v20.2l5.1-4.9 3.4 8.1 3.3-1.4-3.4-8h7.1z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>';
        document.body.appendChild(el);
        base = { ...real };
        mode = 'follow';
        document.documentElement.classList.add('cursor-taken');
        draw();
      },
      grab() { mode = 'held'; pull = { x: 0, y: 0 }; strain = 0; },
      // glides to a point; the pull of your hand still adds on top
      async moveTo(x, y, ms = 700, curve = ease) {
        const from = { ...base };
        const start = performance.now();
        while (el) {
          const t = Math.min(1, (performance.now() - start) / ms);
          base = { x: lerp(from.x, x, curve(t)), y: lerp(from.y, y, curve(t)) };
          if (t >= 1) break;
          await new Promise((res) => requestAnimationFrame(res));
        }
      },
      press() { el?.classList.remove('press'); void el?.offsetWidth; el?.classList.add('press'); },
      // drawn bigger, e.g. while it's being questioned
      big(on) { el?.classList.toggle('big', on); },
      // hands it back: it slides to wherever your real mouse is now, and the real one takes over in the same spot
      async release() {
        if (!el) return;
        mode = 'return';
        shake = 0;
        const from = { ...base }, start = performance.now();
        for (;;) {
          const t = Math.min(1, (performance.now() - start) / 420);
          base = { x: lerp(from.x, real.x, ease(t)), y: lerp(from.y, real.y, ease(t)) };
          if (t >= 1) break;
          await new Promise((res) => requestAnimationFrame(res));
        }
        cancelAnimationFrame(frame);
        snappy.call('gag.confine', { on: false }).catch(() => {});
        el?.remove();
        el = null;
        mode = 'off';
        document.documentElement.classList.remove('cursor-taken');
      },
    };
  })();

  function cursor(ctx) {
    Cursor.take();
    ctx.onEnd(() => Cursor.release());
    return Cursor;
  }

  // ---------------------------------------------------------------------------
  // A big Snappy who walks around the window and talks. However the event ends, she hops back home to her corner.
  //   from: 'right' runs in from the side, 'home' steps out of her corner
  //   own: a second Snappy next to the first, with a face and voice of her own
  // ---------------------------------------------------------------------------
  function actor(ctx, sizePx = 112, { from = 'right', own = false } = {}) {
    const root = document.createElement('div');
    root.className = 'actor';
    root.innerHTML = '<div class="actor-body"><div class="actor-mascot"></div></div><div class="actor-bubble" hidden><div class="actor-text"></div></div>';
    const body = root.querySelector('.actor-body');
    const bubble = root.querySelector('.actor-bubble');
    const her = root.querySelector('.actor-mascot');
    let x = innerWidth + 40, y = innerHeight / 2, size = sizePx, side = 'auto', atHome = false, unsolo = () => {};
    // she always stays inside the window, except when she runs in at the side
    const place = (nx, ny, free = false) => {
      x = free ? nx : Math.max(8, Math.min(nx, innerWidth - size - 8));
      y = free ? ny : Math.max(8, Math.min(ny, innerHeight - size - 8));
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
    };
    const slot = document.getElementById('mascot')?.getBoundingClientRect();
    if (from === 'home' && slot?.width) {
      size = slot.width;
      root.style.setProperty('--size', `${size}px`);
      place(slot.left, slot.top, true);
      // the corner copy hands over to this one in the same frame
      Mascot.swap(() => {
        document.body.appendChild(root);
        Mascot.mount(her);
        unsolo = Mascot.solo(her);
      });
    } else {
      root.style.setProperty('--size', `${size}px`);
      place(x, y, true);
      document.body.appendChild(root);
      if (own) Mascot.own(her);
      Mascot.mount(her);
      unsolo = Mascot.solo(her);
    }

    const replay = (cls) => { root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); };

    const me = {
      root,
      get x() { return x; }, get y() { return y; }, get size() { return size; },
      get center() { return { x: x + size / 2, y: y + size / 2 }; },
      resize(px) { size = px; root.style.setProperty('--size', `${px}px`); },
      // puts her right there, anywhere, e.g. frame by frame while she flies
      placeAt(nx, ny) { me.hush(); place(nx, ny, true); },
      // where her lines go: a bubble 'right', 'left' or 'below' her, 'auto' (right, or left when there's no room), or
      // 'caption': plain text under her, like subtitles, for stories
      bubbleSide(where) { side = where; },
      // called whenever she sets off somewhere, e.g. to clear what someone else said next to her
      onMove: null,
      // a rect her lines should stay clear of, e.g. a sheet of paper
      avoid: null,
      // hops over to a spot (top-left corner of her box)
      async moveTo(nx, ny, { hop = true, ms = 700 } = {}) {
        ctx.check();
        // whatever anyone was saying next to her stays behind when she goes
        me.hush();
        me.onMove?.();
        place(nx, ny);
        if (hop) replay('travel');
        await ctx.wait(ms);
      },
      // grows and swoops to a spot, for big entrances
      async zoomTo(nx, ny, px = size) {
        ctx.check();
        me.hush();
        me.onMove?.();
        Speech.tune('whoosh');
        root.classList.add('zoom');
        me.resize(px);
        place(nx, ny);
        replay('travel');
        await ctx.wait(850);
        root.classList.remove('zoom');
      },
      // runs in from the right edge in little hops
      async enter(nx, ny) {
        ctx.check();
        me.hush();
        root.style.transition = 'none';
        place(innerWidth + 40, ny, true);
        void root.offsetWidth;
        root.style.transition = '';
        root.classList.add('run');
        place(nx, ny);
        await ctx.wait(1050);
        root.classList.remove('run');
      },
      // voice: her normal one, or e.g. a deeper or squeakier one when she's been resized
      async say(text, { hold, shout, voice, speed } = {}) {
        ctx.check();
        const plain = text.replace(/\{[a-z]+\}/g, '');
        const loud = shout ?? (/[A-Z]{2}/.test(plain) && plain === plain.toUpperCase());
        const where = side === 'auto' ? (x + size + 320 > innerWidth ? 'left' : 'right') : side;
        bubble.hidden = false;
        bubble.classList.remove('pop', 'left', 'right', 'below', 'caption', 'shout', 'up');
        bubble.classList.add(where);
        bubble.classList.toggle('shout', loud);
        Mascot.speaker(her);
        Mascot.talking(true);
        const w = Speech.typewriter(root.querySelector('.actor-text'), text, {
          onWord: () => Mascot.hop(), onCue: Speech.cue, voice: voice || (loud ? Speech.shoutBlip : Speech.blip), speed: speed ?? (loud ? 21 : 27),
        });
        if (where === 'below' || where === 'caption') {
          // centred under her, but never out of the window; the tail keeps pointing at her
          bubble.style.setProperty('--shift', '0px');
          let r = bubble.getBoundingClientRect();
          // no room under her (she's near the bottom): her lines go above her instead
          if (r.bottom > innerHeight - 10) { bubble.classList.add('up'); r = bubble.getBoundingClientRect(); }
          let shift = Math.max(12 - r.left, Math.min(0, innerWidth - 12 - r.right));
          // and never on top of whatever she's showing you (white text on paper can't be read)
          const block = me.avoid?.();
          if (block && r.bottom > block.top && r.top < block.bottom && r.right + shift > block.left && r.left + shift < block.right) {
            const toLeft = block.left - 12 - (r.right + shift), toRight = block.right + 12 - (r.left + shift);
            shift += r.left + shift + toLeft >= 12 ? toLeft : toRight;
          }
          bubble.style.setProperty('--shift', `${Math.round(shift)}px`);
        }
        void bubble.offsetWidth;
        bubble.classList.add('pop');
        ctx.writers.add(w);
        try { await ctx.run(w.done); } finally { ctx.writers.delete(w); Mascot.talking(false); Mascot.speaker(null); }
        await ctx.wait(Speech.readTime(plain, hold));
      },
      hush() { bubble.hidden = true; },
      dress(outfit) { Mascot.dress(her, outfit); },
      // where she looks: [x, y] from -1 to 1, or null for the pointer
      look(at, slow = false) { Mascot.gaze(her, at, slow); },
      // looks at a point on screen
      lookAt(px, py, slow = false) {
        const c = me.center, dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) || 1;
        me.look([dx / d, (dy / d) * 0.9], slow);
      },
      trip() { replay('trip'); },
      // a spin in the air
      twirl() { replay('twirl'); },
      // a jump on the spot
      bounce() { replay('travel'); },
      // home to her corner: little hops over, then the corner copy takes over (handOff runs in that same frame, e.g.
      // to give the corner copy what she's wearing)
      async home({ handOff } = {}) {
        if (atHome) return;
        atHome = true;
        me.hush();
        me.onMove?.();
        Mascot.face(null);
        me.look(null);
        root.classList.remove('run', 'zoom', 'travel', 'trip');
        if (await Mascot.goHome(root, body)) Mascot.swap(() => { root.remove(); unsolo(); handOff?.(); });
        else { root.classList.add('fade'); await wait(300); root.remove(); unsolo(); }
      },
    };
    ctx.onEnd(() => me.home());
    return me;
  }

  // A blocker over the page while an event plays, so nothing gets clicked by accident.
  function stage(ctx, { dim = true } = {}) {
    const block = document.createElement('div');
    block.className = `gag-block${dim ? '' : ' clear'}`;
    document.body.appendChild(block);
    ctx.onEnd(async () => { block.classList.add('leaving'); await wait(380); block.remove(); });
    return block;
  }

  // ---------------------------------------------------------------------------
  // Her hands on the real app: a piece of it raised above the event's dim, so you see her mess with your actual
  // library or settings, and words on it swapped for a moment. Only what's on screen changes: nothing is renamed,
  // moved or saved, and all of it is put back when the event ends, however it ends.
  // ---------------------------------------------------------------------------
  function lift(ctx, el) {
    if (!el) return () => {};
    el.classList.add('ev-lifted');
    const drop = () => el.classList.remove('ev-lifted');
    ctx.onEnd(drop);
    return drop;
  }
  function borrowText(ctx, el, text) {
    if (!el) return () => {};
    const old = el.textContent;
    el.textContent = text;
    const back = () => { if (el.isConnected && el.textContent === text) el.textContent = old; };
    ctx.onEnd(back);
    return back;
  }
  // Settings for the event, from the library or Settings itself (never out of a clip you have open), and back to
  // the same page and spot afterwards.
  async function visitSettings(ctx) {
    const from = state.view;
    if (from !== 'library' && from !== 'settings') return null;
    const scroller = document.getElementById('settingsScroller');
    const top = from === 'settings' ? scroller.scrollTop : 0;
    ctx.onEnd(() => {
      if (from === 'library' && state.view === 'settings') showView('library');
      else if (state.view === 'settings') scroller.scrollTo({ top, behavior: 'smooth' });
    });
    if (from !== 'settings') await openSettings('replay');
    return state.view === 'settings' ? scroller : null;
  }

  // ---------------------------------------------------------------------------
  // Playing them
  // ---------------------------------------------------------------------------
  function skipButton(ctx) {
    const el = document.createElement('button');
    el.className = 'event-skip';
    el.innerHTML = 'Skip <kbd>Esc</kbd>';
    el.addEventListener('click', () => ctx.cancel());
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('in'), 700);
    return () => { el.classList.remove('in'); el.classList.add('leaving'); setTimeout(() => el.remove(), 400); };
  }

  async function play(id) {
    const def = defs.get(id);
    if (!def?.run || current) return false;
    const ctx = createCtx();
    current = { id, ctx };
    // whatever played by chance, the next surprise is days away: three days, plus up to two more
    if (!def.planned && !def.system) store.set('snappy.events.next', String(Date.now() + MIN_GAP + Math.random() * EXTRA_GAP));
    playedThisSession = true;
    undress();
    Speech.hush();
    window.Life?.wake();
    Mascot.reset();
    const hideSkip = def.quick ? null : skipButton(ctx);
    // the keyboard belongs to the event: Esc skips, everything else is ignored
    const onKey = (e) => {
      if (def.quick) { if (e.key === 'Escape') ctx.cancel(); return; }
      if (e.key === 'Escape') ctx.cancel();
      e.preventDefault();
      e.stopPropagation();
    };
    addEventListener('keydown', onKey, true);
    let finished = false;
    try {
      await def.run(ctx);
      finished = !ctx.cancelled;
    } catch (err) {
      if (err !== SKIP) console.error(err);
    }
    ctx.cancel(); // anything still running in the background stops at its next step
    removeEventListener('keydown', onKey, true);
    hideSkip?.();
    await ctx.teardown(!finished);
    Mascot.reset();
    current = null;
    if (finished && !def.system) achieve(id);
    wear();
    return finished;
  }

  // ---------------------------------------------------------------------------
  // Outfits: whatever she wore in an event is hers to wear every day once that event has been seen through
  // (Settings, Snappy, Outfit). She takes it off whenever something plays and puts it back on afterwards. On a special
  // day she dresses up for it by herself, unless she's already wearing something.
  //   Events.outfit(id, { name, markup, from, day() })
  // ---------------------------------------------------------------------------
  const outfits = new Map();
  let wearing = null;
  // from: the event (or events) that unlock it
  const owned = (o) => !o.from || [o.from].flat().some(has);
  const slot = () => document.getElementById('mascot');
  function wear() {
    if (current || !slot()?.querySelector('.m-talk')) return;
    const picked = outfits.get(state.settings?.mascotOutfit);
    const o = picked && owned(picked) ? picked : [...outfits.values()].find((x) => x.day?.()) || null;
    if ((o?.id || null) === wearing) return;
    wearing = o?.id || null;
    Mascot.dress(slot(), o?.markup || null);
  }
  function undress() {
    if (!wearing) return;
    wearing = null;
    Mascot.dress(slot(), null);
  }
  // an event that ends with her walking home in something: the corner copy takes it over as it is (no popping off and
  // on again), and keeps it if it's what she'd wear anyway
  function wearNow(id) {
    const o = outfits.get(id);
    if (!o) return;
    Mascot.dress(slot(), o.markup, true);
    wearing = id;
  }
  // on the morning of a special day, or after a change in Settings
  setInterval(wear, 2000);

  // ---------------------------------------------------------------------------
  // Achievements: a Steam-style pop-up in the corner, and a window with all of them
  // ---------------------------------------------------------------------------
  const medal = (tier, locked) => `<svg class="ach-medal ${tier}${locked ? ' locked' : ''}" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="21" class="ach-medal-ring"/><circle cx="24" cy="24" r="15.5" class="ach-medal-core"/>
    ${locked ? '<path d="M20 20.5a4 4 0 1 1 5.6 3.7c-1.1.5-1.6 1.2-1.6 2.3v.8M24 31v.4" class="ach-medal-q"/>'
      : '<path d="M24 14.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L24 29.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" class="ach-medal-star"/>'}</svg>`;

  const toasts = [];
  let toasting = false;
  function showToast(def) {
    toasts.push(def);
    if (!toasting) nextToast();
  }
  async function nextToast() {
    toasting = true;
    // not in the middle of something she's doing
    while (current && !defs.get(current.id)?.quick) await wait(500);
    const def = toasts.shift();
    if (!def) { toasting = false; return; }
    const all = shown();
    const count = all.filter((d) => has(d.id)).length;
    const el = document.createElement('button');
    el.className = `ach-toast ${def.tier}`;
    el.innerHTML = `${medal(def.tier)}<div class="ach-toast-text"><div class="ach-kicker">Achievement unlocked</div>
      <div class="ach-title">${esc(def.title)}</div><div class="ach-sub">${TIERS[def.tier].name} · ${count} of ${all.length}</div></div>`;
    el.addEventListener('click', () => { el.classList.add('leaving'); list(); });
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('in');
    Speech.tune('chime');
    await wait(5600);
    el.classList.add('leaving');
    await wait(500);
    el.remove();
    await wait(250);
    nextToast();
  }

  // Achievements someone can't ever get (e.g. Early Bird on a fresh install) aren't listed for them at all.
  const shown = () => [...defs.values()].filter((d) => !d.system && (has(d.id) || !d.hidden?.()));

  function achieve(id) {
    const def = defs.get(id);
    if (!def || def.system || has(id)) return false;
    store.set(`snappy.ach.${id}`, '1');
    setTimeout(() => showToast(def), def.run && !def.quick ? 650 : 1300);
    return true;
  }

  function list() {
    if (document.querySelector('.ach-backdrop')) return;
    const all = shown();
    const count = all.filter((d) => has(d.id)).length;
    const root = document.createElement('div');
    root.className = 'modal-backdrop ach-backdrop';
    const groups = Object.entries(TIERS).map(([tier, t]) => {
      const items = all.filter((d) => d.tier === tier);
      if (!items.length) return '';
      const got = items.filter((d) => has(d.id)).length;
      return `<section class="ach-group ${tier}"><h4><span class="ach-dot"></span>${esc(t.group)}<em>${t.name} · ${got} of ${items.length}</em></h4>
        <div class="ach-grid">${items.map((d) => has(d.id)
          ? `<div class="ach-card">${medal(tier)}<div class="ach-card-text"><div class="ach-card-title">${esc(d.title)}</div><div class="ach-card-hint">${esc(d.hint)}</div></div>
              ${d.run || d.replay ? `<button class="btn ghost" data-replay="${d.id}">Replay</button>` : ''}</div>`
          : `<div class="ach-card locked">${medal(tier, true)}<div class="ach-card-text"><div class="ach-card-title">???</div><div class="ach-card-hint">${esc(d.hint)}</div></div></div>`).join('')}</div></section>`;
    }).join('');
    root.innerHTML = `<div class="modal ach">
      <div class="ach-head"><div><h3>Achievements</h3><p>${count ? `${count} of ${all.length} unlocked.` : 'Nothing unlocked yet.'} ${count === all.length ? 'You found them all!' : 'Keep her company and see what happens.'}</p></div>
        <div class="ach-progress"><i style="width:${(count / all.length) * 100}%"></i></div></div>
      <div class="ach-scroll">${groups}</div>
      <div class="modal-actions"><button class="btn" data-close>Close</button></div>
    </div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      const replay = e.target.closest('[data-replay]');
      if (replay) {
        close();
        const def = defs.get(replay.dataset.replay);
        setTimeout(() => (def.replay ? def.replay() : play(def.id)), 350);
        return;
      }
      if (e.target === root || e.target.closest('[data-close]')) close();
    });
  }

  // ---------------------------------------------------------------------------
  // When they happen: rarely. They are little treats, never the point of the app, so:
  //   nothing in the first two days, days between any two, only after a few minutes of using the app,
  //   only while you're idle in the window, at most one per session, and even then only by chance.
  // ---------------------------------------------------------------------------
  const MIN_GAP = 3 * 24 * 3600e3, EXTRA_GAP = 2 * 24 * 3600e3;
  const FIRST_DAYS = 2 * 24 * 3600e3;
  const SETTLE = 4 * 60e3;
  let playedThisSession = false, usedMs = 0;
  if (!store.get('snappy.firstSeen')) store.set('snappy.firstSeen', String(Date.now()));
  // time actually spent in the app this session (window in front)
  setInterval(() => { if (document.hasFocus() && !document.hidden) usedMs += 5000; }, 5000);
  let lastInput = Date.now();
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  const calm = () => !current && !window.Tour?.active && !Work.busy && !Speech.talking && document.hasFocus() && !document.hidden
    && !document.querySelector('.modal-backdrop:not([hidden])') && !(state.view === 'player' && !document.getElementById('video')?.paused);
  const allowed = () => Events.enabled && Speech.enabled && !playedThisSession
    && Date.now() >= Number(store.get('snappy.events.next') || 0)
    && Date.now() - Number(store.get('snappy.firstSeen') || Date.now()) > FIRST_DAYS;
  const opens = Number(store.get('snappy.opens') || 0) + 1;
  store.set('snappy.opens', String(opens));

  setInterval(() => {
    if (usedMs < SETTLE || !allowed() || !calm()) return;
    const idle = Date.now() - lastInput;
    if (idle < 8000 || idle > 180000 || Math.random() > 0.02) return;
    const pool = [...defs.values()].filter((d) => d.run && d.weight && (!d.after || d.after.every(has)) && (!d.when || d.when()));
    const fresh = pool.filter((d) => !has(d.id));
    const rematch = pool.filter((d) => d.again && has(d.id));
    let from = fresh;
    if (fresh.length && rematch.length && Math.random() < 0.15) from = rematch;
    else if (!fresh.length) from = Math.random() < 0.25 ? pool.filter((d) => d.tier !== 'game' || d.again) : [];
    let roll = Math.random() * from.reduce((n, d) => n + d.weight, 0);
    const pick = from.find((d) => (roll -= d.weight) < 0);
    if (pick?.invite) invite(pick);
    else if (pick) play(pick.id);
  }, 30000);

  // Some games are better asked about than started. Asking counts as her surprise for the next few days.
  function invite(def) {
    store.set('snappy.events.next', String(Date.now() + MIN_GAP + Math.random() * EXTRA_GAP));
    playedThisSession = true;
    Speech.say(def.invite, {
      kind: 'news', key: 'invite',
      actions: [{ label: 'Play', fn: () => play(def.id) }, { label: 'Not now', fn: () => Speech.say('{wink}Okay! {pause}Some other time.', { kind: 'news' }) }],
    });
  }

  // Nothing playing, nobody talking: she's back to her plain self, whatever was left over.
  setInterval(() => {
    if (current || window.Tour?.active || Speech.talking || Work.busy || document.querySelector('.work-float.in, .stage-busy.in')) return;
    if (Mascot.expression || Mascot.isTalking) Mascot.reset();
  }, 1200);

  // up up down down left right left right B A, on the Settings page: unlocks the Achievements button
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konami = 0;
  addEventListener('keydown', (e) => {
    if (state.view !== 'settings' || e.target.closest?.('input, textarea, select')) { konami = 0; return; }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
    if (konami < KONAMI.length) return;
    konami = 0;
    Mascot.flash('happy', 1150);
    const first = !Events.unlocked;
    store.set('snappy.ach.button', '1');
    if (first) renderSettings();
    achieve('konami');
    list();
  });

  window.Events = {
    enabled: true,
    define(id, def) { defs.set(id, { id, tier: 'common', ...def }); },
    play, achieve, list, has, calm,
    get count() { return [...defs.values()].filter((d) => !d.system && has(d.id)).length; },
    outfit(id, def) { outfits.set(id, { id, ...def }); },
    // the outfits she has, for Settings
    get outfits() { return [...outfits.values()].filter(owned); },
    wear, wearNow,
    actor, cursor, stage, lift, borrowText, visitSettings,
    // an event that isn't due yet, or isn't allowed right now, doesn't start
    ready: (id) => allowed() && !has(id) && calm(),
    get unlocked() { return store.get('snappy.ach.button') === '1'; },
    get running() { return current?.id || null; },
    SKIP,
  };
})();
