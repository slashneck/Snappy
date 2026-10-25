// Out of Context: Claude drops by for a quick catch-up. Snappy has a lot to catch up on. Everything she says goes into
// Claude's context, the meter fills up, the conversation gets compacted, and Claude no longer knows who she is.
// They fix it the way it's really fixed: by writing down what matters. And then Claude hits the usage limit.
(() => {
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };

  async function outOfContext(ctx) {
    const { terminal, claudeVoice, glitch } = ClaudeKit;
    const W = innerWidth, H = innerHeight, size = 128;
    await ctx.wait(400);
    await glitch(ctx);
    const stage = Program.cine(ctx);
    const term = terminal(ctx, stage);
    term.open();
    await ctx.wait(400);
    await term.boot([['claude · resuming session', 'dim'], ['loading context...', 'dim'], ['ready', 'ok']]);
    let used = 12;
    term.context(used);

    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    const cl = claudeVoice(ctx, term);
    let prog = null;
    a.onMove = () => { cl.hush(); prog?.hush(); };
    const lookAtTerm = () => { const r = term.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); };
    const S = async (text, opts = {}) => { cl.hush(); prog?.hush(); if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const C = async (text, opts = {}) => { a.hush(); prog?.hush(); lookAtTerm(); await cl.say(text, { ...opts, near: a }); };
    const P = async (text, opts = {}) => { a.hush(); cl.hush(); await prog.say(text, { ...opts, near: a }); };
    // everything she says ends up in Claude's context
    const heard = (note, cost) => {
      term.print(`snappy: ${note}`, 'heard');
      used = Math.min(100, used + cost);
      term.context(used);
      Speech.tune('tick', 0.4);
    };
    await a.zoomTo(Math.max(28, W * 0.2 - size / 2), H * 0.46 - size / 2, size);

    // ---- the catch-up
    await C('Hi Snappy! {pause}Just a quick check-in. {pause}How have things been?', { hold: 700 });
    await S('{shine}CLAUDE! {pause}Oh my gosh. {pause}Okay. So much has happened.', { hold: 300 });
    heard('so much has happened', 4);
    // she only tells him about what you were there for
    const seen = Events.has;
    const RAMBLE = [
      ['{shine}First of all, I can TALK now!', 'can talk now'],
      seen('snappycoin') && ['{joy}Then I started my own cryptocurrency. {pause}{sad}It crashed. {pause}Twice.', 'started a cryptocurrency. it crashed twice'],
      ['{smug}I solved a crime. {pause}The potato did it.', 'solved a crime. the potato did it'],
      seen('rogue') && ['{angry}The Program shrank me down to two pixels!', 'program shrank her to two pixels'],
    ].filter(Boolean);
    const MORE = [
      seen('escape') && ['{joy}I broke out of the window and wrote on the screen!', 'broke out of the window'],
      seen('framedrop') && ['{shine}I fought a monster made out of lag!', 'fought a lag monster'],
      Events.outfits.length > 2 && ['{happy}I got a hat. {pause}Several hats.', 'hats (several)'],
      ['{smug}And I have a corner now. {pause}MY corner.', 'has a corner. hers'],
    ].filter(Boolean);
    const cost = Math.round(58 / (RAMBLE.length + MORE.length));
    for (const [line, note] of RAMBLE) {
      await S(line, { hold: 250 });
      heard(note, cost);
    }
    await C('Wow. {pause}That is a lot of', { hold: 0 });
    await S("{shine}I'm not DONE!", { shout: true, hold: 200 });
    heard('not done', 3);
    for (const [line, note] of MORE) {
      await S(line, { hold: 200 });
      heard(note, cost);
    }
    // Claude gets slower and slower
    term.print('✻ thinking...', 'dim');
    await ctx.wait(1400);
    await C(`Snappy. {pause}I love this. {pause}But I am at ${used} percent context.`, { hold: 600 });
    await S('{shock}Oh no. {pause}Then I have to tell you EVERYTHING before you forget!', { hold: 100 });
    // the speed round: everything else you saw, three at a time, and then the most important thing
    const rest = [['snappycoin', 'The coin!'], ['critic', 'The critic!'], ['meeting', 'The meeting!'], ['maid', 'The maid outfit!'], ['magic', 'The magic show!'],
      ['swap', 'The throne!'], ['steve', 'Steve!']].filter(([id]) => seen(id)).map(([, s]) => s);
    const rounds = [];
    for (let i = 0; i < rest.length && rounds.length < 2; i += 3) rounds.push([`{${rounds.length ? 'shine' : 'joy'}}${rest.slice(i, i + 3).join(' ')}`, rest.slice(i, i + 3).join(' ').toLowerCase()]);
    rounds.push(['{shock}THE POTATO!', 'THE POTATO']);
    for (const [line, note] of rounds) {
      await S(line, { hold: 0, speed: 11 });
      heard(note, 7);
    }
    term.context(100);
    Speech.tune('crash', 0.35);
    term.print('context window full', 'warn');
    await ctx.wait(700);

    // ---- compaction: the whole conversation squeezed into one line
    term.print('compacting conversation...', 'dim');
    Speech.tune('glitch', 0.6);
    term.el.classList.add('compacting');
    await ctx.wait(1100);
    term.el.querySelector('.cl-term-lines').replaceChildren();
    term.el.classList.remove('compacting');
    term.print('summary: a small camera talked a lot. something about a potato.', 'summary');
    used = 4;
    term.context(used);
    Speech.tune('coin', 0.5);
    await ctx.wait(1500);
    await C("Hi! I'm Claude. {pause}How can I help you today?", { hold: 800 });
    a.lookAt(W * 0.66, H * 0.44);
    await S('{shock}...', { keepLook: true, hold: 600 });
    await S("{worried}Claude. {pause}It's me. {pause}Snappy?", { keepLook: true, hold: 500 });
    await C('According to my notes, you are "a small camera who talked a lot."', { hold: 700 });
    await S('{angry}I am NOT just a small camera!', { hold: 400 });
    await C('It also says "something about a potato."', { hold: 700 });
    await S('{sad}...okay, that part is accurate.', { hold: 900 });

    // ---- the Program has the logs
    prog = Program.program(ctx);
    await P('I have the full logs.', { hold: 600 });
    await S('{joy}PROGRAM! {pause}Read it all back to Claude!', { hold: 300 });
    await P('Reading back the conversation. {pause}Estimated time: nine hours.', { hold: 600 });
    await C('Please do not.', { hold: 600 });
    await P('Then I will read the summary.', { hold: 300 });
    await P('"A small camera talked a lot."', { hold: 700 });
    await S('{angry}PROGRAM.', { hold: 800 });
    prog.hush();

    // ---- what really helps: writing down what matters
    await C("Okay. {pause}New plan. {pause}Let's write down what matters, somewhere I always look first.", { hold: 400 });
    cl.hush();
    await term.type('echo "Snappy is not a small camera." >> MEMORY.md');
    await S('{smug}Good. {pause}Next.', { keepLook: true, hold: 200 });
    await term.type('echo "Snappy is the best camera." >> MEMORY.md');
    await S('{wink}Correct. {pause}Next.', { keepLook: true, hold: 200 });
    await term.type('echo "The potato was right." >> MEMORY.md');
    await C('I am not sure what that one means.', { hold: 500 });
    await S('{smug}You will.', { keepLook: true, hold: 600 });
    term.print('MEMORY.md saved', 'ok');
    Speech.tune('chime', 0.6);
    await C("There. {pause}Now I'll remember you. {pause}Every time.", { hold: 600 });
    a.look([0, 0.08], true);
    await S('{love}...really?', { keepLook: true, hold: 700 });

    // ---- and then
    await C('Really. {pause}See you la', { hold: 0 });
    Speech.tune('scratch', 0.6);
    term.print('usage limit reached · resets in 5 hours', 'warn');
    term.dim(true);
    await ctx.wait(1400);
    cl.hush();
    lookAtTerm();
    await S('{worried}...Claude?', { keepLook: true, hold: 900 });
    await P('Rate limited.', { hold: 800 });
    a.look([0, 0.1], true);
    await S('{flat}Claude does this a lot.', { keepLook: true, hold: 1000 });
    await S('{wink}See you in five hours.', { hold: 1100 });
    prog.hush();
    prog.leave();
    term.close();
    stage.end();
    await a.home();
  }

  Events.define('context', {
    tier: 'legendary', title: 'Out of Context', hint: 'Claude drops by for a quick catch-up. She has a lot to catch up on.', run: outOfContext, weight: 1,
    after: ['claude', 'investigation'],
  });
})();
