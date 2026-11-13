/* =====================================================================
   Service de réservation — couche d'accès aux données.
   Toute la communication avec la base de réservations passe ici.
   L'API correspondante se trouve dans functions/api/[[path]].js
   (Cloudflare Pages Functions + base D1). Pour brancher un autre
   système (PHP/MySQL, Supabase…), il suffit de garder les mêmes
   réponses JSON ou d'adapter ce fichier.
   ===================================================================== */
(function () {
  const cfg = window.LODGE_CONFIG.booking;
  let statusPromise = null;

  async function request(path, options = {}, timeout = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(cfg.apiBase + path, {
        ...options,
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* réponse non JSON */ }
      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  const Booking = {
    /** true si le système de réservation est installé ET configuré. */
    isLive() {
      if (cfg.mode === 'off' || location.protocol === 'file:') return Promise.resolve(false);
      if (!statusPromise) {
        statusPromise = request('/health', {}, 5000)
          .then(r => !!(r.ok && r.data && r.data.configured === true))
          .catch(() => false);
      }
      return statusPromise;
    },

    /** Disponibilités de tous les hébergements pour un séjour.
        -> { rooms: [{ id, available, unitsLeft, reason }] } */
    async checkAvailability({ arrival, departure, adults, children }) {
      const q = new URLSearchParams({ arrival, departure, adults, children });
      const r = await request('/availability?' + q);
      if (!r.ok) throw Object.assign(new Error((r.data && r.data.error) || 'Erreur serveur'), { status: r.status });
      return r.data;
    },

    /** Nuits complètes d'un hébergement entre deux dates ISO -> ['AAAA-MM-JJ', …] */
    async unavailableNights(roomId, from, to) {
      const q = new URLSearchParams({ room: roomId, from, to });
      const r = await request('/calendar?' + q);
      if (!r.ok) return [];
      return (r.data && r.data.unavailable) || [];
    },

    /** Enregistre une demande de réservation (dates bloquées côté serveur,
        statut « en attente de confirmation »). Renvoie { ok, status, data }. */
    createReservation(payload) {
      return request('/reservations', { method: 'POST', body: JSON.stringify(payload) }, 15000);
    }
  };

  window.LodgeBooking = Booking;
})();
