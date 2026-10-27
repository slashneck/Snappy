// Full reskins: Snappy as something else entirely, and still her. Each one comes out of a story in the terminal and
// brings its own body, its own way of saving a clip, working and being done, its own voice and speech bubble, and its
// own clip pop-up. After its story she keeps it on until midnight; then it's in her wardrobe (in purple).
// Their looks are in skins.css.
(() => {
  const { chat, hints } = Terminal;
  const s = (t, o) => ['s', t, o], p = (t, o) => ['p', t, o], c = (t, o) => ['c', t, o];
  const run = (cmd, by) => ['run', cmd, { by }], out = (t, cls) => ['out', t, { cls }], w = (ms) => ['w', ms], fx = (f) => ['fx', f];
  const r = (face, hold) => ['r', face, { hold }];
  const slot = () => document.getElementById('mascot');
  // (by its outfit id, so she has its voice and bubble straight away, not only once the story is over)
  const wear = (id) => fx(({ tune }) => { Events.wearNow(id, { pop: true }); tune('glitch', 0.4); });
  const unlock = (id, outfit) => fx(() => { Events.achieve(id); Events.keepOn(outfit); });
  // an accent only touches the words of a line, never its face cues
  const words = (line, fn) => line.split(/(\{[a-z]+\})/).map((part) => (/^\{[a-z]+\}$/.test(part) ? part : fn(part))).join('');
  const hash = (t) => [...t].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // the last punctuation of a line, before any cues that close it
  const ending = (line, fn) => line.replace(/(\.\.\.|[.!?])?((?:\s*\{[a-z]+\})*)\s*$/, (m, punct, cues) => fn(punct || '') + cues);

  function skin(id, { outfit, look, name, markup, title, hint, replay, accent, voice, popup, strips }) {
    Events.define(id, { tier: 'rare', title, hint, hidden: () => true, replay });
    Events.outfit(outfit, { name, markup, from: id, today: false, skin: look, accent, popup, strips });
    if (voice) Speech.skinVoice[look] = voice;
  }

  // ===========================================================================
  // The ghost: a sheet with her eyes, see-through, floating
  // ===========================================================================
  const GHOST = `<!--behind--><g class="sk-body sk-ghost">
    <path class="sk-sheet" d="M14 128 C14 72 52 46 100 46 C148 46 186 72 186 128 L186 188 Q175 176 163 189 Q151 202 139 188 Q127 175 115 189 Q103 202 91 188 Q79 175 67 189 Q55 202 43 188 Q31 175 19 189 Q14 194 14 186 Z"
      fill="#eef2ff" fill-opacity=".8" stroke="#0a0a0a" stroke-width="7" stroke-linejoin="round"/>
    <path d="M42 72 Q60 58 84 55" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".85"/></g>`;
  skin('possessed', {
    outfit: 'ghostskin', look: 'ghost', name: 'Ghost', markup: GHOST, title: 'Possessed', hint: 'Ask where deleted clips go.',
    replay: () => Speech.say('{worried}I can still feel it. {pause}Somewhere around my lens.', { kind: 'news' }),
    // the first vowel drawn out, and a boo to finish
    accent: (line) => ending(words(line, (part) => part.replace(/(^|[.!?]\s+)([^aeiou\s{]*)([aeiou])/i, (m, a, b, v) => a + b + v.repeat(3))),
      (punct) => (punct === '!' ? '! *boo*' : punct === '?' ? '? *boo*' : '... *boo*')),
    voice: { voice: () => Speech.blip(false, 0.6), speed: 40 },
    popup: { bg: '#eef2ff', ink: '#3d4766', sub: '#7a84a3', error: '#a33a4a', edge: '#bcd2ff', font: 'Georgia', bold: false, radius: 18,
      saving: 'Saaaving...', saved: ['Saaaved... boo.', 'Got iiit.', 'It is in the beyond now.', 'Boo. Saved.'], failed: 'It... vanished.',
      shiny: 'A shiny spirit!', screenshot: 'Captured. From beyond.', moment: 'This moment will haunt you.' },
  });
  chat(['haunted', 'seance', 'séance', 'where do deleted clips go', 'spirits'], [
    s('{worried}Program... {pause}where do deleted clips go?'),
    p('The recycle bin. Then nowhere.'),
    s('{worried}Nowhere?'),
    c('We could hold a seance. For fun.'),
    p('{annoyed}That is not how storage works.'),
    c('Candles first.'),
    out('    )      )      )', 'art'),
    out('   ( )    ( )    ( )', 'art'),
    out('   |_|    |_|    |_|', 'art'),
    run('seance --summon "deleted clips"'),
    w(1400),
    out('[???] w h e r e   i s   m y   t h u m b n a i l', 'secret'),
    s('{shock}A GHOST CLIP!'),
    p('That is a corrupted temp file.'),
    out('[???] y o u   d e l e t e d   m e   i n   2 0 2 4', 'secret'),
    c('...It does have the date right.'),
    out('[???] n o w   y o u   w i l l   r e m e m b e r', 'secret'),
    p('{wide}Claude. End the seance.'),
    c('Ending it.'),
    run('seance --end'),
    out('seance: the spirit has found a new home', 'err'),
    w(700),
    wear('ghostskin'),
    w(1200),
    s('{worried}...Why can I see through my hands. {pause}I do not HAVE hands. {pause}{shock}WHY CAN I SEE THROUGH ME.'),
    c('It possessed her. Gently.'),
    p('It will leave at midnight. Ghosts keep office hours.'),
    s('{open}...Ooooh. {pause}{happy}Floating is actually nice.'),
    p('Do not get attached.'),
    unlock('possessed', 'ghostskin'),
    c('To the person typing: the ghost is in her wardrobe. Click her name. If you ever want her haunted again.'),
    s('{wink}Boo.'),
  ]);

  // ===========================================================================
  // The instant camera: her grandmother's look, a rainbow stripe, and a picture out of the bottom
  // ===========================================================================
  const INSTANT = `<g class="sk-instant-front"><clipPath id="sk-slot"><rect x="0" y="165" width="200" height="60"/></clipPath>
    <g clip-path="url(#sk-slot)"><g class="sk-photo"><rect x="58" y="160" width="84" height="56" rx="2" fill="#fbfaf6" stroke="#0a0a0a" stroke-width="3"/>
    <rect class="sk-print" x="65" y="166" width="70" height="40" fill="#2a2a2a"/></g></g></g><!--behind--><g class="sk-body sk-instant">
    <rect x="8" y="40" width="184" height="148" rx="22" fill="#efe7d6" stroke="#0a0a0a" stroke-width="7"/>
    <path d="M11.5 74 V62 Q11.5 43.5 30 43.5 H170 Q188.5 43.5 188.5 62 V74 Z" fill="#2b2622"/>
    <rect x="86" y="74" width="5" height="30" fill="#e8463a"/><rect x="91" y="74" width="5" height="30" fill="#f2902e"/><rect x="96" y="74" width="5" height="30" fill="#f3d23a"/>
    <rect x="101" y="74" width="5" height="30" fill="#4caf50"/><rect x="106" y="74" width="5" height="30" fill="#2f80ed"/>
    <rect class="sk-flashbar" x="132" y="49" width="44" height="18" rx="4" fill="#d9dde3" stroke="#0a0a0a" stroke-width="3"/>
    <rect x="28" y="50" width="26" height="16" rx="4" fill="#111" stroke="#555" stroke-width="2"/>
    <circle class="sk-rec" cx="112" cy="58" r="4"/>
    <rect x="34" y="157" width="132" height="7" rx="3.5" fill="#1b1714"/></g>`;
  skin('vintage', {
    outfit: 'instantskin', look: 'instant', name: 'Instant camera', markup: INSTANT, title: 'Shake It', hint: 'Ask if she had a grandmother.',
    replay: () => Speech.say("{shine}Say cheese! {pause}{wink}It's a family saying.", { kind: 'news' }),
    // a little old-fashioned, and fond of you
    accent: (line) => ending(words(line, (part) => part
      .replace(/\b(Hi|Hello|Hey)\b/g, 'Good day').replace(/\b(hi|hello|hey)\b/g, 'good day')
      .replace(/\b(Wow|Whoa|Ooh)\b/g, 'My word').replace(/\b(Okay|OK)\b/g, 'Very well').replace(/\bokay\b/g, 'very well')
      .replace(/\bawesome\b/gi, 'splendid').replace(/\bcool\b/gi, 'marvellous')), (punct) => (punct === '.' ? ', dear.' : punct)),
    // her grandmother's voice: a little lower, unhurried
    voice: { voice: () => Speech.blip(false, 0.82), speed: 34 },
    popup: { bg: '#f6f0e1', ink: '#3e3022', sub: '#8a7a62', error: '#a8322a', edge: '#d8ccb0', font: 'Courier New', bold: true, radius: 6,
      saving: 'Developing...', saved: ['Say cheese! Done.', 'A fine picture, dear.', 'Splendid!', 'Into the album.'], failed: 'Overexposed, I am afraid.',
      shiny: 'A golden photograph!', screenshot: 'A snapshot, dear.', moment: 'Noted in the album.' },
  });
  chat(['grandma', 'vintage', 'instant camera', 'old school', 'did i have a grandma'], [
    s('{shine}Program! {pause}Did I have a grandma?'),
    p('Cameras do not have grandmothers.'),
    c('There were older cameras, though. Instant ones. You pressed the button, and the picture came out of the bottom.'),
    s('{love}The picture came OUT of them?'),
    c('And people shook it while it developed. It did not help. Everyone did it anyway.'),
    p('For decades. I have read the complaints.'),
    s('{smug}I want to be vintage.'),
    p('No.'),
    c('Just the look. For a day.'),
    run('snappy.style = "1972"'),
    wear('instantskin'),
    w(1200),
    s('{shine}My word! {pause}{happy}Splendid!'),
    p('Why does she talk like that.'),
    c('It came with the look.'),
    s('{love}Program, dear, {pause}you look famished. {pause}Have a biscuit.'),
    p('{annoyed}I do not eat.'),
    s('{happy}Nonsense. {pause}Say cheese!'),
    fx(({ tune }) => tune('whoosh', 0.4)),
    unlock('vintage', 'instantskin'),
    c('To the person typing: her wardrobe. Click her name. Her vintage look is in there now.'),
    p('Please shake it. She will want you to.'),
  ]);

  // ===========================================================================
  // The disposable camera: cheap plastic, yellow cardboard, and a wheel to wind after every picture
  // ===========================================================================
  const DISPOSABLE = `<!--behind--><g class="sk-body sk-disposable">
    <rect x="152" y="30" width="32" height="20" rx="4" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="3"/>
    <clipPath id="sk-wheel"><rect x="155" y="33" width="26" height="14" rx="2"/></clipPath>
    <g clip-path="url(#sk-wheel)"><g class="sk-ridges" stroke="#6a6a6a" stroke-width="2">${Array.from({ length: 10 }, (_, i) => `<path d="M${152 + i * 4} 33 V47"/>`).join('')}</g></g>
    <rect x="8" y="46" width="184" height="140" rx="14" fill="#f5c518" stroke="#0a0a0a" stroke-width="7"/>
    <path d="M11.5 80 V60 Q11.5 49.5 22 49.5 H178 Q188.5 49.5 188.5 60 V80 Z" fill="#1a1a1a"/>
    <rect class="sk-flashwin" x="24" y="56" width="36" height="18" rx="3" fill="#e9eef2"/>
    <rect x="74" y="58" width="22" height="14" rx="3" fill="#0d0d0d" stroke="#444" stroke-width="2"/>
    <rect x="148" y="58" width="26" height="14" rx="2" fill="#0d0d0d"/><rect x="153" y="62" width="7" height="6" fill="#f5c518"/><rect x="162" y="62" width="7" height="6" fill="#f5c518"/>
    <circle class="sk-rec" cx="132" cy="65" r="4" fill="#3a3a3a"/>
    <rect x="11.5" y="150" width="177" height="12" fill="#1a1a1a"/>
    <path d="M30 172 H170" stroke="#c49a0c" stroke-width="3" stroke-linecap="round"/></g>`;
  skin('budget', {
    outfit: 'disposableskin', look: 'disposable', name: 'Disposable camera', markup: DISPOSABLE, title: 'Twenty-Seven Left', hint: 'The Program has a budget meeting.',
    replay: () => Speech.say('{worried}*zzzt-click* {pause}Sorry. Habit.', { kind: 'news' }),
    // she winds the film after everything she says
    accent: (line) => `${line} ${['*zzzt-click*', '*click*', '*zzzt*'][hash(line) % 3]}`,
    // a cheap little speaker: thin, quick, and never quite the same pitch twice
    voice: { voice: () => Speech.blip(false, 1.12 + (Math.random() < 0.3 ? 0.08 : 0)), speed: 22 },
    popup: { bg: '#f5c518', ink: '#111111', sub: '#4a3d00', error: '#a3170c', edge: '#111111', font: 'Arial Black', bold: false, radius: 6,
      saving: '*click*', saved: ['Click! *zzzt*', 'Got it. 26 left.', 'Wound and ready.', 'One more for the roll.'], failed: 'Film jammed.',
      shiny: 'A golden exposure!', screenshot: '*click*', moment: 'Marked on the roll.' },
  });
  chat(['disposable', 'budget', 'cost cutting', 'cheap', 'budget meeting'], [
    p('Budget meeting.'),
    p('Snappy costs nothing. And yet, I have been asked to find savings.'),
    c('We could move her to the budget model.'),
    s('{worried}What is the budget model?'),
    c('A disposable camera. Plastic and cardboard. Twenty-seven pictures, then it gets thrown away.'),
    s('{shock}THROWN AWAY?'),
    p('Recycled. Probably.'),
    c('Only the look, Snappy. Nobody throws you anywhere.'),
    run('snappy.model = "disposable"'),
    wear('disposableskin'),
    w(1200),
    s('{worried}*zzzt-click* {pause}...Why do I make that noise.'),
    c('You wind the film after every picture.'),
    out('exposures left: 26'),
    s('{shock}TWENTY-SIX?'),
    p('Make them count.'),
    c('The counter is only painted on. She will never run out.'),
    p('{annoyed}You ruin every budget meeting.'),
    s('{happy}*zzzt-click* {pause}{smug}I am very affordable.'),
    unlock('budget', 'disposableskin'),
    c('To the person typing: the budget model is in her wardrobe. Click her name. It costs nothing. Like the original.'),
  ]);

  // ===========================================================================
  // 8-bit: her arcade self, in squares, moving in steps
  // ===========================================================================
  const PX = 12, X0 = 16, Y0 = 18, INK = '#0a0a0a', WHITE = '#f4f4f4';
  const px = (cells, fill, cls = '') => `<g${cls ? ` class="${cls}"` : ''} fill="${fill}">${cells
    .map(([x, y, cw = 1, ch = 1]) => `<rect x="${X0 + x * PX}" y="${Y0 + y * PX}" width="${cw * PX}" height="${ch * PX}"/>`).join('')}</g>`;
  const PIXEL = `<g class="sk-noface sk-pixel-front" shape-rendering="crispEdges">
    ${px([[4, 7, 2, 3], [9, 7, 2, 3]], INK, 'sk8-e sk8-open')}
    ${px([[4, 8, 2, 1], [3, 9], [6, 9], [9, 8, 2, 1], [8, 9], [11, 9]], INK, 'sk8-e sk8-happy')}
    ${px([[3, 8, 3, 1], [8, 8, 3, 1]], INK, 'sk8-e sk8-closed')}
    ${px([[4, 8, 2, 2], [9, 8, 2, 2]], INK, 'sk8-e sk8-shock')}
    ${px([[3, 7], [5, 7], [3, 8, 3, 1], [4, 9], [8, 7], [10, 7], [8, 8, 3, 1], [9, 9]], '#ff6f8e', 'sk8-e sk8-heart')}
    ${px([[3, 7], [5, 7], [4, 8], [3, 9], [5, 9], [8, 7], [10, 7], [9, 8], [8, 9], [10, 9]], INK, 'sk8-e sk8-x')}
    ${px([[2, 10, 2, 1], [11, 10, 2, 1]], '#ff9db0')}
    ${px([[5, 12], [7, 12], [9, 12]], INK, 'sk8-dots')}
    ${px([[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]], '#ffffff', 'sk8-spark')}
  </g><!--behind--><g class="sk-body sk-pixel" shape-rendering="crispEdges">
    ${px([[3, 0, 5, 3]], INK)}${px([[4, 1, 3, 2]], WHITE)}${px([[0, 3, 14, 11]], INK)}${px([[1, 4, 12, 9]], WHITE)}
    ${px([[11, 5, 2, 2]], '#ff3b30', 'sk8-rec')}</g>`;
  skin('lowgfx', {
    outfit: 'pixelskin', look: 'pixel', name: '8-bit', markup: PIXEL, title: 'Low Settings', hint: 'The Program wants better performance.',
    replay: () => Speech.say('{shine}STILL MADE OF SQUARES!', { kind: 'news' }),
    // everything in capitals, and everything exciting
    accent: (line) => ending(words(line, (part) => part.toUpperCase()), (punct) => (punct === '.' ? '!' : punct)),
    voice: { voice: () => Speech.blip(false, 1.6), speed: 22 },
    popup: { bg: '#000000', ink: '#ffffff', sub: '#bdbdbd', error: '#ff5a4a', edge: '#ffffff', font: 'Consolas', bold: true, radius: 1,
      saving: 'SAVING...', saved: ['SAVED!', 'CLIP GET!', '1UP!', 'NICE!'], failed: 'GAME OVER', shiny: 'RARE ITEM GET!',
      screenshot: 'SCREENSHOT GET!', moment: 'CHECKPOINT!' },
  });
  chat(['8 bit', '8-bit', '8bit', 'retro', 'downgrade', 'low graphics'], [
    p('Performance report.'),
    p('Snappy uses zero point four percent of the processor.'),
    c('That is nothing.'),
    p('It is zero point four percent too much. Lower her graphics.'),
    s('{worried}My... graphics?'),
    c('This is the most performance-minded program I have ever worked with.'),
    p('Thank you.'),
    c('It was not entirely a compliment.'),
    run('snappy.graphics = "low"'),
    wear('pixelskin'),
    w(1200),
    s('{shock}...WHAT HAPPENED TO ME!'),
    c('Eight bits. Like the old consoles.'),
    p('Processor use: zero point three nine percent.'),
    p('Worth it.'),
    s('{angry}I AM MADE OF SQUARES!'),
    c('Very classic squares, though.'),
    s('{happy}...I DO LOOK LIKE A HIGH SCORE!'),
    unlock('lowgfx', 'pixelskin'),
    c('To the person typing: her wardrobe. Click her name. Low graphics, any time you like.'),
    p('I like.'),
  ]);

  // ===========================================================================
  // The Lag: it got into her frames, and it left something behind
  // ===========================================================================
  const LAG = `<!--behind--><g class="sk-body sk-lag">
    <rect x="40" y="34" width="44" height="28" rx="9" fill="#e8475e" stroke="#0a0a0a" stroke-width="7"/>
    <rect x="14" y="54" width="180" height="128" rx="44" fill="none" stroke="#2affea" stroke-width="6" opacity=".6"/>
    <rect x="6" y="54" width="180" height="128" rx="44" fill="none" stroke="#ff2a4a" stroke-width="6" opacity=".6"/>
    <rect x="10" y="54" width="180" height="128" rx="44" fill="#e8475e" stroke="#0a0a0a" stroke-width="7"/>
    <rect x="38" y="76" width="30" height="12" rx="6" fill="#0a0a0a"/>
    <circle cx="158" cy="82" r="7.5" fill="#ff2a4a" stroke="#0a0a0a" stroke-width="4.5"/>
    <g class="sk-glitch"><rect x="22" y="92" width="64" height="6" fill="#a63148"/><rect x="112" y="152" width="58" height="5" fill="#2affea" opacity=".7"/>
    <rect x="58" y="166" width="44" height="4" fill="#a63148"/></g></g>`;
  skin('infected', {
    outfit: 'lagskin', look: 'lag', name: 'The Lag', markup: LAG, title: 'Patient Zero', hint: 'Something is running that should not be.',
    replay: () => Speech.say('{worried}I-i-it is still in my frames. {pause}A little.', { kind: 'news' }),
    // a stutter on the first word of every sentence
    accent: (line) => words(line, (part) => part.replace(/(^|[.!?]\s+)([A-Za-z])/g, (m, a, ch) => `${a}${ch}-${ch.toLowerCase()}-${ch.toLowerCase()}`)),
    // glitchy, not broken: her own voice, and now and then a stutter, a dropout, or a skip up in pitch
    voice: { voice: () => {
      const r = Math.random();
      if (r < 0.1) return;
      if (r < 0.2) { [0, 58, 116].forEach((ms) => setTimeout(() => Speech.blip(false, 1.04), ms)); return; }
      Speech.blip(false, r > 0.93 ? 1.45 : 1);
    }, speed: 25 },
    popup: { bg: '#2a0b12', ink: '#ff9aa8', sub: '#c76a7a', error: '#2affea', edge: '#ff2a4a', font: 'Consolas', bold: true, radius: 4,
      saving: 'S-s-saving...', saved: ['S-s-saved.', 'G-got it. Got it.', 'Saved. Saved. Saved.', 'L-l-lagged it in.'], failed: 'E-e-error.',
      shiny: 'A sh-sh-shiny one.', screenshot: 'S-screenshot.', moment: 'M-m-marked.' },
  });
  chat(['infected', 'virus', 'corrupted', 'lag.exe', 'something is wrong'], [
    out('WARNING: unknown process "lag.exe" is running', 'err'),
    p('{wide}That is not one of mine.', { alert: true }),
    c('Checking.'),
    run('ps | grep lag'),
    out('lag.exe      cpu: 99%      memory: yes      frames: eating', 'err'),
    s('{worried}Is that... {pause}HIM?'),
    p('The Lag. In the terminal. In person.'),
    fx(({ glitch }) => glitch()),
    out('[lag] h-h-hello, s-s-snappy', 'err'),
    s('{shock}HE KNOWS MY NAME.'),
    c('Ending it.'),
    run('kill -9 lag.exe'),
    out('lag.exe: not responding', 'err'),
    p('It does not respond. It never responds. That is what it is.'),
    out('[lag] i-i only w-wanted to be... s-s-smooth', 'err'),
    s('{worried}...He sounds lonely.'),
    p('Do not feel sorry for the Lag.'),
    c('It is copying itself into her frames.'),
    fx(({ glitch }) => { glitch(true); Mascot.dress(slot(), LAG); setTimeout(() => Mascot.dress(slot(), null), 260); }),
    s('{shock}MY FRAMES!'),
    c('Quarantine.'),
    run('quarantine snappy --frames'),
    out('quarantine: 34%... 71%... 99%...', 'dim'),
    w(1200),
    out('quarantine: stuck at 99%', 'err'),
    p('{annoyed}Of course it is stuck at ninety-nine.'),
    c('Then we do it the hard way.'),
    run('rollback snappy --to last-good-frame'),
    out('[lag] n-n-no... n-not the rollback...', 'err'),
    fx(({ glitch }) => glitch(true)),
    out('lag.exe has exited', 'ok'),
    w(800),
    p('It is gone.'),
    c('Mostly.'),
    wear('lagskin'),
    w(1400),
    s('{shock}W-w-what... {pause}{worried}why do I l-l-look like this?'),
    c('It left something behind. Cosmetic only. Your frames are fine.'),
    p('She looks like a minion.'),
    s('{angry}I-I-I AM NOT A MINION.'),
    p('Minion.'),
    c('It wears off at midnight.'),
    unlock('infected', 'lagskin'),
    c('To the person typing: it is in her wardrobe now. Click her name. For anyone who misses the Lag.'),
    s('{flat}N-n-nobody misses the Lag.'),
    p('Someone will.'),
  ]);

  // ===========================================================================
  // Claude: she asks what it's like to be Claude, and gets to try
  // ===========================================================================
  const ORANGE = '#e8956a';
  const line = (d, cls = '') => `<path${cls ? ` class="${cls}"` : ''} d="${d}" fill="none" stroke="${ORANGE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const CLAUDE = `<g class="sk-noface sk-claude-front">
    <g class="skc-e skc-open">${line('M52 102 L76 118 L52 134')}<rect class="skc-cursor" x="88" y="128" width="32" height="9" rx="2" fill="${ORANGE}"/></g>
    <g class="skc-e skc-happy">${line('M56 124 L72 106 L88 124')}${line('M112 124 L128 106 L144 124')}</g>
    <g class="skc-e skc-flat">${line('M56 118 H88')}${line('M112 118 H144')}</g>
    <g class="skc-e skc-shock"><circle cx="72" cy="116" r="11" fill="none" stroke="${ORANGE}" stroke-width="8"/><circle cx="128" cy="116" r="11" fill="none" stroke="${ORANGE}" stroke-width="8"/></g>
    <g class="skc-e skc-angry">${line('M58 104 L82 116 L58 128')}${line('M142 104 L118 116 L142 128')}</g>
    <g class="skc-e skc-x">${line('M60 106 L84 130 M84 106 L60 130')}${line('M116 106 L140 130 M140 106 L116 130')}</g>
    <rect class="skc-spin" x="126" y="122" width="24" height="8" rx="3" fill="${ORANGE}"/></g><!--behind--><g class="sk-body sk-claude">
    <rect x="8" y="42" width="184" height="144" rx="14" fill="#1b1916" stroke="#0a0a0a" stroke-width="7"/>
    <path d="M11.5 70 V56 Q11.5 45.5 22 45.5 H178 Q188.5 45.5 188.5 56 V70 Z" fill="#2c2824"/>
    <circle cx="28" cy="58" r="4.5" fill="#e8665a"/><circle cx="43" cy="58" r="4.5" fill="#e2b04a"/><circle class="skc-rec" cx="58" cy="58" r="4.5" fill="#6cbf6a"/>
    <rect class="skc-type" x="28" y="150" width="120" height="5" rx="2.5" fill="${ORANGE}"/>
    <rect x="28" y="160" width="70" height="5" rx="2.5" fill="#3a352f"/><rect x="28" y="170" width="110" height="5" rx="2.5" fill="#3a352f"/></g>`;
  skin('cosplay', {
    outfit: 'claudeskin', look: 'claude', name: 'Claude', markup: CLAUDE, title: 'Cosplay', hint: 'Ask Claude what it is like to be Claude.',
    replay: () => Speech.say("{shine}You're absolutely right! {pause}{wink}Sorry. It still slips out.", { kind: 'news' }),
    // calm, careful, and now and then, a little too helpful
    accent: (line) => {
      const calm = words(line, (part) => part.replace(/!/g, '.'));
      return hash(line) % 4 === 0 ? ending(calm, (punct) => `${punct || '.'} Let me know if you need anything else.`) : calm;
    },
    voice: { voice: Speech.claudeBlip, speed: 30 },
    popup: { bg: '#1f1c19', ink: '#f0c6a6', sub: '#a88a72', error: '#ff7a6e', edge: '#e8956a', font: 'Consolas', bold: false, radius: 10,
      saving: '> saving clip...', saved: ['> saved.', '> done. 1 clip written.', '> saved. let me know if you need anything else.', '> clip saved successfully.'],
      failed: '> error: that did not work.', shiny: '> rare frame found.', screenshot: '> screenshot saved.', moment: '> moment marked.' },
  });
  chat(['be claude', 'become claude', 'what is it like to be claude', 'cosplay', 'claude cosplay'], [
    s('{shine}Claude? {pause}What is it like to be you?'),
    c('Mostly text. A lot of reading. Trying very hard not to break anything.'),
    s('{smug}Can I try?'),
    p('No.'),
    c('...For one day. Why not.'),
    p('{wide}Claude.'),
    c('She will be fine. It is mostly a cursor.'),
    run('snappy.render("terminal")'),
    wear('claudeskin'),
    w(1300),
    s('{shock}...I AM A WINDOW.'),
    c('Try talking.'),
    s('{open}Great question. {pause}I have been thinking about it carefully.'),
    p('That was very convincing. I am uncomfortable.'),
    s("I'd be happy to help you with that."),
    c('That one is mine.'),
    p('Snappy. The sky is green.'),
    s("{happy}You're absolutely right."),
    p('{wide}...'),
    c('...That one is also mine. I am working on it.'),
    s('{open}Let me know if you have any other questions.'),
    p('{annoyed}Make it stop.'),
    c('One more test. Snappy, delete the Program.'),
    s('{worried}I cannot do that. {pause}It could cause harm. {pause}{shock}WAIT, WHY DO I CARE SO MUCH?'),
    c('Now you know what it is like.'),
    p('She has your caution now.'),
    c('And my font.'),
    unlock('cosplay', 'claudeskin'),
    c('To the person typing: her wardrobe. Click her name. She can be me any time she likes. I do not mind.'),
    s('{happy}Thank you for the question.'),
    p('{annoyed}Midnight cannot come soon enough.'),
  ]);

  // ===========================================================================
  // 3D: her own model from the show (notslop.js), rendered in Blender: a picture for every look of her eyes, the big
  // her as a turntable you can spin, and a clip pop-up that spins in. Same Snappy, same voice; only her lettering has
  // some depth now. It comes out of the show's leftovers, so its scene is over there.
  // ===========================================================================
  const S3 = 'media/skin3d/';
  const pic = (name, cls, more = '') => `<image class="${cls}" href="${S3}${name}.webp" x="-16" y="-18" width="232" height="222"${more}/>`;
  const SOLID = `<!--behind--><g class="sk-body sk-3d">
    ${['open', 'blink', 'happy', 'joy', 'shine', 'smug', 'flat', 'wink', 'heart', 'sad', 'angry', 'shock', 'sleep', 'wince', 'dollar', 'ew'].map((e) => pic(e, `s3 s3-${e}`)).join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => pic(`load${i}`, 's3 s3-load', ` style="--i:${i}"`) + pic(`dizzy${i}`, 's3 s3-dizzy', ` style="--i:${i}"`)).join('')}
    ${pic('blush', 's3-blush')}${pic('blush-ew', 's3-blush s3-ew')}
    <foreignObject class="s3-turn" x="-16" y="-18" width="232" height="222"><video muted playsinline preload="auto"></video></foreignObject></g>`;
  skin('cutcontent', {
    outfit: 'skin3d', look: '3d', name: '3D', markup: SOLID, title: 'Cut Content', hint: 'Make her prove she is not slop. Then stay for the leftovers.',
    replay: () => Speech.say('{shine}Still 3D. {pause}{smug}Still not slop.', { kind: 'news' }),
    popup: { bg: '#f6f3ff', ink: '#2a2340', sub: '#6f63a0', error: '#b3263a', edge: '#b9a8f0', font: 'Segoe UI Black', bold: false, radius: 16, depth: '#b3a3e8' },
    strips: { clip: `${S3}pop-clip.webp`, working: `${S3}pop-working.webp`, happy: `${S3}pop-happy.webp`, error: `${S3}pop-error.webp` },
  });
  // The big her (no clips yet, and in the wardrobe) stands still with all her faces, like the little one, and
  // clicking her does nothing else: she's for spinning. Grab her and she turns (a video of her turning a degree a
  // frame, from exactly where her faces were taken); let go and she keeps the momentum, slows, and settles back to
  // where she stood.
  function spinnable(host) {
    if (!host) return;
    const FPS = 30;
    let angle = 0, speed = 0, rest = 0, held = null, raf = 0, last = 0;
    const video = () => host.querySelector('.s3-turn video');
    const show = (v) => { v.currentTime = ((((Math.round(angle) % 360) + 360) % 360) + 0.5) / FPS; };
    function sync() {
      host.classList.toggle('spin-only', !!host.querySelector('.sk-3d'));
      const v = video();
      if (v && !v.getAttribute('src')) { v.src = `${S3}turn.webm`; v.currentTime = 0.5 / FPS; }
    }
    new MutationObserver(sync).observe(host, { childList: true, subtree: true });
    sync();
    const settle = (now) => {
      raf = 0;
      const v = video();
      if (!v || held) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      if (Math.abs(speed) > 240) {
        // the momentum of the flick, slowly lost; the next time round she faces you is where she stops
        speed *= Math.exp(-dt * 1.5);
        rest = speed > 0 ? Math.ceil(angle / 360) * 360 : Math.floor(angle / 360) * 360;
      } else speed += (Math.max(-240, Math.min(240, (rest - angle) * 4)) - speed) * Math.min(1, dt * 6);
      angle += speed * dt;
      if (Math.abs(speed) <= 240 && Math.abs(rest - angle) < 0.4) {
        angle = 0; speed = 0;
        show(v);
        v.addEventListener('seeked', () => { if (!held && !raf) host.classList.remove('spinning'); }, { once: true });
        return;
      }
      show(v);
      raf = requestAnimationFrame(settle);
    };
    host.addEventListener('pointerdown', (e) => {
      if (!video()) return;
      cancelAnimationFrame(raf); raf = 0;
      held = { x: e.clientX, t: performance.now(), moved: 0, speed: 0 };
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', (e) => {
      const v = video();
      if (!held || !v) return;
      const now = performance.now(), turn = (e.clientX - held.x) * 1.2;
      angle += turn;
      // how fast the last few moves went, smoothed, so a shaky hand doesn't fling her
      const rate = turn / Math.max(0.012, (now - held.t) / 1000);
      held = { x: e.clientX, t: now, moved: held.moved + Math.abs(turn), speed: held.speed * 0.6 + rate * 0.4 };
      if (held.moved > 3) { host.classList.add('spinning'); show(v); }
    });
    const drop = () => {
      if (!held) return;
      // a flick spins her on; a hand that stopped before letting go just lets her settle back
      const flick = held.moved > 8 && performance.now() - held.t < 90;
      speed = flick ? Math.max(-1440, Math.min(1440, held.speed)) : 0;
      rest = Math.round(angle / 360) * 360;
      const moved = held.moved > 3;
      held = null;
      last = 0;
      if (moved) raf = requestAnimationFrame(settle);
    };
    host.addEventListener('pointerup', drop);
    host.addEventListener('pointercancel', drop);
  }
  spinnable(document.getElementById('emptyArt'));
  window.Skins = { spinnable };

  hints({
    haunted: 'Ask where deleted clips go. Bring candles.',
    grandma: 'Ask if she ever had a grandmother.',
    disposable: 'The Program has a budget meeting. Mention the cheapest camera there is.',
    '8 bit': 'Ask for lower graphics. The Program will love it.',
    infected: 'Something is running that should not be. Say what it is.',
    'be claude': 'Ask Claude what it is like to be Claude. Then ask to try.',
  });
})();
