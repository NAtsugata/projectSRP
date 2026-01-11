// src/hooks/usePlanCanvas.js
// Hook pour le canvas de dessin de plan technique IR Shower

import { useMemo } from 'react';

const BANNER_H = 40;

/**
 * Hook pour gérer le canvas de plan technique
 * @param {React.RefObject} canvasRef - Référence au canvas
 * @param {Function} toCm - Fonction de conversion pixels → cm
 * @param {number} labelOffsetPx - Offset pour les labels (défaut: 8)
 */
export const usePlanCanvas = (canvasRef, toCm, labelOffsetPx = 8) => {
  const drawBase = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const midY = Math.floor(h / 2);

    // zones
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, midY);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, midY, w, h - midY);

    // bandeaux (murs)
    ctx.save();
    ctx.fillStyle = "rgba(14,165,233,0.12)";
    ctx.fillRect(0, 0, w, BANNER_H);
    ctx.fillRect(0, midY, w, BANNER_H);
    ctx.fillStyle = "#0ea5a5";
    ctx.font = "600 16px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SdB AVANT  —  AVEC DIMENSIONS", w / 2, BANNER_H / 2);
    ctx.fillText("SdB APRÈS  —  AVEC DIMENSIONS", w / 2, midY + BANNER_H / 2);
    ctx.restore();

    // cadre + séparation
    ctx.strokeStyle = "#0ea5a5";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // grille
    const GRID_SIZE = 20;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let x = GRID_SIZE + 0.5; x < w; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = GRID_SIZE + 0.5; y < h; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  const api = useMemo(() => ({
    resizeCtx() {
      const c = canvasRef.current;
      if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      const cw = c.clientWidth, ch = c.clientHeight;
      c.width = Math.floor(cw * dpr);
      c.height = Math.floor(ch * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: cw, h: ch };
    },

    draw(elements = [], preview = null, selectedId = null) {
      const sized = api.resizeCtx();
      if (!sized) return;
      const { ctx, w, h } = sized;
      drawBase(ctx, w, h);
      const all = [...elements, ...(preview ? [preview] : [])];

      const drawDim = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();

        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const lx = mx + nx * labelOffsetPx, ly = my + ny * labelOffsetPx;
        const cm = toCm(len);
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${cm.toFixed(1)} cm`, lx, ly);
        ctx.restore();
      };

      const drawRect = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.restore();
      };

      const drawText = (el) => {
        ctx.save();
        ctx.fillStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(el.text, el.x, el.y);
        ctx.restore();
      };

      const drawMixer = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(20, -3);
        ctx.stroke();
        ctx.restore();
      };

      const drawSeat = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const r = 18;
        if (el.orient === "top") {
          ctx.beginPath();
          ctx.moveTo(el.x - r, el.y);
          ctx.lineTo(el.x + r, el.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(el.x, el.y, r, Math.PI, 0, false);
          ctx.stroke();
        } else if (el.orient === "left") {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y - r);
          ctx.lineTo(el.x, el.y + r);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(el.x, el.y, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.stroke();
        } else if (el.orient === "right") {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y - r);
          ctx.lineTo(el.x, el.y + r);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(el.x, el.y, r, -Math.PI / 2, Math.PI / 2, true);
          ctx.stroke();
        }
        ctx.restore();
      };

      const drawBar = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        // Poignée centrale
        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      const drawShower = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // Ligne d'alimentation
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + 40, el.y);
        ctx.stroke();
        // Pomme de douche
        ctx.beginPath();
        ctx.arc(el.x + 40, el.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      const drawDoor = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const w = 60; // largeur porte
        // Arc d'ouverture
        ctx.beginPath();
        ctx.arc(el.x, el.y, w, 0, Math.PI / 2);
        ctx.stroke();
        // Ligne de la porte
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + w, el.y);
        ctx.stroke();
        ctx.restore();
      };

      const drawWindow = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const w = el.w || 60, h = el.h || 40;
        // Rectangle fenêtre
        ctx.strokeRect(el.x, el.y, w, h);
        // Croix centrale
        ctx.beginPath();
        ctx.moveTo(el.x + w / 2, el.y);
        ctx.lineTo(el.x + w / 2, el.y + h);
        ctx.moveTo(el.x, el.y + h / 2);
        ctx.lineTo(el.x + w, el.y + h / 2);
        ctx.stroke();
        ctx.restore();
      };

      // NEW: WC symbol
      const drawWC = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        const rotation = el.rotation || 0;
        ctx.rotate(rotation * Math.PI / 180);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // Cuvette (oval)
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Réservoir (rectangle)
        ctx.strokeRect(-12, -35, 24, 15);
        // Siège
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      // NEW: Sink/Lavabo symbol
      const drawSink = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        const rotation = el.rotation || 0;
        ctx.rotate(rotation * Math.PI / 180);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // Vasque (rounded rectangle)
        ctx.beginPath();
        ctx.roundRect(-20, -15, 40, 30, 8);
        ctx.stroke();
        // Robinet
        ctx.beginPath();
        ctx.arc(0, -10, 4, 0, Math.PI * 2);
        ctx.stroke();
        // Évacuation
        ctx.beginPath();
        ctx.arc(0, 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // NEW: Towel rack symbol
      const drawTowelRack = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        const rotation = el.rotation || 0;
        ctx.rotate(rotation * Math.PI / 180);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // Barre horizontale
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(25, 0);
        ctx.stroke();
        // Supports
        ctx.beginPath();
        ctx.arc(-25, 0, 3, 0, Math.PI * 2);
        ctx.arc(25, 0, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      // NEW: Drain symbol
      const drawDrain = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        // Cercle extérieur
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        // Grille (croix)
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(-6, -6);
        ctx.lineTo(6, 6);
        ctx.moveTo(-6, 6);
        ctx.lineTo(6, -6);
        ctx.stroke();
        ctx.restore();
      };

      // NEW: Rotatable door
      const drawDoorRotatable = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        const rotation = el.rotation || 0;
        ctx.rotate(rotation * Math.PI / 180);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const w = 60;
        // Arc d'ouverture
        ctx.beginPath();
        ctx.arc(0, 0, w, 0, Math.PI / 2);
        ctx.stroke();
        // Ligne de la porte
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
        ctx.stroke();
        ctx.restore();
      };

      // NEW: Rotatable shower
      const drawShowerRotatable = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        const rotation = el.rotation || 0;
        ctx.rotate(rotation * Math.PI / 180);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // Ligne d'alimentation
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
        // Pomme de douche
        ctx.beginPath();
        ctx.arc(40, 0, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      for (const el of all) {
        if (el.type === "dim") drawDim(el);
        else if (el.type === "rect") drawRect(el);
        else if (el.type === "text") drawText(el);
        else if (el.type === "symbol") {
          if (el.kind === "mixer") drawMixer(el);
          else if (el.kind === "seat") drawSeat(el);
          else if (el.kind === "bar") drawBar(el);
          else if (el.kind === "shower") {
            // Use rotatable version if rotation is set
            if (el.rotation !== undefined) drawShowerRotatable(el);
            else drawShower(el);
          }
          else if (el.kind === "door") {
            // Use rotatable version if rotation is set
            if (el.rotation !== undefined) drawDoorRotatable(el);
            else drawDoor(el);
          }
          else if (el.kind === "window") drawWindow(el);
          // New symbols
          else if (el.kind === "wc") drawWC(el);
          else if (el.kind === "sink") drawSink(el);
          else if (el.kind === "towelrack") drawTowelRack(el);
          else if (el.kind === "drain") drawDrain(el);
        }
      }
    },
  }), [canvasRef, toCm, labelOffsetPx]);

  return api;
};

export default usePlanCanvas;
