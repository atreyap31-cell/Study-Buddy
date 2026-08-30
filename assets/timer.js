/* ===== Focus timer: 20 min work / 5 min colorful brain break ===== */
(function () {
  'use strict';
  const { $, $$, me, save, dayKey, toast, beep } = SB;
  const S = () => SB.data.settings;
  const RUN_KEY = 'studyBuddy.timerRun';
  const RING = 2 * Math.PI * 106;

  const BREAK_IDEAS = [
    'Stand up and stretch like a starfish 🌟',
    'Drink a big glass of water 💧',
    'Do 10 jumping jacks 🤸',
    'Look out a window at something far away 👀',
    'Dance to one song 🎵',
    'Pet an animal or hug someone 🤗',
    'Draw a silly doodle ✏️',
    'Balance on one foot for 20 seconds 🦩',
    'Take 5 slow deep breaths 🌬️',
    'Tidy one small thing on your desk 🧽',
    'Say three things you did well today 🌈',
    'Walk to another room and back 🚶',
    'Do your best animal impression 🦁',
    'Roll your shoulders and shake out your hands 👐'
  ];

  /* ---- running state (survives a page reload) ---- */
  let run = loadRun();
  function loadRun() {
    try {
      const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
      if (r && r.mode) return r;
    } catch (err) { /* ignore */ }
    return { mode: 'focus', running: false, endAt: 0, left: S().focusMin * 60000, round: 0, task: '' };
  }
  const saveRun = () => localStorage.setItem(RUN_KEY, JSON.stringify(run));
  const fullMs = mode => (mode === 'focus' ? S().focusMin : mode === 'long' ? S().longBreakMin : S().breakMin) * 60000;
  const msLeft = () => run.running ? Math.max(0, run.endAt - Date.now()) : Math.max(0, run.left);
  const fmt = ms => {
    const t = Math.ceil(ms / 1000);
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };

  /* ---- painting ---- */
  const MODES = {
    focus: { label: 'Focus time', color: 'var(--brand)', sub: "You've got this!" },
    short: { label: 'Brain break', color: 'var(--green)', sub: 'Rest those brain muscles' },
    long: { label: 'Long break', color: 'var(--purple)', sub: 'You earned a big one!' }
  };

  function paint() {
    const left = msLeft();
    const total = fullMs(run.mode) || 1;
    const m = MODES[run.mode] || MODES.focus;
    $('#clock').textContent = fmt(left);
    $('#modeLabel').textContent = m.label;
    $('#subLabel').textContent = run.running ? (run.task || m.sub) : (left === total ? 'Tap start when you\'re ready' : 'Paused');
    const ring = $('#progRing');
    ring.style.stroke = m.color;
    ring.setAttribute('stroke-dasharray', RING);
    ring.setAttribute('stroke-dashoffset', RING * (1 - left / total));
    $('#startBtn').innerHTML = run.running ? '⏸️ Pause' : (left < total ? '▶️ Resume' : '▶️ Start');
    $('#startBtn').className = run.running ? 'big amber' : 'big green';
    document.body.classList.toggle('running', run.running);
    document.title = (run.running ? fmt(left) + ' · ' : '') + (run.mode === 'focus' ? 'Focus' : 'Break') + ' — Study Buddy';

    const rounds = S().roundsBeforeLongBreak;
    const filled = run.mode === 'long' ? rounds : run.round % rounds;
    $('#dots').innerHTML = Array.from({ length: rounds },
      (_, i) => '<span class="dot' + (i < filled ? ' on' : '') + '"></span>').join('');

    if (run.mode !== 'focus') showOverlay(left); else hideOverlay();
    const bp = $('#breakPlayBtn');
    bp.innerHTML = run.running ? '⏸️ Pause' : '▶️ Start break';
    bp.className = run.running ? 'amber' : 'green';
    paintStats();
  }

  function paintStats() {
    const f = me().focus;
    $('#statToday').textContent = f.todayKey === dayKey() ? f.todaySessions : 0;
    $('#statTotal').textContent = f.totalSessions;
    $('#statStreak').textContent = f.streakDays;
  }

  /* ---- controls ---- */
  function start() {
    if (run.running) return;
    run.endAt = Date.now() + Math.max(1000, run.left || fullMs(run.mode));
    run.running = true;
    run.task = $('#taskInput').value.trim();
    beep([880]);
    saveRun(); paint();
  }
  function pause() {
    if (!run.running) return;
    run.left = msLeft();
    run.running = false;
    saveRun(); paint();
  }
  function toggle() { run.running ? pause() : start(); }
  function reset() {
    run.running = false;
    run.left = fullMs(run.mode);
    saveRun(); hideOverlay(); paint();
  }
  function goTo(mode, autoStart) {
    run.mode = mode;
    run.left = fullMs(mode);
    run.running = false;
    saveRun();
    if (autoStart) start(); else paint();
  }

  function finishSession() {
    const wasFocus = run.mode === 'focus';
    run.running = false;
    beep(wasFocus ? [660, 880, 1180] : [1180, 880, 660]);
    notify(wasFocus ? '🎉 Focus session done!' : '📚 Break over — back to work!',
           wasFocus ? 'Time for a brain break.' : 'You can do another session.');

    if (wasFocus) {
      const p = me(), today = dayKey();
      p.focus.totalSessions++;
      p.focus.todaySessions = p.focus.todayKey === today ? p.focus.todaySessions + 1 : 1;
      p.focus.todayKey = today;
      if (p.focus.lastDay !== today) {
        const yest = dayKey(Date.now() - 864e5);
        p.focus.streakDays = p.focus.lastDay === yest ? (p.focus.streakDays || 0) + 1 : 1;
        p.focus.lastDay = today;
      }
      run.round++;
      const credits = S().creditsPerSession;
      if (credits > 0) SB.addCredits(credits, 'Focus session' + (run.task ? ': ' + run.task : ''));
      save();
      toast('🎉 Session done!' + (credits > 0 ? ' +' + credits + ' credits' : ''));
      const isLong = run.round % S().roundsBeforeLongBreak === 0;
      goTo(isLong ? 'long' : 'short', S().autoStartBreak);
    } else {
      hideOverlay();
      goTo('focus', S().autoStartFocus);
      toast('📚 Break finished — ready for round ' + (run.round + 1) + '?');
    }
    saveRun();
  }

  /* ---- break overlay ---- */
  const overlay = $('#breakOverlay');
  let confettiOn = false;
  function showOverlay(left) {
    if (!overlay.classList.contains('show')) {
      overlay.classList.add('show');
      $('#breakIdea').textContent = BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)];
      $('#breakTitle').textContent = run.mode === 'long' ? 'Big Break!' : 'Brain Break!';
      startConfetti();
    }
    $('#breakClock').textContent = fmt(left);
    const faces = ['🕺', '💃', '🤸', '🐙', '🦄', '🎈'];
    $('#dancer').textContent = faces[Math.floor(Date.now() / 900) % faces.length];
  }
  function hideOverlay() {
    if (overlay.classList.contains('show')) { overlay.classList.remove('show'); confettiOn = false; }
  }

  function startConfetti() {
    const canvas = $('#breakCanvas'), ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bits = [];
    function size() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
    size();
    if (!startConfetti.bound) { window.addEventListener('resize', size); startConfetti.bound = true; }
    const colors = ['#fff27a', '#ff8fc4', '#7ee8fa', '#b6ff7a', '#ffb37a', '#ffffff'];
    const shapes = ['●', '★', '🎈', '⭐', '🎉', '🌈', '🍭'];
    for (let i = 0; i < (reduce ? 18 : 55); i++) {
      bits.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 12 + Math.random() * 26,
        vy: (reduce ? .15 : .5) + Math.random() * 1.4,
        vx: (Math.random() - .5) * .9,
        spin: (Math.random() - .5) * .05,
        a: Math.random() * 6,
        emoji: Math.random() < .55 ? shapes[Math.floor(Math.random() * shapes.length)] : null,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    confettiOn = true;
    (function frame() {
      if (!confettiOn) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.forEach(b => {
        b.y += b.vy; b.x += b.vx + Math.sin(b.y / 60) * .6; b.a += b.spin;
        if (b.y - b.r > canvas.height) { b.y = -b.r; b.x = Math.random() * canvas.width; }
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.globalAlpha = .9;
        if (b.emoji) { ctx.font = b.r + 'px serif'; ctx.textAlign = 'center'; ctx.fillText(b.emoji, 0, 0); }
        else { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, b.r / 3, 0, 7); ctx.fill(); }
        ctx.restore();
      });
      requestAnimationFrame(frame);
    })();
  }

  /* ---- notifications ---- */
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body: body, icon: undefined }); } catch (err) { /* ignore */ }
  }

  /* ---- settings UI ---- */
  const numFields = ['focusMin', 'breakMin', 'longBreakMin', 'creditsPerSession'];
  function paintSettings() {
    numFields.forEach(k => { $('#' + k).value = S()[k]; });
    $('#settingsSummary').textContent =
      '⚙️ Change the timer — right now it is ' + S().focusMin + ' min focus / ' + S().breakMin + ' min break';
    $$('#presetChips .chip').forEach(c => {
      const [f, b] = c.dataset.preset.split(',').map(Number);
      c.classList.toggle('on', S().focusMin === f && S().breakMin === b);
    });
    $('#rounds').value = S().roundsBeforeLongBreak;
    $('#optSound').classList.toggle('on', S().sound);
    $('#optAutoBreak').classList.toggle('on', S().autoStartBreak);
    $('#optAutoFocus').classList.toggle('on', S().autoStartFocus);
    const granted = 'Notification' in window && Notification.permission === 'granted';
    $('#optNotify').classList.toggle('on', granted);
    $('#optNotify').textContent = granted ? '🔔 Pop-up reminders' : '🔕 Pop-up reminders';
  }
  const LIMITS = { focusMin: [1, 90], breakMin: [1, 30], longBreakMin: [1, 60], creditsPerSession: [0, 50] };
  numFields.forEach(k => {
    $('#' + k).addEventListener('change', e => {
      const [lo, hi] = LIMITS[k];
      const v = Math.max(lo, Math.min(hi, Math.round(+e.target.value || 0)));
      S()[k] = v; e.target.value = v; save();
      if (!run.running) { run.left = fullMs(run.mode); saveRun(); }
      paintSettings(); paint();
    });
  });
  $('#rounds').addEventListener('change', e => {
    S().roundsBeforeLongBreak = Math.max(2, Math.min(8, Math.round(+e.target.value || 4)));
    e.target.value = S().roundsBeforeLongBreak; save(); paintSettings(); paint();
  });
  function applyLengths(focus, brk) {
    S().focusMin = focus;
    S().breakMin = brk;
    save();
    if (!run.running) { run.left = fullMs(run.mode); saveRun(); }
    paintSettings(); paint();
    toast('⏱️ Now ' + focus + ' minutes of focus, ' + brk + ' minute' + (brk === 1 ? '' : 's') + ' of break');
  }
  $('#presetChips').addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const [f, brk] = b.dataset.preset.split(',').map(Number);
    applyLengths(f, brk);
  });
  $('#resetSettings').onclick = () => applyLengths(20, 5);
  $('#optSound').onclick = () => { S().sound = !S().sound; save(); paintSettings(); if (S().sound) beep([880]); };
  $('#optAutoBreak').onclick = () => { S().autoStartBreak = !S().autoStartBreak; save(); paintSettings(); };
  $('#optAutoFocus').onclick = () => { S().autoStartFocus = !S().autoStartFocus; save(); paintSettings(); };
  $('#optNotify').onclick = () => {
    if (!('Notification' in window)) return toast('This browser has no pop-up reminders.');
    Notification.requestPermission().then(paintSettings);
  };

  /* ---- wiring ---- */
  $('#startBtn').onclick = toggle;
  $('#resetBtn').onclick = reset;
  $('#skipBtn').onclick = () => { run.left = 0; run.endAt = Date.now(); finishSession(); };
  $('#newIdeaBtn').onclick = () => {
    let next = $('#breakIdea').textContent;
    while (next === $('#breakIdea').textContent && BREAK_IDEAS.length > 1) next = BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)];
    $('#breakIdea').textContent = next;
  };
  $('#endBreakBtn').onclick = () => { hideOverlay(); goTo('focus', false); };
  $('#breakPlayBtn').onclick = toggle;
  $('#taskInput').value = run.task || '';
  $('#taskInput').addEventListener('input', e => { run.task = e.target.value.trim(); saveRun(); });

  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 's' || e.key === 'S') { run.left = 0; finishSession(); }
    else if (e.key === 'Escape' && run.mode !== 'focus') { hideOverlay(); goTo('focus', false); }
  });
  window.addEventListener('beforeunload', () => { if (run.running) run.left = msLeft(); saveRun(); });

  // catch up if the tab was closed mid-session
  if (run.running && Date.now() >= run.endAt) { run.left = 0; finishSession(); }

  paintSettings();
  paint();
  setInterval(() => {
    if (!run.running) return;
    if (msLeft() <= 0) finishSession(); else paint();
  }, 250);
})();
