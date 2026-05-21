// src/components/ir-shower/planEditor/PlanEditor2D.jsx
// Éditeur de plan 2D, optimisé tactile + souris.
// Utilise SVG pour les performances et la précision sur tous écrans.

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ELEMENT_CATEGORIES, ELEMENT_CATALOG, getElementsByCategory } from '../../../lib/planElements';
import { createElement, snap, clampToRoom } from '../../../lib/planModel';
import './PlanEditor2D.css';

const GRID_SIZE = 10; // cm
const PADDING = 30;   // cm autour de la pièce pour l'affichage SVG

export default function PlanEditor2D({ plan, onChange, onOpen3D, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('shower');
  const [showPalette, setShowPalette] = useState(true);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const elementsByCategory = useMemo(() => getElementsByCategory(), []);
  const selectedElement = useMemo(
    () => plan.elements.find(e => e.id === selectedId),
    [plan.elements, selectedId]
  );

  // Dimensions de la viewBox SVG
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

  const addElement = useCallback((type) => {
    const el = createElement(type, { x: snap(plan.room.width / 2 - 30), y: snap(plan.room.depth / 2 - 30) });
    onChange({ ...plan, elements: [...plan.elements, el] });
    setSelectedId(el.id);
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
    // Désélectionner si on clique le fond
    if (e.target === svgRef.current || e.target.classList.contains('plan-bg')) {
      setSelectedId(null);
    }
  };

  // ── Modification de la pièce ──
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
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill={def.color}
          fillOpacity={def.opacity ?? 0.85}
          stroke={isSelected ? '#2563eb' : '#475569'}
          strokeWidth={isSelected ? 2 : 1}
          rx={2}
        />
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(w, h) * 0.35}
          fill="#1e293b"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {def.icon}
        </text>
        {isSelected && (
          <text
            x={w / 2}
            y={h + 14}
            textAnchor="middle"
            fontSize={10}
            fill="#2563eb"
            fontWeight="700"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {def.label} · {el.width}×{el.depth}cm
          </text>
        )}
      </g>
    );
  };

  // ── Rendu de la grille ──
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
          <button className="pe-btn" onClick={onClose} title="Fermer">✕</button>
          <span className="pe-title">Plan IR Douche</span>
        </div>
        <div className="pe-toolbar-right">
          <button
            className="pe-btn pe-btn-palette"
            onClick={() => setShowPalette(s => !s)}
            title="Afficher / cacher la palette"
          >
            {showPalette ? '◀ Palette' : 'Palette ▶'}
          </button>
          <button className="pe-btn pe-btn-primary" onClick={onOpen3D} title="Voir en 3D">
            🎲 Voir en 3D
          </button>
        </div>
      </div>

      <div className="pe-body">
        {/* ── Palette d'éléments ── */}
        {showPalette && (
          <aside className="pe-palette">
            <div className="pe-room-controls">
              <h4>Pièce</h4>
              <label>
                Largeur (cm)
                <input
                  type="number"
                  value={plan.room.width}
                  onChange={e => updateRoom('width', e.target.value)}
                  min={50} max={2000} step={10}
                />
              </label>
              <label>
                Profondeur (cm)
                <input
                  type="number"
                  value={plan.room.depth}
                  onChange={e => updateRoom('depth', e.target.value)}
                  min={50} max={2000} step={10}
                />
              </label>
              <label>
                Hauteur (cm)
                <input
                  type="number"
                  value={plan.room.height}
                  onChange={e => updateRoom('height', e.target.value)}
                  min={150} max={500} step={5}
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
            {/* Fond + grille */}
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

            {/* Cotes de la pièce */}
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

            {/* Éléments */}
            {plan.elements.map(renderElement)}
          </svg>

          {/* Hint quand vide */}
          {plan.elements.length === 0 && (
            <div className="pe-empty-hint">
              <div className="pe-empty-icon">👆</div>
              <p>Choisis un élément dans la palette pour commencer</p>
            </div>
          )}
        </div>

        {/* ── Panneau propriétés ── */}
        {selectedElement && (
          <aside className="pe-props">
            <div className="pe-props-header">
              <h4>{ELEMENT_CATALOG[selectedElement.type]?.label}</h4>
              <button className="pe-btn-icon" onClick={() => setSelectedId(null)} title="Fermer">✕</button>
            </div>
            <label>
              Largeur (cm)
              <input
                type="number"
                value={selectedElement.width}
                onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) || 1 })}
                min={1} max={500}
              />
            </label>
            <label>
              Profondeur (cm)
              <input
                type="number"
                value={selectedElement.depth}
                onChange={e => updateElement(selectedElement.id, { depth: Number(e.target.value) || 1 })}
                min={1} max={500}
              />
            </label>
            <label>
              Hauteur (cm)
              <input
                type="number"
                value={selectedElement.height}
                onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) || 1 })}
                min={1} max={300}
              />
            </label>
            <label>
              Position X (cm)
              <input
                type="number"
                value={selectedElement.x}
                onChange={e => updateElement(selectedElement.id, { x: snap(Number(e.target.value) || 0) })}
                step={GRID_SIZE}
              />
            </label>
            <label>
              Position Y (cm)
              <input
                type="number"
                value={selectedElement.y}
                onChange={e => updateElement(selectedElement.id, { y: snap(Number(e.target.value) || 0) })}
                step={GRID_SIZE}
              />
            </label>
            <button
              className="pe-btn pe-btn-rotate"
              onClick={() => updateElement(selectedElement.id, { rotation: (selectedElement.rotation + 90) % 360 })}
            >
              ↻ Rotation 90°
            </button>
            <button
              className="pe-btn pe-btn-delete"
              onClick={() => deleteElement(selectedElement.id)}
            >
              🗑️ Supprimer
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
