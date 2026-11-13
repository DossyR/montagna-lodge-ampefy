/* Outils de dates (sans fuseau horaire : on manipule des jours calendaires). */
(function () {
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
  const pad = n => String(n).padStart(2, '0');

  const D = {
    MONTHS, DAYS,
    today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); },
    addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; },
    addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); },
    same(a, b) { return !!a && !!b && a.getTime() === b.getTime(); },
    /** Date -> "JJ/MM/AAAA" */
    toFr(d) { return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; },
    /** Date -> "AAAA-MM-JJ" (format échangé avec le serveur) */
    toIso(d) { return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; },
    fromIso(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
    /** "JJ/MM/AAAA" (ou JJ-MM-AAAA, JJ.MM.AAAA) -> Date | null si invalide */
    parseFr(s) {
      const m = /^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*$/.exec(s || '');
      if (!m) return null;
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
    },
    nights(a, b) { return Math.round((b - a) / 86400000); },
    long(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); },
    formatAr(n) { return n.toLocaleString('fr-FR').replace(/ | /g, ' '); }
  };
  window.LodgeDates = D;
})();
