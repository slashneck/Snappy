// The wardrobe: click her name in the corner and she jumps out onto a stage, with everything she has found
// on the racks beside her: outfits and skins, aftermaths, achievements, and the show's backgrounds once Claude has
// made them. Click something she has and she twirls into it; something still locked shows a lock and only its outline
// (a rare skin not even that). Leaving, she jumps back to her corner.
(() => {
  const view = document.getElementById('wardrobeView');
  if (!view) return;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const TABS = [['outfits', 'Outfits'], ['aftermaths', 'Aftermaths'], ['achievements', 'Achievements'], ['backgrounds', 'Backgrounds']];
  // the show's stills (media/wallpapers; LibraryWindow's wallpapers.saveAs saves one where the person picks)
  const WALLS = [['Kawaii', 'kawaii'], ['Pour femme', 'perfume'], ['Flash intro', 'flash'], ['End card', 'endcard'], ['Graffiti wall', 'wall'],
    ['CRT wall', 'crt'], ['Styles', 'styles']];
  const LOCK = '<svg class="wr-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>';
  let tab = 'outfits', open = false, busy = false;
  let box = null, body = null, her = null, unsolo = null, back = 'library';
  const corner = () => document.getElementById('mascot');
  const hasWalls = () => Events.has('cutcontent');
  const isRare = (o) => !!(o?.skin || o?.rare);
  // what's on: a check when it's kept, a "Today" tag when it only lasts until midnight
  const onMark = (kept) => (kept ? `<span class="wr-on">${CHECK}</span>` : '<span class="wr-today">Today</span>');

  // ---------------------------------------------------------------------------
  // The page
  // ---------------------------------------------------------------------------
  function render() {
    const tabs = TABS.filter(([id]) => id !== 'backgrounds' || hasWalls());
    if (!tabs.some(([id]) => id === tab)) tab = 'outfits';
    view.innerHTML = `<header class="toolbar"><div class="title-block"><h1>Wardrobe</h1><div class="subtitle">Everything she has found, ready to wear.</div></div>
      <div class="spacer"></div><button class="btn ghost" data-wr="done">Done</button></header>
      <div class="wd">
        <div class="wr-stage"><div class="wr-glow"></div><div class="wr-spot"><i class="wr-shadow"></i></div><div class="wr-sparks"></div>
          <div class="wr-caption"><span class="wr-rarity"></span><div class="wr-wearing"></div><div class="wr-note"></div></div></div>
        <div class="wr-side">
          <div class="wr-tabs" role="tablist">${tabs.map(([id, label]) => `<button class="wr-tab${id === tab ? ' on' : ''}" role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
          <div class="wr-panel"></div>
        </div>
      </div>`;
    panel();
    caption();
  }

  // what she has on, at the bottom of the stage, the way a game's locker shows it
  function caption() {
    const id = Events.wearing;
    const o = id && Events.wardrobe.find((x) => x.id === id);
    const stage = view.querySelector('.wr-stage');
    if (!stage) return;
    stage.classList.toggle('rare', isRare(o));
    view.querySelector('.wr-rarity').textContent = !o ? 'Classic' : o.skin ? 'Rare skin' : o.rare ? 'Rare' : 'Outfit';
    view.querySelector('.wr-wearing').textContent = o ? o.name : 'Just her';
    view.querySelector('.wr-note').textContent = o?.skin === '3d' ? 'Grab her and give her a spin.'
      : !state.settings?.mascotOutfit && o ? 'Her own pick for today.' : 'Click her. She likes it.';
  }

  // (keep: after picking something, stay where you were in the list)
  function panel(keep = false) {
    const el = view.querySelector('.wr-panel');
    if (!el) return;
    const at = el.scrollTop;
    el.innerHTML = tab === 'outfits' ? outfits() : tab === 'aftermaths' ? aftermaths() : tab === 'achievements' ? achievements() : backgrounds();
    // the pictures: her, still, in each thing (a locked one's outline; a secret one only her own)
    for (const pic of el.querySelectorAll('[data-pic]')) Mascot.picture(pic, pic.dataset.pic ? Events.markup(pic.dataset.pic) : null);
    el.scrollTop = keep ? at : 0;
  }

  // ----- outfits and skins
  function outfits() {
    const all = Events.wardrobe;
    const on = Events.wearing || '';
    const have = all.filter((o) => o.owned);
    const not = all.filter((o) => !o.owned).sort((a, b) => !!a.secret - !!b.secret);
    const tile = (o) => {
      const rare = isRare(o);
      if (!o.owned) {
        return `<button class="wr-tile locked${rare ? ' rare' : ''}" data-locked="${esc(o.hint)}">
          <div class="wr-pic${o.secret ? ' secret' : ''}" data-pic="${o.secret ? '' : esc(o.id)}"></div>${LOCK}
          <span class="wr-name">${o.secret ? 'A rare look' : '???'}</span></button>`;
      }
      // on: whatever she has on, picked or only for today (that one says so)
      const worn = o.id === on;
      return `<button class="wr-tile${rare ? ' rare' : ''}${worn ? ' on' : ''}" data-outfit="${esc(o.id)}">
        <div class="wr-pic" data-pic="${esc(o.id)}"></div><span class="wr-name">${esc(o.name)}</span>${worn ? onMark(o.id === picked) : ''}</button>`;
    };
    const picked = state.settings?.mascotOutfit || '';
    // her plain self first, on its own: picking it takes off whatever she has on
    const plain = `<div class="wr-grid wr-default"><button class="wr-tile${on ? '' : ' on'}" data-outfit="none"><div class="wr-pic" data-pic=""></div>
      <span class="wr-name">Just her</span>${on ? '' : onMark(true)}</button></div>`;
    const section = (title, items) => (items.length ? `<h3 class="wr-h">${title}</h3><div class="wr-grid">${items.map(tile).join('')}</div>` : '');
    return `<p class="wr-count">${have.length} of ${all.length} found.</p>${plain}
      ${section('Outfits', have.filter((o) => !isRare(o)))}${section('Rare', have.filter(isRare))}${section('Still to find', not)}`;
  }

  // ----- aftermaths: what an event leaves behind in the app, each shown on a little copy of her corner
  function corner_(m) {
    const at = (sel) => (m.marks || []).filter((k) => k.at === sel).map((k) => `<i class="af-mark ${k.cls} in" aria-hidden="true">${k.html || ''}</i>`).join('');
    const other = (m.marks || []).filter((k) => !['.brand', '.brand-name'].includes(k.at));
    const where = (sel) => other.some((k) => k.at === sel);
    return `<div class="wr-mock${m.cls ? ` ${m.cls}` : ''}">
      <div class="brand"><div class="wr-mock-her" data-pic=""></div><div class="brand-text"><div class="brand-name">${esc(m.name || 'Snappy')}${at('.brand-name')}</div>
        ${m.tag ? `<div class="af-tags"><span class="af-tag in${m.tone ? ` ${m.tone}` : ''}">${esc(m.tag)}</span></div>` : '<div class="wr-mock-rec"><i></i>Recording</div>'}</div>${at('.brand')}</div>
      ${where('#libraryView .title-block') ? `<div class="wr-mock-title">All clips${at('#libraryView .title-block')}</div>` : ''}
      ${where('.save-clip') ? `<div class="wr-mock-save">Save clip${at('.save-clip')}</div>` : ''}
      ${where('.sidebar-foot') ? `<div class="wr-mock-foot">${at('.sidebar-foot')}</div>` : ''}
      ${where('body') ? `<div class="wr-mock-body">${at('body')}</div>` : ''}</div>`;
  }
  function aftermaths() {
    const pick = state.settings?.mascotAftermath || '';
    const all = Events.allAftermaths;
    // on: whatever is showing right now, kept for good or only until midnight (that one says so)
    const shown = Events.aftermathsOn;
    // (not buttons: a preview can hold a button of its own, like the scream button, and buttons can't nest)
    const card = (value, title, sub, preview, on, kept) => `<div class="wr-card${on ? ' on' : ''}" role="button" tabindex="0" data-after="${esc(value)}">
      <div class="wr-af">${preview}</div><div class="wr-card-text"><b>${esc(title)}</b><span>${esc(sub)}</span></div>${on ? onMark(kept) : ''}</div>`;
    return `<p class="wr-count">Some events leave a little something behind until midnight. Pick one to keep for good.</p>
      <div class="wr-list">
        ${card('off', 'Just Snappy', 'Nothing left behind.', corner_({}), !shown.length, true)}
        ${all.map((m) => (m.owned ? card(m.id, m.label, m.from ? `From "${m.from}"` : '', corner_(m), shown.includes(m.id), pick === m.id)
          : `<div class="wr-card locked" role="button" tabindex="0" data-locked="${esc(m.hint)}"><div class="wr-af wr-af-locked">${LOCK}</div><div class="wr-card-text"><b>???</b><span>${esc(m.hint)}</span></div></div>`)).join('')}
      </div>`;
  }

  // ----- achievements (the same as their window)
  function achievements() {
    const a = Events.achievements();
    return `<div class="wr-ach-head"><p class="wr-count">${a.count ? `${a.count} of ${a.total} unlocked.` : 'Nothing unlocked yet.'}</p>
      <div class="ach-progress"><i style="width:${(a.count / Math.max(1, a.total)) * 100}%"></i></div></div><div class="wr-ach">${a.html}</div>`;
  }

  // ----- the show's backgrounds: each for a desktop and a phone
  const wallSrc = (title, kind) => `media/wallpapers/${encodeURIComponent(`${title} (${kind}).jpg`)}`;
  function backgrounds() {
    return `<div class="wr-walls-head"><p class="wr-count">Stills from her show, for a desktop and for a phone. Open one to save it.</p></div>
      <div class="wr-walls">${WALLS.map(([title, key], i) => `<button class="wr-wall" data-wall="${i}">
        <span class="wr-wall-pics"><img class="wr-wall-desk" alt="" loading="lazy" src="media/wallpapers/thumbs/${key}.jpg">
          <img class="wr-wall-phone" alt="" loading="lazy" src="media/wallpapers/thumbs/${key}-phone.jpg"></span>
        <span class="wr-wall-name">${esc(title)}</span></button>`).join('')}</div>`;
  }
  // a viewer for them: one at a time, desktop or phone, arrows to go through them
  function viewer(start) {
    let i = start, kind = 'desktop';
    const el = document.createElement('div');
    el.className = 'modal-backdrop wr-viewer';
    const draw = () => {
      const [title] = WALLS[i];
      el.innerHTML = `<div class="wr-v">
        <div class="wr-v-bar"><b>${esc(title)}</b><span class="wr-v-count">${i + 1} / ${WALLS.length}</span>
          <div class="wr-tabs wr-v-kind"><button class="wr-tab${kind === 'desktop' ? ' on' : ''}" data-kind="desktop">Desktop</button><button class="wr-tab${kind === 'phone' ? ' on' : ''}" data-kind="phone">Phone</button></div>
          <button class="btn" data-v="save">Save picture</button><button class="btn ghost" data-v="close">Close</button></div>
        <div class="wr-v-pic ${kind}"><button class="wr-v-nav" data-nav="-1" aria-label="Previous">&#8249;</button><img alt="" src="${wallSrc(title, kind)}"><button class="wr-v-nav" data-nav="1" aria-label="Next">&#8250;</button></div></div>`;
    };
    const go = (d) => { i = (i + d + WALLS.length) % WALLS.length; draw(); };
    const close = () => { el.remove(); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { go(Number(nav.dataset.nav)); return; }
      const k = e.target.closest('[data-kind]');
      if (k) { kind = k.dataset.kind; draw(); return; }
      if (e.target.closest('[data-v="save"]')) { save(`${WALLS[i][0]} (${kind}).jpg`); return; }
      if (e.target === el || e.target.closest('[data-v="close"]')) close();
    });
    addEventListener('keydown', onKey, true);
    draw();
    document.body.appendChild(el);
  }

  // ---------------------------------------------------------------------------
  // Trying things on: a twirl, and halfway round (side on) she's in the new thing, swapped in one go
  // ---------------------------------------------------------------------------
  async function wear(id) {
    if (busy || !her) return;
    busy = true;
    const b = body;
    try {
      sparks();
      b.classList.remove('wr-twirl');
      void b.offsetWidth;
      b.classList.add('wr-twirl');
      await wait(270);
      if (her) Mascot.dress(her, id === 'none' ? null : Events.markup(id), true);
      Events.pickedNow();
      await saveSettings((s) => { s.mascotOutfit = id; });
      await wait(350);
    } finally {
      b.classList.remove('wr-twirl');
      busy = false;
    }
    if (!open) return;
    if (tab === 'outfits') panel(true);
    caption();
    Talk.settingChanged('mascotOutfit', id === 'none' ? '' : id);
  }
  function sparks() {
    const host = view.querySelector('.wr-sparks');
    if (!host) return;
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('i');
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      s.style.setProperty('--x', `${Math.cos(a) * (90 + Math.random() * 40)}px`);
      s.style.setProperty('--y', `${Math.sin(a) * (60 + Math.random() * 30) - 30}px`);
      s.style.animationDelay = `${Math.random() * 120}ms`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }
  async function pickAftermath(value) {
    await saveSettings((s) => { s.mascotAftermath = value || null; });
    Events.remark(true);
    Talk.settingChanged('mascotAftermath', value);
    panel(true);
  }
  // a locked one: a little shake, and its hint
  function nope(el) {
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
    const hint = el.dataset.locked;
    if (hint) toast({ title: 'Not found yet', sub: hint });
  }

  view.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; view.querySelectorAll('.wr-tab').forEach((b) => b.classList.toggle('on', b === t)); panel(); return; }
    const locked = e.target.closest('.locked');
    if (locked) { nope(locked); return; }
    const o = e.target.closest('[data-outfit]');
    if (o) { if (!o.classList.contains('on')) wear(o.dataset.outfit); return; }
    const af = e.target.closest('[data-after]');
    if (af) { pickAftermath(af.dataset.after); return; }
    const wall = e.target.closest('[data-wall]');
    if (wall) { viewer(Number(wall.dataset.wall)); return; }
    const replay = e.target.closest('[data-replay]');
    if (replay) { const id = replay.dataset.replay; close().then(() => setTimeout(() => Events.replay(id), 300)); return; }
    const act = e.target.closest('[data-wr]')?.dataset.wr;
    if (act === 'done') close();
  });
  // one picture, wherever the person wants it (a save dialog; nothing is put anywhere on its own)
  async function save(file) {
    const ok = await snappy.call('wallpapers.saveAs', { file }).catch(() => false);
    if (ok) toast({ kind: 'success', title: 'Picture saved' });
  }

  // ---------------------------------------------------------------------------
  // Her: out of the corner onto the stage, and back
  // ---------------------------------------------------------------------------
  const spot = () => view.querySelector('.wr-spot')?.getBoundingClientRect();
  const place = (r) => Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  function relayout() {
    const r = spot();
    if (box && r?.width && open) place(r);
  }
  // Between her corner and the stage in one jump: she grows (or shrinks) on the way along a low arc, never above the
  // window's top. The box sits on the stage the whole time; the jump is a transform from the corner, no turning.
  function jump(corner, out, to) {
    const k = corner.width / to.width;
    const dx = corner.left - to.left, dy = corner.top - to.top;
    const frames = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const e = out ? t * t * (3 - 2 * t) : 1 - (1 - t) ** 3;    // out: ease in and out; in: a quick start, a soft landing
      const u = out ? e : 1 - e;                                 // 1 in the corner, 0 on the stage
      const y = dy * u - Math.min(48, to.top + dy * u - 8) * Math.sin(u * Math.PI);
      frames.push({ transform: `translate(${dx * u}px, ${y}px) scale(${1 + (k - 1) * u})`, offset: t });
    }
    box.style.transformOrigin = '0 0';
    return box.animate(frames, { duration: out ? 460 : 560, easing: 'linear', fill: 'forwards' }).finished;
  }
  function squash(cls) {
    body.classList.remove('wr-land', 'wr-crouch');
    void body.offsetWidth;
    body.classList.add(cls);
  }

  // (t: the tab to open on)
  async function show(t) {
    if (open) { if (t && t !== tab) { tab = t; render(); } return; }
    if (t) tab = t;
    if (!ready()) return;
    open = true;
    busy = false;
    back = ['library', 'settings', 'studio'].includes(state.view) ? state.view : 'library';
    hideMenu();
    stopPreview();
    if (state.view === 'player') closePlayer(false);
    showView('wardrobe');
    render();
    box = document.createElement('div');
    box.className = 'wr-snappy';
    box.innerHTML = '<div class="wr-body"><div class="wr-her"></div></div>';
    body = box.firstChild;
    her = body.firstChild;
    document.body.appendChild(box);
    Mascot.mount(her);
    Events.dressCopy(her);
    window.Skins?.spinnable(her);
    const from = corner()?.getBoundingClientRect(), to = spot();
    place(to);
    addEventListener('resize', relayout);
    view.addEventListener('scroll', relayout, true);
    // she takes over from the corner in the same frame, so there's only ever one of her
    if (from?.width) {
      box.style.transformOrigin = '0 0';
      box.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`;
    }
    Mascot.swap(() => { unsolo = Mascot.solo(her); });
    if (from?.width) {
      squash('wr-crouch');
      await wait(110);
      body.classList.remove('wr-crouch');
      const flight = jump(from, false, to);
      box.style.transform = '';
      await flight;
    }
    squash('wr-land');
  }

  // back to the corner; `to` is the view to show instead (none when another view is already taking over)
  async function close(to = back) {
    if (!open) return;
    open = false;
    removeEventListener('resize', relayout);
    view.removeEventListener('scroll', relayout, true);
    const b = box, un = unsolo, home = corner()?.getBoundingClientRect(), from = b?.getBoundingClientRect();
    if (to && state.view === 'wardrobe') showView(to);
    view.innerHTML = '';
    if (b && home?.width && from?.width) {
      squash('wr-crouch');
      await wait(90);
      body.classList.remove('wr-crouch');
      await jump(home, true, from);
    }
    box = body = her = unsolo = null;
    Mascot.swap(() => { b?.remove(); un?.(); });
  }

  // her name opens it (clicking her is for petting her)
  document.querySelector('.brand-name')?.addEventListener('click', () => (open ? close() : show()));
  addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape' && !document.querySelector('.modal-backdrop')) { e.preventDefault(); close(); }
  });
  // (the aftermath cards aren't buttons, so Enter and Space press them here)
  view.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.wr-card')) { e.preventDefault(); e.target.click(); }
  });

  // (not while something's playing, a tour's on, or another big her is out)
  const ready = () => !Events.running && !window.Tour?.active && !document.documentElement.classList.contains('snappy-solo');
  window.Wardrobe = { show, close, ready, get open() { return open; } };
})();
