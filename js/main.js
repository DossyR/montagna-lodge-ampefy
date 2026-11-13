/* =====================================================================
   MONTAGNA LODGE AMPEFY — Interactions du site
   1. Initialisation (icônes, liens)      6. Vérification des disponibilités
   2. Fenêtre de dialogue                  7. Détails des hébergements
   3. Menu & navigation                    8. Galerie interactive
   4. Calendriers                          9. Formulaire de réservation
   5. Validation des champs
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.LODGE_CONFIG;
  const D = window.LodgeDates;
  const Booking = window.LodgeBooking;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    });
    children.flat().forEach(c => c != null && n.append(c));
    return n;
  };
  const roomById = id => CFG.rooms.find(r => r.id === id);
  const roomCard = id => $('.room-card[data-room-id="' + id + '"]');
  const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');

  /* ---------- 1. Initialisation ---------- */
  window.LodgeIcons.createIcons();
  $$('[data-social]').forEach(a => {
    const url = CFG.socials[a.dataset.social];
    if (url) a.href = url;
    else { a.setAttribute('aria-disabled', 'true'); a.title = 'Lien bientôt disponible'; }
  });

  /* ---------- 2. Fenêtre de dialogue ---------- */
  const dialog = $('#lodge-dialog');
  const dialogContent = $('#lodge-dialog-content');
  let dialogOpener = null;
  let dialogKeyHandler = null;

  function openDialog(nodes, { variant = '', label = '' } = {}) {
    dialogOpener = document.activeElement;
    dialogContent.replaceChildren(...nodes);
    dialog.className = 'lodge-dialog' + (variant ? ' lodge-dialog--' + variant : '');
    if (label) { dialog.setAttribute('aria-label', label); dialog.removeAttribute('aria-labelledby'); }
    else { dialog.removeAttribute('aria-label'); dialog.setAttribute('aria-labelledby', 'lodge-dialog-title'); }
    window.LodgeIcons.createIcons(dialogContent);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function closeDialog() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => {
    dialogKeyHandler = null;
    if (dialogOpener && document.contains(dialogOpener)) dialogOpener.focus({ preventScroll: true });
  });
  $('.lodge-dialog__close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });
  dialog.addEventListener('keydown', e => dialogKeyHandler && dialogKeyHandler(e));

  function goToReservation() {
    closeDialog();
    $('#reservation').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 3. Menu & navigation ---------- */
  const nav = $('.lodge-nav');
  const menu = $('.menu-toggle');
  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.replaceChildren(window.LodgeIcons.svg(open ? 'x' : 'menu'));
    nav.classList.toggle('is-open', open);
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  $$('a', nav).forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menu.focus(); } });
  document.addEventListener('pointerdown', e => { if (nav.classList.contains('is-open') && !nav.contains(e.target) && !menu.contains(e.target)) setMenu(false); });

  /* Lien actif selon la section visible */
  const spyLinks = $$('a[href^="#"]', nav).filter(a => !a.hasAttribute('data-open-reviews') && a.getAttribute('href') !== '#activites');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach(a => {
          const on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyLinks.forEach(a => { const t = $(a.getAttribute('href')); if (t) spy.observe(t); });
  }

  /* Avis (contenu de la maquette) */
  $('[data-open-reviews]').addEventListener('click', e => {
    e.preventDefault();
    openDialog([
      el('h2', { id: 'lodge-dialog-title' }, 'Avis voyageurs'),
      el('p', {}, 'Contactez notre équipe pour en savoir plus sur votre séjour à ' + CFG.name + '.')
    ]);
  });

  /* ---------- 4. Calendriers ---------- */
  const availForm = $('#availability-form');
  const booking = $('#reservation-form');

  const availDates = window.LodgeDatepicker.attachRange({
    arrival: availForm.elements.arrival,
    departure: availForm.elements.departure
  });
  const bookingDates = window.LodgeDatepicker.attachRange({
    arrival: booking.elements.arrival,
    departure: booking.elements.departure,
    getRoom: () => booking.elements.room.value || null
  });
  /* Dates proposées par défaut : demain, pour 2 nuits */
  const tomorrow = D.addDays(D.today(), 1);
  availDates.set(tomorrow, D.addDays(tomorrow, 2));

  booking.elements.room.addEventListener('change', () => { bookingDates.reset(); bookingDates.loadMonths(); });

  /* ---------- 5. Validation des champs ---------- */
  const shellOf = c => c.closest('.input-shell, .floating-field') || c;
  function markInvalid(control, invalid) {
    shellOf(control).classList.toggle('is-invalid', invalid);
    if (invalid) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
  }
  [availForm, booking].forEach(form => {
    form.addEventListener('input', e => e.target.matches('input,select') && markInvalid(e.target, false));
    form.addEventListener('change', e => e.target.matches('input,select') && markInvalid(e.target, false));
    form.addEventListener('lodge:datechange', e => markInvalid(e.target, false));
  });

  /** Vérifie dates et voyageurs. Renvoie { errors: [[control, message]], data } */
  function checkStay(form, pair, { requireRoom }) {
    const errors = [];
    const f = form.elements;
    const a = D.parseFr(f.arrival.value);
    const d = D.parseFr(f.departure.value);
    const today = D.today();
    if (!a) errors.push([f.arrival, 'Indiquez une date d’arrivée valide (JJ/MM/AAAA).']);
    else if (a < today) errors.push([f.arrival, 'La date d’arrivée ne peut pas être dans le passé.']);
    else if (a > D.addMonths(today, CFG.booking.maxMonthsAhead)) errors.push([f.arrival, 'Les réservations sont ouvertes jusqu’à ' + CFG.booking.maxMonthsAhead + ' mois à l’avance.']);
    const arrivalOk = errors.length === 0;
    if (!d) errors.push([f.departure, 'Indiquez une date de départ valide (JJ/MM/AAAA).']);
    else if (!arrivalOk) { /* on corrige d'abord l'arrivée */ }
    else if (d <= a) errors.push([f.departure, 'La date de départ doit être après la date d’arrivée.']);
    else if (D.nights(a, d) > CFG.booking.maxNights) errors.push([f.departure, 'La durée maximale d’un séjour en ligne est de ' + CFG.booking.maxNights + ' nuits. Contactez-nous pour un séjour plus long.']);

    const adults = +f.adults.value, children = +f.children.value;
    const room = requireRoom ? roomById(f.room.value) : null;
    if (requireRoom && !room) errors.push([f.room, 'Choisissez un type d’hébergement.']);
    if (room && adults + children > room.maxGuests) {
      errors.push([f.room, room.name + ' : ' + room.maxGuests + ' personnes maximum (enfants compris).']);
    }
    if (room && a && d && pair && !pair.rangeIsFree()) errors.push([f.arrival, 'Ces dates comprennent une nuit déjà complète pour cet hébergement.']);
    return { errors, data: { a, d, adults, children, room } };
  }

  function showErrors(errors, output) {
    errors.forEach(([c]) => markInvalid(c, true));
    const msgs = [...new Set(errors.map(e => e[1]))];
    output.replaceChildren(el('span', { class: 'form-message form-message--error' }, window.LodgeIcons.svg('circle-alert'), el('span', {}, msgs.join(' '))));
    errors[0][0].focus({ preventScroll: false });
  }

  /* ---------- 6. Vérification des disponibilités ---------- */
  const availError = $('#availability-error');
  availForm.addEventListener('submit', async e => {
    e.preventDefault();
    window.LodgeDatepicker.close();
    availError.replaceChildren();
    const { errors, data } = checkStay(availForm, null, { requireRoom: false });
    if (errors.length) { showErrors(errors, availError); return; }

    /* report dans le formulaire de réservation rapide */
    bookingDates.set(data.a, data.d);
    booking.elements.adults.value = data.adults;
    booking.elements.children.value = data.children;

    const btn = availForm.querySelector('.availability__submit');
    btn.disabled = true; btn.classList.add('is-busy');
    let results = null, failed = false;
    try {
      if (await Booking.isLive()) {
        const res = await Booking.checkAvailability({ arrival: D.toIso(data.a), departure: D.toIso(data.d), adults: data.adults, children: data.children });
        results = res.rooms;
      }
    } catch (err) { failed = true; }
    btn.disabled = false; btn.classList.remove('is-busy');
    showAvailability(data, results, failed);
  });

  function showAvailability(data, results, failed) {
    const nights = D.nights(data.a, data.d);
    const guests = data.adults + data.children;
    const nodes = [
      el('h2', { id: 'lodge-dialog-title' }, results ? 'Disponibilités' : 'Votre séjour'),
      el('p', { class: 'avail-summary' }, 'Du ' + D.long(data.a) + ' au ' + D.long(data.d) + ' · ' + plural(nights, 'nuit') + ' · ' + plural(data.adults, 'adulte') + ', ' + data.children + ' enfant' + (data.children > 1 ? 's' : ''))
    ];
    if (!results) {
      nodes.push(el('p', { class: 'notice' }, window.LodgeIcons.svg('circle-alert'), el('span', {},
        failed ? 'La vérification en ligne n’a pas pu aboutir. ' : 'Le calendrier de réservation en ligne n’est pas encore activé : nous ne pouvons pas vérifier ni confirmer la disponibilité en ligne pour le moment. ',
        'Choisissez un hébergement pour envoyer une demande : l’établissement vous répondra rapidement.')));
    }
    const list = el('ul', { class: 'avail-list' });
    CFG.rooms.forEach(room => {
      const r = results && results.find(x => x.id === room.id);
      const fits = guests <= room.maxGuests;
      const available = results ? !!(r && r.available) : fits;
      let status;
      if (!fits) status = el('p', { class: 'avail-item__status is-no' }, 'Capacité maximale : ' + room.maxGuests + ' personnes');
      else if (results) status = el('p', { class: 'avail-item__status ' + (available ? 'is-yes' : 'is-no') }, window.LodgeIcons.svg(available ? 'check' : 'x'), available ? 'Disponible' : 'Complet à ces dates');
      else status = el('p', { class: 'avail-item__status' }, 'Disponibilité à confirmer par l’établissement');
      const img = roomCard(room.id).querySelector('img').cloneNode();
      img.alt = ''; img.removeAttribute('loading');
      list.append(el('li', { class: 'avail-item' + (available ? '' : ' is-unavailable') },
        img,
        el('div', { class: 'avail-item__body' },
          el('h3', {}, room.name),
          status,
          el('p', { class: 'avail-item__price' }, 'à partir de ', el('strong', {}, D.formatAr(room.priceAr * nights) + ' Ar'), ' pour ' + plural(nights, 'nuit'))
        ),
        el('button', { type: 'button', class: 'gold-button avail-item__choose', ...(available ? {} : { disabled: '' }), onclick: () => chooseRoom(room.id) }, 'CHOISIR')
      ));
    });
    nodes.push(list);
    openDialog(nodes, { variant: 'wide' });
  }

  function chooseRoom(id) {
    booking.elements.room.value = id;
    markInvalid(booking.elements.room, false);
    bookingDates.reset(); bookingDates.loadMonths();
    setStatus(null);
    goToReservation();
    setTimeout(() => {
      const first = [...booking.elements].find(c => c.matches('input[name="name"],input[name="email"],input[name="phone"]') && !c.value);
      if (first) first.focus({ preventScroll: true });
    }, 450);
  }

  /* ---------- 7. Détails des hébergements (maquette) ---------- */
  $$('[data-room]').forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.room-card');
    const image = card.querySelector('img').cloneNode();
    image.removeAttribute('loading');
    openDialog([
      image,
      el('h2', { id: 'lodge-dialog-title' }, button.dataset.room),
      el('p', {}, card.querySelector('.room-card__description').textContent),
      card.querySelector('.room-card__price').cloneNode(true),
      el('button', { type: 'button', class: 'gold-button', onclick: () => chooseRoom(card.dataset.roomId) }, 'CHOISIR CET HÉBERGEMENT')
    ]);
  }));

  /* ---------- 8. Galerie interactive ---------- */
  const track = $('.lodge-gallery__track');
  const photos = [...track.children];
  const dotsBox = $('.gallery-dots');
  let dots = [];
  let page = 0;
  let perPage = 0;
  /* Nombre de photos visibles : 5 sur ordinateur et tablette, 2 sur téléphone (comme la maquette). */
  const visibleCount = () => (window.matchMedia('(max-width:600px)').matches ? 2 : 5);
  function buildDots() {
    const first = page * perPage;
    perPage = visibleCount();
    const pages = Math.ceil(photos.length / perPage);
    dots = Array.from({ length: pages }, (_, i) => el('button', { type: 'button', 'aria-label': 'Page ' + (i + 1), 'aria-pressed': 'false', onclick: () => updateGallery(i) }));
    dotsBox.replaceChildren(...dots);
    page = Math.floor(first / perPage);
  }
  function updateGallery(next) {
    page = (next + dots.length) % dots.length;
    const start = page * perPage;
    photos.forEach(photo => { photo.hidden = true; photo.style.order = ''; });
    for (let k = 0; k < perPage; k++) {
      const photo = photos[(start + k) % photos.length];
      photo.hidden = false;
      photo.style.order = k;
    }
    dots.forEach((dot, index) => { dot.classList.toggle('is-current', index === page); dot.setAttribute('aria-pressed', String(index === page)); });
  }
  buildDots();
  updateGallery(0);
  window.addEventListener('resize', () => { if (visibleCount() !== perPage) { buildDots(); updateGallery(page); } });
  $('.gallery-arrow--next').addEventListener('click', () => updateGallery(page + 1));
  $('.gallery-arrow--previous').addEventListener('click', () => updateGallery(page - 1));

  /* balayage du carrousel au doigt */
  let swipeX = null, swiped = false;
  track.addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; swiped = false; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (swipeX === null) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    if (Math.abs(dx) > 40) { swiped = true; updateGallery(page + (dx < 0 ? 1 : -1)); }
    swipeX = null;
  });

  /* visionneuse plein écran avec navigation */
  function openLightbox(index) {
    let i = index;
    const img = el('img', { class: 'lightbox__image' });
    const caption = el('p', { class: 'lightbox__caption' });
    const counter = el('span', { class: 'lightbox__counter' });
    const show = n => {
      i = (n + photos.length) % photos.length;
      const src = photos[i].querySelector('img');
      img.src = photos[i].dataset.full || src.currentSrc || src.src;
      img.alt = src.alt;
      caption.textContent = src.alt;
      counter.textContent = (i + 1) + ' / ' + photos.length;
    };
    const prev = el('button', { type: 'button', class: 'gallery-arrow lightbox__prev', 'aria-label': 'Photo précédente', onclick: () => show(i - 1) }, window.LodgeIcons.svg('chevron-left'));
    const next = el('button', { type: 'button', class: 'gallery-arrow gallery-arrow--next lightbox__next', 'aria-label': 'Photo suivante', onclick: () => show(i + 1) }, window.LodgeIcons.svg('chevron-right'));
    const stage = el('div', { class: 'lightbox__stage' }, img, prev, next);
    let tx = null;
    stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); tx = null; });
    show(i);
    openDialog([stage, el('div', { class: 'lightbox__meta' }, caption, counter)], { variant: 'gallery', label: 'Galerie photo' });
    dialogKeyHandler = e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    };
  }
  photos.forEach((photo, index) => photo.addEventListener('click', () => { if (swiped) { swiped = false; return; } openLightbox(index); }));

  /* ---------- 9. Formulaire de réservation ---------- */
  const status = $('#reservation-status');
  function setStatus(kind, ...content) {
    if (!kind) { status.replaceChildren(); return; }
    const icon = { error: 'circle-alert', success: 'check', info: 'circle-alert' }[kind];
    status.replaceChildren(el('span', { class: 'form-message form-message--' + kind }, window.LodgeIcons.svg(icon), el('span', {}, ...content)));
  }

  function checkIdentity() {
    const f = booking.elements, errors = [];
    const name = f.name.value.trim().replace(/\s+/g, ' ');
    const email = f.email.value.trim();
    const phoneDigits = f.phone.value.replace(/[\s.\-()]/g, '');
    if (name.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(name)) errors.push([f.name, 'Indiquez votre nom complet.']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push([f.email, 'Indiquez une adresse email valide.']);
    if (!/^\+?\d{9,15}$/.test(phoneDigits)) errors.push([f.phone, 'Indiquez un numéro de téléphone valide (ex. 034 12 345 67).']);
    return { errors, data: { name, email, phone: f.phone.value.trim() } };
  }

  function mailtoRequest(p) {
    const body = [
      'Bonjour, je souhaite demander une réservation.', '',
      'Nom : ' + p.name, 'Email : ' + p.email, 'Téléphone : ' + p.phone,
      'Arrivée : ' + D.toFr(p.a), 'Départ : ' + D.toFr(p.d) + ' (' + plural(D.nights(p.a, p.d), 'nuit') + ')',
      'Adultes : ' + p.adults, 'Enfants : ' + p.children, 'Hébergement : ' + p.room.name
    ].join('\n');
    return 'mailto:' + CFG.contact.email + '?subject=' + encodeURIComponent('Demande de réservation — ' + CFG.name) + '&body=' + encodeURIComponent(body);
  }

  let sending = false;
  booking.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    window.LodgeDatepicker.close();
    const id = checkIdentity();
    const stay = checkStay(booking, bookingDates, { requireRoom: true });
    const errors = [...id.errors, ...stay.errors];
    if (errors.length) { showErrors(errors, status); return; }
    if (booking.elements.website.value) return;        // robot détecté (champ invisible rempli)

    const p = { ...id.data, ...stay.data };
    const submit = booking.querySelector('button[type="submit"]');
    sending = true; submit.disabled = true; submit.classList.add('is-busy');
    setStatus('info', 'Envoi de votre demande…');
    try {
      if (await Booking.isLive()) {
        const res = await Booking.createReservation({
          name: p.name, email: p.email, phone: p.phone,
          arrival: D.toIso(p.a), departure: D.toIso(p.d),
          adults: p.adults, children: p.children, room: p.room.id,
          website: booking.elements.website.value
        });
        if (res.status === 201 && res.data) {
          setStatus('success', 'Demande n° ', el('strong', {}, res.data.reference), ' enregistrée. Les dates du ' + D.long(p.a) + ' au ' + D.long(p.d) + ' sont bloquées pour vous (' + p.room.name + '), en attente de confirmation : l’établissement vous contactera par email ou téléphone pour confirmer votre réservation.');
          booking.reset();
          bookingDates.set(null, null);
          bookingDates.reset();
          return;
        }
        if (res.status === 409) {
          bookingDates.reset(); await bookingDates.loadMonths();
          markInvalid(booking.elements.arrival, true); markInvalid(booking.elements.departure, true);
          setStatus('error', 'Désolé, ces dates viennent d’être réservées pour cet hébergement. Choisissez d’autres dates ou un autre hébergement.');
          return;
        }
        if (res.status === 400 && res.data && res.data.error) { setStatus('error', res.data.error); return; }
        throw new Error('service indisponible');
      }
      /* Aucun système de réservation connecté : simple demande par email. */
      const link = el('a', { href: mailtoRequest(p) }, 'Ouvrir la demande dans votre messagerie');
      setStatus('info', 'La réservation en ligne n’est pas encore activée : votre demande n’est pas une réservation confirmée. ', link, ' ou appelez le ', el('a', { href: 'tel:' + CFG.contact.phoneLink }, CFG.contact.phoneDisplay), '. L’établissement vous confirmera la disponibilité.');
      link.click();
    } catch (err) {
      const link = el('a', { href: mailtoRequest(p) }, 'envoyez votre demande par email');
      setStatus('error', 'Le service de réservation ne répond pas pour le moment. Aucune réservation n’a été enregistrée : ', link, ' ou appelez le ', el('a', { href: 'tel:' + CFG.contact.phoneLink }, CFG.contact.phoneDisplay), '.');
    } finally {
      sending = false; submit.disabled = false; submit.classList.remove('is-busy');
    }
  });
})();
