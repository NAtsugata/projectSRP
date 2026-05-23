// src/components/ir-shower/planEditor/PlanViewer3D.jsx
// Viewer 3D — modèles réalistes, matériaux physiques, éclairage ACES.

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ELEMENT_CATALOG } from '../../../lib/planElements';
import { ROOM_LIMITS, clampToRoom } from '../../../lib/planModel';
import './PlanViewer3D.css';

const PI2 = Math.PI / 2;
function cmToM(cm) { return cm / 100; }

// ── buildElementGroup ─────────────────────────────────────────────────────────
// Convention : -Z = mur (arrière), +Z = pièce (avant). Rotation Y = group.rotation.y.
function buildElementGroup(el, def) {
  const group = new THREE.Group();
  const w = cmToM(el.width);
  const d = cmToM(el.depth);
  const H = cmToM(el.height);

  // ── Matériaux ─────────────────────────────────────────────────────────────
  const ceramic  = () => new THREE.MeshStandardMaterial({ color: 0xf4f1ed, roughness: 0.45, metalness: 0.0 });
  const porcelan = () => new THREE.MeshStandardMaterial({ color: 0xfafaf8, roughness: 0.55, metalness: 0.0 });
  const chrome   = () => new THREE.MeshStandardMaterial({ color: 0xdfe0e4, roughness: 0.06, metalness: 0.97 });
  const brushed  = () => new THREE.MeshStandardMaterial({ color: 0xb8babe, roughness: 0.32, metalness: 0.82 });
  const realGlass = () => new THREE.MeshPhysicalMaterial({
    color: 0xd0ecff, roughness: 0.02, metalness: 0.0,
    transmission: 0.88, thickness: 0.012, ior: 1.52,
  });
  const mirrorM  = () => new THREE.MeshStandardMaterial({ color: 0xc8e4f2, roughness: 0.01, metalness: 0.98 });
  const woodLt   = () => new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.85 });
  const woodDk   = () => new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.88 });
  const stone    = () => new THREE.MeshStandardMaterial({ color: 0xe8e2da, roughness: 0.28, metalness: 0.0 });
  const lightGr  = () => new THREE.MeshStandardMaterial({ color: 0xe4e6e8, roughness: 0.72 });
  const darkSl   = () => new THREE.MeshStandardMaterial({ color: 0x22283a, roughness: 0.82 });
  const rubber   = () => new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.96 });
  const hot      = () => new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 });
  const cold     = () => new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.5 });
  const led      = () => new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: new THREE.Color(0xfef3a0), emissiveIntensity: 1.2, roughness: 0.4 });
  const mainM    = () => new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color), opacity: def.opacity ?? 1, transparent: (def.opacity ?? 1) < 1, roughness: 0.70 });

  function add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function addMesh(mesh) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function rBox(bw, bh, bd, r, mat) {
    return add(new RoundedBoxGeometry(bw, bh, bd, 4, r), mat);
  }
  // lathe oval : profile [[r,y],...], scale Z
  function latheOval(pts, segs, mat, scaleZ) {
    const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.z = scaleZ;
    return mesh;
  }
  // tube along a CatmullRom path
  function tube(points, segments, radius, mat, radialSeg = 8) {
    const path = new THREE.CatmullRomCurve3(points);
    const geo  = new THREE.TubeGeometry(path, segments, radius, radialSeg, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  switch (el.type) {

    /* ────────────────────────────── WC ─────────────────────────────────── */
    case 'wc': {
      // Convention : réservoir côté -Z (mur), cuvette côté +Z (pièce)
      const seatH = Math.min(H * 0.52, 0.42);
      const ovalF = (d * 0.56) / (w * 0.44);   // étirement ovale avant/arrière

      // ── Réservoir (cistern) ──────────────────────────────────────────────
      const tkD = Math.min(d * 0.26, 0.18);
      const tkZ = -d / 2 + tkD / 2;
      const tkH = H - seatH - 0.010;
      rBox(w * 0.80, tkH, tkD, 0.012, ceramic()).position.set(0, seatH + 0.010 + tkH / 2, tkZ);
      // couvercle du réservoir
      add(new THREE.BoxGeometry(w * 0.82, 0.022, tkD + 0.014), porcelan(), 0, H + 0.011, tkZ);
      // plaque double-chasse rectangulaire
      rBox(w * 0.40, 0.062, 0.012, 0.006, brushed()).position.set(0, H - 0.040, tkZ + tkD / 2 + 0.004);
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 18), chrome(), -w * 0.08, H - 0.024, tkZ + tkD / 2 + 0.010, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 14), chrome(),  w * 0.08, H - 0.038, tkZ + tkD / 2 + 0.010, PI2, 0, 0);

      // ── Socle / jupe (floor → seatH) ────────────────────────────────────
      // boîte arrière (sous réservoir + connexion)
      add(new THREE.BoxGeometry(w * 0.80, seatH, tkD + 0.010), ceramic(), 0, seatH / 2, tkZ);
      // boîte centrale de remplissage
      add(new THREE.BoxGeometry(w * 0.76, seatH, d * 0.72), ceramic(), 0, seatH / 2, -d * 0.04);
      // demi-cylindre arrondi sur la face avant (+Z = côté pièce)
      const fR   = w * 0.38;
      const fGeo = new THREE.CylinderGeometry(fR, fR * 0.88, seatH, 28, 1, false, 0, Math.PI);
      const fMesh = new THREE.Mesh(fGeo, ceramic());
      fMesh.position.set(0, seatH / 2, d * 0.28);
      addMesh(fMesh);

      // ── Cuvette ──────────────────────────────────────────────────────────
      const bowlZ = d * 0.08;
      const rimR  = w * 0.44;
      // fond (eau sombre)
      const wm = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.74, rimR * 0.74, 0.010, 26), darkSl());
      wm.position.set(0, seatH - 0.048, bowlZ); wm.scale.z = ovalF; addMesh(wm);
      // bord de cuvette
      const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.030, 12, 32), porcelan());
      rim.position.set(0, seatH, bowlZ); rim.rotation.x = -PI2; rim.scale.y = ovalF; addMesh(rim);
      // lunette (abattant)
      const seat = new THREE.Mesh(new THREE.TorusGeometry(rimR + 0.006, 0.022, 10, 30), porcelan());
      seat.position.set(0, seatH + 0.022, bowlZ); seat.rotation.x = -PI2; seat.scale.y = ovalF; addMesh(seat);
      // couvercle relevé (appuyé contre le réservoir)
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(rimR + 0.010, rimR + 0.010, 0.016, 28), porcelan());
      lid.position.set(0, seatH + H * 0.17, tkZ + tkD * 0.55);
      lid.rotation.x = -0.92; lid.scale.z = ovalF * 0.86; addMesh(lid);
      break;
    }

    /* ─────────────────────── Lavabo (meuble+vasque) ────────────────────── */
    case 'sink': {
      const ctrH = H * 0.85;
      const ctrT = 0.038;
      const cabH = ctrH - ctrT;
      const legH = 0.050;

      // ── Meuble suspendu ──────────────────────────────────────────────────
      rBox(w, cabH - legH, d * 0.90, 0.010, woodLt()).position.set(0, legH + (cabH - legH) / 2, 0);
      // façade — 2 tiroirs
      for (const [ty, tw] of [[0.24, 1.0], [0.70, 1.0]]) {
        const dH = (cabH - legH) * 0.33;
        add(new THREE.BoxGeometry(w * tw * 0.92, dH, 0.014), woodDk(), 0, legH + (cabH - legH) * ty, d * 0.455 + 0.007);
        // panneau encastré
        add(new THREE.BoxGeometry(w * 0.68, dH * 0.60, 0.006), woodLt(), 0, legH + (cabH - legH) * ty, d * 0.455 + 0.015);
        // poignée barre
        add(new THREE.CylinderGeometry(0.007, 0.007, w * 0.38, 8), brushed(), 0, legH + (cabH - legH) * ty, d * 0.455 + 0.023, 0, 0, PI2);
      }

      // ── Plan de toilette (pierre/céramique) ─────────────────────────────
      add(new THREE.BoxGeometry(w + 0.044, ctrT, d + 0.044), stone(), 0, ctrH - ctrT / 2, 0);
      add(new THREE.BoxGeometry(w + 0.044, 0.090, 0.010), stone(), 0, ctrH + 0.033, -d / 2 - 0.006);  // dosseret

      // ── Vasque rectangulaire à poser ────────────────────────────────────
      const bW = w * 0.54, bD = d * 0.44, bSide = 0.020, bHH = 0.098;
      const vY = ctrH;
      add(new THREE.BoxGeometry(bW, bHH, bSide), porcelan(), 0, vY + bHH / 2,  bD / 2 - bSide / 2);
      add(new THREE.BoxGeometry(bW, bHH, bSide), porcelan(), 0, vY + bHH / 2, -bD / 2 + bSide / 2);
      add(new THREE.BoxGeometry(bSide, bHH, bD), porcelan(), -bW / 2 + bSide / 2, vY + bHH / 2, 0);
      add(new THREE.BoxGeometry(bSide, bHH, bD), porcelan(),  bW / 2 - bSide / 2, vY + bHH / 2, 0);
      // fond sombre (eau)
      add(new THREE.BoxGeometry(bW - bSide * 2 - 0.004, 0.006, bD - bSide * 2 - 0.004), darkSl(), 0, vY + 0.004, d * 0.05);
      // rebord (bordure autour du basin)
      rBox(bW + 0.018, 0.014, bD + 0.018, 0.005, porcelan()).position.set(0, vY + bHH + 0.007, d * 0.02);
      // bonde
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.010, 16), chrome(), 0, vY + 0.007, d * 0.05);

      // ── Mitigeur col de cygne ────────────────────────────────────────────
      const fz = -d * 0.26;
      add(new THREE.CylinderGeometry(0.028, 0.034, 0.014, 20), chrome(), 0, vY + 0.007, fz);  // embase
      tube([
        new THREE.Vector3(0, vY + 0.014, fz),
        new THREE.Vector3(0, vY + 0.08,  fz),
        new THREE.Vector3(0, vY + 0.155, fz),
        new THREE.Vector3(0, vY + 0.170, fz + 0.02),
        new THREE.Vector3(0, vY + 0.170, fz + bD * 0.72),
      ], 20, 0.013, chrome());
      // sortie eau
      add(new THREE.CylinderGeometry(0.010, 0.008, 0.022, 10), chrome(), 0, vY + 0.152, fz + bD * 0.72);
      // levier mono-commande
      add(new THREE.BoxGeometry(0.086, 0.009, 0.022), brushed(), 0.026, vY + 0.080, fz, 0, 0, -0.38);
      break;
    }

    /* ──────────────────────── Robinet seul ─────────────────────────────── */
    case 'faucet': {
      const fH = H;
      add(new THREE.CylinderGeometry(w * 0.44, w * 0.52, fH * 0.055, 20), chrome(), 0, fH * 0.027, 0);
      tube([
        new THREE.Vector3(0, fH * 0.055, 0),
        new THREE.Vector3(0, fH * 0.52, 0),
        new THREE.Vector3(0, fH * 0.62, 0),
        new THREE.Vector3(0, fH * 0.62, d * 0.28),
        new THREE.Vector3(0, fH * 0.58, d * 0.58),
      ], 16, w * 0.24, chrome());
      add(new THREE.CylinderGeometry(w * 0.20, w * 0.16, fH * 0.10, 12), chrome(), 0, fH * 0.53, d * 0.58);
      // levier
      add(new THREE.BoxGeometry(w * 0.68, fH * 0.06, w * 0.18), brushed(), w * 0.12, fH * 0.40, 0, 0, 0, -0.30);
      break;
    }

    /* ──────────────────── Receveur de douche ───────────────────────────── */
    case 'shower_base': {
      rBox(w, 0.050, d, 0.006, ceramic()).position.set(0, 0.025, 0);
      add(new THREE.BoxGeometry(w - 0.028, 0.004, d - 0.028), porcelan(), 0, 0.052, 0);
      const dlW = Math.min(w * 0.65, 0.50);
      add(new THREE.BoxGeometry(dlW + 0.016, 0.003, 0.065), brushed(), 0, 0.056, d * 0.35);
      add(new THREE.BoxGeometry(dlW, 0.006, 0.050), darkSl(), 0, 0.057, d * 0.35);
      for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.022, 0.003, 0.008), chrome(), i * dlW / 7, 0.063, d * 0.35);
      break;
    }

    /* ──────────────────────── Paroi fixe (walk-in) ─────────────────────── */
    case 'shower_glass': {
      const t = Math.min(d, 0.010);
      // vitre (transmission physique)
      add(new THREE.BoxGeometry(w - 0.038, H - 0.05, t), realGlass(), 0, H / 2, 0);
      // montant mural gauche
      add(new THREE.BoxGeometry(0.032, H + 0.010, t + 0.018), brushed(), -w / 2 + 0.016, H / 2, 0);
      // profilé haut
      add(new THREE.BoxGeometry(w + 0.008, 0.024, t + 0.016), brushed(), 0, H - 0.012, 0);
      // barre de stabilisation inclinée + ancrage mur
      tube([
        new THREE.Vector3(-w / 2 + 0.024, H * 0.86, 0),
        new THREE.Vector3(-w * 0.18, H * 0.86, 0),
      ], 8, 0.009, chrome());
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.030, 12), brushed(), -w / 2 + 0.016, H * 0.86, 0, 0, 0, PI2);
      // pied sol
      add(new THREE.BoxGeometry(0.048, 0.028, t + 0.042), brushed(), -w / 2 + 0.022, 0.014, 0);
      break;
    }

    /* ────────────────────── Porte de douche ────────────────────────────── */
    case 'shower_door': {
      const t = Math.min(d, 0.010);
      add(new THREE.BoxGeometry(w - 0.050, H - 0.040, t), realGlass(), 0, H / 2, 0);
      // cadre périmétrique
      add(new THREE.BoxGeometry(w, 0.022, t + 0.014), brushed(), 0, H - 0.011, 0);
      add(new THREE.BoxGeometry(w, 0.026, t + 0.014), brushed(), 0, 0.013, 0);
      add(new THREE.BoxGeometry(0.024, H, t + 0.014), brushed(), -w / 2 + 0.012, H / 2, 0);
      add(new THREE.BoxGeometry(0.024, H, t + 0.014), brushed(),  w / 2 - 0.012, H / 2, 0);
      // charnières (côté gauche = fixé au mur)
      for (const hy of [H * 0.18, H * 0.82])
        add(new THREE.CylinderGeometry(0.017, 0.017, 0.055, 14), chrome(), -w / 2 + 0.012, hy, 0, 0, 0, PI2);
      // poignée double barre (côté droit)
      tube([
        new THREE.Vector3(w / 2 - 0.048, H * 0.36, t + 0.028),
        new THREE.Vector3(w / 2 - 0.048, H * 0.64, t + 0.028),
      ], 8, 0.011, chrome());
      for (const oy of [H * 0.36, H * 0.64]) {
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.042, 8), chrome(), w / 2 - 0.048, oy, t + 0.014, PI2, 0, 0);
        add(new THREE.SphereGeometry(0.012, 8, 8), chrome(), w / 2 - 0.048, oy, t + 0.030);
      }
      break;
    }

    /* ──────────────────────── Paroi d'angle (L) ───────────────────────── */
    case 'shower_corner': {
      const t = 0.010;
      // Panneau arrière (long du X, à -Z)
      add(new THREE.BoxGeometry(w - 0.038, H - 0.038, t), realGlass(), 0, H / 2, -d / 2 + t / 2 + 0.006);
      add(new THREE.BoxGeometry(w, 0.022, t + 0.014), brushed(), 0, H - 0.011, -d / 2 + t / 2 + 0.006);
      // Panneau latéral (long du Z, à -X)
      add(new THREE.BoxGeometry(t, H - 0.038, d - 0.038), realGlass(), -w / 2 + t / 2 + 0.006, H / 2, 0);
      add(new THREE.BoxGeometry(t + 0.014, 0.022, d), brushed(), -w / 2 + t / 2 + 0.006, H - 0.011, 0);
      // Montant d'angle (colonne chromée au coin)
      add(new THREE.CylinderGeometry(0.020, 0.020, H + 0.010, 16), chrome(), -w / 2 + 0.014, H / 2, -d / 2 + 0.014);
      // Montants extrémités
      add(new THREE.BoxGeometry(0.026, H, 0.034), brushed(),  w / 2 - 0.013, H / 2, -d / 2 + 0.014);
      add(new THREE.BoxGeometry(0.034, H, 0.026), brushed(), -w / 2 + 0.014, H / 2,  d / 2 - 0.013);
      break;
    }

    /* ─────────────────────── Cabine fermée ─────────────────────────────── */
    case 'shower_cabin': {
      const t = 0.010;
      // Receveur bas
      rBox(w, 0.048, d, 0.006, ceramic()).position.set(0, 0.024, 0);
      add(new THREE.BoxGeometry(w - 0.040, 0.010, d - 0.040), darkSl(), 0, 0.050, 0);
      // Paroi arrière (-Z)
      add(new THREE.BoxGeometry(w - 0.024, H - 0.050, t), realGlass(), 0, H / 2 + 0.025, -d / 2 + t / 2 + 0.012);
      // Paroi latérale (-X)
      add(new THREE.BoxGeometry(t, H - 0.050, d - 0.024), realGlass(), -w / 2 + t / 2 + 0.012, H / 2 + 0.025, 0);
      // 2 portes avant (côté +Z), ouverture centrale
      for (const sx of [-w * 0.255, w * 0.255])
        add(new THREE.BoxGeometry(w * 0.48, H - 0.050, t), realGlass(), sx, H / 2 + 0.025, d / 2 - t / 2 - 0.012);
      // Paroi latérale droite (+X)
      add(new THREE.BoxGeometry(t, H - 0.050, d - 0.024), realGlass(), w / 2 - t / 2 - 0.012, H / 2 + 0.025, 0);
      // Montants verticaux (4 coins)
      for (const [cx, cz] of [[-w/2+0.014,-d/2+0.014],[w/2-0.014,-d/2+0.014],[-w/2+0.014,d/2-0.014],[w/2-0.014,d/2-0.014]])
        add(new THREE.CylinderGeometry(0.014, 0.014, H + 0.010, 14), brushed(), cx, H / 2 + 0.025, cz);
      // Cadre haut (4 barres horizontales)
      for (const [bx, bz, bw, bd] of [
        [0, -d/2 + 0.014, w - 0.028, 0.028], [0, d/2 - 0.014, w - 0.028, 0.028],
        [-w/2 + 0.014, 0, 0.028, d - 0.028], [w/2 - 0.014, 0, 0.028, d - 0.028],
      ]) add(new THREE.BoxGeometry(bw, 0.026, bd), brushed(), bx, H + 0.013, bz);
      // Poignées double porte
      for (const sx of [-w * 0.048, w * 0.048]) {
        tube([
          new THREE.Vector3(sx, H * 0.38, d / 2 + 0.022),
          new THREE.Vector3(sx, H * 0.62, d / 2 + 0.022),
        ], 6, 0.010, chrome());
      }
      break;
    }

    /* ──────────────────── Colonne de douche ────────────────────────────── */
    case 'shower_column': {
      const backZ = -d / 2 + 0.022;
      // ── Panneau mural ────────────────────────────────────────────────────
      rBox(w * 0.90, H, 0.044, 0.008, brushed()).position.set(0, H / 2, backZ);
      rBox(w * 0.68, H * 0.96, 0.020, 0.005, lightGr()).position.set(0, H / 2, backZ + 0.028);
      // ── Colonne / riser chromé (tube vertical central) ───────────────────
      tube([
        new THREE.Vector3(0, 0.06, backZ + 0.065),
        new THREE.Vector3(0, H * 0.50, backZ + 0.065),
        new THREE.Vector3(0, H - 0.10, backZ + 0.065),
      ], 16, w * 0.15, chrome());
      // ── Mitigeur thermostatique (≈ 110 cm) ──────────────────────────────
      const mY = Math.min(H * 0.52, 1.10);
      rBox(w * 0.76, 0.095, 0.070, 0.008, chrome()).position.set(0, mY, backZ + 0.058);
      // molettes (température + débit)
      for (const [ox, mat] of [[-w * 0.24, cold()], [w * 0.24, hot()]]) {
        add(new THREE.CylinderGeometry(0.024, 0.024, 0.038, 18), chrome(), ox, mY, backZ + 0.100, PI2, 0, 0);
        add(new THREE.CylinderGeometry(0.027, 0.027, 0.004, 18), mat, ox, mY, backZ + 0.122, PI2, 0, 0);
      }
      // ── Douchette à main ─────────────────────────────────────────────────
      const dhY = mY + 0.18;
      // support coulissant sur la colonne
      add(new THREE.BoxGeometry(0.042, 0.062, 0.034), brushed(), w * 0.18, dhY, backZ + 0.062);
      // corps douchette
      add(new THREE.CylinderGeometry(0.034, 0.028, 0.016, 20), chrome(), w * 0.20, dhY + 0.14, backZ + 0.10);
      add(new THREE.CylinderGeometry(0.013, 0.015, 0.14, 12), chrome(), w * 0.215, dhY + 0.065, backZ + 0.10, 0.28, 0, 0);
      add(new THREE.CylinderGeometry(0.010, 0.010, 0.008, 12), rubber(), w * 0.204, dhY + 0.155, backZ + 0.104);
      // flexible (tube courbe)
      tube([
        new THREE.Vector3(w * 0.18, dhY,         backZ + 0.062),
        new THREE.Vector3(w * 0.06, dhY - 0.06,  backZ + 0.080),
        new THREE.Vector3(0, mY + 0.010, backZ + 0.062),
      ], 14, 0.008, brushed());
      // ── Bras + pommeau de pluie ──────────────────────────────────────────
      const armY = H - 0.055;
      // bras coudé vers l'avant
      tube([
        new THREE.Vector3(0, armY, backZ + 0.065),
        new THREE.Vector3(0, armY, backZ + 0.130),
        new THREE.Vector3(0, armY - 0.030, backZ + d * 0.82),
      ], 12, 0.014, chrome());
      // pommeau pluie (disque large)
      const hZ   = backZ + d * 0.82;
      const headR = Math.max(w * 0.52, 0.10);
      add(new THREE.CylinderGeometry(headR, headR * 0.92, 0.028, 32), chrome(), 0, armY - 0.038, hZ);
      add(new THREE.CylinderGeometry(headR * 0.88, headR * 0.88, 0.006, 32), rubber(), 0, armY - 0.054, hZ);
      for (const fr of [0.28, 0.55, 0.82])
        add(new THREE.TorusGeometry(headR * fr, 0.0028, 4, 26), darkSl(), 0, armY - 0.060, hZ, PI2, 0, 0);
      // tablette porte-savon
      rBox(w * 0.70, 0.014, 0.070, 0.004, lightGr()).position.set(0, mY + 0.36, backZ + 0.048);
      break;
    }

    /* ──────────────────────── Pommeau seul ─────────────────────────────── */
    case 'shower_head': {
      add(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 16), brushed(), 0, 0, -d / 2 + 0.008, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.012, 0.012, d * 0.72, 12), chrome(), 0, 0, 0, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.022, 12, 12), chrome(), 0, 0, d * 0.20);
      const hR = Math.max(w * 0.42, 0.06);
      add(new THREE.CylinderGeometry(hR, hR * 0.90, 0.028, 26), chrome(), 0, -0.016, d * 0.26);
      add(new THREE.CylinderGeometry(hR * 0.86, hR * 0.86, 0.006, 26), rubber(), 0, -0.035, d * 0.26);
      for (const fr of [0.28, 0.55, 0.82]) add(new THREE.TorusGeometry(hR * fr, 0.0028, 4, 20), darkSl(), 0, -0.042, d * 0.26, PI2, 0, 0);
      break;
    }

    /* ─────────────────── Mitigeur de douche mural ──────────────────────── */
    case 'shower_mixer': {
      rBox(w * 0.92, H * 0.88, d * 0.14, 0.006, chrome()).position.set(0, H / 2, -d / 2 + d * 0.07);
      rBox(w * 0.94, H * 0.90, 0.036, 0.004, lightGr()).position.set(0, H / 2, -d / 2 + d * 0.018);
      add(new THREE.CylinderGeometry(w * 0.36, w * 0.36, d * 0.60, 24), chrome(), 0, H / 2, 0, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.38, w * 0.38, 0.008, 22), lightGr(), 0, H / 2, d * 0.32, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.40, w * 0.40, 0.006, 22), brushed(), 0, H / 2, d * 0.31, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.055, w * 0.055, 0.003, 12), hot(),  -w * 0.18, H / 2, d * 0.328, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.055, w * 0.055, 0.003, 12), cold(),  w * 0.18, H / 2, d * 0.328, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.011, 0.011, w * 0.65, 10), chrome(), w * 0.19, H / 2, d * 0.31, 0, 0, PI2);
      add(new THREE.SphereGeometry(0.016, 10, 10), chrome(), w * 0.44, H / 2, d * 0.31);
      break;
    }

    /* ───────────────────────── Barre PMR ───────────────────────────────── */
    case 'shower_bar': {
      const bL = w * 0.86;
      tube([new THREE.Vector3(-bL / 2, 0, 0), new THREE.Vector3(bL / 2, 0, 0)], 8, 0.018, chrome());
      for (const ex of [-bL / 2, bL / 2]) {
        add(new THREE.CylinderGeometry(0.034, 0.034, 0.026, 14), brushed(), ex, 0, 0, 0, 0, PI2);
        add(new THREE.BoxGeometry(0.058, 0.058, 0.010), brushed(), ex, 0, -0.022);
      }
      for (let i = -2; i <= 2; i++) add(new THREE.TorusGeometry(0.018, 0.003, 4, 12), rubber(), i * w * 0.11, 0, 0, 0, PI2, 0);
      break;
    }

    /* ───────────────────────── Bonde de sol ────────────────────────────── */
    case 'drain': {
      const r = Math.min(w, d) * 0.5;
      add(new THREE.CylinderGeometry(r, r, 0.016, 22), darkSl(), 0, 0.008, 0);
      add(new THREE.TorusGeometry(r, 0.005, 4, 22), brushed(), 0, 0.016, 0, PI2, 0, 0);
      for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(r * 1.55, 0.003, 0.009), chrome(), 0, 0.020, i * r * 0.36);
      break;
    }

    /* ──────────────────────── Siège de douche ──────────────────────────── */
    case 'shower_seat': {
      rBox(w, 0.038, d, 0.006, lightGr()).position.set(0, H - 0.019, 0);
      add(new THREE.BoxGeometry(w + 0.006, 0.026, 0.018), lightGr(), 0, H - 0.013, d / 2 - 0.009);
      add(new THREE.BoxGeometry(w * 0.84, 0.020, 0.038), brushed(), 0, H * 0.5, -d / 2 + 0.019);
      for (const sx of [-w * 0.34, w * 0.34]) {
        tube([new THREE.Vector3(sx, 0.040, 0), new THREE.Vector3(sx, H * 0.60, 0), new THREE.Vector3(sx, H * 0.74, d * 0.25)], 10, 0.012, chrome());
      }
      break;
    }

    /* ─────────────────────────── Baignoire ─────────────────────────────── */
    case 'bathtub': {
      const rim = 0.044;
      rBox(w, H, d, 0.018, ceramic()).position.set(0, H / 2, 0);
      add(new THREE.BoxGeometry(w - rim * 2, H * 0.86, d - rim * 2), porcelan(), 0, H * 0.57, 0);
      add(new THREE.BoxGeometry(w - rim * 3, 0.008, d - rim * 3), darkSl(), 0, H * 0.14, 0);
      add(new THREE.BoxGeometry(w - rim * 2, H * 0.20, rim), lightGr(), 0, H * 0.90, -d * 0.47);
      // 4 pieds
      for (const [fx, fz] of [[-w/2+0.055,-d/2+0.055],[w/2-0.055,-d/2+0.055],[-w/2+0.055,d/2-0.055],[w/2-0.055,d/2-0.055]]) {
        add(new THREE.CylinderGeometry(0.030, 0.024, H * 0.12, 12), chrome(), fx, H * 0.06, fz);
        add(new THREE.SphereGeometry(0.030, 8, 8), brushed(), fx, 0, fz);
      }
      // robinetterie pont
      const mx = w * 0.34;
      tube([new THREE.Vector3(mx, H + 0.008, -d * 0.29), new THREE.Vector3(mx, H + 0.088, -d * 0.29)], 8, 0.018, chrome());
      tube([new THREE.Vector3(mx, H + 0.088, -d * 0.29), new THREE.Vector3(mx, H + 0.118, -d * 0.15)], 8, 0.012, chrome());
      for (const [ox, c] of [[-0.064, cold()], [0.064, hot()]]) {
        add(new THREE.CylinderGeometry(0.016, 0.016, 0.038, 10), brushed(), mx + ox, H + 0.019, -d * 0.29);
        add(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 8), c, mx + ox, H + 0.038 + 0.011, -d * 0.29);
      }
      break;
    }

    /* ────────────────────────── Bidet ──────────────────────────────────── */
    case 'bidet': {
      const bBH  = H * 0.54;
      const ovalF = (d * 0.74) / (w * 0.47);
      const biPts = [];
      for (let i = 0; i <= 18; i++) {
        const t2 = i / 18;
        let r;
        if (t2 < 0.12) r = w * 0.07 + w * 0.16 * (t2 / 0.12);
        else { const p = (t2 - 0.12) / 0.88; r = w * 0.23 + w * 0.24 * Math.sin(p * Math.PI * 0.90); }
        biPts.push([r, t2 * bBH]);
      }
      addMesh(latheOval(biPts, 20, ceramic(), ovalF));
      const biW = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.20, w * 0.17, 0.010, 20), darkSl());
      biW.position.set(0, bBH * 0.52, 0); biW.scale.z = ovalF; addMesh(biW);
      add(new THREE.CylinderGeometry(w * 0.13, w * 0.17, H * 0.44, 14), ceramic(), 0, H * 0.22, 0);
      const biSeat = new THREE.Mesh(new THREE.TorusGeometry(w * 0.26, 0.018, 8, 24), porcelan());
      biSeat.position.set(0, bBH + 0.010, 0); biSeat.rotation.x = -PI2; biSeat.scale.y = ovalF; addMesh(biSeat);
      tube([
        new THREE.Vector3(0, H * 0.62, -d * 0.28),
        new THREE.Vector3(0, H * 0.72, -d * 0.22),
        new THREE.Vector3(0, H * 0.72, -d * 0.14),
      ], 8, 0.010, chrome());
      break;
    }

    /* ───────────────────────── Porte ───────────────────────────────────── */
    case 'door': {
      rBox(w * 0.95, H * 0.995, 0.044, 0.008, woodLt()).position.set(0, H / 2, 0);
      // cadre
      add(new THREE.BoxGeometry(w + 0.084, 0.066, 0.072), woodDk(), 0, H + 0.033, 0);
      add(new THREE.BoxGeometry(0.054, H, 0.060), woodDk(), -w * 0.5 - 0.027, H / 2, 0);
      add(new THREE.BoxGeometry(0.054, H, 0.060), woodDk(),  w * 0.5 + 0.027, H / 2, 0);
      // panneaux encastrés
      add(new THREE.BoxGeometry(w * 0.87, 0.014, 0.010), woodDk(), 0, H * 0.35, 0.024);
      add(new THREE.BoxGeometry(w * 0.87, 0.014, 0.010), woodDk(), 0, H * 0.68, 0.024);
      add(new THREE.BoxGeometry(w * 0.80, H * 0.30, 0.008), woodDk(), 0, H * 0.52, 0.024);
      add(new THREE.BoxGeometry(w * 0.80, H * 0.22, 0.008), woodDk(), 0, H * 0.18, 0.024);
      // poignée levier
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16), brushed(), w * 0.42, H * 0.5, 0.046, PI2, 0, 0);
      tube([
        new THREE.Vector3(w * 0.42, H * 0.5, 0.056),
        new THREE.Vector3(w * 0.42, H * 0.5, 0.110),
        new THREE.Vector3(w * 0.43, H * 0.5 - 0.014, 0.116),
      ], 8, 0.009, chrome());
      // charnières
      for (const hy of [H * 0.14, H * 0.50, H * 0.86])
        add(new THREE.BoxGeometry(0.020, 0.082, 0.042), brushed(), -w * 0.46, hy, 0.024);
      break;
    }

    /* ──────────────────────── Fenêtre ──────────────────────────────────── */
    case 'window': {
      add(new THREE.BoxGeometry(w, H, 0.072), lightGr(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.082, H - 0.082, 0.018), realGlass(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.040, 0.040, 0.052), lightGr(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(0.040, H - 0.040, 0.052), lightGr(), 0, H / 2, 0);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.072, 10), chrome(), w * 0.18, H * 0.5, 0.040, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.013, 8, 8), chrome(), w * 0.18, H * 0.5, 0.074);
      add(new THREE.BoxGeometry(w + 0.042, 0.034, 0.092), lightGr(), 0, 0, 0.046);
      break;
    }

    /* ──────────────────────── Miroir ───────────────────────────────────── */
    case 'mirror': {
      rBox(w, H, 0.038, 0.006, lightGr()).position.set(0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.006, H - 0.006, 0.008), brushed(), 0, H / 2, 0.022);
      add(new THREE.BoxGeometry(w - 0.036, H - 0.036, 0.014), mirrorM(), 0, H / 2, 0.026);
      // LED strip en haut (bandeau lumineux)
      rBox(w - 0.038, 0.040, 0.026, 0.004, brushed()).position.set(0, H + 0.020, 0);
      add(new THREE.BoxGeometry(w - 0.056, 0.022, 0.018), led(), 0, H + 0.020, 0.008);
      // pattes de fixation bas
      for (const sx of [-w * 0.35, w * 0.35])
        add(new THREE.BoxGeometry(0.056, 0.018, 0.040), brushed(), sx, 0, -0.019);
      break;
    }

    /* ────────────────────── Meuble / Armoire ───────────────────────────── */
    case 'cabinet': {
      const legH = 0.052;
      for (const [lx, lz] of [[-w/2+0.038,-d/2+0.038],[w/2-0.038,-d/2+0.038],[-w/2+0.038,d/2-0.038],[w/2-0.038,d/2-0.038]])
        add(new THREE.CylinderGeometry(0.018, 0.014, legH, 10), chrome(), lx, legH / 2, lz);
      rBox(w, H - legH, d, 0.008, woodLt()).position.set(0, legH + (H - legH) / 2, 0);
      add(new THREE.BoxGeometry(w + 0.020, 0.022, d + 0.020), lightGr(), 0, H + 0.011, 0);
      add(new THREE.BoxGeometry(w + 0.020, 0.090, 0.010), lightGr(), 0, H + 0.067, -d / 2 + 0.005);
      const doors = Math.max(1, Math.round(w / 0.42)), dw = w / doors;
      for (let i = 0; i < doors; i++) {
        const dx = -w / 2 + dw * (i + 0.5), dY = legH + (H - legH) * 0.5;
        add(new THREE.BoxGeometry(dw - 0.018, (H - legH) * 0.90, 0.014), lightGr(), dx, dY, d / 2 + 0.007);
        add(new THREE.BoxGeometry(dw - 0.052, (H - legH) * 0.72, 0.006), woodDk(), dx, dY + (H - legH) * 0.04, d / 2 + 0.016);
        add(new THREE.CylinderGeometry(0.008, 0.008, dw * 0.32, 6), brushed(), dx, dY, d / 2 + 0.024, 0, 0, PI2);
      }
      break;
    }

    /* ──────────────────────── Radiateur ────────────────────────────────── */
    case 'radiator': {
      add(new THREE.BoxGeometry(w, H, 0.020), lightGr(), 0, H / 2, -d / 2 + 0.010);
      const cols = Math.max(3, Math.floor(w / 0.060));
      const cW = w / cols;
      for (let i = 0; i < cols; i++) {
        const cx = -w / 2 + cW * (i + 0.5);
        add(new THREE.BoxGeometry(0.024, H * 0.88, 0.052), ceramic(), cx, H / 2, 0);
        add(new THREE.BoxGeometry(0.008, H * 0.80, d - 0.024), lightGr(), cx, H / 2, 0);
      }
      add(new THREE.BoxGeometry(w, 0.026, d * 0.80), chrome(), 0, H - 0.013, 0);
      add(new THREE.BoxGeometry(w, 0.026, d * 0.80), chrome(), 0, 0.013, 0);
      break;
    }

    /* ─────────────────── Sèche-serviettes ──────────────────────────────── */
    case 'towel_rail': {
      const fZ = d / 2 - 0.011, bZ = -d / 2 + 0.004;
      for (const sx of [-w * 0.42, w * 0.42]) {
        for (const sy of [H - 0.050, 0.050]) {
          add(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 14), brushed(), sx, sy, bZ, PI2, 0, 0);
          add(new THREE.BoxGeometry(0.048, 0.048, 0.010), lightGr(), sx, sy, bZ);
        }
        tube([new THREE.Vector3(sx, 0.050, bZ), new THREE.Vector3(sx, H - 0.050, bZ)], 8, 0.009, brushed());
        tube([new THREE.Vector3(sx, H - 0.050, bZ), new THREE.Vector3(sx, H - 0.050, fZ)], 6, 0.009, brushed());
        tube([new THREE.Vector3(sx, 0.050, bZ), new THREE.Vector3(sx, 0.050, fZ)], 6, 0.009, brushed());
        add(new THREE.CylinderGeometry(0.011, 0.011, H * 0.90, 12), chrome(), sx, H * 0.5, fZ);
      }
      const bars = Math.max(3, Math.floor(H / 0.18));
      for (let i = 0; i < bars; i++) {
        const by = 0.095 + i * ((H - 0.19) / Math.max(1, bars - 1));
        tube([new THREE.Vector3(-w * 0.43, by, fZ), new THREE.Vector3(w * 0.43, by, fZ)], 8, 0.011, chrome());
      }
      break;
    }

    /* ──────────────────── Default (forme générique) ────────────────────── */
    default: {
      if (def.shape === 'cylinder') {
        const r = Math.min(w, d) / 2;
        add(new THREE.CylinderGeometry(r, r * 0.95, H, 30), mainM(), 0, H / 2, 0);
        add(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.010, 30), lightGr(), 0, H - 0.005, 0);
      } else {
        rBox(w * 0.98, H * 0.96, d * 0.98, 0.008, mainM()).position.set(0, H / 2, 0);
        add(new THREE.BoxGeometry(w, H * 0.028, d), lightGr(), 0, H - H * 0.014, 0);
        add(new THREE.BoxGeometry(w, H * 0.028, d), lightGr(), 0, H * 0.014, 0);
      }
    }
  }

  // ── Positionnement dans la scène ──────────────────────────────────────────
  const rotDeg  = ((el.rotation || 0) % 360 + 360) % 360;
  const isRotated = rotDeg === 90 || rotDeg === 270;
  const bbW = isRotated ? d : w;
  const bbD = isRotated ? w : d;
  const cx  = cmToM(el.x) + bbW / 2;
  const cz  = cmToM(el.y) + bbD / 2;
  group.position.set(cx, def.mountHeight ? cmToM(def.mountHeight) : 0, cz);
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
      state.isPanning  = e.button === 2  || e.shiftKey;
    } else if (state.activePointers.size === 2) {
      const pts = [...state.activePointers.values()];
      state.pinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      state.isRotating = false; state.isPanning = true;
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
    if (state.activePointers.size === 0) { state.isRotating = false; state.isPanning = false; }
  }
  function onWheel(e) { zoom(e.deltaY > 0 ? 1.1 : 0.9); e.preventDefault(); }
  function onContextMenu(e) { e.preventDefault(); }

  domElement.addEventListener('pointerdown',   onPointerDown);
  domElement.addEventListener('pointermove',   onPointerMove);
  domElement.addEventListener('pointerup',     onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);
  domElement.addEventListener('wheel',         onWheel, { passive: false });
  domElement.addEventListener('contextmenu',   onContextMenu);

  return {
    init, update,
    dispose() {
      domElement.removeEventListener('pointerdown',   onPointerDown);
      domElement.removeEventListener('pointermove',   onPointerMove);
      domElement.removeEventListener('pointerup',     onPointerUp);
      domElement.removeEventListener('pointercancel', onPointerUp);
      domElement.removeEventListener('wheel',         onWheel);
      domElement.removeEventListener('contextmenu',   onContextMenu);
    },
  };
}

// ── Dimension Stepper ─────────────────────────────────────────────────────────
function DimStepper({ label, value, onStep, step = 10, min = 50, max = 2000 }) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => { setDraft(String(value)); }, [value]);

  function commit(raw) {
    const num = parseInt(raw, 10);
    const clamped = isNaN(num) ? value : Math.max(min, Math.min(max, num));
    setDraft(String(clamped));
    onStep(clamped);
  }
  function stepBy(delta) {
    const next = Math.max(min, Math.min(max, value + delta));
    setDraft(String(next));
    onStep(next);
  }

  return (
    <div className="pv-dim-row">
      <span className="pv-dim-label">{label}</span>
      <div className="pv-stepper">
        <button className="pv-step-btn" onClick={() => stepBy(-step)}>−</button>
        <input type="number" className="pv-step-input" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit(draft)}
          min={min} max={max} step={step} />
        <span className="pv-step-unit">cm</span>
        <button className="pv-step-btn" onClick={() => stepBy(step)}>+</button>
      </div>
    </div>
  );
}

// ── PlanViewer3D component ────────────────────────────────────────────────────
export default function PlanViewer3D({ plan, onChange, onClose, onBackTo2D }) {
  const containerRef = useRef(null);
  const [showPanel, setShowPanel] = useState(false);

  const updateRoom = (key, val) => {
    if (!onChange) return;
    const lim = ROOM_LIMITS[key] || { min: 50, max: 2000 };
    const v   = Math.max(lim.min, Math.min(lim.max, Number(val) || lim.min));
    const nextRoom     = { ...plan.room, [key]: v };
    const nextElements = plan.elements.map(el => clampToRoom(el, nextRoom));
    onChange({ ...plan, room: nextRoom, elements: nextElements });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd6dde8);
    scene.fog = new THREE.FogExp2(0xd6dde8, 0.025);

    const W = container.clientWidth;
    const Hc = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(48, W / Hc, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, Hc);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── Éclairage ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.65));
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.0);
    sun.position.set(6, 14, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
    sun.shadow.camera.top  =  16; sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0002;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);
    fill.position.set(-5, 6, -4);
    scene.add(fill);
    const back = new THREE.DirectionalLight(0xffe8d0, 0.18);
    back.position.set(2, 2, -8);
    scene.add(back);

    const roomW = cmToM(plan.room.width);
    const roomD = cmToM(plan.room.depth);
    const roomH = cmToM(plan.room.height);

    const ceiling = new THREE.PointLight(0xffeedd, 0.30, Math.max(roomW, roomD) * 5);
    ceiling.position.set(roomW / 2, roomH * 0.94, roomD / 2);
    scene.add(ceiling);

    // ── Sol (carrelage 60×60 simulé avec grille) ─────────────────────────
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.82, metalness: 0.0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(roomW / 2, 0, roomD / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    // joints de carrelage (grille fine)
    const tileSize = 0.60;
    const gridFloor = new THREE.GridHelper(
      Math.max(roomW, roomD) * 2, Math.ceil(Math.max(roomW, roomD) * 2 / tileSize),
      0xbab4aa, 0xbab4aa,
    );
    gridFloor.material.opacity = 0.35;
    gridFloor.material.transparent = true;
    gridFloor.position.set(roomW / 2, 0.001, roomD / 2);
    scene.add(gridFloor);

    // ── Murs ───────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2eeea, roughness: 0.94 });
    const wt = 0.08;
    const walls = [
      { x: roomW/2, z: -wt/2,     w: roomW + wt*2, d: wt },      // arrière
      { x: roomW/2, z: roomD+wt/2, w: roomW + wt*2, d: wt },      // avant
      { x: -wt/2,   z: roomD/2,   w: wt,           d: roomD },    // gauche
      { x: roomW+wt/2, z: roomD/2, w: wt,           d: roomD },   // droite
    ];
    for (const wall of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, roomH, wall.d), wallMat);
      mesh.position.set(wall.x, roomH / 2, wall.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
    // plafond légèrement visible
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.99 });
    const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW + wt*2, roomD + wt*2), ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(roomW / 2, roomH, roomD / 2);
    ceilMesh.receiveShadow = true;
    scene.add(ceilMesh);

    // ── Éléments ───────────────────────────────────────────────────────────
    for (const el of plan.elements) {
      const def = ELEMENT_CATALOG[el.type];
      if (!def) continue;
      const grp = buildElementGroup(el, def);
      grp.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      scene.add(grp);
    }

    // ── Caméra ─────────────────────────────────────────────────────────────
    const center  = new THREE.Vector3(roomW / 2, roomH / 3, roomD / 2);
    const diag    = Math.sqrt(roomW * roomW + roomD * roomD);
    const controls = makeOrbitControls(camera, renderer.domElement);
    controls.init(center, diag * 1.4);

    // ── Resize ─────────────────────────────────────────────────────────────
    const handleResize = () => {
      const nW = container.clientWidth, nH = container.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', handleResize);

    // ── Render loop ────────────────────────────────────────────────────────
    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); renderer.render(scene, camera); };
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
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [plan]);

  return (
    <div className="plan-viewer-3d">
      <div className="pv-toolbar">
        <button className="pe-btn" onClick={onClose} title="Fermer">✕</button>
        <span className="pv-title">Vue 3D</span>
        {onChange && (
          <button
            className={`pe-btn pv-dim-toggle${showPanel ? ' pv-dim-toggle--active' : ''}`}
            onClick={() => setShowPanel(p => !p)}
            title="Modifier les dimensions"
          >
            📐 Dimensions
          </button>
        )}
        <button className="pe-btn pe-btn-primary" onClick={onBackTo2D} title="Retour à l'édition">
          ✏️ Éditer en 2D
        </button>
      </div>

      <div className="pv-container" ref={containerRef}>
        {showPanel && (
          <div className="pv-dim-panel">
            <div className="pv-dim-title">Pièce</div>
            <DimStepper label="Largeur"    value={plan.room.width}  onStep={v => updateRoom('width',  v)} min={ROOM_LIMITS.width.min}  max={ROOM_LIMITS.width.max} />
            <DimStepper label="Profondeur" value={plan.room.depth}  onStep={v => updateRoom('depth',  v)} min={ROOM_LIMITS.depth.min}  max={ROOM_LIMITS.depth.max} />
            <DimStepper label="Hauteur"    value={plan.room.height} onStep={v => updateRoom('height', v)} step={5} min={ROOM_LIMITS.height.min} max={ROOM_LIMITS.height.max} />
          </div>
        )}
        <div className="pv-hint">
          🖱️ Glisser · molette zoom · clic-droit déplacer · 📱 Pincer pour zoomer
        </div>
      </div>
    </div>
  );
}
