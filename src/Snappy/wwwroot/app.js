'use strict';

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const state = {
  library: { root: '', folders: [], clips: [] },
  settings: null,
  status: null,
  options: null,
  version: '',
  view: 'library',
  folder: '*',
  search: '',
  sort: 'newest',
  selecting: false,
  selected: new Set(),
  anchor: null,
  newIds: new Set(),
  current: null,
  trim: { start: 0, end: 0, touched: false },
  trimMode: 'fast',
  busy: false,
  mutating: false,
};

const byId = (id) => state.library.clips.find((c) => c.id === id);
const folderLabel = (f) => (f === '*' ? 'All clips' : f === '' ? 'Unsorted' : f === 'fav' ? 'Favorites' : f);
const inFolderFilter = (c) => state.folder === '*' || (state.folder === 'fav' ? c.favorite : c.folder === state.folder);
const setTask = (task) => { document.body.dataset.task = task || ''; }; // hook for the animated mascot (phase 3)

// ---------- formatting ----------
function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTime(sec) {
  sec = Math.max(0, sec || 0);
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(2).padStart(5, '0')}`;
}
function fmtSize(b) {
  if (b >= 1e9) return `${(b / 1073741824).toFixed(1)} GB`;
  if (b >= 1048576) return `${Math.round(b / 1048576)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
const fmtSeconds = (s) => (s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}m ${s % 60}s`);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function dayLabel(date) {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
const fmtWhen = (date) => `${dayLabel(date)}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
const ENCODER_LABELS = {
  h264_nvenc: 'NVIDIA NVENC · H.264', hevc_nvenc: 'NVIDIA NVENC · HEVC', av1_nvenc: 'NVIDIA NVENC · AV1',
  h264_amf: 'AMD AMF · H.264', hevc_amf: 'AMD AMF · HEVC', libx264: 'CPU · x264 (heavier)',
};
const encoderLabel = (id) => ENCODER_LABELS[id] || id;

// ---------- toasts, menus, modals ----------
function toast({ title, sub = '', kind = 'info', action = null, timeout = 4200 }) {
  if (kind === 'error') Mascot.flash('error', 2000);
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="toast-icon">${icon(kind === 'error' ? 'warn' : kind === 'success' ? 'check' : 'bolt')}</div>
    <div class="toast-text"><div class="toast-title">${esc(title)}</div>${sub ? `<div class="toast-sub">${esc(sub)}</div>` : ''}</div>
    ${action ? `<button class="link-btn">${esc(action.label)}</button>` : ''}`;
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (action) el.querySelector('.link-btn').onclick = () => { action.fn(); dismiss(); };
  host.appendChild(el);
  setTimeout(dismiss, timeout);
  while (host.children.length > 4) host.firstElementChild.remove();
}

function showMenu(x, y, items) {
  const m = $('#menu');
  m.innerHTML = items.map((it, i) => {
    if (it.sep) return '<div class="menu-sep"></div>';
    if (it.heading) return `<div class="menu-label">${esc(it.heading)}</div>`;
    return `<button class="menu-item${it.danger ? ' danger' : ''}${it.current ? ' current' : ''}" data-i="${i}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.current ? icon('check') : ''}</button>`;
  }).join('');
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = `${clamp(x, 8, innerWidth - r.width - 8)}px`;
  m.style.top = `${y + r.height > innerHeight - 8 ? Math.max(8, y - r.height) : y}px`;
  m.onclick = (e) => {
    const b = e.target.closest('.menu-item');
    if (!b) return;
    hideMenu();
    items[Number(b.dataset.i)].action?.();
  };
}
const hideMenu = () => { $('#menu').hidden = true; };

function modal({ title, text = '', input = null, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const root = $('#modal'), inp = $('#modalInput'), okBtn = $('#modalOk'), cancelBtn = $('#modalCancel');
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    $('#modalText').hidden = !text;
    inp.hidden = input === null;
    inp.value = input ?? '';
    okBtn.textContent = ok;
    okBtn.className = danger ? 'btn danger' : 'btn';
    root.hidden = false;
    setTimeout(() => (input !== null ? (inp.focus(), inp.select()) : okBtn.focus()), 0);
    const finish = (confirmed) => {
      root.hidden = true;
      root.removeEventListener('keydown', onKey);
      okBtn.onclick = cancelBtn.onclick = root.onmousedown = null;
      resolve(input !== null ? (confirmed ? inp.value.trim() || null : null) : confirmed);
    };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      e.stopPropagation();
    };
    root.addEventListener('keydown', onKey);
    okBtn.onclick = () => finish(true);
    cancelBtn.onclick = () => finish(false);
    root.onmousedown = (e) => { if (e.target === root) finish(false); };
  });
}

// ---------- status ----------
function applyStatus(st) {
  if (!st) return;
  state.status = st;
  Mascot.setBase({ recording: 'recording', paused: 'paused', starting: 'starting', problem: 'problem' }[st.state] || 'idle');
  const el = $('#recStatus');
  el.dataset.state = st.state;
  el.querySelector('.rec-text').textContent =
    { recording: 'Recording', paused: 'Paused · click to resume', starting: 'Starting…', problem: 'Capture issue · retrying' }[st.state] || st.text;
  el.title = st.state === 'paused' ? 'Click to resume recording' : `${st.text}\nClick to pause`;
  const ratio = st.bufferSeconds ? clamp(st.bufferedSeconds / st.bufferSeconds, 0, 1) : 0;
  $('#bufferFill').style.width = `${st.state === 'paused' ? 0 : ratio * 100}%`;
  $('#bufferText').textContent = st.state === 'paused'
    ? 'Replay buffer paused'
    : `${fmtDuration(st.bufferedSeconds)} of ${fmtSeconds(st.bufferSeconds)} ready`;
  $('#memText').textContent = st.memoryMb >= 1 ? `${Math.round(st.memoryMb)} MB RAM` : '';
  const w = $('#warnings');
  w.hidden = !st.warnings?.length;
  if (st.warnings?.length) w.innerHTML = `${icon('warn')}<div>${st.warnings.map(esc).join('<br>')}</div>`;
  $('#saveClipBtn').classList.toggle('busy', !!st.saving);
}

function hotkeyLabel(hk) {
  if (!hk || !hk.key || hk.key === 'None') return 'None';
  const parts = [];
  if (hk.ctrl) parts.push('Ctrl');
  if (hk.alt) parts.push('Alt');
  if (hk.shift) parts.push('Shift');
  if (hk.win) parts.push('Win');
  parts.push(displayKey(hk.key));
  return parts.join(' + ');
}

function applySettingsToChrome() {
  const s = state.settings;
  state.trimMode = s.trimMode || 'fast';
  $('#saveHotkey').textContent = hotkeyLabel(s.saveClipHotkey);
  $('#saveHotkey').hidden = !s.saveClipHotkey || s.saveClipHotkey.key === 'None';
  $('#saveClipBtn').title = `Save the last ${fmtSeconds(s.bufferSeconds)}`;
}

// ---------- library ----------
function setLibrary(lib) {
  lib.clips.forEach((c) => { c.date = new Date(c.created); });
  state.library = lib;
  if (!['*', '', 'fav'].includes(state.folder) && !lib.folders.some((f) => f.name === state.folder)) state.folder = '*';
  for (const id of [...state.selected]) if (!byId(id)) state.selected.delete(id);
  if (state.current) {
    const cur = byId(state.current.id);
    if (cur) { state.current = cur; renderClipMeta(); }
    else if (state.view === 'player' && !state.mutating && !state.busy) closePlayer();
  }
  renderSidebar();
  if (state.view === 'library') renderGrid();
}

async function refreshLibrary() {
  try { setLibrary(await snappy.call('library.scan')); }
  catch (err) { console.error(err); }
}

function renderSidebar() {
  const clips = state.library.clips;
  $('[data-count="*"]').textContent = clips.length || '';
  $('[data-count=""]').textContent = clips.filter((c) => !c.folder).length || '';
  $('[data-count="fav"]').textContent = clips.filter((c) => c.favorite).length || '';
  $('#folderList').innerHTML = state.library.folders.map((f) => `
    <button class="nav-item" data-folder="${esc(f.name)}" title="${esc(f.name)}">
      <span class="folder-avatar">${esc(f.name.slice(0, 1).toUpperCase())}</span>
      <span class="nav-label">${esc(f.name)}</span><span class="count">${f.count || ''}</span>
    </button>`).join('');
  markActiveNav();
}

function markActiveNav() {
  $$('.nav-item').forEach((b) => {
    const active = b.dataset.view
      ? state.view === b.dataset.view
      : !['settings', 'studio'].includes(state.view) && b.dataset.folder === state.folder;
    b.classList.toggle('active', active);
  });
}

function visibleClips() {
  const q = state.search.trim().toLowerCase();
  let list = state.library.clips.filter(inFolderFilter);
  if (q) list = list.filter((c) => c.title.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q));
  const sorters = {
    newest: (a, b) => b.date - a.date,
    oldest: (a, b) => a.date - b.date,
    longest: (a, b) => b.duration - a.duration,
    largest: (a, b) => b.size - a.size,
    name: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }),
  };
  return list.sort(sorters[state.sort]);
}

function cardHtml(c) {
  const classes = ['card'];
  if (state.selected.has(c.id)) classes.push('selected');
  if (state.newIds.has(c.id)) classes.push('new');
  return `<div class="${classes.join(' ')}" data-id="${esc(c.id)}" draggable="true" tabindex="0">
    <div class="card-thumb">
      ${c.thumbUrl ? `<img src="${esc(c.thumbUrl)}" alt="" loading="lazy" draggable="false">` : `<div class="placeholder">${icon('play')}</div>`}
      <div class="card-play">${icon('play')}</div>
      <div class="card-check">${icon('check')}</div>
      <button class="card-fav${c.favorite ? ' on' : ''}" data-action="fav" title="${c.favorite ? 'Remove from favorites' : 'Add to favorites'}">${icon('star')}</button>
      ${state.folder === '*' && c.folder ? `<span class="badge left">${esc(c.folder)}</span>` : ''}
      <span class="badge">${fmtDuration(c.duration)}</span>
    </div>
    <div class="card-body">
      <div class="card-text">
        <div class="card-title" title="${esc(c.title)}">${esc(c.title)}</div>
        <div class="card-meta">${esc(fmtWhen(c.date))} · ${fmtSize(c.size)}</div>
      </div>
      <button class="card-more" data-action="more" title="More">${icon('more')}</button>
    </div>
  </div>`;
}

function renderGrid() {
  stopPreview();
  const grid = $('#grid'), scroller = $('#gridScroller');
  const top = scroller.scrollTop;
  const clips = visibleClips();
  const inFolder = state.library.clips.filter(inFolderFilter);

  $('#viewTitle').textContent = folderLabel(state.folder);
  $('#viewSub').textContent = inFolder.length
    ? `${inFolder.length} clip${inFolder.length === 1 ? '' : 's'} · ${fmtSize(inFolder.reduce((s, c) => s + c.size, 0))}`
    : '';

  const grouped = state.sort === 'newest' || state.sort === 'oldest';
  let html = '', lastDay = '';
  for (const c of clips) {
    if (grouped) {
      const d = dayLabel(c.date);
      if (d !== lastDay) { html += `<div class="day-header">${esc(d)}</div>`; lastDay = d; }
    }
    html += cardHtml(c);
  }
  grid.innerHTML = html;
  grid.classList.toggle('selecting', state.selecting);
  $$('.card img', grid).forEach((img) => {
    if (img.complete) img.classList.add('loaded');
    else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  });

  const empty = $('#emptyState');
  empty.hidden = clips.length > 0;
  if (!clips.length) {
    const hk = hotkeyLabel(state.settings?.saveClipHotkey);
    if (state.search) {
      $('#emptyTitle').textContent = 'No matches';
      $('#emptyText').textContent = `Nothing in ${folderLabel(state.folder)} matches “${state.search}”.`;
    } else if (!state.library.clips.length) {
      $('#emptyTitle').textContent = 'No clips yet';
      $('#emptyText').innerHTML = `Press <kbd>${esc(hk)}</kbd> anytime to save what just happened.`;
    } else {
      $('#emptyTitle').textContent = 'This folder is empty';
      $('#emptyText').textContent = 'Drag clips onto a folder in the sidebar to sort them.';
    }
  }
  scroller.scrollTop = top;
  updateSelectionBar();
}

function selectFolder(folder) {
  if (state.view === 'player') closePlayer(false);
  state.folder = folder;
  state.selected.clear();
  showView('library');
  renderGrid();
  $('#gridScroller').scrollTop = 0;
}

// ----- hover previews -----
let hoverCard = null, hoverTimer = 0;
function startPreview(card) {
  const clip = byId(card.dataset.id);
  if (!clip || card.querySelector('video')) return;
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true;
  v.style.opacity = '0'; v.style.transition = 'opacity .25s';
  v.src = clip.videoUrl;
  v.addEventListener('playing', () => { v.style.opacity = '1'; }, { once: true });
  card.querySelector('.card-thumb').insertBefore(v, card.querySelector('.card-play'));
  card.classList.add('previewing');
  v.play().catch(() => {});
}
function stopPreview() {
  clearTimeout(hoverTimer);
  if (!hoverCard) return;
  const v = hoverCard.querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
  hoverCard.classList.remove('previewing');
  hoverCard = null;
}

// ----- selection -----
function toggleSelect(id, range) {
  if (!state.selecting) state.selecting = true;
  if (range && state.anchor) {
    const ids = visibleClips().map((c) => c.id);
    const [a, b] = [ids.indexOf(state.anchor), ids.indexOf(id)].sort((x, y) => x - y);
    if (a >= 0 && b >= 0) ids.slice(a, b + 1).forEach((x) => state.selected.add(x));
  } else if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  state.anchor = id;
  renderGrid();
}
function setSelecting(on) {
  state.selecting = on;
  if (!on) state.selected.clear();
  renderGrid();
}
function updateSelectionBar() {
  $('#selectionBar').hidden = !state.selecting;
  $('#selectionCount').textContent = `${state.selected.size} selected`;
  $('#bulkMoveBtn').disabled = $('#bulkDeleteBtn').disabled = $('#bulkFavBtn').disabled = state.selected.size === 0;
  $('#montageBtn').disabled = state.selected.size < 2;
  $('#selectModeBtn').hidden = state.selecting;
}

// ----- clip actions -----
function folderPicker(x, y, current, onPick) {
  showMenu(x, y, [
    { heading: 'Move to' },
    { label: 'Unsorted', icon: 'inbox', current: current === '', action: () => onPick('') },
    ...state.library.folders.map((f) => ({ label: f.name, icon: 'folder', current: f.name === current, action: () => onPick(f.name) })),
    { sep: true },
    {
      label: 'New folder…', icon: 'plus', action: async () => {
        const name = await modal({ title: 'New folder', text: 'Clips you move here are sorted into this folder on your disk too.', input: '', ok: 'Create & move' });
        if (name) onPick(name);
      },
    },
  ]);
}

function clipMenu(clip, x, y) {
  showMenu(x, y, [
    { label: 'Open', icon: 'play', action: () => openClip(clip) },
    { label: clip.favorite ? 'Remove from favorites' : 'Add to favorites', icon: 'star', action: () => setFavorite([clip.id], !clip.favorite) },
    { label: 'Rename', icon: 'edit', action: () => renameClip(clip) },
    { label: 'Move to…', icon: 'folder', action: () => folderPicker(x, y, clip.folder, (f) => moveClips([clip.id], f)) },
    { label: 'Copy file', icon: 'copy', action: () => copyClip(clip) },
    { label: 'Show in folder', icon: 'reveal', action: () => snappy.call('clip.reveal', { id: clip.id }) },
    { sep: true },
    { label: 'Delete', icon: 'trash', danger: true, action: () => deleteClips([clip.id]) },
  ]);
}

async function moveClips(ids, folder) {
  try {
    await snappy.call('clip.moveMany', { ids, folder });
    state.selected.clear();
    await refreshLibrary();
    toast({ kind: 'success', title: `Moved ${ids.length === 1 ? 'clip' : `${ids.length} clips`} to ${folderLabel(folder)}` });
  } catch (err) {
    toast({ kind: 'error', title: "Couldn't move", sub: err.message });
    refreshLibrary();
  }
}

async function setFavorite(ids, favorite) {
  try {
    for (const id of ids) await snappy.call('clip.favorite', { id, favorite });
    await refreshLibrary();
  } catch (err) {
    toast({ kind: 'error', title: 'Couldn’t update favorites', sub: err.message });
  }
}

async function buildMontage(crossfade) {
  const ids = [...state.selected];
  if (ids.length < 2) { toast({ title: 'Select at least two clips' }); return; }
  Mascot.hold('montage', 'working');
  toast({ title: `Building a montage of ${ids.length} clips…`, sub: 'You can keep using Snappy meanwhile', timeout: 3500 });
  try {
    const id = await snappy.call('clips.montage', { ids, crossfade });
    state.newIds.add(id);
    setSelecting(false);
    await refreshLibrary();
    Mascot.flash('happy', 1300);
    const clip = byId(id);
    toast({ kind: 'success', title: 'Montage saved', sub: clip?.title || '', action: clip ? { label: 'Watch', fn: () => openClip(clip) } : null, timeout: 7000 });
  } catch (err) {
    toast({ kind: 'error', title: 'Couldn’t build the montage', sub: err.message, timeout: 8000 });
  } finally {
    Mascot.release('montage');
  }
}

function renderMarkers() {
  const host = $('#markers');
  const c = state.current;
  if (!host) return;
  host.innerHTML = (c?.markers || []).map((t) => `<button class="marker" style="left:${pct(t)}%" data-marker="${t}" title="Marked moment at ${fmtTime(t)}"></button>`).join('');
}

function jumpMarker(direction) {
  const list = [...(state.current?.markers || [])].sort((a, b) => a - b);
  const now = video.currentTime;
  const target = direction > 0 ? list.find((t) => t > now + 0.05) : list.reverse().find((t) => t < now - 0.3);
  if (target !== undefined) video.currentTime = target;
}

async function renameClip(clip) {
  const title = await modal({ title: 'Rename clip', input: clip.title, ok: 'Rename' });
  if (!title || title === clip.title) return;
  try { await snappy.call('clip.rename', { id: clip.id, title }); await refreshLibrary(); }
  catch (err) { toast({ kind: 'error', title: "Couldn't rename", sub: err.message }); }
}

async function copyClip(clip) {
  try {
    await snappy.call('clip.copy', { id: clip.id });
    toast({ kind: 'success', title: 'Copied to clipboard', sub: 'Paste it into Discord, a chat, or any folder' });
  } catch (err) { toast({ kind: 'error', title: "Couldn't copy", sub: err.message }); }
}

async function deleteClips(ids) {
  const one = ids.length === 1;
  const ok = await modal({
    title: one ? 'Delete this clip?' : `Delete ${ids.length} clips?`,
    text: 'They go to the Recycle Bin, so you can still restore them.',
    ok: 'Delete', danger: true,
  });
  if (!ok) return;
  const wasCurrent = state.current && ids.includes(state.current.id);
  if (wasCurrent) releaseVideo();
  try {
    await snappy.call('clip.delete', { ids });
    ids.forEach((id) => state.selected.delete(id));
    if (wasCurrent) closePlayer();
    await refreshLibrary();
    toast({ title: one ? 'Moved to Recycle Bin' : `${ids.length} clips moved to Recycle Bin` });
  } catch (err) {
    toast({ kind: 'error', title: "Couldn't delete", sub: err.message });
    if (wasCurrent) loadVideo(state.current.videoUrl, 0, false);
  }
}

async function folderMenu(name, x, y) {
  const folder = state.library.folders.find((f) => f.name === name);
  showMenu(x, y, [
    {
      label: 'Rename', icon: 'edit', action: async () => {
        const newName = await modal({ title: 'Rename folder', text: 'The folder is renamed on your disk too.', input: name, ok: 'Rename' });
        if (!newName || newName === name) return;
        try {
          const result = await snappy.call('folder.rename', { oldName: name, newName });
          if (state.folder === name) state.folder = result;
          await refreshLibrary();
        } catch (err) { toast({ kind: 'error', title: "Couldn't rename folder", sub: err.message }); }
      },
    },
    { label: 'Show in Explorer', icon: 'reveal', action: () => snappy.call('folder.reveal', { name }) },
    { sep: true },
    {
      label: 'Delete folder', icon: 'trash', danger: true, action: async () => {
        const count = folder?.count || 0;
        const ok = await modal({
          title: `Delete “${name}”?`,
          text: count ? `Its ${count} clip${count === 1 ? '' : 's'} go to the Recycle Bin too.` : 'The empty folder goes to the Recycle Bin.',
          ok: 'Delete', danger: true,
        });
        if (!ok) return;
        try { await snappy.call('folder.delete', { name }); await refreshLibrary(); }
        catch (err) { toast({ kind: 'error', title: "Couldn't delete folder", sub: err.message }); }
      },
    },
  ]);
}

// ---------- views ----------
function showView(name) {
  const previous = state.view;
  state.view = name;
  $('#libraryView').hidden = name !== 'library';
  $('#playerView').hidden = name !== 'player';
  $('#settingsView').hidden = name !== 'settings';
  $('#studioView').hidden = name !== 'studio';
  if (previous === 'studio' && name !== 'studio') window.Studio?.leave();
  markActiveNav();
}

function openStudio() {
  hideMenu();
  stopPreview();
  if (state.view === 'player') closePlayer(false);
  if (state.view === 'studio') return;
  showView('studio');
  window.Studio?.enter();
}

// ---------- player ----------
const video = $('#video');
const dur = () => (Number.isFinite(video.duration) && video.duration) || state.current?.duration || 0;
const pct = (t) => (dur() ? clamp(t / dur(), 0, 1) * 100 : 0);

function openClip(clip, { autoplay = true } = {}) {
  hideMenu();
  stopPreview();
  state.current = clip;
  state.trim = { start: 0, end: clip.duration || 0, touched: false };
  showView('player');
  renderClipMeta();
  $('#clipTitle').value = clip.title;
  loadVideo(clip.videoUrl, 0, autoplay);
  updateTrimUI();
  renderTime();
  window.Editor?.open(clip);
}

function loadVideo(url, at, autoplay) {
  video.addEventListener('loadedmetadata', () => {
    if (!state.trim.touched) state.trim.end = video.duration;
    if (at) video.currentTime = at;
    updateTrimUI();
    renderTime();
    if (autoplay) video.play().catch(() => {});
  }, { once: true });
  video.src = url;
  video.load();
}

/** Stops playback and lets go of the file, so it can be renamed, moved, trimmed or deleted. */
function releaseVideo() {
  const pos = { at: video.currentTime || 0, wasPlaying: !video.paused };
  video.pause();
  video.removeAttribute('src');
  video.load();
  return pos;
}

function closePlayer(render = true) {
  releaseVideo();
  window.Editor?.close();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  state.current = null;
  showView('library');
  if (render) renderGrid();
}

function renderClipMeta() {
  const c = state.current;
  if (!c) return;
  const parts = [fmtDuration(c.duration)];
  if (c.width) parts.push(`${c.width}×${c.height}`);
  parts.push(fmtSize(c.size), fmtWhen(c.date));
  $('#clipMeta').textContent = parts.join(' · ');
  $('#clipFolderName').textContent = c.folder || 'Unsorted';
  $('#favBtn').classList.toggle('on', !!c.favorite);
  $('#favBtn').title = c.favorite ? 'Remove from favorites' : 'Add to favorites';
  renderMarkers();
  if (document.activeElement !== $('#clipTitle')) $('#clipTitle').value = c.title;
}

/** Runs a file operation on the open clip, then reloads it from its (possibly new) location. */
async function mutateCurrent(op, successToast) {
  const clip = state.current;
  if (!clip) return;
  state.mutating = true;
  const pos = releaseVideo();
  try {
    const newId = await op();
    state.current = { ...clip, id: newId };
    await refreshLibrary();
    const updated = byId(newId);
    if (updated) {
      state.current = updated;
      if (window.Editor?.state.clip) Editor.state.clip = updated; // renamed/moved: keep editing the same clip
      renderClipMeta();
      loadVideo(updated.videoUrl, pos.at, pos.wasPlaying);
    } else {
      closePlayer();
    }
    if (successToast) toast({ kind: 'success', title: successToast });
  } catch (err) {
    toast({ kind: 'error', title: 'Something went wrong', sub: err.message });
    state.current = clip;
    renderClipMeta();
    loadVideo(clip.videoUrl, pos.at, pos.wasPlaying);
  } finally {
    state.mutating = false;
  }
}

function togglePlay() {
  if (video.paused) video.play().catch(() => {});
  else video.pause();
}

function renderTime() {
  $('#playhead').style.left = `${pct(video.currentTime)}%`;
  $('#timeCurrent').textContent = fmtTime(video.currentTime);
  $('#timeTotal').textContent = fmtTime(dur());
  if (document.fullscreenElement) {
    $('#fsProgressFill').style.width = `${pct(video.currentTime)}%`;
    $('#fsTime').textContent = `${fmtDuration(video.currentTime)} / ${fmtDuration(dur())}`;
  }
}

let rafId = 0;
function playLoop() {
  if (!video.paused && state.trim.touched && video.currentTime >= state.trim.end) video.currentTime = state.trim.start;
  renderTime();
  if (!video.paused) rafId = requestAnimationFrame(playLoop);
}

function updateTrimUI() {
  const d = dur();
  const { start, touched } = state.trim;
  const end = state.trim.end || d;
  const s = pct(start), e = pct(end);
  $('#shadeLeft').style.width = `${s}%`;
  $('#shadeRight').style.width = `${100 - e}%`;
  const range = $('#trimRange');
  range.style.left = `${s}%`;
  range.style.width = `${e - s}%`;
  range.classList.toggle('untouched', !touched);
  $('#handleStart').style.left = `${s}%`;
  $('#handleEnd').style.left = `${e}%`;
  const chip = $('#resetTrimBtn');
  chip.hidden = !touched;
  chip.title = `Trimmed to ${fmtTime(start)} to ${fmtTime(end)}. Click to undo.`;
  $('#trimLength').textContent = fmtTime(end - start);
  const canSave = (touched || !!window.Editor?.hasEdits()) && !state.busy;
  $('#saveTrimBtn').disabled = !canSave;
  $('#replaceTrimBtn').disabled = !canSave;
  $('#editTabs [data-tab="trim"]')?.classList.toggle('edited', touched);
}

function setTrimPoint(which, t) {
  const min = 0.2;
  if (which === 'start') state.trim.start = clamp(t, 0, (state.trim.end || dur()) - min);
  else state.trim.end = clamp(t, state.trim.start + min, dur());
  state.trim.touched = true;
  updateTrimUI();
}

// ---------- settings ----------
const KEY_FROM_CODE = {
  Backquote: 'Oemtilde', Minus: 'OemMinus', Equal: 'Oemplus', BracketLeft: 'OemOpenBrackets', BracketRight: 'OemCloseBrackets',
  Backslash: 'OemPipe', Semicolon: 'OemSemicolon', Quote: 'OemQuotes', Comma: 'Oemcomma', Period: 'OemPeriod', Slash: 'OemQuestion',
  ShiftLeft: 'ShiftKey', ShiftRight: 'ShiftKey', ControlLeft: 'ControlKey', ControlRight: 'ControlKey', AltLeft: 'Menu', AltRight: 'Menu',
  Tab: 'Tab', CapsLock: 'Capital',
  Space: 'Space', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  PrintScreen: 'PrintScreen', Pause: 'Pause', ScrollLock: 'Scroll', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  NumpadAdd: 'Add', NumpadSubtract: 'Subtract', NumpadMultiply: 'Multiply', NumpadDivide: 'Divide', NumpadDecimal: 'Decimal',
};
function codeToKeys(code) {
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return `D${m[1]}`;
  if ((m = /^Numpad(\d)$/.exec(code))) return `NumPad${m[1]}`;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return KEY_FROM_CODE[code] || null;
}
const KEY_DISPLAY = { Oemtilde: '`', OemMinus: '-', Oemplus: '=', OemOpenBrackets: '[', OemCloseBrackets: ']', OemPipe: '\\', OemSemicolon: ';', OemQuotes: "'", Oemcomma: ',', OemPeriod: '.', OemQuestion: '/', Scroll: 'Scroll Lock', ShiftKey: 'Shift', ControlKey: 'Ctrl', Menu: 'Alt', Capital: 'Caps', Next: 'PageDown', Prior: 'PageUp', Snapshot: 'PrintScreen' };
function displayKey(name) {
  let m;
  if ((m = /^D(\d)$/.exec(name))) return m[1];
  if ((m = /^NumPad(\d)$/.exec(name))) return `Num ${m[1]}`;
  return KEY_DISPLAY[name] || name;
}

function ramEstimate(s) {
  const secs = s.bufferSeconds;
  const video = s.bitrateMbps * 1.25 * 1e6 / 8 * (secs + 5) * 1.05 + 16 * 1048576;
  const audio = (s.desktopAudioEnabled ? 192000 : 0) * (secs + 15) + (s.micEnabled ? 96000 : 0) * (secs + 15);
  const total = video + audio;
  const ram = state.options?.totalMemoryBytes || 0;
  if (ram && total > ram / 2) return `that’s <strong>more than half your RAM</strong>, so Snappy will shorten the replay to fit`;
  if (ram && total > ram / 4) return `up to <strong>${fmtSize(total)}</strong> of your ${fmtSize(ram)}`;
  return `up to ${fmtSize(total)}`;
}

async function onDurationChange(select, input) {
  const el = select || input;
  const key = el.dataset.durationSelect || el.dataset.durationMin || el.dataset.durationSec;
  if (select) {
    if (select.value === 'custom') {
      state.customDuration = key;
      const box = select.parentElement.querySelector('.duration-custom');
      box.hidden = false;
      box.querySelector('input').focus();
      box.querySelector('input').select();
      return;
    }
    state.customDuration = null;
    await saveDuration(key, Number(select.value));
    return;
  }
  const box = input.closest('.duration-custom');
  const minutes = Number(box.querySelector('[data-duration-min]').value) || 0;
  const seconds = Number(box.querySelector('[data-duration-sec]').value) || 0;
  await saveDuration(key, Math.round(minutes * 60 + seconds));
}

async function saveDuration(key, requested) {
  const o = state.options;
  const max = key === 'shortClipSeconds' ? state.settings.bufferSeconds : o.maxClipSeconds;
  const value = clamp(requested, o.minClipSeconds, max);
  if (value !== requested) {
    toast({
      title: key === 'shortClipSeconds' && requested > max
        ? `Quick clips can’t be longer than the replay (${fmtSeconds(max)})`
        : `Clips can be ${fmtSeconds(o.minClipSeconds)} to ${fmtSeconds(o.maxClipSeconds)} long`,
      sub: `Set to ${fmtSeconds(value)}`,
    });
  }
  await saveSettings((s) => {
    s[key] = value;
    if (key === 'bufferSeconds' && s.shortClipSeconds > value) s.shortClipSeconds = value;
  });
}

async function saveSettings(mutate) {
  const next = structuredClone(state.settings);
  mutate(next);
  try {
    state.settings = await snappy.call('settings.save', { settings: next });
    applySettingsToChrome();
    if (state.view === 'settings') renderSettings();
    window.Studio?.settingsChanged();
  } catch (err) {
    toast({ kind: 'error', title: "Couldn't save setting", sub: err.message });
    if (state.view === 'settings') renderSettings();
  }
}

async function openSettings() {
  hideMenu();
  stopPreview();
  if (state.view === 'player') closePlayer(false);
  showView('settings');
  const form = $('#settingsForm');
  if (!state.options) {
    form.innerHTML = `<div class="settings-group"><div class="row settings-loading"><div class="mascot"></div><div class="row-text">
      <div class="row-title">Checking your hardware…</div>
      <div class="row-desc">Finding monitors, audio devices and encoders.</div></div></div></div>`;
    Mascot.mount(form.querySelector('.mascot'));
    Mascot.hold('options', 'working');
    try { state.options = await snappy.call('settings.options'); Mascot.release('options'); }
    catch (err) {
      Mascot.release('options');
      Mascot.flash('error', 2000);
      form.innerHTML = `<div class="settings-group"><div class="row"><div class="row-text"><div class="row-title">Couldn’t load settings</div><div class="row-desc">${esc(err.message)}</div></div></div></div>`;
      return;
    }
  }
  if (state.view === 'settings') renderSettings();
}

function renderSettings() {
  const s = state.settings, o = state.options;
  if (!s || !o) return;
  const scroller = $('#settingsScroller');
  const top = scroller.scrollTop;
  const focused = document.activeElement;
  const refocus = focused?.dataset?.durationMin ? `[data-duration-min="${focused.dataset.durationMin}"]`
    : focused?.dataset?.durationSec ? `[data-duration-sec="${focused.dataset.durationSec}"]` : null;

  const opt = (value, label, current, disabled = false) =>
    `<option value="${esc(value)}"${String(value) === String(current) ? ' selected' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</option>`;
  const row = (title, desc, control) => `<div class="row"><div class="row-text"><div class="row-title">${title}</div>${desc ? `<div class="row-desc">${desc}</div>` : ''}</div><div class="row-control">${control}</div></div>`;
  const select = (key, options) => `<select class="select" data-setting="${key}">${options}</select>`;
  const toggle = (key, on, off) =>
    `<label class="toggle"><input type="checkbox" data-setting="${key}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span></span></label>`;
  const range = (key, min, max, step, value, unit) =>
    `<input type="range" data-setting="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${((value - min) / (max - min)) * 100}%"><span class="range-value">${value}${unit}</span>`;
  const hotkey = (key) => `<button class="hotkey-input" data-hotkey="${key}">${esc(hotkeyLabel(s[key]))}</button>`;

  const primary = o.displays.find((d) => d.isPrimary)?.deviceName || '';
  const desktopValue = s.desktopAudioEnabled ? (s.desktopAudioDeviceId || 'default') : 'off';
  const micValue = s.micEnabled ? (s.micDeviceId || 'default') : 'off';
  const duration = (key, presets, value, max) => {
    const custom = !presets.includes(value) || state.customDuration === key;
    return `<div class="duration">
      <select class="select" data-duration-select="${key}">
        ${presets.map((v) => opt(v, fmtSeconds(v), custom ? 'custom' : value, v > max)).join('')}
        ${opt('custom', 'Custom…', custom ? 'custom' : value)}
      </select>
      <div class="duration-custom"${custom ? '' : ' hidden'}>
        <input class="num-input" type="number" min="0" max="${Math.floor(o.maxClipSeconds / 60)}" value="${Math.floor(value / 60)}" data-duration-min="${key}" aria-label="Minutes"><span>min</span>
        <input class="num-input" type="number" min="0" max="59" value="${value % 60}" data-duration-sec="${key}" aria-label="Seconds"><span>sec</span>
      </div>
    </div>`;
  };
  const autoEncoder = s.encoder === 'auto' && state.status?.encoder ? ` (${encoderLabel(state.status.encoder)})` : '';

  $('#settingsForm').innerHTML = `
    <div class="settings-group" id="set-replay"><h2>Replay buffer</h2>
      ${row('Replay length', `How far back you can save. Kept in RAM only (${ramEstimate(s)}); nothing touches your disk until you save a clip.`,
        duration('bufferSeconds', [300, 600, 900, 1200], s.bufferSeconds, o.maxClipSeconds))}
      ${row('Quick clip length', `What the quick clip hotkey saves: ${fmtSeconds(o.minClipSeconds)} up to the replay length.`,
        duration('shortClipSeconds', [30, 60, 120, 300], s.shortClipSeconds, s.bufferSeconds))}
    </div>

    <div class="settings-group" id="set-video"><h2>Video</h2>
      ${row('Monitor', 'Which screen Snappy records.',
        select('monitorDeviceName', o.displays.map((d) => opt(d.deviceName, d.label, s.monitorDeviceName || primary)).join('')))}
      ${row('Frame rate', '', select('fps', [30, 60, 120, 144].map((v) => opt(v, `${v} fps`, s.fps)).join('')))}
      ${row('Resolution', 'Lower resolutions use less RAM and disk space.',
        select('outputHeight', [[0, 'Native'], [1440, '1440p'], [1080, '1080p'], [720, '720p']].map(([v, l]) => opt(v, l, s.outputHeight)).join('')))}
      ${row('Quality', 'Higher bitrate keeps fast motion sharp but makes bigger files. 20 to 35 Mbps is great for 1080p60.',
        range('bitrateMbps', 5, 100, 1, s.bitrateMbps, ' Mbps'))}
      ${row('Encoder', 'Hardware encoders run on your graphics card, so games don’t lose FPS.',
        select('encoder', opt('auto', `Automatic${autoEncoder}`, s.encoder)
          + o.encoders.map((e) => opt(e.id, encoderLabel(e.id) + (e.available ? '' : ' (not supported here)'), s.encoder, !e.available)).join('')))}
      ${row('Record mouse cursor', '', toggle('captureCursor', s.captureCursor))}
    </div>

    <div class="settings-group" id="set-audio"><h2>Audio</h2>
      ${row('Desktop audio', 'Game, music and app sound.',
        select('desktopDevice', opt('off', 'Off', desktopValue) + opt('default', 'Follow Windows default output', desktopValue)
          + o.outputs.map((d) => opt(d.id, d.name, desktopValue)).join('')))}
      ${row('Desktop volume', 'Only affects clips.', range('desktopVolumePercent', 0, 200, 5, s.desktopVolumePercent, '%'))}
      ${row('Microphone', 'Pick your real mic. Snappy sticks with it, even when Windows or other apps switch the default device.',
        select('micDevice', opt('off', 'Off', micValue) + opt('default', 'Follow Windows default mic', micValue)
          + o.microphones.map((d) => opt(d.id, d.name, micValue)).join('')))}
      ${row('Mic volume', 'Only affects clips. Your Windows mic level is never touched.', range('micVolumePercent', 0, 200, 5, s.micVolumePercent, '%'))}
      ${row('Separate audio tracks', 'Adds desktop-only and mic-only tracks next to the mix, handy for editing.', toggle('separateAudioTracks', s.separateAudioTracks))}
      ${s.separateAudioTracks ? row('Split by program',
        o.programAudio
          ? 'Instead of one desktop track, every program that made a sound gets its own: the game, a call, music. Up to four at a time, programs that stayed quiet are skipped. Counts for clips you save from now on.'
          : 'Needs Windows 11.',
        toggle('splitAudioByProgram', o.programAudio && s.splitAudioByProgram, !o.programAudio)) : ''}
    </div>

    <div class="settings-group" id="set-hotkeys"><h2>Hotkeys</h2>
      ${row('Save replay', `Saves the whole replay (${fmtSeconds(s.bufferSeconds)}). Click, then press your keys.`, hotkey('saveClipHotkey'))}
      ${row('Save quick clip', `Saves the last ${fmtSeconds(s.shortClipSeconds)}. Backspace clears it.`, hotkey('saveShortClipHotkey'))}
      ${row('Take screenshot', 'Saves your screen as a PNG in the screenshots folder.', hotkey('screenshotHotkey'))}
      ${row('Mark moment', 'Press it when something happens. Clips you save later show a marker there.', hotkey('markMomentHotkey'))}
    </div>

    <div class="settings-group" id="set-clips"><h2>Clips</h2>
      ${row('Clips folder', 'Every game or app gets its own subfolder inside.',
        `<span class="path-display" title="${esc(s.clipsFolder)}">${esc(s.clipsFolder)}</span><button class="btn ghost" data-action="pickFolder">Change…</button>`)}
      ${row('Screenshots folder', 'Screenshots are sorted into a subfolder per game or app, like clips.',
        `<span class="path-display" title="${esc(s.screenshotsFolder)}">${esc(s.screenshotsFolder)}</span><button class="btn ghost" data-action="pickScreenshots">Change…</button>`)}
      ${row('Storage limit', 'When the clips folder grows past this size, the oldest clips that aren’t favorites go to the Recycle Bin.',
        `<span class="storage-usage" id="storageUsage"></span>${s.storageLimitEnabled ? `<input class="num-input wide" type="number" min="5" step="5" value="${s.storageLimitGb}" data-setting="storageLimitGb"><span class="hint">GB</span>` : ''}${toggle('storageLimitEnabled', s.storageLimitEnabled)}`)}
      ${row('Trimming', 'Fast is instant and lossless, but a cut can start up to a second early. Precise cuts on the exact frame and re-encodes on your graphics card.',
        select('trimMode', opt('fast', 'Fast (lossless)', s.trimMode) + opt('precise', 'Precise (exact frame)', s.trimMode)))}
      ${row('Play a sound when a clip is saved', '', toggle('playSoundOnSave', s.playSoundOnSave))}
      ${row('Show Snappy pop-up when a clip is saved', 'A small, click-through pop-up in the corner, also over games. It never shows up in your clips.', toggle('showNotificationOnSave', s.showNotificationOnSave))}
    </div>

    <div class="settings-group" id="set-studio"><h2>Studio</h2>
      ${row('Studio layers', 'Adds your Studio layers to clips. Turn off for raw clips, your scenes stay as they are.', toggle('studioEnabled', s.studioEnabled))}
      ${row('Switch scenes automatically', 'Uses the scene linked to the game you are playing, and your default scene the rest of the time.', toggle('studioAutoSwitch', s.studioAutoSwitch))}
    </div>

    <div class="settings-group" id="set-general"><h2>General</h2>
      ${row('Start with Windows', 'Snappy starts quietly in the tray, ready to clip from the moment your PC boots.', toggle('startWithWindows', s.startWithWindows))}
      ${row('Replay buffer on', 'Turn off to pause recording, e.g. while showing something private.', toggle('recording', state.status?.state !== 'paused'))}
      <div class="row privacy-note">${icon('check')}<div><strong>Private by design.</strong> Your screen and clips never leave this PC. The only thing Snappy does online is ask GitHub for new versions, and you can turn that off under About.</div></div>
    </div>

    <div class="settings-group" id="set-about"><h2>About</h2>
      ${updateRowHtml()}
      ${row('Update automatically', 'Checks GitHub every few hours. A new version downloads in the background and installs once your PC has been idle for 10 minutes.', toggle('checkForUpdates', s.checkForUpdates))}
      ${row('Source code', 'Snappy is free software under the GPL 3.0 license.', '<button class="btn ghost" data-action="openGithub">Open GitHub</button>')}
      ${row('Licenses and credits', 'The projects Snappy is built with.', '<button class="btn ghost" data-action="licenses">View</button>')}
      ${row('Log file', 'Handy when reporting a problem.', '<button class="btn ghost" data-action="openLog">Open</button>')}
    </div>`;
  scroller.scrollTop = top;
  if (refocus) { const el = $(refocus); el?.focus(); el?.select(); }
  renderSettingsNav();
  snappy.call('storage.usage').then((bytes) => {
    const el = $('#storageUsage');
    if (el) el.textContent = `${fmtSize(bytes)} used`;
  }).catch(() => {});
}

function updateRowHtml() {
  const u = state.update || {};
  const pct = Math.round((u.progress || 0) * 100);
  let desc, control = '<button class="btn ghost" data-action="checkUpdate">Check now</button>';
  switch (u.state) {
    case 'checking': desc = 'Checking GitHub…'; control = ''; break;
    case 'downloading': desc = `Downloading version ${esc(u.available)}, ${pct}%`; control = ''; break;
    case 'ready': desc = `Version ${esc(u.available)} is ready. Snappy restarts for a moment to install it.`; control = '<button class="btn" data-action="installUpdate">Restart and update</button>'; break;
    case 'available':
      desc = `Version ${esc(u.available)} is out. This copy wasn't installed with the setup, so get it from GitHub.`;
      control = '<button class="btn" data-action="openReleases">Open GitHub</button>';
      break;
    case 'error': desc = `Couldn't update: ${esc(u.error || 'unknown problem')}`; break;
    case 'latest': desc = 'You have the latest version.'; break;
    default: desc = state.settings?.checkForUpdates ? 'Looks for new versions on its own.' : 'Automatic updates are off.';
  }
  return `<div class="row" id="updateRow"><div class="row-text"><div class="row-title">Snappy ${esc(state.version)}</div><div class="row-desc">${desc}</div></div><div class="row-control">${control}</div></div>`;
}

function renderUpdateRow() {
  const row = $('#updateRow');
  if (row) row.outerHTML = updateRowHtml();
}

function renderUpdatePill() {
  const ready = state.update?.state === 'ready';
  $('#updatePill').hidden = !ready;
  if (ready) $('#updatePillText').textContent = `Restart to update to ${state.update.available}`;
}

const SETTINGS_SECTIONS = [['replay', 'Replay buffer'], ['video', 'Video'], ['audio', 'Audio'], ['hotkeys', 'Hotkeys'], ['clips', 'Clips'], ['studio', 'Studio'], ['general', 'General'], ['about', 'About']];

function renderSettingsNav() {
  $('#settingsNav').innerHTML = '<div class="settings-nav-title">On this page</div>'
    + SETTINGS_SECTIONS.map(([id, label]) => `<button data-section="${id}">${label}</button>`).join('');
  updateSettingsNav();
}

/** Highlights the section you're looking at. */
function updateSettingsNav() {
  const scroller = $('#settingsScroller');
  const top = scroller.getBoundingClientRect().top;
  let active = SETTINGS_SECTIONS[0][0];
  for (const [id] of SETTINGS_SECTIONS) {
    const el = document.getElementById(`set-${id}`);
    if (el && el.getBoundingClientRect().top - top <= 90) active = id;
  }
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) active = SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1][0];
  $$('#settingsNav button').forEach((b) => b.classList.toggle('active', b.dataset.section === active));
}

function startHotkeyCapture(btn) {
  btn.classList.add('listening');
  btn.textContent = 'Press keys…';
  const cleanup = () => {
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onMouse, true);
  };
  const onMouse = (e) => { if (e.target !== btn) { cleanup(); renderSettings(); } };
  const onKey = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(e.key)) return;
    cleanup();
    if (e.key === 'Escape') { renderSettings(); return; }
    const clearing = (e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey;
    const key = clearing ? 'None' : codeToKeys(e.code);
    if (!key) { toast({ kind: 'error', title: 'That key can’t be used as a hotkey' }); renderSettings(); return; }
    const hk = clearing
      ? { key: 'None', ctrl: false, alt: false, shift: false, win: false }
      : { key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, win: e.metaKey };
    await saveSettings((s) => { s[btn.dataset.hotkey] = hk; });
  };
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onMouse, true);
}

// ---------- wiring ----------
function bind() {
  // Sidebar
  $('.sidebar').addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    if (item.dataset.view === 'settings') openSettings();
    else if (item.dataset.view === 'studio') openStudio();
    else if (item.dataset.folder !== undefined) selectFolder(item.dataset.folder);
  });
  $('.sidebar').addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.nav-item[data-folder]');
    e.preventDefault();
    if (item && item.dataset.folder && !['*', 'fav'].includes(item.dataset.folder)) folderMenu(item.dataset.folder, e.clientX, e.clientY);
  });
  $('#newFolderBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = await modal({ title: 'New folder', text: 'Great for games Snappy didn’t recognise, or collections like “Best plays”.', input: '', ok: 'Create' });
    if (!name) return;
    try {
      const created = await snappy.call('folder.create', { name });
      await refreshLibrary();
      selectFolder(created);
    } catch (err) { toast({ kind: 'error', title: "Couldn't create folder", sub: err.message }); }
  });
  $('#saveClipBtn').addEventListener('click', () => snappy.call('recorder.save').catch((err) => toast({ kind: 'error', title: "Couldn't save clip", sub: err.message })));
  $('#recStatus').addEventListener('click', async () => {
    const paused = state.status?.state !== 'paused';
    try { applyStatus(await snappy.call('recorder.pause', { paused })); }
    catch (err) { toast({ kind: 'error', title: 'Something went wrong', sub: err.message }); }
    toast({ title: paused ? 'Recording paused' : 'Recording resumed', sub: paused ? 'Nothing is being buffered until you resume.' : '' });
  });

  // Drag & drop clips onto folders
  const nav = $('#nav');
  nav.addEventListener('dragover', (e) => {
    const item = e.target.closest('.nav-item[data-folder]');
    if (!item || item.dataset.folder === '*' || !e.dataTransfer.types.includes('application/x-snappy-clips')) return;
    if (item.dataset.folder === 'fav') { e.preventDefault(); item.classList.add('drop-target'); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    $$('.nav-item.drop-target').forEach((x) => x !== item && x.classList.remove('drop-target'));
    item.classList.add('drop-target');
  });
  nav.addEventListener('dragleave', (e) => {
    const item = e.target.closest('.nav-item');
    if (item && !item.contains(e.relatedTarget)) item.classList.remove('drop-target');
  });
  nav.addEventListener('drop', (e) => {
    const item = e.target.closest('.nav-item[data-folder]');
    $$('.nav-item.drop-target').forEach((x) => x.classList.remove('drop-target'));
    if (!item) return;
    e.preventDefault();
    const ids = JSON.parse(e.dataTransfer.getData('application/x-snappy-clips') || '[]');
    if (item.dataset.folder === 'fav') { setFavorite(ids, true); return; }
    const moving = ids.filter((id) => byId(id)?.folder !== item.dataset.folder);
    if (moving.length) moveClips(moving, item.dataset.folder);
  });
  // Never let files dropped from Explorer navigate the window away.
  document.addEventListener('dragover', (e) => { if (!e.dataTransfer.types.includes('application/x-snappy-clips')) e.preventDefault(); });
  document.addEventListener('drop', (e) => e.preventDefault());

  // Grid
  const grid = $('#grid');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const clip = byId(card.dataset.id);
    if (!clip) return;
    if (e.target.closest('[data-action="fav"]')) { setFavorite([clip.id], !clip.favorite); return; }
    const more = e.target.closest('[data-action="more"]');
    if (more) {
      const r = more.getBoundingClientRect();
      clipMenu(clip, r.left, r.bottom + 4);
      return;
    }
    if (state.selecting || e.ctrlKey || e.shiftKey) { toggleSelect(clip.id, e.shiftKey); return; }
    openClip(clip);
  });
  grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (card && e.key === 'Enter') { const clip = byId(card.dataset.id); if (clip) openClip(clip); }
  });
  grid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    e.preventDefault();
    const clip = card && byId(card.dataset.id);
    if (clip) clipMenu(clip, e.clientX, e.clientY);
  });
  grid.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.card');
    if (card === hoverCard) return;
    stopPreview();
    if (!card || state.selecting) return;
    hoverCard = card;
    hoverTimer = setTimeout(() => startPreview(card), 650);
  });
  grid.addEventListener('mouseleave', stopPreview);
  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    stopPreview();
    const id = card.dataset.id;
    const ids = state.selected.has(id) ? [...state.selected] : [id];
    e.dataTransfer.setData('application/x-snappy-clips', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
    const ghost = $('#dragGhost');
    ghost.textContent = ids.length === 1 ? 'Move clip' : `Move ${ids.length} clips`;
    ghost.hidden = false;
    ghost.style.left = '-500px';
    ghost.style.top = '-500px';
    e.dataTransfer.setDragImage(ghost, -12, -12);
    setTimeout(() => { ghost.hidden = true; }, 0);
    ids.forEach((x) => grid.querySelector(`.card[data-id="${CSS.escape(x)}"]`)?.classList.add('dragging'));
  });
  grid.addEventListener('dragend', () => $$('.card.dragging').forEach((c) => c.classList.remove('dragging')));

  // Toolbar
  $('#searchInput').addEventListener('input', debounce((e) => { state.search = e.target.value; renderGrid(); }, 120));
  $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  $('#selectModeBtn').addEventListener('click', () => setSelecting(true));
  $('#cancelSelectBtn').addEventListener('click', () => setSelecting(false));
  $('#selectAllBtn').addEventListener('click', () => { visibleClips().forEach((c) => state.selected.add(c.id)); renderGrid(); });
  $('#bulkMoveBtn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    folderPicker(r.left, r.bottom + 6, null, (f) => moveClips([...state.selected], f));
  });
  $('#bulkDeleteBtn').addEventListener('click', () => deleteClips([...state.selected]));
  $('#bulkFavBtn').addEventListener('click', () => setFavorite([...state.selected], true));
  $('#montageBtn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { heading: 'Montage' },
      { label: 'Hard cuts', icon: 'film', action: () => buildMontage(false) },
      { label: 'Crossfades', icon: 'film', action: () => buildMontage(true) },
    ]);
  });

  // Player toolbar
  $('#backBtn').addEventListener('click', () => closePlayer());
  const titleInput = $('#clipTitle');
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') titleInput.blur();
    if (e.key === 'Escape') { titleInput.value = state.current?.title || ''; titleInput.blur(); }
    e.stopPropagation();
  });
  titleInput.addEventListener('blur', () => {
    const clip = state.current;
    const title = titleInput.value.trim();
    if (!clip || !title || title === clip.title) { if (clip) titleInput.value = clip.title; return; }
    mutateCurrent(() => snappy.call('clip.rename', { id: clip.id, title }), 'Clip renamed');
  });
  $('#clipFolderBtn').addEventListener('click', (e) => {
    const clip = state.current;
    if (!clip) return;
    const r = e.currentTarget.getBoundingClientRect();
    folderPicker(r.left, r.bottom + 6, clip.folder, (folder) => {
      if (folder === clip.folder) return;
      mutateCurrent(() => snappy.call('clip.move', { id: clip.id, folder }), `Moved to ${folderLabel(folder)}`);
    });
  });
  $('#copyBtn').addEventListener('click', () => state.current && copyClip(state.current));
  $('#favBtn').addEventListener('click', () => state.current && setFavorite([state.current.id], !state.current.favorite));
  $('#frameBtn').addEventListener('click', async () => {
    if (!state.current) return;
    try {
      await snappy.call('clip.screenshot', { id: state.current.id, time: video.currentTime });
      toast({ kind: 'success', title: 'Frame saved', sub: `At ${fmtTime(video.currentTime)}`, action: { label: 'Show', fn: () => snappy.call('screenshots.open') } });
    } catch (err) {
      toast({ kind: 'error', title: 'Couldn’t save the frame', sub: err.message });
    }
  });
  $('#shrinkBtn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { heading: 'Make a copy that fits' },
      { label: 'Discord (10 MB)', icon: 'shrink', action: () => Editor.shrink(10) },
      { label: 'Discord Nitro Basic (50 MB)', icon: 'shrink', action: () => Editor.shrink(50) },
      { label: 'Discord Nitro (500 MB)', icon: 'shrink', action: () => Editor.shrink(500) },
      { sep: true },
      {
        label: 'Custom size…', icon: 'edit', action: async () => {
          const value = await modal({ title: 'Target size', text: 'Size in MB. The copy lands next to the clip and is copied to your clipboard.', input: '25', ok: 'Shrink' });
          const mb = Number(String(value || '').replace(',', '.'));
          if (mb > 0) Editor.shrink(mb);
        },
      },
    ]);
  });
  $('#revealBtn').addEventListener('click', () => state.current && snappy.call('clip.reveal', { id: state.current.id }));
  $('#deleteBtn').addEventListener('click', () => state.current && deleteClips([state.current.id]));

  // Video
  const stage = $('#stage');
  video.addEventListener('play', () => {
    if (state.trim.touched && (video.currentTime < state.trim.start - 0.05 || video.currentTime >= state.trim.end - 0.05)) video.currentTime = state.trim.start;
    stage.classList.add('playing');
    $('#playBtn use').setAttribute('href', '#i-pause');
    $('#fsPlay use').setAttribute('href', '#i-pause');
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(playLoop);
  });
  video.addEventListener('pause', () => {
    stage.classList.remove('playing');
    $('#playBtn use').setAttribute('href', '#i-play');
    $('#fsPlay use').setAttribute('href', '#i-play');
    renderTime();
  });
  video.addEventListener('seeked', renderTime);
  video.addEventListener('durationchange', () => { updateTrimUI(); renderTime(); renderMarkers(); });
  video.addEventListener('volumechange', () => {
    $('#muteBtn use').setAttribute('href', video.muted || video.volume === 0 ? '#i-mute' : '#i-volume');
    const slider = $('#volumeSlider');
    slider.value = video.muted ? 0 : video.volume;
    slider.style.setProperty('--fill', `${slider.value * 100}%`);
    $('#fsMute use').setAttribute('href', video.muted || video.volume === 0 ? '#i-mute' : '#i-volume');
    const fsVolume = $('#fsVolume');
    fsVolume.value = video.muted ? 0 : video.volume;
    fsVolume.style.setProperty('--fill', `${fsVolume.value * 100}%`);
    try { localStorage.setItem('snappy.volume', JSON.stringify({ volume: video.volume, muted: video.muted })); } catch { /* ignore */ }
  });
  video.addEventListener('click', togglePlay);
  video.addEventListener('dblclick', () => toggleFullscreen());
  $('#bigPlay').addEventListener('click', togglePlay);
  $('#playBtn').addEventListener('click', togglePlay);
  $('#muteBtn').addEventListener('click', () => { video.muted = !video.muted; });
  $('#volumeSlider').addEventListener('input', (e) => { video.volume = Number(e.target.value); video.muted = video.volume === 0; });
  $('#speedSelect').addEventListener('change', (e) => { video.playbackRate = Number(e.target.value); });
  $('#fullscreenBtn').addEventListener('click', () => toggleFullscreen());

  // Fullscreen: tiny controls that fade out, together with the cursor, when the mouse rests
  let idleTimer = 0, fsDragging = false;
  const wake = () => {
    stage.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (document.fullscreenElement && !fsDragging) stage.classList.add('idle'); }, 1800);
  };
  state.wakeFullscreenControls = wake;
  stage.addEventListener('pointermove', () => { if (document.fullscreenElement) wake(); });
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement === stage;
    $('#fullscreenBtn use').setAttribute('href', fs ? '#i-fullscreen-exit' : '#i-fullscreen');
    if (fs) { renderTime(); wake(); }
    else { stage.classList.remove('idle'); clearTimeout(idleTimer); state.fullscreenExitedAt = performance.now(); }
  });
  $('#fsControls').addEventListener('click', (e) => e.stopPropagation());
  $('#fsPlay').addEventListener('click', () => { togglePlay(); wake(); });
  $('#fsMute').addEventListener('click', () => { video.muted = !video.muted; });
  $('#fsVolume').addEventListener('input', (e) => { video.volume = Number(e.target.value); video.muted = video.volume === 0; });
  $('#fsExit').addEventListener('click', () => toggleFullscreen());
  const fsSeek = (e) => {
    const r = $('#fsProgress').getBoundingClientRect();
    video.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * dur();
    renderTime();
  };
  $('#fsProgress').addEventListener('pointerdown', (e) => { fsDragging = true; $('#fsProgress').setPointerCapture(e.pointerId); fsSeek(e); });
  $('#fsProgress').addEventListener('pointermove', (e) => { if (fsDragging) fsSeek(e); });
  $('#fsProgress').addEventListener('pointerup', () => { fsDragging = false; wake(); });
  try {
    const saved = JSON.parse(localStorage.getItem('snappy.volume') || 'null');
    if (saved) { video.volume = saved.volume; video.muted = saved.muted; }
  } catch { /* ignore */ }

  // Timeline: seek, scrub and trim handles
  const track = $('.timeline-track');
  const timeAt = (clientX) => {
    const r = track.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * dur();
  };
  let drag = null, resumeAfterScrub = false;
  const onDrag = (e) => {
    const t = timeAt(e.clientX);
    if (drag === 'seek') video.currentTime = t;
    else { setTrimPoint(drag, t); video.currentTime = drag === 'start' ? state.trim.start : state.trim.end; }
    renderTime();
  };
  $('#timeline').addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !state.current) return;
    const marker = e.target.closest('[data-marker]');
    if (marker) { video.currentTime = Number(marker.dataset.marker); renderTime(); return; }
    const handle = e.target.closest('.trim-handle');
    drag = handle ? (handle.classList.contains('start') ? 'start' : 'end') : 'seek';
    handle?.classList.add('dragging');
    resumeAfterScrub = !video.paused;
    video.pause();
    $('#timeline').setPointerCapture(e.pointerId);
    onDrag(e);
  });
  $('#timeline').addEventListener('pointermove', (e) => {
    const r = track.getBoundingClientRect();
    const hover = $('#hoverTime');
    hover.hidden = false;
    hover.style.left = `${clamp(e.clientX - r.left, 0, r.width)}px`;
    hover.textContent = fmtTime(timeAt(e.clientX));
    if (drag) onDrag(e);
  });
  const endDrag = () => {
    if (!drag) return;
    $$('.trim-handle.dragging').forEach((h) => h.classList.remove('dragging'));
    if (drag === 'seek' && resumeAfterScrub) video.play().catch(() => {});
    drag = null;
  };
  $('#timeline').addEventListener('pointerup', endDrag);
  $('#timeline').addEventListener('pointercancel', endDrag);
  $('#timeline').addEventListener('pointerleave', () => { if (!drag) $('#hoverTime').hidden = true; });

  $('#resetTrimBtn').addEventListener('click', () => { state.trim = { start: 0, end: dur(), touched: false }; updateTrimUI(); });
  $('#saveTrimBtn').addEventListener('click', () => Editor.save(false));
  $('#replaceTrimBtn').addEventListener('click', () => Editor.save(true));

  // Settings
  const form = $('#settingsForm');
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.type !== 'range') return;
    el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    el.nextElementSibling.textContent = `${el.value}${el.dataset.unit}`;
  });
  $('#settingsNav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (b) document.getElementById(`set-${b.dataset.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#settingsScroller').addEventListener('scroll', () => requestAnimationFrame(updateSettingsNav), { passive: true });
  form.addEventListener('change', async (e) => {
    const durationSelect = e.target.closest('[data-duration-select]');
    const durationInput = e.target.closest('[data-duration-min], [data-duration-sec]');
    if (durationSelect || durationInput) { await onDurationChange(durationSelect, durationInput); return; }
    const el = e.target.closest('[data-setting]');
    if (!el) return;
    const key = el.dataset.setting;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'recording') {
      try { applyStatus(await snappy.call('recorder.pause', { paused: !value })); }
      catch (err) { toast({ kind: 'error', title: 'Something went wrong', sub: err.message }); }
      return;
    }
    await saveSettings((s) => {
      if (key === 'desktopDevice') {
        s.desktopAudioEnabled = value !== 'off';
        if (value !== 'off') s.desktopAudioDeviceId = value === 'default' ? '' : value;
      } else if (key === 'micDevice') {
        s.micEnabled = value !== 'off';
        if (value !== 'off') s.micDeviceId = value === 'default' ? '' : value;
      } else if (key === 'monitorDeviceName' || key === 'encoder' || key === 'trimMode') {
        s[key] = value;
      } else if (el.type === 'checkbox') {
        s[key] = value;
      } else {
        s[key] = Number(value);
      }
    });
  });
  form.addEventListener('click', async (e) => {
    const hk = e.target.closest('[data-hotkey]');
    if (hk) { startHotkeyCapture(hk); return; }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'pickFolder') {
      const folder = await snappy.call('settings.pickFolder');
      if (folder) {
        await saveSettings((s) => { s.clipsFolder = folder; });
        state.folder = '*';
        await refreshLibrary();
      }
    } else if (action === 'pickScreenshots') {
      const folder = await snappy.call('settings.pickFolder');
      if (folder) await saveSettings((s) => { s.screenshotsFolder = folder; });
    } else if (action === 'openLog') {
      snappy.call('app.openLog');
    } else if (action === 'openGithub' || action === 'openReleases') {
      snappy.call('app.openLink', { url: `https://github.com/slashneck/Snappy${action === 'openReleases' ? '/releases' : ''}` });
    } else if (action === 'licenses') {
      $('#licenses').hidden = false;
      $('#licensesClose').focus();
    } else if (action === 'checkUpdate') {
      state.update = { ...(state.update || {}), state: 'checking' };
      renderUpdateRow();
      snappy.call('update.check')
        .then((update) => { state.update = update; renderUpdateRow(); renderUpdatePill(); })
        .catch((err) => toast({ kind: 'error', title: "Couldn't check for updates", sub: err.message }));
    } else if (action === 'installUpdate') {
      snappy.call('update.install');
    }
  });

  $('#updatePill').addEventListener('click', () => snappy.call('update.install'));
  $('#licenses').addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) snappy.call('app.openLink', { url: link.dataset.link });
    else if (e.target.id === 'licenses' || e.target.id === 'licensesClose') $('#licenses').hidden = true;
  });

  // Menus close on outside click / scroll / resize
  document.addEventListener('mousedown', (e) => { if (!$('#menu').hidden && !e.target.closest('#menu')) hideMenu(); }, true);
  window.addEventListener('resize', hideMenu);
  $$('.scroller').forEach((s) => s.addEventListener('scroll', hideMenu, { passive: true }));

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!$('#modal').hidden) return;
    if (!$('#licenses').hidden) {
      if (e.key === 'Escape') $('#licenses').hidden = true;
      return;
    }
    if (e.key === 'Escape' && !$('#menu').hidden) { hideMenu(); return; }
    const el = e.target;
    const typing = el.matches('input:not([type=range]):not([type=checkbox]), select, textarea');

    if (state.view === 'player') {
      if (typing) return;
      if (window.Editor?.handleKey(e)) { e.preventDefault(); return; }
      const frame = 1 / 60;
      const handled = {
        ' ': togglePlay, k: togglePlay, K: togglePlay,
        ArrowLeft: () => { video.currentTime = Math.max(0, video.currentTime - 5); },
        ArrowRight: () => { video.currentTime = Math.min(dur(), video.currentTime + 5); },
        ',': () => { video.pause(); video.currentTime = Math.max(0, video.currentTime - frame); },
        '.': () => { video.pause(); video.currentTime = Math.min(dur(), video.currentTime + frame); },
        '[': () => jumpMarker(-1), ']': () => jumpMarker(1),
        i: () => { setTrimPoint('start', video.currentTime); }, I: () => { setTrimPoint('start', video.currentTime); },
        o: () => { setTrimPoint('end', video.currentTime); }, O: () => { setTrimPoint('end', video.currentTime); },
        m: () => { video.muted = !video.muted; }, M: () => { video.muted = !video.muted; },
        f: () => toggleFullscreen(), F: () => toggleFullscreen(),
        // Esc that just left fullscreen shouldn't also close the player
        Escape: () => { if (!document.fullscreenElement && performance.now() - (state.fullscreenExitedAt || 0) > 400) closePlayer(); },
        Delete: () => state.current && deleteClips([state.current.id]),
      }[e.key];
      if (handled) { e.preventDefault(); handled(); renderTime(); if (document.fullscreenElement) state.wakeFullscreenControls?.(); }
      return;
    }

    if (state.view === 'library') {
      if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (e.key === '/' && !typing)) {
        e.preventDefault();
        $('#searchInput').focus();
        return;
      }
      if (typing) {
        if (e.key === 'Escape') { el.value = ''; state.search = ''; el.blur(); renderGrid(); }
        return;
      }
      if (e.key === 'Escape' && state.selecting) setSelecting(false);
      if (e.key === 'Delete' && state.selected.size) deleteClips([...state.selected]);
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        state.selecting = true;
        visibleClips().forEach((c) => state.selected.add(c.id));
        renderGrid();
      }
      return;
    }

    if (state.view === 'studio') { window.Studio?.handleKey(e, typing); return; }
    if (state.view === 'settings' && e.key === 'Escape' && !typing) selectFolder(state.folder);
  });

  // Live updates from the recorder
  snappy.on('status', applyStatus);
  snappy.on('libraryChanged', debounce(refreshLibrary, 150));
  snappy.on('trimProgress', ({ progress }) => {
    $('#trimProgressFill').style.width = `${Math.round(progress * 100)}%`;
    $('#stageBusyText').textContent = `Trimming… ${Math.round(progress * 100)}%`;
  });
  snappy.on('screenshotSaved', ({ folder }) => {
    toast({ kind: 'success', title: 'Screenshot saved', sub: folder || '', action: { label: 'Show', fn: () => snappy.call('screenshots.open') } });
  });
  snappy.on('updateChanged', (update) => {
    state.update = update;
    renderUpdatePill();
    renderUpdateRow();
  });
  snappy.on('momentMarked', () => toast({ title: 'Moment marked', sub: 'It shows on the timeline of your next clip' }));
  snappy.on('clipSaving', () => {
    setTask('clipping');
    Mascot.hold('clip', 'clipping');
    const b = $('#saveClipBtn');
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  });
  snappy.on('clipSaved', async (r) => {
    setTask('');
    Mascot.release('clip');
    if (!r.success) { toast({ kind: 'error', title: "Couldn't save clip", sub: r.error, timeout: 7000 }); return; }
    Mascot.flash('happy', 1300);
    if (r.id) state.newIds.add(r.id);
    await refreshLibrary();
    const clip = r.id && byId(r.id);
    toast({
      kind: 'success', title: 'Clip saved', sub: `${fmtDuration(r.durationSeconds)} · ${r.appName}`,
      action: clip ? { label: 'Watch', fn: () => openClip(clip) } : null, timeout: 6000,
    });
    setTimeout(() => state.newIds.delete(r.id), 2000);
  });
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else $('#stage').requestFullscreen().catch(() => {});
}

async function init() {
  Mascot.mount($('#mascot'));
  Mascot.mount($('#emptyArt'));
  Mascot.mount($('#stageBusyMascot'));
  bind();
  Mascot.hold('init', 'working');
  try {
    const data = await snappy.call('app.init');
    state.settings = data.settings;
    state.version = data.version;
    state.update = data.update;
    renderUpdatePill();
    applySettingsToChrome();
    applyStatus(data.status);
    setLibrary(data.library);
    Mascot.release('init');
  } catch (err) {
    Mascot.release('init');
    toast({ kind: 'error', title: 'Snappy couldn’t load your library', sub: err.message, timeout: 10000 });
  }
}

init();
