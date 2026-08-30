/* ===== Two-week calendar: what is due, day by day ===== */
(function () {
  'use strict';
  const { $, $$, me, dayKey, prettyDay, toast, beep, escapeHtml } = SB;
  const DAYS = 14;
  let selected = dayKey();

  const dateOf = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const creditsOf = h => (h.credits == null ? SB.DEFAULT_HW_CREDITS : +h.credits);

  /* what is on a given day */
  function agenda(key) {
    const p = me(), d = dateOf(key);
    const chores = p.chores.filter(c => SB.choreDueOn(c, d))
      .map(c => ({ kind: 'chore', id: c.id, item: c, name: c.name, emoji: c.emoji || '✅',
                   credits: +c.credits || 0, done: SB.choreDone(p, c, key), when: null,
                   note: c.type === 'daily' ? 'Every day' : c.type === 'days' ? 'Weekly chore' : 'One time' }));
    const hw = p.homework.filter(h => SB.hwOccursOn(h, d))
      .map(h => ({ kind: 'hw', id: h.id, item: h, name: h.title, emoji: '📚',
                   credits: creditsOf(h), done: SB.hwDone(h, key), when: SB.hwWhen(h, d),
                   note: (h.subject ? h.subject + ' · ' : '') + (h.repeat && h.repeat !== 'once' ? SB.repeatText(h) : 'One time') }));
    return chores.concat(hw.sort((a, b) => a.when - b.when));
  }

  /* the strip of 14 days */
  function paintGrid() {
    const today = new Date();
    const html = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = dayKey(d);
      const list = agenda(key);
      const left = list.filter(x => !x.done).length;
      const pips = list.slice(0, 8).map(x => `<span class="pip ${x.kind}"></span>`).join('');
      html.push(`<button class="cal-day ${key === selected ? 'on' : ''} ${i === 0 ? 'today' : ''}" data-day="${key}"
        aria-pressed="${key === selected}" aria-label="${prettyDay(key)}, ${left} thing${left === 1 ? '' : 's'} to do">
        <span class="dow">${i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</span>
        <span class="num">${d.getDate()}</span>
        <span class="pips">${pips}</span>
        ${list.length && !left ? '<span class="allDone">✔ all done</span>' : ''}
      </button>`);
    }
    $('#calGrid').innerHTML = html.join('');
  }

  /* the detail panel for the selected day */
  function paintDay() {
    const list = agenda(selected);
    const done = list.filter(x => x.done).length;
    const isToday = selected === dayKey();
    $('#dayTitle').textContent = isToday ? 'Today' :
      selected === dayKey(new Date(Date.now() + 864e5)) ? 'Tomorrow' : prettyDay(selected).split(',')[0];
    $('#daySub').textContent = prettyDay(selected) +
      (list.length ? ' · ' + done + ' of ' + list.length + ' done · 🪙 ' +
        list.filter(x => x.done).reduce((s, x) => s + x.credits, 0) + ' of ' +
        list.reduce((s, x) => s + x.credits, 0) + ' credits' : '');
    $('#dayBar').style.width = (list.length ? (done / list.length) * 100 : 0) + '%';

    $('#dayDetail').innerHTML = list.length ? list.map(x => `
      <div class="item ${x.done ? 'done' : ''}">
        <button class="check ${x.done ? 'on' : ''}" data-tick="${x.kind}:${x.id}" aria-pressed="${x.done}"
                aria-label="${x.done ? 'Undo' : 'Complete'} ${escapeHtml(x.name)}">${x.done ? '✔' : ''}</button>
        <span style="font-size:1.5rem" aria-hidden="true">${escapeHtml(x.emoji)}</span>
        <div class="grow">
          <div class="title">${escapeHtml(x.name)}</div>
          <div class="muted">${escapeHtml(x.note)}${x.when ? ' · due ' + x.when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</div>
        </div>
        <span class="badge ${x.kind === 'chore' ? 'blue' : 'coin'}">${x.kind === 'chore' ? '🧹 chore' : '📚 homework'}</span>
        <span class="badge coin">🪙 ${x.credits}</span>
      </div>`).join('') +
      (list.every(x => x.done) ? '<p class="center" style="font-weight:800;color:var(--green)">🎉 Everything on this day is finished!</p>' : '')
      : `<div class="empty"><span class="big-emoji">🌤️</span>Nothing scheduled for this day.
         <div style="margin-top:12px" class="row" style="justify-content:center">
           <a class="btn ghost tiny" href="chores.html">Add a chore</a>
           <a class="btn ghost tiny" href="homework.html">Add homework</a>
         </div></div>`;
  }

  function paintAll() { paintGrid(); paintDay(); SB.paintCredits(false); }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-day],[data-tick]');
    if (!t) return;
    if (t.dataset.day) { selected = t.dataset.day; return paintAll(); }

    const [kind, id] = t.dataset.tick.split(':');
    const p = me();
    if (kind === 'chore') {
      const c = p.chores.find(x => x.id === id);
      if (!c) return;
      if (SB.toggleChore(c, selected)) { beep([880, 1180]); toast('🎉 ' + c.name + ' done! +' + (+c.credits || 0) + ' credits'); }
      else toast('↩️ Un-ticked "' + c.name + '"');
    } else {
      const h = p.homework.find(x => x.id === id);
      if (!h) return;
      if (SB.toggleHw(h, selected)) { beep([880, 1180, 1480]); toast('🎉 "' + h.title + '" done! +' + creditsOf(h) + ' credits'); }
      else toast('↩️ Back on your to-do list');
    }
    paintAll();
  });

  const shift = n => {
    const d = dateOf(selected);
    d.setDate(d.getDate() + n);
    const first = dayKey(), last = dayKey(new Date(Date.now() + (DAYS - 1) * 864e5));
    const key = dayKey(d);
    if (key < first || key > last) return toast('The calendar covers today plus the next 13 days.');
    selected = key;
    paintAll();
  };
  $('#calPrev').onclick = () => shift(-1);
  $('#calNext').onclick = () => shift(1);
  $('#calToday').onclick = () => { selected = dayKey(); paintAll(); };
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') shift(-1);
    else if (e.key === 'ArrowRight') shift(1);
  });

  paintAll();
})();
