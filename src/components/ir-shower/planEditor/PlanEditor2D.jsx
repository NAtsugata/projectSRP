// src/components/ir-shower/planEditor/PlanEditor2D.jsx
// Éditeur de plan 2D, optimisé tactile + souris.

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ELEMENT_CATEGORIES, ELEMENT_CATALOG, getElementsByCategory } from '../../../lib/planElements';
import { createElement, snap, clampToRoom, ROOM_LIMITS } from '../../../lib/planModel';
import './PlanEditor2D.css';

const GRID_SIZE    = 10;  // cm
const PADDING      = 40;  // cm around room in SVG
const MIN_HIT_CM   = 40;  // min tap area for small elements
const WALL_SNAP_CM = 14;  // snap-to-wall threshold (cm)
const HISTORY_LIMIT = 60;

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

// ── Stepper (module-level — hooks must not be inside component body) ──────────
function Stepper({ value, onChange: onStepChange, step = 10, min = 1, max = 500, unit = 'cm' }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  function commit(raw) {
    const num = parseInt(raw, 10);
    const clamped = isNaN(num) ? value : Math.max(min, Math.min(max, num));
    setDraft(String(clamped));
    onStepChange(clamped);
  }
  function stepBy(delta) {
    const next = Math.max(min, Math.min(max, value + delta));
    setDraft(String(next));
    onStepChange(next);
  }

  return (
    <div className="pe-stepper">
      <button type="button" className="pe-stepper-btn" onClick={() => stepBy(-step)} aria-label="Diminuer">−</button>
      <input
        type="number" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commit(draft)}
        min={min} max={max} step={step}
        className="pe-stepper-input"
      />
      <span className="pe-stepper-unit">{unit}</span>
      <button type="button" className="pe-stepper-btn" onClick={() => stepBy(step)} aria-label="Augmenter">+</button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PlanEditor2D({ plan, onChange, onOpen3D, onClose }) {
  const [selectedId,    setSelectedId]    = useState(null);
  const [activeCategory, setActiveCategory] = useState('shower');
  const [showPalette,   setShowPalette]   = useState(() => !isMobileViewport());
  const [showProps,     setShowProps]     = useState(false);
  const [zoom,          setZoom]          = useState(1);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [snapEdges,     setSnapEdges]     = useState({ x: null, y: null }); // 'left'|'right'|null, 'top'|'bottom'|null
  const [histIdx,       setHistIdx]       = useState(0); // for button enable state

  const historyRef      = useRef([plan]);
  const histIdxRef      = useRef(0);
  const svgRef          = useRef(null);
  const wrapRef         = useRef(null);
  const dragRef         = useRef(null);
  const deleteElementRef = useRef(null); // stable ref for keyboard handler

  const elementsByCategory = useMemo(() => getElementsByCategory(), []);
  const selectedElement    = useMemo(
    () => plan.elements.find(e => e.id === selectedId),
    [plan.elements, selectedId],
  );

  useEffect(() => { if (!selectedId) setShowProps(false); }, [selectedId]);

  // ── Zoom-aware viewBox ─────────────────────────────────────────────────────
  const fullW = plan.room.width  + PADDING * 2;
  const fullH = plan.room.depth  + PADDING * 2;
  const vbW   = fullW / zoom;
  const vbH   = fullH / zoom;
  const vbX   = -PADDING + (fullW - vbW) / 2;
  const vbY   = -PADDING + (fullH - vbH) / 2;

  // ── History ────────────────────────────────────────────────────────────────
  const pushChange = useCallback((newPlan) => {
    const newHist = historyRef.current.slice(0, histIdxRef.current + 1);
    newHist.push(newPlan);
    if (newHist.length > HISTORY_LIMIT) newHist.shift();
    historyRef.current = newHist;
    histIdxRef.current = newHist.length - 1;
    setHistIdx(histIdxRef.current);
    onChange(newPlan);
  }, [onChange]);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    setHistIdx(histIdxRef.current);
    onChange(historyRef.current[histIdxRef.current]);
  }, [onChange]);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    setHistIdx(histIdxRef.current);
    onChange(historyRef.current[histIdxRef.current]);
  }, [onChange]);

  const canUndo = histIdx > 0;
  const canRedo = histIdx < historyRef.current.length - 1;

  // ── Coordinates screen → plan ──────────────────────────────────────────────
  const toLocal = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const handler = (e) => {
      e.preventDefault();
      setZoom(z => Math.max(0.15, Math.min(8, z * (e.deltaY > 0 ? 1 / 1.15 : 1.15))));
    };
    wrap.addEventListener('wheel', handler, { passive: false });
    return () => wrap.removeEventListener('wheel', handler);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(z => Math.min(8, z * 1.25)); return; }
      if (ctrl && e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.15, z / 1.25)); return; }
      if (ctrl && e.key === '0') { e.preventDefault(); setZoom(1); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId &&
          !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        deleteElementRef.current?.(selectedId);
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedId]); // deleteElement defined below; stable via pushChange ref

  // ── Element manipulation ───────────────────────────────────────────────────
  const updateElement = useCallback((id, patch) => {
    pushChange({
      ...plan,
      elements: plan.elements.map(e => {
        if (e.id !== id) return e;
        return clampToRoom({ ...e, ...patch }, plan.room);
      }),
    });
  }, [plan, pushChange]);

  const deleteElement = useCallback((id) => {
    pushChange({ ...plan, elements: plan.elements.filter(e => e.id !== id) });
    setSelectedId(null);
  }, [plan, pushChange]);
  useEffect(() => { deleteElementRef.current = deleteElement; }, [deleteElement]);

  const duplicateElement = useCallback((id) => {
    const src = plan.elements.find(e => e.id === id);
    if (!src) return;
    const draft = createElement(src.type, { ...src, x: src.x + 20, y: src.y + 20 });
    const copy  = { ...clampToRoom(draft, plan.room) };
    copy.x = snap(copy.x); copy.y = snap(copy.y);
    pushChange({ ...plan, elements: [...plan.elements, copy] });
    setSelectedId(copy.id);
  }, [plan, pushChange]);

  const addElement = useCallback((type) => {
    const def = ELEMENT_CATALOG[type];
    const w = def?.defaultWidth ?? 60;
    const d = def?.defaultDepth ?? 60;
    const el = createElement(type, {
      x: snap(Math.max(0, plan.room.width  / 2 - w / 2)),
      y: snap(Math.max(0, plan.room.depth  / 2 - d / 2)),
    });
    pushChange({ ...plan, elements: [...plan.elements, el] });
    setSelectedId(el.id);
    if (isMobileViewport()) setShowPalette(false);
  }, [plan, pushChange]);

  const rotateElement = useCallback((id) => {
    const el = plan.elements.find(e => e.id === id);
    if (!el) return;
    const rotated = { ...el, rotation: (el.rotation + 90) % 360 };
    const clamped = clampToRoom(rotated, plan.room);
    updateElement(id, { rotation: clamped.rotation, x: clamped.x, y: clamped.y });
  }, [plan, updateElement]);

  const updateRoom = useCallback((key, value) => {
    const lim = ROOM_LIMITS[key] || { min: 50, max: 2000 };
    const v   = Math.max(lim.min, Math.min(lim.max, Number(value) || lim.min));
    const nextRoom = { ...plan.room, [key]: v };
    const nextElements = plan.elements.map(el => clampToRoom(el, nextRoom));
    pushChange({ ...plan, room: nextRoom, elements: nextElements });
  }, [plan, pushChange]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e, element) => {
    e.stopPropagation();
    setSelectedId(element.id);
    const local = toLocal(e.clientX, e.clientY);
    dragRef.current = {
      id:       element.id,
      offsetX:  local.x - element.x,
      offsetY:  local.y - element.y,
      pointerId: e.pointerId,
      moved:    false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [toLocal]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const local = toLocal(e.clientX, e.clientY);
    const el    = plan.elements.find(x => x.id === dragRef.current.id);
    if (!el) return;

    const rawX     = snap(local.x - dragRef.current.offsetX, GRID_SIZE);
    const rawY     = snap(local.y - dragRef.current.offsetY, GRID_SIZE);
    const isRotated = el.rotation % 180 !== 0;
    const elW      = isRotated ? el.depth : el.width;
    const elD      = isRotated ? el.width : el.depth;

    // Snap to walls
    let newX = rawX, newY = rawY;
    let snapX = null, snapY = null;
    if (rawX < WALL_SNAP_CM) { newX = 0; snapX = 'left'; }
    else if (plan.room.width - rawX - elW < WALL_SNAP_CM) { newX = plan.room.width - elW; snapX = 'right'; }
    if (rawY < WALL_SNAP_CM) { newY = 0; snapY = 'top'; }
    else if (plan.room.depth - rawY - elD < WALL_SNAP_CM) { newY = plan.room.depth - elD; snapY = 'bottom'; }

    const clamped = clampToRoom({ ...el, x: newX, y: newY }, plan.room);
    dragRef.current.moved   = true;
    dragRef.current.latestX = clamped.x;
    dragRef.current.latestY = clamped.y;

    setSnapEdges({ x: snapX, y: snapY });
    // Live preview — no history entry until drop
    onChange({
      ...plan,
      elements: plan.elements.map(x => x.id === el.id ? { ...x, x: clamped.x, y: clamped.y } : x),
    });
  }, [plan, onChange, toLocal]);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const { id, moved, latestX, latestY } = dragRef.current;
    dragRef.current = null;
    setSnapEdges({ x: null, y: null });

    if (moved && latestX !== undefined) {
      // Push final position to history
      pushChange({
        ...plan,
        elements: plan.elements.map(x => x.id === id ? { ...x, x: latestX, y: latestY } : x),
      });
    }
  }, [plan, pushChange]);

  const handleCanvasClick = (e) => {
    if (e.target === svgRef.current || e.target.classList.contains('plan-bg')) {
      setSelectedId(null);
    }
  };

  // ── Search filter ──────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return Object.values(elementsByCategory).flat()
      .filter(el => el.label.toLowerCase().includes(q) || el.type.includes(q));
  }, [elementsByCategory, searchQuery]);

  const displayElements = searchResults ?? (elementsByCategory[activeCategory] || []);

  // ── Grid lines ─────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const lines = [];
    for (let x = 0; x <= plan.room.width; x += GRID_SIZE * 5)
      lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={plan.room.depth} stroke="#e2e8f0" strokeWidth={0.5} />);
    for (let y = 0; y <= plan.room.depth; y += GRID_SIZE * 5)
      lines.push(<line key={`hy${y}`} x1={0} y1={y} x2={plan.room.width} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />);
    return lines;
  }, [plan.room.width, plan.room.depth]);

  // ── Wall snap highlight rects ──────────────────────────────────────────────
  const snapW = 3; // width of snap highlight stripe in cm
  const snapHighlights = useMemo(() => {
    const rects = [];
    const { x: sx, y: sy } = snapEdges;
    if (sx === 'left')   rects.push(<rect key="sl" x={0}                              y={0} width={snapW} height={plan.room.depth} fill="#2563eb" opacity={0.22} style={{pointerEvents:'none'}} />);
    if (sx === 'right')  rects.push(<rect key="sr" x={plan.room.width - snapW}        y={0} width={snapW} height={plan.room.depth} fill="#2563eb" opacity={0.22} style={{pointerEvents:'none'}} />);
    if (sy === 'top')    rects.push(<rect key="st" x={0} y={0}                        width={plan.room.width} height={snapW} fill="#2563eb" opacity={0.22} style={{pointerEvents:'none'}} />);
    if (sy === 'bottom') rects.push(<rect key="sb" x={0} y={plan.room.depth - snapW}  width={plan.room.width} height={snapW} fill="#2563eb" opacity={0.22} style={{pointerEvents:'none'}} />);
    return rects;
  }, [snapEdges, plan.room.width, plan.room.depth]);

  // ── Element render ─────────────────────────────────────────────────────────
  const renderElement = (el) => {
    const def = ELEMENT_CATALOG[el.type];
    if (!def) return null;
    const isSelected = el.id === selectedId;
    const isRotated  = el.rotation % 180 !== 0;
    const w = isRotated ? el.depth  : el.width;
    const h = isRotated ? el.width  : el.depth;
    const padX = Math.max(0, (MIN_HIT_CM - w) / 2);
    const padY = Math.max(0, (MIN_HIT_CM - h) / 2);
    const labelFontSize = Math.max(6, Math.min(11, Math.min(w, h) * 0.18));

    return (
      <g
        key={el.id}
        transform={`translate(${el.x},${el.y})`}
        className={`plan-el${isSelected ? ' selected' : ''}`}
        onPointerDown={(e) => handlePointerDown(e, el)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: 'move', touchAction: 'none' }}
      >
        {(padX > 0 || padY > 0) && (
          <rect x={-padX} y={-padY} width={w + padX * 2} height={h + padY * 2}
            fill="transparent" pointerEvents="all" />
        )}
        <rect x={0} y={0} width={w} height={h}
          fill={def.color} fillOpacity={def.opacity ?? 0.85}
          stroke={isSelected ? '#2563eb' : '#475569'}
          strokeWidth={isSelected ? 2.5 : 1} rx={3} />

        {/* Element icon */}
        <text x={w / 2} y={h / 2 - (h > 28 ? 5 : 0)}
          textAnchor="middle" dominantBaseline="central"
          fontSize={Math.min(w, h) * 0.38} fill="#1e293b"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {def.icon}
        </text>

        {/* Always-visible dimension label (inside element) */}
        {h > 24 && (
          <text x={w / 2} y={h - labelFontSize * 0.6}
            textAnchor="middle" dominantBaseline="central"
            fontSize={labelFontSize} fill="#334155" fontWeight={600}
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {el.width}×{el.depth}
          </text>
        )}

        {isSelected && (
          <>
            <rect x={-3} y={-3} width={w + 6} height={h + 6}
              fill="none" stroke="#2563eb" strokeWidth={1.5}
              strokeDasharray="4 3" rx={4} style={{ pointerEvents: 'none' }} />
            {/* Selection label above */}
            <text x={w / 2} y={-8}
              textAnchor="middle" fontSize={10} fill="#2563eb" fontWeight={700}
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {def.label} · {el.width}×{el.depth}cm
            </text>
          </>
        )}
      </g>
    );
  };

  // ── Room area in m² ────────────────────────────────────────────────────────
  const roomArea = ((plan.room.width / 100) * (plan.room.depth / 100)).toFixed(2);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="plan-editor-2d">

      {/* ── Toolbar ── */}
      <div className="pe-toolbar">
        <div className="pe-toolbar-left">
          <button className="pe-btn pe-btn-icon-big" onClick={onClose} title="Fermer">✕</button>
          <span className="pe-title">Plan IR Douche</span>

          {/* Undo / Redo */}
          <button className="pe-btn pe-btn-icon-big" onClick={undo} disabled={!canUndo}
            title="Annuler (Ctrl+Z)" aria-label="Annuler">↩</button>
          <button className="pe-btn pe-btn-icon-big" onClick={redo} disabled={!canRedo}
            title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↪</button>
        </div>
        <div className="pe-toolbar-right">
          <span className="pe-room-info">{plan.room.width}×{plan.room.depth}cm · {roomArea} m²</span>
          <button
            className={`pe-btn pe-btn-icon-big${showPalette ? ' active' : ''}`}
            onClick={() => setShowPalette(s => !s)}
            title="Palette" aria-label="Afficher la palette"
          >📦</button>
          <button className="pe-btn pe-btn-primary" onClick={onOpen3D} title="Voir en 3D">
            🎲 <span className="pe-btn-text">3D</span>
          </button>
        </div>
      </div>

      <div className="pe-body">
        {/* ── Backdrop palette (mobile) ── */}
        {showPalette && (
          <div className="pe-palette-backdrop" onClick={() => setShowPalette(false)} aria-hidden="true" />
        )}

        {/* ── Palette ── */}
        {showPalette && (
          <aside className="pe-palette">
            <div className="pe-palette-header">
              <h4>Éléments</h4>
              <button className="pe-btn-icon" onClick={() => setShowPalette(false)} aria-label="Fermer">✕</button>
            </div>

            {/* Room dimensions */}
            <div className="pe-room-controls">
              <h4>Pièce <span className="pe-room-area">({roomArea} m²)</span></h4>
              <label>Largeur
                <Stepper value={plan.room.width}  onChange={v => updateRoom('width',  v)}
                  step={10} min={ROOM_LIMITS.width.min}  max={ROOM_LIMITS.width.max} />
              </label>
              <label>Profondeur
                <Stepper value={plan.room.depth}  onChange={v => updateRoom('depth',  v)}
                  step={10} min={ROOM_LIMITS.depth.min}  max={ROOM_LIMITS.depth.max} />
              </label>
              <label>Hauteur
                <Stepper value={plan.room.height} onChange={v => updateRoom('height', v)}
                  step={5}  min={ROOM_LIMITS.height.min} max={ROOM_LIMITS.height.max} />
              </label>
            </div>

            {/* Search */}
            <div className="pe-search">
              <input
                type="search" placeholder="🔍 Rechercher un élément…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pe-search-input"
              />
            </div>

            {/* Category tabs (hidden when searching) */}
            {!searchQuery && (
              <div className="pe-categories">
                {ELEMENT_CATEGORIES.map(cat => (
                  <button key={cat.id}
                    className={`pe-cat-btn${activeCategory === cat.id ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}>
                    <span className="pe-cat-icon">{cat.icon}</span>
                    <span className="pe-cat-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Element grid */}
            <div className="pe-elements-grid">
              {displayElements.length === 0 ? (
                <p className="pe-no-results">Aucun résultat</p>
              ) : displayElements.map(el => (
                <button key={el.type} className="pe-element-tile"
                  onClick={() => addElement(el.type)} title={`Ajouter ${el.label}`}>
                  <div className="pe-element-preview"
                    style={{ background: el.color, opacity: el.opacity ?? 1 }}>
                    <span>{el.icon}</span>
                  </div>
                  <span className="pe-element-name">{el.label}</span>
                  <span className="pe-element-size">{el.defaultWidth}×{el.defaultDepth}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* ── Canvas ── */}
        <div className="pe-canvas-wrap" ref={wrapRef}>
          <svg
            ref={svgRef}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            className="pe-canvas"
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Background */}
            <rect className="plan-bg" x={vbX} y={vbY} width={vbW} height={vbH} fill="#f0f4f8" />
            {/* Room */}
            <rect x={0} y={0} width={plan.room.width} height={plan.room.depth}
              fill="#ffffff" stroke="#0f172a" strokeWidth={2} className="plan-bg" />

            {/* Grid */}
            <g>{gridLines}</g>

            {/* Wall snap highlights */}
            <g>{snapHighlights}</g>

            {/* Center guides */}
            <line x1={plan.room.width / 2} y1={0} x2={plan.room.width / 2} y2={plan.room.depth}
              stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="8 6" style={{ pointerEvents: 'none' }} />
            <line x1={0} y1={plan.room.depth / 2} x2={plan.room.width} y2={plan.room.depth / 2}
              stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="8 6" style={{ pointerEvents: 'none' }} />

            {/* Room dimension labels */}
            <g className="pe-dimensions" style={{ pointerEvents: 'none' }}>
              {/* Top — width */}
              <line x1={0} y1={-16} x2={plan.room.width} y2={-16} stroke="#475569" strokeWidth={1} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
              <text x={plan.room.width / 2} y={-20} textAnchor="middle"
                fontSize={12} fontWeight={700} fill="#0f172a">{plan.room.width} cm</text>
              {/* Left — depth */}
              <text x={-18} y={plan.room.depth / 2} textAnchor="middle"
                fontSize={12} fontWeight={700} fill="#0f172a"
                transform={`rotate(-90, -18, ${plan.room.depth / 2})`}>{plan.room.depth} cm</text>
              {/* Bottom — width repeat */}
              <text x={plan.room.width / 2} y={plan.room.depth + 22} textAnchor="middle"
                fontSize={10} fill="#64748b">{(plan.room.width / 100).toFixed(2)} m</text>
              {/* Right — depth repeat */}
              <text x={plan.room.width + 22} y={plan.room.depth / 2} textAnchor="middle"
                fontSize={10} fill="#64748b"
                transform={`rotate(90, ${plan.room.width + 22}, ${plan.room.depth / 2})`}>{(plan.room.depth / 100).toFixed(2)} m</text>
            </g>

            {/* Elements */}
            {plan.elements.map(renderElement)}
          </svg>

          {/* ── Zoom controls ── */}
          <div className="pe-zoom-bar">
            <button className="pe-zoom-btn" onClick={() => setZoom(z => Math.min(8, z * 1.25))} title="Zoom avant (Ctrl++)">+</button>
            <button className="pe-zoom-level" onClick={() => setZoom(1)} title="Réinitialiser le zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button className="pe-zoom-btn" onClick={() => setZoom(z => Math.max(0.15, z / 1.25))} title="Zoom arrière (Ctrl+−)">−</button>
          </div>

          {/* ── Empty hint ── */}
          {plan.elements.length === 0 && !showPalette && (
            <div className="pe-empty-hint">
              <div className="pe-empty-icon">📦</div>
              <p>Ouvrez la palette pour ajouter un élément</p>
              <button className="pe-btn pe-btn-primary pe-empty-cta" onClick={() => setShowPalette(true)}>
                Ouvrir la palette
              </button>
            </div>
          )}

          {/* ── FAB bar (selected element) ── */}
          {selectedElement && (
            <div className="pe-fab-bar">
              <button className="pe-fab" onClick={() => rotateElement(selectedElement.id)}
                title="Pivoter 90° (R)" aria-label="Pivoter">↻</button>
              <button className="pe-fab" onClick={() => duplicateElement(selectedElement.id)}
                title="Dupliquer" aria-label="Dupliquer">⎘</button>
              <button className="pe-fab pe-fab-edit" onClick={() => setShowProps(true)}
                title="Dimensions" aria-label="Modifier">✎</button>
              <button className="pe-fab pe-fab-delete" onClick={() => deleteElement(selectedElement.id)}
                title="Supprimer (Del)" aria-label="Supprimer">🗑</button>
            </div>
          )}
        </div>

        {/* ── Properties panel ── */}
        {selectedElement && showProps && (
          <aside className="pe-props">
            <div className="pe-props-header">
              <h4>{ELEMENT_CATALOG[selectedElement.type]?.label}</h4>
              <button className="pe-btn-icon" onClick={() => setShowProps(false)} title="Fermer">✕</button>
            </div>

            <label>Largeur
              <Stepper value={selectedElement.width}
                onChange={v => updateElement(selectedElement.id, { width: v })}
                step={5} min={1} max={500} />
            </label>
            <label>Profondeur
              <Stepper value={selectedElement.depth}
                onChange={v => updateElement(selectedElement.id, { depth: v })}
                step={5} min={1} max={500} />
            </label>
            <label>Hauteur
              <Stepper value={selectedElement.height}
                onChange={v => updateElement(selectedElement.id, { height: v })}
                step={5} min={1} max={300} />
            </label>
            <label>Position X
              <Stepper value={selectedElement.x}
                onChange={v => updateElement(selectedElement.id, { x: snap(v) })}
                step={GRID_SIZE} min={0} max={plan.room.width} />
            </label>
            <label>Position Y
              <Stepper value={selectedElement.y}
                onChange={v => updateElement(selectedElement.id, { y: snap(v) })}
                step={GRID_SIZE} min={0} max={plan.room.depth} />
            </label>

            <div className="pe-props-position-info">
              <span>Position: ({selectedElement.x}, {selectedElement.y}) cm</span>
              <span>Rotation: {selectedElement.rotation}°</span>
            </div>

            <div className="pe-props-actions">
              <button className="pe-btn pe-btn-rotate" onClick={() => rotateElement(selectedElement.id)}>
                ↻ Pivoter
              </button>
              <button className="pe-btn pe-btn-delete" onClick={() => deleteElement(selectedElement.id)}>
                🗑 Supprimer
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
