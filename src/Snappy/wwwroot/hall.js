// The arcade: her games with a best score don't come up by themselves. Each day two of them are in the arcade, one try
// each (a try counts once the game actually starts), and the little controller next to her name opens it: today's two,
// when the next ones come, and every best score so far. Which two it is goes round the list, so every game comes back
// every few days. A game you can beat (ending) takes one of the two every day until you've beaten it.
(() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* the arcade forgets what you played today, that's all */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const PER_DAY = 2;

  // today, as a number that changes at local midnight
  const dayNumber = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  // the same shuffle every time, walked two games a day
  function rotation() {
    const pending = Events.arcade.filter((d) => d.ending && !Events.has(d.id)).slice(0, PER_DAY);
    const games = Events.arcade.filter((d) => !d.ending);
    const need = PER_DAY - pending.length;
    if (games.length <= need) return [...pending, ...games];
    let seed = 20261026;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const order = [...games];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const start = (dayNumber() * need) % order.length;
    return [...pending, ...Array.from({ length: need }, (_, i) => order[(start + i) % order.length])];
  }
  function played() {
    try {
      const saved = JSON.parse(store.get('snappy.arcade.today') || '{}');
      return saved.day === dayNumber() ? saved.ids || [] : [];
    } catch { return []; }
  }
  const markPlayed = (id) => store.set('snappy.arcade.today', JSON.stringify({ day: dayNumber(), ids: [...new Set([...played(), id])] }));
  const triesLeft = () => rotation().filter((d) => !played().includes(d.id));
  const until = () => {
    const next = new Date(); next.setHours(24, 0, 0, 0);
    const mins = Math.max(1, Math.round((next - Date.now()) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };
  const scoreOf = (d) => {
    const best = Arcade.top(d.id);
    if (best === null) return null;
    return `${best.toLocaleString('en-US')} ${d.unit === 'attempts' && best === 1 ? 'attempt' : d.unit}`;
  };

  // ---- the controller next to her name
  const brand = document.querySelector('.brand');
  const button = document.createElement('button');
  button.className = 'arc-btn';
  button.title = 'Arcade';
  button.innerHTML = '<svg><use href="#i-gamepad"/></svg><i class="arc-dot"></i>';
  brand?.appendChild(button);
  const refresh = () => {
    const on = Events.enabled && Events.arcade.length > 0;
    button.hidden = !on;
    button.classList.toggle('fresh', on && triesLeft().length > 0);
  };
  setInterval(refresh, 5000);
  setTimeout(refresh, 0);
  button.addEventListener('click', () => open());

  async function playToday(id) {
    if (!triesLeft().some((d) => d.id === id) || Events.running) return;
    Arcade.onStart(() => { markPlayed(id); refresh(); });
    try { await Events.play(id); } finally { Arcade.onStart(null); refresh(); }
  }

  function open() {
    if (document.querySelector('.arc-backdrop')) return;
    const today = rotation(), done = played();
    const root = document.createElement('div');
    root.className = 'modal-backdrop arc-backdrop';
    const card = (d) => {
      const used = done.includes(d.id), best = scoreOf(d);
      return `<div class="arc-card${used ? ' used' : ''}"><div class="arc-card-icon"><svg><use href="#i-gamepad"/></svg></div>
        <div class="arc-card-text"><div class="arc-card-title">${esc(d.title)}</div><div class="arc-card-hint">${esc(d.hint)}</div>
        <div class="arc-card-best">${best ? `Best: ${esc(best)}` : 'No score yet'}</div></div>
        ${used ? '<span class="arc-done">Played today</span>' : `<button class="btn" data-play="${d.id}">Play</button>`}</div>`;
    };
    root.innerHTML = `<div class="modal arc">
      <div class="arc-head"><h3>Arcade</h3><p>Two games a day, one try each. New games in ${until()}.</p></div>
      <div class="arc-today">${today.map(card).join('')}</div>
      <h4 class="arc-sub">Best scores</h4>
      <div class="arc-scores">${Events.arcade.map((d) => `<div class="arc-row${today.includes(d) ? ' today' : ''}"><span>${esc(d.title)}</span>
        ${today.includes(d) ? '<em>today</em>' : ''}<b>${esc(scoreOf(d) || '·')}</b></div>`).join('')}</div>
      <div class="modal-actions"><button class="btn ghost" data-close>Close</button></div>
    </div>`;
    document.body.appendChild(root);
    const close = () => { softRemove(root); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      const go = e.target.closest('[data-play]');
      if (go) { close(); setTimeout(() => playToday(go.dataset.play), 300); return; }
      if (e.target === root || e.target.closest('[data-close]')) close();
    });
  }

  // the first time it's there, she points it out (once)
  setInterval(() => {
    if (store.get('snappy.arcade.told') || button.hidden || !Events.calm?.() || !Speech.enabled || Speech.waiting) return;
    store.set('snappy.arcade.told', '1');
    Speech.say(['{shine}Psst! {pause}I opened an arcade.', '{wink}Two games a day, one try each. {pause}The little controller next to my name.'], {
      kind: 'news', key: 'arcade', action: { label: 'Show me', fn: open },
    });
  }, 20000);

  window.Hall = { open, refresh };
})();
