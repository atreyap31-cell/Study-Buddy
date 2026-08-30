# 🚀 Study Buddy

A kid-friendly study site with three tools, all in one place:

| Page | What it does |
| --- | --- |
| ⏱️ **Focus Timer** (`timer.html`) | 20 minutes of homework focus, then a full-screen, colorful 5-minute brain break with confetti and a rotating list of break ideas. Every length is editable. Earns credits. |
| 🧹 **Chore Chart** (`chores.html`) | Add your own chores on a schedule (every day / certain weekdays / one time), edit or pause them any time. Tick one off to earn credits, then spend them in the Reward Shop you built. |
| 📚 **Homework Countdown** (`homework.html`) | Type in assignments and due dates and watch a live countdown of days, hours, minutes and seconds. |

Everything is plain HTML/CSS/JavaScript — no build step, no server, no account.
All data is saved in the browser's `localStorage` on that device.

## Making it yours

- **Chores** — the "All chores" card on the chore page adds one; the ✏️ button on any chore edits its icon, name, credit value and whole schedule; ⏸️ pauses it (off the daily list, history kept); 🗑️ deletes it with an undo.
- **Rewards** — "➕ Add a reward" creates one, ✏️ re-prices or renames it, 🗑️ removes it. Set the costs to whatever feels right; credits are only worth what you say they are.
- **Timer** — open "⚙️ Change the timer" for one-tap presets (10/2, 20/5, 25/5, 45/10), or type any focus / break / long-break length, how many sessions earn a long break, and how many credits a finished session pays. "↩️ Back to 20 / 5" undoes any experiment.
- The three starter chores and rewards on first run are only examples — edit or delete them.

## Features

- **Saves automatically** — close the tab, come back later, everything is still there (the focus timer even keeps counting through a page reload).
- **Multiple kids** — the dropdown in the header switches between people; each one has their own chores, credits and homework.
- **Credits system** — finished focus sessions (5), chores (whatever you set) and assignments (10) all pay credits. Redeem them for rewards you define yourself.
- **Undo** on almost every action (ticking a chore, deleting, finishing homework).
- **Dark mode** toggle, big touch-friendly buttons, keyboard shortcuts on the timer (`space` / `R` / `S`).
- **Backup & restore** — export a JSON file from the home page and load it on another device.
- **Optional pop-up reminders** and a gentle chime when a session ends.
- Works offline once the page has loaded, and respects "reduce motion" system settings.

## Publish it on GitHub Pages

1. Create a new repository on GitHub (public), e.g. `study-buddy`.
2. From this folder:

   ```bash
   git init && git add -A && git commit -m "Study Buddy site" && git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/study-buddy.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save**.
4. A minute later the site is live at `https://YOUR-USERNAME.github.io/study-buddy/`.

Add that URL to a phone or tablet home screen for a one-tap app-like shortcut.

## Run it locally

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>. (Opening the files directly with `file://` mostly works too, but some browsers block saved data that way.)

## Files

```
index.html        home / kid dashboard / backup tools
timer.html        Pomodoro focus timer + break overlay
chores.html       chore schedule, credits, reward shop
homework.html     assignment countdowns
assets/style.css  all styling (light + dark themes)
assets/common.js  storage, profiles, credits, toasts, sound
assets/timer.js   timer logic and the break animation
assets/chores.js  chore scheduling and rewards
assets/homework.js countdown logic
```

## Changing the defaults

Timer lengths, credits per session, auto-start and sound are all editable in **⚙️ Timer settings** on the timer page.
Starter chores and rewards are seeded on first visit only — edit or delete them freely.
