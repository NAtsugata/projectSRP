// src/components/ir-shower/planEditor/PlanEditor2D.jsx
// Éditeur de plan 2D, optimisé tactile + souris.

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ELEMENT_CATEGORIES, ELEMENT_CATALOG, getElementsByCategory } from '../../../lib/planElements';
import { createElement, snap, clampToRoom } from '../../../lib/planModel';
import './PlanEditor2D.css';

const GRID_SIZE = 10;   // cm
const PADDING = 30;     // cm autour de la pièce pour l'affichage SVG
const MIN_HIT_CM = 40;  // taille minimale (en cm) de la zone tactile d'un élément

const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

// ── Stepper (module-level so hooks are stable across renders) ─────────────────
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
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commit(draft)}
        min={min}
        max={max}
        step={step}
        className="pe-stepper-input"
      />
      <span className="pe-stepper-unit">{unit}</span>
      <button type="button" className="pe-stepper-btn" onClick={() => stepBy(step)} aria-label="Augmenter">+</button>
    </div>
  );
}

export default function PlanEditor2D({ plan, onChange, onOpen3D, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('shower');
  const [showPalette, setShowPalette] = useState(() => !isMobileViewport());
  const [showProps, setShowProps] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const elementsByCategory = useMemo(() => getElementsByCategory(), []);
  const selectedElement = useMemo(
    () => plan.elements.find(e => e.id === selectedId),
    [plan.elements, selectedId]
  );

  // Ferme automatiquement le panneau de propriétés si l'élément est désélectionné
  useEffect(() => {
    if (!selectedId) setShowProps(false);
  }, [selectedId]);

  const vbX = -PADDING;
  const vbY = -PADDING;
  const vbW = plan.room.width + PADDING * 2;
  const vbH = plan.room.depth + PADDING * 2;

  // ── Conversion coordonnées écran → coordonnées plan ──
  const toLocal = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  // ── Manipulation des éléments ──
  const updateElement = useCallback((id, patch) => {
    onChange({
      ...plan,
      elements: plan.elements.map(e => e.id === id ? { ...e, ...patch } : e),
    });
  }, [plan, onChange]);

  const deleteElement = useCallback((id) => {
    onChange({ ...plan, elements: plan.elements.filter(e => e.id !== id) });
    setSelectedId(null);
  }, [plan, onChange]);

  const duplicateElement = useCallback((id) => {
    const src = plan.elements.find(e => e.id === id);
    if (!src) return;
    const offset = 20;
    const newX = snap(Math.min(plan.room.width - src.width - 1, src.x + offset));
    const newY = snap(Math.min(plan.room.depth - src.depth - 1, src.y + offset));
    const copy = createElement(src.type, { ...src, x: newX, y: newY });
    onChange({ ...plan, elements: [...plan.elements, copy] });
    setSelectedId(copy.id);
  }, [plan, onChange]);

  const addElement = useCallback((type) => {
    const def = ELEMENT_CATALOG[type];
    const w = def?.defaultWidth ?? 60;
    const d = def?.defaultDepth ?? 60;
    const el = createElement(type, {
      x: snap(Math.max(0, plan.room.width / 2 - w / 2)),
      y: snap(Math.max(0, plan.room.depth / 2 - d / 2)),
    });
    onChange({ ...plan, elements: [...plan.elements, el] });
    setSelectedId(el.id);
    // Ferme la palette automatiquement sur mobile pour voir l'élément ajouté
    if (isMobileViewport()) setShowPalette(false);
  }, [plan, onChange]);

  // ── Drag handlers ──
  const handlePointerDown = (e, element) => {
    e.stopPropagation();
    setSelectedId(element.id);
    const local = toLocal(e.clientX, e.clientY);
    dragRef.current = {
      id: element.id,
      offsetX: local.x - element.x,
      offsetY: local.y - element.y,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    const local = toLocal(e.clientX, e.clientY);
    const newX = snap(local.x - dragRef.current.offsetX, GRID_SIZE);
    const newY = snap(local.y - dragRef.current.offsetY, GRID_SIZE);
    const el = plan.elements.find(x => x.id === dragRef.current.id);
    if (!el) return;
    const clamped = clampToRoom({ ...el, x: newX, y: newY }, plan.room);
    updateElement(el.id, { x: clamped.x, y: clamped.y });
  };

  const handlePointerUp = (e) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleCanvasClick = (e) => {
    if (e.target === svgRef.current || e.target.classList.contains('plan-bg')) {
      setSelectedId(null);
    }
  };

  const updateRoom = (key, value) => {
    const v = Math.max(50, Math.min(2000, Number(value) || 0));
    onChange({ ...plan, room: { ...plan.room, [key]: v } });
  };

  // ── Rendu d'un élément 2D ──
  const renderElement = (el) => {
    const def = ELEMENT_CATALOG[el.type];
    if (!def) return null;
    const isSelected = el.id === selectedId;
    const isRotated = el.rotation % 180 !== 0;
    const w = isRotated ? el.depth : el.width;
    const h = isRotated ? el.width : el.depth;

    // Zone de tap agrandie pour les petits éléments
    const padX = Math.max(0, (MIN_HIT_CM - w) / 2);
    const padY = Math.max(0, (MIN_HIT_CM - h) / 2);

    return (
      <g
        key={el.id}
        transform={`translate(${el.x},${el.y})`}
        className={`plan-el ${isSelected ? 'selected' : ''}`}
        onPointerDown={(e) => handlePointerDown(e, el)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: 'move', touchAction: 'none' }}
      >
        {/* Zone de tap invisible (au moins MIN_HIT_CM × MIN_HIT_CM) */}
        {(padX > 0 || padY > 0) && (
          <rect
            x={-padX}
            y={-padY}
            width={w + padX * 2}
            height={h + padY * 2}
            fill="transparent"
            pointerEvents="all"
          />
        )}
        {/* Forme visible */}
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill={def.color}
          fillOpacity={def.opacity ?? 0.85}
          stroke={isSelected ? '#2563eb' : '#475569'}
          strokeWidth={isSelected ? 2.5 : 1}
          rx={3}
        />
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(w, h) * 0.4}
          fill="#1e293b"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {def.icon}
        </text>
        {isSelected && (
          <>
            {/* Halo de sélection */}
            <rect
              x={-3}
              y={-3}
              width={w + 6}
              height={h + 6}
              fill="none"
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              rx={4}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={w / 2}
              y={h + 16}
              textAnchor="middle"
              fontSize={11}
              fill="#2563eb"
              fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {def.label} · {el.width}×{el.depth}cm
            </text>
          </>
        )}
      </g>
    );
  };

  const gridLines = useMemo(() => {
    const lines = [];
    for (let x = 0; x <= plan.room.width; x += GRID_SIZE * 5) {
      lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={plan.room.depth} stroke="#e2e8f0" strokeWidth={0.5} />);
    }
    for (let y = 0; y <= plan.room.depth; y += GRID_SIZE * 5) {
      lines.push(<line key={`hy${y}`} x1={0} y1={y} x2={plan.room.width} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />);
    }
    return lines;
  }, [plan.room.width, plan.room.depth]);

  return (
    <div className="plan-editor-2d">
      {/* ── Toolbar ── */}
      <div className="pe-toolbar">
        <div className="pe-toolbar-left">
          <button className="pe-btn pe-btn-icon-big" onClick={onClose} title="Fermer">✕</button>
          <span className="pe-title">Plan IR Douche</span>
        </div>
        <div className="pe-toolbar-right">
          <button
            className={`pe-btn pe-btn-icon-big ${showPalette ? 'active' : ''}`}
            onClick={() => setShowPalette(s => !s)}
            title="Palette"
            aria-label="Afficher la palette"
          >
            📦
          </button>
          <button className="pe-btn pe-btn-primary" onClick={onOpen3D} title="Voir en 3D">
            🎲 <span className="pe-btn-text">3D</span>
          </button>
        </div>
      </div>

      <div className="pe-body">
        {/* ── Backdrop mobile pour fermer la palette en tapant à côté ── */}
        {showPalette && (
          <div
            className="pe-palette-backdrop"
            onClick={() => setShowPalette(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Palette d'éléments ── */}
        {showPalette && (
          <aside className="pe-palette">
            <div className="pe-palette-header">
              <h4>Éléments</h4>
              <button
                className="pe-btn-icon"
                onClick={() => setShowPalette(false)}
                aria-label="Fermer la palette"
              >✕</button>
            </div>

            <div className="pe-room-controls">
              <h4>Pièce</h4>
              <label>
                Largeur
                <Stepper
                  value={plan.room.width}
                  onChange={(v) => updateRoom('width', v)}
                  step={10} min={50} max={2000}
                />
              </label>
              <label>
                Profondeur
                <Stepper
                  value={plan.room.depth}
                  onChange={(v) => updateRoom('depth', v)}
                  step={10} min={50} max={2000}
                />
              </label>
              <label>
                Hauteur
                <Stepper
                  value={plan.room.height}
                  onChange={(v) => updateRoom('height', v)}
                  step={5} min={150} max={500}
                />
              </label>
            </div>

            <div className="pe-categories">
              {ELEMENT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`pe-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className="pe-cat-icon">{cat.icon}</span>
                  <span className="pe-cat-label">{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="pe-elements-grid">
              {(elementsByCategory[activeCategory] || []).map(el => (
                <button
                  key={el.type}
                  className="pe-element-tile"
                  onClick={() => addElement(el.type)}
                  title={`Ajouter ${el.label}`}
                >
                  <div
                    className="pe-element-preview"
                    style={{ background: el.color, opacity: el.opacity ?? 1 }}
                  >
                    <span>{el.icon}</span>
                  </div>
                  <span className="pe-element-name">{el.label}</span>
                  <span className="pe-element-size">{el.defaultWidth}×{el.defaultDepth}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* ── Canvas SVG ── */}
        <div className="pe-canvas-wrap">
          <svg
            ref={svgRef}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            className="pe-canvas"
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect
              className="plan-bg"
              x={vbX} y={vbY} width={vbW} height={vbH}
              fill="#f8fafc"
            />
            <rect
              x={0} y={0}
              width={plan.room.width} height={plan.room.depth}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={2}
              className="plan-bg"
            />
            <g>{gridLines}</g>

            <g className="pe-dimensions" style={{ pointerEvents: 'none' }}>
              <text
                x={plan.room.width / 2}
                y={-10}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="#0f172a"
              >
                {plan.room.width} cm
              </text>
              <text
                x={-10}
                y={plan.room.depth / 2}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="#0f172a"
                transform={`rotate(-90, -10, ${plan.room.depth / 2})`}
              >
                {plan.room.depth} cm
              </text>
            </g>

            {plan.elements.map(renderElement)}
          </svg>

          {/* ── Hint quand vide ── */}
          {plan.elements.length === 0 && !showPalette && (
            <div className="pe-empty-hint">
              <div className="pe-empty-icon">📦</div>
              <p>Touchez « Palette » pour ajouter un élément</p>
              <button
                className="pe-btn pe-btn-primary pe-empty-cta"
                onClick={() => setShowPalette(true)}
              >
                Ouvrir la palette
              </button>
            </div>
          )}

          {/* ── FAB (actions flottantes) pour l'élément sélectionné ── */}
          {selectedElement && (
            <div className="pe-fab-bar">
              <button
                className="pe-fab"
                onClick={() => updateElement(selectedElement.id, { rotation: (selectedElement.rotation + 90) % 360 })}
                title="Pivoter 90°"
                aria-label="Pivoter"
              >↻</button>
              <button
                className="pe-fab"
                onClick={() => duplicateElement(selectedElement.id)}
                title="Dupliquer"
                aria-label="Dupliquer"
              >⎘</button>
              <button
                className="pe-fab pe-fab-edit"
                onClick={() => setShowProps(true)}
                title="Modifier les dimensions"
                aria-label="Modifier"
              >✎</button>
              <button
                className="pe-fab pe-fab-delete"
                onClick={() => deleteElement(selectedElement.id)}
                title="Supprimer"
                aria-label="Supprimer"
              >🗑</button>
            </div>
          )}
        </div>

        {/* ── Panneau propriétés (bottom-sheet sur mobile) ── */}
        {selectedElement && showProps && (
          <aside className="pe-props">
            <div className="pe-props-header">
              <h4>{ELEMENT_CATALOG[selectedElement.type]?.label}</h4>
              <button className="pe-btn-icon" onClick={() => setShowProps(false)} title="Fermer">✕</button>
            </div>

            <label>
              Largeur
              <Stepper
                value={selectedElement.width}
                onChange={(v) => updateElement(selectedElement.id, { width: v })}
                step={5} min={1} max={500}
              />
            </label>
            <label>
              Profondeur
              <Stepper
                value={selectedElement.depth}
                onChange={(v) => updateElement(selectedElement.id, { depth: v })}
                step={5} min={1} max={500}
              />
            </label>
            <label>
              Hauteur
              <Stepper
                value={selectedElement.height}
                onChange={(v) => updateElement(selectedElement.id, { height: v })}
                step={5} min={1} max={300}
              />
            </label>
            <label>
              Position X
              <Stepper
                value={selectedElement.x}
                onChange={(v) => updateElement(selectedElement.id, { x: snap(v) })}
                step={GRID_SIZE} min={0} max={plan.room.width}
              />
            </label>
            <label>
              Position Y
              <Stepper
                value={selectedElement.y}
                onChange={(v) => updateElement(selectedElement.id, { y: snap(v) })}
                step={GRID_SIZE} min={0} max={plan.room.depth}
              />
            </label>

            <div className="pe-props-actions">
              <button
                className="pe-btn pe-btn-rotate"
                onClick={() => updateElement(selectedElement.id, { rotation: (selectedElement.rotation + 90) % 360 })}
              >
                ↻ Pivoter
              </button>
              <button
                className="pe-btn pe-btn-delete"
                onClick={() => deleteElement(selectedElement.id)}
              >
                🗑 Supprimer
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
