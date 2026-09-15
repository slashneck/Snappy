// Renders Snappy mascot assets (icons, tray states, overlay animation strips) with headless Edge.
// Run via render-assets.ps1 (serves the repo root on :5178).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9340;
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(out, '..', 'edge-render-profile')}`, 'about:blank',
], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* starting */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { edge.kill(); throw new Error('Edge did not start'); }

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5178/tools/mascot/render.html' });
for (let i = 0; i < 40; i++) { if (await evaluate('typeof window.renderIcon === "function" && document.readyState === "complete"')) break; await sleep(150); }
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

async function capture(name, width, height, call) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await evaluate(call);
  await sleep(40);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(join(out, `${name}.png`), Buffer.from(r.result.data, 'base64'));
}

const ICON_VIEW = '-6 -2 212 212';
const iconClasses = (s) => JSON.stringify(s <= 24 ? ['tiny', 'no-shadow'] : ['no-shadow']);

for (const s of [256, 128, 64, 48, 40, 32, 24, 20, 16]) {
  await capture(`icon-${s}`, s, s, `renderIcon({ mood: 'idle', size: ${s}, classes: ${iconClasses(s)}, viewBox: '${ICON_VIEW}', lx: 0.15, ly: 0.1 })`);
}

const trayStates = {
  recording: { mood: 'recording', badge: '#ff3b30' },
  paused: { mood: 'paused', badge: null },
  saving: { mood: 'happy', badge: null, t: 400 },
  idle: { mood: 'idle', badge: null },
};
for (const [state, cfg] of Object.entries(trayStates)) {
  for (const s of [16, 20, 24, 32, 40, 48]) {
    const badge = cfg.badge ? `'${cfg.badge}'` : 'null';
    await capture(`tray-${state}-${s}`, s, s,
      `renderIcon({ mood: '${cfg.mood}', size: ${s}, classes: ${iconClasses(s)}, viewBox: '${ICON_VIEW}', t: ${cfg.t || 0}, badge: ${badge} })`);
  }
}

// Overlay animation strips (30 fps, 128 px cells)
const sheets = { clip: ['clipping', 26], working: ['working', 33], happy: ['happy', 33], error: ['error', 39] };
const meta = {};
for (const [name, [mood, frames]] of Object.entries(sheets)) {
  const size = 128, cols = 13;
  const rows = Math.ceil(frames / cols);
  await capture(`overlay-${name}`, cols * size, rows * size,
    `renderSheet({ mood: '${mood}', size: ${size}, frames: ${frames}, fps: 30, cols: ${cols}, lx: 0, ly: 0.15 })`);
  meta[name] = { frames, size, cols, fps: 30 };
}
writeFileSync(join(out, 'overlay.json'), JSON.stringify(meta, null, 2));

ws.close();
edge.kill();
console.log('rendered to', out);
