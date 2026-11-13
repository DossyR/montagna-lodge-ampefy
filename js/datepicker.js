/* =====================================================================
   Calendrier interactif arrivée / départ
   - dates passées et séjours trop longs désactivés
   - nuits complètes (venant du système de réservation) grisées
   - impossible de choisir un séjour qui chevauche une nuit complète
   - clavier : flèches, Entrée, Échap ; mobile : panneau en bas d'écran
   ===================================================================== */
(function () {
  const D = window.LodgeDates;
  const cfg = window.LODGE_CONFIG.booking;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  let pop = null;        // élément du calendrier (unique, partagé)
  let active = null;     // { pair, field }
  let suppress = false;  // évite la réouverture quand on rend le focus au champ

  function build() {
    pop = document.createElement('div');
    pop.className = 'lodge-cal';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.hidden = true;
    pop.innerHTML =
      '<div class="lodge-cal__head">' +
        '<button type="button" class="lodge-cal__nav" data-step="-1" aria-label="Mois précédent"><i data-lucide="chevron-left"></i></button>' +
        '<p class="lodge-cal__title" aria-live="polite"></p>' +
        '<button type="button" class="lodge-cal__nav" data-step="1" aria-label="Mois suivant"><i data-lucide="chevron-right"></i></button>' +
      '</div>' +
      '<div class="lodge-cal__week">' + D.DAYS.map(d => '<span>' + d + '</span>').join('') + '</div>' +
      '<div class="lodge-cal__grid" role="grid"></div>' +
      '<div class="lodge-cal__foot"><p class="lodge-cal__hint"></p><button type="button" class="lodge-cal__close">Fermer</button></div>';
    document.body.appendChild(pop);
    window.LodgeIcons.createIcons(pop);

    pop.addEventListener('click', e => {
      const nav = e.target.closest('.lodge-cal__nav');
      if (nav) { active.pair.view = D.addMonths(active.pair.view, +nav.dataset.step); render(); return; }
      if (e.target.closest('.lodge-cal__close')) { close(true); return; }
      const day = e.target.closest('.lodge-cal__day');
      if (day && !day.disabled) choose(D.fromIso(day.dataset.date));
    });
    pop.addEventListener('mouseover', e => {
      const day = e.target.closest('.lodge-cal__day');
      if (!active || active.field !== 'departure' || !day) return;
      paintRange(day.disabled ? null : D.fromIso(day.dataset.date));
    });
    pop.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', e => {
      if (!active || pop.contains(e.target)) return;
      if (active.pair.shells.some(s => s.contains(e.target))) return;
      close(false);
    });
    window.addEventListener('resize', () => active && place());
    window.addEventListener('scroll', () => active && !pop.classList.contains('is-sheet') && place(), { passive: true });
  }

  /* ---------- Règles de sélection ---------- */
  function limits() {
    const min = D.today();
    const max = D.addDays(D.addMonths(min, cfg.maxMonthsAhead), -1);
    return { min, max };
  }
  function isFull(pair, d) { return pair.full.has(D.toIso(d)); }
  function arrivalAllowed(pair, d) {
    const { min, max } = limits();
    return d >= min && d <= max && !isFull(pair, d);
  }
  function departureAllowed(pair, d) {
    const a = pair.arrival;
    if (!a || d <= a) return false;
    if (D.nights(a, d) > cfg.maxNights) return false;
    for (let n = new Date(a); n < d; n = D.addDays(n, 1)) if (isFull(pair, n)) return false;
    return d <= D.addDays(limits().max, 1);
  }

  /* ---------- Rendu ---------- */
  function render() {
    const { pair, field } = active;
    const v = pair.view;
    pop.querySelector('.lodge-cal__title').textContent = D.MONTHS[v.getMonth()] + ' ' + v.getFullYear();
    const { min, max } = limits();
    pop.querySelector('[data-step="-1"]').disabled = D.addMonths(v, 0) <= new Date(min.getFullYear(), min.getMonth(), 1);
    pop.querySelector('[data-step="1"]').disabled = D.addMonths(v, 1) > max;

    const grid = pop.querySelector('.lodge-cal__grid');
    grid.replaceChildren();
    const offset = (v.getDay() + 6) % 7;            // semaine commençant le lundi
    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('span'));
    const days = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
    const today = D.today();
    for (let i = 1; i <= days; i++) {
      const d = new Date(v.getFullYear(), v.getMonth(), i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lodge-cal__day';
      b.textContent = i;
      b.dataset.date = D.toIso(d);
      const ok = field === 'arrival' ? arrivalAllowed(pair, d) : departureAllowed(pair, d);
      b.disabled = !ok;
      if (isFull(pair, d)) { b.classList.add('is-full'); b.title = 'Complet'; }
      if (D.same(d, today)) b.classList.add('is-today');
      b.setAttribute('aria-label', D.long(d) + (isFull(pair, d) ? ' — complet' : ''));
      b.tabIndex = -1;
      grid.appendChild(b);
    }
    paintRange(null);
    const hint = pop.querySelector('.lodge-cal__hint');
    hint.textContent = field === 'arrival' ? 'Choisissez votre date d’arrivée' : 'Choisissez votre date de départ';
    if (pair.full.size) hint.innerHTML += ' <span class="lodge-cal__legend">Complet</span>';
    pop.classList.toggle('is-loading', !!pair.loading);
  }

  function paintRange(hover) {
    const { pair } = active;
    const a = pair.arrival;
    const end = active.field === 'departure' && hover ? hover : pair.departure;
    pop.querySelectorAll('.lodge-cal__day').forEach(b => {
      const d = D.fromIso(b.dataset.date);
      b.classList.toggle('is-start', D.same(d, a));
      b.classList.toggle('is-end', D.same(d, end));
      b.classList.toggle('is-in-range', !!(a && end && d > a && d < end));
      b.setAttribute('aria-pressed', D.same(d, a) || D.same(d, pair.departure) ? 'true' : 'false');
    });
  }

  function place() {
    const shell = active.pair.shells[active.field === 'arrival' ? 0 : 1];
    if (window.innerWidth < 600) {
      pop.classList.add('is-sheet');
      pop.style.left = pop.style.top = '';
      return;
    }
    pop.classList.remove('is-sheet');
    const r = shell.getBoundingClientRect();
    const w = pop.offsetWidth;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    const below = r.bottom + 8;
    const top = below + pop.offsetHeight > window.innerHeight && r.top > pop.offsetHeight + 16 ? r.top - pop.offsetHeight - 8 : below;
    pop.style.left = left + window.scrollX + 'px';
    pop.style.top = top + window.scrollY + 'px';
  }

  /* ---------- Ouverture / sélection ---------- */
  function open(pair, field) {
    if (!pop) build();
    active = { pair, field };
    const ref = (field === 'departure' && (pair.departure || pair.arrival)) || pair.arrival || D.today();
    pair.view = new Date(ref.getFullYear(), ref.getMonth(), 1);
    pop.hidden = false;
    pop.setAttribute('aria-label', field === 'arrival' ? 'Calendrier — date d’arrivée' : 'Calendrier — date de départ');
    pair.inputs.forEach((inp, i) => inp.setAttribute('aria-expanded', String(i === (field === 'arrival' ? 0 : 1))));
    render();
    place();
    pair.loadMonths().then(() => active && active.pair === pair && render());
  }

  function close(returnFocus) {
    if (!active) return;
    const { pair, field } = active;
    pop.hidden = true;
    pair.inputs.forEach(inp => inp.setAttribute('aria-expanded', 'false'));
    active = null;
    if (returnFocus) { suppress = true; pair.inputs[field === 'arrival' ? 0 : 1].focus({ preventScroll: true }); suppress = false; }
  }

  function choose(d) {
    const { pair, field } = active;
    if (field === 'arrival') {
      pair.set(d, pair.departure && departureAllowedFor(pair, d, pair.departure) ? pair.departure : null);
      active.field = 'departure';
      pair.inputs[1].focus({ preventScroll: true });
      open(pair, 'departure');
    } else {
      pair.set(pair.arrival, d);
      close(true);
    }
  }
  function departureAllowedFor(pair, a, d) {
    const prev = pair.arrival; pair.arrival = a;
    const ok = departureAllowed(pair, d);
    pair.arrival = prev;
    return ok;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    const cur = document.activeElement.closest && document.activeElement.closest('.lodge-cal__day');
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!cur || !(e.key in moves)) return;
    e.preventDefault();
    const next = D.addDays(D.fromIso(cur.dataset.date), moves[e.key]);
    const pair = active.pair;
    if (next.getMonth() !== pair.view.getMonth()) { pair.view = new Date(next.getFullYear(), next.getMonth(), 1); render(); }
    focusDay(next);
  }
  function focusDay(d) {
    const b = pop.querySelector('[data-date="' + D.toIso(d) + '"]') || pop.querySelector('.lodge-cal__day:not(:disabled)');
    if (b) { b.tabIndex = 0; b.focus(); }
  }

  /* ---------- Paire de champs ---------- */
  function attachRange({ arrival, departure, getRoom, onChange }) {
    const pair = {
      inputs: [arrival, departure],
      shells: [arrival.closest('.input-shell') || arrival, departure.closest('.input-shell') || departure],
      arrival: D.parseFr(arrival.value),
      departure: D.parseFr(departure.value),
      full: new Set(),
      loaded: new Map(),     // "roomId|AAAA-MM" -> Promise
      lists: new Map(),      // "roomId|AAAA-MM" -> ['AAAA-MM-JJ', …]
      view: D.today(),
      loading: false,

      set(a, d) {
        pair.arrival = a || null;
        pair.departure = d || null;
        arrival.value = D.toFr(pair.arrival);
        departure.value = D.toFr(pair.departure);
        [arrival, departure].forEach(i => i.dispatchEvent(new Event('lodge:datechange', { bubbles: true })));
        if (onChange) onChange(pair);
      },

      /** Charge les nuits complètes du mois affiché (+ le suivant). */
      async loadMonths() {
        const room = getRoom && getRoom();
        if (!room || !(await window.LodgeBooking.isLive())) { pair.full = new Set(); return; }
        const jobs = [0, 1].map(k => {
          const m = D.addMonths(pair.view, k);
          const key = room + '|' + D.toIso(m).slice(0, 7);
          if (!pair.loaded.has(key)) {
            const end = D.addDays(D.addMonths(m, 1), -1);
            pair.loaded.set(key, window.LodgeBooking.unavailableNights(room, D.toIso(m), D.toIso(end))
              .then(list => { pair.lists.set(key, list); })
              .catch(() => { pair.loaded.delete(key); }));
          }
          return pair.loaded.get(key);
        });
        pair.loading = true;
        await Promise.all(jobs);
        pair.loading = false;
        if ((getRoom && getRoom()) !== room) return;
        const set = new Set();
        pair.lists.forEach((list, key) => { if (key.startsWith(room + '|')) list.forEach(n => set.add(n)); });
        pair.full = set;
      },

      /** À appeler quand l'hébergement choisi change ou après une réservation. */
      reset() { pair.loaded.clear(); pair.lists.clear(); pair.full = new Set(); },

      /** true si les dates saisies ne chevauchent aucune nuit complète connue. */
      rangeIsFree() {
        if (!pair.arrival || !pair.departure) return true;
        for (let n = new Date(pair.arrival); n < pair.departure; n = D.addDays(n, 1)) if (pair.full.has(D.toIso(n))) return false;
        return true;
      }
    };

    [arrival, departure].forEach((input, i) => {
      const field = i === 0 ? 'arrival' : 'departure';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('aria-haspopup', 'dialog');
      input.setAttribute('aria-expanded', 'false');
      if (isTouch) input.readOnly = true;            // évite le clavier qui masque le calendrier
      const openIt = () => { if (suppress) return; if (!active || active.pair !== pair || active.field !== field) open(pair, field); };
      input.addEventListener('focus', openIt);
      input.addEventListener('click', openIt);
      pair.shells[i].addEventListener('click', e => { if (e.target !== input) { input.focus(); openIt(); } });
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' && active) { e.preventDefault(); focusDay((field === 'arrival' ? pair.arrival : pair.departure) || pair.arrival || D.today()); }
        if (e.key === 'Escape') close(false);
        if (e.key === 'Tab') close(false);
      });
      /* saisie manuelle au clavier (ordinateur) */
      input.addEventListener('change', () => {
        const d = D.parseFr(input.value);
        if (field === 'arrival') pair.set(d, pair.departure && d && pair.departure > d ? pair.departure : null);
        else pair.set(pair.arrival, d);
        if (d) input.value = D.toFr(d);
        if (active && active.pair === pair) { pair.view = new Date((d || D.today()).getFullYear(), (d || D.today()).getMonth(), 1); render(); }
      });
    });
    return pair;
  }

  window.LodgeDatepicker = { attachRange, close: () => close(false) };
})();
