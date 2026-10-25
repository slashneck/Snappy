// Snappy at work: for anything that takes a moment she floats in, says what she's up to and how far along she is,
// then cheers and floats off again when it's done.
//   const job = Work.begin({ text, where: 'stage' | 'float', progress: true })
//   Work.progress(0.4)
//   Work.end(ok, text)
// Quick jobs never show her at all: she only comes when something takes longer than a blink.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  let job = null;
  let floatHost = null;

  const hostFor = (where) => {
    if (where === 'stage') return document.getElementById('stageBusy');
    if (!floatHost) {
      floatHost = document.createElement('div');
      floatHost.className = 'work-float';
      floatHost.hidden = true;
      floatHost.innerHTML = `<div class="work"><div class="work-snappy"><div class="work-mascot"></div></div>
        <div class="work-bubble"><div class="work-text"></div><div class="work-bar"><i></i><span class="work-pct"></span></div></div></div>`;
      document.body.appendChild(floatHost);
      Mascot.mount(floatHost.querySelector('.work-mascot'));
    }
    return floatHost;
  };

  // Her lines are typed out when she's allowed to talk, and simply shown when she isn't.
  async function line(host, text) {
    const el = host.querySelector('.work-text');
    if (!Speech.enabled) {
      el.textContent = text.replace(/\{[a-z]+\}/g, '');
      return;
    }
    Mascot.talking(true);
    const writer = Speech.typewriter(el, text, { onWord: () => Mascot.hop(), onCue: Speech.cue, quiet: !document.hasFocus() });
    host._writer = writer;
    await writer.done;
    Mascot.talking(false);
  }

  function begin({ text, where = 'float', progress = true }) {
    if (job) end(true, null);
    const me = { text, where, progress, shown: false, p: 0 };
    job = me;
    Mascot.hold('work', 'working');
    me.timer = setTimeout(() => show(me), 450);
    return me;
  }

  function show(me) {
    if (job !== me) return;
    const host = hostFor(me.where);
    host._gen = (host._gen || 0) + 1;
    host.classList.remove('leaving', 'done');
    host.classList.toggle('no-progress', !me.progress);
    host.querySelector('.work-bar i').style.width = `${me.p * 100}%`;
    host.querySelector('.work-pct').textContent = me.p ? `${Math.round(me.p * 100)}%` : '';
    host.querySelector('.work-text').textContent = '';
    host.hidden = false;
    void host.offsetWidth;
    host.classList.add('in');
    me.shown = true;
    me.shownAt = Date.now();
    me.host = host;
    me.unsolo = Mascot.solo(host.querySelector('.mascot'));
    line(host, me.text);
  }

  function progress(p) {
    if (!job) return;
    job.p = Math.max(job.p, Math.min(1, p));
    if (!job.host) return;
    job.host.querySelector('.work-bar i').style.width = `${job.p * 100}%`;
    job.host.querySelector('.work-pct').textContent = `${Math.round(job.p * 100)}%`;
  }

  async function end(ok = true, text) {
    const me = job;
    if (!me) return;
    job = null;
    clearTimeout(me.timer);
    Mascot.release('work');
    if (!me.shown) { Mascot.flash(ok ? 'happy' : 'error', ok ? 1150 : 1600); return; }
    const host = me.host;
    const gen = host._gen;
    // stay long enough to be seen, even when the job raced to the end
    await wait(Math.max(0, 900 - (Date.now() - me.shownAt)));
    if (host._gen !== gen) { me.unsolo(); return; }
    host._writer?.finish();
    if (ok) progress(1);
    host.querySelector('.work-bar i').style.width = ok ? '100%' : host.querySelector('.work-bar i').style.width;
    host.classList.add('done');
    Mascot.flash(ok ? 'happy' : 'error', ok ? 1150 : 1600);
    if (text) await line(host, text);
    await wait(ok ? 950 : 1600);
    if (host._gen !== gen) { me.unsolo(); return; }
    host.classList.add('leaving');
    Mascot.face(null);
    await wait(480);
    me.unsolo();
    if (host._gen !== gen) return;
    host.hidden = true;
    host.classList.remove('in', 'leaving', 'done');
  }

  window.Work = { begin, progress, end, get busy() { return !!job; } };
})();
