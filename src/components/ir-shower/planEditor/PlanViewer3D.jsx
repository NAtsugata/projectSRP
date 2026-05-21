// src/components/ir-shower/planEditor/PlanViewer3D.jsx
// Viewer 3D du plan : extrude la pièce et les éléments en 3D avec Three.js.

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ELEMENT_CATALOG } from '../../../lib/planElements';
import './PlanViewer3D.css';

// Helpers
function cmToM(cm) { return cm / 100; }

function makeOrbitControls(camera, domElement) {
  // Mini OrbitControls maison (pour éviter d'importer le sous-paquet de Three).
  // Gère la rotation, le zoom et le pan en pointer events.
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
      // Pinch zoom
      const pts = [...state.activePointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (state.pinchDist > 0) {
        zoom(state.pinchDist / dist);
      }
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

export default function PlanViewer3D({ plan, onClose, onBackTo2D }) {
  const containerRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene setup ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f7);

    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lumières
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);

    // Conversion du plan
    const roomW = cmToM(plan.room.width);
    const roomD = cmToM(plan.room.depth);
    const roomH = cmToM(plan.room.height);

    // ── Sol ──
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(roomW / 2, 0, roomD / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grille décorative
    const grid = new THREE.GridHelper(Math.max(roomW, roomD) * 2, 20, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.001;
    scene.add(grid);

    // ── Murs (4 murs, pleins par défaut) ──
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.95 });
    const wallThickness = 0.1;

    const walls = [
      // Mur nord (Y=0)
      { x: roomW / 2, z: -wallThickness / 2, w: roomW + wallThickness * 2, d: wallThickness },
      // Mur sud (Y=depth)
      { x: roomW / 2, z: roomD + wallThickness / 2, w: roomW + wallThickness * 2, d: wallThickness },
      // Mur ouest (X=0)
      { x: -wallThickness / 2, z: roomD / 2, w: wallThickness, d: roomD },
      // Mur est (X=width)
      { x: roomW + wallThickness / 2, z: roomD / 2, w: wallThickness, d: roomD },
    ];

    for (const W of walls) {
      const geo = new THREE.BoxGeometry(W.w, roomH, W.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(W.x, roomH / 2, W.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // ── Éléments ──
    for (const el of plan.elements) {
      const def = ELEMENT_CATALOG[el.type];
      if (!def) continue;

      const isRotated = el.rotation % 180 !== 0;
      const w = cmToM(isRotated ? el.depth : el.width);
      const d = cmToM(isRotated ? el.width : el.depth);
      const elH = cmToM(el.height);

      // Position au sol (origine du plan = coin haut-gauche, X=largeur, Y=profondeur=Z 3D)
      const cx = cmToM(el.x) + w / 2;
      const cz = cmToM(el.y) + d / 2;
      // Hauteur depuis le sol : mountHeight si défini, sinon 0
      const cy = def.mountHeight ? cmToM(def.mountHeight) : elH / 2;

      let geometry;
      if (def.shape === 'cylinder') {
        const radius = Math.min(w, d) / 2;
        geometry = new THREE.CylinderGeometry(radius, radius, elH, 24);
      } else {
        geometry = new THREE.BoxGeometry(w, elH, d);
      }

      const isTransparent = def.opacity != null && def.opacity < 1;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.color),
        opacity: def.opacity ?? 1,
        transparent: isTransparent,
        roughness: isTransparent ? 0.15 : 0.7,
        metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(cx, def.mountHeight ? cy : elH / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Caméra : vue 3/4 par défaut
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

    // Boucle de rendu
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    stateRef.current = { renderer, scene, camera, controls, animId };

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
