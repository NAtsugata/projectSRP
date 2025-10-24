import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * IRShowerFormsView
 * - Onglet 1: Étude technique (Formulaire <-> Maquette PDF)
 * - Onglet 2: Plan technique (outils de dessin)
 * Mobile-first.
 */

const ETUDE_BG_URL = "/ir/etude.png"; // <-- mets ton image ici: public/ir/etude.png
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
const Input = ({ ...props }) => <input {...props} style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 14, minHeight: 44 }} />;
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

/* ---------- Canvas Plan technique ---------- */
const useGridCanvas = (canvasRef) => {
  const drawBase = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    const midY = Math.floor(h / 2);
    ctx.strokeStyle = "#0ea5a5"; ctx.lineWidth = 2; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
    ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 2); ctx.fillStyle = "#0ea5a5"; ctx.font = "bold 14px sans-serif";
    ctx.fillText("SdB AVANT — AVEC DIMENSIONS", -h / 2 - 80, -4); ctx.restore();
    ctx.save(); ctx.translate(16, h - 16); ctx.rotate(-Math.PI / 2); ctx.fillStyle = "#0ea5a5"; ctx.font = "bold 14px sans-serif";
    ctx.fillText("SdB APRÈS — AVEC DIMENSIONS", -h / 2 - 80, -4); ctx.restore();
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
      const { ctx, w, h } = sized; drawBase(ctx, w, h);
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
      const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = filename; a.click();
    }
  }), [canvasRef]);
  return api;
};

/* ---------- Component ---------- */
export default function IRShowerFormsView() {
  const [tab, setTab] = useState("etude");

  /* ============================
   * ÉTUDE TECHNIQUE
   * ============================ */
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

  // 1. Vue formulaire imprimable (classique)
  const printableRef = useRef(null);
  const printEtude = () => {
    const node = printableRef.current; if (!node) return;
    const prev = document.body.innerHTML; document.body.innerHTML = node.outerHTML; window.print(); document.body.innerHTML = prev;
  };

  // 2. Vue maquette PDF (image de fond + champs positionnés)
  const [etudeImg, setEtudeImg] = useState(null);
  useEffect(() => {
    const im = new Image(); im.src = ETUDE_BG_URL; im.onload = () => setEtudeImg(im);
  }, []);
  const [etudeView, setEtudeView] = useState("form"); // "form" | "mockup"

  // Coordonnées relatives (0..1) → indépendantes de la taille écran
  // À AJUSTER au besoin pour coller pile-poil au visuel.
  const coords = {
    date_visite: { x: 0.70, y: 0.10 },
    inst_nom:    { x: 0.66, y: 0.18 },
    inst_prenom: { x: 0.66, y: 0.22 },
    client_nom:  { x: 0.10, y: 0.18 },
    client_prenom:{ x:0.10, y: 0.22 },
    client_adresse:{ x:0.10, y: 0.26 },
    longueur_receveur:{ x:0.24, y:0.40 },
    largeur_receveur: { x:0.24, y:0.43 },
    largeur_acces:    { x:0.42, y:0.43 },
    hauteur_plafond:  { x:0.24, y:0.46 },
    hauteur_estimee_receveur:{ x:0.36, y:0.46 },
    largeur_sdb:      { x:0.27, y:0.49 },
    longueur_sdb:     { x:0.48, y:0.49 },
    robinetterie_type_thermo: { x:0.25, y:0.52 },
    robinetterie_type_mitigeur:{ x:0.52, y:0.52 },
    vanne_ok_oui:     { x:0.25, y:0.55 },
    vanne_ok_non:     { x:0.34, y:0.55 },
    fenetre_oui:      { x:0.20, y:0.58 },
    fenetre_non:      { x:0.30, y:0.58 },
    h_fenetre:        { x:0.28, y:0.59 },
    l_fenetre:        { x:0.28, y:0.62 },
    dist_gauche:      { x:0.40, y:0.62 },
    dist_droit:       { x:0.58, y:0.62 },
    dist_plafond:     { x:0.40, y:0.65 },
    dist_sol:         { x:0.28, y:0.68 },

    // travaux (colonne gauche, approximatif)
    t_coffrage:            { x:0.08, y:0.73 },
    t_creation_entretoise: { x:0.08, y:0.76 },
    t_reprise_sol:         { x:0.08, y:0.79 },
    t_saignee_sol:         { x:0.08, y:0.82 },
    t_modif_plomberie:     { x:0.08, y:0.85 },
    t_depose_wc_ou_meuble: { x:0.08, y:0.88 },
    t_depose_bidet:        { x:0.08, y:0.91 },
    t_depose_douche_suppl: { x:0.44, y:0.73 },
    t_depose_sanitaire:    { x:0.44, y:0.76 },
    t_depl_machine:        { x:0.44, y:0.79 },
    t_depl_prise:          { x:0.44, y:0.82 },
    t_pompe_relevage:      { x:0.44, y:0.85 },
    t_finition_haute:      { x:0.44, y:0.88 },
  };

  // Export maquette: rendu image + texte/checkbox → impression (PDF via navigateur)
  const exportEtudeMockup = () => {
    if (!etudeImg) return;
    const scale = 1; // rendu à la taille d'origine de l'image
    const W = etudeImg.naturalWidth, H = etudeImg.naturalHeight;
    const canvas = document.createElement("canvas"); canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(etudeImg, 0, 0, canvas.width, canvas.height);

    const putText = (text, key, align="left") => {
      const c = coords[key]; if (!c || !text) return;
      ctx.fillStyle = "#111827"; ctx.font = `${14*scale}px Helvetica`; ctx.textBaseline = "top";
      if (align==="center") { ctx.textAlign="center"; } else { ctx.textAlign="left"; }
      ctx.fillText(text, c.x * canvas.width, c.y * canvas.height);
    };
    const box = (key, checked=false) => {
      const c = coords[key]; if (!c) return;
      const s = 14*scale;
      ctx.strokeStyle = "#111827"; ctx.lineWidth = 1.5*scale;
      ctx.strokeRect(c.x*canvas.width, c.y*canvas.height, s, s);
      if (checked) {
        ctx.beginPath();
        ctx.moveTo(c.x*canvas.width+3*scale, c.y*canvas.height+7*scale);
        ctx.lineTo(c.x*canvas.width+6*scale, c.y*canvas.height+11*scale);
        ctx.lineTo(c.x*canvas.width+11*scale, c.y*canvas.height+3*scale);
        ctx.stroke();
      }
    };

    // textes principaux
    putText(study.date_visite, "date_visite");
    putText(study.inst_nom, "inst_nom"); putText(study.inst_prenom, "inst_prenom");
    putText(study.client_nom, "client_nom"); putText(study.client_prenom, "client_prenom"); putText(study.client_adresse, "client_adresse");
    putText(study.longueur_receveur, "longueur_receveur");
    putText(study.largeur_receveur, "largeur_receveur");
    putText(study.largeur_acces, "largeur_acces");
    putText(study.hauteur_plafond, "hauteur_plafond");
    putText(study.hauteur_estimee_receveur, "hauteur_estimee_receveur");
    putText(study.largeur_sdb, "largeur_sdb"); putText(study.longueur_sdb, "longueur_sdb");
    putText(study.h_fenetre, "h_fenetre"); putText(study.l_fenetre, "l_fenetre");
    putText(study.dist_gauche, "dist_gauche"); putText(study.dist_droit, "dist_droit");
    putText(study.dist_plafond, "dist_plafond"); putText(study.dist_sol, "dist_sol");

    // cases à cocher
    box("robinetterie_type_thermo", study.robinetterie_type==="thermostatique");
    box("robinetterie_type_mitigeur", study.robinetterie_type==="mitigeur");
    box("vanne_ok_oui", study.vanne_ok==="oui");
    box("vanne_ok_non", study.vanne_ok==="non");
    box("fenetre_oui", study.fenetre==="oui");
    box("fenetre_non", study.fenetre==="non");

    const t = study.travaux;
    box("t_coffrage", t.coffrage); box("t_creation_entretoise", t.creation_entretoise); box("t_reprise_sol", t.reprise_sol);
    box("t_saignee_sol", t.saignee_sol); box("t_modif_plomberie", t.modif_plomberie); box("t_depose_wc_ou_meuble", t.depose_wc_ou_meuble);
    box("t_depose_bidet", t.depose_bidet); box("t_depose_douche_suppl", t.depose_douche_suppl); box("t_depose_sanitaire", t.depose_sanitaire);
    box("t_depl_machine", t.depl_machine); box("t_depl_prise", t.depl_prise); box("t_pompe_relevage", t.pompe_relevage); box("t_finition_haute", t.finition_haute);

    // Ouvrir pour impression → PDF
    const dataURL = canvas.toDataURL("image/png");
    const w = window.open("");
    if (w) {
      w.document.write(`<html><head><title>Étude technique</title><style>html,body{margin:0;padding:0}</style></head>
        <body><img src="${dataURL}" style="width:100%;height:auto"/></body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300); // l’utilisateur choisit “Enregistrer en PDF”
    }
  };

  /* ============================
   * PLAN TECHNIQUE
   * ============================ */
  const canvasRef = useRef(null);
  const canvas = useGridCanvas(canvasRef);
  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tool, setTool] = useState("dim");
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [startPt, setStartPt] = useState(null);

  const applySnap = (x,y) => snap ? ({ x: Math.round(x/GRID_SIZE)*GRID_SIZE, y: Math.round(y/GRID_SIZE)*GRID_SIZE }) : ({x,y});
  const applyOrtho = (x1,y1,x2,y2) => {
    if (!ortho) return { x2, y2 };
    const dx=x2-x1, dy=y2-y1; return Math.abs(dx)>Math.abs(dy) ? { x2, y2:y1 } : { x2:x1, y2 };
  };
  const pointerPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX ?? (e.touches?.[0]?.clientX || 0)) - r.left;
    const cy = (e.clientY ?? (e.touches?.[0]?.clientY || 0)) - r.top;
    return applySnap(cx, cy);
  };
  const onDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);
    if (tool === "mixer" || tool === "seat") { setElements((els)=>[...els,{type:"symbol",kind:tool,x:p.x,y:p.y}]); return; }
    if (tool === "text") { const t = window.prompt("Texte à placer :"); if (t?.trim()) setElements((els)=>[...els,{type:"text",x:p.x,y:p.y,text:t}]); return; }
    setStartPt(p);
  };
  const onMove = (e) => {
    if (!startPt) return;
    let {x:x2,y:y2} = pointerPos(e);
    if (tool === "dim" || tool === "rect") ({x2,y2} = applyOrtho(startPt.x,startPt.y,x2,y2));
    if (tool === "dim") setPreview({type:"dim",x1:startPt.x,y1:startPt.y,x2,y2});
    if (tool === "rect") setPreview({type:"rect",x:Math.min(startPt.x,x2),y:Math.min(startPt.y,y2),w:Math.abs(x2-startPt.x),h:Math.abs(y2-startPt.y)});
  };
  const onUp = (e) => {
    if (!startPt) return; e.preventDefault();
    let {x:x2,y:y2} = pointerPos(e);
    if (tool === "dim" || tool === "rect") ({x2,y2} = applyOrtho(startPt.x,startPt.y,x2,y2));
    if (tool === "dim") {
      const auto = `${Math.round(Math.hypot(x2-startPt.x,y2-startPt.y))}mm`;
      const label = window.prompt("Libellé de la cote (laisser vide pour auto)", auto) || auto;
      setElements((els)=>[...els,{type:"dim",x1:startPt.x,y1:startPt.y,x2,y2,label}]);
    }
    if (tool === "rect") setElements((els)=>[...els,{type:"rect",x:Math.min(startPt.x,x2),y:Math.min(startPt.y,y2),w:Math.abs(x2-startPt.x),h:Math.abs(y2-startPt.y)}]);
    setStartPt(null); setPreview(null);
  };
  const undo = () => setElements((els)=>els.slice(0,-1));
  const resetPlan = () => { setElements([]); setPreview(null); };
  useEffect(()=>{ if (tab==="plan") canvas.draw(elements, preview); }, [tab, elements, preview, canvas]);
  useEffect(()=>{ if (tab!=="plan") return; const el=canvasRef.current; if(!el) return; const ro=new ResizeObserver(()=>canvas.draw(elements, preview)); ro.observe(el); return()=>ro.disconnect(); },[tab,elements,preview,canvas]);

  const [accessoires, setAccessoires] = useState({ siege:false, barre:false, robinetterie:"mitigeur", ciel:false });

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
        button { min-height: 44px; }
        input, select, textarea { min-height: 44px; }
      `}</style>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Documents IR – Douche</h1>

      <div className="ir-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan" ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
      </div>

      {/* ==== ÉTUDE : sous-onglets ==== */}
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
                    <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} style={{ width: "100%", minHeight: 80, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, minHeight: 100 }} />
                  </Col>
                </Row>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={printEtude} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>Imprimer / PDF</button>
                </div>
              </Section>
            </div>
          ) : (
            <Section title="Maquette PDF — remplissage direct sur le visuel">
              <Small>Les champs sont positionnés sur l’image de fond. Ajuste les valeurs puis clique « Exporter (PDF) ».</Small>
              <div style={{ position: "relative", width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
                <img src={ETUDE_BG_URL} alt="Étude technique" style={{ width: "100%", height: "auto", display: "block" }} />
                {/* Overlay inputs par pourcentage */}
                {[
                  ["date_visite","",coords.date_visite],
                  ["inst_nom","",coords.inst_nom],
                  ["inst_prenom","",coords.inst_prenom],
                  ["client_nom","",coords.client_nom],
                  ["client_prenom","",coords.client_prenom],
                  ["client_adresse","",coords.client_adresse],
                  ["longueur_receveur","",coords.longueur_receveur],
                  ["largeur_receveur","",coords.largeur_receveur],
                  ["largeur_acces","",coords.largeur_acces],
                  ["hauteur_plafond","",coords.hauteur_plafond],
                  ["hauteur_estimee_receveur","",coords.hauteur_estimee_receveur],
                  ["largeur_sdb","",coords.largeur_sdb],
                  ["longueur_sdb","",coords.longueur_sdb],
                  ["h_fenetre","",coords.h_fenetre],
                  ["l_fenetre","",coords.l_fenetre],
                  ["dist_gauche","",coords.dist_gauche],
                  ["dist_droit","",coords.dist_droit],
                  ["dist_plafond","",coords.dist_plafond],
                  ["dist_sol","",coords.dist_sol],
                ].map(([key, placeholder, c]) => c && (
                  <input
                    key={key}
                    value={study[key] ?? ""}
                    onChange={(e)=>setStudy(s=>({ ...s, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      position:"absolute",
                      left: `${c.x*100}%`,
                      top: `${c.y*100}%`,
                      transform:"translateY(-50%)",
                      width:"28%",
                      border:"1px solid rgba(0,0,0,0.2)",
                      background:"rgba(255,255,255,0.85)",
                      borderRadius:6,
                      padding:"6px 8px",
                      fontSize:12
                    }}
                  />
                ))}
                {/* Radios/checkbox overlay simples */}
                <label style={{position:"absolute", left:`${coords.robinetterie_type_thermo.x*100}%`, top:`${coords.robinetterie_type_thermo.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.robinetterie_type==="thermostatique"} onChange={()=>setStudy(s=>({...s, robinetterie_type:"thermostatique"}))} /> Thermo
                </label>
                <label style={{position:"absolute", left:`${coords.robinetterie_type_mitigeur.x*100}%`, top:`${coords.robinetterie_type_mitigeur.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.robinetterie_type==="mitigeur"} onChange={()=>setStudy(s=>({...s, robinetterie_type:"mitigeur"}))} /> Mitigeur
                </label>
                <label style={{position:"absolute", left:`${coords.vanne_ok_oui.x*100}%`, top:`${coords.vanne_ok_oui.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.vanne_ok==="oui"} onChange={()=>setStudy(s=>({...s, vanne_ok:"oui"}))} /> Vanne OUI
                </label>
                <label style={{position:"absolute", left:`${coords.vanne_ok_non.x*100}%`, top:`${coords.vanne_ok_non.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.vanne_ok==="non"} onChange={()=>setStudy(s=>({...s, vanne_ok:"non"}))} /> NON
                </label>
                <label style={{position:"absolute", left:`${coords.fenetre_oui.x*100}%`, top:`${coords.fenetre_oui.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.fenetre==="oui"} onChange={()=>setStudy(s=>({...s, fenetre:"oui"}))} /> Fenêtre OUI
                </label>
                <label style={{position:"absolute", left:`${coords.fenetre_non.x*100}%`, top:`${coords.fenetre_non.y*100}%`, transform:"translate(-10px,-6px)", background:"rgba(255,255,255,.6)", padding:"2px 4px", borderRadius:4, fontSize:12}}>
                  <input type="checkbox" checked={study.fenetre==="non"} onChange={()=>setStudy(s=>({...s, fenetre:"non"}))} /> NON
                </label>
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

      {/* ==== PLAN TECHNIQUE ==== */}
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
              <button onClick={canvas.downloadPNG}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Exporter PNG</button>
              <button onClick={resetPlan}             style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Réinitialiser</button>
            </div>
          </Section>

          <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <div className="ir-canvas-wrap">
              <canvas
                ref={canvasRef}
                className="ir-grid"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onTouchStart={onDown}
                onTouchMove={onMove}
                onTouchEnd={onUp}
                style={{ cursor: (tool==="mixer"||tool==="seat"||tool==="text") ? "cell" : "crosshair" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
