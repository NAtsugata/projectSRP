// Modèles de lots de chantier par type de travaux.
//
// Chaque modèle est un ensemble de lots pré-remplis (métier + intitulé) que le
// maître d'œuvre / admin peut créer en un clic sur un chantier. Les trade_code
// correspondent à src/constants/buildingTrades.js. Purement frontend : la
// création réutilise le même flux qu'un lot saisi à la main.

export const CHANTIER_TEMPLATES = [
  {
    id: 'reno_sdb',
    label: 'Rénovation salle de bain',
    icon: '🚿',
    lots: [
      { trade_code: 'plombier',    title: 'Alimentation eau + évacuations' },
      { trade_code: 'electricien', title: 'Éclairage, prises et sèche-serviette' },
      { trade_code: 'platrier',    title: 'Doublage / cloisons hydrofuges' },
      { trade_code: 'carreleur',   title: 'Faïence murale et carrelage sol' },
      { trade_code: 'peintre',     title: 'Mise en peinture' },
    ],
  },
  {
    id: 'reno_cuisine',
    label: 'Rénovation cuisine',
    icon: '🍳',
    lots: [
      { trade_code: 'plombier',    title: 'Alimentation évier / lave-vaisselle' },
      { trade_code: 'electricien', title: 'Circuits électroménager + prises plan de travail' },
      { trade_code: 'carreleur',   title: 'Crédence et carrelage sol' },
      { trade_code: 'menuisier',   title: 'Pose meubles et plan de travail' },
      { trade_code: 'peintre',     title: 'Peinture murs et plafond' },
    ],
  },
  {
    id: 'reno_appart',
    label: 'Rénovation complète appartement',
    icon: '🏠',
    lots: [
      { trade_code: 'platrier',    title: 'Cloisons et plafonds' },
      { trade_code: 'electricien', title: 'Mise aux normes électrique' },
      { trade_code: 'plombier',    title: 'Réseaux eau et évacuations' },
      { trade_code: 'menuisier',   title: 'Portes, placards et parquet' },
      { trade_code: 'carreleur',   title: 'Carrelage pièces humides' },
      { trade_code: 'peintre',     title: 'Peinture et finitions' },
    ],
  },
  {
    id: 'construction_neuve',
    label: 'Construction neuve (gros œuvre)',
    icon: '🧱',
    lots: [
      { trade_code: 'terrassier',       title: 'Terrassement et fondations' },
      { trade_code: 'macon',            title: 'Élévation des murs' },
      { trade_code: 'charpentier_bois', title: 'Charpente' },
      { trade_code: 'couvreur',         title: 'Couverture' },
      { trade_code: 'etancheur',        title: 'Étanchéité' },
    ],
  },
  {
    id: 'extension',
    label: 'Extension / surélévation',
    icon: '🏗️',
    lots: [
      { trade_code: 'macon',            title: 'Maçonnerie extension' },
      { trade_code: 'charpentier_bois', title: 'Charpente et ossature' },
      { trade_code: 'couvreur',         title: 'Couverture' },
      { trade_code: 'menuisier_alu',    title: 'Menuiseries extérieures' },
      { trade_code: 'electricien',      title: 'Réseau électrique' },
      { trade_code: 'platrier',         title: 'Cloisons et isolation intérieure' },
    ],
  },
  {
    id: 'toiture',
    label: 'Toiture / couverture',
    icon: '🏚️',
    lots: [
      { trade_code: 'charpentier_bois', title: 'Reprise / pose charpente' },
      { trade_code: 'couvreur',         title: 'Couverture et zinguerie' },
      { trade_code: 'etancheur',        title: 'Étanchéité et isolation toiture' },
    ],
  },
  {
    id: 'elec_normes',
    label: 'Mise aux normes électrique',
    icon: '⚡',
    lots: [
      { trade_code: 'electricien', title: 'Remplacement tableau électrique' },
      { trade_code: 'electricien', title: 'Réfection circuits et prises' },
      { trade_code: 'electricien', title: 'Mise à la terre et différentiels' },
    ],
  },
  {
    id: 'ite',
    label: 'Isolation thermique extérieure',
    icon: '🌡️',
    lots: [
      { trade_code: 'isolation',     title: 'Pose isolant ITE' },
      { trade_code: 'facadier',      title: 'Enduit de façade et finitions' },
      { trade_code: 'menuisier_alu', title: 'Remplacement menuiseries' },
    ],
  },
  {
    id: 'amenagement_ext',
    label: 'Aménagement extérieur',
    icon: '🌳',
    lots: [
      { trade_code: 'vrd',         title: 'Terrassement et VRD' },
      { trade_code: 'macon',       title: 'Terrasse et murets' },
      { trade_code: 'electricien', title: 'Éclairage extérieur' },
      { trade_code: 'paysagiste',  title: 'Plantations et engazonnement' },
    ],
  },
];
