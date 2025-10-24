// FILE: src/pages/IRShowerFormsView.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * IRShowerFormsView — Étude technique (Formulaire + Maquette PDF A4 300DPI) + Plan technique
 * - On conserve toutes les fonctionnalités précédentes (dessin, outils, undo, reset, export…)
 * - On ajoute un 2e mode d’affichage pour l’étude: "Maquette PDF" fidèle au visuel.
 * Mobile-first, sans dépendances externes.
 */

const ETUDE_BG_URL = "/ir/etude.png"; // place le visuel dans public/ir/etude.png
const A4 = { wmm: 210, hmm: 297 };   // A4 portrait, en millimètres
const GRID_SIZE = 20;

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

/* ---------- PLAN TECHNIQUE (canvas) ---------- */
const useGridCanvas = (canvasRef) => {
  const drawBase = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    const midY = Math.floor(h / 2);
    ctx.strokeStyle = "#0ea5a5"; ctx.lineWidth = 2; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#0ea5a5"; ctx.font = "bold 14px sans-serif";
    ctx.fillText("SdB AVANT — AVEC DIMENSIONS", -h / 2 - 80, -4);
    ctx.restore();

    ctx.save(); ctx.translate(16, h - 16); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#0ea5a5"; ctx.font = "bold 14px sans-serif";
    ctx.fillText("SdB APRÈS — AVEC DIMENSIONS", -h / 2 - 80, -4);
    ctx.restore();

    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
    for (let x = GRID_SIZE + 0.5; x < w; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = GRID_SIZE + 0.5; y < h; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  };

  const api = useMemo(() => ({
    resize() {
      const c = canvasRef.current; if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      const cw = c.clientWidth, ch = c.clientHeight;
      c.width = Math.floor(cw * dpr); c.height = Math.floor(ch * dpr);
      const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: cw, h: ch };
    },
    draw(elements = [], preview = null) {
      const sized = api.resize(); if (!sized) return;
      const { ctx, w, h } = sized;
      drawBase(ctx, w, h);
      const all = [...elements, ...(preview ? [preview] : [])];

      for (const el of all) {
        if (el.type === "dim") {
          ctx.save(); ctx.strokeStyle = "#0f172a"; ctx.fillStyle = "#0f172a"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
          const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
          ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(el.label ?? `${Math.round(Math.hypot(el.x2 - el.x1, el.y2 - el.y1))}mm`, mx, my - 6);
          ctx.restore();
        } else if (el.type === "rect") {
          ctx.save(); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.strokeRect(el.x, el.y, el.w, el.h); ctx.restore();
        } else if (el.type === "text") {
          ctx.save(); ctx.fillStyle = "#0f172a"; ctx.font = "bold 12px sans-serif"; ctx.fillText(el.text, el.x, el.y); ctx.restore();
        } else if (el.type === "symbol") {
          ctx.save(); ctx.translate(el.x, el.y); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2;
          if (el.kind === "mixer") { ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(8,0); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke(); }
          if (el.kind === "seat")  { ctx.strokeRect(-12,-8,24,16); ctx.beginPath(); ctx.moveTo(-12,2); ctx.lineTo(12,2); ctx.stroke(); }
          ctx.restore();
        }
      }
    },
    downloadPNG(filename = "plan_douche.png") {
      const canvas = canvasRef.current; if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename; a.click();
    }
  }), [canvasRef]);

  return api;
};

/* ---------- PAGE ---------- */
export default function IRShowerFormsView() {
  const [tab, setTab] = useState("etude");

  /* ===== Étude technique ===== */
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

  // Vue 1: formulaire
  const printableRef = useRef(null);
  const printEtude = () => {
    const node = printableRef.current; if (!node) return;
    const prev = document.body.innerHTML;
    document.body.innerHTML = node.outerHTML;
    window.print();
    document.body.innerHTML = prev;
  };

  // Vue 2: maquette PDF (A4 mm)
  const [etudeView, setEtudeView] = useState("form"); // "form" | "mockup"
  const [bgImg, setBgImg] = useState(null);
  useEffect(() => { const im = new Image(); im.src = ETUDE_BG_URL; im.onload = () => setBgImg(im); }, []);
  const boxRef = useRef(null);

  // Champs & cases positionnés en millimètres (A4). Ajuste si besoin.
  const FIELDS_MM = [
    { key: "date_visite", x: 150, y: 22,  w: 40 },
    { key: "inst_nom",    x: 140, y: 53,  w: 55 },
    { key: "inst_prenom", x: 140, y: 63,  w: 55 },
    { key: "client_nom",  x: 18,  y: 53,  w: 60 },
    { key: "client_prenom",x: 18, y: 63,  w: 60 },
    { key: "client_adresse",x:18, y: 73,  w: 100 },

    { key: "longueur_receveur", x:26, y:113, w:30 },
    { key: "largeur_receveur",  x:26, y:120, w:30 },
    { key: "largeur_acces",     x:80, y:120, w:30 },
    { key: "hauteur_plafond",   x:26, y:127, w:30 },
    { key: "hauteur_estimee_receveur", x:78, y:127, w:30 },
    { key: "largeur_sdb",       x:42, y:134, w:30 },
    { key: "longueur_sdb",      x:86, y:134, w:30 },

    { key: "h_fenetre",   x:40, y:152, w:28 },
    { key: "l_fenetre",   x:40, y:159, w:28 },
    { key: "dist_gauche", x:86, y:159, w:28 },
    { key: "dist_droit",  x:132,y:159, w:28 },
    { key: "dist_plafond",x:86, y:166, w:28 },
    { key: "dist_sol",    x:40, y:173, w:28 },
  ];
  const CHECKS_MM = [
    { key: "robinetterie_type", value: "thermostatique", label: "Thermo",   x: 26,  y: 141 },
    { key: "robinetterie_type", value: "mitigeur",       label: "Mitigeur", x: 108, y: 141 },
    { key: "vanne_ok", value: "oui",  label: "Vanne OUI", x: 26, y: 145 },
    { key: "vanne_ok", value: "non",  label: "NON",       x: 48, y: 145 },
    { key: "fenetre",  value: "oui",  label: "Fenêtre OUI", x: 26, y: 149 },
    { key: "fenetre",  value: "non",  label: "NON",         x: 48, y: 149 },
  ];

  const mmToPctStyle = (xmm, ymm, wmm = 30) => {
    const left = `${(xmm / A4.wmm) * 100}%`;
    const top  = `${(ymm / A4.hmm) * 100}%`;
    const width = `${(wmm / A4.wmm) * 100}%`;
    return { left, top, width };
  };

  const exportEtudeMockup = () => {
    if (!bgImg) return;
    const W = 2480, H = 3508; // 300 DPI A4
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);
    ctx.drawImage(bgImg, 0, 0, W, H);

    const drawText = (text, xmm, ymm, fontsize=22) => {
      if (!text) return;
      ctx.fillStyle = "#111827";
      ctx.font = `bold ${fontsize}px Helvetica`;
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillText(text, (xmm/A4.wmm)*W, (ymm/A4.hmm)*H);
    };
    const drawBox = (xmm, ymm, checked=false) => {
      const x = (xmm/A4.wmm)*W, y=(ymm/A4.hmm)*H, s=30;
      ctx.strokeStyle = "#111827"; ctx.lineWidth = 3;
      ctx.strokeRect(x, y, s, s);
      if (checked) { ctx.beginPath(); ctx.moveTo(x+6, y+16); ctx.lineTo(x+12, y+24); ctx.lineTo(x+24, y+8); ctx.stroke(); }
    };

    for (const f of FIELDS_MM) drawText(study[f.key], f.x, f.y, 22);
    for (const ch of CHECKS_MM) {
      const checked =
        (ch.key === "robinetterie_type" && study.robinetterie_type === ch.value) ||
        (ch.key === "vanne_ok" && study.vanne_ok === ch.value) ||
        (ch.key === "fenetre" && study.fenetre === ch.value);
      drawBox(ch.x, ch.y, checked);
    }

    const dataURL = c.toDataURL("image/png");
    const w = window.open("");
    if (w) {
      w.document.write(`<html><head><title>Étude technique</title>
        <style>@page{size:A4;margin:0}html,body{margin:0;padding:0}</style></head>
        <body><img src="${dataURL}" style="width:210mm;height:297mm;display:block"/></body></html>`);
      w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
    }
  };

  /* ===== Plan technique (dessin) — on garde tout ===== */
  const canvasRef = useRef(null);
  const canvas = useGridCanvas(canvasRef);
  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tool, setTool] = useState("dim"); // 'dim' | 'rect' | 'mixer' | 'seat' | 'text'
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [startPt, setStartPt] = useState(null);

  useEffect(() => { if (tab === "plan") canvas.draw(elements, preview); }, [tab, elements, preview, canvas]);
  useEffect(() => {
    if (tab !== "plan") return;
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => canvas.draw(elements, preview));
    ro.observe(el); return () => ro.disconnect();
  }, [tab, elements, preview, canvas]);

  const applySnap = (x,y) => snap ? ({ x: Math.round(x/GRID_SIZE)*GRID_SIZE, y: Math.round(y/GRID_SIZE)*GRID_SIZE }) : ({x,y});
  const applyOrtho = (x1,y1,x2,y2) => {
    if (!ortho) return { x2, y2 };
    const dx = x2 - x1, dy = y2 - y1;
    return Math.abs(dx) > Math.abs(dy) ? { x2, y2: y1 } : { x2: x1, y2 };
  };
  const pointerPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX ?? (e.touches?.[0]?.clientX || 0)) - r.left;
    const cy = (e.clientY ?? (e.touches?.[0]?.clientY || 0)) - r.top;
    return applySnap(cx, cy);
  };

  const onPointerDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);

    if (tool === "mixer" || tool === "seat") {
      setElements((els) => [...els, { type: "symbol", kind: tool, x: p.x, y: p.y }]);
      return;
    }
    if (tool === "text") {
      const t = window.prompt("Texte à placer :");
      if (t?.trim()) setElements((els) => [...els, { type: "text", x: p.x, y: p.y, text: t }]);
      return;
    }
    setStartPt(p);
  };

  const onPointerMove = (e) => {
    if (!startPt) return;
    let { x: x2, y: y2 } = pointerPos(e);
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));
    if (tool === "dim") {
      setPreview({ type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 });
    } else if (tool === "rect") {
      setPreview({ type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) });
    }
  };

  const onPointerUp = (e) => {
    if (!startPt) return; e.preventDefault();
    let { x: x2, y: y2 } = pointerPos(e);
    if (tool === "dim" || tool === "rect") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      const auto = `${Math.round(Math.hypot(x2 - startPt.x, y2 - startPt.y))}mm`;
      const label = window.prompt("Libellé de la cote (laisser vide pour auto)", auto) || auto;
      setElements((els) => [...els, { type: "dim", x1: startPt.x, y1: startPt.y, x2, y2, label }]);
    } else if (tool === "rect") {
      setElements((els) => [...els, { type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) }]);
    }
    setStartPt(null); setPreview(null);
  };

  const undo = () => setElements((els) => els.slice(0, -1));
  const resetPlan = () => { setElements([]); setPreview(null); canvas.draw([]); };

  /* ===== Accessoires ===== */
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
        .ir-canvas-wrap { height: 520px; }
        @media (max-width: 767px) { .ir-canvas-wrap { height: 420px; } }
        canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
        .a4-box { position: relative; width: 100%; aspect-ratio: 210 / 297; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #fff; }
        .a4-bg  { width: 100%; height: 100%; object-fit: cover; display: block; }
        .a4-field { position: absolute; transform: translateY(-50%); border: 1px solid rgba(0,0,0,.2); background: rgba(255,255,255,.85); border-radius: 6px; padding: 6px 8px; font-size: 12px; min-height: 34px; }
        button, input, select, textarea { min-height: 44px; }
      `}</style>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Documents IR – Douche</h1>

      <div className="ir-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
      </div>

      {/* ==== ETUDE ==== */}
      {tab === "etude" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setEtudeView("form")}   style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: etudeView==="form" ? "#e2e8f0" : "#fff" }}>Vue Formulaire</button>
            <button onClick={() => setEtudeView("mockup")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: etudeView==="mockup" ? "#e2e8f0" : "#fff" }}>Vue Maquette PDF</button>
          </div>

          {etudeView === "form" ? (
            <div ref={printableRef}>
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
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={printEtude} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>Imprimer / PDF</button>
                </div>
              </Section>
            </div>
          ) : (
            <Section title="Maquette PDF (A4)">
              <Small>Champs positionnés en millimètres. Export net (300 DPI) via l’impression du navigateur.</Small>
              <div ref={boxRef} className="a4-box">
                <img className="a4-bg" src={ETUDE_BG_URL} alt="Étude technique" />
                {FIELDS_MM.map((f) => (
                  <input
                    key={f.key}
                    className="a4-field"
                    value={study[f.key] ?? ""}
                    onChange={(e)=>setStudy(s=>({ ...s, [f.key]: e.target.value }))}
                    style={mmToPctStyle(f.x, f.y, f.w)}
                  />
                ))}
                {CHECKS_MM.map((c) => {
                  const style = mmToPctStyle(c.x, c.y, 0);
                  const checked =
                    (c.key === "robinetterie_type" && study.robinetterie_type === c.value) ||
                    (c.key === "vanne_ok" && study.vanne_ok === c.value) ||
                    (c.key === "fenetre" && study.fenetre === c.value);
                  return (
                    <label key={`${c.key}-${c.value}`} style={{ position:"absolute", left:style.left, top:style.top, transform:"translate(-6px,-12px)", background:"rgba(255,255,255,.7)", borderRadius:4, padding:"2px 4px", fontSize:12 }}>
                      <input type="checkbox" checked={checked}
                        onChange={()=>{
                          if (c.key === "robinetterie_type") setStudy(s=>({ ...s, robinetterie_type: c.value }));
                          if (c.key === "vanne_ok")        setStudy(s=>({ ...s, vanne_ok: c.value }));
                          if (c.key === "fenetre")         setStudy(s=>({ ...s, fenetre: c.value }));
                        }}
                      /> {c.label}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={exportEtudeMockup} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
                  Exporter (PDF via impression)
                </button>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ==== PLAN ==== */}
      {tab === "plan" && (
        <div>
          <Section title="Outils">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={()=>setTool("dim")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="dim"?"#e2e8f0":"#fff" }}>Cote</button>
              <button onClick={()=>setTool("rect")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rect"?"#e2e8f0":"#fff" }}>Rect</button>
              <button onClick={()=>setTool("mixer")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="mixer"?"#e2e8f0":"#fff" }}>Mitigeur</button>
              <button onClick={()=>setTool("seat")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="seat"?"#e2e8f0":"#fff" }}>Siège</button>
              <button onClick={()=>setTool("text")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="text"?"#e2e8f0":"#fff" }}>Texte</button>
              <button onClick={()=>setSnap(s=>!s)}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: snap?"#e2e8f0":"#fff" }}>{snap?"Snap ✓":"Snap ✗"}</button>
              <button onClick={()=>setOrtho(o=>!o)}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: ortho?"#e2e8f0":"#fff" }}>{ortho?"Ortho ✓":"Ortho ✗"}</button>
              <button onClick={undo}                  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Undo</button>
              <button onClick={()=>canvas.downloadPNG()} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Exporter PNG</button>
              <button onClick={resetPlan}             style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Réinitialiser</button>
            </div>
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
                style={{ cursor: (tool==="mixer"||tool==="seat"||tool==="text") ? "cell" : "crosshair" }}
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
                <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} placeholder="Notes complémentaires pour le plan…" style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
              </Col>
            </Row>
          </Section>
        </div>
      )}
    </div>
  );
}
