// Liste canonique des métiers du bâtiment.
//
// Ces codes sont STABLES : ils sont stockés dans profiles.trades et seront
// réutilisés par les futures fonctionnalités (lots de chantier par métier,
// tableau de bord d'avancement du maître d'œuvre). Ne pas renommer un `code`
// existant — ajouter de nouveaux métiers à la suite si besoin.
//
// Chaque métier appartient à une catégorie (corps d'état) et possède une
// couleur utilisée pour les badges et, plus tard, le suivi d'avancement.

export const TRADE_CATEGORIES = [
  { id: 'gros_oeuvre',   label: 'Gros œuvre',            color: '#b45309' },
  { id: 'second_oeuvre', label: 'Second œuvre',          color: '#2563eb' },
  { id: 'finitions',     label: 'Finitions',             color: '#7c3aed' },
  { id: 'technique',     label: 'Lots techniques (CVC / élec / plomberie)', color: '#0891b2' },
  { id: 'exterieur',     label: 'Aménagements extérieurs', color: '#16a34a' },
  { id: 'encadrement',   label: 'Encadrement & maîtrise d’œuvre', color: '#6b7280' },
  { id: 'specialise',    label: 'Travaux spécialisés',   color: '#dc2626' },
];

export const BUILDING_TRADES = [
  // --- Gros œuvre ---
  { code: 'macon',            label: 'Maçon',                     category: 'gros_oeuvre' },
  { code: 'coffreur',         label: 'Coffreur-bancheur',         category: 'gros_oeuvre' },
  { code: 'terrassier',       label: 'Terrassier',                category: 'gros_oeuvre' },
  { code: 'charpentier_bois', label: 'Charpentier bois',          category: 'gros_oeuvre' },
  { code: 'charpentier_metal',label: 'Charpentier métallique',    category: 'gros_oeuvre' },
  { code: 'couvreur',         label: 'Couvreur',                  category: 'gros_oeuvre' },
  { code: 'etancheur',        label: 'Étancheur',                 category: 'gros_oeuvre' },
  { code: 'tailleur_pierre',  label: 'Tailleur de pierre',        category: 'gros_oeuvre' },
  { code: 'demolisseur',      label: 'Démolisseur',               category: 'gros_oeuvre' },

  // --- Second œuvre ---
  { code: 'platrier',         label: 'Plâtrier',                  category: 'second_oeuvre' },
  { code: 'plaquiste',        label: 'Plaquiste',                 category: 'second_oeuvre' },
  { code: 'menuisier',        label: 'Menuisier',                 category: 'second_oeuvre' },
  { code: 'menuisier_alu',    label: 'Menuisier aluminium / PVC', category: 'second_oeuvre' },
  { code: 'serrurier',        label: 'Serrurier-métallier',       category: 'second_oeuvre' },
  { code: 'vitrier',          label: 'Vitrier-miroitier',         category: 'second_oeuvre' },
  { code: 'isolation',        label: 'Isolation / ITE',           category: 'second_oeuvre' },

  // --- Lots techniques ---
  { code: 'electricien',      label: 'Électricien',               category: 'technique' },
  { code: 'plombier',         label: 'Plombier',                  category: 'technique' },
  { code: 'chauffagiste',     label: 'Chauffagiste',              category: 'technique' },
  { code: 'climaticien',      label: 'Climaticien / Frigoriste',  category: 'technique' },
  { code: 'cvc',              label: 'Génie climatique (CVC)',    category: 'technique' },
  { code: 'domoticien',       label: 'Domoticien',                category: 'technique' },
  { code: 'photovoltaique',   label: 'Installateur photovoltaïque', category: 'technique' },
  { code: 'ascensoriste',     label: 'Ascensoriste',              category: 'technique' },

  // --- Finitions ---
  { code: 'peintre',          label: 'Peintre',                   category: 'finitions' },
  { code: 'carreleur',        label: 'Carreleur',                 category: 'finitions' },
  { code: 'solier',           label: 'Solier-moquettiste',        category: 'finitions' },
  { code: 'facadier',         label: 'Façadier-ravaleur',         category: 'finitions' },
  { code: 'cuisiniste',       label: 'Cuisiniste',                category: 'finitions' },
  { code: 'storiste',         label: 'Storiste',                  category: 'finitions' },

  // --- Aménagements extérieurs ---
  { code: 'paysagiste',       label: 'Paysagiste',                category: 'exterieur' },
  { code: 'vrd',              label: 'Maçon VRD / voirie',        category: 'exterieur' },
  { code: 'piscinier',        label: 'Piscinier',                 category: 'exterieur' },

  // --- Encadrement & maîtrise d'œuvre ---
  { code: 'maitre_oeuvre',    label: 'Maître d’œuvre',       category: 'encadrement' },
  { code: 'architecte',       label: 'Architecte',                category: 'encadrement' },
  { code: 'conducteur_travaux', label: 'Conducteur de travaux',   category: 'encadrement' },
  { code: 'chef_chantier',    label: 'Chef de chantier',          category: 'encadrement' },
  { code: 'economiste',       label: 'Économiste de la construction', category: 'encadrement' },
  { code: 'geometre',         label: 'Géomètre',                  category: 'encadrement' },

  // --- Travaux spécialisés ---
  { code: 'desamianteur',     label: 'Désamianteur',              category: 'specialise' },
  { code: 'grutier',          label: 'Grutier',                   category: 'specialise' },
  { code: 'conducteur_engins',label: 'Conducteur d’engins',  category: 'specialise' },
  { code: 'ferronnier',       label: 'Ferronnier d’art',     category: 'specialise' },
  { code: 'foreur',           label: 'Foreur / fondations spéciales', category: 'specialise' },
];

// Index code -> métier, pour des recherches O(1).
export const TRADE_BY_CODE = BUILDING_TRADES.reduce((acc, t) => {
  acc[t.code] = t;
  return acc;
}, {});

// Index id catégorie -> catégorie.
export const CATEGORY_BY_ID = TRADE_CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

// Libellé lisible d'un code métier (fallback sur le code brut).
export function tradeLabel(code) {
  return TRADE_BY_CODE[code]?.label || code;
}

// Couleur d'un code métier (via sa catégorie ; gris par défaut).
export function tradeColor(code) {
  const cat = TRADE_BY_CODE[code]?.category;
  return CATEGORY_BY_ID[cat]?.color || '#6b7280';
}

// Métiers groupés par catégorie, pour l'affichage en sélecteur.
export function tradesByCategory() {
  return TRADE_CATEGORIES.map((cat) => ({
    ...cat,
    trades: BUILDING_TRADES.filter((t) => t.category === cat.id),
  })).filter((g) => g.trades.length > 0);
}
