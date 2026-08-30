/* ===== Chore chart: schedules, ticking off, credits and rewards ===== */
(function () {
  'use strict';
  const { $, $$, uid, me, save, dayKey, prettyDay, toast, beep, escapeHtml } = SB;
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let viewDate = new Date();           // which day the top card is showing
  let newDays = [1, 2, 3, 4, 5];       // weekday chips for the "certain days" option

  const keyOf = d => dayKey(d);
  const isDue = (chore, d) => SB.choreDueOn(chore, d);
  const doneMap = k => { const p = me(); p.done[k] = p.done[k] || {}; return p.done[k]; };

  /* ---------- today card ---------- */
  function paintDay() {
    const p = me(), k = keyOf(viewDate), done = p.done[k] || {};
    const isToday = k === dayKey();
    const isFuture = new Date(k) > new Date(dayKey());
    $('#dayLabel').textContent = isToday ? 'Today' : (k === dayKey(Date.now() - 864e5) ? 'Yesterday' : (k === dayKey(Date.now() + 864e5) ? 'Tomorrow' : prettyDay(k).split(',')[0]));
    $('#dayDate').textContent = prettyDay(k);
    $('#todayBtn').hidden = isToday;

    const due = p.chores.filter(c => isDue(c, viewDate));
    const doneList = due.filter(c => done[c.id]);
    const totalCredits = due.reduce((s, c) => s + (+c.credits || 0), 0);
    const gotCredits = doneList.reduce((s, c) => s + (+c.credits || 0), 0);
    $('#dayEarned').textContent = gotCredits + ' / ' + totalCredits + ' credits';
    $('#dayProgress').style.width = (due.length ? (doneList.length / due.length) * 100 : 0) + '%';

    if (!due.length) {
      $('#todayList').innerHTML = '<div class="empty"><span class="big-emoji">🌤️</span>' +
        (p.chores.length ? 'No chores scheduled for this day. Enjoy!' : 'No chores yet — add your first one below.') + '</div>';
      return;
    }
    $('#todayList').innerHTML = due.map(c => {
      const on = !!done[c.id];
      return `<div class="item ${on ? 'done' : ''}">
        <button class="check ${on ? 'on' : ''}" data-tick="${c.id}" aria-pressed="${on}"
                aria-label="${on ? 'Undo' : 'Complete'} ${escapeHtml(c.name)}">${on ? '✔' : ''}</button>
        <span style="font-size:1.6rem" aria-hidden="true">${escapeHtml(c.emoji || '✅')}</span>
        <div class="grow">
          <div class="title">${escapeHtml(c.name)}</div>
          <div class="muted">${scheduleText(c)}${on && done[c.id].at ? ' · ticked at ' + new Date(done[c.id].at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</div>
        </div>
        <span class="badge coin">🪙 ${+c.credits || 0}</span>
      </div>`;
    }).join('') + (isFuture ? '<p class="muted center">This day has not happened yet — you can still tick things off early.</p>' : '');
  }

  function scheduleText(c) {
    if (c.type === 'daily') return 'Every day';
    if (c.type === 'days') return (c.days || []).length === 7 ? 'Every day' : (c.days || []).map(d => DAY_NAMES[d]).join(', ') || 'No days picked';
    return 'One time · ' + (c.date ? prettyDay(c.date) : 'no date');
  }

  function tick(id) {
    const chore = me().chores.find(c => c.id === id);
    if (!chore) return;
    if (SB.toggleChore(chore, keyOf(viewDate))) {
      beep([880, 1180]);
      toast('🎉 ' + chore.name + ' done! +' + (+chore.credits || 0) + ' credits', 'Undo', () => tick(id));
    } else {
      toast('↩️ Un-ticked "' + chore.name + '"');
    }
    paintAll();
  }

  /* ---------- chore list ---------- */
  function paintChores() {
    const p = me();
    if (!p.chores.length) { $('#choreList').innerHTML = '<div class="empty">Nothing here yet. Add a chore above ⬆️</div>'; return; }
    $('#choreList').innerHTML = p.chores.map(c => `
      <div class="item">
        <span style="font-size:1.5rem" aria-hidden="true">${escapeHtml(c.emoji || '✅')}</span>
        <div class="grow">
          <div class="title">${escapeHtml(c.name)}</div>
          <div class="muted">${scheduleText(c)}${c.paused ? ' · ⏸️ paused' : ''}</div>
        </div>
        <span class="badge coin">🪙 ${+c.credits || 0}</span>
        <button class="chip" data-editchore="${c.id}">✏️ Edit</button>
        <button class="chip" data-pausechore="${c.id}">${c.paused ? '▶️ Resume' : '⏸️ Pause'}</button>
        <button class="chip" data-delchore="${c.id}">🗑️</button>
      </div>`).join('');
  }

  function paintDayChips() {
    $('#dayChips').innerHTML = DAY_NAMES.map((n, i) =>
      `<button type="button" class="chip ${newDays.includes(i) ? 'on' : ''}" data-day="${i}">${n}</button>`).join('');
  }

  /* ---------- rewards ---------- */
  function paintRewards() {
    const p = me(), bal = SB.balance();
    if (!p.rewards.length) {
      $('#rewardList').innerHTML = '<div class="empty"><span class="big-emoji">🎁</span>No rewards yet. Add one so those credits are worth something!</div>';
      return;
    }
    $('#rewardList').innerHTML = p.rewards.slice().sort((a, b) => a.cost - b.cost).map(r => {
      const can = bal >= r.cost;
      return `<div class="item">
        <span style="font-size:1.6rem" aria-hidden="true">${escapeHtml(r.emoji || '🎁')}</span>
        <div class="grow">
          <div class="title">${escapeHtml(r.name)}</div>
          <div class="muted">${can ? 'You can afford this! 🎉' : 'Need ' + (r.cost - bal) + ' more credits'}</div>
          <div class="progress"><div style="width:${Math.min(100, (bal / r.cost) * 100)}%;background:${can ? 'var(--green)' : 'var(--amber)'}"></div></div>
        </div>
        <span class="badge coin">🪙 ${r.cost}</span>
        <button class="${can ? 'green' : 'ghost'} tiny" data-buy="${r.id}" ${can ? '' : 'disabled'}>Redeem</button>
        <button class="chip" data-editreward="${r.id}">✏️</button>
        <button class="chip" data-delreward="${r.id}">🗑️</button>
      </div>`;
    }).join('');
  }

  function redeem(id) {
    const p = me(), r = p.rewards.find(x => x.id === id);
    if (!r) return;
    if (SB.balance() < r.cost) return toast('Not enough credits yet — keep going! 💪');
    SB.confirmBox('Trade ' + r.cost + ' credits?', 'You get: ' + r.name, 'Yes please!').then(yes => {
      if (!yes) return;
      SB.addCredits(r.cost, 'Reward: ' + r.name, 'spend');
      beep([1180, 880, 1180]);
      toast('🎁 Enjoy your ' + r.name + '!');
      paintAll();
    });
  }

  /* ---------- stats + history ---------- */
  function paintStats() {
    const p = me();
    const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let weekCount = 0;
    Object.keys(p.done).forEach(k => {
      const [y, m, d] = k.split('-').map(Number);
      if (new Date(y, m - 1, d) >= weekStart) weekCount += Object.keys(p.done[k]).length;
    });
    $('#statWeek').textContent = weekCount;
    $('#statEarned').textContent = p.log.filter(e => e.kind === 'earn').reduce((s, e) => s + e.amount, 0);
    $('#statSpent').textContent = p.log.filter(e => e.kind === 'spend').reduce((s, e) => s + e.amount, 0);

    const log = me().log.slice(0, 40);
    $('#historyList').innerHTML = log.length ? log.map(e => `
      <div class="item" style="padding:10px 14px">
        <span style="font-size:1.2rem">${e.kind === 'earn' ? '➕' : '➖'}</span>
        <div class="grow"><div class="title" style="font-size:.98rem">${escapeHtml(e.note || (e.kind === 'earn' ? 'Credits' : 'Spent'))}</div>
        <div class="muted">${new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
        <span class="badge ${e.kind === 'earn' ? 'green' : 'red'}">${e.kind === 'earn' ? '+' : '-'}${e.amount}</span>
      </div>`).join('') : '<div class="empty">Nothing yet.</div>';
  }

  function paintAll() { paintDay(); paintChores(); paintRewards(); paintStats(); SB.paintCredits(false); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tick],[data-buy],[data-delreward],[data-editreward],[data-delchore],[data-editchore],[data-pausechore],[data-day]');
    if (!t) return;
    if (t.dataset.tick) return tick(t.dataset.tick);
    if (t.dataset.buy) return redeem(t.dataset.buy);
    if (t.dataset.pausechore) {
      const c = me().chores.find(x => x.id === t.dataset.pausechore);
      if (!c) return;
      c.paused = !c.paused;
      save(); paintAll();
      return toast(c.paused ? '⏸️ "' + c.name + '" is off the list for now' : '▶️ "' + c.name + '" is back');
    }
    if (t.dataset.editreward) {
      const r = me().rewards.find(x => x.id === t.dataset.editreward);
      if (!r) return;
      return SB.ask('Edit reward', [
        { key: 'emoji', label: 'Icon', value: r.emoji || '🎁', maxlength: 4 },
        { key: 'name', label: 'Reward', value: r.name, maxlength: 60 },
        { key: 'cost', label: 'Cost in credits', value: r.cost, type: 'number', min: 1, max: 9999 }
      ]).then(res => {
        if (!res || !res.name.trim()) return;
        r.name = res.name.trim();
        r.emoji = res.emoji.trim() || r.emoji;
        r.cost = Math.max(1, Math.round(+res.cost || r.cost));
        save(); paintAll(); toast('✏️ Reward updated');
      });
    }
    if (t.dataset.day !== undefined) {
      const d = +t.dataset.day;
      newDays = newDays.includes(d) ? newDays.filter(x => x !== d) : newDays.concat(d).sort();
      return paintDayChips();
    }
    if (t.dataset.delreward) {
      const r = me().rewards.find(x => x.id === t.dataset.delreward);
      if (!r) return;
      SB.confirmBox('Remove "' + r.name + '"?', 'It disappears from the Reward Shop. Credits stay where they are.', 'Remove', true)
        .then(yes => {
          if (!yes) return;
          me().rewards = me().rewards.filter(x => x.id !== r.id);
          save(); paintAll();
          toast('🗑️ Reward removed', 'Undo', () => { me().rewards.push(r); save(); paintAll(); });
        });
      return;
    }
    if (t.dataset.delchore) {
      const c = me().chores.find(x => x.id === t.dataset.delchore);
      if (!c) return;
      SB.confirmBox('Delete "' + c.name + '"?', 'Credits already earned are kept.', 'Delete', true).then(yes => {
        if (!yes) return;
        me().chores = me().chores.filter(x => x.id !== c.id);
        save(); paintAll();
        toast('🗑️ Deleted "' + c.name + '"', 'Undo', () => { me().chores.push(c); save(); paintAll(); });
      });
      return;
    }
    if (t.dataset.editchore) {
      const c = me().chores.find(x => x.id === t.dataset.editchore);
      if (!c) return;
      SB.ask('Edit chore', [
        { key: 'emoji', label: 'Icon', value: c.emoji || '✅', maxlength: 4 },
        { key: 'name', label: 'Chore', value: c.name, maxlength: 60 },
        { key: 'credits', label: 'Credits', value: c.credits, type: 'number', min: 0, max: 999 },
        { key: 'type', label: 'When', type: 'select', value: c.type,
          options: [['daily', 'Every day'], ['days', 'Certain days'], ['once', 'One time only']] },
        { key: 'days', label: 'Which days?', type: 'days', value: c.days || [], showIf: ['type', 'days'] },
        { key: 'date', label: 'On this date', type: 'date', value: c.date || dayKey(), showIf: ['type', 'once'] }
      ]).then(res => {
        if (!res) return;
        if (res.type === 'days' && !res.days.length) return toast('Pick at least one day of the week.');
        if (res.type === 'once' && !res.date) return toast('Pick a date for a one-time chore.');
        c.name = res.name.trim() || c.name;
        c.emoji = res.emoji.trim() || c.emoji;
        c.credits = Math.max(0, Math.min(999, Math.round(+res.credits || 0)));
        c.type = res.type;
        c.days = res.type === 'days' ? res.days : [];
        c.date = res.type === 'once' ? res.date : '';
        save(); paintAll(); toast('✏️ Updated');
      });
    }
  });

  $('#choreForm').addEventListener('submit', e => {
    e.preventDefault();
    const type = $('#cType').value;
    if (!$('#cName').value.trim()) return toast('Give the chore a name first.');
    if (type === 'days' && !newDays.length) return toast('Pick at least one day of the week.');
    if (type === 'once' && !$('#cDate').value) return toast('Pick the date for this one-time chore.');
    me().chores.push({
      id: uid(),
      name: $('#cName').value.trim(),
      emoji: $('#cEmoji').value.trim() || '✅',
      credits: Math.max(0, Math.round(+$('#cCredits').value || 0)),
      type: type,
      days: type === 'days' ? newDays.slice() : [],
      date: type === 'once' ? $('#cDate').value : ''
    });
    save();
    $('#cName').value = '';
    $('#cName').focus();
    toast('➕ Chore added');
    paintAll();
  });

  $('#cType').addEventListener('change', () => {
    $('#daysField').hidden = $('#cType').value !== 'days';
    $('#dateField').hidden = $('#cType').value !== 'once';
  });

  $('#rewardForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('#rName').value.trim()) return toast('Give the reward a name first.');
    me().rewards.push({
      id: uid(),
      name: $('#rName').value.trim(),
      emoji: $('#rEmoji').value.trim() || '🎁',
      cost: Math.max(1, Math.round(+$('#rCost').value || 1))
    });
    save();
    $('#rName').value = '';
    toast('🎁 Reward added');
    paintAll();
  });

  $('#prevDay').onclick = () => { viewDate.setDate(viewDate.getDate() - 1); paintDay(); };
  $('#nextDay').onclick = () => { viewDate.setDate(viewDate.getDate() + 1); paintDay(); };
  $('#todayBtn').onclick = () => { viewDate = new Date(); paintDay(); };

  // first-time helpers so the page is never empty
  (function seed() {
    const p = me();
    if (p.chores.length || p.rewards.length || p.log.length) return;
    p.chores = [
      { id: uid(), name: 'Make the bed', emoji: '🛏️', credits: 5, type: 'daily', days: [], date: '' },
      { id: uid(), name: 'Homework time', emoji: '📚', credits: 15, type: 'days', days: [1, 2, 3, 4, 5], date: '' },
      { id: uid(), name: 'Take out the trash', emoji: '🗑️', credits: 10, type: 'days', days: [2, 5], date: '' }
    ];
    p.rewards = [
      { id: uid(), name: '30 minutes of screen time', emoji: '🎮', cost: 50 },
      { id: uid(), name: 'Pick the movie on Friday', emoji: '🍿', cost: 120 },
      { id: uid(), name: 'Ice cream trip', emoji: '🍦', cost: 200 }
    ];
    save();
  })();

  $('#cDate').value = dayKey();
  paintDayChips();
  paintAll();
})();
