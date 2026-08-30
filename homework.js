/* ===== Homework countdown dashboard ===== */
(function () {
  'use strict';
  const { $, $$, uid, me, save, toast, beep, escapeHtml } = SB;
  const CREDITS_PER_ASSIGNMENT = 10;
  let filter = localStorage.getItem('studyBuddy.hwFilter') || 'open';

  /* ---------- time helpers ---------- */
  function parts(ms) {
    const s = Math.floor(Math.abs(ms) / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor(s / 3600) % 24,
      mins: Math.floor(s / 60) % 60,
      secs: s % 60,
      totalHours: Math.floor(s / 3600)
    };
  }
  function countdownText(due) {
    const ms = new Date(due) - Date.now();
    const p = parts(ms);
    if (ms < 0) {
      if (p.days >= 1) return 'Late by ' + p.days + (p.days === 1 ? ' day' : ' days') + ' ' + p.hours + 'h';
      return 'Late by ' + p.hours + 'h ' + p.mins + 'm';
    }
    if (p.days >= 1) return p.days + (p.days === 1 ? ' day, ' : ' days, ') + p.hours + 'h ' + p.mins + 'm left';
    return p.hours + 'h ' + String(p.mins).padStart(2, '0') + 'm ' + String(p.secs).padStart(2, '0') + 's left';
  }
  function urgency(due) {
    const h = (new Date(due) - Date.now()) / 36e5;
    if (h < 0) return 'late';
    if (h < 24) return 'urgent';
    if (h < 72) return 'soon';
    return 'ok';
  }
  const URGENCY_STYLE = {
    late: { badge: 'red', word: 'PAST DUE', bar: 'var(--red)' },
    urgent: { badge: 'red', word: 'DUE VERY SOON', bar: 'var(--red)' },
    soon: { badge: 'amber', word: 'COMING UP', bar: 'var(--amber)' },
    ok: { badge: 'green', word: 'PLENTY OF TIME', bar: 'var(--green)' }
  };
  const dueLabel = due => new Date(due).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  /* ---------- render ---------- */
  function visible() {
    const list = me().homework.slice().sort((a, b) => new Date(a.due) - new Date(b.due));
    if (filter === 'open') return list.filter(h => !h.done);
    if (filter === 'done') return list.filter(h => h.done).reverse();
    if (filter === 'soon') return list.filter(h => !h.done && (new Date(h.due) - Date.now()) < 72 * 36e5);
    return list;
  }

  function paint() {
    const p = me();
    const open = p.homework.filter(h => !h.done);
    $('#statOpen').textContent = open.length;
    $('#statSoon').textContent = open.filter(h => { const d = new Date(h.due) - Date.now(); return d >= 0 && d < 48 * 36e5; }).length;
    $('#statLate').textContent = open.filter(h => new Date(h.due) < Date.now()).length;
    $$('#filterChips .chip').forEach(c => c.classList.toggle('on', c.dataset.filter === filter));

    const list = visible();
    if (!list.length) {
      $('#hwList').innerHTML = '<div class="empty"><span class="big-emoji">' +
        (filter === 'done' ? '🗂️' : '🎉') + '</span>' +
        (filter === 'done' ? 'Nothing finished yet — go get one!' :
         p.homework.length ? 'Nothing here. You are all caught up!' : 'No assignments yet. Add your first one above ⬆️') +
        '</div>';
      return;
    }
    $('#hwList').innerHTML = list.map(h => {
      const u = h.done ? 'ok' : urgency(h.due);
      const st = URGENCY_STYLE[u];
      const span = new Date(h.due) - new Date(h.created || h.due);
      const gone = span > 0 ? Math.min(100, Math.max(0, ((Date.now() - new Date(h.created || h.due)) / span) * 100)) : 100;
      return `<div class="item ${h.done ? 'done' : ''}" data-row="${h.id}" style="align-items:flex-start">
        <button class="check ${h.done ? 'on' : ''}" data-done="${h.id}" aria-pressed="${h.done}"
                aria-label="${h.done ? 'Mark unfinished' : 'Mark finished'}: ${escapeHtml(h.title)}">${h.done ? '✔' : ''}</button>
        <div class="grow">
          <div class="spread" style="gap:8px">
            <div class="title">${escapeHtml(h.title)}</div>
            <div class="chips">
              ${h.subject ? `<span class="badge blue">${escapeHtml(h.subject)}</span>` : ''}
              ${h.done ? '<span class="badge green">DONE</span>' : `<span class="badge ${st.badge}">${st.word}</span>`}
            </div>
          </div>
          ${h.done
            ? `<div class="muted">Finished ${h.doneAt ? new Date(h.doneAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''} · was due ${dueLabel(h.due)}</div>`
            : `<div class="countdown ${u}" data-count="${h.id}">${countdownText(h.due)}</div>
               <div class="muted">Due ${dueLabel(h.due)}</div>
               <div class="progress"><div style="width:${gone}%;background:${st.bar}"></div></div>`}
        </div>
        <div class="chips" style="flex-direction:column">
          <button class="chip" data-edit="${h.id}" aria-label="Edit">✏️</button>
          <button class="chip" data-del="${h.id}" aria-label="Delete">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  // cheap per-second refresh: only the countdown lines change
  function tickClocks() {
    const map = {};
    me().homework.forEach(h => { map[h.id] = h; });
    $$('[data-count]').forEach(el => {
      const h = map[el.dataset.count];
      if (!h) return;
      el.textContent = countdownText(h.due);
      const u = urgency(h.due);
      el.className = 'countdown ' + u;
      const badge = el.closest('.item').querySelector('.badge.red, .badge.amber, .badge.green');
      if (badge && !h.done) { badge.className = 'badge ' + URGENCY_STYLE[u].badge; badge.textContent = URGENCY_STYLE[u].word; }
    });
  }

  /* ---------- actions ---------- */
  function toggleDone(id) {
    const h = me().homework.find(x => x.id === id);
    if (!h) return;
    h.done = !h.done;
    h.doneAt = h.done ? Date.now() : null;
    if (h.done) {
      SB.addCredits(CREDITS_PER_ASSIGNMENT, 'Finished: ' + h.title);
      beep([880, 1180, 1480]);
      toast('🎉 "' + h.title + '" finished! +' + CREDITS_PER_ASSIGNMENT + ' credits', 'Undo', () => toggleDone(id));
    } else {
      SB.addCredits(CREDITS_PER_ASSIGNMENT, 'Reopened: ' + h.title, 'spend');
      toast('↩️ Moved back to your to-do list');
    }
    save(); paint();
  }

  $('#hwForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('#hTitle').value.trim()) return toast('Type what the assignment is first.');
    const due = new Date($('#hDate').value + 'T' + ($('#hTime').value || '08:00'));
    if (isNaN(due)) return toast('That due date did not look right.');
    me().homework.push({
      id: uid(),
      title: $('#hTitle').value.trim(),
      subject: $('#hSubject').value.trim(),
      due: due.toISOString(),
      done: false,
      doneAt: null,
      created: Date.now()
    });
    save();
    $('#hTitle').value = '';
    $('#hTitle').focus();
    if (filter === 'done') setFilter('open');
    toast('📌 Added — the countdown is running!');
    paint();
  });

  $('#quickChips').addEventListener('click', e => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const d = new Date();
    d.setDate(d.getDate() + Number(b.dataset.quick));
    $('#hDate').value = SB.dayKey(d);
    $('#hTime').value = b.dataset.quick === '0' ? '20:00' : '08:00';
    $$('#quickChips .chip').forEach(c => c.classList.toggle('on', c === b));
  });

  function setFilter(f) {
    filter = f;
    localStorage.setItem('studyBuddy.hwFilter', f);
    paint();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-done],[data-del],[data-edit],[data-filter]');
    if (!t) return;
    if (t.dataset.filter) return setFilter(t.dataset.filter);
    if (t.dataset.done) return toggleDone(t.dataset.done);
    const p = me();
    if (t.dataset.del) {
      const h = p.homework.find(x => x.id === t.dataset.del);
      if (!h) return;
      SB.confirmBox('Delete "' + h.title + '"?', 'It comes off the countdown list.', 'Delete', true).then(yes => {
        if (!yes) return;
        me().homework = me().homework.filter(x => x.id !== h.id);
        save(); paint();
        toast('🗑️ Deleted', 'Undo', () => { me().homework.push(h); save(); paint(); });
      });
      return;
    }
    if (t.dataset.edit) {
      const h = p.homework.find(x => x.id === t.dataset.edit);
      if (!h) return;
      const local = new Date(new Date(h.due).getTime() - new Date().getTimezoneOffset() * 60000).toISOString();
      SB.ask('Edit assignment', [
        { key: 'title', label: 'What is it?', value: h.title, maxlength: 90 },
        { key: 'subject', label: 'Subject', value: h.subject || '', maxlength: 30 },
        { key: 'date', label: 'Due date', value: local.slice(0, 10), type: 'date' },
        { key: 'time', label: 'Due time', value: local.slice(11, 16), type: 'time' }
      ]).then(res => {
        if (!res) return;
        const parsed = new Date(res.date + 'T' + (res.time || '08:00'));
        h.title = res.title.trim() || h.title;
        h.subject = res.subject.trim();
        if (!isNaN(parsed)) h.due = parsed.toISOString(); else toast('Kept the old due date — that one could not be read.');
        save(); paint();
        toast('✏️ Updated');
      });
    }
  });

  // sensible defaults in the form
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('#hDate').value = SB.dayKey(tomorrow);
  $('#hDate').min = SB.dayKey(new Date(Date.now() - 365 * 864e5));

  paint();
  setInterval(tickClocks, 1000);
  setInterval(paint, 60000); // keeps the stat tiles honest as time passes
})();
