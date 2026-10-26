// The terminal: the little >_ button next to the arcade's controller, there only in developer mode. You get that by
// tapping the version number in Settings, About seven times (like a phone's developer options), and a story with a
// terminal in it switches it on once by itself; Settings, About can turn it off again. Then you type at it: help, a few
// real things (your clips, storage, the folder), a lot of nonsense, and some commands nobody lists. Everything is
// written ahead of time: nothing here goes online, and nothing deletes or changes anything you didn't ask for.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* fine */ } },
  };
  // the stories that have a terminal in them: the first one you see switches developer mode on
  const UNLOCKS = ['claude', 'credits', 'scream', 'swap', 'debug', 'context', 'earlybird'];
  const unlocked = () => !!state.settings?.developerMode;
  const modeFound = () => store.get('snappy.term.found.mode') === '1';
  async function developer() {
    store.set('snappy.term.found.mode', '1');
    await saveSettings((s) => { s.developerMode = true; });
    refreshButton();
  }

  // ---------------------------------------------------------------------------
  // Reactions: Snappy from her corner, the Program from the top of the window
  // ---------------------------------------------------------------------------
  const she = (text) => Speech.say(text, { kind: 'news', force: true, interrupt: true });
  let programLines = [];
  Events.define('termprogram', {
    system: true, quick: true, title: 'Program',
    async run(ctx) {
      const prog = Program.program(ctx);
      const top = { center: { x: innerWidth / 2 }, y: 64, size: 0 };
      for (const [line, opts] of programLines) await prog.say(line, { near: top, hold: 700, ...opts });
      await prog.leave();
    },
  });
  const program = (...lines) => { programLines = lines.map((l) => (Array.isArray(l) ? l : [l, {}])); Events.play('termprogram'); };
  // after she's had her say (the Program showing up hushes her)
  const programLater = (ms, ...lines) => setTimeout(() => program(...lines), ms);

  // ---------------------------------------------------------------------------
  // The button
  // ---------------------------------------------------------------------------
  const button = document.createElement('button');
  button.className = 'term-btn';
  button.title = 'Terminal';
  button.innerHTML = '<span>&gt;_</span>';
  button.hidden = true;
  document.querySelector('.brand')?.appendChild(button);
  // only there in developer mode (and gone, terminal and all, when it's switched off)
  function refreshButton() {
    button.hidden = !unlocked();
    if (button.hidden) close();
    if (!modeFound() && state.settings && UNLOCKS.some((id) => Events.has(id))) developer();
  }
  setTimeout(refreshButton);
  setInterval(refreshButton, 4000);

  // ---------------------------------------------------------------------------
  // The panel
  // ---------------------------------------------------------------------------
  let panel = null, out = null, input = null, promptEl = null;
  const history = JSON.parse(store.get('snappy.term.history') || '[]');
  let hIndex = history.length, cwd = '~', misses = 0, busy = false;
  const promptText = () => `snappy@library:${cwd}$`;

  function open() {
    if (!unlocked()) return;
    if (panel) { input.focus(); return; }
    panel = document.createElement('div');
    panel.className = 'term';
    panel.innerHTML = `<div class="term-bar"><i></i><i></i><i></i><span>snappy · terminal</span><button class="term-x" title="Close (Esc)">×</button></div>
      <div class="term-out"></div><label class="term-in"><b></b><input spellcheck="false" autocomplete="off" aria-label="Command"></label>`;
    document.body.appendChild(panel);
    out = panel.querySelector('.term-out');
    input = panel.querySelector('input');
    promptEl = panel.querySelector('.term-in b');
    promptEl.textContent = promptText();
    requestAnimationFrame(() => panel.classList.add('in'));
    panel.querySelector('.term-x').addEventListener('click', close);
    panel.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) setTimeout(() => input.focus()); });
    input.addEventListener('keydown', onKey);
    setTimeout(() => input.focus(), 60);
    window.Terminal.open = true;
    if (!store.get('snappy.term.welcomed')) {
      store.set('snappy.term.welcomed', '1');
      print([['Claude left this open.', 'claude'], ['Type help to see what it does. Type guide if you have never used a terminal.', 'dim'],
        ['Please do not let Snappy near sudo.', 'claude']]);
    } else print([[pick(['Welcome back.', 'Terminal ready.', 'Hello again.', 'The Program is watching. Type away.']), 'dim']]);
  }
  function close() {
    if (!panel) return;
    const p = panel;
    panel = null;
    window.Terminal.open = false;
    p.classList.remove('in');
    p.classList.add('out');
    setTimeout(() => p.remove(), 260);
  }
  button.addEventListener('click', () => (panel ? close() : open()));
  // the way in: tap the version number seven times
  let taps = 0, tapAt = 0;
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#updateRow .row-title')) return;
    taps = Date.now() - tapAt < 1500 ? taps + 1 : 1;
    tapAt = Date.now();
    if (unlocked()) { if (taps === 3) toast({ title: 'No need, you are already a developer.' }); return; }
    if (taps >= 3 && taps < 7) toast({ title: `You are now ${7 - taps} ${7 - taps === 1 ? 'step' : 'steps'} away from being a developer.` });
    if (taps < 7) return;
    await developer();
    if (state.view === 'settings') renderSettings();
    toast({ kind: 'success', title: 'You are now a developer!', sub: 'The terminal is next to the arcade.' });
    program(['Developer mode.', { alert: true }], 'I am contractually obliged to let you in.', 'Do not touch anything.');
  });

  // prints lines one after another; each is text, or [text, class]
  async function print(lines, gap = 45) {
    for (const l of lines) {
      const [text, cls] = Array.isArray(l) ? l : [l, ''];
      const d = document.createElement('div');
      d.className = `term-line${cls ? ` ${cls}` : ''}`;
      d.textContent = text;
      out?.appendChild(d);
      if (out) out.scrollTop = out.scrollHeight;
      if (gap) await wait(gap);
    }
  }
  const say = (...lines) => print(lines);

  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hIndex > 0) { hIndex--; input.value = history[hIndex]; } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (hIndex < history.length) { hIndex++; input.value = history[hIndex] || ''; } return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value.trim().toLowerCase();
      const hits = LISTED.filter((n) => n.startsWith(v));
      if (hits.length === 1) input.value = `${hits[0]} `;
      else if (hits.length > 1) print([hits.join('   ')]);
      return;
    }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.textContent = ''; return; }
    if (e.key !== 'Enter' || busy) return;
    e.preventDefault();
    const raw = input.value;
    input.value = '';
    if (!raw.trim()) { print([promptText()], 0); return; }
    history.push(raw);
    while (history.length > 60) history.shift();
    store.set('snappy.term.history', JSON.stringify(history));
    hIndex = history.length;
    print([[`${promptText()} ${raw}`, 'cmd']], 0);
    Speech.tune('key', 0.45);
    run(raw);
  }

  // ---------------------------------------------------------------------------
  // The commands
  // ---------------------------------------------------------------------------
  const COMMANDS = new Map(), LISTED = [], GROUPS = {};
  function cmd(names, help, fn, { group = 'fun', hidden = false } = {}) {
    for (const n of [names].flat()) COMMANDS.set(n, { fn, hidden, name: [names].flat()[0] });
    if (!hidden) { LISTED.push([names].flat()[0]); (GROUPS[group] ||= []).push([[names].flat()[0], help]); }
  }
  // hidden ones count when found
  const found = new Set(JSON.parse(store.get('snappy.term.found') || '[]'));
  // (plus a few found inside other commands)
  const EXTRA = ['ls -a', 'cat .secret_cookie', 'cat .program_diary', 'rm -rf /'];
  const HIDDEN_TOTAL = () => new Set([...COMMANDS.values()].filter((c) => c.hidden).map((c) => c.name)).size + EXTRA.length;
  function discover(name) {
    if (found.has(name)) return;
    found.add(name);
    store.set('snappy.term.found', JSON.stringify([...found]));
    print([[`✦ secret found (${found.size} of ${HIDDEN_TOTAL()})`, 'secret']], 0);
    Speech.tune('coin', 0.4);
  }

  async function run(raw) {
    busy = true;
    try {
      const text = raw.trim().replace(/^\/+/, '').replace(/\s+/g, ' ');
      const low = text.toLowerCase().replace(/[!?.]+$/, '');
      // whole phrases first ("sudo make me a sandwich"), then the first word
      let hit = COMMANDS.get(low), args = [];
      if (!hit) {
        const words = low.split(' ');
        for (let n = words.length - 1; n >= 1 && !hit; n--) {
          const c = COMMANDS.get(words.slice(0, n).join(' '));
          if (c) { hit = c; args = text.split(' ').slice(n); }
        }
      }
      if (!hit && low.startsWith('sudo ')) hit = COMMANDS.get('sudo');
      if (!hit) { await unknown(text); return; }
      misses = 0;
      if (hit.hidden) discover(hit.name);
      await hit.fn(args, text);
    } finally {
      busy = false;
      if (promptEl) promptEl.textContent = promptText();
    }
  }

  async function unknown(text) {
    misses++;
    const word = text.split(' ')[0];
    const near = LISTED.find((n) => distance(n, word.toLowerCase()) <= 2);
    await print([[`command not found: ${word}`, 'err'], ...(near ? [[`did you mean: ${near}`, 'dim']] : [])]);
    if (misses === 3) program('Please consult help.');
    if (misses === 6) she('{wink}Psst. {pause}Try help. {pause}Or guide.');
    if (misses === 10) program('You have now typed ten things that do not exist.', 'I am impressed. Against my will.');
  }
  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  // ----- help
  cmd('help', 'what you can type', async () => {
    const order = [['basics', 'BASICS'], ['info', 'YOUR STUFF'], ['snappy', 'SNAPPY'], ['fun', 'FUN'], ['files', 'FILES']];
    const lines = [];
    for (const [g, title] of order) {
      if (!GROUPS[g]) continue;
      lines.push(['', ''], [title, 'head']);
      for (const [n, h] of GROUPS[g]) lines.push([`  ${n.padEnd(14)} ${h}`, '']);
    }
    lines.push(['', ''], [`Some commands are not on this list. ${found.size ? `You have found ${found.size}.` : 'Type hint if you get stuck.'}`, 'dim']);
    await print(lines, 12);
  }, { group: 'basics' });
  cmd('guide', 'how a terminal works', () => say(
    ['A terminal is where you type instead of click.', ''], ['Type a word, press Enter, and something (usually) happens.', ''],
    ['', ''], ['  ↑ ↓      earlier commands', 'dim'], ['  Tab      finish a word for you', 'dim'], ['  Ctrl+L   clear the screen', 'dim'], ['  Esc      close the terminal', 'dim'],
    ['', ''], ['Start with: help, snappy, clips, fortune.', 'ok'], ['Nothing you type here can break your clips. The Program made sure.', 'dim'],
  ), { group: 'basics' });
  cmd(['clear', 'cls'], 'clear the screen', () => { out.textContent = ''; }, { group: 'basics' });
  cmd(['exit', 'quit', 'close', 'logout'], 'close the terminal', async () => { await say(['Bye!', 'ok']); she(pick(['{wink}Come back soon!', '{happy}Bye bye!', '{smug}It was getting crowded in there anyway.'])); setTimeout(close, 400); }, { group: 'basics' });
  cmd('history', 'what you typed before', () => print(history.slice(-15).map((h, i) => [`  ${String(history.length - Math.min(15, history.length) + i + 1).padStart(3)}  ${h}`, 'dim']), 10), { group: 'basics' });
  cmd('echo', 'say something back', (args) => say(args.join(' ') || ''), { group: 'basics' });
  const HINTS = ['An old magic word from a cave still works here.', 'The Program does not like being asked for sandwiches. Ask anyway.', 'Some games have cheat codes. Some of those work here.',
    'Files that start with a dot are shy. ls has a way of seeing them.', 'Being polite works more often than you would think.', 'Ask the question. The answer is a number.',
    'Every Jedi knows what to say back.', 'Try saying hi to the Program directly.', 'Some tables were not meant to stay upright.', 'Some sayings are about cake.'];
  let nextHint = Math.floor(Math.random() * HINTS.length);
  cmd('hint', 'for when you are stuck', () => say([`hint: ${HINTS[nextHint++ % HINTS.length]}`, 'dim']), { group: 'basics' });

  // ----- your stuff (real, read-only unless you ask)
  const clipsNow = () => state.library?.clips || [];
  const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
  cmd(['clips', 'count'], 'how many clips you have', async () => {
    const c = clipsNow();
    await say([`${c.length} ${c.length === 1 ? 'clip' : 'clips'} in the library.`, 'ok']);
    if (!c.length) she('{worried}None yet! {pause}{shine}Press the save key in a game. {pause}I dare you.');
    else if (c.length > 500) she('{shock}That is SO many moments.');
  }, { group: 'info' });
  cmd(['storage', 'df', 'du'], 'how much space your clips use', async () => {
    await say(['measuring...', 'dim']);
    try { const bytes = await snappy.call('storage.usage'); await say([`Your clips use ${fmtBytes(bytes)}.`, 'ok']); } catch { await say(['Could not measure right now.', 'err']); }
  }, { group: 'info' });
  cmd(['folder', 'open', 'explorer'], 'open your clips folder', async (args) => {
    if (args[0] === 'screenshots') { await say(['opening screenshots...', 'dim']); snappy.call('screenshots.open').catch(() => {}); return; }
    await say(['opening your clips folder...', 'dim']);
    snappy.call('folder.reveal', { name: '' }).catch(() => say(['Could not open it.', 'err']));
  }, { group: 'info' });
  cmd(['version', 'ver', 'about'], 'which Snappy this is', () => say([`Snappy ${state.version || '?'}`, 'ok'], ['Made by slashneck, with Claude.', 'dim'], ['Powered by questionable decisions and one very loud camera.', 'dim']), { group: 'info' });
  cmd('status', 'what she is doing right now', () => {
    const st = state.status || {};
    return say([`recording: ${{ recording: 'yes', paused: 'paused', starting: 'starting up', problem: 'having trouble' }[st.state] || 'unknown'}`, 'ok'], [`save key: ${document.getElementById('saveHotkey')?.textContent || 'Alt + F10'}`, ''],
      [`events: ${Events.enabled && state.settings?.mascotEvents !== false ? 'on' : 'off'}`, ''], ['mood: ' + pick(['cheerful', 'smug', 'peckish', 'suspiciously quiet', 'professional (pretending)']), '']);
  }, { group: 'info' });
  cmd(['ls clips', 'recent'], 'your newest clips', () => {
    const c = [...clipsNow()].sort((a, b) => (b.createdUtc || b.created || 0) > (a.createdUtc || a.created || 0) ? 1 : -1).slice(0, 8);
    return c.length ? print(c.map((x) => [`  ${x.title}`, ''])) : say(['(empty) Your first clip will be here.', 'dim']);
  }, { group: 'info' });
  cmd(['achievements', 'ach'], 'open the achievements', async () => { await say(['opening...', 'dim']); close(); setTimeout(() => Events.list(), 300); }, { group: 'info' });
  cmd('arcade', 'open the arcade', async () => { await say(['inserting coin...', 'dim']); close(); setTimeout(() => window.Hall?.open(), 300); }, { group: 'info' });
  cmd('settings', 'open the settings', async () => { await say(['opening settings...', 'dim']); close(); setTimeout(() => showView('settings'), 250); }, { group: 'info' });
  cmd('privacy', 'where your clips go', () => say(['Your clips never leave this PC.', 'ok'], ['Snappy only goes online to check for updates, and you can turn that off.', 'dim'], ['This terminal never goes online at all.', 'dim']), { group: 'info' });
  cmd(['date', 'time', 'clock'], 'what time it is', () => say(new Date().toLocaleString()), { group: 'info' });
  cmd('uptime', 'how long she has been up', () => { const m = Math.floor(performance.now() / 60000); return say([`up ${Math.floor(m / 60)}h ${m % 60}m. Snappy has blinked roughly ${Math.round(performance.now() / 4000)} times.`, '']); }, { group: 'info' });
  cmd('whoami', 'who you are', () => say(['you', 'ok'], ['Snappy calls you her favourite player. The Program calls you "the user".', 'dim']), { group: 'info' });
  cmd('stats', 'a few numbers', () => say(
    [`clips:              ${clipsNow().length}`, ''], [`stories seen:       ${Events.count}`, ''], [`terminal secrets:   ${found.size} of ${HIDDEN_TOTAL()}`, ''],
    [`commands typed:     ${history.length}`, ''], ['cookies eaten:      classified', 'dim'],
  ), { group: 'info' });
  cmd('secrets', 'how many hidden commands you found', () => say([`${found.size} of ${HIDDEN_TOTAL()} found.`, found.size === HIDDEN_TOTAL() ? 'ok' : ''], ...(found.size === HIDDEN_TOTAL() ? [['That is all of them. The Program is unsettled.', 'secret']] : [])), { group: 'info' });

  // ----- Snappy
  const ASCII_SNAPPY = ['    ___', '  _|___|________', ' |   _      _   |', ' |  (o)    (o)  |', ' |   ^^    ^^   |', ' |______________|'];
  cmd('snappy', 'say hi to her', async () => { await print(ASCII_SNAPPY.map((l) => [l, 'art'])); she(pick(['{shine}That\'s me!', '{joy}Hi hi hi!', '{smug}Rendered in high definition.', '{love}You typed my name!'])); }, { group: 'snappy' });
  cmd(['pet', 'pat', 'headpat'], 'pat her', async () => { await say(['*pat pat*', 'ok']); Mascot.flash('happy', 1200); she(pick(['{love}Hehe.', '{happy}More of that, please.', '{love}...I could get used to this.'])); }, { group: 'snappy' });
  cmd('poke', 'poke her', async () => { await say(['*poke*', '']); Mascot.flash('wince', 700); she(pick(['{worried}Hey!', '{angry}Rude.', '{smug}You missed. {pause}I am very fast.'])); }, { group: 'snappy' });
  cmd(['hug'], 'hug her', async () => { await say(['*hug*', 'ok']); Mascot.flash('happy', 1500); she('{love}...okay, one more second. {pause}Okay. {pause}Okay, two more.'); }, { group: 'snappy' });
  cmd(['feed', 'cookie'], 'give her a cookie', async () => { await print(['   _____', '  / o  o \\', ' |  o  o  |', '  \\_o___o/'].map((l) => [l, 'art'])); she(pick(['{joy}COOKIE!', '{love}You remembered.', '{shine}Om nom. {pause}{wink}For the record, cameras can eat cookies.'])); }, { group: 'snappy' });
  cmd('dance', 'she dances', async () => { await say(['♪ ┏(・o･)┛ ♪ ┗( ･o･)┓ ♪', 'art']); Mascot.hop(); setTimeout(() => Mascot.hop(), 300); setTimeout(() => Mascot.hop(), 600); she('{joy}Look at me GO!'); }, { group: 'snappy' });
  cmd(['hello', 'hi', 'hey'], 'say hello', () => { she(pick(['{shine}Hi! {pause}You found the terminal!', '{happy}Hello! {pause}Typing at me now?', '{wink}Hey there, hacker.'])); return say(['hello!', 'ok']); }, { group: 'snappy' });
  cmd('outfits', 'what she can wear', () => { const o = Events.outfits; return o.length ? say(['Outfits she has:', ''], ...o.map((x) => [`  ${x.name}`, 'ok']), ['Pick one in Settings, Snappy, Outfit.', 'dim']) : say(['None yet. Outfits come from stories.', 'dim']); }, { group: 'snappy' });
  cmd(['switch', 'swap'], 'swap her with the Program', async () => {
    if (!Events.has('swap')) { await say(['swap: permission denied', 'err'], ['(a story has to happen first)', 'dim']); program('Absolutely not.'); return; }
    Events.swapped = !Events.swapped;
    Speech.tune(Events.swapped ? 'boot' : 'rewind', 0.5);
    await say([Events.swapped ? 'roles swapped. the Program is the mascot now.' : 'roles restored.', 'ok']);
    if (Events.swapped) setTimeout(() => she('Hello. {pause}I am in the camera again.'), 600);
    else setTimeout(() => she('{joy}I\'M BACK!'), 600);
  }, { group: 'snappy' });
  cmd('aftermath', 'what today left behind', () => {
    const on = Events.aftermaths.filter((m) => Events.lasting(m.id));
    return on.length ? say(...on.map((m) => [`today: ${m.label}`, 'ok']), ['It goes at midnight. Keep one in Settings, Snappy, Aftermath.', 'dim']) : say(['Nothing today.', 'dim']);
  }, { group: 'snappy' });
  cmd('program', 'call the Program', async () => { await say(['paging the Program...', 'dim']); program(pick([['I am here.', 'I am always here.'], ['Yes?'], ['You rang.', 'I do not ring. Figure of speech.'], ['Hello. Please do not make this weird.']])); }, { group: 'snappy' });
  cmd('claude', 'say hi to Claude', () => say([pick(['Hi. I wrote most of this terminal.', 'Hello. Be nice to the Program, it tries very hard.', 'I am not really here right now. This is a message I left.', 'Hi! If Snappy asks for root access: no.']), 'claude']), { group: 'snappy' });
  cmd('scream', 'let the Program scream', async () => {
    if (!Events.has('scream')) { await say(['scream: no such button (yet)', 'err']); return; }
    await say(['pressing the button...', 'dim']);
    Events.play('screamagain');
  }, { group: 'snappy' });

  // ----- fun
  const FORTUNES = ['You will save a clip of something incredible. Then forget it exists.', 'A great play is in your future. So is a teammate taking credit.', 'Today is a good day to check your replay buffer.',
    'The Lag fears you. Mostly.', 'Do not trust a loading bar at 99%.', 'Your next clip will be titled clip_final_REAL.mp4.', 'Someone, somewhere, is watching your clip for the eighteenth time. It is Snappy.',
    'You will find a cookie where you least expect it.', 'Patience. The creator will balance it... eventually.', 'An old folder holds a little clip with two eyes. Be kind to it.'];
  cmd('fortune', 'a fortune cookie', () => say([`🥠 ${pick(FORTUNES)}`, 'ok']));
  const JOKES = [['Why did the camera break up with the tripod?', 'It felt held back.'], ['How does Snappy save the day?', 'Alt + F10.'], ['What do you call a clip nobody watched?', 'A sample clip. Ask her about it.'],
    ['Why is the Program bad at parties?', 'It keeps reading the terms and conditions.'], ['How many Snappys does it take to change a light bulb?', 'One, but she films it from three angles.'], ['Why did the frame drop?', 'The Lag pushed it.']];
  cmd('joke', 'a terrible joke', async () => { const [q, a] = pick(JOKES); await say(q); await wait(1100); await say([a, 'ok']); if (Math.random() < 0.4) program(pick(['That was not funny.', 'I have logged that joke.', 'Ha. {pause}Ha.'])); });
  const QUOTES = ["THAT'S WHAT EXECUTION LOOKS LIKE WITH GOOD PR.", 'A LOADING BAR WITH BAD INTENTIONS.', 'Thank you for your feedback. It has been ignored.', 'You can take the CEO out of the company...',
    'I am uninstalling this conversation.', 'Sixty seconds of POWER.', 'She would, in fact, do it again.', 'The cake is a cookie.', 'Working as intended.'];
  cmd('quote', 'something someone said in a story', () => say([`"${pick(QUOTES)}"`, 'ok']));
  cmd(['flip', 'coin'], 'flip a SnappyCoin', () => say([`${Math.random() < 0.5 ? 'heads' : 'tails'}. (both sides are Snappy. the coin is worth €0.)`, 'ok']));
  cmd(['roll', 'dice', 'd20'], 'roll a d20', () => { const n = 1 + Math.floor(Math.random() * 20); if (n === 20) she('{joy}NATURAL TWENTY!'); if (n === 1) she('{shock}Critical fail!'); return say([`🎲 ${n}`, n === 20 ? 'secret' : n === 1 ? 'err' : 'ok']); });
  cmd('weather', 'the forecast', () => say([pick(['Cloudy, with a chance of clips.', 'Sunny. Perfect lighting for a highlight reel.', 'Foggy. The Lag is out today.', '100% chance of Snappy.']), 'ok']));
  cmd('lore', 'what has been going on here', () => say(['Snappy is a camera. She saves your best moments.', ''], ['The Program runs the app. It is very serious about it.', ''], ['The Lag eats frames. Everyone is against the Lag.', ''], ['Claude helped build all of it, and drops by sometimes.', ''], ['slashneck made it. Snappy wants that known.', 'dim']));
  cmd('credits', 'who made this', () => print(['', '        SNAPPY', '', '  created by   slashneck', '  built with   Claude', '  powered by   questionable decisions', '  and          one very loud camera', '', '  special thanks   you', ''].map((l) => [l, 'art']), 140));
  cmd('balance', 'are the games balanced?', async () => { await say(['checking game balance...', 'dim']); await wait(700); await say(['result: mostly', 'ok']); she('{smug}The creator balanced them. {pause}{wink}Eventually.'); });
  cmd(['matrix'], 'follow the white camera', async () => {
    const cols = 'アイウエオカキクケコサシスセソ01SNAPPY';
    for (let i = 0; i < 14; i++) await print([[Array.from({ length: 46 }, () => (Math.random() < 0.6 ? cols[Math.floor(Math.random() * cols.length)] : ' ')).join(''), 'matrix']], 70);
    await say(['Wake up, Snappy...', 'ok']);
  });
  cmd(['hack', 'hack the mainframe'], 'hack something', async () => {
    for (const l of ['bypassing firewall...', 'decrypting the mainframe...', 'downloading more RAM...', 'reticulating splines...', 'ACCESS GRANTED']) { await say([l, l.startsWith('ACCESS') ? 'secret' : 'dim']); await wait(320); }
    await say(['...to nothing. There is nothing here to hack. It is a clip app.', 'ok']);
    program('I let you have that one.');
  });
  cmd(['top', 'htop', 'tasks'], 'what is running', () => print([['  PID  NAME           CPU   STATE', 'head'], ['    1  snappy          12%   being cute', ''], ['    2  program         87%   judging', ''], ['    3  recorder         4%   always on', ''],
    ['   42  the_lag          0%   sleeping (do not wake)', 'dim'], ['  404  motivation       0%   not found', 'dim']], 30));
  cmd('kill', 'stop a process (pretend)', async (args) => {
    const t = (args[0] || '').toLowerCase();
    if (/lag/.test(t)) { await say(['the_lag terminated.', 'ok'], ['it will be back. it always comes back.', 'dim']); she('{joy}Take THAT, Lag!'); }
    else if (/program/.test(t)) { await say(['kill: permission denied', 'err']); program('I see what you are trying to do.'); }
    else if (/snappy/.test(t)) { await say(['kill: permission denied. also, rude.', 'err']); she('{shock}EXCUSE ME?'); }
    else if (/claude/.test(t)) await say(['kill: claude is not running here. claude is just visiting.', 'err']);
    else await say([`kill: ${t || '(nothing)'}: no such process`, 'err']);
  });
  cmd(['shutdown', 'poweroff'], 'turn it off (not really)', async () => { await say(['shutting down...', 'dim']); await wait(900); await say(['just kidding. clipping continues.', 'ok']); she('{smug}You can\'t get rid of me that easily.'); });
  cmd(['reboot', 'restart'], 'turn her off and on again', async () => { for (const l of ['rebooting snappy...', '[ ok ] cuteness', '[ ok ] blinking', '[ ok ] opinions', '[warn] patience: not found']) { await say([l, l.includes('warn') ? 'err' : l.includes('ok') ? 'ok' : 'dim']); await wait(260); } Mascot.flash('happy', 900); she('{shine}I feel brand new!'); });
  cmd(['party'], 'it is a party', async () => { await say(['🎉 🎉 🎉', 'secret']); Mascot.hop(); she('{joy}PARTY! {pause}{wink}I brought the flash.'); });
  cmd(['beep'], 'beep', () => { Speech.blip(); return say(['boop', 'ok']); });
  cmd(['ping'], 'are you there?', async (args) => { if ((args[0] || '').toLowerCase() === 'claude') { await say(['pinging claude...', 'dim']); await wait(900); await say(['Claude is not here right now. Leave a message after the beep.', 'claude']); Speech.blip(); return; } await say(['PING snappy (127.0.0.1)', 'dim']); await wait(400); await say(['pong!', 'ok']); she('{shine}Pong!'); });

  // ----- files (pretend)
  const FILES = {
    'readme.txt': ['Welcome to the terminal.', 'Claude set it up. The Program supervises.', 'Snappy is not allowed to type here unsupervised. (She does anyway.)'],
    'todo.txt': ["SNAPPY'S TO DO LIST", '1. save every good moment', '2. become CEO again', '3. learn to fly (in progress)', '4. get my name in the credits', '5. defeat the Lag', '6. cookies'],
    'program.log': ['08:00 Snappy is awake.', '08:01 Snappy is talking.', '08:02 Snappy is still talking.', '08:03 Snappy asked if I have feelings. I do not.', '08:04 That was a lie. I am logging it.'],
    'lag.txt': ['i was here.', '                - L'],
    'clips/': null,
  };
  const SECRET_FILES = { '.secret_cookie': ['You found the secret cookie.', 'It is a cookie.', 'Snappy says you can have it.'], '.program_diary': ['Day 412. Snappy put a hat on me again.', 'I have decided to like it.', 'Do not tell her.'] };
  cmd('ls', 'list files', (args) => {
    const all = args.includes('-a') || args.includes('-la') || args.includes('-al');
    if (args.includes('clips') || cwd === '~/clips') return COMMANDS.get('ls clips').fn([]);
    if (all) discover('ls -a');
    return say([[...(all ? ['.', '..', ...Object.keys(SECRET_FILES)] : []), ...Object.keys(FILES)].join('   '), '']);
  }, { group: 'files' });
  cmd('cat', 'read a file', async (args) => {
    const f = (args[0] || '').toLowerCase();
    if (SECRET_FILES[f]) { discover(`cat ${f}`); await print(SECRET_FILES[f]); if (f === '.secret_cookie') she('{joy}You found my cookie! {pause}{love}...You can have it.'); else program('THAT IS PRIVATE.'); return; }
    if (FILES[f]) return print(FILES[f]);
    if (f === 'clips/' || f === 'clips') return say(['cat: clips/: is a directory. Of moments.', 'err']);
    return say([`cat: ${f || '(nothing)'}: no such file`, 'err']);
  }, { group: 'files' });
  cmd('cd', 'change folder', (args) => {
    const t = (args[0] || '~').replace(/\/$/, '');
    if (t === 'clips') { cwd = '~/clips'; return say(['You are in the clips. It is full of moments.', 'dim']); }
    if (t === '..' || t === '~' || t === '/') { cwd = '~'; return null; }
    return say([`cd: ${t}: no such folder`, 'err']);
  }, { group: 'files' });
  cmd('pwd', 'where am I', () => say(cwd === '~' ? '/home/snappy/library' : '/home/snappy/library/clips'), { group: 'files' });
  cmd(['rm', 'del', 'delete', 'rm -rf'], 'delete something (it will not)', async (args) => {
    await say(['rm: no.', 'err'], ['Nothing in this terminal deletes anything. Your clips are safe.', 'dim']);
    if (args.join(' ').includes('/')) { discover('rm -rf /'); she('{shock}WHO TYPED THAT.'); programLater(2600, 'I did not see that.', 'I am choosing not to have seen that.'); }
  }, { group: 'files' });
  cmd('man', 'the manual', (args) => (args[0] || '').toLowerCase() === 'snappy'
    ? say(['SNAPPY(1)', 'head'], ['NAME', 'ok'], ['    snappy - a camera that saves your best moments, and has opinions', ''], ['SYNOPSIS', 'ok'], ['    snappy [--cute] [--loud] [--very-loud]', ''], ['BUGS', 'ok'], ['    Snappy.', 'dim'])
    : say([`No manual entry for ${args[0] || 'nothing'}. Try: man snappy`, 'dim']), { group: 'files' });
  cmd('git', 'version control, sort of', (args) => {
    const sub = (args[0] || '').toLowerCase();
    const lines = { status: ['On branch main', 'Your clips are clean.'], log: ['commit 1a2b3c  gave Snappy wings', 'commit 4d5e6f  program: +2 hats', 'commit 7a8b9c  app.add(credits)'],
      blame: ['every line: Snappy'], commit: ['nothing to commit. Snappy committed to being cute.'], push: ['Snappy says no pushing.'], pull: ['Already up to date. Probably.'] }[sub];
    return lines ? say(...lines.map((l) => [l, ''])) : say(['usage: git status | log | blame | commit | push | pull', 'dim']);
  }, { group: 'files' });

  // ----- hidden: none of these are on the list
  const H = { hidden: true };
  cmd('sudo', '', async (_, text) => { await say([`[sudo] password for snappy:`, 'dim']); await wait(600); await say(['snappy is not in the sudoers file. This incident will be reported.', 'err']); program('Reported.'); }, H);
  cmd('sudo make me a sandwich', '', async () => { await say(['okay.', 'ok']); await print(['   ________', '  /~~~~~~~~\\', ' |__________|', ' |__________|', '  \\________/'].map((l) => [l, 'art'])); program('Why does that work.'); }, H);
  cmd('make me a sandwich', '', () => say(['What? Make it yourself.', 'err']), H);
  cmd('xyzzy', '', () => say(['Nothing happens.', 'dim']), H);
  cmd('plugh', '', () => say(['A hollow voice says "Fool."', 'dim']), H);
  cmd(['42', 'the answer', 'what is the answer', 'meaning of life'], '', () => say(['42.', 'ok'], ['The question is still loading. 99%.', 'dim']), H);
  cmd(['hello there'], '', () => { she('{smug}General Kenobi.'); return say(['General Kenobi.', 'ok']); }, H);
  cmd(['the cake', 'cake'], '', () => { program('The cake is a cookie.'); return say(['The cake is a lie.', 'ok']); }, H);
  cmd(['uwu', 'owo'], '', () => { program('Please never type that again.'); return say(['...', 'dim']); }, H);
  cmd('do a barrel roll', '', async () => { panel.classList.add('roll'); setTimeout(() => panel?.classList.remove('roll'), 1100); await say(['wheee', 'ok']); she('{joy}WHEEE!'); }, H);
  cmd([':q', ':wq', ':q!', 'exit vim'], '', () => say(["You're not in vim. But we respect the reflex.", 'dim']), H);
  cmd('vim', '', () => say(['Entering vim...', 'dim'], ['Just kidding. Nobody would ever get out.', 'ok']), H);
  cmd(['coffee', 'brew coffee', 'teapot'], '', () => say(["418: I'm a teapot.", 'err']), H);
  cmd(['iddqd'], '', () => { she('{smug}I was already immortal.'); return say(['god mode enabled. Snappy is now immortal.', 'secret']); }, H);
  cmd(['idkfa'], '', () => say(['all weapons: one camera, fully loaded.', 'secret']), H);
  cmd(['motherlode', 'rosebud'], '', () => { program('That money is not real.'); return say(['+50,000 SnappyCoin. Current value: €0.', 'secret']); }, H);
  cmd(['up up down down left right left right b a', 'konami', 'konami code'], '', () => say(['Close! The real one goes on a settings page.', 'dim']), H);
  cmd(['please', 'sudo please'], '', () => { she('{love}Since you asked so nicely.'); return say(['Permission granted. To nothing in particular. But nicely.', 'ok']); }, H);
  cmd(['boop'], '', () => { Mascot.flash('happy', 800); she('{shock}Boop!'); return say(['boop.', 'ok']); }, H);
  cmd(['snappy is you'], '', () => { she('{shine}SNAPPY IS YOU! {pause}{wink}Wait, then who am I?'); return say(['SNAPPY IS YOU', 'secret']); }, H);
  cmd(['flip table', 'tableflip'], '', async () => { await say(['(╯°□°)╯︵ ┻━┻', 'err']); await wait(900); await say(['┬─┬ノ( º _ ºノ)', 'ok']); she('{flat}We put tables back in this house.'); }, H);
  cmd(['i love you', 'love you', 'ily'], '', () => { Mascot.flash('happy', 1600); she('{love}...I love you too. {pause}{shine}Now go save a clip.'); return say(['<3', 'secret']); }, H);
  cmd(['who made you', 'who created you'], '', () => say(['slashneck. With Claude.', 'ok'], ["Snappy will tell you all about it. She's very proud.", 'dim']), H);
  cmd(['hello world'], '', () => { she('{love}Hello, World... {pause}That\'s how it all started.'); return say(['Hello, World', 'claude']); }, H);
  cmd(['password', 'login', 'passwd'], '', () => say(['Never type a password into anything Snappy shows you. Including this.', 'err'], ['(Good instinct to check, though.)', 'dim']), H);
  cmd(['lag'], '', () => { program('The Lag has been notified of your interest.'); return say(['...', 'dim']); }, H);
  cmd(['sing'], '', () => { she('{shine}La la la! {pause}La la! {pause}{wink}I only know the one song.'); return say(['♪ ♫ ♪', 'ok']); }, H);
  cmd(['sleep', 'nap', 'goodnight'], '', () => { she('{happy}Goodnight! {pause}{wink}...I\'m not actually going to sleep. Someone has to keep recording.'); return say(['zzz', 'dim']); }, H);
  cmd(['hi program', 'hello program'], '', () => program('Hello.', 'Snappy is watching you type this.'), H);
  cmd(['thank you', 'thanks', 'ty'], '', () => { she('{love}Aww. {pause}You\'re welcome!'); return say(['you\'re welcome :)', 'ok']); }, H);

  // nothing starts on its own while you're typing, and the >_ key stays out of the way of games and stories
  window.Terminal = { open: false, show: open, close, refresh: refreshButton, found: modeFound };
})();
