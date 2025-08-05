// src/config/checklistTemplates.js
/**
 * Ce fichier centralise tous les modèles de checklists.
 * Pour ajouter une nouvelle checklist (ex: "Chauffage"), il suffit de créer un nouvel objet
 * sur le modèle de PAC_AIR_EAU_TEMPLATE et de l'ajouter à l'export CHECKLIST_TEMPLATES.
 * L'application l'affichera automatiquement dans le menu de sélection.
 */

// Modèle pour Pompe à Chaleur Air/Eau
const PAC_AIR_EAU_TEMPLATE = {
  id: 'pac-air-eau-v1',
  title: "Checklist d'Entretien PAC Air/Eau",
  sections: [
    {
      id: 'visual',
      title: 'Inspection visuelle',
      items: [
        { id: 'visual_ext_unit', label: 'État général de l’unité extérieure', type: 'checkbox' },
        { id: 'visual_int_unit', label: 'État général de l’unité intérieure', type: 'checkbox' },
        { id: 'visual_elec_conn', label: 'Connexions électriques', type: 'checkbox' },
        { id: 'visual_seal', label: 'Étanchéité visuelle', type: 'checkbox' },
        { id: 'visual_noise', label: 'Bruits/vibrations anormaux', type: 'checkbox' },
      ],
    },
    {
      id: 'cleaning',
      title: 'Nettoyage',
      items: [
        { id: 'cleaning_exchangers', label: 'Échangeurs int/ext', type: 'checkbox' },
        { id: 'cleaning_condensate', label: 'Bac à condensats', type: 'checkbox' },
        { id: 'cleaning_filters', label: 'Grilles et filtres', type: 'checkbox' },
      ],
    },
    {
      id: 'tech_checks',
      title: 'Contrôles techniques',
      items: [
        { id: 'tech_expansion_vessel', label: 'Vase d’expansion', type: 'checkbox' },
        { id: 'tech_hydraulic_pressure', label: 'Pression hydraulique', type: 'checkbox' },
        { id: 'tech_circulators', label: 'Circulateurs', type: 'checkbox' },
        { id: 'tech_temp_probes', label: 'Sondes température', type: 'checkbox' },
        { id: 'tech_safeties', label: 'Sécurités (pression, débit...)', type: 'checkbox' },
      ],
    },
    {
      id: 'performance_test',
      title: 'Test de performance',
      items: [
        { id: 'perf_in_out_temp', label: 'Température entrée/sortie', type: 'text' },
        { id: 'perf_compressor_intensity', label: 'Intensité compresseur', type: 'text' },
        { id: 'perf_water_flow', label: 'Débit d’eau', type: 'text' },
        { id: 'perf_instant_cop', label: 'COP instantané', type: 'text' },
      ],
    },
    {
      id: 'conclusion',
      title: 'Conclusion',
      items: [
        { id: 'conclusion_report_given', label: 'Rapport remis au client', type: 'checkbox' },
        { id: 'conclusion_anomalies', label: 'Anomalies détectées', type: 'checkbox' },
        { id: 'conclusion_remarks', label: 'Remarques & Recommandations', type: 'textarea' },
      ],
    },
  ],
};

// Modèle pour une future checklist "Douche" (exemple d'extensibilité)
const DOUCHE_TEMPLATE = {
    id: 'douche-v1',
    title: "Checklist d'Installation Douche",
    sections: [
      {
        id: 'preparation',
        title: 'Préparation et Plomberie',
        items: [
          { id: 'prep_zone', label: 'Zone de travail propre et protégée', type: 'checkbox' },
          { id: 'prep_water_cut', label: 'Arrivée d\'eau coupée et purgée', type: 'checkbox' },
          { id: 'prep_evacuation', label: 'Conformité de l\'évacuation (pente, diamètre)', type: 'checkbox' },
        ],
      },
      {
        id: 'installation',
        title: 'Installation et Étanchéité',
        items: [
          { id: 'install_receiver', label: 'Receveur de douche posé et de niveau', type: 'checkbox' },
          { id: 'install_sealing', label: 'Étanchéité périphérique réalisée (bandes, SEL)', type: 'checkbox' },
          { id: 'install_faucet', label: 'Robinetterie installée et raccordée', type: 'checkbox' },
          { id: 'install_walls', label: 'Parois de douche montées et fixées', type: 'checkbox' },
        ],
      },
      {
        id: 'verification',
        title: 'Vérification et Finitions',
        items: [
            { id: 'verif_leaks', label: 'Test d\'étanchéité des raccords (sans fuite)', type: 'checkbox' },
            { id: 'verif_flow', label: 'Test d\'écoulement de l\'eau', type: 'checkbox' },
            { id: 'verif_silicone', label: 'Joints silicone de finition appliqués', type: 'checkbox' },
            { id: 'verif_cleaning', label: 'Nettoyage final du chantier', type: 'checkbox' },
            { id: 'verif_notes', label: 'Notes pour le client', type: 'textarea' },
        ]
      }
    ],
};


// Export centralisé de toutes les checklists disponibles
export const CHECKLIST_TEMPLATES = {
  [PAC_AIR_EAU_TEMPLATE.id]: PAC_AIR_EAU_TEMPLATE,
  [DOUCHE_TEMPLATE.id]: DOUCHE_TEMPLATE,
  // Ajoutez ici vos futures checklists, par exemple :
  // [CHAUFFAGE_TEMPLATE.id]: CHAUFFAGE_TEMPLATE,
};
