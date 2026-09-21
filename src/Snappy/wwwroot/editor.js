'use strict';

// Clip editor: Trim (timeline handles, in app.js), Audio and Crop. Everything is applied by one export.
// Uses globals from app.js: state, $, $$, icon, esc, clamp, fmtTime, toast, modal, snappy, video, dur, pct,
// refreshLibrary, byId, renderClipMeta, loadVideo, releaseVideo, openClip, updateTrimUI, Mascot.

const Editor = (() => {
  const ed = {
    clip: null, info: null, tab: 'trim',
    lanes: [], lanesLoaded: false, laneSource: false,
    crop: null, aspect: 'free', cropApplied: false,
    selectedRegion: null,
    view: null, // the part of the clip the audio tracks show, { start, end } in seconds, null = all of it
  };
  let actx = null, videoGain = null;
  const stage = $('#stage');

  async function open(clip) {
    close();
    ed.clip = clip;
    setTab('trim');
    try {
      ed.info = await snappy.call('clip.info', { id: clip.id });
    } catch (err) {
      ed.info = null;
      console.error(err);
    }
    renderTabs();
  }

  function close() {
    for (const lane of ed.lanes) { lane.audio?.pause(); lane.audio?.removeAttribute('src'); lane.audio?.load(); }
    ed.lanes = [];
    ed.lanesLoaded = false;
    ed.laneSource = false;
    if (videoGain) videoGain.gain.value = 1;
    ed.crop = null;
    ed.aspect = 'free';
    ed.cropApplied = false;
    showCropped();
    ed.selectedRegion = null;
    ed.view = null;
    ed.clip = null;
    ed.info = null;
    $('#editLanes').innerHTML = '';
    $('#cropLayer').hidden = true;
  }

  const audioEdited = () => ed.lanes.some((l) => l.muted || Math.abs(l.volume - 1) > 0.001 || l.mutes.length > 0);
  const hasEdits = () => !!ed.crop || audioEdited();

  function setTab(tab) {
    ed.tab = tab;
    $$('#editTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.edit-pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
    $('#editPanel').hidden = tab === 'trim';
    $('#editLanes').hidden = tab !== 'audio';
    $('#cropLayer').hidden = tab !== 'crop' || !!document.fullscreenElement || ed.cropApplied;
    if (tab === 'audio') openAudio();
    if (tab === 'crop') openCrop();
    layoutLayers();
  }

  function renderTabs() {
    const marks = { trim: state.trim.touched, audio: audioEdited(), crop: !!ed.crop };
    $$('#editTabs button').forEach((b) => b.classList.toggle('edited', !!marks[b.dataset.tab]));
    updateTrimUI();
  }

  // Where the picture sits inside the stage (object-fit: contain).
  function videoRect() {
    const s = stage.getBoundingClientRect();
    const vw = video.videoWidth || ed.info?.width || 16, vh = video.videoHeight || ed.info?.height || 9;
    const scale = Math.min(s.width / vw, s.height / vh);
    const w = vw * scale, h = vh * scale;
    return { left: (s.width - w) / 2, top: (s.height - h) / 2, width: w, height: h, scale, vw, vh };
  }

  function layoutLayers() {
    if (!ed.clip) return;
    const r = videoRect();
    const layer = $('#cropLayer');
    layer.style.left = `${r.left}px`; layer.style.top = `${r.top}px`;
    layer.style.width = `${r.width}px`; layer.style.height = `${r.height}px`;
    if (ed.tab === 'crop') renderCropBox();
    if (ed.cropApplied) showCropped();
    for (const lane of ed.lanes) drawWaveform(lane);
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  function ensureGraph() {
    if (actx) return actx;
    actx = new AudioContext();
    videoGain = actx.createGain();
    actx.createMediaElementSource(video).connect(videoGain).connect(actx.destination);
    return actx;
  }

  // Track one is the mix a player uses; everything after it is a lane you can edit.
  const isMixTrack = (t) => t.title.includes('+') || t.title.toLowerCase() === 'mix';

  async function openAudio() {
    const pane = $('#audioPane');
    if (!ed.info) { pane.innerHTML = '<span class="hint">Loading…</span>'; return; }
    if (!ed.info.audioTracks.length) { pane.innerHTML = '<span class="hint">This clip has no audio.</span>'; return; }
    if (ed.lanesLoaded) { renderAudioPane(); return; }
    ed.lanesLoaded = true;

    const tracks = ed.info.audioTracks;
    const named = (n) => tracks.find((t) => t.title.toLowerCase() === n);
    // Clips split by program carry a lane per program; the desktop track holds the same sound and stays out of the way.
    const programs = tracks.filter((t) => t.title && !isMixTrack(t) && !['desktop', 'mic'].includes(t.title.toLowerCase()));
    let desktop = named('desktop'), mic = named('mic');
    if ((!desktop || !mic) && tracks.length === 3 && tracks.every((t) => !t.title)) { desktop = tracks[1]; mic = tracks[2]; }
    let picks;
    if (programs.length) picks = programs.concat(mic ? [mic] : []).map((t) => [t, t.title]);
    else if (desktop && mic) picks = [[desktop, 'Desktop'], [mic, 'Mic']];
    else picks = tracks.map((t, i) => [t, t.title || (tracks.length === 1 ? 'Audio' : `Track ${i + 1}`)]);
    ed.lanes = picks.map(([t, name]) => ({ track: t.index, name, volume: 1, muted: false, mutes: [], peaks: null, audio: null, gain: null }));
    renderLanes();
    renderAudioPane();

    const clipId = ed.clip.id;
    Mascot.hold('audio', 'working');
    try {
      ensureGraph();
      await Promise.all(ed.lanes.map(async (lane) => {
        const [peaks, url] = await Promise.all([
          snappy.call('clip.waveform', { id: clipId, track: lane.track }),
          snappy.call('clip.previewAudio', { id: clipId, track: lane.track }),
        ]);
        if (ed.clip?.id !== clipId) return;
        lane.peaks = peaks;
        const a = new Audio();
        a.crossOrigin = 'anonymous';
        a.preload = 'auto';
        a.src = url;
        lane.gain = actx.createGain();
        actx.createMediaElementSource(a).connect(lane.gain).connect(actx.destination);
        lane.audio = a;
        drawWaveform(lane);
      }));
      if (ed.clip?.id !== clipId) return;
      // Each track now plays on its own so mutes and volume changes are audible while editing.
      ed.laneSource = true;
      syncLanes(true);
    } catch (err) {
      toast({ kind: 'error', title: 'Couldn’t load the audio tracks', sub: err.message });
    } finally {
      Mascot.release('audio');
    }
  }

  // The tracks can be zoomed: scroll to zoom in around the pointer, Shift + scroll (or a sideways scroll) to move.
  const viewStart = () => ed.view?.start ?? 0;
  const viewEnd = () => ed.view?.end ?? dur();
  const vpct = (t) => { const s = viewStart(), e = viewEnd(); return e > s ? ((t - s) / (e - s)) * 100 : 0; };

  function setView(start, end) {
    const d = dur();
    if (!d) return;
    const span = clamp(end - start, Math.min(d, 0.4), d);
    start = clamp(start, 0, d - span);
    ed.view = span >= d - 0.001 ? null : { start, end: start + span };
    for (const lane of ed.lanes) { renderRegions(lane); drawWaveform(lane); }
    renderAudioPane();
  }

  function zoomLanes(e) {
    if (ed.tab !== 'audio' || !ed.lanes.length || !dur()) return;
    e.preventDefault();
    const body = e.target.closest('.lane-body') || $('#editLanes .lane-body');
    const r = body.getBoundingClientRect();
    const s = viewStart(), span = viewEnd() - s;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const delta = ((e.shiftKey ? e.deltaY : e.deltaX) / r.width) * span;
      setView(s + delta, s + delta + span);
      return;
    }
    const at = s + clamp((e.clientX - r.left) / r.width, 0, 1) * span;
    const next = span * Math.pow(1.0015, e.deltaY);
    const frac = (at - s) / span;
    setView(at - frac * next, at - frac * next + next);
  }

  function renderLanes() {
    $('#editLanes').innerHTML = ed.lanes.map((lane, i) => `
      <div class="lane${lane.muted ? ' muted' : ''}" data-lane="${i}">
        <div class="lane-body">
          <canvas></canvas>
          <div class="lane-chip">
            <button class="lane-mute" data-lane-mute="${i}" title="${lane.muted ? 'Unmute' : 'Mute'} ${esc(lane.name)}">${icon(lane.muted ? 'mute' : 'volume')}</button>
            <span>${esc(lane.name)}</span>
          </div>
          <div class="lane-regions"></div>
          <div class="lane-playhead"></div>
        </div>
      </div>`).join('');
    ed.lanes.forEach((lane, i) => { lane.el = $(`[data-lane="${i}"]`); renderRegions(lane); drawWaveform(lane); });
  }

  function renderAudioPane() {
    $('#audioPane').innerHTML = ed.lanes.map((lane, i) => `
      <div class="group"><span>${esc(lane.name)}</span>
        <input type="range" min="0" max="200" step="5" value="${Math.round(lane.volume * 100)}" data-lane-volume="${i}" style="--fill:${lane.volume * 50}%">
        <span class="value">${Math.round(lane.volume * 100)}%</span></div>
      <div class="divider"></div>`).join('')
      + (ed.view
        ? `<span class="hint">Showing ${fmtTime(viewStart())} to ${fmtTime(viewEnd())}. Shift + scroll moves along</span>`
          + '<button class="link-btn" data-zoom-fit>Show all</button>'
        : '<span class="hint">Drag across a track to mute that moment. Scroll over the tracks to zoom in</span>')
      + '<div class="spacer"></div>'
      + (audioEdited() ? '<button class="link-btn" data-audio-reset>Reset audio</button>' : '');
  }

  function drawWaveform(lane) {
    const canvas = lane.el?.querySelector('canvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lane.peaks) {
      ctx.fillStyle = 'rgba(244,244,244,0.25)';
      ctx.fillRect(0, canvas.height / 2 - dpr / 2, canvas.width, dpr);
      return;
    }
    // Every column shows the loudest moment in the stretch of time it covers, so short sounds never fall between.
    const n = lane.peaks.length, mid = canvas.height / 2, d = dur() || 1;
    const perBucket = d / n, s = viewStart(), span = viewEnd() - s;
    const pxPerBucket = canvas.width / (span / perBucket);
    const gap = pxPerBucket > 3 ? 1 : 0;
    const bar = Math.max(1, Math.floor(pxPerBucket) - gap);
    ctx.fillStyle = 'rgba(244,244,244,0.6)';
    for (let x = 0; x < canvas.width; x += bar + gap) {
      const t0 = s + (x / canvas.width) * span, t1 = s + ((x + bar + gap) / canvas.width) * span;
      let p = 0;
      const last = Math.min(n - 1, Math.ceil(t1 / perBucket) - 1);
      for (let i = Math.floor(t0 / perBucket); i <= Math.max(last, Math.floor(t0 / perBucket)); i++) p = Math.max(p, lane.peaks[i] || 0);
      const h = Math.max(dpr, Math.pow(p, 0.7) * (canvas.height - 6 * dpr));
      ctx.fillRect(x, mid - h / 2, bar, h);
    }
  }

  function renderRegions(lane) {
    const host = lane.el?.querySelector('.lane-regions');
    if (!host) return;
    host.innerHTML = lane.mutes.map((m, j) => {
      const sel = ed.selectedRegion && ed.selectedRegion.lane === lane && ed.selectedRegion.index === j;
      return `<div class="mute-region${sel ? ' selected' : ''}" data-region="${j}" style="left:${vpct(m.start)}%;width:${vpct(m.end) - vpct(m.start)}%" title="Muted from ${fmtTime(m.start)} to ${fmtTime(m.end)}">
        <span class="edge l" data-edge="start"></span><span class="edge r" data-edge="end"></span><span class="region-del" data-region-del="${j}">×</span></div>`;
    }).join('');
  }

  function normalizeMutes(lane) {
    const d = dur();
    const list = lane.mutes
      .map((m) => ({ start: clamp(Math.min(m.start, m.end), 0, d), end: clamp(Math.max(m.start, m.end), 0, d) }))
      .filter((m) => m.end - m.start >= 0.05)
      .sort((a, b) => a.start - b.start);
    const merged = [];
    for (const m of list) {
      const last = merged[merged.length - 1];
      if (last && m.start <= last.end + 0.02) last.end = Math.max(last.end, m.end);
      else merged.push({ ...m });
    }
    lane.mutes = merged;
  }

  function laneTime(lane, clientX) {
    const r = lane.el.querySelector('.lane-body').getBoundingClientRect();
    return viewStart() + clamp((clientX - r.left) / r.width, 0, 1) * (viewEnd() - viewStart());
  }

  function audioChanged(lane) {
    if (lane) renderRegions(lane);
    renderAudioPane();
    renderTabs();
  }

  function bindLanes() {
    const host = $('#editLanes');
    let drag = null;
    host.addEventListener('pointerdown', (e) => {
      const laneEl = e.target.closest('[data-lane]');
      if (!laneEl || e.button !== 0) return;
      const lane = ed.lanes[Number(laneEl.dataset.lane)];
      if (e.target.closest('[data-lane-mute]')) {
        lane.muted = !lane.muted;
        renderLanes();
        audioChanged();
        return;
      }
      const del = e.target.closest('[data-region-del]');
      if (del) {
        lane.mutes.splice(Number(del.dataset.regionDel), 1);
        ed.selectedRegion = null;
        audioChanged(lane);
        return;
      }
      const t = laneTime(lane, e.clientX);
      const regionEl = e.target.closest('[data-region]');
      if (regionEl) {
        const index = Number(regionEl.dataset.region);
        const m = lane.mutes[index];
        drag = { lane, index, mode: e.target.closest('[data-edge]')?.dataset.edge || 'move', offset: t - m.start, length: m.end - m.start };
      } else {
        lane.mutes.push({ start: t, end: t });
        drag = { lane, index: lane.mutes.length - 1, mode: 'create', anchor: t };
      }
      ed.selectedRegion = { lane, index: drag.index };
      try { laneEl.querySelector('.lane-body').setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      renderRegions(lane);
    });
    host.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const t = laneTime(drag.lane, e.clientX);
      const m = drag.lane.mutes[drag.index];
      if (drag.mode === 'create') { m.start = Math.min(drag.anchor, t); m.end = Math.max(drag.anchor, t); }
      else if (drag.mode === 'start') m.start = Math.min(t, m.end - 0.05);
      else if (drag.mode === 'end') m.end = Math.max(t, m.start + 0.05);
      else { m.start = clamp(t - drag.offset, 0, dur() - drag.length); m.end = m.start + drag.length; }
      renderRegions(drag.lane);
    });
    const finish = () => {
      if (!drag) return;
      const { lane, mode } = drag;
      const m = lane.mutes[drag.index];
      if (mode === 'create' && m.end - m.start < 0.05) {
        // A plain click seeks instead of creating a tiny region.
        video.currentTime = m.start;
        lane.mutes.splice(drag.index, 1);
        ed.selectedRegion = null;
      }
      drag = null;
      normalizeMutes(lane);
      if (ed.selectedRegion && !lane.mutes[ed.selectedRegion.index]) ed.selectedRegion = null;
      audioChanged(lane);
    };
    host.addEventListener('pointerup', finish);
    host.addEventListener('pointercancel', finish);

    const pane = $('#audioPane');
    pane.addEventListener('input', (e) => {
      const i = e.target.dataset.laneVolume;
      if (i === undefined) return;
      const lane = ed.lanes[Number(i)];
      lane.volume = Number(e.target.value) / 100;
      e.target.style.setProperty('--fill', `${lane.volume * 50}%`);
      e.target.nextElementSibling.textContent = `${e.target.value}%`;
      renderTabs();
    });
    pane.addEventListener('change', () => renderAudioPane());
    host.addEventListener('wheel', zoomLanes, { passive: false });
    host.addEventListener('dblclick', (e) => { if (!e.target.closest('[data-region]')) setView(0, dur()); });
    pane.addEventListener('click', (e) => {
      if (e.target.closest('[data-zoom-fit]')) { setView(0, dur()); return; }
      if (!e.target.closest('[data-audio-reset]')) return;
      ed.lanes.forEach((l) => { l.volume = 1; l.muted = false; l.mutes = []; });
      ed.selectedRegion = null;
      renderLanes();
      audioChanged();
    });
  }

  function syncLanes(force) {
    if (!ed.laneSource) return;
    for (const lane of ed.lanes) {
      const a = lane.audio;
      if (!a) continue;
      a.playbackRate = video.playbackRate;
      if (force || Math.abs(a.currentTime - video.currentTime) > 0.07) a.currentTime = video.currentTime;
      if (video.paused && !a.paused) a.pause();
      if (!video.paused && a.paused) a.play().catch(() => {});
    }
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!ed.clip || state.view !== 'player') return;
    const t = video.currentTime;
    if (ed.laneSource) {
      if (videoGain) videoGain.gain.value = 0;
      for (const lane of ed.lanes) {
        if (!lane.audio || !lane.gain) continue;
        lane.audio.volume = video.volume;
        lane.audio.muted = video.muted;
        const inMute = lane.mutes.some((m) => t >= m.start && t < m.end);
        lane.gain.gain.setTargetAtTime(lane.muted || inMute ? 0 : lane.volume, actx.currentTime, 0.01);
      }
      if (!video.paused) syncLanes(false);
    }
    if (ed.tab === 'audio') {
      // While playing, a zoomed view turns the page when the playhead reaches its edge.
      if (ed.view && !video.paused && (t > ed.view.end || t < ed.view.start)) {
        const span = ed.view.end - ed.view.start;
        setView(t - span * 0.1, t + span * 0.9);
      }
      const x = vpct(t);
      for (const lane of ed.lanes) {
        const ph = lane.el?.querySelector('.lane-playhead');
        if (!ph) continue;
        ph.style.left = `${x}%`;
        ph.hidden = x < 0 || x > 100;
      }
    }
  }

  function bindVideo() {
    video.addEventListener('play', () => { actx?.resume(); syncLanes(true); });
    video.addEventListener('pause', () => syncLanes(true));
    video.addEventListener('seeked', () => syncLanes(true));
    video.addEventListener('ratechange', () => syncLanes(true));
    video.addEventListener('loadedmetadata', layoutLayers);
    window.addEventListener('resize', layoutLayers);
    document.addEventListener('fullscreenchange', () => {
      $('#cropLayer').hidden = ed.tab !== 'crop' || !!document.fullscreenElement || ed.cropApplied;
      setTimeout(layoutLayers, 50);
    });
  }

  // ---------------------------------------------------------------------------
  // Crop
  // ---------------------------------------------------------------------------
  const ASPECTS = { free: null, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

  const frame = () => { const r = videoRect(); return { w: r.vw, h: r.vh }; };
  const currentCrop = () => { const f = frame(); return ed.crop || { x: 0, y: 0, w: f.w, h: f.h }; };
  const sizeText = (c) => `${Math.round(c.w)} × ${Math.round(c.h)}`;

  function openCrop() {
    renderCropPane();
    renderCropBox();
  }

  function renderCropPane() {
    if (ed.cropApplied) {
      $('#cropPane').innerHTML = `
        <span class="hint">Showing the cropped picture (${sizeText(currentCrop())}). Nothing changes on disk until you replace the clip or save it as a new one.</span>
        <div class="spacer"></div>
        <button class="btn ghost sm" data-crop-edit>Edit crop</button>
        <button class="link-btn" data-crop-reset>Reset crop</button>`;
      return;
    }
    $('#cropPane').innerHTML = `
      <div class="segmented" id="aspectPicker">${Object.keys(ASPECTS).map((a) => `<button data-aspect="${a}" class="${ed.aspect === a ? 'active' : ''}">${a === 'free' ? 'Free' : a}</button>`).join('')}</div>
      <span class="hint">${sizeText(currentCrop())}</span>
      <div class="spacer"></div>
      ${ed.crop ? '<button class="link-btn" data-crop-reset>Reset crop</button><button class="btn sm" data-crop-apply>Apply crop</button>' : ''}`;
  }

  // An applied crop shows in the player right away: the video is scaled so the cropped part fills the player, and
  // everything around it is clipped away. The file only changes once the clip is replaced or saved as a new one.
  function showCropped() {
    const c = ed.cropApplied ? ed.crop : null;
    if (c && video.videoWidth) {
      const r = videoRect(), s = stage.getBoundingClientRect();
      const x = r.left + c.x * r.scale, y = r.top + c.y * r.scale, w = c.w * r.scale, h = c.h * r.scale;
      const k = Math.min(s.width / w, s.height / h);
      video.style.transformOrigin = '0 0';
      video.style.transform = `translate(${(s.width - w * k) / 2 - x * k}px, ${(s.height - h * k) / 2 - y * k}px) scale(${k})`;
      video.style.clipPath = `inset(${y}px ${s.width - x - w}px ${s.height - y - h}px ${x}px)`;
    } else {
      video.style.transform = '';
      video.style.transformOrigin = '';
      video.style.clipPath = '';
    }
    $('#cropLayer').hidden = ed.tab !== 'crop' || !!document.fullscreenElement || ed.cropApplied;
  }

  function setCropApplied(on) {
    ed.cropApplied = on && !!ed.crop;
    showCropped();
    renderCropPane();
    if (!ed.cropApplied) renderCropBox();
    renderTabs();
  }

  function renderCropBox() {
    const r = videoRect(), c = currentCrop();
    const box = $('#cropBox');
    box.style.left = `${c.x * r.scale}px`; box.style.top = `${c.y * r.scale}px`;
    box.style.width = `${c.w * r.scale}px`; box.style.height = `${c.h * r.scale}px`;
    $('#cropSize').textContent = sizeText(c);
  }

  function setAspect(aspect) {
    ed.aspect = aspect;
    const ratio = ASPECTS[aspect];
    if (ratio) {
      const f = frame(), c = currentCrop();
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      let w = f.w, h = w / ratio;
      if (h > f.h) { h = f.h; w = h * ratio; }
      commitCrop({ x: clamp(cx - w / 2, 0, f.w - w), y: clamp(cy - h / 2, 0, f.h - h), w, h });
    }
    renderCropPane();
    renderCropBox();
  }

  function commitCrop(c) {
    const f = frame();
    const full = c.x <= 0.5 && c.y <= 0.5 && c.w >= f.w - 1 && c.h >= f.h - 1;
    ed.crop = full ? null : { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h) };
    renderTabs();
  }

  function bindCrop() {
    const layer = $('#cropLayer');
    let drag = null;
    layer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const handle = e.target.closest('[data-handle]')?.dataset.handle || (e.target.closest('#cropBox') ? 'move' : null);
      if (!handle) return;
      drag = { handle, start: { ...currentCrop() }, px: e.clientX, py: e.clientY, scale: videoRect().scale };
      try { layer.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      e.preventDefault();
    });
    layer.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const f = frame(), s = drag.start, ratio = ASPECTS[ed.aspect];
      const dx = (e.clientX - drag.px) / drag.scale, dy = (e.clientY - drag.py) / drag.scale;
      const min = 64;
      let { x, y, w, h } = s;
      if (drag.handle === 'move') {
        x = clamp(s.x + dx, 0, f.w - s.w);
        y = clamp(s.y + dy, 0, f.h - s.h);
      } else {
        const left = drag.handle.includes('w'), top = drag.handle.includes('n');
        let nx = left ? s.x + dx : s.x, ny = top ? s.y + dy : s.y;
        let nw = left ? s.w - dx : s.w + dx, nh = top ? s.h - dy : s.h + dy;
        nx = clamp(nx, 0, s.x + s.w - min);
        ny = clamp(ny, 0, s.y + s.h - min);
        nw = clamp(nw, min, left ? s.x + s.w - nx : f.w - s.x);
        nh = clamp(nh, min, top ? s.y + s.h - ny : f.h - s.y);
        if (left) nx = s.x + s.w - nw;
        if (top) ny = s.y + s.h - nh;
        if (ratio) {
          if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio;
          if (left) nx = s.x + s.w - nw;
          if (top) ny = s.y + s.h - nh;
          if (nx < 0 || ny < 0 || nx + nw > f.w || ny + nh > f.h) return;
        }
        x = nx; y = ny; w = nw; h = nh;
      }
      commitCrop({ x, y, w, h });
      renderCropBox();
    });
    const end = () => { if (drag) { drag = null; renderCropPane(); } };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    $('#cropPane').addEventListener('click', (e) => {
      const a = e.target.closest('[data-aspect]');
      if (a) { setAspect(a.dataset.aspect); return; }
      if (e.target.closest('[data-crop-apply]')) { setCropApplied(true); return; }
      if (e.target.closest('[data-crop-edit]')) { setCropApplied(false); return; }
      if (e.target.closest('[data-crop-reset]')) {
        ed.crop = null;
        ed.aspect = 'free';
        setCropApplied(false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  function buildSpec(replace) {
    return {
      start: state.trim.touched ? state.trim.start : 0,
      end: state.trim.touched ? state.trim.end : dur(),
      mode: state.trimMode,
      replace,
      crop: ed.crop ? { x: ed.crop.x, y: ed.crop.y, width: ed.crop.w, height: ed.crop.h } : null,
      audio: ed.lanes.map((l) => ({ track: l.track, volume: l.volume, muted: l.muted, mutes: l.mutes.map((m) => ({ start: m.start, end: m.end })) })),
    };
  }

  async function save(replace) {
    const clip = state.current;
    if (!clip || state.busy || !(state.trim.touched || hasEdits())) return;
    if (replace) {
      const ok = await modal({ title: 'Replace the original?', text: 'The unedited clip goes to the Recycle Bin, so you can still restore it.', ok: 'Replace', danger: true });
      if (!ok) return;
    }
    const spec = buildSpec(replace);
    const reencode = !!(spec.crop || spec.mode === 'precise');
    state.busy = true;
    state.mutating = true;
    Mascot.hold('export', hasEdits() ? 'working' : 'trimming');
    $('#stageBusyText').textContent = reencode ? 'Saving…' : 'Trimming…';
    $('#stageBusy').hidden = false;
    $('#trimProgress').hidden = false;
    $('#trimProgressFill').style.width = '0%';
    updateTrimUI();
    for (const lane of ed.lanes) lane.audio?.pause();
    const pos = replace ? releaseVideo() : null;
    if (!replace) video.pause();
    try {
      const newId = await snappy.call('clip.export', { id: clip.id, spec });
      if (!replace) state.newIds.add(newId);
      await refreshLibrary();
      const result = byId(newId);
      Mascot.flash('happy', 1300);
      if (replace) {
        state.trim = { start: 0, end: 0, touched: false };
        if (result) { state.current = result; renderClipMeta(); loadVideo(result.videoUrl, 0, false); open(result); }
        toast({ kind: 'success', title: 'Clip updated', sub: 'The original is in the Recycle Bin' });
      } else {
        toast({ kind: 'success', title: 'Edited clip saved', sub: result?.title || '', action: result ? { label: 'Open', fn: () => openClip(result) } : null, timeout: 6000 });
      }
    } catch (err) {
      toast({ kind: 'error', title: 'Couldn’t save the edit', sub: err.message, timeout: 8000 });
      if (pos) loadVideo(clip.videoUrl, pos.at, false);
    } finally {
      state.busy = false;
      state.mutating = false;
      Mascot.release('export');
      $('#stageBusy').hidden = true;
      setTimeout(() => { $('#trimProgress').hidden = true; }, 400);
      updateTrimUI();
    }
  }

  /** Makes a copy that fits in targetMb (with the current trim, crop and audio edits) and copies it to the clipboard. */
  async function shrink(targetMb) {
    const clip = state.current;
    if (!clip || state.busy) return;
    const spec = buildSpec(false);
    state.busy = true;
    state.busyLabel = 'Shrinking';
    Mascot.hold('export', 'working');
    $('#stageBusyText').textContent = `Shrinking to ${targetMb} MB…`;
    $('#stageBusy').hidden = false;
    $('#trimProgress').hidden = false;
    $('#trimProgressFill').style.width = '0%';
    updateTrimUI();
    video.pause();
    try {
      const newId = await snappy.call('clip.shrink', { id: clip.id, spec, targetMb });
      state.newIds.add(newId);
      await refreshLibrary();
      Mascot.flash('happy', 1300);
      const result = byId(newId);
      toast({
        kind: 'success', title: 'Copied. Paste it into Discord', sub: result ? `${result.title} · ${fmtSize(result.size)}` : '',
        action: { label: 'Show', fn: () => snappy.call('clip.reveal', { id: newId }) }, timeout: 7000,
      });
    } catch (err) {
      toast({ kind: 'error', title: 'Couldn’t shrink the clip', sub: err.message, timeout: 8000 });
    } finally {
      state.busy = false;
      state.busyLabel = null;
      Mascot.release('export');
      $('#stageBusy').hidden = true;
      setTimeout(() => { $('#trimProgress').hidden = true; }, 400);
      updateTrimUI();
    }
  }

  /** Delete removes a selected muted range before the player's own shortcuts see the key. */
  function handleKey(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && ed.tab === 'audio' && ed.selectedRegion) {
      const { lane, index } = ed.selectedRegion;
      lane.mutes.splice(index, 1);
      ed.selectedRegion = null;
      audioChanged(lane);
      return true;
    }
    return false;
  }

  $('#editTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  snappy.on('exportProgress', ({ progress }) => {
    $('#trimProgressFill').style.width = `${Math.round(progress * 100)}%`;
    $('#stageBusyText').textContent = `${state.busyLabel || 'Saving'}… ${Math.round(progress * 100)}%`;
  });
  bindLanes();
  bindCrop();
  bindVideo();
  requestAnimationFrame(tick);

  return { open, close, hasEdits, save, shrink, handleKey, renderTabs, layoutLayers, get state() { return ed; } };
})();

window.Editor = Editor;
