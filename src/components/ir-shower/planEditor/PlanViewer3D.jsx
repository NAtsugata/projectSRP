// src/components/ir-shower/planEditor/PlanViewer3D.jsx
// Viewer 3D du plan : extrude la pièce et les éléments en 3D avec Three.js.

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ELEMENT_CATALOG } from '../../../lib/planElements';
import './PlanViewer3D.css';

function cmToM(cm) { return cm / 100; }

// ── Compound 3D element builder ──────────────────────────────────────────────
// Convention : dans le repère local du groupe, -Z = arrière (mur), +Z = avant (pièce).
// La rotation 2D (el.rotation) est appliquée comme rotation Y sur le groupe entier.
function buildElementGroup(el, def) {
  const group = new THREE.Group();

  // Dimensions originales (pas de swap) — la rotation est appliquée au groupe
  const w = cmToM(el.width);
  const d = cmToM(el.depth);
  const elH = cmToM(el.height);

  const mainColor = new THREE.Color(def.color);
  const isTransp = def.opacity != null && def.opacity < 1;

  const mats = {
    main:   () => new THREE.MeshStandardMaterial({ color: mainColor, opacity: def.opacity ?? 1, transparent: isTransp, roughness: isTransp ? 0.1 : 0.72, metalness: 0.04 }),
    white:  () => new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.82 }),
    light:  () => new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 }),
    chrome: () => new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.12, metalness: 0.92 }),
    dark:   () => new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.80 }),
    glass:  () => new THREE.MeshStandardMaterial({ color: 0xbfdbfe, opacity: 0.28, transparent: true, roughness: 0.05, metalness: 0.10 }),
    mirror: () => new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.02, metalness: 0.95 }),
    wood:   () => new THREE.MeshStandardMaterial({ color: 0xc08040, roughness: 0.85 }),
  };

  // add(geo, mat, x, y, z, rx, ry, rz)
  function add(geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const PI2 = Math.PI / 2;

  switch (el.type) {

    /* ── WC ─────────────────────────────────────────────── */
    case 'wc': {
      // Réservoir (arrière, contre le mur)
      add(new THREE.BoxGeometry(w * 0.88, elH * 0.42, d * 0.32), mats.main(), 0, elH * 0.58 + elH * 0.21, -d * 0.34);
      // Couvercle réservoir
      add(new THREE.BoxGeometry(w * 0.9, 0.022, d * 0.34), mats.light(), 0, elH * 0.8 + 0.011, -d * 0.34);
      // Cuvette (devant)
      add(new THREE.BoxGeometry(w, elH * 0.58, d * 0.65), mats.main(), 0, elH * 0.29, d * 0.175);
      // Base arrondie sous la cuvette
      add(new THREE.CylinderGeometry(w * 0.28, w * 0.32, elH * 0.28, 16), mats.main(), 0, elH * 0.14, d * 0.1);
      // Lunette (assise) horizontale
      add(new THREE.BoxGeometry(w * 0.96, 0.025, d * 0.68), mats.white(), 0, elH * 0.58 + 0.013, d * 0.15);
      // Bouton de chasse (sur le couvercle du réservoir)
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.018, 10), mats.chrome(), 0, elH * 0.8 + 0.022 + 0.009, -d * 0.34);
      break;
    }

    /* ── Lavabo ──────────────────────────────────────────── */
    case 'sink': {
      // Plan vasque (rim)
      add(new THREE.BoxGeometry(w, elH * 0.16, d), mats.main(), 0, elH - elH * 0.08, 0);
      // Vasque creuse (sombre)
      add(new THREE.BoxGeometry(w * 0.78, elH * 0.10, d * 0.78), mats.dark(), 0, elH - elH * 0.05, 0);
      // Colonne / pied
      add(new THREE.CylinderGeometry(w * 0.13, w * 0.16, elH * 0.84, 14), mats.main(), 0, elH * 0.42, 0);

      // ─── Mitigeur monocommande (au fond du plan vasque) ───
      // Socle plat sur la vasque
      add(new THREE.CylinderGeometry(0.028, 0.032, 0.012, 16), mats.chrome(), 0, elH + 0.006, -d * 0.34);
      // Corps cylindrique vertical
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 14), mats.chrome(), 0, elH + 0.067, -d * 0.34);
      // Manette unique inclinée vers l'avant et le haut
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), mats.chrome(), 0, elH + 0.16, -d * 0.3, -0.4, 0, 0);
      // Bille extrémité de la manette
      add(new THREE.SphereGeometry(0.014, 10, 10), mats.chrome(), 0, elH + 0.185, -d * 0.255);
      // Bec verseur courbé (allonge vers le centre de la vasque)
      add(new THREE.CylinderGeometry(0.013, 0.013, d * 0.42, 10), mats.chrome(), 0, elH + 0.135, -d * 0.13, PI2, 0, 0);
      // Coude au-dessus du corps
      add(new THREE.SphereGeometry(0.014, 10, 10), mats.chrome(), 0, elH + 0.135, -d * 0.34);
      // Mousseur (embout) dirigé vers le bas
      add(new THREE.CylinderGeometry(0.014, 0.012, 0.025, 12), mats.chrome(), 0, elH + 0.118, d * 0.08);
      break;
    }

    /* ── Receveur de douche ───────────────────────────────── */
    case 'shower_base': {
      // Tray shell
      add(new THREE.BoxGeometry(w, 0.065, d), mats.main(), 0, 0.0325, 0);
      // Inner surface (slightly raised)
      add(new THREE.BoxGeometry(w - 0.04, 0.006, d - 0.04), mats.white(), 0, 0.065 + 0.003, 0);
      // Drain grate
      add(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 20), mats.dark(), 0, 0.073, 0);
      // Drain slots
      for (let i = -1; i <= 1; i++) {
        add(new THREE.BoxGeometry(0.055, 0.003, 0.01), mats.chrome(), 0, 0.081, i * 0.022);
      }
      break;
    }

    /* ── Paroi vitrée ────────────────────────────────────── */
    case 'shower_glass': {
      const t = Math.min(w, 0.022);
      // Glass panel
      add(new THREE.BoxGeometry(t, elH - 0.04, d), mats.glass(), 0, elH / 2, 0);
      // Chrome top rail
      add(new THREE.BoxGeometry(t + 0.006, 0.022, d + 0.012), mats.chrome(), 0, elH - 0.011, 0);
      // Chrome bottom rail
      add(new THREE.BoxGeometry(t + 0.006, 0.022, d + 0.012), mats.chrome(), 0, 0.011, 0);
      // Side profiles
      add(new THREE.BoxGeometry(t + 0.006, elH, 0.014), mats.chrome(), 0, elH / 2,  d / 2 + 0.007);
      add(new THREE.BoxGeometry(t + 0.006, elH, 0.014), mats.chrome(), 0, elH / 2, -d / 2 - 0.007);
      // Handle bar
      add(new THREE.CylinderGeometry(0.012, 0.012, elH * 0.4, 8), mats.chrome(), t + 0.02, elH / 2, 0);
      break;
    }

    /* ── Siège de douche ─────────────────────────────────── */
    case 'shower_seat': {
      // Seat surface
      add(new THREE.BoxGeometry(w, 0.04, d), mats.main(), 0, elH - 0.02, 0);
      // Front chamfer strip
      add(new THREE.BoxGeometry(w, 0.035, 0.02), mats.light(), 0, elH - 0.0175, d / 2 - 0.01);
      // Support legs (wall brackets fold style)
      add(new THREE.BoxGeometry(0.028, elH - 0.04, 0.028), mats.chrome(),  w * 0.38, (elH - 0.04) / 2, d * 0.38);
      add(new THREE.BoxGeometry(0.028, elH - 0.04, 0.028), mats.chrome(), -w * 0.38, (elH - 0.04) / 2, d * 0.38);
      // Wall plate (back)
      add(new THREE.BoxGeometry(w * 0.9, 0.025, 0.04), mats.chrome(), 0, elH * 0.5, -d / 2 + 0.02);
      break;
    }

    /* ── Pommeau de douche ───────────────────────────────── */
    case 'shower_head': {
      // Wall bracket
      add(new THREE.BoxGeometry(0.04, 0.04, 0.05), mats.chrome(), 0, 0, -d / 2 + 0.025);
      // Arm (along Z toward room center)
      add(new THREE.CylinderGeometry(0.014, 0.014, d * 0.65, 8), mats.chrome(), 0, 0, 0, PI2, 0, 0);
      // Ball joint
      add(new THREE.SphereGeometry(0.025, 10, 10), mats.chrome(), 0, 0, d * 0.2);
      // Head disk (flat cylinder)
      add(new THREE.CylinderGeometry(w * 0.44, w * 0.44, 0.03, 20), mats.chrome(), 0, -0.015, d * 0.28);
      // Spray holes (dark disc center)
      add(new THREE.CylinderGeometry(w * 0.30, w * 0.30, 0.005, 20), mats.dark(), 0, -0.033, d * 0.28);
      break;
    }

    /* ── Mitigeur de douche (monocommande mural) ─────────── */
    case 'shower_mixer': {
      // Plaque murale rectangulaire (collée au mur)
      add(new THREE.BoxGeometry(w * 0.95, elH * 0.85, d * 0.25), mats.chrome(), 0, elH * 0.5, -d / 2 + d * 0.125);
      // Corps central cylindrique horizontal qui sort du mur
      add(new THREE.CylinderGeometry(w * 0.42, w * 0.42, d * 0.65, 24), mats.chrome(), 0, elH * 0.5, 0, PI2, 0, 0);
      // Anneau décoratif sombre à l'avant
      add(new THREE.CylinderGeometry(w * 0.44, w * 0.44, 0.006, 24), mats.dark(), 0, elH * 0.5, d * 0.33, PI2, 0, 0);
      // Indicateur rouge/bleu au centre
      add(new THREE.CylinderGeometry(w * 0.08, w * 0.08, 0.004, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }), -w * 0.12, elH * 0.5, d * 0.335, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.08, w * 0.08, 0.004, 16), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 }),  w * 0.12, elH * 0.5, d * 0.335, PI2, 0, 0);
      // Levier unique horizontal vers la droite
      add(new THREE.CylinderGeometry(0.014, 0.014, w * 0.7, 10), mats.chrome(), w * 0.2, elH * 0.5, d * 0.38, 0, 0, PI2);
      // Bille extrémité du levier
      add(new THREE.SphereGeometry(0.02, 12, 12), mats.chrome(), w * 0.48, elH * 0.5, d * 0.38);
      // Tuyau de sortie vers le bas (eau)
      add(new THREE.CylinderGeometry(0.014, 0.014, elH * 0.18, 8), mats.chrome(), 0, elH * 0.06, d * 0.18);
      break;
    }

    /* ── Barre PMR ───────────────────────────────────────── */
    case 'shower_bar': {
      // Main horizontal bar (along X)
      add(new THREE.CylinderGeometry(0.019, 0.019, w * 0.84, 12), mats.chrome(), 0, 0, 0, 0, 0, PI2);
      // Mount flanges
      add(new THREE.CylinderGeometry(0.032, 0.032, 0.032, 12), mats.chrome(),  w * 0.4, 0, 0, 0, 0, PI2);
      add(new THREE.CylinderGeometry(0.032, 0.032, 0.032, 12), mats.chrome(), -w * 0.4, 0, 0, 0, 0, PI2);
      // Wall back plates
      add(new THREE.BoxGeometry(0.06, 0.06, 0.01), mats.chrome(),  w * 0.4, 0, -0.02);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.01), mats.chrome(), -w * 0.4, 0, -0.02);
      break;
    }

    /* ── Bonde de sol ────────────────────────────────────── */
    case 'drain': {
      const r = Math.min(w, d) / 2;
      // Grate body
      add(new THREE.CylinderGeometry(r, r, 0.022, 20), mats.main(), 0, 0.011, 0);
      // Drain slots
      for (let i = -1; i <= 1; i++) {
        add(new THREE.BoxGeometry(r * 1.4, 0.004, 0.018), mats.chrome(), 0, 0.026, i * r * 0.5);
      }
      // Center chrome ring
      add(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.004, 12), mats.chrome(), 0, 0.027, 0);
      break;
    }

    /* ── Baignoire ───────────────────────────────────────── */
    case 'bathtub': {
      // Coque extérieure
      add(new THREE.BoxGeometry(w, elH, d), mats.main(), 0, elH / 2, 0);
      // Cuve intérieure blanche
      add(new THREE.BoxGeometry(w - 0.1, elH * 0.82, d - 0.1), mats.white(), 0, elH * 0.59, 0);
      // Appui-tête (côté mur / arrière)
      add(new THREE.BoxGeometry(w - 0.1, elH * 0.2, 0.06), mats.light(), 0, elH * 0.9, -d * 0.45);
      // Corps du mitigeur (sur le rebord arrière)
      add(new THREE.BoxGeometry(0.06, 0.1, 0.06), mats.chrome(), w * 0.36, elH + 0.05, -d * 0.28);
      // Bec verseur (vers l'intérieur de la baignoire)
      add(new THREE.CylinderGeometry(0.014, 0.014, d * 0.18, 8), mats.chrome(), w * 0.36, elH + 0.1, -d * 0.17, PI2, 0, 0);
      // Robinets chaud/froid
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8), mats.chrome(), w * 0.36 - 0.07, elH + 0.06, -d * 0.28);
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8), mats.chrome(), w * 0.36 + 0.07, elH + 0.06, -d * 0.28);
      break;
    }

    /* ── Bidet ───────────────────────────────────────────── */
    case 'bidet': {
      // Bowl body
      add(new THREE.BoxGeometry(w, elH * 0.55, d * 0.72), mats.main(), 0, elH * 0.275, 0);
      // Pedestal
      add(new THREE.CylinderGeometry(w * 0.22, w * 0.26, elH * 0.44, 14), mats.main(), 0, elH * 0.22, 0);
      // Seat rim
      add(new THREE.BoxGeometry(w * 0.96, 0.025, d * 0.72), mats.white(), 0, elH * 0.55 + 0.013, 0);
      // Faucet
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.09, 8), mats.chrome(), 0, elH * 0.6 + 0.045, -d * 0.26);
      add(new THREE.CylinderGeometry(0.009, 0.009, d * 0.18, 8), mats.chrome(), 0, elH * 0.6 + 0.08, -d * 0.16, PI2, 0, 0);
      break;
    }

    /* ── Porte ───────────────────────────────────────────── */
    case 'door': {
      // Door panel (wood-colored)
      add(new THREE.BoxGeometry(w * 0.94, elH * 0.99, 0.042), mats.main(), 0, elH / 2, 0);
      // Door frame top
      add(new THREE.BoxGeometry(w + 0.06, 0.06, 0.06), mats.dark(), 0, elH + 0.03, 0);
      // Panel inset (decorative recess)
      add(new THREE.BoxGeometry(w * 0.78, elH * 0.56, 0.01), mats.wood(), 0, elH * 0.58, 0.022);
      add(new THREE.BoxGeometry(w * 0.78, elH * 0.28, 0.01), mats.wood(), 0, elH * 0.2, 0.022);
      // Handle sphere
      add(new THREE.SphereGeometry(0.028, 8, 8), mats.chrome(), w * 0.4, elH * 0.5, 0.042);
      // Handle bar
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8), mats.chrome(), w * 0.4, elH * 0.5, 0.055, PI2, 0, 0);
      // Hinge plates
      add(new THREE.BoxGeometry(0.02, 0.1, 0.04), mats.chrome(), -w * 0.46, elH * 0.25, 0.02);
      add(new THREE.BoxGeometry(0.02, 0.1, 0.04), mats.chrome(), -w * 0.46, elH * 0.75, 0.02);
      break;
    }

    /* ── Fenêtre ─────────────────────────────────────────── */
    case 'window': {
      // Outer frame
      add(new THREE.BoxGeometry(w, elH, 0.065), mats.main(), 0, elH / 2, 0);
      // Glass pane
      add(new THREE.BoxGeometry(w - 0.08, elH - 0.08, 0.02), mats.glass(), 0, elH / 2, 0);
      // Horizontal mid-rail
      add(new THREE.BoxGeometry(w - 0.04, 0.042, 0.045), mats.main(), 0, elH / 2, 0);
      // Vertical mid-rail
      add(new THREE.BoxGeometry(0.042, elH - 0.04, 0.045), mats.main(), 0, elH / 2, 0);
      // Handle
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8), mats.chrome(), w * 0.2, elH / 2, 0.035, PI2, 0, 0);
      break;
    }

    /* ── Miroir ──────────────────────────────────────────── */
    case 'mirror': {
      // Outer frame
      add(new THREE.BoxGeometry(w, elH, 0.042), mats.main(), 0, elH / 2, 0);
      // Reflective face
      add(new THREE.BoxGeometry(w - 0.05, elH - 0.05, 0.016), mats.mirror(), 0, elH / 2, 0.03);
      // Light bar (LED strip at top)
      add(new THREE.BoxGeometry(w - 0.04, 0.04, 0.04), mats.chrome(), 0, elH + 0.02, 0);
      add(new THREE.BoxGeometry(w - 0.06, 0.025, 0.025), new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef9c3, emissiveIntensity: 0.6, roughness: 0.4 }), 0, elH + 0.022, 0.01);
      break;
    }

    /* ── Radiateur ───────────────────────────────────────── */
    case 'radiator': {
      // Back plate (wall-facing)
      add(new THREE.BoxGeometry(w, elH, 0.04), mats.main(), 0, elH / 2, -0.04);
      // Heating columns
      const colCount = Math.max(3, Math.floor(w / 0.065));
      for (let i = 0; i < colCount; i++) {
        const fx = -w / 2 + (w / colCount) * (i + 0.5);
        add(new THREE.BoxGeometry(0.028, elH * 0.9, 0.055), mats.main(), fx, elH / 2, 0);
        // Fin between columns
        if (i < colCount - 1) {
          const finX = -w / 2 + (w / colCount) * (i + 1);
          add(new THREE.BoxGeometry(0.008, elH * 0.7, 0.05), mats.light(), finX, elH / 2, 0);
        }
      }
      // Top and bottom rails
      add(new THREE.BoxGeometry(w, 0.032, 0.065), mats.chrome(), 0, elH - 0.016, 0);
      add(new THREE.BoxGeometry(w, 0.032, 0.065), mats.chrome(), 0, 0.016, 0);
      // Valve
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 10), mats.chrome(), w * 0.46, 0.08, 0);
      break;
    }

    /* ── Sèche-serviettes (échelle verticale murale) ─────── */
    case 'towel_rail': {
      const backZ  = -d / 2 + 0.006;          // contre le mur
      const frontZ =  d / 2 - 0.014;          // face avant

      // Plaques murales (haut + bas, côtés gauche + droit)
      for (const sx of [-w * 0.42, w * 0.42]) {
        add(new THREE.BoxGeometry(0.06, 0.06, 0.012), mats.chrome(), sx, elH - 0.06, backZ);
        add(new THREE.BoxGeometry(0.06, 0.06, 0.012), mats.chrome(), sx, 0.06,        backZ);
        // Bras de fixation qui relient le mur à l'échelle
        add(new THREE.BoxGeometry(0.022, 0.025, d - 0.025), mats.chrome(), sx, elH - 0.06, 0);
        add(new THREE.BoxGeometry(0.022, 0.025, d - 0.025), mats.chrome(), sx, 0.06,        0);
      }
      // Montants verticaux (côté avant — c'est ce qu'on voit en face)
      add(new THREE.BoxGeometry(0.024, elH * 0.92, 0.024), mats.chrome(),  w * 0.42, elH / 2, frontZ);
      add(new THREE.BoxGeometry(0.024, elH * 0.92, 0.024), mats.chrome(), -w * 0.42, elH / 2, frontZ);
      // Barreaux horizontaux (échelons sur lesquels on pose les serviettes)
      const barCount = Math.max(4, Math.floor(elH / 0.16));
      for (let i = 0; i < barCount; i++) {
        const by = 0.12 + i * ((elH - 0.24) / Math.max(1, barCount - 1));
        add(new THREE.CylinderGeometry(0.013, 0.013, w * 0.86, 12), mats.chrome(), 0, by, frontZ, 0, 0, PI2);
      }
      // Robinet thermostatique (côté bas droit)
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), mats.chrome(), w * 0.42, 0.06, -d / 2 - 0.04, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.022, 10, 10), mats.chrome(), w * 0.42, 0.06, -d / 2 - 0.08);
      break;
    }

    /* ── Meuble / Armoire ────────────────────────────────── */
    case 'cabinet': {
      // Carcass
      add(new THREE.BoxGeometry(w, elH, d), mats.main(), 0, elH / 2, 0);
      // Top surface (slightly lighter)
      add(new THREE.BoxGeometry(w, 0.022, d), mats.light(), 0, elH + 0.011, 0);
      // Door count
      const doors = Math.max(1, Math.round(w / 0.42));
      const dw = w / doors;
      // Door panels (slightly recessed)
      for (let i = 0; i < doors; i++) {
        const dx = -w / 2 + dw * (i + 0.5);
        add(new THREE.BoxGeometry(dw - 0.025, elH * 0.88, 0.012), mats.light(), dx, elH * 0.5, d / 2 + 0.006);
      }
      // Vertical dividers
      for (let i = 1; i < doors; i++) {
        add(new THREE.BoxGeometry(0.016, elH, 0.012), mats.dark(), -w / 2 + dw * i, elH / 2, d / 2 + 0.007);
      }
      // Handles
      for (let i = 0; i < doors; i++) {
        const hx = -w / 2 + dw * (i + 0.5);
        add(new THREE.CylinderGeometry(0.01, 0.01, dw * 0.38, 6), mats.chrome(), hx, elH * 0.55, d / 2 + 0.016, 0, 0, PI2);
      }
      break;
    }

    /* ── Default (shape générique) ─────────────────────────── */
    default: {
      if (def.shape === 'cylinder') {
        add(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, elH, 24), mats.main(), 0, elH / 2, 0);
      } else {
        add(new THREE.BoxGeometry(w, elH, d), mats.main(), 0, elH / 2, 0);
      }
    }
  }

  // Bounding-box après rotation (pour centrer correctement le groupe sur la zone 2D)
  const rotDeg = ((el.rotation || 0) % 360 + 360) % 360;
  const isRotated = rotDeg === 90 || rotDeg === 270;
  const bbW = isRotated ? d : w;
  const bbD = isRotated ? w : d;

  const cx = cmToM(el.x) + bbW / 2;
  const cz = cmToM(el.y) + bbD / 2;
  const baseY = def.mountHeight ? cmToM(def.mountHeight) : 0;
  group.position.set(cx, baseY, cz);
  // Rotation 2D (sens horaire vu de dessus) → rotation Y négative en Three.js
  group.rotation.y = -rotDeg * Math.PI / 180;

  return group;
}

// ── Custom OrbitControls ──────────────────────────────────────────────────────
function makeOrbitControls(camera, domElement) {
  const state = {
    spherical: new THREE.Spherical(),
    target: new THREE.Vector3(),
    isRotating: false,
    isPanning: false,
    last: { x: 0, y: 0 },
    activePointers: new Map(),
    pinchDist: 0,
  };

  function update() {
    const pos = new THREE.Vector3().setFromSpherical(state.spherical).add(state.target);
    camera.position.copy(pos);
    camera.lookAt(state.target);
  }

  function init(target, distance) {
    state.target.copy(target);
    state.spherical.set(distance, Math.PI / 3.5, Math.PI / 4);
    update();
  }

  function rotate(dx, dy) {
    state.spherical.theta -= dx * 0.005;
    state.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.spherical.phi - dy * 0.005));
    update();
  }

  function pan(dx, dy) {
    const offset = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * 0.01)
      .add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(dy * 0.01));
    state.target.add(offset);
    update();
  }

  function zoom(factor) {
    state.spherical.radius = Math.max(1, Math.min(50, state.spherical.radius * factor));
    update();
  }

  function onPointerDown(e) {
    domElement.setPointerCapture(e.pointerId);
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.last = { x: e.clientX, y: e.clientY };
    if (state.activePointers.size === 1) {
      state.isRotating = e.button !== 2 && !e.shiftKey;
      state.isPanning = e.button === 2 || e.shiftKey;
    } else if (state.activePointers.size === 2) {
      const pts = [...state.activePointers.values()];
      state.pinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      state.isRotating = false;
      state.isPanning = true;
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.activePointers.has(e.pointerId)) return;
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.activePointers.size === 2) {
      const pts = [...state.activePointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (state.pinchDist > 0) zoom(state.pinchDist / dist);
      state.pinchDist = dist;
      return;
    }

    const dx = e.clientX - state.last.x;
    const dy = e.clientY - state.last.y;
    state.last = { x: e.clientX, y: e.clientY };
    if (state.isRotating) rotate(dx, dy);
    else if (state.isPanning) pan(dx, dy);
  }

  function onPointerUp(e) {
    state.activePointers.delete(e.pointerId);
    if (state.activePointers.size < 2) state.pinchDist = 0;
    if (state.activePointers.size === 0) {
      state.isRotating = false;
      state.isPanning = false;
    }
  }

  function onWheel(e) {
    zoom(e.deltaY > 0 ? 1.1 : 0.9);
    e.preventDefault();
  }

  function onContextMenu(e) { e.preventDefault(); }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('contextmenu', onContextMenu);

  return {
    init,
    update,
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('contextmenu', onContextMenu);
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlanViewer3D({ plan, onClose, onBackTo2D }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f7);

    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcce8ff, 0.3);
    fill.position.set(-3, 4, -2);
    scene.add(fill);

    const roomW = cmToM(plan.room.width);
    const roomD = cmToM(plan.room.depth);
    const roomH = cmToM(plan.room.height);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(roomW / 2, 0, roomD / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const grid = new THREE.GridHelper(Math.max(roomW, roomD) * 2, 20, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.001;
    scene.add(grid);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.95 });
    const wallThickness = 0.1;
    const walls = [
      { x: roomW / 2,              z: -wallThickness / 2,       w: roomW + wallThickness * 2, d: wallThickness },
      { x: roomW / 2,              z: roomD + wallThickness / 2, w: roomW + wallThickness * 2, d: wallThickness },
      { x: -wallThickness / 2,     z: roomD / 2,                 w: wallThickness,              d: roomD },
      { x: roomW + wallThickness / 2, z: roomD / 2,              w: wallThickness,              d: roomD },
    ];
    for (const W of walls) {
      const geo = new THREE.BoxGeometry(W.w, roomH, W.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(W.x, roomH / 2, W.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Elements — compound geometries
    for (const el of plan.elements) {
      const def = ELEMENT_CATALOG[el.type];
      if (!def) continue;
      const grp = buildElementGroup(el, def);
      grp.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      scene.add(grp);
    }

    // Camera
    const center = new THREE.Vector3(roomW / 2, roomH / 3, roomD / 2);
    const diag = Math.sqrt(roomW * roomW + roomD * roomD);
    const controls = makeOrbitControls(camera, renderer.domElement);
    controls.init(center, diag * 1.4);

    // Resize
    const handleResize = () => {
      const W = container.clientWidth;
      const H = container.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [plan]);

  return (
    <div className="plan-viewer-3d">
      <div className="pv-toolbar">
        <button className="pe-btn" onClick={onClose} title="Fermer">✕</button>
        <span className="pv-title">Vue 3D</span>
        <button className="pe-btn pe-btn-primary" onClick={onBackTo2D} title="Retour à l'édition">
          ✏️ Éditer en 2D
        </button>
      </div>

      <div className="pv-container" ref={containerRef}>
        <div className="pv-hint">
          🖱️ Glisser pour pivoter · molette pour zoomer · clic-droit pour déplacer · 📱 Pincer pour zoomer
        </div>
      </div>
    </div>
  );
}
