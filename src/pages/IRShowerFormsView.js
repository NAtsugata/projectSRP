// FILE: src/pages/IRShowerFormsView.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * IRShowerFormsView — Étude + Plan technique
 * - Mentions en-tête comme la maquette (titre, note, NOM/PRÉNOM, exemplaire…)
 * - Accessoires au style du schéma (S, barre de maintien, robinetterie, ciel de pluie, échelle)
 * - Détails textuels des symboles sous la légende
 * - Zones bleues (bandeaux) = murs : création ET déplacement interdits
 * - Échelle 1:1 (1 px = 1 cm), cotes en cm
 * - Export PDF 2 pages (import dynamique -> build Vercel OK même sans deps)
 */

const GRID_SIZE = 20;
const HIT_PAD = 10;
const BANNER_H = 40; // bandeaux bleus
const LABEL_OFFSET = 8;

/* ---------- UI helpers ---------- */
const Section = ({ title, children, style }) => (
  <div
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      background: "#fff",
      ...style,
    }}
  >
    {title && <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700 }}>{title}</h3>}
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

/* ---------- helpers ---------- */
let _nextId = 1;
const newId = () => _nextId++;

function distToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D, len_sq = C * C + D * D;
  let t = len_sq ? dot / len_sq : -1;
  t = Math.max(0, Math.min(1, t));
  const xx = x1 + C * t, yy = y1 + D * t;
  const dx = px - xx, dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- Canvas engine ---------- */
const usePlanCanvas = (canvasRef, toCm, labelOffsetPx = 8) => {
  const drawBase = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const midY = Math.floor(h / 2);

    // zones
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, w, midY);     // AVANT
    ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0, midY, w, h-midY); // APRÈS

    // bandeaux (murs)
    ctx.save();
    ctx.fillStyle = "rgba(14,165,233,0.12)";
    ctx.fillRect(0, 0, w, BANNER_H);
    ctx.fillRect(0, midY, w, BANNER_H);
    ctx.fillStyle = "#0ea5a5";
    ctx.font = "600 16px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SdB AVANT  —  AVEC DIMENSIONS", w/2, BANNER_H/2);
    ctx.fillText("SdB APRÈS  —  AVEC DIMENSIONS", w/2, midY + BANNER_H/2);
    ctx.restore();

    // cadre + séparation
    ctx.strokeStyle = "#0ea5a5"; ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    // grille
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
    for (let x = GRID_SIZE + 0.5; x < w; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = GRID_SIZE + 0.5; y < h; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  };

  const api = useMemo(() => ({
    resizeCtx() {
      const c = canvasRef.current; if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      const cw = c.clientWidth, ch = c.clientHeight;
      c.width = Math.floor(cw * dpr); c.height = Math.floor(ch * dpr);
      const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2;

        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();

        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const lx = mx + nx * labelOffsetPx, ly = my + ny * labelOffsetPx;
        const cm = toCm(len);
        ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${cm.toFixed(1)} cm`, lx, ly);
        ctx.restore();
      };

      const drawRect = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2; ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.restore();
      };

      const drawText = (el) => {
        ctx.save();
        ctx.fillStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.font = "bold 12px sans-serif"; ctx.fillText(el.text, el.x, el.y);
        ctx.restore();
      };

      const drawMixer = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        // symbole simple "mitigeur" (rond + croix + petit bec)
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -3); ctx.stroke();
        ctx.restore();
      };

      const drawSeat = (el) => {
        // demi-ovale plaqué mur
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : "#0f172a";
        ctx.lineWidth = 2;
        const r = 18;
        if (el.orient === "top") {
          ctx.beginPath(); ctx.moveTo(el.x - r, el.y); ctx.lineTo(el.x + r, el.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(el.x, el.y, r, Math.PI, 0, false); ctx.stroke();
        } else if (el.orient === "left") {
          ctx.beginPath(); ctx.moveTo(el.x, el.y - r); ctx.lineTo(el.x, el.y + r); ctx.stroke();
          ctx.beginPath(); ctx.arc(el.x, el.y, r, -Math.PI/2, Math.PI/2, false); ctx.stroke();
        } else if (el.orient === "right") {
          ctx.beginPath(); ctx.moveTo(el.x, el.y - r); ctx.lineTo(el.x, el.y + r); ctx.stroke();
          ctx.beginPath(); ctx.arc(el.x, el.y, r, -Math.PI/2, Math.PI/2, true); ctx.stroke();
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
  }), [canvasRef, toCm, labelOffsetPx]);

  return api;
};

/* ---------- Main ---------- */
export default function IRShowerFormsView() {
  const [tab, setTab] = useState("plan");

  /* ÉTUDE */
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

  /* PLAN */
  const pxPerCm = 1; // 1 px = 1 cm
  const toCm = (pxLen) => pxLen / Math.max(0.0001, pxPerCm);

  const canvasRef = useRef(null);
  const plan = usePlanCanvas(canvasRef, toCm, LABEL_OFFSET);

  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tool, setTool] = useState("select"); // 'select' | 'dim' | 'rect' | 'mixer' | 'seat' | 'text'
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [startPt, setStartPt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  // Refs PDF
  const etudeRef = useRef(null);
  const planExportRef = useRef(null);

  useEffect(() => { if (tab === "plan") plan.draw(elements, preview, selectedId); }, [tab, elements, preview, selectedId, plan]);
  useEffect(() => {
    if (tab !== "plan") return;
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => plan.draw(elements, preview, selectedId));
    ro.observe(el); return () => ro.disconnect();
  }, [tab, elements, preview, selectedId, plan]);

  // Delete via clavier
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

  // utilitaires
  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    let cx = (e.clientX ?? (e.touches?.[0]?.clientX || 0)) - rect.left;
    let cy = (e.clientY ?? (e.touches?.[0]?.clientY || 0)) - rect.top;
    if (snap) { cx = Math.round(cx / GRID_SIZE) * GRID_SIZE; cy = Math.round(cy / GRID_SIZE) * GRID_SIZE; }
    return { x: cx, y: cy };
  };
  const getZones = () => {
    const c = canvasRef.current; const h = c?.clientHeight || 0; const w = c?.clientWidth || 0; const mid = Math.floor(h / 2);
    return { w, h, midY: mid };
  };
  const isInBanner = (y) => {
    const { midY } = getZones();
    return (y >= 0 && y <= BANNER_H) || (y >= midY && y <= midY + BANNER_H);
  };
  const clampYOutOfBanner = (y) => {
    const { midY } = getZones();
    if (y < BANNER_H) return BANNER_H + 1;
    if (y >= midY && y < midY + BANNER_H) return midY + BANNER_H + 1;
    return y;
  };
  const applyOrtho = (x1, y1, x2, y2) => {
    if (!ortho) return { x2, y2 };
    const dx = x2 - x1, dy = y2 - y1;
    return Math.abs(dx) > Math.abs(dy) ? { x2, y2: y1 } : { x2: x1, y2 };
  };
  const clampSeatToWall = (p) => {
    const { w, midY } = getZones();
    const topEdge = p.y < midY ? 0 : midY;
    const distTop = Math.abs(p.y - topEdge);
    const distLeft = Math.abs(p.x - 0);
    const distRight = Math.abs(w - p.x);
    const pad = 6;
    let orient = "top", x = p.x, y = p.y;
    if (distTop <= distLeft && distTop <= distRight) { y = topEdge + pad; orient = "top"; }
    else if (distLeft <= distRight) { x = pad; orient = "left"; }
    else { x = w - pad; orient = "right"; }
    y = clampYOutOfBanner(y);
    return { x, y, orient };
  };

  const hitTest = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "rect") {
        if (x >= el.x - HIT_PAD && x <= el.x + el.w + HIT_PAD && y >= el.y - HIT_PAD && y <= el.y + el.h + HIT_PAD) return el;
      } else if (el.type === "dim") {
        if (distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= HIT_PAD) return el;
      } else if (el.type === "text") {
        if (x >= el.x - 4 && x <= el.x + 120 && y >= el.y - 16 && y <= el.y + 12) return el;
      } else if (el.type === "symbol") {
        const r = el.kind === "mixer" ? 14 : 22;
        if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
      }
    }
    return null;
  };

  /* ----- Pointers ----- */
  const onPointerDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);

    // murs = interdit de créer dedans
    if (tool !== "select" && isInBanner(p.y)) return;

    if (tool === "select") {
      const el = hitTest(p.x, p.y);
      if (el) {
        setSelectedId(el.id);
        setDragOffset({ dx: p.x - (el.x ?? 0), dy: p.y - (el.y ?? 0) });
      } else {
        setSelectedId(null);
      }
      setStartPt(p);
      return;
    }

    if (tool === "mixer") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "mixer", x: p.x, y: clampYOutOfBanner(p.y) }]);
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
      if (t && t.trim()) {
        const id = newId();
        setElements((els) => [...els, { id, type: "text", x: p.x, y: clampYOutOfBanner(p.y), text: t }]);
        setSelectedId(id);
      }
      return;
    }

    setStartPt({ x: p.x, y: clampYOutOfBanner(p.y) }); // dim/rect: point de départ hors bandeau
  };

  const onPointerMove = (e) => {
    if (!startPt) return;
    const p = pointerPos(e);

    if (tool === "select" && selectedId) {
      setElements((els) => els.map((el) => {
        if (el.id !== selectedId) return el;
        if (el.type === "rect") {
          const nx = p.x - dragOffset.dx;
          const ny = clampYOutOfBanner(p.y - dragOffset.dy);
          return { ...el, x: nx, y: ny };
        }
        if (el.type === "dim") {
          const dx = p.x - startPt.x, dy = p.y - startPt.y;
          // refuse le déplacement si ça amène un point dans la bande
          const ny1 = clampYOutOfBanner(el.y1 + dy);
          const ny2 = clampYOutOfBanner(el.y2 + dy);
          return { ...el, x1: el.x1 + dx, y1: ny1, x2: el.x2 + dx, y2: ny2 };
        }
        if (el.type === "text" || el.type === "symbol") {
          const nx = p.x - dragOffset.dx;
          const ny = clampYOutOfBanner(p.y - dragOffset.dy);
          // siège : re-plaquage dynamique
          if (el.type === "symbol" && el.kind === "seat") {
            const c = clampSeatToWall({ x: nx, y: ny });
            return { ...el, ...c };
          }
          return { ...el, x: nx, y: ny };
        }
        return el;
      }));
      setStartPt(p);
      return;
    }

    let { x: x2, y: y2 } = p;
    y2 = clampYOutOfBanner(y2);
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      setPreview({ type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 });
    } else if (tool === "rect") {
      setPreview({ type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) });
    }
  };

  const onPointerUp = (e) => {
    if (!startPt) return; e.preventDefault();
    const p = pointerPos(e);

    if (tool === "select") {
      // si c'est un siège, re-plaquer au mur
      const el = elements.find((x) => x.id === selectedId);
      if (el && el.type === "symbol" && el.kind === "seat") {
        setElements((els) => els.map((x) => (x.id !== el.id ? x : { ...x, ...clampSeatToWall({ x: x.x, y: x.y }) })));
      }
      setStartPt(null);
      return;
    }

    let { x: x2, y: y2 } = p;
    y2 = clampYOutOfBanner(y2);
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      const id = newId();
      setElements((els) => [...els, { id, type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 }]);
      setSelectedId(id);
    } else if (tool === "rect") {
      const id = newId();
      setElements((els) => [...els, { id, type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) }]);
      setSelectedId(id);
    }
    setStartPt(null); setPreview(null);
  };

  const onDoubleClick = (e) => {
    if (tool !== "select") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const el = hitTest(p.x, p.y);
    if (el && el.type === "text") {
      const newT = window.prompt("Modifier le texte :", el.text);
      if (newT !== null) {
        setElements((els) => els.map((x) => (x.id === el.id ? { ...x, text: newT } : x)));
      }
    }
  };

  const undo = () => { setElements((els) => els.slice(0, -1)); setSelectedId(null); };
  const delSelected = () => { if (!selectedId) return; setElements((els) => els.filter((x) => x.id !== selectedId)); setSelectedId(null); };
  const resetPlan = () => { setElements([]); setPreview(null); setSelectedId(null); };

  /* ---------- Export PDF (import dynamique pour éviter l'erreur de build sans deps) ---------- */
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const waitPaint = async (ms = 120) => { await raf(); await new Promise((r) => setTimeout(r, ms)); };

  const exportPDF = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const prevTab = tab;

      // Page Étude
      setTab("etude"); await waitPaint();
      const c1 = await html2canvas(etudeRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const img1 = c1.toDataURL("image/png");

      // Page Plan
      setTab("plan"); await waitPaint();
      const c2 = await html2canvas(planExportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const img2 = c2.toDataURL("image/png");

      // PDF
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const w1 = pageW, h1 = (c1.height / c1.width) * w1;
      pdf.addImage(img1, "PNG", 0, Math.max(0, (pageH - h1) / 2), w1, h1, undefined, "FAST");

      pdf.addPage();
      const w2 = pageW, h2 = (c2.height / c2.width) * w2;
      pdf.addImage(img2, "PNG", 0, Math.max(0, (pageH - h2) / 2), w2, h2, undefined, "FAST");

      pdf.save("Etude_et_Plan_IR.pdf");
      setTab(prevTab);
    } catch (err) {
      alert("⚠️ L’export PDF nécessite 'html2canvas' et 'jspdf'. Installe-les :\n\nnpm i html2canvas jspdf");
      console.error(err);
    }
  };

  /* ---------- Accessoires (état) ---------- */
  const [accessoires, setAccessoires] = useState({ siege: false, barre: false, robinetterie: "mitigeur", ciel: false });

  /* ---------- Styles ---------- */
  const styles = (
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
      .actions-sticky { position: sticky; top: 0; z-index: 10; background: #ffffffcc; backdrop-filter: blur(4px); border-bottom: 1px solid #e5e7eb; padding: 8px 0; margin-bottom: 12px; }
      .ir-canvas-wrap { height: 560px; }
      @media (max-width: 767px) { .ir-canvas-wrap { height: 460px; } }
      canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
      button, input, select, textarea { min-height: 44px; }
      .legend svg { vertical-align: middle; }
      .header-card h2 { letter-spacing: .5px; }
    `}</style>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {styles}

      {/* BARRE D’ACTIONS (Export toujours visible) */}
      <div className="actions-sticky">
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={exportPDF} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid #0ea5a5", background:"#0ea5a5", color:"#fff", fontWeight:600 }}>
            Exporter PDF (Étude + Plan)
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Documents IR – Douche</h1>

      {/* ONGLETS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
      </div>

      {/* ======= PAGE 1 — ÉTUDE ======= */}
      <div ref={etudeRef}>
        {tab === "etude" && (
          <>
            <Section style={{ paddingBottom: 8 }} >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ÉTUDE TECHNIQUE</h2>
            </Section>

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

            {/* … (tout le bloc Étude technique + Travaux comme avant) */}
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
          </>
        )}
      </div>

      {/* ======= PAGE 2 — PLAN ======= */}
      {tab === "plan" && (
        <div>
          {/* Entête comme la maquette */}
          <Section style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>PLAN TECHNIQUE INDICATIF DOUCHE</h2>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
              Plan non contractuel. Nécessite une validation technique au préalable. <br />
              Dimensions sous réserve des éventuelles contraintes techniques rencontrées.
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}><Label>NOM :</Label><Input placeholder="........................................................" /></div>
              <div style={{ minWidth: 220 }}><Label>PRÉNOM :</Label><Input placeholder="........................................................" /></div>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Exemplaire à destination du client</div>
          </Section>

          {/* OUTILS (à l'écran seulement) */}
          <Section title="Outils">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button onClick={()=>setTool("select")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="select"?"#e2e8f0":"#fff" }}>Sélection</button>
              <button onClick={()=>setTool("dim")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="dim"?"#e2e8f0":"#fff" }}>Cote</button>
              <button onClick={()=>setTool("rect")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rect"?"#e2e8f0":"#fff" }}>Rect</button>
              <button onClick={()=>setTool("mixer")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="mixer"?"#e2e8f0":"#fff" }}>Mitigeur</button>
              <button onClick={()=>setTool("seat")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="seat"?"#e2e8f0":"#fff" }}>Siège (mur)</button>
              <button onClick={()=>setTool("text")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="text"?"#e2e8f0":"#fff" }}>Texte</button>
              <button onClick={()=>setSnap(s=>!s)}     style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: snap?"#e2e8f0":"#fff" }}>{snap?"Snap ✓":"Snap ✗"}</button>
              <button onClick={()=>setOrtho(o=>!o)}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: ortho?"#e2e8f0":"#fff" }}>{ortho?"Ortho ✓":"Ortho ✗"}</button>
              <button onClick={undo}                   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Undo</button>
              <button onClick={delSelected}            style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #ef4444", color:"#ef4444", background:"#fff" }} disabled={!selectedId}>Supprimer sélection</button>
            </div>
            <Small>Zones bleues = murs (création et déplacement interdits). Double-clic pour éditer un texte. Le siège se plaque automatiquement au mur.</Small>
          </Section>

          {/* ZONE EXPORTABLE (plan + accessoires + détails) */}
          <div ref={planExportRef}>
            {/* Plan */}
            <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <div className="ir-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="ir-grid"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onDoubleClick={onDoubleClick}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                  style={{ cursor: tool==="select" ? "default" : (tool==="mixer"||tool==="seat"||tool==="text") ? "cell" : "crosshair" }}
                />
              </div>
            </div>

            {/* Accessoires au style du schéma */}
            <Section>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "center" }}>
                {/* Siège (carré avec S) */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:32, height:32, border:"2px solid #0f172a", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>S</div>
                  <span>Siège</span>
                </div>
                {/* Barre de maintien (ligne avec “curseur”) */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="18" viewBox="0 0 60 18">
                    <line x1="6" y1="9" x2="54" y2="9" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="42" cy="9" r="3.5" fill="#0f172a" />
                  </svg>
                  <span>Barre de maintien</span>
                </div>
                {/* Robinetterie (sélecteur) */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="48" height="20" viewBox="0 0 48 20">
                    <circle cx="18" cy="10" r="3" fill="none" stroke="#0f172a" strokeWidth="2" />
                    <circle cx="30" cy="10" r="3" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Robinetterie</span>
                </div>
                {/* Ciel de pluie */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="20" viewBox="0 0 60 20">
                    <line x1="6" y1="6" x2="48" y2="6" stroke="#0f172a" strokeWidth="2" />
                    <circle cx="48" cy="6" r="4" fill="none" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Ciel de pluie</span>
                </div>
                {/* Échelle */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="36" height="20" viewBox="0 0 36 20">
                    <line x1="8" y1="16" x2="28" y2="16" stroke="#0f172a" strokeWidth="2" />
                    <line x1="8" y1="6" x2="8" y2="16" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Échelle 1:1</span>
                </div>
              </div>

              {/* Détails texte */}
              <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
                <div><strong>Mitigeur&nbsp;:</strong> symbole rond avec croix et bec orienté vers l’intérieur du plan.</div>
                <div><strong>Siège mural&nbsp;:</strong> demi-ovale plaqué contre le mur le plus proche (haut/gauche/droite).</div>
                <div><strong>Barre de maintien&nbsp;:</strong> segment avec curseur (position libre selon besoin).</div>
                <div><strong>Ciel de pluie&nbsp;:</strong> ligne d’alimentation et pomme de douche en bout.</div>
                <div><strong>Texte libre&nbsp;:</strong> posable et déplaçable précisément, double-clic pour éditer.</div>
              </div>
            </Section>
          </div>

          {/* Actions locales */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={resetPlan} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid #cbd5e1", background:"#fff" }}>
              Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
