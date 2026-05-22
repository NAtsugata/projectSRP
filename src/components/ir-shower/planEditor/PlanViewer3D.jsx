// src/components/ir-shower/planEditor/PlanViewer3D.jsx
// Viewer 3D du plan : extrude la pièce et les éléments en 3D avec Three.js.

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ELEMENT_CATALOG } from '../../../lib/planElements';
import { ROOM_LIMITS, clampToRoom } from '../../../lib/planModel';
import './PlanViewer3D.css';

function cmToM(cm) { return cm / 100; }

// ── Compound 3D element builder ──────────────────────────────────────────────
// Convention: -Z = mur (arrière), +Z = pièce (avant). Rotation Y appliquée au groupe.
function buildElementGroup(el, def) {
  const group = new THREE.Group();
  const w  = cmToM(el.width);
  const d  = cmToM(el.depth);
  const H  = cmToM(el.height);
  const PI2 = Math.PI / 2;

  // ── Palette matériaux ──────────────────────────────────────────────────────
  const ceramic  = () => new THREE.MeshStandardMaterial({ color: 0xf8f5f0, roughness: 0.50 });
  const porcelan = () => new THREE.MeshStandardMaterial({ color: 0xfafaf8, roughness: 0.64 });
  const chrome   = () => new THREE.MeshStandardMaterial({ color: 0xe0e0e3, roughness: 0.08, metalness: 0.96 });
  const brushed  = () => new THREE.MeshStandardMaterial({ color: 0xc5c6ca, roughness: 0.38, metalness: 0.80 });
  const glass    = () => new THREE.MeshStandardMaterial({ color: 0xaed6ec, opacity: 0.30, transparent: true, roughness: 0.04, metalness: 0.04 });
  const mirror   = () => new THREE.MeshStandardMaterial({ color: 0xd0e8f4, roughness: 0.01, metalness: 0.98 });
  const woodLt   = () => new THREE.MeshStandardMaterial({ color: 0xd4a870, roughness: 0.88 });
  const woodDk   = () => new THREE.MeshStandardMaterial({ color: 0x8c5e38, roughness: 0.90 });
  const lightGr  = () => new THREE.MeshStandardMaterial({ color: 0xe8e9eb, roughness: 0.74 });
  const darkSl   = () => new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.80 });
  const rubber   = () => new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.96 });
  const mainM    = () => new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color), opacity: def.opacity ?? 1, transparent: (def.opacity ?? 1) < 1, roughness: 0.70, metalness: 0.02 });
  const hot      = () => new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
  const cold     = () => new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 });
  const led      = () => new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: new THREE.Color(0xfef9c3), emissiveIntensity: 0.7, roughness: 0.4 });

  function add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  function addMesh(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }

  // LatheGeometry oval : profile [[r,y],...], scale Z to make it oval
  function latheOval(pts, segs, mat, scaleZ) {
    const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.z = scaleZ;
    return mesh;
  }

  switch (el.type) {

    /* ── WC ──────────────────────────────────────────────── */
    case 'wc': {
      const bowlH = H * 0.58;
      // Cuvette LatheGeometry (profil de révolution, étiré en ovale)
      const bPts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        let r;
        if (t < 0.10) r = w * 0.07 + w * 0.11 * (t / 0.10);
        else { const p = (t - 0.10) / 0.90; r = w * 0.18 + w * 0.28 * Math.sin(p * Math.PI * 0.92); }
        bPts.push([r, t * bowlH]);
      }
      const bowl = latheOval(bPts, 22, ceramic(), (d * 0.72) / (w * 0.46));
      bowl.position.set(0, 0, d * 0.06);
      addMesh(bowl);
      // Surface eau (sombre)
      const water = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.18, 0.012, 20), darkSl());
      water.position.set(0, bowlH * 0.52, d * 0.06); water.scale.z = (d * 0.72) / (w * 0.46);
      addMesh(water);
      // Lunette (torus ovale)
      const seat = new THREE.Mesh(new THREE.TorusGeometry(w * 0.29, 0.022, 8, 24), porcelan());
      seat.position.set(0, bowlH + 0.014, d * 0.06); seat.rotation.x = -PI2;
      seat.scale.y = (d * 0.64) / (w * 0.58); addMesh(seat);
      // Abattant plat
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.30, w * 0.30, 0.016, 24), porcelan());
      lid.position.set(0, bowlH + 0.036, d * 0.06); lid.scale.z = (d * 0.64) / (w * 0.60); addMesh(lid);
      // Réservoir slim mural
      const tkH = H * 0.35, tkZ = -d * 0.5 + d * 0.13;
      add(new THREE.BoxGeometry(w * 0.90, tkH, d * 0.22), ceramic(), 0, H - tkH / 2, tkZ);
      add(new THREE.BoxGeometry(w * 0.92, 0.015, d * 0.235), lightGr(), 0, H - 0.0075, tkZ);
      add(new THREE.CylinderGeometry(0.034, 0.034, 0.013, 18), chrome(), 0, H + 0.0065, tkZ);
      add(new THREE.CylinderGeometry(0.020, 0.020, 0.011, 16), brushed(), 0, H + 0.0055, tkZ);
      add(new THREE.BoxGeometry(0.004, 0.013, 0.001), chrome(), 0, H + 0.0065, tkZ);
      break;
    }

    /* ── Lavabo ───────────────────────────────────────────── */
    case 'sink': {
      const rimH = 0.048;
      add(new THREE.BoxGeometry(w, rimH, d), ceramic(), 0, H - rimH / 2, 0);
      // Vasque LatheGeometry ovale
      const basinR = Math.min(w, d) * 0.40, basinD = 0.13;
      const aPts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        aPts.push([basinR * (0.12 + 0.88 * Math.sin(t * Math.PI * 0.85)), -t * basinD]);
      }
      const basin = new THREE.Mesh(new THREE.LatheGeometry(aPts.map(([r, y]) => new THREE.Vector2(r, y)), 20), darkSl());
      basin.position.set(0, H - 0.004, 0); basin.scale.z = d / w; addMesh(basin);
      add(new THREE.CylinderGeometry(0.020, 0.020, 0.005, 14), chrome(), 0, H - basinD, 0);
      // Piédestal 3 sections (waist)
      add(new THREE.CylinderGeometry(w * 0.165, w * 0.185, H * 0.28, 14), ceramic(), 0, H * 0.14, 0);
      add(new THREE.CylinderGeometry(w * 0.095, w * 0.125, H * 0.44, 12), ceramic(), 0, H * 0.46, 0);
      add(new THREE.CylinderGeometry(w * 0.155, w * 0.095, H * 0.26, 14), ceramic(), 0, H * 0.77, 0);
      // Mitigeur monocommande
      const fz = -d * 0.34;
      add(new THREE.CylinderGeometry(0.026, 0.030, 0.009, 16), chrome(), 0, H + 0.0045, fz);
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.090, 13), chrome(), 0, H + 0.054,  fz);
      add(new THREE.SphereGeometry(0.018, 10, 10), chrome(), 0, H + 0.103, fz);
      add(new THREE.CylinderGeometry(0.009, 0.009, 0.068, 8), chrome(), 0, H + 0.138, fz - 0.012, -0.38, 0, 0);
      add(new THREE.SphereGeometry(0.012, 8, 8), chrome(), 0, H + 0.162, fz + 0.008);
      add(new THREE.CylinderGeometry(0.011, 0.013, d * 0.38, 10), chrome(), 0, H + 0.120, fz + d * 0.19, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.012, 8, 8), chrome(), 0, H + 0.120, fz);
      add(new THREE.CylinderGeometry(0.011, 0.009, 0.020, 11), chrome(), 0, H + 0.105, fz + d * 0.38 - 0.01);
      break;
    }

    /* ── Receveur de douche ───────────────────────────────── */
    case 'shower_base': {
      add(new THREE.BoxGeometry(w, 0.052, d), ceramic(), 0, 0.026, 0);
      add(new THREE.BoxGeometry(w - 0.030, 0.004, d - 0.030), porcelan(), 0, 0.054, 0);
      const dlW = Math.min(w * 0.70, 0.55);
      add(new THREE.BoxGeometry(dlW + 0.014, 0.003, 0.065), brushed(), 0, 0.058, d * 0.34);
      add(new THREE.BoxGeometry(dlW, 0.006, 0.048), darkSl(), 0, 0.058, d * 0.34);
      for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.022, 0.003, 0.008), chrome(), i * dlW / 7, 0.064, d * 0.34);
      break;
    }

    /* ── Paroi vitrée ────────────────────────────────────── */
    case 'shower_glass': {
      const t = Math.min(w, 0.018);
      add(new THREE.BoxGeometry(t, H - 0.055, d), glass(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(t + 0.014, 0.030, d + 0.018), brushed(), 0, H - 0.015, 0);
      add(new THREE.BoxGeometry(t + 0.014, 0.034, d + 0.018), brushed(), 0, 0.017, 0);
      for (const sz of [-d / 2 - 0.010, d / 2 + 0.010]) add(new THREE.BoxGeometry(t + 0.010, H, 0.020), brushed(), 0, H / 2, sz);
      for (const ox of [t + 0.024, -(t + 0.024)]) {
        add(new THREE.CylinderGeometry(0.010, 0.010, H * 0.36, 10), chrome(), ox, H * 0.5, 0);
        add(new THREE.SphereGeometry(0.010, 8, 8), chrome(), ox, H * 0.5 + H * 0.18, 0);
        add(new THREE.SphereGeometry(0.010, 8, 8), chrome(), ox, H * 0.5 - H * 0.18, 0);
      }
      break;
    }

    /* ── Siège de douche ─────────────────────────────────── */
    case 'shower_seat': {
      add(new THREE.BoxGeometry(w, 0.040, d), lightGr(), 0, H - 0.020, 0);
      add(new THREE.BoxGeometry(w + 0.005, 0.028, 0.016), lightGr(), 0, H - 0.014, d / 2 - 0.008);
      add(new THREE.BoxGeometry(w * 0.86, 0.020, 0.036), brushed(), 0, H * 0.5, -d / 2 + 0.018);
      for (const sx of [-w * 0.35, w * 0.35]) {
        add(new THREE.BoxGeometry(0.022, H * 0.55, 0.022), chrome(), sx, H * 0.30, -d * 0.10);
        add(new THREE.BoxGeometry(0.022, H * 0.42, 0.022), chrome(), sx, H * 0.73, d * 0.29, -0.50, 0, 0);
      }
      break;
    }

    /* ── Pommeau de douche ───────────────────────────────── */
    case 'shower_head': {
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14), brushed(), 0, 0, -d / 2 + 0.008, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.030, 10), chrome(), 0, 0, -d / 2 + 0.015, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.012, 0.012, d * 0.68, 10), chrome(), 0, 0, 0, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.024, 12, 12), chrome(), 0, 0, d * 0.19);
      const hR = Math.max(w * 0.42, 0.06);
      add(new THREE.CylinderGeometry(hR, hR * 0.90, 0.030, 24), chrome(), 0, -0.018, d * 0.26);
      add(new THREE.CylinderGeometry(hR * 0.86, hR * 0.86, 0.005, 24), rubber(), 0, -0.038, d * 0.26);
      for (const fr of [0.28, 0.55, 0.80]) add(new THREE.TorusGeometry(hR * fr, 0.0028, 4, 20), darkSl(), 0, -0.043, d * 0.26, PI2, 0, 0);
      break;
    }

    /* ── Mitigeur de douche (monocommande mural) ─────────── */
    case 'shower_mixer': {
      add(new THREE.BoxGeometry(w * 0.94, H * 0.90, d * 0.16), chrome(), 0, H * 0.5, -d / 2 + d * 0.08);
      add(new THREE.BoxGeometry(w * 0.96, H * 0.92, d * 0.038), lightGr(), 0, H * 0.5, -d / 2 + d * 0.019);
      add(new THREE.CylinderGeometry(w * 0.36, w * 0.36, d * 0.60, 22), chrome(), 0, H * 0.5, 0, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.38, w * 0.38, 0.009, 22), lightGr(), 0, H * 0.5, d * 0.32, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.40, w * 0.40, 0.006, 22), brushed(), 0, H * 0.5, d * 0.30, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.055, w * 0.055, 0.003, 12), hot(), -w * 0.19, H * 0.5, d * 0.328, PI2, 0, 0);
      add(new THREE.CylinderGeometry(w * 0.055, w * 0.055, 0.003, 12), cold(), w * 0.19, H * 0.5, d * 0.328, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.011, 0.011, w * 0.65, 10), chrome(), w * 0.20, H * 0.5, d * 0.32, 0, 0, PI2);
      add(new THREE.SphereGeometry(0.017, 10, 10), chrome(), w * 0.46, H * 0.5, d * 0.32);
      add(new THREE.CylinderGeometry(0.011, 0.011, H * 0.18, 8), chrome(), 0, H * 0.06, d * 0.15);
      break;
    }

    /* ── Barre PMR ───────────────────────────────────────── */
    case 'shower_bar': {
      const bL = w * 0.86;
      add(new THREE.CylinderGeometry(0.017, 0.017, bL, 14), chrome(), 0, 0, 0, 0, 0, PI2);
      for (const ex of [-bL / 2, bL / 2]) {
        add(new THREE.SphereGeometry(0.017, 8, 8), chrome(), ex, 0, 0);
        add(new THREE.CylinderGeometry(0.032, 0.032, 0.026, 12), brushed(), ex, 0, 0, 0, 0, PI2);
        add(new THREE.BoxGeometry(0.058, 0.058, 0.009), brushed(), ex, 0, -0.022);
      }
      for (let i = -2; i <= 2; i++) add(new THREE.TorusGeometry(0.017, 0.003, 4, 12), rubber(), i * w * 0.11, 0, 0, 0, PI2, 0);
      break;
    }

    /* ── Bonde de sol ────────────────────────────────────── */
    case 'drain': {
      const r = Math.min(w, d) * 0.5;
      add(new THREE.CylinderGeometry(r, r, 0.016, 20), darkSl(), 0, 0.008, 0);
      add(new THREE.TorusGeometry(r, 0.005, 4, 20), brushed(), 0, 0.016, 0, PI2, 0, 0);
      for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(r * 1.55, 0.003, 0.009), chrome(), 0, 0.020, i * r * 0.36);
      add(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.005, 10), chrome(), 0, 0.022, 0);
      break;
    }

    /* ── Baignoire ───────────────────────────────────────── */
    case 'bathtub': {
      const rim = 0.044;
      add(new THREE.BoxGeometry(w, H, d), ceramic(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - rim * 2, H * 0.87, d - rim * 2), porcelan(), 0, H * 0.565, 0);
      add(new THREE.BoxGeometry(w - rim * 3, 0.010, d - rim * 3), darkSl(), 0, H * 0.13, 0);
      add(new THREE.BoxGeometry(w - rim * 2, H * 0.20, rim), lightGr(), 0, H * 0.90, -d * 0.47);
      // 4 pieds chromés
      for (const [fx, fz] of [[-w/2+0.055,-d/2+0.055],[w/2-0.055,-d/2+0.055],[-w/2+0.055,d/2-0.055],[w/2-0.055,d/2-0.055]]) {
        add(new THREE.CylinderGeometry(0.030, 0.024, H * 0.12, 10), chrome(), fx, H * 0.06, fz);
        add(new THREE.SphereGeometry(0.030, 8, 8), brushed(), fx, 0, fz);
      }
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.007, 14), chrome(), 0, H * 0.70, -d / 2 + rim + 0.008);
      const mx = w * 0.34;
      add(new THREE.CylinderGeometry(0.025, 0.028, 0.009, 14), chrome(), mx, H + 0.0045, -d * 0.28);
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.076, 12), chrome(), mx, H + 0.044,  -d * 0.28);
      add(new THREE.SphereGeometry(0.018, 8, 8), chrome(), mx, H + 0.086, -d * 0.28);
      add(new THREE.CylinderGeometry(0.011, 0.011, d * 0.20, 8), chrome(), mx, H + 0.115, -d * 0.17, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.011, 8, 8), chrome(), mx, H + 0.115, -d * 0.28);
      for (const [ox, c] of [[-0.065, hot()], [0.065, cold()]]) {
        add(new THREE.CylinderGeometry(0.016, 0.016, 0.036, 8), brushed(), mx + ox, H + 0.018, -d * 0.28);
        add(new THREE.CylinderGeometry(0.009, 0.009, 0.020, 8), c, mx + ox, H + 0.036 + 0.010, -d * 0.28);
      }
      break;
    }

    /* ── Bidet ───────────────────────────────────────────── */
    case 'bidet': {
      const bBH = H * 0.54;
      const biPts = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        let r;
        if (t < 0.12) r = w * 0.07 + w * 0.16 * (t / 0.12);
        else { const p = (t - 0.12) / 0.88; r = w * 0.23 + w * 0.24 * Math.sin(p * Math.PI * 0.90); }
        biPts.push([r, t * bBH]);
      }
      const biBody = latheOval(biPts, 20, ceramic(), (d * 0.74) / (w * 0.47)); addMesh(biBody);
      const biWater = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.20, w * 0.17, 0.011, 18), darkSl());
      biWater.position.set(0, bBH * 0.52, 0); biWater.scale.z = (d * 0.74) / (w * 0.47); addMesh(biWater);
      add(new THREE.CylinderGeometry(w * 0.13, w * 0.17, H * 0.44, 14), ceramic(), 0, H * 0.22, 0);
      const biSeat = new THREE.Mesh(new THREE.TorusGeometry(w * 0.26, 0.018, 8, 22), porcelan());
      biSeat.position.set(0, bBH + 0.010, 0); biSeat.rotation.x = -PI2;
      biSeat.scale.y = (d * 0.60) / (w * 0.52); addMesh(biSeat);
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 8), chrome(), 0, H * 0.62 + 0.037, -d * 0.27);
      add(new THREE.CylinderGeometry(0.008, 0.008, d * 0.15, 8), chrome(), 0, H * 0.62 + 0.072, -d * 0.18, PI2, 0, 0);
      break;
    }

    /* ── Porte ───────────────────────────────────────────── */
    case 'door': {
      add(new THREE.BoxGeometry(w * 0.96, H * 0.995, 0.044), woodLt(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w + 0.08, 0.068, 0.070), woodDk(), 0, H + 0.034, 0);
      add(new THREE.BoxGeometry(0.052, H, 0.058), woodDk(), -w * 0.5 - 0.026, H / 2, 0);
      add(new THREE.BoxGeometry(0.052, H, 0.058), woodDk(),  w * 0.5 + 0.026, H / 2, 0);
      add(new THREE.BoxGeometry(w * 0.88, 0.014, 0.009), woodDk(), 0, H * 0.35, 0.023);
      add(new THREE.BoxGeometry(w * 0.88, 0.014, 0.009), woodDk(), 0, H * 0.68, 0.023);
      add(new THREE.BoxGeometry(w * 0.82, H * 0.30, 0.007), woodDk(), 0, H * 0.52, 0.023);
      add(new THREE.BoxGeometry(w * 0.82, H * 0.22, 0.007), woodDk(), 0, H * 0.18, 0.023);
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14), brushed(), w * 0.42, H * 0.5, 0.044, PI2, 0, 0);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.110, 8), chrome(), w * 0.42, H * 0.5, 0.054, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.009, 8, 8), chrome(), w * 0.42, H * 0.5, 0.109);
      for (const hy of [H * 0.14, H * 0.50, H * 0.84]) add(new THREE.BoxGeometry(0.020, 0.082, 0.040), brushed(), -w * 0.47, hy, 0.022);
      break;
    }

    /* ── Fenêtre ─────────────────────────────────────────── */
    case 'window': {
      add(new THREE.BoxGeometry(w, H, 0.072), lightGr(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.082, H - 0.082, 0.022), glass(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.040, 0.038, 0.050), lightGr(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(0.038, H - 0.040, 0.050), lightGr(), 0, H / 2, 0);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.072, 8), chrome(), w * 0.18, H * 0.5, 0.038, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.014, 8, 8), chrome(), w * 0.18, H * 0.5, 0.073);
      add(new THREE.BoxGeometry(w + 0.040, 0.036, 0.090), lightGr(), 0, 0, 0.045);
      break;
    }

    /* ── Miroir ──────────────────────────────────────────── */
    case 'mirror': {
      add(new THREE.BoxGeometry(w, H, 0.040), lightGr(), 0, H / 2, 0);
      add(new THREE.BoxGeometry(w - 0.008, H - 0.008, 0.007), brushed(), 0, H / 2, 0.022);
      add(new THREE.BoxGeometry(w - 0.038, H - 0.038, 0.013), mirror(), 0, H / 2, 0.027);
      add(new THREE.BoxGeometry(w - 0.040, 0.042, 0.044), brushed(), 0, H + 0.021, 0);
      add(new THREE.BoxGeometry(w - 0.060, 0.024, 0.026), led(), 0, H + 0.022, 0.010);
      add(new THREE.BoxGeometry(0.055, 0.018, 0.038), brushed(), -w * 0.35, 0, -0.019);
      add(new THREE.BoxGeometry(0.055, 0.018, 0.038), brushed(),  w * 0.35, 0, -0.019);
      break;
    }

    /* ── Radiateur ───────────────────────────────────────── */
    case 'radiator': {
      add(new THREE.BoxGeometry(w, H, 0.020), lightGr(), 0, H / 2, -d / 2 + 0.010);
      const cols = Math.max(3, Math.floor(w / 0.060));
      const cW = w / cols;
      for (let i = 0; i < cols; i++) {
        const cx = -w / 2 + cW * (i + 0.5);
        add(new THREE.BoxGeometry(0.024, H * 0.88, 0.050), ceramic(), cx, H / 2, 0);
        add(new THREE.BoxGeometry(0.018, H * 0.88, 0.034), lightGr(), cx, H / 2, -d / 2 + 0.030);
        add(new THREE.BoxGeometry(0.008, H * 0.80, d - 0.028), lightGr(), cx, H / 2, 0);
      }
      add(new THREE.BoxGeometry(w, 0.026, d * 0.82), chrome(), 0, H - 0.013, 0);
      add(new THREE.BoxGeometry(w, 0.026, d * 0.82), chrome(), 0, 0.013, 0);
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.052, 10), brushed(), w * 0.46, 0.070, 0, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.022, 8, 8), chrome(), w * 0.46, 0.070, -d / 2 - 0.028);
      add(new THREE.CylinderGeometry(0.007, 0.007, 0.028, 8), chrome(), w * 0.46, H - 0.013, -d / 2 - 0.014);
      break;
    }

    /* ── Sèche-serviettes ────────────────────────────────── */
    case 'towel_rail': {
      const fZ = d / 2 - 0.011, bZ = -d / 2 + 0.004;
      for (const sx of [-w * 0.42, w * 0.42]) {
        for (const sy of [H - 0.050, 0.050]) {
          add(new THREE.CylinderGeometry(0.024, 0.024, 0.013, 12), brushed(), sx, sy, bZ, PI2, 0, 0);
          add(new THREE.BoxGeometry(0.048, 0.048, 0.009), lightGr(), sx, sy, bZ);
        }
        add(new THREE.CylinderGeometry(0.009, 0.009, d - 0.026, 8), brushed(), sx, H - 0.050, 0, PI2, 0, 0);
        add(new THREE.CylinderGeometry(0.009, 0.009, d - 0.026, 8), brushed(), sx, 0.050, 0, PI2, 0, 0);
        add(new THREE.CylinderGeometry(0.011, 0.011, H * 0.90, 10), chrome(), sx, H * 0.5, fZ);
      }
      const bars = Math.max(3, Math.floor(H / 0.18));
      for (let i = 0; i < bars; i++) {
        const by = 0.095 + i * ((H - 0.19) / Math.max(1, bars - 1));
        add(new THREE.CylinderGeometry(0.011, 0.011, w * 0.86, 12), chrome(), 0, by, fZ, 0, 0, PI2);
        for (const sx of [-w * 0.43, w * 0.43]) add(new THREE.SphereGeometry(0.011, 8, 8), chrome(), sx, by, fZ);
      }
      add(new THREE.CylinderGeometry(0.015, 0.015, d * 0.38, 10), brushed(), w * 0.42, 0.050, bZ + d * 0.19, PI2, 0, 0);
      add(new THREE.SphereGeometry(0.019, 10, 10), chrome(), w * 0.42, 0.050, bZ - d * 0.19);
      break;
    }

    /* ── Meuble / Armoire ────────────────────────────────── */
    case 'cabinet': {
      const legH = 0.052;
      for (const [lx, lz] of [[-w/2+0.038,-d/2+0.038],[w/2-0.038,-d/2+0.038],[-w/2+0.038,d/2-0.038],[w/2-0.038,d/2-0.038]]) {
        add(new THREE.CylinderGeometry(0.018, 0.014, legH, 8), chrome(), lx, legH / 2, lz);
      }
      add(new THREE.BoxGeometry(w, H - legH, d), woodLt(), 0, legH + (H - legH) / 2, 0);
      add(new THREE.BoxGeometry(w + 0.018, 0.020, d + 0.018), lightGr(), 0, H + 0.010, 0);
      add(new THREE.BoxGeometry(w + 0.018, 0.092, 0.008), lightGr(), 0, H + 0.066, -d / 2 + 0.004);
      const doors = Math.max(1, Math.round(w / 0.42)), dw = w / doors;
      for (let i = 0; i < doors; i++) {
        const dx = -w / 2 + dw * (i + 0.5), dY = legH + (H - legH) * 0.5;
        add(new THREE.BoxGeometry(dw - 0.020, (H - legH) * 0.90, 0.013), lightGr(), dx, dY, d / 2 + 0.006);
        add(new THREE.BoxGeometry(dw - 0.052, (H - legH) * 0.72, 0.005), woodDk(), dx, dY + (H - legH) * 0.04, d / 2 + 0.014);
        add(new THREE.CylinderGeometry(0.008, 0.008, dw * 0.32, 6), brushed(), dx, dY, d / 2 + 0.023, 0, 0, PI2);
        for (const ex of [-dw * 0.16, dw * 0.16]) add(new THREE.SphereGeometry(0.008, 6, 6), brushed(), dx + ex, dY, d / 2 + 0.023);
      }
      for (let i = 1; i < doors; i++) add(new THREE.BoxGeometry(0.013, (H - legH) * 0.92, 0.015), darkSl(), -w / 2 + dw * i, legH + (H - legH) * 0.5, d / 2 + 0.007);
      break;
    }

    /* ── Default ─────────────────────────────────────────── */
    default: {
      if (def.shape === 'cylinder') add(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, H, 24), mainM(), 0, H / 2, 0);
      else add(new THREE.BoxGeometry(w, H, d), mainM(), 0, H / 2, 0);
    }
  }

  const rotDeg = ((el.rotation || 0) % 360 + 360) % 360;
  const isRotated = rotDeg === 90 || rotDeg === 270;
  const bbW = isRotated ? d : w;
  const bbD = isRotated ? w : d;
  const cx = cmToM(el.x) + bbW / 2;
  const cz = cmToM(el.y) + bbD / 2;
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
        <input
          type="number"
          className="pv-step-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit(draft)}
          min={min}
          max={max}
          step={step}
        />
        <span className="pv-step-unit">cm</span>
        <button className="pv-step-btn" onClick={() => stepBy(step)}>+</button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlanViewer3D({ plan, onChange, onClose, onBackTo2D }) {
  const containerRef = useRef(null);
  const [showPanel, setShowPanel] = useState(false);

  const updateRoom = (key, val) => {
    if (!onChange) return;
    const lim = ROOM_LIMITS[key] || { min: 50, max: 2000 };
    const v = Math.max(lim.min, Math.min(lim.max, Number(val) || lim.min));
    const nextRoom = { ...plan.room, [key]: v };
    const nextElements = plan.elements.map(el => clampToRoom(el, nextRoom));
    onChange({ ...plan, room: nextRoom, elements: nextElements });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdde3ed);

    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting — lumière ambiante chaude + soleil chaud + fill bleu
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.58));
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.90);
    sun.position.set(7, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
    sun.shadow.camera.top  =  14; sun.shadow.camera.bottom = -14;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd8e8ff, 0.30);
    fill.position.set(-4, 5, -3);
    scene.add(fill);

    const roomW = cmToM(plan.room.width);
    const roomD = cmToM(plan.room.depth);
    const roomH = cmToM(plan.room.height);

    // Point light au plafond
    const ceiling = new THREE.PointLight(0xfff0dc, 0.26, Math.max(roomW, roomD) * 4);
    ceiling.position.set(roomW / 2, roomH * 0.95, roomD / 2);
    scene.add(ceiling);

    // Sol (carrelage beige chaud)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xddd8d0, roughness: 0.88 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(roomW / 2, 0, roomD / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grille de sol légère
    const grid = new THREE.GridHelper(Math.max(roomW, roomD) * 2, 20, 0xc8c0b4, 0xd8d0c8);
    grid.position.y = 0.001;
    scene.add(grid);

    // Murs (blanc cassé chaud)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ee, roughness: 0.95 });
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
            <DimStepper label="Hauteur"    value={plan.room.height} onStep={v => updateRoom('height', v)} step={5}  min={ROOM_LIMITS.height.min} max={ROOM_LIMITS.height.max} />
          </div>
        )}
        <div className="pv-hint">
          🖱️ Glisser pour pivoter · molette pour zoomer · clic-droit pour déplacer · 📱 Pincer pour zoomer
        </div>
      </div>
    </div>
  );
}
