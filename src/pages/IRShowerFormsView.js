import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * Page: IRShowerFormsView
 * Objectif: Permettre de remplir les 2 documents fournis (Indépendance Royale)
 * - Onglet 1: "Étude technique" (formulaire récréé champ par champ)
 * - Onglet 2: "Plan technique indicatif douche" (grille + zones "Avant" / "Après" + accessoires)
 *
 * Mobile-first: gros tap-targets (≥44px), colonnes qui se stackent sous 768px,
 * canvas haute définition (DPR), gestes tactile/pointer pour tracer, barre sticky.
 *
 * Aucune dépendance externe: tout en React pur + <canvas>.
 * Export: impression du document (CTRL+P) + export PNG pour le plan (canvas.toDataURL)
 */

const Section = ({ title, children }) => (
  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16, background: "#fff" }}>
    <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700 }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ children }) => <div className="ir-row">{children}</div>;

const Col = ({ span = 6, children }) => (
  <div className={`ir-col span-${Math.min(12, Math.max(1, span))}`}>{children}</div>
);

const Label = ({ children }) => (
  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{children}</label>
);

const Input = ({ ...props }) => (
  <input {...props} style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} />
);

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

// === Canvas helpers (onglet 2) ===
const useGridCanvas = (canvasRef, options) => {
  const { beforeColor = "#0ea5a5", afterColor = "#0ea5a5" } = options || {};
  const api = useMemo(() => ({
    clear() {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    drawGrid() {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth; const cssH = canvas.clientHeight;
      canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cssW, cssH);

      const midY = Math.floor(cssH / 2);
      ctx.strokeStyle = "#0ea5a5"; ctx.lineWidth = 2; ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(cssW, midY); ctx.stroke();

      ctx.save();
      ctx.translate(16, 16); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = beforeColor; ctx.font = "bold 14px sans-serif";
      ctx.fillText("SdB AVANT — AVEC DIMENSIONS", -cssH / 2 - 80, -4);
      ctx.restore();

      ctx.save();
      ctx.translate(16, cssH - 16); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = afterColor; ctx.font = "bold 14px sans-serif";
      ctx.fillText("SdB APRÈS — AVEC DIMENSIONS", -cssH / 2 - 80, -4);
      ctx.restore();

      const gridSize = 20;
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
      for (let x = gridSize + 0.5; x < cssW; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke(); }
      for (let y = gridSize + 0.5; y < cssH; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke(); }
    },
    dim(x1, y1, x2, y2, label) {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "#0f172a"; ctx.fillStyle = "#0f172a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(label || `${Math.round(Math.hypot(x2 - x1, y2 - y1))}mm`, mx, my - 6);
      ctx.restore();
    },
    rect(x, y, w, h, label) {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      if (label) { ctx.font = "bold 12px sans-serif"; ctx.fillStyle = "#0f172a"; ctx.fillText(label, x + w / 2, y - 6); }
      ctx.restore();
    },
    downloadPNG(filename = "plan_douche.png") {
      const canvas = canvasRef.current; if (!canvas) return;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename; link.click();
    },
  }), [canvasRef, beforeColor, afterColor]);
  return api;
};

export default function IRShowerFormsView() {
  const [tab, setTab] = useState("etude");

  // === Onglet 1 — Étude technique ===
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
    travaux_autres: "",
    optionsValidation: { agree: false }
  });

  const toggleTravaux = (key) =>
    setStudy((s) => ({ ...s, travaux: { ...s.travaux, [key]: !s.travaux[key] } }));

  const printableRef = useRef(null);
  const printEtude = () => {
    const node = printableRef.current; if (!node) return;
    const prev = document.body.innerHTML;
    document.body.innerHTML = node.outerHTML;
    window.print();
    document.body.innerHTML = prev;
  };

  // === Onglet 2 — Plan technique ===
  const canvasRef = useRef(null);
  const canvas = useGridCanvas(canvasRef, {});

  useEffect(() => { if (tab === "plan") { canvas.drawGrid(); } }, [tab, canvas]);
  // Redessine si la taille change (rotation/split screen)
  useEffect(() => {
    if (tab !== "plan") return;
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => canvas.drawGrid());
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, canvas]);

  // Interactions pointer/tactile pour tracer vite des cotes
  const [drawing, setDrawing] = useState(null);
  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX ?? (e.touches?.[0]?.clientX || 0)) - rect.left;
    const y = (e.clientY ?? (e.touches?.[0]?.clientY || 0)) - rect.top;
    return { x, y };
  };
  const onPointerDown = (e) => { e.preventDefault(); setDrawing(pointerPos(e)); };
  const onPointerUp = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const { x, y } = pointerPos(e);
    canvas.dim(drawing.x, drawing.y, x, y);
    setDrawing(null);
  };

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
        button { min-height: 44px; }
        input, select, textarea { min-height: 44px; }
        .ir-tabs { position: sticky; top: 0; z-index: 10; background: #fff; padding-bottom: 8px; }
        .ir-canvas-wrap { height: 520px; }
        @media (max-width: 767px) { .ir-canvas-wrap { height: 420px; } }
        canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
      `}</style>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Documents IR – Douche</h1>

      <div className="ir-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan" ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
      </div>

      {tab === "etude" && (
        <div ref={printableRef}>
          <Section title="En-têtes">
            <Row>
              <Col span={4}><Label>Date de la visite</Label><Input type="date" value={study.date_visite} onChange={(e)=>setStudy(s=>({ ...s, date_visite:e.target.value }))} /></Col>
              <Col span={4}><Label>Installateur — Nom</Label><Input value={study.inst_nom} onChange={(e)=>setStudy(s=>({ ...s, inst_nom:e.target.value }))} /></Col>
              <Col span={4}><Label>Installateur — Prénom</Label><Input value={study.inst_prenom} onChange={(e)=>setStudy(s=>({ ...s, inst_prenom:e.target.value }))} /></Col>
            </Row>
            <Row>
              <Col span={4}><Label>Client — Nom</Label><Input value={study.client_nom} onChange={(e)=>setStudy(s=>({ ...s, client_nom:e.target.value }))} /></Col>
              <Col span={4}><Label>Client — Prénom</Label><Input value={study.client_prenom} onChange={(e)=>setStudy(s=>({ ...s, client_prenom:e.target.value }))} /></Col>
              <Col span={4}><Label>Client — Adresse</Label><Input value={study.client_adresse} onChange={(e)=>setStudy(s=>({ ...s, client_adresse:e.target.value }))} /></Col>
            </Row>
          </Section>

          <Section title="Étude technique">
            <Row>
              <Col span={6}><Label>Longueur receveur (mm)</Label><Input value={study.longueur_receveur} onChange={(e)=>setStudy(s=>({ ...s, longueur_receveur:e.target.value }))} /></Col>
              <Col span={6}><Label>Largeur receveur (mm)</Label><Input value={study.largeur_receveur} onChange={(e)=>setStudy(s=>({ ...s, largeur_receveur:e.target.value }))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Largeur d'accès douche (min 65cm)</Label><Input value={study.largeur_acces} onChange={(e)=>setStudy(s=>({ ...s, largeur_acces:e.target.value }))} /></Col>
              <Col span={6}><Label>Hauteur plafond (mm)</Label><Input value={study.hauteur_plafond} onChange={(e)=>setStudy(s=>({ ...s, hauteur_plafond:e.target.value }))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Hauteur estimée du receveur (mm)</Label><Input value={study.hauteur_estimee_receveur} onChange={(e)=>setStudy(s=>({ ...s, hauteur_estimee_receveur:e.target.value }))} /></Col>
              <Col span={6}><Label>Largeur de la salle de bains (mm)</Label><Input value={study.largeur_sdb} onChange={(e)=>setStudy(s=>({ ...s, largeur_sdb:e.target.value }))} /></Col>
            </Row>
            <Row>
              <Col span={6}><Label>Longueur de la salle de bains (mm)</Label><Input value={study.longueur_sdb} onChange={(e)=>setStudy(s=>({ ...s, longueur_sdb:e.target.value }))} /></Col>
              <Col span={6}><Label>Type de robinetterie</Label>
                <div>
                  <Radio name="robinetterie" label="Thermostatique" checked={study.robinetterie_type==="thermostatique"} onChange={()=>setStudy(s=>({ ...s, robinetterie_type:"thermostatique" }))} />
                  <Radio name="robinetterie" label="Mitigeur classique" checked={study.robinetterie_type==="mitigeur"} onChange={()=>setStudy(s=>({ ...s, robinetterie_type:"mitigeur" }))} />
                </div>
              </Col>
            </Row>
            <Row>
              <Col span={6}><Label>Vanne d'arrêt d'eau fonctionnelle</Label>
                <div>
                  <Radio name="vanne" label="Oui" checked={study.vanne_ok==="oui"} onChange={()=>setStudy(s=>({ ...s, vanne_ok:"oui" }))} />
                  <Radio name="vanne" label="Non" checked={study.vanne_ok==="non"} onChange={()=>setStudy(s=>({ ...s, vanne_ok:"non" }))} />
                </div>
              </Col>
              <Col span={6}><Label>Fenêtre</Label>
                <div>
                  <Radio name="fenetre" label="Oui" checked={study.fenetre==="oui"} onChange={()=>setStudy(s=>({ ...s, fenetre:"oui" }))} />
                  <Radio name="fenetre" label="Non" checked={study.fenetre==="non"} onChange={()=>setStudy(s=>({ ...s, fenetre:"non" }))} />
                </div>
              </Col>
            </Row>
            <Row>
              <Col span={4}><Label>Hauteur de fenêtre (mm)</Label><Input value={study.h_fenetre} onChange={(e)=>setStudy(s=>({ ...s, h_fenetre:e.target.value }))} /></Col>
              <Col span={4}><Label>Largeur de fenêtre (mm)</Label><Input value={study.l_fenetre} onChange={(e)=>setStudy(s=>({ ...s, l_fenetre:e.target.value }))} /></Col>
              <Col span={4}><Label>Distance fenêtre / mur gauche (mm)</Label><Input value={study.dist_gauche} onChange={(e)=>setStudy(s=>({ ...s, dist_gauche:e.target.value }))} /></Col>
            </Row>
            <Row>
              <Col span={4}><Label>Distance fenêtre / mur droit (mm)</Label><Input value={study.dist_droit} onChange={(e)=>setStudy(s=>({ ...s, dist_droit:e.target.value }))} /></Col>
              <Col span={4}><Label>Distance fenêtre / plafond (mm)</Label><Input value={study.dist_plafond} onChange={(e)=>setStudy(s=>({ ...s, dist_plafond:e.target.value }))} /></Col>
              <Col span={4}><Label>Distance fenêtre / sol (mm)</Label><Input value={study.dist_sol} onChange={(e)=>setStudy(s=>({ ...s, dist_sol:e.target.value }))} /></Col>
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
                <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({ ...s, travaux_autres:e.target.value }))} style={{ width: "100%", minHeight: 80, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
              </Col>
            </Row>
            <Small>Astuce: utilisez l'icône d'imprimante du navigateur pour sortir un PDF fidèle.</Small>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button onClick={printEtude} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>Imprimer / PDF</button>
            </div>
          </Section>
        </div>
      )}

      {tab === "plan" && (
        <div>
          <Section title="Entête">
            <Row>
              <Col span={6}><Label>Nom</Label><Input value={study.client_nom} onChange={(e)=>setStudy(s=>({ ...s, client_nom:e.target.value }))} /></Col>
              <Col span={6}><Label>Prénom</Label><Input value={study.client_prenom} onChange={(e)=>setStudy(s=>({ ...s, client_prenom:e.target.value }))} /></Col>
            </Row>
            <Small>Plan non contractuel. Une validation technique est requise avant travaux.</Small>
          </Section>

          <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700 }}>Grille de dessin</div>
              <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "flex-end" }}>
                <button onClick={()=>{canvas.clear();canvas.drawGrid();}} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>Réinitialiser</button>
                <button onClick={()=>canvas.downloadPNG()} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>Exporter PNG</button>
              </div>
            </div>
            <div className="ir-canvas-wrap">
              <canvas
                ref={canvasRef}
                className="ir-grid"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchEnd={onPointerUp}
                style={{ cursor: "crosshair" }}
              />
            </div>
          </div>

          <Section title="Accessoires">
            <Row>
              <Col span={3}><Check label="Siège" checked={accessoires.siege} onChange={()=>setAccessoires(a=>({ ...a, siege: !a.siege }))} /></Col>
              <Col span={3}><Check label="Barre de maintien" checked={accessoires.barre} onChange={()=>setAccessoires(a=>({ ...a, barre: !a.barre }))} /></Col>
              <Col span={3}>
                <Label>Robinetterie</Label>
                <select value={accessoires.robinetterie} onChange={(e)=>setAccessoires(a=>({ ...a, robinetterie:e.target.value }))} style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
                  <option value="mitigeur">Mitigeur</option>
                  <option value="thermostatique">Thermostatique</option>
                </select>
              </Col>
              <Col span={3}><Check label="Ciel de pluie" checked={accessoires.ciel} onChange={()=>setAccessoires(a=>({ ...a, ciel: !a.ciel }))} /></Col>
            </Row>
            <Row>
              <Col span={12}><Label>Commentaires</Label>
                <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({ ...s, travaux_autres:e.target.value }))} placeholder="Notes complémentaires pour le plan…" style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
              </Col>
            </Row>
            <Small>Astuce: Cliquez-déposez pour tracer rapidement une cote. Utilisez Réinitialiser pour repartir d'une grille vierge.</Small>
          </Section>
        </div>
      )}
    </div>
  );
}
