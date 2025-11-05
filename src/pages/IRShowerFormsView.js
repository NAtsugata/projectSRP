// FILE: src/pages/IRShowerFormsView.jsx — VERSION AMÉLIORÉE
import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * IRShowerFormsView — Étude + Plan technique + Signatures + Photos
 * NOUVELLES FONCTIONNALITÉS :
 * - Outils dessin : Barre de maintien, Ciel de pluie, Porte, Fenêtre
 * - Couleurs personnalisables par élément
 * - Signatures électroniques (client + installateur)
 * - Gestion photos AVANT/APRÈS avec zoom/rotation
 * - Export PDF 3 pages (Étude + Plan + Photos/Signatures)
 */

const GRID_SIZE = 20;
const HIT_PAD = 10;
const BANNER_H = 40;
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
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -3); ctx.stroke();
        ctx.restore();
      };

      const drawSeat = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
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

      // 🆕 Barre de maintien
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

      // 🆕 Ciel de pluie
      const drawRainHead = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        // ligne d'alimentation
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
        // pomme au bout
        ctx.beginPath(); ctx.arc(el.x2, el.y2, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      };

      // 🆕 Porte (arc de cercle)
      const drawDoor = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
        const r = Math.min(w, h);
        // pivot en bas à gauche
        const px = Math.min(el.x1, el.x2), py = Math.max(el.y1, el.y2);
        ctx.beginPath();
        ctx.arc(px, py, r, -Math.PI/2, 0, false);
        ctx.stroke();
        // ligne de base
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + r, py); ctx.stroke();
        ctx.restore();
      };

      // 🆕 Fenêtre (rectangle avec croix)
      const drawWindow = (el) => {
        ctx.save();
        ctx.strokeStyle = el.id === selectedId ? "#ef4444" : (el.color || "#0f172a");
        ctx.lineWidth = 2;
        const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
        const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
        ctx.strokeRect(x, y, w, h);
        // croix
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
      <button onClick={clear} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
        Effacer
      </button>
    </div>
  );
};

/* ---------- Photo Manager Component ---------- */
const PhotoManager = ({ photos, setPhotos, title }) => {
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

  return (
    <div>
      <Label>{title}</Label>
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
        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", marginBottom: 12 }}
      >
        📷 Ajouter des photos
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", position: "relative" }}>
            <img
              src={photo.src}
              alt={photo.name}
              style={{
                width: "100%",
                height: 150,
                objectFit: "cover",
                transform: `rotate(${photo.rotation}deg) scale(${photo.zoom})`,
                transition: "transform 0.2s",
              }}
            />
            <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
              <button
                onClick={() => rotatePhoto(photo.id)}
                style={{ padding: 4, borderRadius: 4, border: "1px solid #fff", background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 12 }}
              >
                🔄
              </button>
              <button
                onClick={() => removePhoto(photo.id)}
                style={{ padding: 4, borderRadius: 4, border: "1px solid #fff", background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 12 }}
              >
                🗑️
              </button>
            </div>
            <div style={{ padding: 4, fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

  /* 🆕 SIGNATURES */
  const [signatureClient, setSignatureClient] = useState(null);
  const [signatureInstaller, setSignatureInstaller] = useState(null);

  /* 🆕 PHOTOS */
  const [photosAvant, setPhotosAvant] = useState([]);
  const [photosApres, setPhotosApres] = useState([]);

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
        if (el.kind === "bar" || el.kind === "rainhead" || el.kind === "door" || el.kind === "window") {
          if (distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= HIT_PAD) return el;
        } else {
          const r = el.kind === "mixer" ? 14 : 22;
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

    if (tool === "mixer") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "mixer", x: p.x, y: clampYOutOfBanner(p.y), color: currentColor }]);
      setSelectedId(id);
      return;
    }

    if (tool === "seat") {
      const seat = clampSeatToWall(p);
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "seat", x: seat.x, y: seat.y, orient: seat.orient, color: currentColor }]);
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
        if (el.type === "text" || el.type === "symbol") {
          const nx = p.x - dragOffset.dx;
          const ny = clampYOutOfBanner(p.y - dragOffset.dy);
          if (el.type === "symbol" && el.kind === "seat") {
            const c = clampSeatToWall({ x: nx, y: ny });
            return { ...el, ...c };
          }
          if (el.type === "symbol" && (el.kind === "bar" || el.kind === "rainhead" || el.kind === "door" || el.kind === "window")) {
            const dx = p.x - startPt.x, dy = p.y - startPt.y;
            return { ...el, x1: el.x1 + dx, y1: clampYOutOfBanner(el.y1 + dy), x2: el.x2 + dx, y2: clampYOutOfBanner(el.y2 + dy) };
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
      const el = elements.find((x) => x.id === selectedId);
      if (el && el.type === "symbol" && el.kind === "seat") {
        setElements((els) => els.map((x) => (x.id !== el.id ? x : { ...x, ...clampSeatToWall({ x: x.x, y: x.y }) })));
      }
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

  /* ---------- Export PDF ---------- */
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const waitPaint = async (ms = 120) => { await raf(); await new Promise((r) => setTimeout(r, ms)); };

  const exportPDF = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const prevTab = tab;

      // Page 1: Étude
      setTab("etude"); await waitPaint();
      const c1 = await html2canvas(etudeRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const img1 = c1.toDataURL("image/png");

      // Page 2: Plan
      setTab("plan"); await waitPaint();
      const c2 = await html2canvas(planExportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const img2 = c2.toDataURL("image/png");

      // Page 3: Signatures + Photos
      setTab("signatures"); await waitPaint();
      const c3 = await html2canvas(signaturesRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const img3 = c3.toDataURL("image/png");

      // PDF
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const w1 = pageW, h1 = (c1.height / c1.width) * w1;
      pdf.addImage(img1, "PNG", 0, Math.max(0, (pageH - h1) / 2), w1, h1, undefined, "FAST");

      pdf.addPage();
      const w2 = pageW, h2 = (c2.height / c2.width) * w2;
      pdf.addImage(img2, "PNG", 0, Math.max(0, (pageH - h2) / 2), w2, h2, undefined, "FAST");

      pdf.addPage();
      const w3 = pageW, h3 = (c3.height / c3.width) * w3;
      pdf.addImage(img3, "PNG", 0, Math.max(0, (pageH - h3) / 2), w3, h3, undefined, "FAST");

      pdf.save(`Etude_Plan_IR_${new Date().toISOString().split('T')[0]}.pdf`);
      setTab(prevTab);
    } catch (err) {
      alert("⚠️ L'export PDF nécessite 'html2canvas' et 'jspdf'. Installe-les :\n\nnpm i html2canvas jspdf");
      console.error(err);
    }
  };

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
    `}</style>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {styles}

      {/* BARRE D'ACTIONS */}
      <div className="actions-sticky">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Documents IR – Douche</h1>
          <button onClick={exportPDF} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid #0ea5a5", background:"#0ea5a5", color:"#fff", fontWeight:600 }}>
            📄 Exporter PDF
          </button>
        </div>
      </div>

      {/* ONGLETS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1 }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: 1 }}>Plan technique</button>
        <button onClick={() => setTab("signatures")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "signatures"  ? "#e2e8f0" : "#fff", flex: 1 }}>Photos & Signatures</button>
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
          <Section style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>PLAN TECHNIQUE INDICATIF DOUCHE</h2>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
              Plan non contractuel. Nécessite une validation technique au préalable. <br />
              Dimensions sous réserve des éventuelles contraintes techniques rencontrées.
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}><Label>NOM :</Label><Input placeholder="........................................................" value={study.client_nom} onChange={(e)=>setStudy(s=>({...s, client_nom:e.target.value}))} /></div>
              <div style={{ minWidth: 220 }}><Label>PRÉNOM :</Label><Input placeholder="........................................................" value={study.client_prenom} onChange={(e)=>setStudy(s=>({...s, client_prenom:e.target.value}))} /></div>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Exemplaire à destination du client</div>
          </Section>

          {/* OUTILS */}
          <Section title="Outils de dessin">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button onClick={()=>setTool("select")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="select"?"#e2e8f0":"#fff" }}>✋ Sélection</button>
              <button onClick={()=>setTool("dim")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="dim"?"#e2e8f0":"#fff" }}>📏 Cote</button>
              <button onClick={()=>setTool("rect")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rect"?"#e2e8f0":"#fff" }}>⬜ Rectangle</button>
              <button onClick={()=>setTool("mixer")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="mixer"?"#e2e8f0":"#fff" }}>🚿 Mitigeur</button>
              <button onClick={()=>setTool("seat")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="seat"?"#e2e8f0":"#fff" }}>💺 Siège</button>
              <button onClick={()=>setTool("bar")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="bar"?"#e2e8f0":"#fff" }}>━ Barre</button>
              <button onClick={()=>setTool("rainhead")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rainhead"?"#e2e8f0":"#fff" }}>☂️ Ciel de pluie</button>
              <button onClick={()=>setTool("door")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="door"?"#e2e8f0":"#fff" }}>🚪 Porte</button>
              <button onClick={()=>setTool("window")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="window"?"#e2e8f0":"#fff" }}>🪟 Fenêtre</button>
              <button onClick={()=>setTool("text")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="text"?"#e2e8f0":"#fff" }}>T Texte</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Label>Couleur :</Label>
              <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} style={{ width: 50, height: 44, border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }} />
              <button onClick={()=>setSnap(s=>!s)}     style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: snap?"#e2e8f0":"#fff" }}>{snap?"🧲 Snap ✓":"Snap ✗"}</button>
              <button onClick={()=>setOrtho(o=>!o)}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: ortho?"#e2e8f0":"#fff" }}>{ortho?"📐 Ortho ✓":"Ortho ✗"}</button>
              <button onClick={undo}                   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>↩️ Annuler</button>
              <button onClick={delSelected}            style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #ef4444", color:"#ef4444", background:"#fff" }} disabled={!selectedId}>🗑️ Supprimer</button>
              <button onClick={resetPlan}              style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #f59e0b", color:"#f59e0b", background:"#fff" }}>🔄 Réinitialiser</button>
            </div>
            <Small style={{ marginTop: 8 }}>Zones bleues = murs (création et déplacement interdits). Double-clic pour éditer un texte. Le siège se plaque automatiquement au mur.</Small>
          </Section>

          {/* ZONE EXPORTABLE */}
          <div ref={planExportRef}>
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
                  style={{ cursor: tool==="select" ? "default" : "crosshair" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= PAGE 3 — PHOTOS & SIGNATURES ======= */}
      {tab === "signatures" && (
        <div ref={signaturesRef}>
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
      )}
    </div>
  );
}
