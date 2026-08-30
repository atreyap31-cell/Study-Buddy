/* ===== Homework countdown: one-off assignments and repeating work ===== */
(function () {
  'use strict';
  const { $, $$, uid, me, save, dayKey, toast, beep, escapeHtml } = SB;
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let filter = localStorage.getItem('studyBuddy.hwFilter') || 'open';
  let formDays = [1, 2, 3, 4, 5];

  /* ---------- countdown text ---------- */
  function countdownText(when) {
    const ms = when - Date.now();
    const s = Math.floor(Math.abs(ms) / 1000);
    const days = Math.floor(s / 86400), hours = Math.floor(s / 3600) % 24;
    const mins = Math.floor(s / 60) % 60, secs = s % 60;
    if (ms < 0) {
      if (days >= 1) return 'Late by ' + days + (days === 1 ? ' day ' : ' days ') + hours + 'h';
      return 'Late by ' + hours + 'h ' + mins + 'm';
    }
    if (days >= 1) return days + (days === 1 ? ' day, ' : ' days, ') + hours + 'h ' + mins + 'm left';
    return hours + 'h ' + String(mins).padStart(2, '0') + 'm ' + String(secs).padStart(2, '0') + 's left';
  }
  function urgency(when) {
    const h = (when - Date.now()) / 36e5;
    return h < 0 ? 'late' : h < 24 ? 'urgent' : h < 72 ? 'soon' : 'ok';
  }
  const STYLE = {
    late: { badge: 'red', word: 'PAST DUE', bar: 'var(--red)' },
    urgent: { badge: 'red', word: 'DUE VERY SOON', bar: 'var(--red)' },
    soon: { badge: 'amber', word: 'COMING UP', bar: 'var(--amber)' },
    ok: { badge: 'green', word: 'PLENTY OF TIME', bar: 'var(--green)' }
  };
  const stamp = when => when.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const creditsOf = h => (h.credits == null ? SB.DEFAULT_HW_CREDITS : +h.credits);

  /* ---------- which rows to show ---------- */
  function rows() {
    const list = me().homework.map(h => ({ h: h, next: SB.hwNext(h) }));
    if (filter === 'repeat') return list.filter(r => r.h.repeat && r.h.repeat !== 'once').sort(byNext);
    if (filter === 'done') return list.filter(r => r.h.repeat === 'once' && r.h.done).reverse();
    if (filter === 'all') return list.sort(byNext);
    if (filter === 'soon') return list.filter(r => r.next && (r.next - Date.now()) < 72 * 36e5).sort(byNext);
    return list.filter(r => r.next).sort(byNext);   // "to do"
  }
  const byNext = (a, b) => (a.next ? a.next.getTime() : Infinity) - (b.next ? b.next.getTime() : Infinity);

  function paint() {
    const p = me();
    const live = p.homework.map(h => SB.hwNext(h)).filter(Boolean);
    $('#statOpen').textContent = live.length;
    $('#statSoon').textContent = live.filter(n => { const d = n - Date.now(); return d >= 0 && d < 48 * 36e5; }).length;
    $('#statLate').textContent = live.filter(n => n < Date.now()).length;
    $$('#filterChips .chip').forEach(c => c.classList.toggle('on', c.dataset.filter === filter));

    const list = rows();
    if (!list.length) {
      $('#hwList').innerHTML = '<div class="empty"><span class="big-emoji">' +
        (filter === 'done' ? '🗂️' : filter === 'repeat' ? '🔁' : '🎉') + '</span>' +
        (filter === 'done' ? 'Nothing finished yet — go get one!'
          : filter === 'repeat' ? 'Nothing repeats yet. Set "How often?" to every day or certain days when you add one.'
          : p.homework.length ? 'Nothing here. You are all caught up!' : 'No assignments yet. Add your first one above ⬆️') +
        '</div>';
      return;
    }
    $('#hwList').innerHTML = list.map(r => {
      const h = r.h, repeats = h.repeat && h.repeat !== 'once';
      const finished = !r.next;
      const u = finished ? 'ok' : urgency(r.next);
      const st = STYLE[u];
      const span = repeats ? 0 : new Date(h.due) - new Date(h.created || h.due);
      const gone = span > 0 ? Math.min(100, Math.max(0, ((Date.now() - new Date(h.created || h.due)) / span) * 100)) : 0;
      const key = r.next ? dayKey(r.next) : dayKey();
      return `<div class="item ${finished ? 'done' : ''}" style="align-items:flex-start">
        <button class="check ${finished ? 'on' : ''}" data-done="${h.id}" data-key="${key}" aria-pressed="${finished}"
                aria-label="${finished ? 'Mark unfinished' : 'Mark finished'}: ${escapeHtml(h.title)}">${finished ? '✔' : ''}</button>
        <div class="grow">
          <div class="spread" style="gap:8px">
            <div class="title">${escapeHtml(h.title)}</div>
            <div class="chips">
              ${h.subject ? `<span class="badge blue">${escapeHtml(h.subject)}</span>` : ''}
              ${repeats ? `<span class="badge">🔁 ${escapeHtml(SB.repeatText(h))}</span>` : ''}
              <span class="badge coin">🪙 ${creditsOf(h)}</span>
              ${finished ? '<span class="badge green">DONE</span>' : `<span class="badge ${st.badge}">${st.word}</span>`}
            </div>
          </div>
          ${finished
            ? `<div class="muted">Finished${h.doneAt ? ' ' + new Date(h.doneAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''} · was due ${stamp(new Date(h.due))}</div>`
            : `<div class="countdown ${u}" data-count="${h.id}">${countdownText(r.next)}</div>
               <div class="muted">${repeats ? 'Next one: ' : 'Due '}${stamp(r.next)}</div>
               ${span > 0 ? `<div class="progress"><div style="width:${gone}%;background:${st.bar}"></div></div>` : ''}`}
        </div>
        <div class="chips" style="flex-direction:column">
          <button class="chip" data-edit="${h.id}" aria-label="Edit">✏️</button>
          <button class="chip" data-del="${h.id}" aria-label="Delete">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  function tickClocks() {
    const map = {};
    me().homework.forEach(h => { map[h.id] = h; });
    $$('[data-count]').forEach(el => {
      const h = map[el.dataset.count];
      if (!h) return;
      const next = SB.hwNext(h);
      if (!next) return;
      el.textContent = countdownText(next);
      const u = urgency(next);
      el.className = 'countdown ' + u;
      const badge = el.closest('.item').querySelector('.badge.red, .badge.amber, .badge.green');
      if (badge) { badge.className = 'badge ' + STYLE[u].badge; badge.textContent = STYLE[u].word; }
    });
  }

  /* ---------- actions ---------- */
  function toggleDone(id, key) {
    const h = me().homework.find(x => x.id === id);
    if (!h) return;
    const nowDone = SB.toggleHw(h, key);
    if (nowDone) {
      beep([880, 1180, 1480]);
      toast('🎉 "' + h.title + '" done! +' + creditsOf(h) + ' credits', 'Undo', () => toggleDone(id, key));
    } else {
      toast('↩️ Back on your to-do list');
    }
    paint();
  }

  function paintDayChips() {
    $('#hDayChips').innerHTML = DAY_NAMES.map((n, i) =>
      `<button type="button" class="chip ${formDays.includes(i) ? 'on' : ''}" data-hday="${i}">${n}</button>`).join('');
  }
  function syncRepeatFields() {
    const r = $('#hRepeat').value;
    $('#hDaysField').hidden = r !== 'days';
    $('#hDateField').hidden = r !== 'once';
    $('#quickChips').style.visibility = r === 'once' ? 'visible' : 'hidden';
  }
  $('#hRepeat').addEventListener('change', syncRepeatFields);

  $('#hwForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#hTitle').value.trim();
    if (!title) return toast('Type what the assignment is first.');
    const repeat = $('#hRepeat').value;
    if (repeat === 'days' && !formDays.length) return toast('Pick at least one day of the week.');
    const time = $('#hTime').value || '08:00';
    let due = new Date();
    if (repeat === 'once') {
      due = new Date($('#hDate').value + 'T' + time);
      if (isNaN(due)) return toast('Pick a due date.');
    }
    me().homework.push({
      id: uid(),
      title: title,
      subject: $('#hSubject').value.trim(),
      credits: Math.max(0, Math.min(999, Math.round(+$('#hCredits').value || 0))),
      repeat: repeat,
      days: repeat === 'days' ? formDays.slice() : [],
      time: time,
      due: due.toISOString(),
      done: false,
      doneAt: null,
      created: Date.now()
    });
    save();
    $('#hTitle').value = '';
    $('#hTitle').focus();
    if (filter === 'done') setFilter(repeat === 'once' ? 'open' : 'repeat');
    toast(repeat === 'once' ? '📌 Added — the countdown is running!' : '🔁 Added to your weekly schedule');
    paint();
  });

  $('#quickChips').addEventListener('click', e => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const d = new Date();
    d.setDate(d.getDate() + Number(b.dataset.quick));
    $('#hDate').value = dayKey(d);
    $('#hTime').value = b.dataset.quick === '0' ? '20:00' : '08:00';
    $$('#quickChips .chip').forEach(c => c.classList.toggle('on', c === b));
  });

  function setFilter(f) {
    filter = f;
    localStorage.setItem('studyBuddy.hwFilter', f);
    paint();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-done],[data-del],[data-edit],[data-filter],[data-hday]');
    if (!t) return;
    if (t.dataset.hday !== undefined) {
      const n = +t.dataset.hday;
      formDays = formDays.includes(n) ? formDays.filter(x => x !== n) : formDays.concat(n).sort();
      return paintDayChips();
    }
    if (t.dataset.filter) return setFilter(t.dataset.filter);
    if (t.dataset.done) return toggleDone(t.dataset.done, t.dataset.key);

    const h = me().homework.find(x => x.id === (t.dataset.del || t.dataset.edit));
    if (!h) return;
    if (t.dataset.del) {
      return SB.confirmBox('Delete "' + h.title + '"?', 'It comes off the countdown for good.', 'Delete', true).then(yes => {
        if (!yes) return;
        me().homework = me().homework.filter(x => x.id !== h.id);
        save(); paint();
        toast('🗑️ Deleted', 'Undo', () => { me().homework.push(h); save(); paint(); });
      });
    }
    const local = new Date(new Date(h.due).getTime() - new Date().getTimezoneOffset() * 60000).toISOString();
    SB.ask('Edit assignment', [
      { key: 'title', label: 'What is it?', value: h.title, maxlength: 90 },
      { key: 'subject', label: 'Subject', value: h.subject || '', maxlength: 30 },
      { key: 'credits', label: 'Credits for finishing it', value: creditsOf(h), type: 'number', min: 0, max: 999 },
      { key: 'repeat', label: 'How often?', type: 'select', value: h.repeat || 'once',
        options: [['once', 'Just once'], ['days', 'Certain days each week'], ['daily', 'Every day']] },
      { key: 'days', label: 'Which days?', type: 'days', value: h.days || [], showIf: ['repeat', 'days'] },
      { key: 'date', label: 'Due date', type: 'date', value: local.slice(0, 10), showIf: ['repeat', 'once'] },
      { key: 'time', label: 'Due time', type: 'time', value: h.repeat && h.repeat !== 'once' ? (h.time || '08:00') : local.slice(11, 16) }
    ]).then(res => {
      if (!res) return;
      if (res.repeat === 'days' && !res.days.length) return toast('Pick at least one day of the week.');
      h.title = res.title.trim() || h.title;
      h.subject = res.subject.trim();
      h.credits = Math.max(0, Math.min(999, Math.round(+res.credits || 0)));
      h.repeat = res.repeat;
      h.days = res.repeat === 'days' ? res.days : [];
      h.time = res.time || '08:00';
      if (res.repeat === 'once') {
        const parsed = new Date(res.date + 'T' + h.time);
        if (!isNaN(parsed)) h.due = parsed.toISOString();
        else toast('Kept the old due date — that one could not be read.');
      }
      save(); paint();
      toast('✏️ Updated');
    });
  });

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('#hDate').value = dayKey(tomorrow);
  paintDayChips();
  syncRepeatFields();
  paint();
  setInterval(tickClocks, 1000);
  setInterval(paint, 60000);
})();
