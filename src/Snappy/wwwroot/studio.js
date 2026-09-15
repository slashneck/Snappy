'use strict';

// Studio: scenes of layers (pictures, GIFs, a facecam, key presses) that Snappy blends into clips while recording.
// Nothing here is drawn on the real screen. The preview only shows what clips will look like.
const Studio = (() => {
  const LAYER_NAMES = { image: 'Image', gif: 'GIF', webcam: 'Facecam', inputs: 'Keys and mouse' };
  const LAYER_ICONS = { image: 'image', gif: 'image', webcam: 'webcam', inputs: 'keyboard' };
  const OFF_PREFIX = 'Studio layers are off: ';
  const dpr = () => window.devicePixelRatio || 1;

  const S = {
    active: false,
    gen: 0,
    setup: null,
    sceneId: null,
    selected: null,
    width: 1920,
    height: 1080,
    stageW: 0,
    stageH: 0,
    presets: [],
    liveSceneId: null,
    error: null,
    input: InputOverlay.idle(),
    inputDirty: true,
    cameras: null,
    cameraLoad: null,
    cameraErrors: new Map(),
    cameraChecked: new Map(),
    lastScreen: null,
  };

  const stage = $('#studioStage');
  const screenCanvas = $('#studioScreen');
  const layersEl = $('#studioLayers');
  const selectionEl = $('#studioSelection');
  const panel = $('#studioPanel');
  const cameraLoops = new Map(); // device -> { img }
  let applyTimer = 0, pendingApply = false, frameNo = 0, lastDraw = 0;

  const scene = () => S.setup?.scenes.find((s) => s.id === S.sceneId) || null;
  const findLayer = (id) => scene()?.layers.find((l) => l.id === id) || null;
  const selectedLayer = () => findLayer(S.selected);
  const layerElement = (id) => layersEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const layerName = (l) => l.name || LAYER_NAMES[l.type];
  const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

  function throttle(fn, ms) {
    let last = 0, timer = 0;
    return () => {
      clearTimeout(timer);
      const wait = last + ms - Date.now();
      if (wait <= 0) { last = Date.now(); fn(); }
      else timer = setTimeout(() => { last = Date.now(); fn(); }, wait);
    };
  }

  // ---------- open / close ----------
  async function enter() {
    if (S.active) return;
    S.active = true;
    const gen = ++S.gen;
    S.cameras = null;
    try {
      const data = await snappy.call('studio.get');
      if (gen !== S.gen) return;
      Object.assign(S, {
        setup: data.setup, width: data.width, height: data.height, presets: data.presets,
        liveSceneId: data.liveSceneId, error: data.error,
      });
      if (!scene()) S.sceneId = S.setup.defaultSceneId || S.setup.scenes[0]?.id;
      if (!selectedLayer()) S.selected = null;
      await snappy.call('studio.open');
      if (gen !== S.gen) return;
    } catch (err) {
      toast({ kind: 'error', title: "Couldn't open Studio", sub: err.message });
      return;
    }
    render();
    sendPreview();
    pullScreen(gen);
    requestAnimationFrame((t) => tick(gen, t));
  }

  function leave() {
    if (!S.active) return;
    S.active = false;
    S.gen++;
    flushApply();
    cameraLoops.clear();
    stage.classList.remove('live');
    snappy.call('studio.close').catch(() => {});
  }

  // ---------- saving ----------
  const sendPreview = throttle(() => {
    const sc = scene();
    if (S.active && sc) snappy.call('studio.preview', { scene: sc }).catch(() => {});
  }, 150);

  /** Records a change: redraws what's needed, updates the preview right away and saves a moment later. */
  function commit({ rebuild = false, panel: withPanel = true, scenes = false } = {}) {
    if (scenes) renderScenes();
    if (rebuild) renderLayers();
    else {
      for (const l of scene()?.layers || []) placeLayer(layerElement(l.id), l);
      renderSelection();
    }
    if (withPanel) renderPanel();
    sendPreview();
    pendingApply = true;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(flushApply, 1000);
  }

  function flushApply() {
    clearTimeout(applyTimer);
    if (!pendingApply || !S.setup) return;
    pendingApply = false;
    snappy.call('studio.apply', { setup: S.setup })
      .then((r) => {
        if (!r) return;
        S.liveSceneId = r.liveSceneId;
        if (S.active) renderScenes();
      })
      .catch((err) => toast({ kind: 'error', title: "Couldn't save Studio", sub: err.message }));
  }

  // ---------- rendering ----------
  function render() {
    if (!S.active || !S.setup) return;
    renderToolbar();
    renderScenes();
    layoutStage();
    renderLayers();
    renderPanel();
  }

  function renderToolbar() {
    const on = !!state.settings?.studioEnabled;
    $('#studioEnabled').checked = on;
    $('#studio').classList.toggle('off', !on);
    $('#studioOffPill').hidden = on;
  }

  function renderScenes() {
    const live = state.settings?.studioEnabled ? S.liveSceneId : null;
    $('#sceneBar').innerHTML = S.setup.scenes.map((sc) => `
      <button class="scene-tab${sc.id === S.sceneId ? ' active' : ''}${sc.id === live ? ' live' : ''}" data-scene="${esc(sc.id)}"
        ${sc.id === live ? 'title="Clips are recorded with this scene right now"' : ''}>
        <span class="scene-live"></span><span>${esc(sc.name)}</span>${sc.id === S.setup.defaultSceneId ? '<span class="scene-tag">Default</span>' : ''}
      </button>`).join('')
      + `<button class="icon-btn tiny" data-act="add-scene" title="New scene">${icon('plus')}</button>`;
  }

  function layoutStage() {
    const wrap = $('#studioStageWrap');
    const scale = Math.min(wrap.clientWidth / S.width, wrap.clientHeight / S.height);
    if (!(scale > 0)) return;
    S.stageW = Math.floor(S.width * scale);
    S.stageH = Math.floor(S.height * scale);
    stage.style.width = `${S.stageW}px`;
    stage.style.height = `${S.stageH}px`;
    const cw = Math.round(S.stageW * dpr()), ch = Math.round(S.stageH * dpr());
    if (screenCanvas.width !== cw || screenCanvas.height !== ch) {
      screenCanvas.width = cw;
      screenCanvas.height = ch;
      if (S.lastScreen) drawScreen(S.lastScreen);
    }
  }

  function renderLayers() {
    const sc = scene();
    layersEl.innerHTML = '';
    if (!sc) return;
    for (const l of sc.layers) layersEl.appendChild(buildLayer(l));
    renderSelection();
    const empty = $('#studioEmpty');
    empty.hidden = sc.layers.length > 0;
    if (!empty.hidden) {
      empty.innerHTML = `<h2>Add your first layer</h2>
        <p>Layers are drawn into your clips while Snappy records. You won't see them on your screen, only in the clips you save.</p>
        <div class="add-row">
          <button class="btn ghost" data-add="media">${icon('image')}Image or GIF</button>
          <button class="btn ghost" data-add="webcam">${icon('webcam')}Facecam</button>
          <button class="btn ghost" data-add="inputs">${icon('keyboard')}Keys and mouse</button>
        </div>`;
    }
    renderHint();
    S.inputDirty = true;
    syncCameraLoops();
  }

  function buildLayer(l) {
    const el = document.createElement('div');
    el.className = `slayer type-${l.type}`;
    el.dataset.id = l.id;
    el.hidden = !l.visible;
    if (l.type === 'image' || l.type === 'gif') {
      el.innerHTML = `<img src="https://media.snappy/${encodeURIComponent(l.file)}" alt="" draggable="false">`;
    } else {
      el.innerHTML = '<canvas></canvas>';
      if (l.type === 'webcam') {
        el.insertAdjacentHTML('beforeend', `<div class="slayer-wait">${icon('webcam')}<span>${l.device ? 'Starting camera…' : 'Pick a camera'}</span></div>`);
      }
    }
    placeLayer(el, l);
    return el;
  }

  function placeLayer(el, l) {
    if (!el) return;
    const w = l.w * S.stageW, h = l.h * S.stageH;
    Object.assign(el.style, { left: `${l.x * S.stageW}px`, top: `${l.y * S.stageH}px`, width: `${w}px`, height: `${h}px`, opacity: l.opacity });
    if (l.type === 'webcam') el.style.borderRadius = l.shape === 'circle' ? '50%' : l.shape === 'rounded' ? `${Math.min(w, h) * 0.12}px` : '0';
    const canvas = el.querySelector('canvas');
    if (!canvas) return;
    const cw = Math.max(1, Math.round(w * dpr())), ch = Math.max(1, Math.round(h * dpr()));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      S.inputDirty = true;
      if (l.type === 'webcam') redrawCamera(l.device);
    }
  }

  function renderSelection() {
    const l = selectedLayer();
    if (!l || !l.visible) { selectionEl.innerHTML = ''; return; }
    if (!selectionEl.firstElementChild) {
      selectionEl.innerHTML = '<div class="ssel"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div>';
    }
    Object.assign(selectionEl.firstElementChild.style, {
      left: `${l.x * S.stageW}px`, top: `${l.y * S.stageH}px`, width: `${l.w * S.stageW}px`, height: `${l.h * S.stageH}px`,
    });
  }

  function renderHint() {
    $('#studioHint').innerHTML = scene()?.layers.length
      ? '<span>Drag to move, drag a corner to resize</span><span>Shift resizes freely</span><span>Alt turns off snapping</span><span>Arrow keys nudge</span>'
      : '';
  }

  function renderPanel() {
    const sc = scene();
    const focused = panel.contains(document.activeElement) && document.activeElement.type === 'text' ? document.activeElement.dataset.prop : null;
    if (!sc) { panel.innerHTML = ''; return; }
    const l = selectedLayer();
    const rows = [...sc.layers].reverse().map((x) => `
      <div class="layer-row${x.id === S.selected ? ' selected' : ''}${x.visible ? '' : ' off'}" data-layer="${esc(x.id)}">
        ${icon(LAYER_ICONS[x.type])}<span class="layer-name">${esc(layerName(x))}</span>
        <button class="icon-btn tiny" data-act="up" title="Bring forward">${icon('up')}</button>
        <button class="icon-btn tiny" data-act="down" title="Send backward">${icon('down')}</button>
        <button class="icon-btn tiny${x.visible ? '' : ' keep'}" data-act="eye" title="${x.visible ? 'Hide' : 'Show'}">${icon(x.visible ? 'eye' : 'eye-off')}</button>
      </div>`).join('');
    panel.innerHTML = `
      <div class="panel-card">
        <div class="panel-head"><span>Layers</span><button class="btn ghost sm" data-act="add-layer">${icon('plus')}Add</button></div>
        <div class="layer-list">${rows || '<div class="panel-empty">No layers in this scene yet.</div>'}</div>
      </div>
      ${l ? layerProps(l) : ''}
      ${sceneProps(sc)}
      <div class="studio-notes">${notes(sc)}</div>`;
    if (focused) {
      const input = panel.querySelector(`input[data-prop="${focused}"]`);
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
  }

  const prop = (label, control) => `<div class="prop"><span class="prop-label">${label}</span><div class="prop-control">${control}</div></div>`;
  const toggle = (key, on) => `<label class="toggle"><input type="checkbox" data-prop="${key}"${on ? ' checked' : ''}><span></span></label>`;
  const segmented = (key, options, value) =>
    `<div class="segmented">${options.map(([v, label]) => `<button class="${v === value ? 'active' : ''}" data-prop="${key}" data-value="${v}">${label}</button>`).join('')}</div>`;

  function layerProps(l) {
    let specific = '';
    if (l.type === 'webcam') {
      const cams = S.cameras;
      let options;
      if (cams === null) {
        options = '<option>Looking for cameras…</option>';
        loadCameras();
      } else {
        options = (l.device && !cams.includes(l.device) ? `<option value="${esc(l.device)}" selected>${esc(l.device)} (not connected)</option>` : '')
          + (cams.length ? cams.map((c) => `<option value="${esc(c)}"${c === l.device ? ' selected' : ''}>${esc(c)}</option>`).join('') : '<option value="">No camera found</option>');
      }
      const error = S.cameraErrors.get(l.device);
      specific = prop('Camera', `<select class="select" data-prop="device"${cams === null ? ' disabled' : ''}>${options}</select>`)
        + prop('Shape', segmented('shape', [['rect', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']], l.shape))
        + prop('Mirror', toggle('mirror', l.mirror))
        + (error ? `<div class="prop-note error">${esc(error)}</div>` : '');
    } else if (l.type === 'inputs') {
      const extra = l.extraKeys.map((k) => `<span class="key-chip">${esc(InputOverlay.keyName(k))}<button data-act="remove-key" data-key="${k}" title="Remove">×</button></span>`).join('');
      specific = prop('Style', segmented('style', [['keys', 'Keys'], ['cat', 'Cat']], l.style))
        + `<div class="prop stack">
            <span class="prop-label">Keys</span>
            <div class="chips">${S.presets.map((p) => `<button class="chip-toggle${l.presets.includes(p.id) ? ' on' : ''}" data-act="preset" data-preset="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
            <div class="chips">${extra}<button class="chip-toggle" data-act="add-key">+ Add key</button></div>
            <div class="prop-note">Press your keys to test it. Only these keys are read, everything else you type is ignored.</div>
          </div>`
        + prop('Show keys', toggle('showKeys', l.showKeys))
        + prop('Show mouse', toggle('showMouse', l.showMouse));
    }
    const pct = Math.round(l.opacity * 100);
    return `<div class="panel-card">
      <div class="panel-head"><span>${esc(LAYER_NAMES[l.type])}</span></div>
      ${prop('Name', `<input class="text-input" type="text" data-prop="name" value="${esc(l.name)}" placeholder="${esc(LAYER_NAMES[l.type])}" spellcheck="false" maxlength="40">`)}
      ${specific}
      ${prop('Opacity', `<input type="range" data-prop="opacity" min="5" max="100" step="5" value="${pct}" style="--fill:${((pct - 5) / 95) * 100}%"><span class="value">${pct}%</span>`)}
      ${prop('Place', `<div class="corner-picker">${['tl', 'tr', 'bl', 'br'].map((c) => `<button data-act="corner" data-corner="${c}" title="Move to this corner"></button>`).join('')}</div>
        <button class="btn ghost sm" data-act="center">Center</button><button class="btn ghost sm" data-act="fit">Fit</button>`)}
      <div class="panel-actions"><button class="btn danger-ghost sm" data-act="delete-layer">${icon('trash')}Delete layer</button></div>
    </div>`;
  }

  function sceneProps(sc) {
    const isDefault = sc.id === S.setup.defaultSceneId;
    const auto = !!state.settings?.studioAutoSwitch;
    const note = !auto ? 'Automatic scene switching is off in Settings, so the default scene is always used.'
      : sc.apps.length ? 'This scene is used while one of these runs in front.'
      : 'Link a game and this scene is used while you play it.';
    return `<div class="panel-card">
      <div class="panel-head"><span>Scene</span><button class="icon-btn tiny" data-act="scene-menu" title="Scene options">${icon('more')}</button></div>
      <div class="prop stack">
        <span class="prop-label">Games and programs</span>
        <div class="chips">${sc.apps.map((a) => `<span class="app-chip" title="${esc(a.exe)}"><span>${esc(a.name)}</span><button data-act="remove-app" data-exe="${esc(a.exe)}" title="Remove">×</button></span>`).join('')}<button class="chip-toggle" data-act="add-app">+ Add</button></div>
        <div class="prop-note">${note}</div>
      </div>
      ${prop('Default scene', isDefault ? '<span class="prop-note">Yes</span>' : '<button class="btn ghost sm" data-act="make-default">Use as default</button>')}
    </div>`;
  }

  function notes(sc) {
    const out = [];
    if (S.error) out.push(`<div class="error">Layers are paused because recording couldn't start with them: ${esc(S.error)}</div>`);
    if (sc.layers.some((l) => l.type === 'webcam' && l.visible)) out.push('<div>While this scene is in use, the camera stays on in the background so the replay can include it.</div>');
    if (sc.layers.length) out.push('<div>Layers use a little extra CPU while recording. Clips you already saved keep their old look.</div>');
    return out.join('');
  }

  // ---------- live preview ----------
  function pullScreen(gen) {
    if (gen !== S.gen) return;
    const img = new Image();
    img.onload = () => {
      if (gen !== S.gen) return;
      S.lastScreen = img;
      drawScreen(img);
      stage.classList.add('live');
      setTimeout(() => pullScreen(gen), 60);
    };
    img.onerror = () => setTimeout(() => pullScreen(gen), 400);
    img.src = `https://live.snappy/screen.jpg?n=${++frameNo}`;
  }

  function drawScreen(img) {
    screenCanvas.getContext('2d').drawImage(img, 0, 0, screenCanvas.width, screenCanvas.height);
  }

  function tick(gen, t) {
    if (gen !== S.gen) return;
    requestAnimationFrame((next) => tick(gen, next));
    const sc = scene();
    if (!sc) return;
    const blinking = sc.layers.some((l) => l.type === 'inputs' && l.style === 'cat' && l.visible);
    if (!S.inputDirty && !(blinking && t - lastDraw > 100)) return;
    S.inputDirty = false;
    lastDraw = t;
    for (const l of sc.layers) {
      if (l.type !== 'inputs' || !l.visible) continue;
      const canvas = layerElement(l.id)?.querySelector('canvas');
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr(), dpr());
      InputOverlay.draw(ctx, l, S.presets, S.input, canvas.width / dpr(), canvas.height / dpr(), Date.now());
    }
  }

  function syncCameraLoops() {
    const devices = new Set((scene()?.layers || []).filter((l) => l.type === 'webcam' && l.visible && l.device).map((l) => l.device));
    for (const device of devices) {
      if (cameraLoops.has(device)) { redrawCamera(device); continue; }
      cameraLoops.set(device, { img: null });
      pullCamera(device, S.gen);
    }
    for (const device of [...cameraLoops.keys()]) if (!devices.has(device)) cameraLoops.delete(device);
  }

  function pullCamera(device, gen) {
    const entry = cameraLoops.get(device);
    if (!entry || gen !== S.gen) return;
    const img = new Image();
    const alive = () => cameraLoops.get(device) === entry && gen === S.gen;
    img.onload = () => {
      if (!alive()) return;
      entry.img = img;
      S.cameraErrors.delete(device);
      redrawCamera(device);
      setTimeout(() => pullCamera(device, gen), 66);
    };
    img.onerror = () => {
      if (!alive()) return;
      entry.img = null;
      checkCamera(device);
      redrawCamera(device);
      setTimeout(() => pullCamera(device, gen), 700);
    };
    img.src = `https://live.snappy/camera.jpg?device=${encodeURIComponent(device)}&n=${++frameNo}`;
  }

  function redrawCamera(device) {
    const img = cameraLoops.get(device)?.img;
    for (const l of scene()?.layers || []) {
      if (l.type !== 'webcam' || l.device !== device) continue;
      const el = layerElement(l.id);
      if (!el) continue;
      const wait = el.querySelector('.slayer-wait');
      if (wait) {
        wait.hidden = !!img;
        if (!img) wait.querySelector('span').textContent = S.cameraErrors.get(device) || 'Starting camera…';
      }
      if (!img) continue;
      const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const sw = canvas.width / scale, sh = canvas.height / scale;
      ctx.setTransform(l.mirror ? -1 : 1, 0, 0, 1, l.mirror ? canvas.width : 0, 0);
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    }
  }

  async function checkCamera(device) {
    if ((S.cameraChecked.get(device) || 0) > Date.now() - 2500) return;
    S.cameraChecked.set(device, Date.now());
    try {
      const error = await snappy.call('studio.cameraStatus', { device });
      const had = S.cameraErrors.has(device);
      if (error) S.cameraErrors.set(device, "The camera didn't start. Another app may be using it.");
      else S.cameraErrors.delete(device);
      if (had !== S.cameraErrors.has(device) && S.active) { redrawCamera(device); renderPanel(); }
    } catch { /* window closing */ }
  }

  async function loadCameras() {
    if (S.cameras) return S.cameras;
    S.cameraLoad ??= snappy.call('studio.cameras')
      .then((list) => list || [])
      .catch(() => [])
      .then((list) => {
        S.cameras = list;
        S.cameraLoad = null;
        if (S.active) renderPanel();
        return list;
      });
    return S.cameraLoad;
  }

  // ---------- layer actions ----------
  function select(id) {
    S.selected = id;
    renderSelection();
    renderPanel();
  }

  function addLayerMenu(x, y) {
    showMenu(x, y, [
      { label: 'Image or GIF', icon: 'image', action: () => addLayer('media') },
      { label: 'Facecam', icon: 'webcam', action: () => addLayer('webcam') },
      { label: 'Keys and mouse', icon: 'keyboard', action: () => addLayer('inputs') },
    ]);
  }

  async function addLayer(kind) {
    const sc = scene();
    if (!sc) return;
    const l = {
      id: newId(), type: kind, name: '', visible: true, x: 0, y: 0, w: 0.2, h: 0.2, opacity: 1, file: '', device: '',
      shape: 'rounded', mirror: false, style: 'keys', presets: [], extraKeys: [], showKeys: true, showMouse: true,
    };
    const mx = 0.025, my = (0.025 * S.width) / S.height;
    if (kind === 'media') {
      let media;
      try { media = await snappy.call('studio.pickMedia'); }
      catch (err) { toast({ kind: 'error', title: "Couldn't add that file", sub: err.message }); return; }
      if (!media || !S.active || scene() !== sc) return;
      Object.assign(l, { type: media.type, file: media.file, name: media.name });
      // Real size, shrunk to fit a third of the frame
      const k = Math.min(1, S.width / 3 / media.width, S.height / 3 / media.height);
      l.w = (media.width * k) / S.width;
      l.h = (media.height * k) / S.height;
      l.x = (1 - l.w) / 2;
      l.y = (1 - l.h) / 2;
    } else if (kind === 'webcam') {
      const cams = await loadCameras();
      if (!S.active || scene() !== sc) return;
      l.device = cams[0] || '';
      l.w = 0.22;
      l.h = (l.w * S.width * 9) / 16 / S.height;
      l.x = mx;
      l.y = 1 - l.h - my;
    } else {
      l.presets = [sc.apps.some((a) => /league|dota|smite|heroes/i.test(`${a.exe} ${a.name}`)) ? 'moba' : 'shooter'];
      refitInputs(l);
      l.x = 1 - l.w - mx;
      l.y = 1 - l.h - my;
    }
    sc.layers.push(l);
    S.selected = l.id;
    commit({ rebuild: true });
  }

  /** Keeps a keys layer at the shape of what it draws, e.g. after picking other keys. */
  function refitInputs(l) {
    if (l.type !== 'inputs') return;
    l.h = (l.w * S.width) / InputOverlay.aspect(l, S.presets) / S.height;
  }

  function moveLayer(l, dir) {
    const list = scene().layers, i = list.indexOf(l), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit({ rebuild: true });
  }

  function deleteLayer(l) {
    const sc = scene();
    const index = sc.layers.indexOf(l);
    if (index < 0) return;
    sc.layers.splice(index, 1);
    if (S.selected === l.id) S.selected = null;
    commit({ rebuild: true });
    toast({
      title: `${layerName(l)} deleted`,
      action: { label: 'Undo', fn: () => { sc.layers.splice(Math.min(index, sc.layers.length), 0, l); S.selected = l.id; if (S.active) commit({ rebuild: true }); } },
    });
  }

  function placeInCorner(l, corner) {
    const mx = 0.025, my = (0.025 * S.width) / S.height;
    l.x = corner[1] === 'l' ? mx : 1 - l.w - mx;
    l.y = corner[0] === 't' ? my : 1 - l.h - my;
  }

  function fitToFrame(l) {
    if (l.type === 'webcam') { Object.assign(l, { x: 0, y: 0, w: 1, h: 1 }); return; }
    const aspect = (l.w * S.width) / (l.h * S.height);
    if (aspect > S.width / S.height) { l.w = 1; l.h = S.width / aspect / S.height; }
    else { l.h = 1; l.w = (S.height * aspect) / S.width; }
    l.x = (1 - l.w) / 2;
    l.y = (1 - l.h) / 2;
  }

  function captureKey(btn) {
    const l = selectedLayer();
    if (!l) return;
    btn.classList.add('listening');
    btn.textContent = 'Press a key…';
    const done = () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onMouse, true);
    };
    const onMouse = (e) => { if (e.target !== btn) { done(); renderPanel(); } };
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      done();
      const code = e.keyCode;
      const inPreset = S.presets.some((p) => l.presets.includes(p.id) && p.keys.includes(code));
      if (e.key !== 'Escape' && code > 0 && code < 255 && !inPreset && !l.extraKeys.includes(code)) {
        l.extraKeys.push(code);
        refitInputs(l);
        commit({ rebuild: true });
      } else {
        renderPanel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onMouse, true);
  }

  // ---------- scenes ----------
  async function addAppMenu(x, y) {
    const sc = scene();
    showMenu(x, y, [{ heading: 'Looking for open apps…' }]);
    let apps = [];
    try { apps = await snappy.call('studio.apps'); } catch { /* shown as empty */ }
    if ($('#menu').hidden || scene() !== sc) return;
    const owner = (exe) => S.setup.scenes.find((s) => s.apps.some((a) => a.exe.toLowerCase() === exe.toLowerCase()));
    const items = apps.filter((a) => owner(a.exe) !== sc).slice(0, 30).map((a) => {
      const other = owner(a.exe);
      return { label: other ? `${a.name} (in ${other.name})` : a.name, action: () => linkApp(sc, a) };
    });
    showMenu(x, y, [
      { heading: items.length ? 'Open right now' : 'No open apps found' },
      ...items,
      { sep: true },
      {
        label: 'Browse for a program…', icon: 'folder',
        action: async () => {
          try {
            const app = await snappy.call('studio.pickApp');
            if (app) linkApp(sc, app);
          } catch (err) { toast({ kind: 'error', title: "Couldn't add that program", sub: err.message }); }
        },
      },
    ]);
  }

  function linkApp(sc, app) {
    const same = (a) => a.exe.toLowerCase() === app.exe.toLowerCase();
    for (const other of S.setup.scenes) {
      if (other === sc || !other.apps.some(same)) continue;
      other.apps = other.apps.filter((a) => !same(a));
      toast({ title: `${app.name} moved to ${sc.name}`, sub: `It was linked to ${other.name}. A game can only have one scene.` });
    }
    if (!sc.apps.some(same)) sc.apps.push({ exe: app.exe, name: app.name });
    commit();
  }

  function sceneMenu(sc, x, y) {
    showMenu(x, y, [
      { label: 'Rename', icon: 'edit', action: () => renameScene(sc) },
      { label: 'Duplicate', icon: 'copy', action: () => duplicateScene(sc) },
      ...(sc.id === S.setup.defaultSceneId ? [] : [{ label: 'Use as default', icon: 'check', action: () => { S.setup.defaultSceneId = sc.id; commit({ scenes: true }); } }]),
      { sep: true },
      { label: 'Delete scene', icon: 'trash', danger: true, action: () => deleteScene(sc) },
    ]);
  }

  async function addScene() {
    const name = await modal({ title: 'New scene', text: 'Give it a name, for example the game you use it for.', input: `Scene ${S.setup.scenes.length + 1}`, ok: 'Create' });
    if (typeof name !== 'string' || !name.trim() || !S.active) return;
    const sc = { id: newId(), name: name.trim().slice(0, 40), apps: [], layers: [] };
    S.setup.scenes.push(sc);
    S.sceneId = sc.id;
    S.selected = null;
    commit({ rebuild: true, scenes: true });
  }

  async function renameScene(sc) {
    const name = await modal({ title: 'Rename scene', input: sc.name, ok: 'Rename' });
    if (typeof name !== 'string' || !name.trim() || !S.active) return;
    sc.name = name.trim().slice(0, 40);
    commit({ scenes: true });
  }

  function duplicateScene(sc) {
    const copy = structuredClone(sc);
    copy.id = newId();
    copy.name = `${sc.name} copy`.slice(0, 40);
    copy.apps = []; // a game can only belong to one scene
    copy.layers.forEach((l) => { l.id = newId(); });
    S.setup.scenes.splice(S.setup.scenes.indexOf(sc) + 1, 0, copy);
    S.sceneId = copy.id;
    S.selected = null;
    commit({ rebuild: true, scenes: true });
  }

  async function deleteScene(sc) {
    if (S.setup.scenes.length === 1) { toast({ title: 'There has to be at least one scene' }); return; }
    const ok = await modal({
      title: `Delete ${sc.name}?`,
      text: sc.layers.length ? 'Its layers are deleted with it. Clips you already saved stay as they are.' : '',
      ok: 'Delete', danger: true,
    });
    if (!ok || !S.active) return;
    S.setup.scenes = S.setup.scenes.filter((s) => s !== sc);
    if (S.setup.defaultSceneId === sc.id) S.setup.defaultSceneId = S.setup.scenes[0].id;
    if (S.sceneId === sc.id) { S.sceneId = S.setup.defaultSceneId; S.selected = null; }
    commit({ rebuild: true, scenes: true });
  }

  // ---------- dragging on the stage ----------
  function snapMove(l) {
    const snap = (pos, size, threshold) => {
      for (const [edge, target] of [[pos, 0], [pos + size, 1], [pos + size / 2, 0.5]]) {
        if (Math.abs(edge - target) < threshold) return pos + target - edge;
      }
      return pos;
    };
    l.x = snap(l.x, l.w, 8 / S.stageW);
    l.y = snap(l.y, l.h, 8 / S.stageH);
  }

  function resizeLayer(l, o, handle, dx, dy, free) {
    const west = handle.includes('w'), north = handle.includes('n');
    let w = Math.max(0.01, o.w + (west ? -dx : dx));
    let h = Math.max(0.01, o.h + (north ? -dy : dy));
    if (l.type === 'inputs' || !free) {
      const aspect = l.type === 'inputs' ? InputOverlay.aspect(l, S.presets) : (o.w * S.width) / (o.h * S.height);
      if ((w * S.width) / aspect / S.height > h) h = (w * S.width) / aspect / S.height;
      else w = (h * S.height * aspect) / S.width;
    }
    l.w = w;
    l.h = h;
    l.x = west ? o.x + o.w - w : o.x;
    l.y = north ? o.y + o.h - h : o.y;
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !scene() || e.target.closest('#studioEmpty')) return;
    const handle = e.target.closest('.ssel i');
    const hit = e.target.closest('.slayer');
    if (!handle && !hit) { if (S.selected) select(null); return; }
    const l = handle ? selectedLayer() : findLayer(hit.dataset.id);
    if (!l) return;
    if (S.selected !== l.id) select(l.id);
    e.preventDefault();
    const mode = handle ? handle.dataset.h : 'move';
    const start = { x: e.clientX, y: e.clientY, l: { ...l } };
    const el = layerElement(l.id);
    let moved = false;
    stage.setPointerCapture(e.pointerId);
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      moved = true;
      const dx = (ev.clientX - start.x) / S.stageW, dy = (ev.clientY - start.y) / S.stageH;
      if (mode === 'move') {
        l.x = start.l.x + dx;
        l.y = start.l.y + dy;
        if (!ev.altKey) snapMove(l);
      } else {
        resizeLayer(l, start.l, mode, dx, dy, ev.shiftKey);
      }
      placeLayer(el, l);
      renderSelection();
    };
    const onUp = () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      if (moved) commit({ panel: false });
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
  });

  function handleKey(e, typing) {
    if (typing || !S.active) return;
    const l = selectedLayer();
    if (e.key === 'Escape') { if (l) select(null); return; }
    if (!l) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteLayer(l); return; }
    const step = e.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!move) return;
    e.preventDefault();
    l.x += move[0] / S.width;
    l.y += move[1] / S.height;
    commit({ panel: false });
  }

  // ---------- wiring ----------
  $('#sceneBar').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="add-scene"]')) { addScene(); return; }
    const tab = e.target.closest('[data-scene]');
    if (!tab || tab.dataset.scene === S.sceneId) return;
    S.sceneId = tab.dataset.scene;
    S.selected = null;
    renderScenes();
    renderLayers();
    renderPanel();
    sendPreview();
  });
  $('#sceneBar').addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('[data-scene]');
    if (!tab) return;
    e.preventDefault();
    const sc = S.setup.scenes.find((s) => s.id === tab.dataset.scene);
    if (sc) sceneMenu(sc, e.clientX, e.clientY);
  });
  $('#sceneBar').addEventListener('dblclick', (e) => {
    const sc = S.setup?.scenes.find((s) => s.id === e.target.closest('[data-scene]')?.dataset.scene);
    if (sc) renameScene(sc);
  });

  $('#studioEmpty').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) addLayer(b.dataset.add);
  });

  $('#studioEnabled').addEventListener('change', (e) => {
    const on = e.target.checked;
    saveSettings((s) => { s.studioEnabled = on; });
  });

  panel.addEventListener('click', (e) => {
    const sc = scene();
    if (!sc) return;
    const row = e.target.closest('.layer-row');
    const segment = e.target.closest('button[data-prop]');
    const btn = e.target.closest('[data-act]');
    if (row && !btn) { select(row.dataset.layer); return; }
    const l = row ? findLayer(row.dataset.layer) : selectedLayer();
    if (segment && l) {
      l[segment.dataset.prop] = segment.dataset.value;
      if (segment.dataset.prop === 'style') refitInputs(l);
      commit({ rebuild: true });
      return;
    }
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    switch (btn.dataset.act) {
      case 'add-layer': addLayerMenu(r.left, r.bottom + 4); break;
      case 'up': moveLayer(l, 1); break;
      case 'down': moveLayer(l, -1); break;
      case 'eye': l.visible = !l.visible; commit({ rebuild: true }); break;
      case 'delete-layer': deleteLayer(l); break;
      case 'preset':
        l.presets = l.presets.includes(btn.dataset.preset) ? l.presets.filter((p) => p !== btn.dataset.preset) : [...l.presets, btn.dataset.preset];
        refitInputs(l);
        commit({ rebuild: true });
        break;
      case 'add-key': captureKey(btn); break;
      case 'remove-key':
        l.extraKeys = l.extraKeys.filter((k) => k !== Number(btn.dataset.key));
        refitInputs(l);
        commit({ rebuild: true });
        break;
      case 'corner': placeInCorner(l, btn.dataset.corner); commit(); break;
      case 'center': l.x = (1 - l.w) / 2; l.y = (1 - l.h) / 2; commit(); break;
      case 'fit': fitToFrame(l); commit(); break;
      case 'add-app': addAppMenu(r.left, r.bottom + 4); break;
      case 'remove-app': sc.apps = sc.apps.filter((a) => a.exe !== btn.dataset.exe); commit(); break;
      case 'make-default': S.setup.defaultSceneId = sc.id; commit({ scenes: true }); break;
      case 'scene-menu': sceneMenu(sc, r.left, r.bottom + 4); break;
    }
  });

  panel.addEventListener('input', (e) => {
    const l = selectedLayer(), key = e.target.dataset.prop;
    if (!l || !key) return;
    if (key === 'opacity') {
      l.opacity = Number(e.target.value) / 100;
      e.target.style.setProperty('--fill', `${((e.target.value - 5) / 95) * 100}%`);
      e.target.nextElementSibling.textContent = `${e.target.value}%`;
      placeLayer(layerElement(l.id), l);
    } else if (key === 'name') {
      l.name = e.target.value;
      const label = panel.querySelector(`.layer-row[data-layer="${CSS.escape(l.id)}"] .layer-name`);
      if (label) label.textContent = layerName(l);
    }
  });

  panel.addEventListener('change', (e) => {
    const l = selectedLayer(), key = e.target.dataset.prop;
    if (!l || !key) return;
    if (key === 'opacity' || key === 'name') { commit({ panel: key === 'opacity' }); return; }
    l[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (key === 'showKeys' || key === 'showMouse') refitInputs(l);
    commit({ rebuild: true });
  });

  new ResizeObserver(() => {
    if (!S.active || !S.setup) return;
    layoutStage();
    for (const l of scene()?.layers || []) placeLayer(layerElement(l.id), l);
    renderSelection();
  }).observe($('#studioStageWrap'));

  snappy.on('inputState', (st) => {
    S.input = { keys: new Set(st.keys), buttons: new Set(st.buttons), wheel: st.wheel, vx: st.vx, vy: st.vy };
    S.inputDirty = true;
  });

  snappy.on('status', (st) => {
    if (!S.active || !S.setup || !st) return;
    const warning = (st.warnings || []).find((w) => w.startsWith(OFF_PREFIX));
    const error = warning ? warning.slice(OFF_PREFIX.length) : null;
    const live = st.liveSceneId || null;
    if (live === S.liveSceneId && error === S.error) return;
    S.liveSceneId = live;
    S.error = error;
    renderScenes();
    renderPanel();
  });

  function settingsChanged() {
    if (!S.active || !S.setup) return;
    renderToolbar();
    renderScenes();
    renderPanel();
  }

  return { enter, leave, handleKey, settingsChanged };
})();

window.Studio = Studio;
