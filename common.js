/* ===== Study Buddy — shared helpers (storage, profiles, credits, toasts) ===== */
(function () {
  'use strict';

  const KEY = 'studyBuddy.v1';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------- data model ---------- */
  function blankProfile(name, emoji) {
    return {
      id: uid(),
      name: name || 'Me',
      emoji: emoji || '🐣',
      chores: [],          // {id, name, emoji, credits, type:'daily'|'days'|'once', days:[0-6], date:'YYYY-MM-DD'}
      done: {},            // { 'YYYY-MM-DD': { choreId: true } }
      rewards: [],         // {id, name, emoji, cost}
      log: [],             // {id, at, kind:'earn'|'spend', amount, note}
      homework: [],        // {id, title, subject, due(ISO), done, doneAt, created}
      focus: { totalSessions: 0, todayKey: '', todaySessions: 0, streakDays: 0, lastDay: '' }
    };
  }

  function defaults() {
    const p = blankProfile('Me', '🐣');
    return {
      version: 1,
      activeProfile: p.id,
      profiles: [p],
      settings: {
        focusMin: 20,
        breakMin: 5,
        longBreakMin: 15,
        roundsBeforeLongBreak: 4,
        autoStartBreak: true,
        autoStartFocus: false,
        sound: true,
        creditsPerSession: 5,
        theme: 'light'
      }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      const base = defaults();
      data.settings = Object.assign(base.settings, data.settings || {});
      if (!Array.isArray(data.profiles) || !data.profiles.length) return base;
      data.profiles = data.profiles.map(p => Object.assign(blankProfile(), p));
      if (!data.profiles.some(p => p.id === data.activeProfile)) data.activeProfile = data.profiles[0].id;
      return data;
    } catch (err) {
      console.warn('Could not read saved data, starting fresh.', err);
      return defaults();
    }
  }

  let data = load();
  let saveTimer = null;

  function writeNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      toast('⚠️ Could not save — storage may be full or blocked.');
    }
  }

  // save() batches writes; save(true) writes straight away (before a reload or navigation)
  function save(now) {
    if (now) return writeNow();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeNow, 60);
  }
  // never lose a batched write when the page goes away
  window.addEventListener('pagehide', () => { if (saveTimer) writeNow(); });

  const me = () => data.profiles.find(p => p.id === data.activeProfile) || data.profiles[0];

  /* ---------- dates ---------- */
  function dayKey(d) {
    const t = d ? new Date(d) : new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function prettyDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  /* ---------- credits ---------- */
  function balance(p) {
    p = p || me();
    return p.log.reduce((sum, e) => sum + (e.kind === 'spend' ? -e.amount : e.amount), 0);
  }
  function addCredits(amount, note, kind) {
    const p = me();
    p.log.unshift({ id: uid(), at: Date.now(), kind: kind || 'earn', amount: Math.abs(amount), note: note || '' });
    if (p.log.length > 400) p.log.length = 400;
    save();
    paintCredits(true);
  }
  function paintCredits(pop) {
    const chip = $('#creditChip');
    if (!chip) return;
    chip.innerHTML = '<span aria-hidden="true">🪙</span> ' + balance() + ' credits';
    if (pop) { chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop'); }
  }

  /* ---------- toast ---------- */
  function toast(msg, actionLabel, onAction, ms) {
    let host = $('#toaster');
    if (!host) { host = document.createElement('div'); host.id = 'toaster'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.appendChild(Object.assign(document.createElement('span'), { textContent: msg }));
    if (actionLabel) {
      const b = document.createElement('button');
      b.textContent = actionLabel;
      b.onclick = () => { el.remove(); onAction && onAction(); };
      el.appendChild(b);
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), ms || (actionLabel ? 6500 : 3000));
  }

  /* ---------- in-page dialog (nicer than prompt/confirm, and never blocked) ---------- */
  function modal(opts) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.id = 'modalBack';
      const box = document.createElement('div');
      box.className = 'modal';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      const fields = opts.fields || [];
      box.innerHTML =
        '<h2>' + SBescape(opts.title || '') + '</h2>' +
        (opts.message ? '<p>' + SBescape(opts.message) + '</p>' : '') +
        fields.map((f, i) =>
          '<div class="field"><label for="mf' + i + '">' + SBescape(f.label) + '</label>' +
          '<input id="mf' + i + '" type="' + (f.type || 'text') + '" value="' + SBescape(f.value == null ? '' : f.value) + '"' +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + '></div>').join('') +
        '<div class="modal-actions">' +
        '<button class="ghost" data-mcancel>' + SBescape(opts.cancel || 'Cancel') + '</button>' +
        '<button class="' + (opts.danger ? 'red' : 'green') + '" data-mok>' + SBescape(opts.ok || 'OK') + '</button>' +
        '</div>';
      back.appendChild(box);
      document.body.appendChild(back);
      const inputs = Array.from(box.querySelectorAll('input'));
      const finish = value => { back.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
      const submit = () => {
        const out = {};
        fields.forEach((f, i) => { out[f.key] = inputs[i].value; });
        finish(fields.length ? out : true);
      };
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
        else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); submit(); }
      }
      box.querySelector('[data-mok]').onclick = submit;
      box.querySelector('[data-mcancel]').onclick = () => finish(null);
      back.addEventListener('mousedown', e => { if (e.target === back) finish(null); });
      document.addEventListener('keydown', onKey);
      setTimeout(() => (inputs[0] || box.querySelector('[data-mok]')).focus(), 30);
    });
  }
  const SBescape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ask = (title, fields, ok) => modal({ title: title, fields: fields, ok: ok || 'Save' });
  const confirmBox = (title, message, ok, danger) =>
    modal({ title: title, message: message, ok: ok || 'Yes', cancel: 'No', danger: danger }).then(v => v === true);

  /* ---------- sound ---------- */
  let audioCtx = null;
  function beep(notes) {
    if (!data.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      (notes || [660, 880, 1180]).forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = audioCtx.currentTime + i * 0.17;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start); osc.stop(start + 0.45);
      });
    } catch (err) { /* audio is a nice-to-have */ }
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    document.documentElement.dataset.theme = data.settings.theme === 'dark' ? 'dark' : 'light';
    const btn = $('#themeBtn');
    if (btn) {
      btn.textContent = data.settings.theme === 'dark' ? '☀️' : '🌙';
      btn.title = data.settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }

  /* ---------- backup ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'study-buddy-backup-' + dayKey() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('💾 Backup file saved to Downloads');
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        if (!incoming || !Array.isArray(incoming.profiles)) throw new Error('bad file');
        confirmBox('Load this backup?', 'It replaces everything currently saved on this device.', 'Load it', true)
          .then(yes => {
            if (!yes) return;
            localStorage.setItem(KEY, JSON.stringify(incoming));
            location.reload();
          });
      } catch (err) {
        toast('😕 That file did not look like a Study Buddy backup.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- header wiring ---------- */
  function paintProfiles() {
    const sel = $('#profileSelect');
    if (!sel) return;
    sel.innerHTML = '';
    data.profiles.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.emoji + ' ' + p.name;
      sel.appendChild(o);
    });
    const add = document.createElement('option');
    add.value = '__add'; add.textContent = '➕ Add a person…';
    sel.appendChild(add);
    if (data.profiles.length > 1) {
      const ren = document.createElement('option');
      ren.value = '__remove'; ren.textContent = '🗑️ Remove this person…';
      sel.appendChild(ren);
    }
    sel.value = data.activeProfile;
  }

  function initHeader() {
    const sel = $('#profileSelect');
    if (sel) {
      paintProfiles();
      sel.addEventListener('change', () => {
        if (sel.value === '__add') {
          paintProfiles();
          ask('Add a person', [
            { key: 'name', label: 'Their name', value: '', maxlength: 20 },
            { key: 'emoji', label: 'Pick an emoji', value: '🦊', maxlength: 4 }
          ], 'Add').then(res => {
            if (!res || !res.name.trim()) return;
            const p = blankProfile(res.name.trim().slice(0, 20), res.emoji.trim().slice(0, 4) || '🦊');
            data.profiles.push(p);
            data.activeProfile = p.id;
            save(true);
            location.reload();
          });
        } else if (sel.value === '__remove') {
          const p = me();
          paintProfiles();
          confirmBox('Remove ' + p.name + '?', 'This deletes their chores, credits and homework on this device.', 'Delete', true)
            .then(yes => {
              if (!yes) return;
              data.profiles = data.profiles.filter(x => x.id !== p.id);
              data.activeProfile = data.profiles[0].id;
              save(true);
              location.reload();
            });
        } else {
          data.activeProfile = sel.value;
          save(true);
          location.reload();
        }
      });
    }
    const theme = $('#themeBtn');
    if (theme) theme.addEventListener('click', () => {
      data.settings.theme = data.settings.theme === 'dark' ? 'light' : 'dark';
      save(); applyTheme();
    });
    paintCredits(false);
    // highlight current tab
    const here = location.pathname.split('/').pop() || 'index.html';
    $$('nav.tabs a').forEach(a => {
      if ((a.getAttribute('href') || '') === here) a.setAttribute('aria-current', 'page');
    });
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', initHeader);
  // keep tabs in sync if the site is open twice
  window.addEventListener('storage', e => { if (e.key === KEY) { data = load(); paintCredits(false); } });

  window.SB = {
    $, $$, uid, get data() { return data; }, me, save, load,
    dayKey, prettyDay, balance, addCredits, paintCredits,
    toast, beep, exportData, importData, applyTheme, blankProfile, modal, ask, confirmBox,
    escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  };
})();
