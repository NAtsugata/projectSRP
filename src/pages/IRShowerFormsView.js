// FILE: src/pages/IRShowerFormsView.jsx — VERSION OPTIMISÉE MOBILE
import React, { useMemo, useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * IRShowerFormsView — Étude + Plan technique + Signatures + Photos
 * AMÉLIORATIONS :
 * - Outils dessin : Barre de maintien, Ciel de pluie, Porte, Fenêtre
 * - Couleurs personnalisables
 * - Signatures électroniques (client + installateur)
 * - Gestion photos AVANT/APRÈS avec rotation
 * - Export PDF 3 pages OPTIMISÉ
 * - Interface RESPONSIVE mobile
 * - Légende complète avec explications
 * - 💾 SAUVEGARDE AUTOMATIQUE (localStorage)
 * - ✅ VALIDATION champs obligatoires
 * - 📊 BARRE DE PROGRESSION export
 * - 🔔 NOTIFICATIONS toast
 * - 📥 EXPORT/IMPORT JSON
 */

const GRID_SIZE = 20;
const HIT_PAD = 10;
const BANNER_H = 40;
const LABEL_OFFSET = 8;
const AUTOSAVE_KEY = "ir_douche_autosave";
const AUTOSAVE_INTERVAL = 30000; // 30 secondes

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
const Small = ({ children, style }) => <div style={{ fontSize: 12, color: "#64748b", ...style }}>{children}</div>;

/* ---------- Toast Notification Component ---------- */
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";

  return (
    <div style={{
      position: "fixed",
      top: 80,
      right: 20,
      zIndex: 9999,
      background: bgColor,
      color: "#fff",
      padding: "12px 20px",
      borderRadius: 8,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 300,
      maxWidth: 500,
      animation: "slideIn 0.3s ease"
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          fontSize: 18,
          padding: 0,
          width: 24,
          height: 24
        }}
      >
        ×
      </button>
    </div>
  );
};

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
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, w, midY);
    ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0, midY, w, h-midY);

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
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
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
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2; ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.restore();
      };

      const drawText = (el) => {
        ctx.save();
        ctx.fillStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.font = "bold 12px sans-serif"; ctx.fillText(el.text, el.x, el.y);
        ctx.restore();
      };

      const drawMixer = (el) => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        // Corps principal (cercle)
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        // Croix intérieure
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
        // Bec orienté vers l'intérieur (plus visible)
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, -5); ctx.lineTo(22, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      };

      // ✅ SIÈGE = Rectangle avec "S" dedans
      const drawSeat = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        const size = 32;
        const x = el.x - size / 2, y = el.y - size / 2;
        // Rectangle
        ctx.strokeRect(x, y, size, size);
        // Lettre "S" au centre
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", el.x, el.y);
        ctx.restore();
      };

      // Barre de maintien
      const drawBar = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
        // curseur au milieu
        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };

      // Ciel de pluie
      const drawRainHead = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        // ligne d'alimentation
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
        // pomme au bout
        ctx.beginPath(); ctx.arc(el.x2, el.y2, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      };

      // Porte (arc de cercle)
      const drawDoor = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
        const r = Math.min(w, h);
        const px = Math.min(el.x1, el.x2), py = Math.max(el.y1, el.y2);
        ctx.beginPath();
        ctx.arc(px, py, r, -Math.PI/2, 0, false);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + r, py); ctx.stroke();
        ctx.restore();
      };

      // Fenêtre (rectangle avec croix)
      const drawWindow = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
        const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
        ctx.strokeRect(x, y, w, h);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
        ctx.restore();
      };

      for (const el of all) {
        if (el.type === "dim") drawDim(el);
        else if (el.type === "rect") drawRect(el);
        else if (el.type === "text") drawText(el);
        else if (el.type === "symbol" && el.kind === "mixer") drawMixer(el);
        else if (el.type === "symbol" && el.kind === "seat") drawSeat(el);
        else if (el.type === "symbol" && el.kind === "bar") drawBar(el);
        else if (el.type === "symbol" && el.kind === "rainhead") drawRainHead(el);
        else if (el.type === "symbol" && el.kind === "door") drawDoor(el);
        else if (el.type === "symbol" && el.kind === "window") drawWindow(el);
      }
    },
  }), [canvasRef, toCm, labelOffsetPx]);

  return api;
};

/* ---------- Signature Canvas Component ---------- */
const SignatureCanvas = ({ onSave, label }) => {
  const sigRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e) => {
    const canvas = sigRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = sigRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = sigRef.current;
    onSave(canvas.toDataURL());
  };

  const clear = () => {
    const canvas = sigRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave(null);
  };

  useEffect(() => {
    const canvas = sigRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }}>
      <Label>{label}</Label>
      <canvas
        ref={sigRef}
        width={400}
        height={150}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ border: "1px dashed #cbd5e1", borderRadius: 4, cursor: "crosshair", width: "100%", height: 150, touchAction: "none" }}
      />
      <button onClick={clear} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 14 }}>
        Effacer
      </button>
    </div>
  );
};

/* ---------- Photo Manager Component ---------- */
const PhotoManager = ({ photos, setPhotos, title, forPDF = false }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPhotos((prev) => [...prev, { id: newId(), src: evt.target.result, name: file.name, rotation: 0, zoom: 1 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const rotatePhoto = (id) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  };

  // Taille différente selon l'utilisation
  const gridColumns = forPDF ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(120px, 1fr))";
  const imageHeight = forPDF ? 300 : 120;
  const showControls = !forPDF;

  return (
    <div>
      {!forPDF && <Label>{title}</Label>}
      {!forPDF && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", marginBottom: 12, fontSize: 14, minHeight: 44 }}
          >
            📷 Ajouter des photos
          </button>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: forPDF ? 16 : 12 }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", position: "relative", background: "#fff" }}>
            <img
              src={photo.src}
              alt={photo.name}
              style={{
                width: "100%",
                height: imageHeight,
                objectFit: "contain",
                transform: `rotate(${photo.rotation}deg)`,
                transition: "transform 0.2s",
                background: "#f8fafc",
              }}
            />
            {showControls && (
              <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                <button
                  onClick={() => rotatePhoto(photo.id)}
                  style={{ padding: 4, borderRadius: 4, border: "1px solid #fff", background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 14, minHeight: 32 }}
                >
                  🔄
                </button>
                <button
                  onClick={() => removePhoto(photo.id)}
                  style={{ padding: 4, borderRadius: 4, border: "1px solid #fff", background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 14, minHeight: 32 }}
                >
                  🗑️
                </button>
              </div>
            )}
            <div style={{ padding: forPDF ? 8 : 4, fontSize: forPDF ? 11 : 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
              {photo.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const pxPerCm = 1;
  const toCm = (pxLen) => pxLen / Math.max(0.0001, pxPerCm);

  const canvasRef = useRef(null);
  const plan = usePlanCanvas(canvasRef, toCm, LABEL_OFFSET);

  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tool, setTool] = useState("select");
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [startPt, setStartPt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const [currentColor, setCurrentColor] = useState("#0f172a");

  /* SIGNATURES */
  const [signatureClient, setSignatureClient] = useState(null);
  const [signatureInstaller, setSignatureInstaller] = useState(null);

  /* PHOTOS */
  const [photosAvant, setPhotosAvant] = useState([]);
  const [photosApres, setPhotosApres] = useState([]);

  /* EXPORT PDF */
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  /* NOTIFICATIONS & SAUVEGARDE */
  const [toast, setToast] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Refs PDF
  const etudeRef = useRef(null);
  const planExportRef = useRef(null);
  const signaturesRef = useRef(null);

  useEffect(() => { if (tab === "plan") plan.draw(elements, preview, selectedId); }, [tab, elements, preview, selectedId, plan]);
  useEffect(() => {
    if (tab !== "plan") return;
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => plan.draw(elements, preview, selectedId));
    ro.observe(el); return () => ro.disconnect();
  }, [tab, elements, preview, selectedId, plan]);

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
        if (el.kind === "bar" || el.kind === "rainhead" || el.kind === "door" || el.kind === "window") {
          if (distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= HIT_PAD) return el;
        } else {
          const r = el.kind === "seat" ? 20 : 14;
          if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
        }
      }
    }
    return null;
  };

  const onPointerDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);

    if (tool !== "select" && isInBanner(p.y)) return;

    if (tool === "select") {
      const el = hitTest(p.x, p.y);
      if (el) {
        setSelectedId(el.id);
        setDragOffset({ dx: p.x - (el.x ?? el.x1 ?? 0), dy: p.y - (el.y ?? el.y1 ?? 0) });
      } else {
        setSelectedId(null);
      }
      setStartPt(p);
      return;
    }

    if (tool === "mixer" || tool === "seat") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: tool, x: p.x, y: clampYOutOfBanner(p.y), color: currentColor }]);
      setSelectedId(id);
      return;
    }

    if (tool === "text") {
      const t = window.prompt("Texte :");
      if (t && t.trim()) {
        const id = newId();
        setElements((els) => [...els, { id, type: "text", x: p.x, y: clampYOutOfBanner(p.y), text: t, color: currentColor }]);
        setSelectedId(id);
      }
      return;
    }

    setStartPt({ x: p.x, y: clampYOutOfBanner(p.y) });
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
          const ny1 = clampYOutOfBanner(el.y1 + dy);
          const ny2 = clampYOutOfBanner(el.y2 + dy);
          return { ...el, x1: el.x1 + dx, y1: ny1, x2: el.x2 + dx, y2: ny2 };
        }
        if (el.type === "text" || (el.type === "symbol" && (el.kind === "mixer" || el.kind === "seat"))) {
          const nx = p.x - dragOffset.dx;
          const ny = clampYOutOfBanner(p.y - dragOffset.dy);
          return { ...el, x: nx, y: ny };
        }
        if (el.type === "symbol" && (el.kind === "bar" || el.kind === "rainhead" || el.kind === "door" || el.kind === "window")) {
          const dx = p.x - startPt.x, dy = p.y - startPt.y;
          return { ...el, x1: el.x1 + dx, y1: clampYOutOfBanner(el.y1 + dy), x2: el.x2 + dx, y2: clampYOutOfBanner(el.y2 + dy) };
        }
        return el;
      }));
      setStartPt(p);
      return;
    }

    let { x: x2, y: y2 } = p;
    y2 = clampYOutOfBanner(y2);
    if (tool === "dim" || tool === "rect" || tool === "bar" || tool === "rainhead" || tool === "door" || tool === "window") {
      ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));
    }

    if (tool === "dim") {
      setPreview({ type: "dim", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor });
    } else if (tool === "rect") {
      setPreview({ type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y), color: currentColor });
    } else if (tool === "bar") {
      setPreview({ type: "symbol", kind: "bar", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor });
    } else if (tool === "rainhead") {
      setPreview({ type: "symbol", kind: "rainhead", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor });
    } else if (tool === "door") {
      setPreview({ type: "symbol", kind: "door", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor });
    } else if (tool === "window") {
      setPreview({ type: "symbol", kind: "window", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor });
    }
  };

  const onPointerUp = (e) => {
    if (!startPt) return; e.preventDefault();
    const p = pointerPos(e);

    if (tool === "select") {
      setStartPt(null);
      return;
    }

    let { x: x2, y: y2 } = p;
    y2 = clampYOutOfBanner(y2);
    if (tool === "dim" || tool === "rect" || tool === "bar" || tool === "rainhead" || tool === "door" || tool === "window") {
      ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));
    }

    if (tool === "dim") {
      const id = newId();
      setElements((els) => [...els, { id, type: "dim", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor }]);
      setSelectedId(id);
    } else if (tool === "rect") {
      const id = newId();
      setElements((els) => [...els, { id, type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y), color: currentColor }]);
      setSelectedId(id);
    } else if (tool === "bar") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "bar", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor }]);
      setSelectedId(id);
    } else if (tool === "rainhead") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "rainhead", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor }]);
      setSelectedId(id);
    } else if (tool === "door") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "door", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor }]);
      setSelectedId(id);
    } else if (tool === "window") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "window", x1: startPt.x, y1: startPt.y, x2, y2, color: currentColor }]);
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

  /* ---------- SAUVEGARDE & RESTAURATION ---------- */
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const saveToLocalStorage = React.useCallback(() => {
    try {
      const data = {
        version: "1.0",
        timestamp: Date.now(),
        study,
        elements,
        signatureClient,
        signatureInstaller,
        photosAvant,
        photosApres,
        tool,
        currentColor
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      console.log("💾 Sauvegarde automatique effectuée");
      return true;
    } catch (error) {
      console.error("❌ Erreur sauvegarde:", error);
      return false;
    }
  }, [study, elements, signatureClient, signatureInstaller, photosAvant, photosApres, tool, currentColor]);

  const restoreFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) return false;

      const data = JSON.parse(saved);
      setStudy(data.study || {});
      setElements(data.elements || []);
      setSignatureClient(data.signatureClient || null);
      setSignatureInstaller(data.signatureInstaller || null);
      setPhotosAvant(data.photosAvant || []);
      setPhotosApres(data.photosApres || []);
      setTool(data.tool || "select");
      setCurrentColor(data.currentColor || "#0f172a");
      setLastSaved(new Date(data.timestamp));

      showToast("Travail restauré avec succès", "success");
      console.log("✅ Données restaurées depuis localStorage");
      return true;
    } catch (error) {
      console.error("❌ Erreur restauration:", error);
      return false;
    }
  };

  const exportToJSON = () => {
    const data = {
      version: "1.0",
      timestamp: Date.now(),
      study,
      elements,
      signatureClient,
      signatureInstaller,
      photosAvant,
      photosApres
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IR_Douche_${study.client_nom || 'Backup'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Fichier JSON exporté avec succès", "success");
  };

  const importFromJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          setStudy(data.study || {});
          setElements(data.elements || []);
          setSignatureClient(data.signatureClient || null);
          setSignatureInstaller(data.signatureInstaller || null);
          setPhotosAvant(data.photosAvant || []);
          setPhotosApres(data.photosApres || []);
          showToast("Fichier JSON importé avec succès", "success");
        } catch (error) {
          showToast("Erreur lors de l'import JSON", "error");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* ---------- VALIDATION CHAMPS ---------- */
  const validateFields = () => {
    const missing = [];

    if (!study.client_nom) missing.push("Nom client");
    if (!study.client_prenom) missing.push("Prénom client");
    if (!study.date_visite) missing.push("Date de visite");
    if (!study.inst_nom) missing.push("Nom installateur");
    if (!study.longueur_receveur) missing.push("Longueur receveur");
    if (!study.largeur_receveur) missing.push("Largeur receveur");

    if (missing.length > 0) {
      const message = `Champs obligatoires manquants:\n${missing.join(", ")}`;
      showToast(message, "error");
      return false;
    }

    return true;
  };

  /* ---------- Export PDF ROBUSTE ---------- */
  const exportPDF = async () => {
    // Validation des champs obligatoires
    if (!validateFields()) {
      setTab("etude"); // Aller à l'onglet étude pour voir les champs
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    // Sauvegarder l'onglet actuel
    const currentTab = tab;

    try {
      setExportProgress(5);
      // Vérification des bibliothèques
      if (!html2canvas || !jsPDF) {
        throw new Error("Les bibliothèques html2canvas ou jsPDF ne sont pas chargées");
      }

      // Vérification des refs
      if (!etudeRef.current || !planExportRef.current || !signaturesRef.current) {
        throw new Error("Les éléments de la page ne sont pas prêts");
      }

      console.log("🚀 Démarrage de l'export PDF...");
      setExportProgress(10);

      // Sauvegarder l'état d'affichage du parent du plan
      const planParentDiv = planExportRef.current?.parentElement;

      // Rendre tous les éléments visibles temporairement pour la capture
      etudeRef.current.style.display = "block";

      // planExportRef est à l'intérieur d'une div avec display conditionnel
      if (planParentDiv) planParentDiv.style.display = "block";

      // signaturesRef uniquement si on a des signatures
      if (signatureClient || signatureInstaller) {
        signaturesRef.current.style.display = "block";
      }

      // Attendre que le navigateur applique les changements et calcule les dimensions
      await new Promise(resolve => setTimeout(resolve, 300));
      setExportProgress(15);

      // Vérifier que les éléments ont des dimensions
      const checkDimensions = (ref, name) => {
        const rect = ref.getBoundingClientRect();
        console.log(`   ${name}: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`);
        if (rect.width === 0 || rect.height === 0) {
          throw new Error(`${name} n'a pas de dimensions (${rect.width}x${rect.height})`);
        }
      };

      console.log("📐 Vérification des dimensions des éléments:");
      checkDimensions(etudeRef.current, "Étude");
      checkDimensions(planExportRef.current, "Plan");
      if (signatureClient || signatureInstaller) {
        checkDimensions(signaturesRef.current, "Signatures");
      }

      // Forcer le redessinage du canvas du plan maintenant qu'il est visible
      console.log("🎨 Redessinage du canvas...");
      plan.draw(elements, null, null);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Créer le PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();

      // Options communes pour html2canvas
      const canvasOptions = {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: true
      };

      // Fonction helper pour ajouter une image au PDF avec validation
      const addPageToPDF = (canvas, pageNumber) => {
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          throw new Error(`Canvas ${pageNumber} invalide: dimensions ${canvas?.width}x${canvas?.height}`);
        }

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const ratio = canvas.height / canvas.width;

        // Valider le ratio
        if (!isFinite(ratio) || ratio <= 0) {
          throw new Error(`Ratio invalide pour page ${pageNumber}: ${ratio}`);
        }

        const imgHeight = pageWidth * ratio;

        // Valider les dimensions finales
        if (!isFinite(imgHeight) || imgHeight <= 0) {
          throw new Error(`Hauteur d'image invalide pour page ${pageNumber}: ${imgHeight}`);
        }

        console.log(`   Dimensions canvas: ${canvas.width}x${canvas.height}, Ratio: ${ratio.toFixed(2)}, Hauteur PDF: ${imgHeight.toFixed(2)}mm`);

        pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
      };

      // ===== PAGE 1: ÉTUDE =====
      console.log("📄 Capture page 1 (Étude)...");
      setExportProgress(25);
      const canvas1 = await html2canvas(etudeRef.current, canvasOptions);
      addPageToPDF(canvas1, 1);
      console.log("✅ Page 1 ajoutée");
      setExportProgress(35);

      // ===== PAGE 2: PLAN =====
      console.log("📄 Capture page 2 (Plan)...");
      pdf.addPage();

      const canvas2 = await html2canvas(planExportRef.current, canvasOptions);
      addPageToPDF(canvas2, 2);
      console.log("✅ Page 2 ajoutée");
      setExportProgress(50);

      // ===== PAGES PHOTOS: UNE PAGE PAR PHOTO =====
      let pageNumber = 3;
      const totalPhotos = photosAvant.length + photosApres.length;
      const photoProgressRange = 40; // 50% à 90%
      let currentPhotoIndex = 0;

      // Fonction pour créer une page pour une photo
      const addPhotoPage = async (photo, title) => {
        console.log(`📸 Ajout photo: ${title} - ${photo.name}`);
        pdf.addPage();

        // Créer un élément temporaire pour la photo
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '1000px';
        tempDiv.style.padding = '40px';
        tempDiv.style.background = '#ffffff';
        tempDiv.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${title}</h2>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">${photo.name}</p>
          </div>
          <div style="border: 2px solid #cbd5e1; border-radius: 12px; padding: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 600px;">
            <img src="${photo.src}" style="max-width: 100%; max-height: 600px; object-fit: contain; transform: rotate(${photo.rotation}deg);" />
          </div>
        `;

        document.body.appendChild(tempDiv);
        await new Promise(resolve => setTimeout(resolve, 100));

        const photoCanvas = await html2canvas(tempDiv, canvasOptions);
        addPageToPDF(photoCanvas, pageNumber++);

        document.body.removeChild(tempDiv);
        console.log(`   ✅ Photo ajoutée`);

        // Mettre à jour la progression
        currentPhotoIndex++;
        const photoProgress = 50 + (currentPhotoIndex / totalPhotos) * photoProgressRange;
        setExportProgress(Math.round(photoProgress));
      };

      // Photos AVANT
      if (photosAvant.length > 0) {
        console.log(`📷 Traitement ${photosAvant.length} photo(s) AVANT...`);
        for (const photo of photosAvant) {
          await addPhotoPage(photo, "Photo AVANT travaux");
        }
      }

      // Photos APRÈS
      if (photosApres.length > 0) {
        console.log(`📷 Traitement ${photosApres.length} photo(s) APRÈS...`);
        for (const photo of photosApres) {
          await addPhotoPage(photo, "Photo APRÈS travaux");
        }
      }

      setExportProgress(90);

      // ===== PAGE SIGNATURES =====
      if (signatureClient || signatureInstaller) {
        console.log("✍️ Ajout page signatures...");
        pdf.addPage();
        const canvas3 = await html2canvas(signaturesRef.current, canvasOptions);
        addPageToPDF(canvas3, pageNumber);
        console.log("✅ Page signatures ajoutée");
      } else {
        console.log("⏭️ Pas de signatures");
      }

      setExportProgress(95);

      // Sauvegarder
      const fileName = `IR_Douche_${study.client_nom || 'Client'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      console.log("✅ PDF généré avec succès:", fileName);
      setExportProgress(100);
      showToast("PDF exporté avec succès!", "success");

    } catch (error) {
      console.error("❌ Erreur lors de l'export PDF:", error);
      showToast(`Erreur lors de l'export PDF: ${error.message}`, "error");
    } finally {
      // Restaurer l'affichage initial
      if (etudeRef.current) etudeRef.current.style.display = currentTab === "etude" ? "block" : "none";

      // Restaurer le parent du plan
      const planParentDiv = planExportRef.current?.parentElement;
      if (planParentDiv) planParentDiv.style.display = currentTab === "plan" ? "block" : "none";

      // signaturesRef version PDF toujours cachée
      if (signaturesRef.current) signaturesRef.current.style.display = "none";

      setIsExporting(false);
      setExportProgress(0);
    }
  };

  /* ---------- USEEFFECTS: Sauvegarde & Restauration ---------- */
  // Restauration au chargement
  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const shouldRestore = window.confirm(
        "Une sauvegarde automatique a été trouvée. Voulez-vous restaurer votre travail ?"
      );
      if (shouldRestore) {
        restoreFromLocalStorage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauvegarde automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges) {
        saveToLocalStorage();
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveToLocalStorage]);

  // Marquer comme "modifications non sauvegardées" à chaque changement
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [study, elements, signatureClient, signatureInstaller, photosAvant, photosApres]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        saveToLocalStorage();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, saveToLocalStorage]);

  /* ---------- Styles OPTIMISÉS MOBILE ---------- */
  const styles = (
    <style>{`
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
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
      .actions-sticky { position: sticky; top: 0; z-index: 10; background: #ffffffee; backdrop-filter: blur(4px); border-bottom: 1px solid #e5e7eb; padding: 8px 0; margin-bottom: 12px; }
      .ir-canvas-wrap { height: 560px; }
      @media (max-width: 767px) {
        .ir-canvas-wrap { height: 400px; }
        .actions-sticky h1 { font-size: 18px !important; }
      }
      canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
      button, input, select, textarea { min-height: 44px; }
      .tool-btn { padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-size: 14px; white-space: nowrap; }
      .tool-btn.active { background: #e2e8f0; }
      @media (max-width: 767px) {
        .tool-btn { padding: 8px 6px; font-size: 12px; }
      }
    `}</style>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {styles}

      {/* TOAST NOTIFICATION */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* BARRE D'ACTIONS */}
      <div className="actions-sticky">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Documents IR – Douche</h1>
            {lastSaved && (
              <small style={{ fontSize: 11, color: "#64748b", display: "block", marginTop: 4 }}>
                💾 Dernière sauvegarde: {lastSaved.toLocaleTimeString('fr-FR')}
              </small>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={saveToLocalStorage}
              style={{
                padding:"8px 12px",
                borderRadius: 8,
                border:"1px solid #cbd5e1",
                background: "#fff",
                fontWeight:500,
                fontSize: 13,
                cursor: "pointer"
              }}
              title="Sauvegarder maintenant"
            >
              💾 Sauvegarder
            </button>
            <button
              onClick={exportToJSON}
              style={{
                padding:"8px 12px",
                borderRadius: 8,
                border:"1px solid #cbd5e1",
                background: "#fff",
                fontWeight:500,
                fontSize: 13,
                cursor: "pointer"
              }}
              title="Exporter en JSON"
            >
              📥 Export JSON
            </button>
            <button
              onClick={importFromJSON}
              style={{
                padding:"8px 12px",
                borderRadius: 8,
                border:"1px solid #cbd5e1",
                background: "#fff",
                fontWeight:500,
                fontSize: 13,
                cursor: "pointer"
              }}
              title="Importer depuis JSON"
            >
              📤 Import JSON
            </button>
            <button
              onClick={exportPDF}
              disabled={isExporting}
              style={{
                padding:"10px 14px",
                borderRadius: 10,
                border:"1px solid #0ea5a5",
                background: isExporting ? "#94a3b8" : "#0ea5a5",
                color:"#fff",
                fontWeight:600,
                fontSize: 14,
                cursor: isExporting ? "wait" : "pointer",
                opacity: isExporting ? 0.7 : 1
              }}
            >
              {isExporting ? "⏳ Export en cours..." : "📄 Export PDF"}
            </button>
          </div>
        </div>

        {/* BARRE DE PROGRESSION */}
        {isExporting && exportProgress > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <small style={{ fontSize: 12, color: "#64748b" }}>Export PDF en cours...</small>
              <small style={{ fontSize: 12, fontWeight: 600, color: "#0ea5a5" }}>{exportProgress}%</small>
            </div>
            <div style={{ width: "100%", height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${exportProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #0ea5a5, #10b981)",
                  transition: "width 0.3s ease",
                  borderRadius: 3
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ONGLETS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        <button onClick={() => setTab("etude")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: "1 1 auto", fontSize: 14, whiteSpace: "nowrap" }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: "1 1 auto", fontSize: 14, whiteSpace: "nowrap" }}>Plan technique</button>
        <button onClick={() => setTab("signatures")}  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "signatures"  ? "#e2e8f0" : "#fff", flex: "1 1 auto", fontSize: 14, whiteSpace: "nowrap" }}>Photos & Signatures</button>
      </div>

      {/* ======= PAGE 1 — ÉTUDE ======= */}
      <div ref={etudeRef} style={{ display: tab === "etude" ? "block" : "none" }}>
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
              <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, fontSize: 14 }} />
            </Col>
          </Row>
        </Section>
      </div>

      {/* ======= PAGE 2 — PLAN ======= */}
      <div style={{ display: tab === "plan" ? "block" : "none" }}>
          <Section style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>PLAN TECHNIQUE INDICATIF DOUCHE</h2>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
              Plan non contractuel. Nécessite une validation technique au préalable. <br />
              Dimensions sous réserve des éventuelles contraintes techniques rencontrées.
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              <div style={{ minWidth: 200, flex: 1 }}><Label>NOM :</Label><Input placeholder="Client" value={study.client_nom} onChange={(e)=>setStudy(s=>({...s, client_nom:e.target.value}))} /></div>
              <div style={{ minWidth: 200, flex: 1 }}><Label>PRÉNOM :</Label><Input placeholder="Prénom" value={study.client_prenom} onChange={(e)=>setStudy(s=>({...s, client_prenom:e.target.value}))} /></div>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Exemplaire à destination du client</div>
          </Section>

          {/* OUTILS */}
          <Section title="Outils de dessin">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
              <button onClick={()=>setTool("select")} className={`tool-btn ${tool==="select"?"active":""}`}>✋ Sélection</button>
              <button onClick={()=>setTool("dim")}    className={`tool-btn ${tool==="dim"?"active":""}`}>📏 Cote</button>
              <button onClick={()=>setTool("rect")}   className={`tool-btn ${tool==="rect"?"active":""}`}>⬜ Rect</button>
              <button onClick={()=>setTool("mixer")}  className={`tool-btn ${tool==="mixer"?"active":""}`}>🚿 Mitigeur</button>
              <button onClick={()=>setTool("seat")}   className={`tool-btn ${tool==="seat"?"active":""}`}>💺 Siège</button>
              <button onClick={()=>setTool("bar")}    className={`tool-btn ${tool==="bar"?"active":""}`}>━ Barre</button>
              <button onClick={()=>setTool("rainhead")} className={`tool-btn ${tool==="rainhead"?"active":""}`}>☂️ Ciel</button>
              <button onClick={()=>setTool("door")}   className={`tool-btn ${tool==="door"?"active":""}`}>🚪 Porte</button>
              <button onClick={()=>setTool("window")} className={`tool-btn ${tool==="window"?"active":""}`}>🪟 Fenêtre</button>
              <button onClick={()=>setTool("text")}   className={`tool-btn ${tool==="text"?"active":""}`}>T Texte</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <Label style={{ marginBottom: 0 }}>Couleur :</Label>
              <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} style={{ width: 50, height: 44, border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }} />
              <button onClick={()=>setSnap(s=>!s)} className={`tool-btn ${snap?"active":""}`}>{snap?"🧲 Snap":"Snap"}</button>
              <button onClick={()=>setOrtho(o=>!o)} className={`tool-btn ${ortho?"active":""}`}>{ortho?"📐 Ortho":"Ortho"}</button>
              <button onClick={undo} className="tool-btn">↩️ Annuler</button>
              <button onClick={delSelected} className="tool-btn" style={{ borderColor: "#ef4444", color: "#ef4444" }} disabled={!selectedId}>🗑️ Suppr</button>
              <button onClick={resetPlan} className="tool-btn" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>🔄 Reset</button>
            </div>
            <Small style={{ marginTop: 8 }}>Zones bleues = murs (création/déplacement interdits). Double-clic pour éditer un texte.</Small>
          </Section>

          {/* ZONE EXPORTABLE */}
          <div ref={planExportRef}>
            <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff", marginBottom: 16 }}>
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
                  style={{ cursor: tool==="select" ? "default" : "crosshair" }}
                />
              </div>
            </div>

            {/* ✅ LÉGENDE COMPLÈTE */}
            <Section title="Légende des symboles">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 16 }}>
                {/* Siège */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:32, height:32, border:"2px solid #0f172a", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize: 18 }}>S</div>
                  <span style={{ fontSize: 14 }}>Siège</span>
                </div>
                {/* Barre */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="20" viewBox="0 0 60 20">
                    <line x1="6" y1="10" x2="54" y2="10" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="30" cy="10" r="4" fill="#0f172a" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Barre</span>
                </div>
                {/* Robinetterie */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="48" height="24" viewBox="0 0 48 24">
                    <circle cx="18" cy="12" r="10" fill="none" stroke="#0f172a" strokeWidth="2" />
                    <line x1="10" y1="12" x2="26" y2="12" stroke="#0f172a" strokeWidth="2" />
                    <line x1="18" y1="4" x2="18" y2="20" stroke="#0f172a" strokeWidth="2" />
                    <path d="M 28 12 L 40 7 L 40 17 Z" fill="#0f172a" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Mitigeur</span>
                </div>
                {/* Ciel de pluie */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="20" viewBox="0 0 60 20">
                    <line x1="6" y1="10" x2="48" y2="10" stroke="#0f172a" strokeWidth="2" />
                    <circle cx="48" cy="10" r="6" fill="none" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Ciel de pluie</span>
                </div>
                {/* Porte */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <path d="M 10 35 A 25 25 0 0 0 35 10" stroke="#0f172a" strokeWidth="2" fill="none" />
                    <line x1="10" y1="35" x2="35" y2="35" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Porte</span>
                </div>
                {/* Fenêtre */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <rect x="4" y="4" width="24" height="24" stroke="#0f172a" strokeWidth="2" fill="none" />
                    <line x1="4" y1="4" x2="28" y2="28" stroke="#0f172a" strokeWidth="2" />
                    <line x1="28" y1="4" x2="4" y2="28" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Fenêtre</span>
                </div>
                {/* Échelle */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="36" height="24" viewBox="0 0 36 24">
                    <line x1="8" y1="18" x2="28" y2="18" stroke="#0f172a" strokeWidth="2" />
                    <line x1="8" y1="8" x2="8" y2="18" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Échelle 1:1</span>
                </div>
              </div>

              {/* Détails texte */}
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
                <div><strong>Siège :</strong> Rectangle avec lettre "S" au centre. Positionnable librement sur le plan.</div>
                <div><strong>Barre de maintien :</strong> Segment avec curseur central. Longueur et orientation libres.</div>
                <div><strong>Mitigeur :</strong> Cercle avec croix et bec triangulaire orienté vers l'intérieur du plan.</div>
                <div><strong>Ciel de pluie :</strong> Ligne d'alimentation avec pomme de douche (cercle) en bout.</div>
                <div><strong>Porte :</strong> Arc de cercle représentant l'ouverture. Le pivot est en bas à gauche du tracé.</div>
                <div><strong>Fenêtre :</strong> Rectangle avec croix diagonale. Dimensions ajustables.</div>
                <div><strong>Cotes :</strong> Affichent automatiquement la dimension en centimètres (échelle 1:1 où 1 px = 1 cm).</div>
                <div><strong>Texte libre :</strong> Posable et déplaçable. Double-clic pour modifier le contenu.</div>
              </div>
            </Section>
          </div>
      </div>

      {/* ======= PAGE 3 — PHOTOS & SIGNATURES (Interface) ======= */}
      <div style={{ display: tab === "signatures" ? "block" : "none" }}>
          <Section style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>PHOTOS & SIGNATURES</h2>
          </Section>

          <Section title="Photos AVANT travaux">
            <PhotoManager photos={photosAvant} setPhotos={setPhotosAvant} title="Photos AVANT" />
          </Section>

          <Section title="Photos APRÈS travaux">
            <PhotoManager photos={photosApres} setPhotos={setPhotosApres} title="Photos APRÈS" />
          </Section>

          <Section title="Signatures">
            <Row>
              <Col span={6}>
                <SignatureCanvas onSave={setSignatureClient} label="Signature Client" />
                {signatureClient && <Small style={{ marginTop: 8 }}>✅ Signature client enregistrée</Small>}
              </Col>
              <Col span={6}>
                <SignatureCanvas onSave={setSignatureInstaller} label="Signature Installateur" />
                {signatureInstaller && <Small style={{ marginTop: 8 }}>✅ Signature installateur enregistrée</Small>}
              </Col>
            </Row>
            <Small style={{ marginTop: 12 }}>Date de signature : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</Small>
          </Section>
      </div>

      {/* ======= PAGE 3 — VERSION PDF (grandes photos) ======= */}
      <div ref={signaturesRef} style={{ display: "none" }}>
          <Section style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>PHOTOS & SIGNATURES</h2>
          </Section>

          {photosAvant.length > 0 && (
            <Section title="Photos AVANT travaux">
              <PhotoManager photos={photosAvant} setPhotos={setPhotosAvant} title="Photos AVANT" forPDF={true} />
            </Section>
          )}

          {photosApres.length > 0 && (
            <Section title="Photos APRÈS travaux">
              <PhotoManager photos={photosApres} setPhotos={setPhotosApres} title="Photos APRÈS" forPDF={true} />
            </Section>
          )}

          <Section title="Signatures">
            <Row>
              <Col span={6}>
                {signatureClient && (
                  <div>
                    <Label>Signature Client</Label>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }}>
                      <img src={signatureClient} alt="Signature Client" style={{ width: "100%", height: 150, objectFit: "contain" }} />
                    </div>
                  </div>
                )}
              </Col>
              <Col span={6}>
                {signatureInstaller && (
                  <div>
                    <Label>Signature Installateur</Label>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }}>
                      <img src={signatureInstaller} alt="Signature Installateur" style={{ width: "100%", height: 150, objectFit: "contain" }} />
                    </div>
                  </div>
                )}
              </Col>
            </Row>
            <Small style={{ marginTop: 12 }}>Date de signature : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</Small>
          </Section>
      </div>
    </div>
  );
}
