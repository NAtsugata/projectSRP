// src/config/checklistTemplates.js
/**
 * Ce fichier centralise tous les modèles de checklists.
 * Pour ajouter une nouvelle checklist, il suffit de créer un nouvel objet
 * sur le modèle existant et de l'ajouter à l'export CHECKLIST_TEMPLATES.
 * L'application l'affichera automatiquement dans le menu de sélection.
 */

// Pose Climatisation
const CLIMATISATION_TEMPLATE = {
  id: 'climatisation-v1',
  title: "Pose Climatisation",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'clim_validation_emplacement', label: "Validation de l'emplacement (unités intérieure et extérieure) avec le client", type: 'checkbox' },
        { id: 'clim_pose_plaque', label: "Pose de la plaque de fixation de l'unité intérieure (niveau)", type: 'checkbox' },
        { id: 'clim_percement_mur', label: "Percement du mur pour le passage des liaisons (avec pente pour les condensats)", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'clim_install_ext', label: "Installation de l'unité extérieure (supports muraux ou dalles antivibratiles)", type: 'checkbox' },
        { id: 'clim_liaisons_frigo', label: "Passage et raccordement des liaisons frigorifiques", type: 'checkbox' },
        { id: 'clim_raccord_elec', label: "Raccordement électrique (intercommunication et alimentation)", type: 'checkbox' },
        { id: 'clim_condensats', label: "Raccordement des évacuations de condensats", type: 'checkbox' },
      ],
    },
    {
      id: 'mise_en_service',
      title: 'Mise en service',
      items: [
        { id: 'clim_tirage_vide', label: "Tirage au vide et contrôle de l'étanchéité (azote si nécessaire)", type: 'checkbox' },
        { id: 'clim_ouverture_vannes', label: "Ouverture des vannes et mise en service", type: 'checkbox' },
        { id: 'clim_test_fonctionnement', label: "Test de fonctionnement (froid/chaud) et explications au client", type: 'checkbox' },
      ],
    },
  ],
};

// Pose Pompe à Chaleur (Air/Eau)
const PAC_AIR_EAU_POSE_TEMPLATE = {
  id: 'pac-air-eau-pose-v1',
  title: "Pose Pompe à Chaleur (Air/Eau)",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'pac_socle', label: "Préparation du socle béton ou des plots pour l'unité extérieure", type: 'checkbox' },
        { id: 'pac_install_ext', label: "Installation de l'unité extérieure (respect des distances murs/voisinage)", type: 'checkbox' },
        { id: 'pac_module_hydro', label: "Installation du module hydraulique intérieur", type: 'checkbox' },
      ],
    },
    {
      id: 'raccordements',
      title: 'Raccordements',
      items: [
        { id: 'pac_liaisons_frigo', label: "Raccordement des liaisons frigorifiques", type: 'checkbox' },
        { id: 'pac_raccord_hydro', label: "Raccordement hydraulique au circuit de chauffage (pose pot à boue, filtre, vannes)", type: 'checkbox' },
        { id: 'pac_raccord_elec', label: "Raccordement électrique (protection disjoncteur différentiel adaptée)", type: 'checkbox' },
      ],
    },
    {
      id: 'mise_en_service',
      title: 'Mise en service',
      items: [
        { id: 'pac_mise_eau', label: "Mise en eau, purge des radiateurs/plancher chauffant et contrôle de la pression", type: 'checkbox' },
        { id: 'pac_parametrage', label: "Mise en service et paramétrage de la régulation (loi d'eau)", type: 'checkbox' },
        { id: 'pac_explication', label: "Explication du thermostat au client", type: 'checkbox' },
      ],
    },
  ],
};

// Modèle pour Pompe à Chaleur Air/Eau - Entretien
const PAC_AIR_EAU_TEMPLATE = {
  id: 'pac-air-eau-v1',
  title: "Checklist d'Entretien PAC Air/Eau",
  sections: [
    {
      id: 'visual',
      title: 'Inspection visuelle',
      items: [
        { id: 'visual_ext_unit', label: "État général de l'unité extérieure", type: 'checkbox' },
        { id: 'visual_int_unit', label: "État général de l'unité intérieure", type: 'checkbox' },
        { id: 'visual_elec_conn', label: "Connexions électriques", type: 'checkbox' },
        { id: 'visual_seal', label: "Étanchéité visuelle", type: 'checkbox' },
        { id: 'visual_noise', label: "Bruits/vibrations anormaux", type: 'checkbox' },
      ],
    },
    {
      id: 'cleaning',
      title: 'Nettoyage',
      items: [
        { id: 'cleaning_exchangers', label: "Échangeurs int/ext", type: 'checkbox' },
        { id: 'cleaning_condensate', label: "Bac à condensats", type: 'checkbox' },
        { id: 'cleaning_filters', label: "Grilles et filtres", type: 'checkbox' },
      ],
    },
    {
      id: 'tech_checks',
      title: 'Contrôles techniques',
      items: [
        { id: 'tech_expansion_vessel', label: "Vase d'expansion", type: 'checkbox' },
        { id: 'tech_hydraulic_pressure', label: "Pression hydraulique", type: 'checkbox' },
        { id: 'tech_circulators', label: "Circulateurs", type: 'checkbox' },
        { id: 'tech_temp_probes', label: "Sondes température", type: 'checkbox' },
        { id: 'tech_safeties', label: "Sécurités (pression, débit...)", type: 'checkbox' },
      ],
    },
    {
      id: 'performance_test',
      title: 'Test de performance',
      items: [
        { id: 'perf_in_out_temp', label: "Température entrée/sortie", type: 'text' },
        { id: 'perf_compressor_intensity', label: "Intensité compresseur", type: 'text' },
        { id: 'perf_water_flow', label: "Débit d'eau", type: 'text' },
        { id: 'perf_instant_cop', label: "COP instantané", type: 'text' },
      ],
    },
    {
      id: 'conclusion',
      title: 'Conclusion',
      items: [
        { id: 'conclusion_report_given', label: "Rapport remis au client", type: 'checkbox' },
        { id: 'conclusion_anomalies', label: "Anomalies détectées", type: 'checkbox' },
        { id: 'conclusion_remarks', label: "Remarques & Recommandations", type: 'textarea' },
      ],
    },
  ],
};

// Pose Douche
const DOUCHE_TEMPLATE = {
  id: 'douche-v1',
  title: "Pose Douche",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'douche_verif_arrivees', label: "Vérification des arrivées d'eau et de la pente d'évacuation", type: 'checkbox' },
        { id: 'douche_decaissement', label: "Décaissement ou préparation du sol (si douche à l'italienne)", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'douche_pose_receveur', label: "Pose du receveur de douche (niveau et calage)", type: 'checkbox' },
        { id: 'douche_raccord_bonde', label: "Raccordement de la bonde et test d'étanchéité immédiat", type: 'checkbox' },
        { id: 'douche_etancheite', label: "Application du kit d'étanchéité sous carrelage (SPEC) sur les murs", type: 'checkbox' },
        { id: 'douche_robinetterie', label: "Pose de la robinetterie (mitigeur, colonne)", type: 'checkbox' },
        { id: 'douche_paroi', label: "Installation de la paroi de douche", type: 'checkbox' },
      ],
    },
    {
      id: 'finitions',
      title: 'Finitions',
      items: [
        { id: 'douche_joints', label: "Réalisation des joints silicone de finition", type: 'checkbox' },
        { id: 'douche_notes', label: "Notes pour le client", type: 'textarea' },
      ],
    },
  ],
};

// Pose Salle de Bains Complète
const SALLE_DE_BAINS_TEMPLATE = {
  id: 'salle-de-bains-v1',
  title: "Pose Salle de Bains Complète",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'sdb_coupure_eau', label: "Coupure d'eau générale et vidange des circuits", type: 'checkbox' },
        { id: 'sdb_depose', label: "Dépose des anciens équipements (si rénovation)", type: 'checkbox' },
        { id: 'sdb_modif_arrivees', label: "Modification des arrivées d'eau et évacuations selon le nouveau plan", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'sdb_douche_baignoire', label: "Pose de la baignoire ou de la douche (voir liste spécifique)", type: 'checkbox' },
        { id: 'sdb_meuble_vasque', label: "Installation du meuble vasque (niveau, fixation murale)", type: 'checkbox' },
        { id: 'sdb_miroir_luminaires', label: "Pose du miroir et des luminaires (respect des volumes électriques)", type: 'checkbox' },
        { id: 'sdb_wc', label: "Pose des WC (voir liste spécifique)", type: 'checkbox' },
      ],
    },
    {
      id: 'finitions',
      title: 'Finitions',
      items: [
        { id: 'sdb_raccordements', label: "Raccordements finaux de toute la robinetterie", type: 'checkbox' },
        { id: 'sdb_joints', label: "Joints silicone périphériques (sanitaires et meubles)", type: 'checkbox' },
        { id: 'sdb_mise_eau', label: "Mise en eau et contrôle de l'absence de fuites", type: 'checkbox' },
      ],
    },
  ],
};

// Installation Lavabo / Vasque
const LAVABO_TEMPLATE = {
  id: 'lavabo-v1',
  title: "Installation Lavabo / Vasque",
  sections: [
    {
      id: 'fixation',
      title: 'Fixation',
      items: [
        { id: 'lavabo_reperage', label: "Repérage et perçage des fixations (hauteur standard 85-90 cm)", type: 'checkbox' },
        { id: 'lavabo_equerres', label: "Pose des équerres ou fixation du meuble sous-vasque", type: 'checkbox' },
      ],
    },
    {
      id: 'montage',
      title: 'Montage',
      items: [
        { id: 'lavabo_robinetterie', label: "Montage de la robinetterie sur le lavabo (flexibles et joints)", type: 'checkbox' },
        { id: 'lavabo_bonde', label: "Pose de la bonde et du système de vidage", type: 'checkbox' },
        { id: 'lavabo_fixation', label: "Fixation du lavabo au mur ou sur le meuble", type: 'checkbox' },
      ],
    },
    {
      id: 'raccordements',
      title: 'Raccordements',
      items: [
        { id: 'lavabo_flexibles', label: "Raccordement des flexibles aux arrivées d'eau (eau chaude à gauche)", type: 'checkbox' },
        { id: 'lavabo_siphon', label: "Pose du siphon et raccordement à l'évacuation PVC", type: 'checkbox' },
        { id: 'lavabo_test', label: "Test d'écoulement et joint silicone contre le mur", type: 'checkbox' },
      ],
    },
  ],
};

// Installation WC (Classique ou Suspendu)
const WC_TEMPLATE = {
  id: 'wc-v1',
  title: "Installation WC (Classique ou Suspendu)",
  sections: [
    {
      id: 'wc_poser',
      title: 'WC à poser',
      items: [
        { id: 'wc_pose_cuvette', label: "Pose de la cuvette et marquage des trous de fixation au sol", type: 'checkbox' },
        { id: 'wc_raccord_evac', label: "Raccordement à l'évacuation (pipe droite ou coudée)", type: 'checkbox' },
        { id: 'wc_fixation_sol', label: "Fixation de la cuvette au sol (vis + cache-vis)", type: 'checkbox' },
        { id: 'wc_montage_reservoir', label: "Montage du réservoir et du mécanisme de chasse", type: 'checkbox' },
        { id: 'wc_raccord_robinet', label: "Raccordement au robinet d'arrêt", type: 'checkbox' },
        { id: 'wc_abattant', label: "Pose de l'abattant", type: 'checkbox' },
      ],
    },
    {
      id: 'wc_suspendu',
      title: 'WC Suspendu (Bâti-support)',
      items: [
        { id: 'wcs_fixation_bati', label: "Fixation du bâti au sol et au mur (réglage hauteur et niveau)", type: 'checkbox' },
        { id: 'wcs_raccord_reservoir', label: "Raccordement évacuation et arrivée d'eau dans le réservoir", type: 'checkbox' },
        { id: 'wcs_habillage', label: "Habillage du bâti (placo, carrelage)", type: 'checkbox' },
        { id: 'wcs_pose_cuvette', label: "Pose de la cuvette et de la plaque de commande", type: 'checkbox' },
        { id: 'wcs_finitions', label: "Joint silicone et pose de l'abattant", type: 'checkbox' },
      ],
    },
  ],
};

// Pose Chauffe-eau (Cumulus)
const CHAUFFE_EAU_TEMPLATE = {
  id: 'chauffe-eau-v1',
  title: "Pose Chauffe-eau (Cumulus)",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'ce_vidange', label: "Vidange et dépose de l'ancien chauffe-eau (si rénovation)", type: 'checkbox' },
        { id: 'ce_fixation', label: "Fixation solide au mur (scellement chimique si mur creux) ou pose sur trépied", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'ce_groupe_secu', label: "Installation du groupe de sécurité neuf sur l'entrée d'eau froide (avec joint filasse/téflon)", type: 'checkbox' },
        { id: 'ce_evac_groupe', label: "Raccordement de l'évacuation du groupe de sécurité au siphon", type: 'checkbox' },
        { id: 'ce_raccord_ec', label: "Raccordement eau chaude avec raccord diélectrique (obligatoire)", type: 'checkbox' },
        { id: 'ce_raccord_elec', label: "Raccordement électrique (vérification du contacteur jour/nuit)", type: 'checkbox' },
      ],
    },
    {
      id: 'mise_en_service',
      title: 'Mise en service',
      items: [
        { id: 'ce_remplissage', label: "Remplissage de la cuve (ouvrir un robinet d'eau chaude pour chasser l'air)", type: 'checkbox' },
        { id: 'ce_verif_etancheite', label: "Vérification de l'étanchéité une fois sous pression", type: 'checkbox' },
      ],
    },
  ],
};

// Entretien Chaudière Gaz (Visite annuelle)
const ENTRETIEN_CHAUDIERE_TEMPLATE = {
  id: 'entretien-chaudiere-v1',
  title: "Entretien Chaudière Gaz (Visite annuelle)",
  sections: [
    {
      id: 'nettoyage',
      title: 'Nettoyage',
      items: [
        { id: 'ech_corps_chauffe', label: "Nettoyage du corps de chauffe et du brûleur", type: 'checkbox' },
        { id: 'ech_siphon', label: "Nettoyage du siphon des condensats (si condensation)", type: 'checkbox' },
      ],
    },
    {
      id: 'controles',
      title: 'Contrôles',
      items: [
        { id: 'ech_vase', label: "Vérification et gonflage du vase d'expansion (si nécessaire)", type: 'checkbox' },
        { id: 'ech_circulateur', label: "Contrôle du circulateur (pompe) et de la vanne 3 voies", type: 'checkbox' },
        { id: 'ech_securites', label: "Vérification des organes de sécurité (thermocouple, surchauffe)", type: 'checkbox' },
        { id: 'ech_etancheite', label: "Vérification de l'étanchéité du circuit gaz et eau", type: 'checkbox' },
        { id: 'ech_purge', label: "Purge des radiateurs si besoin", type: 'checkbox' },
      ],
    },
    {
      id: 'mesures',
      title: 'Mesures et analyses',
      items: [
        { id: 'ech_co', label: "Mesure du taux de CO (Monoxyde de Carbone) dans l'air ambiant", type: 'checkbox' },
        { id: 'ech_combustion', label: "Analyse de combustion (impression du ticket)", type: 'checkbox' },
      ],
    },
    {
      id: 'conclusion',
      title: 'Conclusion',
      items: [
        { id: 'ech_attestation', label: "Remise de l'attestation d'entretien au client", type: 'checkbox' },
        { id: 'ech_remarques', label: "Remarques et recommandations", type: 'textarea' },
      ],
    },
  ],
};

// Remplacement / Pose Radiateur
const RADIATEUR_TEMPLATE = {
  id: 'radiateur-v1',
  title: "Remplacement / Pose Radiateur",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'rad_vidange', label: "Vidange du circuit de chauffage (au moins la boucle concernée)", type: 'checkbox' },
        { id: 'rad_depose', label: "Dépose de l'ancien radiateur et rebouchage des trous si nécessaire", type: 'checkbox' },
        { id: 'rad_tracage', label: "Tracé et perçage pour les nouvelles fixations (niveau, solidité du mur)", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'rad_robinet', label: "Pose du robinet (thermostatique ou manuel) et du té de réglage neuf", type: 'checkbox' },
        { id: 'rad_bouchons', label: "Montage du bouchon de purge et du bouchon plein (jointasse/filasse)", type: 'checkbox' },
        { id: 'rad_raccordement', label: "Raccordement aux tuyaux existants (cuivre, multicouche ou PER)", type: 'checkbox' },
      ],
    },
    {
      id: 'mise_en_service',
      title: 'Mise en service',
      items: [
        { id: 'rad_mise_eau', label: "Mise en eau progressive et purge de l'air", type: 'checkbox' },
        { id: 'rad_equilibrage', label: "Équilibrage du radiateur (via le té de réglage)", type: 'checkbox' },
        { id: 'rad_verif_chauffe', label: "Vérification de la chauffe homogène", type: 'checkbox' },
      ],
    },
  ],
};

// Pose Adoucisseur d'eau
const ADOUCISSEUR_TEMPLATE = {
  id: 'adoucisseur-v1',
  title: "Pose Adoucisseur d'eau",
  sections: [
    {
      id: 'preparation',
      title: 'Préparation',
      items: [
        { id: 'adou_test_th', label: "Test de dureté de l'eau (TH) avant installation", type: 'checkbox' },
        { id: 'adou_bypass', label: "Installation du By-pass (pour isoler l'appareil si besoin)", type: 'checkbox' },
        { id: 'adou_prefiltre', label: "Pose du pré-filtre à sédiments en amont", type: 'checkbox' },
      ],
    },
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'adou_raccord_eau', label: "Raccordement entrée/sortie d'eau (attention au sens de circulation)", type: 'checkbox' },
        { id: 'adou_raccord_egout', label: "Raccordement à l'égout pour la régénération (avec rupture de charge/garde d'air)", type: 'checkbox' },
      ],
    },
    {
      id: 'mise_en_service',
      title: 'Mise en service',
      items: [
        { id: 'adou_remplissage', label: "Mise en service : remplissage du bac à sel et d'eau", type: 'checkbox' },
        { id: 'adou_regeneration', label: "Lancement d'une régénération manuelle de test", type: 'checkbox' },
        { id: 'adou_reglage', label: "Réglage de la dureté résiduelle (TH de sortie) et test final", type: 'checkbox' },
      ],
    },
  ],
};

// Pose Évier Cuisine & Raccordements
const EVIER_TEMPLATE = {
  id: 'evier-v1',
  title: "Pose Évier Cuisine & Raccordements",
  sections: [
    {
      id: 'installation',
      title: 'Installation',
      items: [
        { id: 'evier_decoupe', label: "Découpe du plan de travail (si encastré) et joint d'étanchéité", type: 'checkbox' },
        { id: 'evier_fixation', label: "Fixation de l'évier (pattes de serrage)", type: 'checkbox' },
        { id: 'evier_percage', label: "Perçage pour le mitigeur (si non pré-percé)", type: 'checkbox' },
      ],
    },
    {
      id: 'raccordements',
      title: 'Raccordements',
      items: [
        { id: 'evier_robinetterie', label: "Pose de la robinetterie et raccordement eau chaude/froide", type: 'checkbox' },
        { id: 'evier_vidage', label: "Montage du système de vidage (bonde, trop-plein, siphon)", type: 'checkbox' },
        { id: 'evier_siphon', label: "Raccordement du siphon à l'évacuation PVC (colle ou joints)", type: 'checkbox' },
        { id: 'evier_lv', label: "Raccordement alimentation/évacuation Lave-Vaisselle", type: 'checkbox' },
      ],
    },
    {
      id: 'verification',
      title: 'Vérification',
      items: [
        { id: 'evier_test', label: "Test d'étanchéité remplissage cuve + vidange rapide", type: 'checkbox' },
      ],
    },
  ],
};

// Recherche de Fuite (Dépannage)
const RECHERCHE_FUITE_TEMPLATE = {
  id: 'recherche-fuite-v1',
  title: "Recherche de Fuite (Dépannage)",
  sections: [
    {
      id: 'diagnostic',
      title: 'Diagnostic',
      items: [
        { id: 'fuite_releve', label: "Relevé du compteur d'eau (fermeture de tous les robinets)", type: 'checkbox' },
        { id: 'fuite_visuel', label: "Contrôle visuel des groupes de sécurité, chasses d'eau et robinets", type: 'checkbox' },
        { id: 'fuite_pression', label: "Test de pression (manomètre) sur circuit eau froide / eau chaude", type: 'checkbox' },
        { id: 'fuite_evacuations', label: "Inspection des évacuations (siphons, joints pipe WC)", type: 'checkbox' },
      ],
    },
    {
      id: 'detection',
      title: 'Détection',
      items: [
        { id: 'fuite_camera', label: "Utilisation caméra thermique ou détecteur acoustique (si encastré)", type: 'checkbox' },
        { id: 'fuite_localisation', label: "Localisation précise et marquage pour réparation", type: 'checkbox' },
      ],
    },
    {
      id: 'rapport',
      title: 'Rapport',
      items: [
        { id: 'fuite_rapport', label: "Rédaction du rapport pour l'assurance (si requis)", type: 'checkbox' },
        { id: 'fuite_notes', label: "Notes et recommandations", type: 'textarea' },
      ],
    },
  ],
};

// Débouchage / Dégorgement
const DEBOUCHAGE_TEMPLATE = {
  id: 'debouchage-v1',
  title: "Débouchage / Dégorgement",
  sections: [
    {
      id: 'diagnostic',
      title: 'Diagnostic',
      items: [
        { id: 'deb_localisation', label: "Localisation du bouchon (écoulement lent ou bloqué ?)", type: 'checkbox' },
        { id: 'deb_protection', label: "Protection de la zone de travail (bâches)", type: 'checkbox' },
      ],
    },
    {
      id: 'intervention',
      title: 'Intervention',
      items: [
        { id: 'deb_siphon', label: "Démontage du siphon (nettoyage manuel)", type: 'checkbox' },
        { id: 'deb_furet', label: "Passage du furet (manuel ou électrique) ou pompe à pression", type: 'checkbox' },
        { id: 'deb_camera', label: "Si nécessaire : passage caméra pour vérifier l'état de la canalisation", type: 'checkbox' },
      ],
    },
    {
      id: 'verification',
      title: 'Vérification',
      items: [
        { id: 'deb_test', label: "Test d'écoulement à grand débit (plusieurs chasses d'eau)", type: 'checkbox' },
        { id: 'deb_nettoyage', label: "Nettoyage et désinfection de la zone d'intervention", type: 'checkbox' },
      ],
    },
  ],
};

// Fin de Chantier (Qualité & Client)
const FIN_CHANTIER_TEMPLATE = {
  id: 'fin-chantier-v1',
  title: "Fin de Chantier (Qualité & Client)",
  sections: [
    {
      id: 'nettoyage',
      title: 'Nettoyage',
      items: [
        { id: 'fin_outils', label: "Ramassage de tous les outils et déchets", type: 'checkbox' },
        { id: 'fin_traces', label: "Nettoyage des traces (doigts, plâtre, poussière) sur les équipements posés", type: 'checkbox' },
      ],
    },
    {
      id: 'client',
      title: 'Communication client',
      items: [
        { id: 'fin_explication', label: "Explication du fonctionnement au client (thermostat, robinets, entretien)", type: 'checkbox' },
        { id: 'fin_notices', label: "Remise des notices techniques et garanties", type: 'checkbox' },
      ],
    },
    {
      id: 'documentation',
      title: 'Documentation',
      items: [
        { id: 'fin_photos', label: "Prise de photos du chantier fini (pour dossier client/site web)", type: 'checkbox' },
        { id: 'fin_signature', label: "Signature du bon d'intervention ou de réception de travaux", type: 'checkbox' },
      ],
    },
  ],
};


// Export centralisé de toutes les checklists disponibles
export const CHECKLIST_TEMPLATES = {
  // Installation / Pose
  [CLIMATISATION_TEMPLATE.id]: CLIMATISATION_TEMPLATE,
  [PAC_AIR_EAU_POSE_TEMPLATE.id]: PAC_AIR_EAU_POSE_TEMPLATE,
  [DOUCHE_TEMPLATE.id]: DOUCHE_TEMPLATE,
  [SALLE_DE_BAINS_TEMPLATE.id]: SALLE_DE_BAINS_TEMPLATE,
  [LAVABO_TEMPLATE.id]: LAVABO_TEMPLATE,
  [WC_TEMPLATE.id]: WC_TEMPLATE,
  [CHAUFFE_EAU_TEMPLATE.id]: CHAUFFE_EAU_TEMPLATE,
  [RADIATEUR_TEMPLATE.id]: RADIATEUR_TEMPLATE,
  [ADOUCISSEUR_TEMPLATE.id]: ADOUCISSEUR_TEMPLATE,
  [EVIER_TEMPLATE.id]: EVIER_TEMPLATE,

  // Entretien
  [PAC_AIR_EAU_TEMPLATE.id]: PAC_AIR_EAU_TEMPLATE,
  [ENTRETIEN_CHAUDIERE_TEMPLATE.id]: ENTRETIEN_CHAUDIERE_TEMPLATE,

  // Dépannage
  [RECHERCHE_FUITE_TEMPLATE.id]: RECHERCHE_FUITE_TEMPLATE,
  [DEBOUCHAGE_TEMPLATE.id]: DEBOUCHAGE_TEMPLATE,

  // Fin de chantier
  [FIN_CHANTIER_TEMPLATE.id]: FIN_CHANTIER_TEMPLATE,
};
