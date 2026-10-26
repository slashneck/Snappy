// What Snappy says, and when. She's a small camera with a big heart: excitable, a little clumsy, and very proud
// of every clip she saves for you. Cues in braces change her face mid-sentence, see Speech.typewriter.
(() => {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const chance = (p) => Math.random() < p;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* she just might repeat herself */ } },
  };
  const once = (key) => { if (store.get(`snappy.said.${key}`)) return false; store.set(`snappy.said.${key}`, '1'); return true; };
  const hk = (key) => hotkeyLabel(state.settings?.[key]);
  // with the swap switch flipped, the Program is the camera: same moments, its own words
  const V = (hers, its) => (Events.skin === 'program' ? its : hers);
  const length = (s) => fmtSeconds(s).replace('min', 'minutes').replace(/^(\d+)s$/, '$1 seconds');

  // ----- what's new, the first time you open her after an update -----
  // (a version with patch notes has her read those instead, see notes.js)
  function whatsNew() {
    const last = store.get('snappy.version');
    store.set('snappy.version', state.version);
    if (!last || last === state.version || Notes.has(state.version)) return false;
    Speech.say(V(`{shine}I just got updated to ${state.version}! {happy}Fresh new me.`, `Updated to ${state.version}. Snappy is very excited. I am telling you on her behalf.`),
      { kind: 'news', key: 'whatsNew', action: { label: 'Show me', fn: () => openSettings('snappy') } });
    return true;
  }

  // ----- a little recap of last week, the first time you open her in a new week -----
  function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function recap() {
    const thisWeek = weekStart(new Date()).getTime();
    if (Number(store.get('snappy.recap') || 0) >= thisWeek) return false;
    store.set('snappy.recap', String(thisWeek));
    const lastWeek = thisWeek - 7 * 864e5;
    const clips = (state.library?.clips || []).filter((c) => c.date.getTime() >= lastWeek && c.date.getTime() < thisWeek);
    if (clips.length < 3) return false;
    const byGame = {};
    for (const c of clips) byGame[c.folder || 'Unsorted'] = (byGame[c.folder || 'Unsorted'] || 0) + 1;
    const [top, topCount] = Object.entries(byGame).sort((a, b) => b[1] - a[1])[0];
    const byDay = {};
    for (const c of clips) { const day = c.date.toLocaleDateString(undefined, { weekday: 'long' }); byDay[day] = (byDay[day] || 0) + 1; }
    const [busiest] = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    Speech.say(V([
      `{shine}Weekly recap! {open}Last week you saved ${clips.length} clips.`,
      topCount > 1 && top !== 'Unsorted' ? `{happy}Most of them in ${top}. {open}Your busiest day was ${busiest}. {wink}Busy busy!` : `{open}Your busiest day was ${busiest}. {wink}Busy busy!`,
    ], [
      `Weekly report: ${clips.length} clips saved last week.`,
      topCount > 1 && top !== 'Unsorted' ? `Most of them in ${top}. Busiest day: ${busiest}. Efficient.` : `Busiest day: ${busiest}. Efficient.`,
    ]), { kind: 'news', key: 'recap' });
    return true;
  }

  // ----- the clip drive running out of room -----
  function driveCheck() {
    const free = state.library?.rootFree;
    if (!free || free > 5 * 1073741824) return false;
    if (Date.now() - Number(store.get('snappy.driveFull') || 0) < 3 * 864e5) return false;
    store.set('snappy.driveFull', String(Date.now()));
    Speech.say(V([`{worried}Psst... the drive with your clips only has ${fmtSize(free)} left.`, '{open}Want to see where you can make some room?'],
      [`The drive with your clips has ${fmtSize(free)} left.`, 'I recommend making room. I can show you where.']),
      { kind: 'news', key: 'drive', action: { label: 'Show me', fn: () => openSettings('clips') } });
    return true;
  }

  // ----- hello, every time you open her window -----
  function greet() {
    if (!state.settings) return;
    if (!store.get('snappy.version') && store.get('snappy.said.welcome')) store.set('snappy.version', state.version);
    if (once('welcome')) {
      store.set('snappy.version', state.version);
      Speech.say([
        `{shine}Oh! {pause}{happy}Hi! I'm Snappy, your little camera!`,
        `{shine}I always keep the last ${length(state.settings.bufferSeconds)} of your screen. Press ${hk('saveClipHotkey')} and {wink}I'll save the moment!`,
      ], { kind: 'news', key: 'welcome', action: { label: 'Show me around', fn: () => openSettings() } });
      store.set('snappy.greeted', String(Date.now()));
      return;
    }
    if (whatsNew() || driveCheck() || recap()) { store.set('snappy.greeted', String(Date.now())); return; }
    // reopening the window right away doesn't need another hello
    const last = Number(store.get('snappy.greeted') || 0);
    if (Date.now() - last < 90e3) return;
    store.set('snappy.greeted', String(Date.now()));
    const h = new Date().getHours();
    // the middle of the night gets a talking-to, once a night
    const night = new Date().toDateString();
    if (h >= 2 && h < 5 && store.get('snappy.lateNight') !== night) {
      store.set('snappy.lateNight', night);
      setTimeout(() => Speech.say(V([`{worried}It's ${h} AM! {pause}Go to sleep!`, '{open}... {pause}{wink}okay, one more game.'], [`It is ${h} AM. Go to sleep.`, 'That was not a suggestion.']), { kind: 'news', key: 'greet' }), 700);
      Life.found('night');
      return;
    }
    const smooth = state.status?.state === 'recording' && !state.status?.warnings?.length;
    const any = ['{happy}Welcome back!', "{shine}Oh, you're back! {happy}Hi hi!", "{wink}There you are! {happy}I kept an eye on things.", '{happy}Hey! {shine}Missed me?'];
    const time = h >= 5 && h < 11 ? ['{happy}Good morning! {open}I\'m awake. {pause}{wink}Mostly.', "{shine}Morning! Did you sleep? {open}I don't. {pause}{wink}Unless you pause me."]
      : h >= 11 && h < 17 ? ["{happy}Welcome back! {open}I've been watching your screen. {pause}{worried}For clips! {happy}Only for clips.",
        smooth ? "{happy}Hi again! {shine}Everything's running smooth on my end." : '{happy}Hi again!']
      : h >= 17 && h < 23 ? ['{shine}Evening! Gaming time? {wink}I was born ready.', "{happy}Good evening! {shine}Let's catch something cool tonight."]
      : ["{worried}It's really late... {open}I'll keep watching, {happy}you get some sleep soon, okay?", "{wink}Night owl? Me too. {open}Well, I'm a camera. {happy}I'm always up."];
    const itsAny = ['Welcome back. I have been here the whole time.', 'Hello. Snappy is resting. I am the camera today.', 'You have returned. Recording continued in your absence.',
      'Greetings. I have practiced being cheerful. This is it.', 'Hello. Please do not poke the camera. Snappy says you will anyway.'];
    const itsTime = h >= 5 && h < 11 ? ['Good morning. I do not sleep. Neither does the recorder.', 'Morning. Snappy usually says something cute here. I will not.']
      : h >= 11 && h < 17 ? ['Good afternoon. Your screen has been observed. For clips. Only for clips.', smooth ? 'Good afternoon. All systems nominal.' : 'Hello again.']
      : h >= 17 && h < 23 ? ['Good evening. Statistically, this is when the good clips happen.', 'Evening. I am ready. I am always ready.']
      : ['It is late. Sleep is recommended. I will keep recording.', 'You are awake at an unusual hour. So am I. I am always awake.'];
    setTimeout(() => Speech.say(pick(V(chance(0.5) ? any : time, chance(0.5) ? itsAny : itsTime)), { kind: 'news', key: 'greet', hold: 5500 }), 700);
  }

  // ----- clips -----
  const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
  let recentClips = [];
  function clipSaved(r) {
    const count = state.library?.clips?.length || 0;
    recentClips = recentClips.filter((t) => Date.now() - t < 60000);
    recentClips.push(Date.now());
    if (recentClips.length === 3) {
      Speech.say(V("{worried}Whoa, whoa, slow down! {pause}{wink}I'm only one camera!", 'Three clips in one minute. I am handling it. Calmly.'), { kind: 'news', key: 'rapid' });
      Life.found('rapid');
      return;
    }
    const clip = r?.id && byId(r.id);
    const sameFolder = clip?.folder ? state.library.clips.filter((c) => c.folder === clip.folder).length : 0;
    if (sameFolder === 1 && count > 1) {
      Speech.say(V(`{shine}Ooh, a new one! {happy}I made a folder for ${clip.folder}.`, `New game detected. Folder created: ${clip.folder}.`), { kind: 'news', key: 'newGame' });
      return;
    }
    if (count === 1 && once('firstClip')) {
      Speech.say(['{joy}Your very first clip! {happy}I could cry.', "{open}Cameras can't cry. {pause}{happy}But still!"], { kind: 'news' });
      Life.found('firstClip');
      return;
    }
    const milestone = MILESTONES.find((m) => count >= m && !store.get(`snappy.said.clips${m}`));
    if (milestone && count < milestone * 1.2) {
      once(`clips${milestone}`);
      if (milestone === 100) Life.found('party');
      Speech.say(V(milestone === 100 ? ['{shine}A hundred clips!! {hop}', "{wink}Should we throw a party? {happy}I'll bring the flash."]
        : `{shine}That's ${milestone} clips! {joy}We make a pretty good team, huh?`,
      milestone === 100 ? ['One hundred clips.', 'Snappy would throw a party. I have put one in my calendar. It is just me.'] : `${milestone} clips. A respectable number.`), { kind: 'news' });
      return;
    }
    if (chance(0.3)) {
      Speech.say(pick(V(["{happy}Got it! {wink}That one's a keeper.", '{shine}Click! {happy}Saved and safe.', '{shine}Ooh, nice one!',
        '{happy}Saved! {open}I almost blinked. {pause}{wink}Almost.', '{happy}Into the collection it goes!',
        '{shine}Was that... {pause}legendary? {happy}I think that was legendary.'],
      ['Saved.', 'Clip saved. Quality: acceptable.', 'Captured. Filed. Done.', 'That was a good one. I am allowed to say that.',
        'Saved. I did not blink. I have an eyelid now, so that was a choice.', 'Stored safely. As always.'])));
    }
  }

  // ----- recording on and off -----
  let lastState = null;
  function statusChanged(st) {
    const before = lastState;
    lastState = st.state;
    if (before === 'recording' && st.state === 'paused') Speech.say(pick(V(['Okay... eyes closed. Wake me when you need me.', 'Nap time? {pause}Nap time.'], ['Recording paused. I will wait here.', 'Paused. I am not napping. Cameras do not nap.'])));
    if (before === 'paused' && st.state === 'recording') Speech.say(pick(V(["{shine}I'm up! I'm up! {happy}Recording again.", "{shine}I'm awake! {worried}Did I miss anything?"], ['Recording resumed.', 'Back on duty.'])));
    gpuCheck(st);
    problemCheck(st);
  }

  // The graphics card encoder doesn't work: tell them once per start, with a way to fix it.
  let gpuTold = false;
  function gpuCheck(st) {
    const g = st.gpu;
    if (!g || gpuTold) return;
    gpuTold = true;
    const nvidia = g.vendor === 'nvidia';
    const brand = nvidia ? 'NVIDIA' : 'AMD';
    Speech.say(V(g.driverTooOld ? [
      `{worried}Um... {pause}small problem. Your ${brand} driver is too old, so I can't use the graphics card.`,
      "{worried}I'm recording with the processor for now, and clips might stutter. {shine}Update the driver and I'll switch back all by myself!",
    ] : [
      `{worried}Um... {pause}the ${brand} encoder on your graphics card won't start for me.`,
      "{worried}I'm using the processor meanwhile, so clips might stutter. {shine}A driver update usually fixes it!",
    ], g.driverTooOld ? [
      `Your ${brand} driver is out of date. I cannot use the graphics card.`,
      'Recording with the processor for now. Clips may stutter. Update the driver and I will switch back on my own.',
    ] : [
      `The ${brand} encoder on your graphics card did not start.`,
      'Using the processor meanwhile. Clips may stutter. A driver update usually resolves this.',
    ]), {
      kind: 'news', key: 'gpu',
      action: { label: 'Get the driver', fn: () => snappy.call('app.openLink', { url: nvidia ? 'https://www.nvidia.com/en-us/drivers/' : 'https://www.amd.com/en/support/download/drivers.html' }) },
    });
  }

  let problemSince = 0, problemTold = 0;
  function problemCheck(st) {
    if (st.state !== 'problem') { problemSince = 0; return; }
    problemSince ||= Date.now();
    if (Date.now() - problemSince > 12000 && Date.now() - problemTold > 10 * 60e3) {
      problemTold = Date.now();
      Speech.say(V(["{worried}Hmm, I can't see your screen right now...", "{shine}I'm trying again, {worried}hang on!"], ['I cannot see your screen right now.', 'Retrying. Please stand by.']), { kind: 'news', key: 'problem' });
    }
  }

  // ----- a new version of her -----
  function updateChanged(u) {
    if (!u?.available || (u.state !== 'ready' && u.state !== 'available')) return;
    if (store.get('snappy.said.update') === u.available) return;
    store.set('snappy.said.update', u.available);
    Speech.say(V([
      '{shine}Psst! {pause}A new version of me just arrived!',
      u.state === 'ready' ? "{wink}Want to see? {happy}I'll only be gone for a second." : "{wink}It's waiting for you on GitHub.",
    ], ['A new version is available.', u.state === 'ready' ? 'Restarting takes a second. I will hold on to the clips.' : 'It is waiting on GitHub.']), { kind: 'news', key: 'update', action: { label: 'Show me', fn: () => openSettings('about') } });
  }

  // ----- poke her in a clip or in Settings, and she offers to show you around again -----
  let offeredAt = 0;
  function offerTour(what) {
    const tour = state.view === 'player' ? 'clip' : state.view === 'settings' ? 'settings' : null;
    if (what !== 'pet' || !tour || Tour.active || Date.now() - offeredAt < 20000) return false;
    offeredAt = Date.now();
    if (Events.skin === 'program') {
      // the Program doesn't do tours. It knows someone who does.
      Speech.say(tour === 'clip' ? 'Should Snappy show you what a clip can do again?' : 'Should Snappy show you around again?', {
        kind: 'news', key: 'offer', interrupt: true,
        actions: [
          { label: 'Yes, get Snappy', fn: () => { Events.unswap(); setTimeout(() => Speech.say("{joy}I'M BACK! {pause}{shine}Okay, follow me!", { kind: 'news', interrupt: true }), 700); setTimeout(() => Tour.start(tour), 3200); } },
          { label: 'No', fn: () => Speech.say('Understood. I will remain the camera.', { kind: 'news', interrupt: true }) },
        ],
      });
      return true;
    }
    Speech.say(tour === 'clip' ? '{shine}Want me to show you what you can do with a clip again?' : '{shine}Want me to show you around the settings again?', {
      kind: 'news', key: 'offer', interrupt: true,
      actions: [
        { label: 'Yes, please!', fn: () => Tour.start(tour) },
        { label: "Nah, I'm good", fn: () => Speech.say("{wink}Okay! {happy}Poke me if you change your mind.", { kind: 'news', interrupt: true }) },
      ],
    });
    return true;
  }

  // ----- being fussed over -----
  Mascot.on((what, el) => {
    if (el.id !== 'mascot') return; // the one in the sidebar, not her stand-in during the tour
    if (offerTour(what)) return;
    if (what === 'love' && chance(0.45)) Speech.say(pick(V(['{love}Hehe, that tickles!', '{love}Aww, you!', '{joy}Again! Again!'], ['Please stop.', '...That is acceptable.', 'I am logging this as affection.'])));
    if (what === 'dizzy' && chance(0.7)) Speech.say(pick(V(['Whoa... {pause}the room is spinning...', 'Okay, okay! {pause}I see stars!'], ['My gyroscope is not rated for this.', 'The room is rotating. That is not in my specifications.'])));
    if (what === 'rub' && chance(0.3)) Speech.say(pick(V(["{happy}Mmmh, that's nice...", '{happy}A little to the left... {pause}{wink}perfect.'], ['Unnecessary.', '...Continue.'])));
  });

  // ----- while she works on something for you -----
  const WORK = {
    trim: [['{shine}Snip snip! {open}Cutting your clip...', '{happy}On it! {open}Trimming off the boring bits...', '{wink}Hold still... {open}trimming!'],
      ['{happy}Done!', '{hop}{happy}Ta-da!', '{happy}Snip! {wink}All done.']],
    edit: [['{shine}Ooh, fancy edits! {open}Putting it all together...', '{open}Mixing, cropping, polishing... {happy}hold tight!'],
      ['{happy}All done! {wink}Looks great.', '{hop}{joy}Ta-da! Fresh out of the oven.']],
    replace: [['{open}Swapping in your new version... {wink}the old one waits in the Recycle Bin, just in case.'],
      ['{happy}Replaced! {open}Same spot, same date.']],
    shrink: [['{shine}Squeezing it down... {open}Discord, here we come!', '{open}Making it tiny... {pause}{wink}but still pretty.'],
      ['{happy}Copied! {shine}Just paste it into Discord.', "{hop}{happy}Tiny and ready! {open}It's on your clipboard."]],
    montage: [['{shine}A montage? {joy}Ooh, I love these! {open}Stitching your clips together...'],
      ['{joy}Ta-da! Your montage is ready!']],
    move: [["{open}Carrying your clips over... {worried}they're heavier than they look!"], ['{happy}Moved! {open}Safe and sound.']],
    moveAll: [["{open}Moving everything over, one by one... {happy}I'll be careful!"], ['{joy}Everything arrived safely!']],
  };
  const FAILED = ["{worried}Oops... {pause}that didn't work.", '{worried}Uh oh... {pause}something went wrong.'];
  const ITS_WORK = {
    trim: [['Trimming.', 'Removing the unnecessary parts.'], ['Complete.', 'Trimmed.']],
    edit: [['Applying your edits. Please wait.'], ['Done. It is acceptable.', 'Complete. I made no creative choices.']],
    replace: [['Replacing. The original goes to the Recycle Bin, as a precaution.'], ['Replaced. Same place, same date.']],
    shrink: [['Compressing for Discord.'], ['Copied to your clipboard. Paste it anywhere.']],
    montage: [['Assembling a montage. I have opinions about the order.'], ['Montage complete.']],
    move: [['Moving clips.'], ['Moved.']],
    moveAll: [['Moving everything. Carefully.'], ['All clips arrived.']],
  };
  const ITS_FAILED = ['That did not work.', 'An error occurred. It was not me.'];
  const workLine = (kind) => pick(V(WORK, ITS_WORK)[kind][0]);
  const doneLine = (kind, ok = true) => (ok ? pick(V(WORK, ITS_WORK)[kind][1]) : pick(V(FAILED, ITS_FAILED)));

  // ----- the settings tour -----
  Tour.define('settings', {
    scroller: 'settingsScroller',
    steps() {
      const s = state.settings;
      const g = state.status?.gpu;
      return [
        { pages: [
          "{worried}Whoa, sorry, the floor's slippery in here. {pause}{happy}Hi! I'm Snappy!",
          "{shine}First time in the settings? Let me show you the good stuff. {wink}It's quick, I promise!",
        ] },
        { targets: ['[data-duration-select="bufferSeconds"]'],
          tryIt: "{shine}Want me to remember more, or less? {happy}Pick a length, I'll wait!",
          liked: ['{happy}Got it! {love}My memory is all yours.', "{shine}Ooh, noted! {open}I won't forget. {pause}{wink}Literally, that's my job."], pages: [
          `{shine}This is my memory! {open}I keep the last ${length(s.bufferSeconds)} of your screen in RAM, all the time.`,
          "{happy}Nothing touches your disk until you save. {worried}Longer means more RAM though, {wink}so don't go wild!",
        ] },
        { targets: ['[data-duration-select="shortClipSeconds"]'],
          tryIt: '{shine}Go on, pick how long your quick clips are!',
          liked: ['{happy}Perfect, quick and snappy. {wink}Like me!', '{shine}Nice pick!'], pages: [
          '{wink}Secret technique: {shine}there are two kinds of clips! {open}The whole replay...',
          `{open}...or a quick clip of just the last ${length(s.shortClipSeconds)}. {happy}This one sets how long the quick clip is.`,
        ] },
        { targets: ['[data-hotkey="saveClipHotkey"]', '[data-hotkey="saveShortClipHotkey"]'],
          tryIt: "{shine}Want your own keys? Click one and press your combo. {wink}Or keep mine, they're pretty good.",
          liked: ['{shine}Ooh, good keys! {happy}My ears are ready.', "{happy}Got it! {wink}Press that and I'll be there."], pages: [
          `{shine}And these are your magic buttons! {open}${hk('saveClipHotkey')} saves the whole replay, ${hk('saveShortClipHotkey')} a quick clip.`,
          '{happy}Click one and press whatever keys you like. {shine}I hear them even in the middle of a game!',
          "{open}Just pick something you won't hit by accident... {pause}{worried}I once saved forty clips of a loading screen. {pause}Don't ask.",
        ] },
        { targets: ['[data-setting="micDevice"]'],
          tryIt: '{shine}Pick your mic, then say something nice. {happy}Watch the bar!',
          liked: ['{shine}I can hear you! {happy}Hi! Hello!', '{happy}Got it, that one. {wink}Testing, testing!'], pages: [
          '{shine}Talking to your friends? {open}Pick your real microphone here.',
          "{happy}When you speak, the little bar wiggles. That's me listening! {pause}{worried}Not in a creepy way.",
        ] },
        { targets: ['[data-setting="separateAudioTracks"]'],
          tryIt: '{shine}Want them? Flip the switch!',
          liked: ['{joy}Yay! {happy}Now everything gets its own track.', "{open}Okay! Changed your mind? {wink}That's fine, I don't judge."], pages: [
          '{joy}Ooh, my favorite! {shine}Turn this on and your voice and the game get their own tracks.',
          "{happy}Then you can turn yourself down later. {open}Or cut that one embarrassing scream. {pause}{wink}I won't tell.",
        ] },
        { targets: ['[data-setting="encoder"]'], pages: g ? [
          "{open}This one decides who does the heavy lifting. {worried}Right now your graphics card won't help me...",
          `{worried}...because the ${g.vendor === 'nvidia' ? 'NVIDIA' : 'AMD'} driver needs an update. {shine}Do that and I'll switch over by myself!`,
        ] : [
          '{open}This one decides who does the heavy lifting. {shine}Automatic lets your graphics card do it, so your games keep their FPS.',
          "{happy}Just leave it on Automatic. {open}It's smart. {pause}{wink}Like me!",
        ] },
        { pages: [
          "{shine}And that's everything! {hop}{happy}You're officially a pro.",
          "{open}Forgot something? {wink}Just poke me up in the corner and I'll show you again.",
        ] },
      ];
    },
  });

  // ----- when you change something about her -----
  function settingChanged(key, value) {
    const say = (text, extra = {}) => Speech.say(text, { kind: 'news', interrupt: true, key: `setting-${key}`, ...extra });
    if (Events.skin === 'program' && key !== 'mascotOutfit') {
      const its = {
        mascotSounds: value ? 'Audio restored.' : 'Muted. Finally, silence.',
        mascotTalks: value ? 'Speech enabled.' : 'Understood. I will be quiet. I was already quiet.',
        mascotAftermath: value ? 'Kept. Permanently.' : 'Only on the day. Noted.',
        mascotEvents: value ? 'Events enabled. Snappy will be thrilled.' : 'Events disabled. Snappy will be devastated. I will tell her gently.',
        mascotAnimations: value ? 'Animations on.' : 'Animations off. I prefer stillness anyway.',
        soundVolumePercent: value === 0 ? '...' : value >= 100 ? 'MAXIMUM VOLUME. I do not approve.' : value <= 20 ? 'Quieter. Good.' : null,
        showNotificationOnSave: value ? 'Pop-ups enabled.' : 'Pop-ups disabled. I will save quietly.',
        playSoundOnSave: value ? null : 'Silent saving. Efficient.',
      }[key];
      if (its) say(its, key === 'mascotTalks' && !value ? { force: true } : {});
      return;
    }
    switch (key) {
      case 'mascotSounds':
        say(value ? "{shine}La la la! {happy}My voice is back!" : "{open}Huh? {pause}{worried}Hello? {pause}Where did my voice go?");
        break;
      case 'mascotTalks':
        if (value) say("{shine}Yay! {happy}I can talk again! {wink}I had so much to tell you.");
        else say("{worried}Oh... {pause}okay. {open}I'll just be over here. {pause}Quietly.", { force: true });
        break;
      case 'mascotOutfit':
        say(value ? pick(['{shine}Ooh! {pause}{happy}How do I look?', "{wink}Fancy. {pause}{happy}I'm keeping it on.", '{joy}I feel like a whole new camera!'])
          : "{open}Back to basics. {pause}{wink}Still cute.");
        break;
      case 'mascotAftermath':
        say(value ? pick(["{shine}Keeping it! {pause}{wink}Some things should stay.", '{happy}Good choice. {pause}{smug}I was hoping you would.'])
          : "{open}Only on the day, then. {pause}{happy}That makes them special.");
        break;
      case 'mascotEvents':
        say(value ? "{shine}Ooh, surprises are back on! {pause}{wink}I've been rehearsing." : "{open}No more surprises? {pause}{worried}Okay... {pause}{wink}I'll save them for later.");
        break;
      case 'mascotAnimations':
        say(value ? "{shine}Freedom! {hop}{happy}I can move again!" : "{open}Okay, I'll hold very still. {pause}Like a statue. {pause}{worried}My nose itches.");
        break;
      case 'soundVolumePercent':
        if (value === 0) say('{worried}... {pause}...hello? {pause}Can anyone hear me?');
        else if (value >= 100) say('{shine}LOUD AND PROUD!');
        else if (value <= 20) say('{open}psst... {pause}{wink}is this better?');
        break;
      case 'showNotificationOnSave':
        say(value ? "{shine}Yay, I'll pop up when you clip again!" : "{open}Fine, I'll stay in here then. {pause}{wink}I'll still save everything!");
        break;
      case 'playSoundOnSave':
        if (!value) say('{open}No more click? {pause}{wink}Sneaky mode it is.');
        break;
    }
  }

  // ----- the clip tour -----
  const tab = (name) => () => document.querySelector(`#editTabs [data-tab="${name}"]`)?.click();
  const isTab = (name) => !!document.querySelector(`#editTabs [data-tab="${name}"].active`);
  Tour.define('clip', {
    onStart() { document.getElementById('video')?.pause(); },
    onEnd() { tab('trim')(); },
    steps() {
      return [
        { before: tab('trim'), pages: [
          '{shine}Ooh, your clip! {happy}Want to see what we can do with it? {wink}Quick tour!',
        ] },
        { before: tab('trim'), targets: ['#timeline'],
          tryIt: "{shine}Go on, drag one of the handles! {happy}I'll wait.",
          liked: ['{happy}Snip! {wink}Look at you, a natural.', '{shine}Nice cut!'], pages: [
          '{open}This is the timeline. {shine}See the little handles at both ends?',
          '{happy}Drag them in to cut off the boring parts. {wink}Nobody needs the loading screen.',
        ] },
        { targets: ['#saveTrimBtn', '#replaceTrimBtn'], pages: [
          "{happy}Happy with your cut? {open}'Save as new clip' makes a copy and keeps the original safe.",
          "{worried}'Replace' swaps the original out... {pause}{wink}but it waits in the Recycle Bin, just in case.",
        ] },
        { before: tab('trim'), targets: ['#editTabs'], pages: [
          '{shine}And up here are my favorite tools! {open}Trim, Audio and Crop.',
        ] },
        { before: tab('trim'), targets: ['#editTabs [data-tab="audio"]'], done: () => isTab('audio'),
          tryIt: "{shine}Click Audio! {happy}I'll follow you.", pages: [
          "{happy}Let's start with Audio.",
        ] },
        { before: tab('audio'), targets: ['#editLanes .lane'],
          tryIt: '{shine}Try it! Drag across a lane to mute a bit.',
          liked: ['{happy}Shhh! {wink}That part is muted now.', "{shine}Muted! {open}Click the dark bit and press Delete to bring it back."], pages: [
          '{shine}This is Audio! {open}Every sound gets its own lane here: the game, your mic, your music.',
          '{happy}Drag across a lane to mute just that part. {wink}Bye-bye, embarrassing scream.',
        ] },
        { before: tab('audio'), targets: ['#editLanes .lane-mute'], pages: [
          '{open}This little button on a lane mutes the whole track at once. {wink}Your mic, for example.',
        ] },
        { before: tab('audio'), targets: ['#audioPane'],
          tryIt: '{shine}Slide one and listen!',
          liked: ["{happy}There you go! {open}Every track at just the right volume."], pages: [
          '{shine}And down here you turn each track up or down. {happy}Make the game louder, or yourself a bit quieter.',
        ] },
        { before: tab('audio'), targets: ['#editTabs [data-tab="crop"]'], done: () => isTab('crop'),
          tryIt: '{shine}Now click Crop!', pages: [
          '{happy}Next up: Crop.',
        ] },
        { before: tab('crop'), targets: ['#cropLayer'],
          tryIt: '{shine}Give the box a drag!',
          liked: ['{happy}Ooh, nice framing!', "{shine}Like a real camera operator! {wink}That's my job, but okay."], pages: [
          '{shine}This is Crop! {open}Drag the box, or its corners, to keep just the part you want.',
        ] },
        { before: tab('crop'), targets: ['#aspectPicker'],
          tryIt: '{shine}Pick one!',
          liked: ['{happy}Perfect shape!'], pages: [
          '{happy}These pick a shape for you. {wink}9:16 is perfect for your phone!',
          "{open}When it looks good, hit Apply crop. {happy}Nothing changes until you save, so play around!",
        ] },
        { before: tab('trim'), targets: ['#shrinkBtn', '#copyBtn'], pages: [
          '{shine}Sharing time! {open}This one makes a small copy that fits on Discord...',
          '{happy}...and this one copies the clip, so you can paste it straight into any chat.',
        ] },
        { pages: [
          "{happy}That's all! {open}Anything you tried is still there, {wink}there's a reset for everything.",
          '{shine}Now go make something awesome. {hop}',
          "{open}And if you ever have a question, {wink}just poke me up in the corner!",
        ] },
      ];
    },
  });

  // ----- things she notices -----
  function clipOpened(clip) {
    if (clip.size > 400 * 1048576 && Tour.seen('clip') && once('bigClip')) {
      setTimeout(() => Speech.say(V(["{shine}Whoa, that's a big one!", '{open}If you want to share it, the shrink button up top makes a Discord-sized copy.'], ['That clip is large.', 'The shrink button up top makes a Discord-sized copy.']),
        { kind: 'news', key: 'bigClip' }), 2500);
    }
  }

  // development builds: replay the once-only notices
  function debug(what) {
    if (what === 'recap') { store.set('snappy.recap', '0'); if (!recap()) Speech.say('{open}Not enough clips last week for a recap. {wink}Go clip some!', { kind: 'news' }); }
    if (what === 'news') { store.set('snappy.version', '0.0.1'); whatsNew(); }
  }

  window.Talk = { greet, clipSaved, clipOpened, statusChanged, updateChanged, workLine, doneLine, settingChanged, debug };
})();
