'use strict';

// Studio: scenes of layers (pictures, GIFs, a facecam, your inputs) that Snappy draws into clips while recording.
// Nothing here shows on your real screen. The preview works on a snapshot you take, and the input overlays are drawn
// by the recorder itself, so the preview can never drift from what ends up in the clip.
const Studio = (() => {
  const LAYER_NAMES = { image: 'Image', gif: 'GIF', webcam: 'Facecam', inputs: 'Input overlay' };
  const LAYER_ICONS = { image: 'image', gif: 'image', webcam: 'webcam', inputs: 'keyboard' };
  // Cat and controller overlays are held back until their artwork is settled. Scenes that already use them keep working.
  const INPUT_KINDS = [
    { id: 'keys', name: 'Keys', hint: 'Only the keys you pick' },
    { id: 'keyboard', name: 'Keyboard', hint: 'A whole board' },
    { id: 'mouse', name: 'Mouse', hint: 'Buttons, wheel and movement' },
  ];
  const DESIGNS = {
    keyboard: [['compact', '60%'], ['full', 'With F row']],
    mouse: [['arrow', 'With movement'], ['simple', 'Simple']],
    controller: [['xbox', 'Xbox'], ['playstation', 'PlayStation']],
  };
  const ACCENTS = ['#f4f4f4', '#4ad7ff', '#ff4655', '#7ef29d', '#c08bff', '#ffd166'];
  const OFF_PREFIX = 'Studio layers are off: ';
  const SNAP_PX = 8;

  const S = {
    active: false, gen: 0, setup: null, sceneId: null, selected: null,
    width: 1920, height: 1080, stageW: 0, stageH: 0,
    presets: [], liveSceneId: null, error: null, hotkey: 'Alt + F2', hasSnapshot: false,
    cameras: null, cameraLoad: null, cameraErrors: new Map(), cameraChecked: new Map(), guides: [],
  };

  const stage = $('#studioStage');
  const screen = $('#studioScreen');
  const layersEl = $('#studioLayers');
  const selectionEl = $('#studioSelection');
  const guidesEl = $('#studioGuides');
  const panel = $('#studioPanel');
  const cameraLoops = new Map();
  const overlayLoops = new Map();
  let applyTimer = 0, pendingApply = false, frameNo = 0;

  const scene = () => S.setup?.scenes.find((s) => s.id === S.sceneId) || null;
  const findLayer = (id) => scene()?.layers.find((l) => l.id === id) || null;
  const selectedLayer = () => findLayer(S.selected);
  const layerElement = (id) => layersEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const layerName = (l) => l.name || (l.type === 'inputs' ? INPUT_KINDS.find((k) => k.id === l.input)?.name || 'Input overlay' : LAYER_NAMES[l.type]);
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

  // ---------- open and close ----------
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
      const opened = await snappy.call('studio.open');
      if (gen !== S.gen) return;
      S.hotkey = opened?.hotkey || S.hotkey;
      S.hasSnapshot = !!opened?.hasSnapshot;
    } catch (err) {
      toast({ kind: 'error', title: "Couldn't open Studio", sub: err.message });
      return;
    }
    render();
    sendPreview();
    if (S.hasSnapshot) loadSnapshot();
  }

  function leave() {
    if (!S.active) return;
    S.active = false;
    S.gen++;
    flushApply();
    cameraLoops.clear();
    overlayLoops.clear();
    snappy.call('studio.close').catch(() => {});
  }

  // ---------- saving ----------
  const sendPreview = throttle(() => {
    const sc = scene();
    if (S.active && sc) snappy.call('studio.preview', { scene: sc }).catch(() => {});
  }, 120);

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
    applyTimer = setTimeout(flushApply, 900);
  }

  function flushApply() {
    clearTimeout(applyTimer);
    if (!pendingApply || !S.setup) return;
    pendingApply = false;
    snappy.call('studio.apply', { setup: S.setup })
      .then((r) => { if (r && S.active) { S.liveSceneId = r.liveSceneId; renderScenes(); } })
      .catch((err) => toast({ kind: 'error', title: "Couldn't save Studio", sub: err.message }));
  }

  // ---------- the snapshot everything is arranged on ----------
  function loadSnapshot() {
    const gen = S.gen;
    const img = new Image();
    img.onload = () => {
      if (gen !== S.gen) return;
      S.hasSnapshot = true;
      screen.src = img.src;
      screen.hidden = false;
      stage.classList.add('has-snapshot');
      renderEmptyState();
    };
    img.onerror = () => {
      if (gen !== S.gen) return;
      S.hasSnapshot = false;
      screen.hidden = true;
      stage.classList.remove('has-snapshot');
      renderEmptyState();
    };
    img.src = `https://live.snappy/screen.jpg?n=${++frameNo}`;
  }

  async function snapNow() {
    try {
      const taken = await snappy.call('studio.snap');
      if (!taken) toast({ kind: 'error', title: "Couldn't take a snapshot", sub: 'Windows blocked the screen copy. Try again.' });
    } catch (err) {
      toast({ kind: 'error', title: "Couldn't take a snapshot", sub: err.message });
    }
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
    $('#snapKey').textContent = S.hotkey;
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
  }

  function renderEmptyState() {
    const sc = scene();
    const empty = $('#studioEmpty');
    const needsSnapshot = !S.hasSnapshot;
    const noLayers = sc && sc.layers.length === 0;
    empty.hidden = !(needsSnapshot || noLayers);
    if (empty.hidden) return;
    empty.innerHTML = needsSnapshot
      ? `<div class="snap-mascot" id="snapMascot"></div>
         <h2>Press <kbd>${esc(S.hotkey)}</kbd> to snap your screen</h2>
         <p>Snappy takes one picture of your screen to arrange layers on. Open your game, press the key, and come back.
            The picture is only kept while you are working in Studio.</p>
         <button class="btn" data-act="snap">${icon('camera')}Snap now</button>`
      : `<h2>Add your first layer</h2>
         <p>Layers are drawn into your clips while Snappy records. You won't see them on your screen, only in the clips you save.</p>
         <div class="add-row">
           <button class="btn ghost" data-add="media">${icon('image')}Image or GIF</button>
           <button class="btn ghost" data-add="webcam">${icon('webcam')}Facecam</button>
           <button class="btn ghost" data-add="inputs">${icon('keyboard')}Input overlay</button>
         </div>`;
    if (needsSnapshot && window.Mascot) Mascot.mount($('#snapMascot'));
  }

  function renderLayers() {
    const sc = scene();
    layersEl.innerHTML = '';
    if (!sc) return;
    for (const l of sc.layers) layersEl.appendChild(buildLayer(l));
    renderSelection();
    renderEmptyState();
    renderHint();
    syncCameraLoops();
    syncOverlayLoops();
  }

  function buildLayer(l) {
    const el = document.createElement('div');
    el.className = `slayer type-${l.type}${l.fit === 'fit' ? ' fit' : ''}`;
    el.dataset.id = l.id;
    el.hidden = !l.visible;
    if (l.type === 'image' || l.type === 'gif') {
      el.innerHTML = `<img src="https://media.snappy/${encodeURIComponent(l.file)}" alt="" draggable="false">`;
    } else if (l.type === 'webcam') {
      el.innerHTML = `<canvas></canvas><div class="slayer-wait">${icon('webcam')}<span>${l.device ? 'Starting camera…' : 'Pick a camera'}</span></div>`;
    } else {
      el.innerHTML = '<img class="overlay-frame" alt="" draggable="false">';
    }
    placeLayer(el, l);
    return el;
  }

  function placeLayer(el, l) {
    if (!el) return;
    const w = l.w * S.stageW, h = l.h * S.stageH;
    Object.assign(el.style, { left: `${l.x * S.stageW}px`, top: `${l.y * S.stageH}px`, width: `${w}px`, height: `${h}px`, opacity: l.opacity });
    if (l.type === 'webcam') {
      el.style.borderRadius = l.shape === 'circle' ? '50%' : l.shape === 'rounded' ? `${Math.min(w, h) * 0.12}px` : '0';
      const canvas = el.querySelector('canvas');
      const cw = Math.max(1, Math.round(w * (window.devicePixelRatio || 1)));
      const ch = Math.max(1, Math.round(h * (window.devicePixelRatio || 1)));
      if (canvas && (canvas.width !== cw || canvas.height !== ch)) {
        canvas.width = cw;
        canvas.height = ch;
        redrawCamera(l.device);
      }
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

  function renderGuides() {
    guidesEl.innerHTML = S.guides.map((g) => g.vertical
      ? `<div class="guide v" style="left:${g.at * S.stageW}px"></div>`
      : `<div class="guide h" style="top:${g.at * S.stageH}px"></div>`).join('');
  }

  function renderHint() {
    $('#studioHint').innerHTML = scene()?.layers.length
      ? '<span>Drag to move, corners resize</span><span>Shift resizes freely</span><span>Alt turns off snapping</span><span>Arrow keys nudge</span>'
      : '';
  }

  // ---------- the panel ----------
  const prop = (label, control) => `<div class="prop"><span class="prop-label">${label}</span><div class="prop-control">${control}</div></div>`;
  const toggle = (key, on) => `<label class="toggle"><input type="checkbox" data-prop="${key}"${on ? ' checked' : ''}><span></span></label>`;
  const segmented = (key, options, value) =>
    `<div class="segmented">${options.map(([v, label]) => `<button class="${v === value ? 'active' : ''}" data-prop="${key}" data-value="${v}">${label}</button>`).join('')}</div>`;

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

  function layerProps(l) {
    const pct = Math.round(l.opacity * 100);
    return `<div class="panel-card">
      <div class="panel-head"><span>${esc(layerName(l))}</span></div>
      ${prop('Name', `<input class="text-input" type="text" data-prop="name" value="${esc(l.name)}" placeholder="${esc(layerName(l))}" spellcheck="false" maxlength="40">`)}
      ${l.type === 'inputs' ? inputProps(l) : ''}
      ${l.type === 'webcam' ? webcamProps(l) : ''}
      ${l.type === 'image' || l.type === 'gif' ? prop('Picture', segmented('fit', [['fill', 'Stretch'], ['fit', 'Keep shape']], l.fit || 'fill')) : ''}
      ${prop('Opacity', `<input type="range" data-prop="opacity" min="5" max="100" step="5" value="${pct}" style="--fill:${((pct - 5) / 95) * 100}%"><span class="value">${pct}%</span>`)}
      ${prop('Place', `<div class="corner-picker">${['tl', 'tr', 'bl', 'br'].map((c) => `<button data-act="corner" data-corner="${c}" title="Move to this corner"></button>`).join('')}</div>
        <button class="btn ghost sm" data-act="center">Center</button><button class="btn ghost sm" data-act="fit">Fit</button>`)}
      ${prop('Size', `<button class="btn ghost sm" data-act="smaller">−</button><span class="value">${Math.round(l.w * S.width)}px</span><button class="btn ghost sm" data-act="bigger">+</button>`)}
      <div class="panel-actions"><button class="btn danger-ghost sm" data-act="delete-layer">${icon('trash')}Delete layer</button></div>
    </div>`;
  }

  function inputProps(l) {
    const kind = l.input || 'keys';
    const designs = DESIGNS[kind];
    const showsKeys = kind === 'keys' || kind === 'cat';
    const extra = (l.extraKeys || []).map((k) => `<span class="key-chip">${esc(keyName(k))}<button data-act="remove-key" data-key="${k}" title="Remove">×</button></span>`).join('');
    return `
      <div class="prop stack">
        <span class="prop-label">Shows</span>
        <div class="kind-grid">${INPUT_KINDS.map((k) => `
          <button class="kind${k.id === kind ? ' on' : ''}" data-act="kind" data-kind="${k.id}">
            <span class="kind-name">${k.name}</span><span class="kind-hint">${k.hint}</span>
          </button>`).join('')}</div>
      </div>
      ${designs ? prop('Design', segmented('design', designs, l.design || designs[0][0])) : ''}
      ${showsKeys ? `<div class="prop stack">
        <span class="prop-label">Keys</span>
        <div class="chips">${S.presets.map((p) => `<button class="chip-toggle${(l.presets || []).includes(p.id) ? ' on' : ''}" data-act="preset" data-preset="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
        <div class="chips">${extra}<button class="chip-toggle" data-act="add-key">+ Add key</button></div>
        <div class="prop-note">Press a key to add it. Only these keys are ever read, everything else you type is ignored.</div>
      </div>` : ''}
      ${kind === 'keys' || kind === 'keyboard' || kind === 'cat' ? prop('Show mouse', toggle('showMouse', l.showMouse)) : ''}
      ${kind === 'controller' ? '<div class="prop-note">Works with Xbox pads and anything Windows treats as one, including PlayStation pads.</div>' : ''}
      <div class="prop stack">
        <span class="prop-label">Colour when pressed</span>
        <div class="chips">${ACCENTS.map((c) => `<button class="swatch${(l.accent || '#f4f4f4').toLowerCase() === c ? ' on' : ''}" data-act="accent" data-accent="${c}" style="background:${c}" title="${c}"></button>`).join('')}
          <label class="swatch custom" title="Pick a colour"><input type="color" data-prop="accent" value="${esc(l.accent || '#f4f4f4')}"></label></div>
      </div>`;
  }

  function webcamProps(l) {
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
    return prop('Camera', `<select class="select" data-prop="device"${cams === null ? ' disabled' : ''}>${options}</select>`)
      + prop('Shape', segmented('shape', [['rect', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']], l.shape))
      + prop('Mirror', toggle('mirror', l.mirror))
      + (error ? `<div class="prop-note error">${esc(error)}</div>` : '');
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

  const keyName = (code) => {
    const names = {
      8: 'Bksp', 13: 'Enter', 27: 'Esc', 32: 'Space', 9: 'Tab', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 20: 'Caps',
      37: '←', 38: '↑', 39: '→', 40: '↓', 45: 'Ins', 46: 'Del', 186: ';', 187: '=', 188: ',', 189: '-', 190: '.',
      191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'",
    };
    if (names[code]) return names[code];
    if (code >= 112 && code <= 123) return `F${code - 111}`;
    return code >= 48 && code <= 90 ? String.fromCharCode(code) : `#${code}`;
  };

  // ---------- live pictures in the preview ----------
  function syncOverlayLoops() {
    const ids = new Set((scene()?.layers || []).filter((l) => l.type === 'inputs' && l.visible).map((l) => l.id));
    for (const id of ids) {
      if (overlayLoops.has(id)) continue;
      const entry = {};
      overlayLoops.set(id, entry);
      pullOverlay(id, entry, S.gen);
    }
    for (const id of [...overlayLoops.keys()]) if (!ids.has(id)) overlayLoops.delete(id);
  }

  function pullOverlay(id, entry, gen) {
    if (overlayLoops.get(id) !== entry || gen !== S.gen) return;
    const el = layerElement(id)?.querySelector('.overlay-frame');
    const l = findLayer(id);
    if (!el || !l) { setTimeout(() => pullOverlay(id, entry, gen), 200); return; }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(8, Math.round(l.w * S.stageW * dpr)), h = Math.max(8, Math.round(l.h * S.stageH * dpr));
    const img = new Image();
    img.onload = () => {
      if (overlayLoops.get(id) !== entry || gen !== S.gen) return;
      el.src = img.src;
      setTimeout(() => pullOverlay(id, entry, gen), 60);
    };
    img.onerror = () => {
      if (overlayLoops.get(id) !== entry || gen !== S.gen) return;
      setTimeout(() => pullOverlay(id, entry, gen), 400);
    };
    img.src = `https://live.snappy/overlay.png?layer=${encodeURIComponent(id)}&w=${w}&h=${h}&n=${++frameNo}`;
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

  // ---------- layers ----------
  function select(id) {
    S.selected = id;
    renderSelection();
    renderPanel();
  }

  function addLayerMenu(x, y) {
    showMenu(x, y, [
      { label: 'Image or GIF', icon: 'image', action: () => addLayer('media') },
      { label: 'Facecam', icon: 'webcam', action: () => addLayer('webcam') },
      { sep: true },
      { heading: 'Input overlay' },
      ...INPUT_KINDS.map((k) => ({ label: k.name, icon: 'keyboard', action: () => addLayer('inputs', k.id) })),
    ]);
  }

  async function addLayer(kind, input = 'keys') {
    const sc = scene();
    if (!sc) return;
    const l = {
      id: newId(), type: kind, name: '', visible: true, x: 0, y: 0, w: 0.2, h: 0.2, opacity: 1, file: '', device: '',
      shape: 'rounded', mirror: false, fit: 'fill', input, design: '', accent: '#f4f4f4',
      presets: [], extraKeys: [], showKeys: true, showMouse: input === 'keys' || input === 'cat',
    };
    const mx = 0.025, my = (0.025 * S.width) / S.height;
    if (kind === 'media') {
      let media;
      try { media = await snappy.call('studio.pickMedia'); }
      catch (err) { toast({ kind: 'error', title: "Couldn't add that file", sub: err.message }); return; }
      if (!media || !S.active || scene() !== sc) return;
      Object.assign(l, { type: media.type, file: media.file, name: media.name });
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
      if (input === 'keys' || input === 'cat') l.presets = [sc.apps.some((a) => /league|dota|smite|heroes/i.test(`${a.exe} ${a.name}`)) ? 'moba' : 'shooter'];
      l.w = input === 'keyboard' ? 0.42 : input === 'controller' ? 0.22 : input === 'mouse' ? 0.09 : 0.24;
      await refit(l);
      l.x = 1 - l.w - mx;
      l.y = 1 - l.h - my;
    }
    sc.layers.push(l);
    S.selected = l.id;
    commit({ rebuild: true });
  }

  /// Asks the recorder how tall this overlay should be for its width, so it never looks squashed.
  async function refit(l) {
    if (l.type !== 'inputs') return;
    try {
      const aspect = await snappy.call('studio.overlayAspect', { layer: l });
      if (aspect > 0) l.h = (l.w * S.width) / aspect / S.height;
    } catch { /* keep the old height */ }
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
    const aspect = (l.w * S.width) / (l.h * S.height);
    if (aspect > S.width / S.height) { l.w = 1; l.h = S.width / aspect / S.height; }
    else { l.h = 1; l.w = (S.height * aspect) / S.width; }
    l.x = (1 - l.w) / 2;
    l.y = (1 - l.h) / 2;
  }

  function resize(l, factor) {
    const aspect = (l.w * S.width) / (l.h * S.height);
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    l.w = Math.max(0.02, Math.min(2, l.w * factor));
    l.h = (l.w * S.width) / aspect / S.height;
    l.x = cx - l.w / 2;
    l.y = cy - l.h / 2;
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
    const onKey = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      done();
      const code = e.keyCode;
      const inPreset = S.presets.some((p) => (l.presets || []).includes(p.id) && p.keys.includes(code));
      if (e.key !== 'Escape' && code > 0 && code < 255 && !inPreset && !l.extraKeys.includes(code)) {
        l.extraKeys.push(code);
        await refit(l);
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
    copy.apps = [];
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

  // ---------- dragging, with guides ----------
  function snapMove(l) {
    const tx = SNAP_PX / S.stageW, ty = SNAP_PX / S.stageH;
    S.guides = [];
    const snap = (pos, size, threshold, vertical) => {
      for (const [edge, target] of [[pos, 0], [pos + size, 1], [pos + size / 2, 0.5]]) {
        if (Math.abs(edge - target) < threshold) {
          S.guides.push({ vertical, at: target });
          return pos + target - edge;
        }
      }
      return pos;
    };
    l.x = snap(l.x, l.w, tx, true);
    l.y = snap(l.y, l.h, ty, false);
    renderGuides();
  }

  function resizeLayer(l, o, handle, dx, dy, free) {
    const west = handle.includes('w'), north = handle.includes('n');
    let w = Math.max(0.01, o.w + (west ? -dx : dx));
    let h = Math.max(0.01, o.h + (north ? -dy : dy));
    if (!free || l.type === 'inputs') {
      const aspect = (o.w * S.width) / (o.h * S.height);
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
        if (ev.altKey) { S.guides = []; renderGuides(); } else snapMove(l);
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
      S.guides = [];
      renderGuides();
      if (moved) commit({ panel: false });
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
  });

  function handleKey(e, typing) {
    if (typing || !S.active) return;
    if (e.key === 'F2' || (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.altKey)) { e.preventDefault(); snapNow(); return; }
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
    const add = e.target.closest('[data-add]');
    if (add) { addLayer(add.dataset.add === 'inputs' ? 'inputs' : add.dataset.add); return; }
    if (e.target.closest('[data-act="snap"]')) snapNow();
  });
  $('#snapBtn').addEventListener('click', snapNow);
  $('#studioEnabled').addEventListener('change', (e) => {
    const on = e.target.checked;
    saveSettings((s) => { s.studioEnabled = on; });
  });

  panel.addEventListener('click', async (e) => {
    const sc = scene();
    if (!sc) return;
    const row = e.target.closest('.layer-row');
    const segment = e.target.closest('button[data-prop]');
    const btn = e.target.closest('[data-act]');
    if (row && !btn) { select(row.dataset.layer); return; }
    const l = row ? findLayer(row.dataset.layer) : selectedLayer();
    if (segment && l) {
      l[segment.dataset.prop] = segment.dataset.value;
      if (segment.dataset.prop === 'design') await refit(l);
      commit({ rebuild: true });
      return;
    }
    if (!btn || !l && ['up', 'down', 'eye', 'delete-layer', 'corner', 'center', 'fit', 'smaller', 'bigger', 'kind', 'preset', 'add-key', 'remove-key', 'accent'].includes(btn.dataset.act)) {
      if (btn?.dataset.act === 'add-layer') addLayerMenu(btn.getBoundingClientRect().left, btn.getBoundingClientRect().bottom + 4);
      return;
    }
    const r = btn.getBoundingClientRect();
    switch (btn.dataset.act) {
      case 'add-layer': addLayerMenu(r.left, r.bottom + 4); break;
      case 'up': moveLayer(l, 1); break;
      case 'down': moveLayer(l, -1); break;
      case 'eye': l.visible = !l.visible; commit({ rebuild: true }); break;
      case 'delete-layer': deleteLayer(l); break;
      case 'kind':
        l.input = btn.dataset.kind;
        l.design = '';
        if ((l.input === 'keys' || l.input === 'cat') && !l.presets.length) l.presets = ['shooter'];
        await refit(l);
        commit({ rebuild: true });
        break;
      case 'preset':
        l.presets = l.presets.includes(btn.dataset.preset) ? l.presets.filter((p) => p !== btn.dataset.preset) : [...l.presets, btn.dataset.preset];
        await refit(l);
        commit({ rebuild: true });
        break;
      case 'add-key': captureKey(btn); break;
      case 'remove-key':
        l.extraKeys = l.extraKeys.filter((k) => k !== Number(btn.dataset.key));
        await refit(l);
        commit({ rebuild: true });
        break;
      case 'accent': l.accent = btn.dataset.accent; commit({ rebuild: true }); break;
      case 'corner': placeInCorner(l, btn.dataset.corner); commit(); break;
      case 'center': l.x = (1 - l.w) / 2; l.y = (1 - l.h) / 2; commit(); break;
      case 'fit': fitToFrame(l); commit(); break;
      case 'smaller': resize(l, 1 / 1.12); commit(); break;
      case 'bigger': resize(l, 1.12); commit(); break;
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
    } else if (key === 'accent') {
      l.accent = e.target.value;
    }
  });

  panel.addEventListener('change', async (e) => {
    const l = selectedLayer(), key = e.target.dataset.prop;
    if (!l || !key) return;
    if (key === 'opacity' || key === 'name' || key === 'accent') { commit({ panel: key !== 'name' }); return; }
    l[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (key === 'showMouse' || key === 'showKeys') await refit(l);
    commit({ rebuild: true });
  });

  new ResizeObserver(() => {
    if (!S.active || !S.setup) return;
    layoutStage();
    for (const l of scene()?.layers || []) placeLayer(layerElement(l.id), l);
    renderSelection();
  }).observe($('#studioStageWrap'));

  snappy.on('studioSnapshot', () => { if (S.active) loadSnapshot(); });

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
