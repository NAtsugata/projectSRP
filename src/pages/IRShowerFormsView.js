// FILE: src/pages/IRShowerFormsView.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * IRShowerFormsView — Étude technique (Formulaire) + Plan technique
 * - Maquette PDF supprimée (comme demandé)
 * - Plan: sélection, déplacement (drag), suppression d’éléments
 * - Siège = demi-ovale, automatiquement plaqué au mur le plus proche (haut / gauche / droite pour chaque zone),
 *   orienté vers l’intérieur de la douche
 * - Marquage AVANT (haut) / APRÈS (bas) très visible
 */

const GRID_SIZE = 20;
const HIT_PAD = 10; // tolérance hit-test en px

/* ---------- UI helpers ---------- */
const Section = ({ title, children }) => (
  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16, background: "#fff" }}>
    <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700 }}>{title}</h3>
    {children}
  </div>
);
const Row = ({ children }) => <div className="ir-row">{children}</div>;
const Col = ({ span = 6, children }) => <div className={`ir-col span-${Math.min(12, Math.max(1, span))}`}>{children}</div>;
const Label = ({ children }) => <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{children}</label>;
const Input = (props) => <input {...props} style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 14, minHeight: 44 }} />;
const Check = ({ label, ...props }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12 }}>
    <input type="checkbox" {...props} /> {label}
  </label>
);
const Radio = ({ label, name, ...props }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12 }}>
    <input type="radio" name={name} {...props} /> {label}
  </label>
);
const Small = ({ children }) => <div style={{ fontSize: 12, color: "#64748b" }}>{children}</div>;

/* ---------- PLAN TECHNIQUE: Canvas engine ---------- */
const usePlanCanvas = (canvasRef) => {
  const drawBase = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // fond
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // zones
    const midY = Math.floor(h / 2);
    // teinte légère pour distinguer
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, midY);         // AVANT (haut)
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, midY, w, h - midY);  // APRÈS (bas)

    // cadres
    ctx.strokeStyle = "#0ea5a5";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    // libellés grands et visibles
    ctx.save();
    ctx.fillStyle = "rgba(14,165,233,0.12)"; // bandeau discret
    ctx.fillRect(0, 0, w, 40);
    ctx.fillRect(0, midY, w, 40);

    ctx.fillStyle = "#0ea5a5";
    ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AVANT — AVEC DIMENSIONS", w / 2, 20);
    ctx.fillText("APRÈS — AVEC DIMENSIONS", w / 2, midY + 20);
    ctx.restore();

    // grille
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let x = GRID_SIZE + 0.5; x < w; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = GRID_SIZE + 0.5; y < h; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  };

  const api = useMemo(() => ({
    resizeCtx() {
      const c = canvasRef.current; if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      const cw = c.clientWidth, ch = c.clientHeight;
      c.width = Math.floor(cw * dpr); c.height = Math.floor(ch * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: cw, h: ch };
    },
    draw(elements = [], preview = null, selectedId = null) {
      const sized = api.resizeCtx(); if (!sized) return;
      const { ctx, w, h } = sized;
      drawBase(ctx, w, h);

      const all = [...elements, ...(preview ? [preview] : [])];

      const drawDim = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText(el.label ?? `${Math.round(Math.hypot(el.x2 - el.x1, el.y2 - el.y1))}mm`, mx, my - 6);
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
        // plaque murale + corps + bec discret
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(18, -2); ctx.stroke(); // petit bec
        ctx.restore();
      };

      const drawSeat = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const r = 18;
        // demi-ovale orienté vers l'intérieur
        if (el.orient === "top") {
          // collé en haut, demi-ovale vers le bas
          ctx.beginPath();
          ctx.moveTo(el.x - r, el.y);
          ctx.arc(el.x, el.y, r, Math.PI, 0, false); // partie supérieure
          ctx.lineTo(el.x - r, el.y); // fermer
          ctx.stroke();
          // plat côté mur (ligne horizontale fine)
          ctx.beginPath(); ctx.moveTo(el.x - r, el.y); ctx.lineTo(el.x + r, el.y); ctx.stroke();
        } else if (el.orient === "left") {
          // collé à gauche, demi-ovale vers la droite
          ctx.beginPath();
          ctx.moveTo(el.x, el.y - r);
          ctx.arc(el.x, el.y, r, -Math.PI/2, Math.PI/2, false);
          ctx.lineTo(el.x, el.y - r);
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(el.x, el.y - r); ctx.lineTo(el.x, el.y + r); ctx.stroke();
        } else if (el.orient === "right") {
          // collé à droite, demi-ovale vers la gauche
          ctx.beginPath();
          ctx.moveTo(el.x, el.y - r);
          ctx.arc(el.x, el.y, r, -Math.PI/2, Math.PI/2, true);
          ctx.lineTo(el.x, el.y - r);
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(el.x, el.y - r); ctx.lineTo(el.x, el.y + r); ctx.stroke();
        }
        ctx.restore();
      };

      for (const el of all) {
        if (el.type === "dim") drawDim(el);
        else if (el.type === "rect") drawRect(el);
        else if (el.type === "text") drawText(el);
        else if (el.type === "symbol" && el.kind === "mixer") drawMixer(el);
        else if (el.type === "symbol" && el.kind === "seat") drawSeat(el);
      }
    },
    downloadPNG(filename = "plan_douche.png") {
      const c = canvasRef.current; if (!c) return;
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = filename; a.click();
    }
  }), [canvasRef]);

  return api;
};

/* ---------- helpers ---------- */
let _nextId = 1;
const newId = () => _nextId++;

/* distance point-segment */
function distToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let t = len_sq ? dot / len_sq : -1;
  t = Math.max(0, Math.min(1, t));
  const xx = x1 + C * t, yy = y1 + D * t;
  const dx = px - xx, dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function IRShowerFormsView() {
  const [tab, setTab] = useState("etude");

  /* ===== Étude (Formulaire simple) ===== */
  const [study, setStudy] = useState({
    client_nom: "", client_prenom: "", client_adresse: "",
    inst_nom: "", inst_prenom: "", date_visite: "",
    longueur_receveur: "", largeur_receveur: "", largeur_acces: "",
    hauteur_plafond: "", hauteur_estimee_receveur: "", largeur_sdb: "", longueur_sdb: "",
    robinetterie_type: "thermostatique", vanne_ok: "oui", fenetre: "oui",
    h_fenetre: "", l_fenetre: "", dist_gauche: "", dist_droit: "", dist_plafond: "", dist_sol: "",
    travaux: {
      coffrage: false, creation_entretoise: false, reprise_sol: false, saignee_sol: false, modif_plomberie: false,
      depose_wc_ou_meuble: false, depose_bidet: false, depose_douche_suppl: false, depose_sanitaire: false,
      depl_machine: false, depl_prise: false, pompe_relevage: false, finition_haute: false
    },
    travaux_autres: ""
  });
  const toggleTravaux = (key) => setStudy((s) => ({ ...s, travaux: { ...s.travaux, [key]: !s.travaux[key] } }));

  /* ===== Plan (dessin) ===== */
  const canvasRef = useRef(null);
  const plan = usePlanCanvas(canvasRef);

  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tool, setTool] = useState("dim"); // 'select' | 'dim' | 'rect' | 'mixer' | 'seat' | 'text'
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [startPt, setStartPt] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  useEffect(() => { if (tab === "plan") plan.draw(elements, preview, selectedId); }, [tab, elements, preview, selectedId, plan]);
  useEffect(() => {
    if (tab !== "plan") return;
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => plan.draw(elements, preview, selectedId));
    ro.observe(el); return () => ro.disconnect();
  }, [tab, elements, preview, selectedId, plan]);

  // suppression via clavier
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        setElements((els) => els.filter((x) => x.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const applySnap = (x, y) => {
    if (!snap) return { x, y };
    const sx = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const sy = Math.round(y / GRID_SIZE) * GRID_SIZE;
    return { x: sx, y: sy };
  };

  const applyOrtho = (x1, y1, x2, y2) => {
    if (!ortho) return { x2, y2 };
    const dx = x2 - x1, dy = y2 - y1;
    return Math.abs(dx) > Math.abs(dy) ? { x2, y2: y1 } : { x2: x1, y2 };
  };

  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    let cx = (e.clientX ?? (e.touches?.[0]?.clientX || 0)) - rect.left;
    let cy = (e.clientY ?? (e.touches?.[0]?.clientY || 0)) - rect.top;
    return applySnap(cx, cy);
  };

  // Hit-test pour sélectionner
  const hitTest = (x, y) => {
    // chercher du haut vers le bas (dernier au-dessus)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "rect") {
        if (x >= el.x - HIT_PAD && x <= el.x + el.w + HIT_PAD && y >= el.y - HIT_PAD && y <= el.y + el.h + HIT_PAD) {
          return el;
        }
      } else if (el.type === "dim") {
        if (distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= HIT_PAD) return el;
      } else if (el.type === "text") {
        // boîte approximative (80x28)
        if (x >= el.x - 4 && x <= el.x + 80 && y >= el.y - 16 && y <= el.y + 12) return el;
      } else if (el.type === "symbol") {
        const r = el.kind === "mixer" ? 14 : 22;
        if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
      }
    }
    return null;
  };

  // Zones AVANT (haut) / APRÈS (bas)
  const getZones = () => {
    const c = canvasRef.current;
    const h = c?.clientHeight || 0;
    const w = c?.clientWidth || 0;
    const mid = Math.floor(h / 2);
    return {
      width: w,
      height: h,
      midY: mid,
      topZone: { x: 0, y: 0, w, h: mid },
      botZone: { x: 0, y: mid, w, h: h - mid },
    };
  };

  const clampSeatToWall = (p) => {
    // Trouve la zone (haut = AVANT, bas = APRÈS) puis plaque au mur le plus proche (haut / gauche / droite de la zone).
    const { width, midY } = getZones();
    const zoneTop = p.y < midY ? { y0: 0, y1: midY } : { y0: midY, y1: null };
    const topEdge = p.y < midY ? 0 : midY;
    const distTop = Math.abs(p.y - topEdge);
    const distLeft = Math.abs(p.x - 0);
    const distRight = Math.abs(width - p.x);

    let orient = "top";
    let x = p.x, y = p.y;
    const padding = 6; // léger retrait pour lisibilité

    if (distTop <= distLeft && distTop <= distRight) {
      // coller en haut de la zone
      y = topEdge + padding;
      orient = "top";
    } else if (distLeft <= distRight) {
      x = padding;
      orient = "left";
    } else {
      x = width - padding;
      orient = "right";
    }
    return { x, y, orient };
  };

  const onPointerDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);

    if (tool === "select") {
      const el = hitTest(p.x, p.y);
      if (el) {
        setSelectedId(el.id);
        // offset pour drag
        if (el.type === "rect") setDragOffset({ dx: p.x - el.x, dy: p.y - el.y });
        else setDragOffset({ dx: p.x - (el.x ?? 0), dy: p.y - (el.y ?? 0) });
      } else {
        setSelectedId(null);
      }
      setStartPt(p);
      return;
    }

    if (tool === "mixer") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "mixer", x: p.x, y: p.y }]);
      setSelectedId(id);
      return;
    }

    if (tool === "seat") {
      const seat = clampSeatToWall(p);
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "seat", x: seat.x, y: seat.y, orient: seat.orient }]);
      setSelectedId(id);
      return;
    }

    if (tool === "text") {
      const t = window.prompt("Texte :");
      if (t?.trim()) {
        const id = newId();
        setElements((els) => [...els, { id, type: "text", x: p.x, y: p.y, text: t }]);
        setSelectedId(id);
      }
      return;
    }

    // dim/rect
    setStartPt(p);
  };

  const onPointerMove = (e) => {
    if (!startPt) return;
    const p = pointerPos(e);

    if (tool === "select" && selectedId) {
      // drag l’élément sélectionné
      setElements((els) => els.map((el) => {
        if (el.id !== selectedId) return el;
        if (el.type === "rect") return { ...el, x: p.x - dragOffset.dx, y: p.y - dragOffset.dy };
        if (el.type === "dim") {
          // déplacer la cote : translation globale
          const dx = p.x - startPt.x, dy = p.y - startPt.y;
          return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
        }
        if (el.type === "text" || el.type === "symbol") {
          return { ...el, x: p.x - dragOffset.dx, y: p.y - dragOffset.dy };
        }
        return el;
      }));
      // update startPt pour delta continu
      setStartPt(p);
      return;
    }

    let { x: x2, y: y2 } = p;
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      setPreview({ type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 });
    } else if (tool === "rect") {
      setPreview({ type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) });
    }
  };

  const onPointerUp = (e) => {
    if (!startPt) return;
    e.preventDefault();
    const p = pointerPos(e);

    if (tool === "select") {
      setStartPt(null);
      return;
    }

    let { x: x2, y: y2 } = p;
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      const auto = `${Math.round(Math.hypot(x2 - startPt.x, y2 - startPt.y))}mm`;
      const label = window.prompt("Libellé de la cote (laisser vide pour auto)", auto) || auto;
      const id = newId();
      setElements((els) => [...els, { id, type: "dim", x1: startPt.x, y1: startPt.y, x2, y2, label }]);
      setSelectedId(id);
    } else if (tool === "rect") {
      const id = newId();
      setElements((els) => [...els, { id, type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) }]);
      setSelectedId(id);
    }

    setStartPt(null); setPreview(null);
  };

  const undo = () => {
    setElements((els) => els.slice(0, -1));
    setSelectedId(null);
  };
  const delSelected = () => {
    if (!selectedId) return;
    setElements((els) => els.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  };
  const resetPlan = () => { setElements([]); setPreview(null); setSelectedId(null); };

  /* ===== Accessoires (déclaratif) ===== */
  const [accessoires, setAccessoires] = useState({ siege: false, barre: false, robinetterie: "mitigeur", ciel: false });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <style>{`
        .ir-row { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; margin-bottom: 10px; }
        .ir-col { grid-column: span 12 / span 12; }
        @media (min-width: 768px) {
          .ir-col.span-1 { grid-column: span 1 / span 1; }
          .ir-col.span-2 { grid-column: span 2 / span 2; }
          .ir-col.span-3 { grid-column: span 3 / span 3; }
          .ir-col.span-4 { grid-column: span 4 / span 4; }
          .ir-col.span-5 { grid-column: span 5 / span 5; }
          .ir-col.span-6 { grid-column: span 6 / span 6; }
          .ir-col.span-7 { grid-column: span 7 / span 7; }
          .ir-col.span-8 { grid-column: span 8 / span 8; }
          .ir-col.span-9 { grid-column: span 9 / span 9; }
          .ir-col.span-10 { grid-column: span 10 / span 10; }
          .ir-col.span-11 { grid-column: span 11 / span 11; }
          .ir-col.span-12 { grid-column: span 12 / span 12; }
        }
        .ir-tabs { position: sticky; top: 0; z-index: 10; background: #fff; padding-bottom: 8px; }
        .ir-canvas-wrap { height: 560px; }
        @media (max-width: 767px) { .ir-canvas-wrap { height: 460px; } }
        canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
        button, input, select, textarea { min-height: 44px; }
      `}</style>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Documents IR – Douche</h1>

      <div className="ir-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
      </div>

      {/* ==== ÉTUDE (formulaire classique) ==== */}
      {tab === "etude" && (
        <div>
          <Section title="En-têtes">
            <Row>
              <Col span={4}><Label>Date de la visite</Label><Input type="date" value={study.date_visite} onChange={(e)=>setStudy(s=>({...s, date_visite:e.target.value}))} /></Col>
              <Col span={4}><Label>Installateur — Nom</Label><Input value={study.inst_nom} onChange={(e)=>setStudy(s=>({...s, inst_nom:e.target.value}))} /></Col>
              <Col span={4}><Label>Installateur — Prénom</Label><Input value={study.inst_prenom} onChange={(e)=>setStudy(s=>({...s, inst_prenom:e.target.value}))} /></Col>
            </Row>
            <Row>
              <Col span={4}><Label>Client — Nom</Label><Input value={study.client_nom} onChange={(e)=>setStudy(s=>({...s, client_nom:e.target.value}))} /></Col>
              <Col span={4}><Label>Client — Prénom</Label><Input value={study.client_prenom} onChange={(e)=>setStudy(s=>({...s, client_prenom:e.target.value}))} /></Col>
              <Col span={4}><Label>Client — Adresse</Label><Input value={study.client_adresse} onChange={(e)=>setStudy(s=>({...s, client_adresse:e.target.value}))} /></Col>
            </Row>
          </Section>

          <Section title="Étude technique">
            <Row>
              <Col span={6}><Label>Longueur receveur (mm)</Label><Input value={study.longueur_receveur} onChange={(e)=>setStudy(s=>({...s, longueur_receveur:e.target.value}))} /></Col>
              <Col span={6}><Label>Largeur receveur (mm)</Label><Input value={study.largeur_receveur} onChange={(e)=>setStudy(s=>({...s, largeur_receveur:e.target.value}))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Largeur d'accès douche (min 65cm)</Label><Input value={study.largeur_acces} onChange={(e)=>setStudy(s=>({...s, largeur_acces:e.target.value}))} /></Col>
              <Col span={6}><Label>Hauteur plafond (mm)</Label><Input value={study.hauteur_plafond} onChange={(e)=>setStudy(s=>({...s, hauteur_plafond:e.target.value}))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Hauteur estimée du receveur (mm)</Label><Input value={study.hauteur_estimee_receveur} onChange={(e)=>setStudy(s=>({...s, hauteur_estimee_receveur:e.target.value}))} /></Col>
              <Col span={6}><Label>Largeur de la salle de bains (mm)</Label><Input value={study.largeur_sdb} onChange={(e)=>setStudy(s=>({...s, largeur_sdb:e.target.value}))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Longueur de la salle de bains (mm)</Label><Input value={study.longueur_sdb} onChange={(e)=>setStudy(s=>({...s, longueur_sdb:e.target.value}))} /></Col>
              <Col span={6}><Label>Type de robinetterie</Label>
                <div>
                  <Radio name="robinetterie" label="Thermostatique" checked={study.robinetterie_type==="thermostatique"} onChange={()=>setStudy(s=>({...s, robinetterie_type:"thermostatique"}))} />
                  <Radio name="robinetterie" label="Mitigeur classique" checked={study.robinetterie_type==="mitigeur"} onChange={()=>setStudy(s=>({...s, robinetterie_type:"mitigeur"}))} />
                </div>
              </Col>
            </Row>
            <Row>
              <Col span={6}><Label>Vanne d'arrêt d'eau fonctionnelle</Label>
                <div>
                  <Radio name="vanne" label="Oui" checked={study.vanne_ok==="oui"} onChange={()=>setStudy(s=>({...s, vanne_ok:"oui"}))} />
                  <Radio name="vanne" label="Non" checked={study.vanne_ok==="non"} onChange={()=>setStudy(s=>({...s, vanne_ok:"non"}))} />
                </div>
              </Col>
              <Col span={6}><Label>Fenêtre</Label>
                <div>
                  <Radio name="fenetre" label="Oui" checked={study.fenetre==="oui"} onChange={()=>setStudy(s=>({...s, fenetre:"oui"}))} />
                  <Radio name="fenetre" label="Non" checked={study.fenetre==="non"} onChange={()=>setStudy(s=>({...s, fenetre:"non"}))} />
                </div>
              </Col>
            </Row>
            <Row>
              <Col span={4}><Label>Hauteur de fenêtre (mm)</Label><Input value={study.h_fenetre} onChange={(e)=>setStudy(s=>({...s, h_fenetre:e.target.value}))} /></Col>
              <Col span={4}><Label>Largeur de fenêtre (mm)</Label><Input value={study.l_fenetre} onChange={(e)=>setStudy(s=>({...s, l_fenetre:e.target.value}))} /></Col>
              <Col span={4}><Label>Distance fenêtre / mur gauche (mm)</Label><Input value={study.dist_gauche} onChange={(e)=>setStudy(s=>({...s, dist_gauche:e.target.value}))} /></Col>
            </Row>
            <Row>
              <Col span={4}><Label>Distance fenêtre / mur droit (mm)</Label><Input value={study.dist_droit} onChange={(e)=>setStudy(s=>({...s, dist_droit:e.target.value}))} /></Col>
              <Col span={4}><Label>Distance fenêtre / plafond (mm)</Label><Input value={study.dist_plafond} onChange={(e)=>setStudy(s=>({...s, dist_plafond:e.target.value}))} /></Col>
              <Col span={4}><Label>Distance fenêtre / sol (mm)</Label><Input value={study.dist_sol} onChange={(e)=>setStudy(s=>({...s, dist_sol:e.target.value}))} /></Col>
            </Row>
          </Section>

          <Section title="Travaux complémentaires nécessaires">
            <Row>
              <Col span={12}>
                {Object.entries(study.travaux).map(([k,v]) => (
                  <Check key={k} label={k.replaceAll('_',' ')} checked={v} onChange={()=>toggleTravaux(k)} />
                ))}
              </Col>
            </Row>
            <Row>
              <Col span={12}><Label>Autres</Label>
                <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
              </Col>
            </Row>
          </Section>
        </div>
      )}

      {/* ==== PLAN TECHNIQUE ==== */}
      {tab === "plan" && (
        <div>
          <Section title="Outils">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={()=>setTool("select")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="select"?"#e2e8f0":"#fff" }}>Sélection</button>
              <button onClick={()=>setTool("dim")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="dim"?"#e2e8f0":"#fff" }}>Cote</button>
              <button onClick={()=>setTool("rect")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rect"?"#e2e8f0":"#fff" }}>Rect</button>
              <button onClick={()=>setTool("mixer")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="mixer"?"#e2e8f0":"#fff" }}>Mitigeur</button>
              <button onClick={()=>setTool("seat")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="seat"?"#e2e8f0":"#fff" }}>Siège (mur)</button>
              <button onClick={()=>setTool("text")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="text"?"#e2e8f0":"#fff" }}>Texte</button>
              <button onClick={()=>setSnap(s=>!s)}     style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: snap?"#e2e8f0":"#fff" }}>{snap?"Snap ✓":"Snap ✗"}</button>
              <button onClick={()=>setOrtho(o=>!o)}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: ortho?"#e2e8f0":"#fff" }}>{ortho?"Ortho ✓":"Ortho ✗"}</button>
              <button onClick={undo}                   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Undo</button>
              <button onClick={delSelected}            style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #ef4444", background:"#fff", color:"#ef4444" }} disabled={!selectedId}>Supprimer sélection</button>
              <button onClick={()=>plan.downloadPNG()} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Exporter PNG</button>
              <button onClick={resetPlan}              style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Réinitialiser</button>
            </div>
            <Small>Astuce: “Sélection” → touche Suppr/Backspace pour effacer. Glisse pour déplacer. Le **siège** se plaque au mur le plus proche, demi-ovale orienté vers l’intérieur.</Small>
          </Section>

          <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <div className="ir-canvas-wrap">
              <canvas
                ref={canvasRef}
                className="ir-grid"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                style={{ cursor: tool==="select" ? "default" : (tool==="mixer"||tool==="seat"||tool==="text") ? "cell" : "crosshair" }}
              />
            </div>
          </div>

          <Section title="Accessoires (déclaratif)">
            <Row>
              <Col span={3}><Check label="Siège" checked={accessoires.siege} onChange={()=>setAccessoires(a=>({...a, siege: !a.siege}))} /></Col>
              <Col span={3}><Check label="Barre de maintien" checked={accessoires.barre} onChange={()=>setAccessoires(a=>({...a, barre: !a.barre}))} /></Col>
              <Col span={3}>
                <Label>Robinetterie</Label>
                <select value={accessoires.robinetterie} onChange={(e)=>setAccessoires(a=>({...a, robinetterie:e.target.value}))} style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
                  <option value="mitigeur">Mitigeur</option>
                  <option value="thermostatique">Thermostatique</option>
                </select>
              </Col>
              <Col span={3}><Check label="Ciel de pluie" checked={accessoires.ciel} onChange={()=>setAccessoires(a=>({...a, ciel: !a.ciel}))} /></Col>
            </Row>
            <Row>
              <Col span={12}><Label>Commentaires</Label>
                <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} placeholder="Notes complémentaires..." style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
              </Col>
            </Row>
          </Section>
        </div>
      )}
    </div>
  );
}
