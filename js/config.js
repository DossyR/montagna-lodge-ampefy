/* =====================================================================
   MONTAGNA LODGE AMPEFY — Configuration du site
   ---------------------------------------------------------------------
   C'est le SEUL fichier à modifier pour changer les coordonnées,
   les hébergements, les prix ou activer le système de réservation.
   ===================================================================== */
window.LODGE_CONFIG = {
  name: 'Montagna Lodge',
  location: 'Ampefy',

  contact: {
    phoneDisplay: '034 27 56 24',
    phoneLink: '+26134275624',
    email: 'montagnalodge.ampefy@gmail.com',
    address: 'Ampefy, Itasy, Madagascar'
  },

  /* Liens des réseaux sociaux : renseignez les adresses complètes.
     Tant qu'un lien est vide, l'icône reste affichée mais n'est pas cliquable. */
  socials: {
    facebook: '',
    instagram: '',
    tripadvisor: ''
  },

  /* Hébergements. L'identifiant (id) doit correspondre à celui de la base
     de données (db/schema.sql). maxGuests = adultes + enfants maximum. */
  rooms: [
    { id: 'suite-lac', name: 'Suite Vue sur le Lac', priceAr: 250000, maxGuests: 4 },
    { id: 'standard',  name: 'Chambre Standard',     priceAr: 150000, maxGuests: 2 },
    { id: 'villa',     name: 'Villa Familiale',      priceAr: 350000, maxGuests: 6 }
  ],

  booking: {
    /* 'auto' : le site détecte tout seul si le système de réservation
                (Cloudflare Functions + base D1) est installé.
       'off'  : désactive toute vérification en ligne (demandes par email). */
    mode: 'auto',
    apiBase: '/api',
    maxNights: 30,          // durée maximale d'un séjour
    maxMonthsAhead: 18      // réservation possible jusqu'à 18 mois à l'avance
  }
};
