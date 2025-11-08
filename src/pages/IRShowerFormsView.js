// FILE: src/pages/IRShowerFormsView.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { storageService, supabase } from '../lib/supabase';

/**
 * IRShowerFormsView — Version améliorée
 * NOUVELLES FONCTIONNALITÉS :
 * - Capture de photos AVANT/APRÈS avec caméra mobile
 * - Sauvegarde automatique dans localStorage (toutes les 5 sec)
 * - Restauration automatique au chargement
 * - Validation des champs obligatoires avant export PDF
 * - Design moderne avec gradients et ombres
 * - Bouton "Nouvelle étude" pour réinitialiser
 * - Export PDF incluant les photos
 * - UX mobile optimisée (tactile feedback)
 */

const GRID_SIZE = 20;
const HIT_PAD = 10;
const BANNER_H = 40;
const LABEL_OFFSET = 8;

/* ---------- UI helpers ---------- */
const Section = ({ title, children, style, className = "" }) => (
  <div
    className={className}
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
const Label = ({ children, required }) => (
  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
    {children} {required && <span style={{ color: "#ef4444" }}>*</span>}
  </label>
);
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
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -3); ctx.stroke();
        ctx.restore();
      };

      const drawSeat = (el) => {
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
        ctx.moveTo(el.x + w/2, el.y);
        ctx.lineTo(el.x + w/2, el.y + h);
        ctx.moveTo(el.x, el.y + h/2);
        ctx.lineTo(el.x + w, el.y + h/2);
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
          else if (el.kind === "shower") drawShower(el);
          else if (el.kind === "door") drawDoor(el);
          else if (el.kind === "window") drawWindow(el);
        }
      }
    },
  }), [canvasRef, toCm, labelOffsetPx]);

  return api;
};

/* ---------- Main ---------- */
export default function IRShowerFormsView({ profile }) {
  const [tab, setTab] = useState("etude");

  // Obtenir l'userId depuis profile ou session
  const [userId, setUserId] = useState(profile?.id || null);

  useEffect(() => {
    const fetchUserId = async () => {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      }
    };
    fetchUserId();
  }, [userId]);

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

  /* PHOTOS AVANT/APRÈS */
  const [photosAvant, setPhotosAvant] = useState([]);
  const [photosApres, setPhotosApres] = useState([]);
  const photoAvantInputRef = useRef(null);
  const photoApresInputRef = useRef(null);

  /* SIGNATURES */
  const signatureClientRef = useRef(null);
  const signatureInstallerRef = useRef(null);
  const [signatureClient, setSignatureClient] = useState(null);
  const [signatureInstaller, setSignatureInstaller] = useState(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState({ client: false, installer: false });
  const [signaturePos, setSignaturePos] = useState({ client: null, installer: null });

  // Compression d'image optimisée
  const compressImage = async (file) => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise(res => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let {width, height} = img;
        // COMPRESSION AGGRESSIVE POUR MOBILE
        const MW = 800, MH = 600;
        if (width > height) {
          if (width > MW) {
            height *= MW / width;
            width = MW;
          }
        } else {
          if (height > MH) {
            width *= MH / height;
            height = MH;
          }
        }
        c.width = width;
        c.height = height;
        // Fond blanc pour éviter transparence
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Qualité 0.65 = 40% plus léger !
        c.toBlob(b => {
          if (b) {
            const compressed = new File([b], file.name, {type: 'image/jpeg', lastModified: Date.now()});
            console.log(`📸 Compression: ${(file.size/1024).toFixed(0)}KB → ${(b.size/1024).toFixed(0)}KB (${((1-b.size/file.size)*100).toFixed(0)}% économisé)`);
            res(compressed);
          } else {
            res(file);
          }
        }, 'image/jpeg', 0.65);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoCapture = async (e, type) => {
    console.log('📸 handlePhotoCapture appelé, type:', type, 'event:', e);
    const files = Array.from(e.target.files);
    console.log('📸 Fichiers détectés:', files.length);
    if (files.length === 0) {
      console.warn('⚠️ Aucun fichier capturé');
      return;
    }

    if (!userId) {
      console.error('❌ Pas d\'userId disponible pour l\'upload');
      return;
    }

    console.log('📸 Début upload des fichiers vers le cloud...');

    try {
      // Uploader tous les fichiers en parallèle
      const uploadPromises = files.map(async (file) => {
        try {
          console.log('📸 Upload fichier:', file.name);

          // Compresser l'image d'abord
          const compressedFile = await compressImage(file);

          // Upload vers le cloud
          const { publicURL, error } = await storageService.uploadExpenseFile(
            compressedFile,
            userId,
            (progress) => {
              console.log(`📤 Progression ${file.name}: ${progress}%`);
            }
          );

          if (error) throw error;

          console.log('✅ Fichier uploadé avec succès:', publicURL);

          return {
            id: newId(),
            url: publicURL, // URL cloud au lieu de base64
            name: file.name
          };
        } catch (err) {
          console.error('❌ Erreur upload fichier:', file.name, err);
          throw err;
        }
      });

      const uploadedPhotos = await Promise.all(uploadPromises);

      console.log('✅ Tous les fichiers uploadés:', uploadedPhotos.length);

      if (type === 'avant') {
        console.log('📸 Ajout photos AVANT');
        setPhotosAvant(prev => [...prev, ...uploadedPhotos]);
      } else {
        console.log('📸 Ajout photos APRÈS');
        setPhotosApres(prev => [...prev, ...uploadedPhotos]);
      }

    } catch (error) {
      console.error('❌ Erreur upload fichiers:', error);
      alert('Erreur lors de l\'upload des photos');
    }

    e.target.value = '';
  };

  const removePhoto = (id, type) => {
    if (type === 'avant') setPhotosAvant(prev => prev.filter(p => p.id !== id));
    else setPhotosApres(prev => prev.filter(p => p.id !== id));
  };

  /* GESTION SIGNATURES */
  const startSignature = (e, type) => {
    const canvas = type === 'client' ? signatureClientRef.current : signatureInstallerRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    setIsDrawingSignature(prev => ({ ...prev, [type]: true }));
    setSignaturePos(prev => ({ ...prev, [type]: { x, y } }));
  };

  const drawSignature = (e, type) => {
    if (!isDrawingSignature[type]) return;
    const canvas = type === 'client' ? signatureClientRef.current : signatureInstallerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(signaturePos[type].x, signaturePos[type].y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setSignaturePos(prev => ({ ...prev, [type]: { x, y } }));
  };

  const endSignature = (type) => {
    setIsDrawingSignature(prev => ({ ...prev, [type]: false }));
    const canvas = type === 'client' ? signatureClientRef.current : signatureInstallerRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      if (type === 'client') setSignatureClient(dataUrl);
      else setSignatureInstaller(dataUrl);
    }
  };

  const clearSignature = (type) => {
    const canvas = type === 'client' ? signatureClientRef.current : signatureInstallerRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (type === 'client') setSignatureClient(null);
      else setSignatureInstaller(null);
    }
  };

  /* SAUVEGARDE AUTOMATIQUE */
  useEffect(() => {
    const saveTimer = setInterval(() => {
      const data = { study, elements, photosAvant, photosApres, signatureClient, signatureInstaller, timestamp: Date.now() };
      try {
        localStorage.setItem('ir-shower-draft', JSON.stringify(data));
      } catch (e) {
        console.error('Sauvegarde auto échouée:', e);
      }
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [study, elements, photosAvant, photosApres, signatureClient, signatureInstaller]);

  // Restauration au chargement
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ir-shower-draft');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.study) setStudy(data.study);
        if (data.elements) setElements(data.elements);
        if (data.photosAvant) setPhotosAvant(data.photosAvant);
        if (data.photosApres) setPhotosApres(data.photosApres);
        if (data.signatureClient) setSignatureClient(data.signatureClient);
        if (data.signatureInstaller) setSignatureInstaller(data.signatureInstaller);
      }
    } catch (e) {
      console.error('Restauration échouée:', e);
    }
  }, []);

  const resetAll = () => {
    if (window.confirm('⚠️ Réinitialiser toute l\'étude ? Cette action est irréversible.')) {
      setStudy({
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
      setElements([]);
      setPhotosAvant([]);
      setPhotosApres([]);
      setSignatureClient(null);
      setSignatureInstaller(null);
      clearSignature('client');
      clearSignature('installer');
      localStorage.removeItem('ir-shower-draft');
      setTab("etude");
    }
  };

  /* VALIDATION */
  const validateStudy = () => {
    const errors = [];
    if (!study.client_nom || !study.client_prenom) errors.push('Nom et prénom du client');
    if (!study.inst_nom || !study.inst_prenom) errors.push('Nom et prénom de l\'installateur');
    if (!study.date_visite) errors.push('Date de visite');
    if (!study.longueur_receveur || !study.largeur_receveur) errors.push('Dimensions du receveur');
    if (!study.largeur_acces) errors.push('Largeur d\'accès');

    if (errors.length > 0) {
      alert('⚠️ Champs obligatoires manquants :\n\n' + errors.map(e => `• ${e}`).join('\n'));
      return false;
    }
    return true;
  };

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
        if (el.kind === "bar") {
          if (distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= HIT_PAD) return el;
        } else if (el.kind === "window") {
          const w = el.w || 60, h = el.h || 40;
          if (x >= el.x - HIT_PAD && x <= el.x + w + HIT_PAD && y >= el.y - HIT_PAD && y <= el.y + h + HIT_PAD) return el;
        } else if (el.kind === "door") {
          const r = 60;
          if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
        } else {
          const r = el.kind === "mixer" ? 14 : (el.kind === "shower" ? 48 : 22);
          if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
        }
      }
    }
    return null;
  };

  /* ----- Pointers ----- */
  const onPointerDown = (e) => {
    e.preventDefault(); if (tab !== "plan") return;
    const p = pointerPos(e);

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

    if (tool === "shower") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "shower", x: p.x, y: clampYOutOfBanner(p.y) }]);
      setSelectedId(id);
      return;
    }

    if (tool === "door") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "door", x: p.x, y: clampYOutOfBanner(p.y) }]);
      setSelectedId(id);
      return;
    }

    if (tool === "window") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "window", x: p.x, y: clampYOutOfBanner(p.y), w: 60, h: 40 }]);
      setSelectedId(id);
      return;
    }

    setStartPt({ x: p.x, y: clampYOutOfBanner(p.y) }); // bar / dim / rect
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
          return { ...el, x: nx, y: ny };
        }
        return el;
      }));
      setStartPt(p);
      return;
    }

    let { x: x2, y: y2 } = p;
    y2 = clampYOutOfBanner(y2);
    if (tool === "dim" || tool === "rect" || tool === "bar") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      setPreview({ type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 });
    } else if (tool === "bar") {
      setPreview({ type: "symbol", kind: "bar", x1: startPt.x, y1: startPt.y, x2, y2 });
    } else if (tool === "rect") {
      setPreview({ type: "rect", x: Math.min(startPt.x, x2), y: Math.min(startPt.y, y2), w: Math.abs(x2 - startPt.x), h: Math.abs(y2 - startPt.y) });
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
    if (tool === "dim" || tool === "rect" || tool === "bar") ({ x2, y2 } = applyOrtho(startPt.x, startPt.y, x2, y2));

    if (tool === "dim") {
      const id = newId();
      setElements((els) => [...els, { id, type: "dim", x1: startPt.x, y1: startPt.y, x2, y2 }]);
      setSelectedId(id);
    } else if (tool === "bar") {
      const id = newId();
      setElements((els) => [...els, { id, type: "symbol", kind: "bar", x1: startPt.x, y1: startPt.y, x2, y2 }]);
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

  /* ---------- Export PDF ---------- */
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const waitPaint = async (ms = 120) => { await raf(); await new Promise((r) => setTimeout(r, ms)); };

  const exportPDF = async () => {
    if (!validateStudy()) return;

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

      // En-tête professionnel
      pdf.setFillColor(14, 165, 165);
      pdf.rect(0, 0, pageW, 15, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("ÉTUDE TECHNIQUE - INSTALLATION DOUCHE", pageW / 2, 10, { align: "center" });

      // Info document
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.text(`Client: ${study.client_nom} ${study.client_prenom} | Date: ${study.date_visite || new Date().toLocaleDateString('fr-FR')}`, 10, 20);
      pdf.text(`Installateur: ${study.inst_nom} ${study.inst_prenom}`, 10, 24);

      const w1 = pageW, h1 = (c1.height / c1.width) * w1;
      pdf.addImage(img1, "PNG", 0, 28, w1, Math.min(h1, pageH - 80), undefined, "FAST");

      // Ajout signatures sur la première page si disponibles
      if (signatureClient || signatureInstaller) {
        const sigY = pageH - 50;
        pdf.setDrawColor(200, 200, 200);
        pdf.line(10, sigY - 5, pageW - 10, sigY - 5);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.text("SIGNATURES", pageW / 2, sigY, { align: "center" });

        if (signatureClient) {
          pdf.setFontSize(8);
          pdf.text("Client:", 20, sigY + 8);
          pdf.addImage(signatureClient, "PNG", 15, sigY + 10, 80, 30);
          pdf.text(`${study.client_nom} ${study.client_prenom}`, 20, sigY + 42);
          pdf.text(new Date().toLocaleDateString('fr-FR'), 20, sigY + 46);
        }

        if (signatureInstaller) {
          pdf.setFontSize(8);
          pdf.text("Installateur:", pageW - 95, sigY + 8);
          pdf.addImage(signatureInstaller, "PNG", pageW - 95, sigY + 10, 80, 30);
          pdf.text(`${study.inst_nom} ${study.inst_prenom}`, pageW - 95, sigY + 42);
          pdf.text(new Date().toLocaleDateString('fr-FR'), pageW - 95, sigY + 46);
        }
      }

      // Footer
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(7);
      pdf.text("Document généré automatiquement - Page 1", pageW / 2, pageH - 5, { align: "center" });

      pdf.addPage();
      // En-tête page 2
      pdf.setFillColor(14, 165, 165);
      pdf.rect(0, 0, pageW, 15, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("PLAN TECHNIQUE INDICATIF", pageW / 2, 10, { align: "center" });
      const w2 = pageW, h2 = (c2.height / c2.width) * w2;
      pdf.addImage(img2, "PNG", 0, 18, w2, Math.min(h2, pageH - 25), undefined, "FAST");

      // Footer page 2
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(7);
      pdf.text("Document généré automatiquement - Page 2", pageW / 2, pageH - 5, { align: "center" });

      // Pages photos si présentes
      let pageNum = 3;
      if (photosAvant.length > 0) {
        pdf.addPage();
        pdf.setFillColor(14, 165, 233);
        pdf.rect(0, 0, pageW, 15, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont(undefined, "bold");
        pdf.text("PHOTOS AVANT TRAVAUX", pageW / 2, 10, { align: "center" });
        pdf.setTextColor(0, 0, 0);
        let y = 25;
        for (const photo of photosAvant) {
          if (y > pageH - 85) {
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(7);
            pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
            pdf.addPage();
            pageNum++;
            y = 20;
          }
          const imgW = pageW - 40;
          const imgH = imgW * 0.75;
          pdf.addImage(photo.url, "JPEG", 20, y, imgW, imgH);
          y += imgH + 10;
        }
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(7);
        pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
        pageNum++;
      }

      if (photosApres.length > 0) {
        pdf.addPage();
        pdf.setFillColor(34, 197, 94);
        pdf.rect(0, 0, pageW, 15, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont(undefined, "bold");
        pdf.text("PHOTOS APRÈS TRAVAUX", pageW / 2, 10, { align: "center" });
        pdf.setTextColor(0, 0, 0);
        let y = 25;
        for (const photo of photosApres) {
          if (y > pageH - 85) {
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(7);
            pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
            pdf.addPage();
            pageNum++;
            y = 20;
          }
          const imgW = pageW - 40;
          const imgH = imgW * 0.75;
          pdf.addImage(photo.url, "JPEG", 20, y, imgW, imgH);
          y += imgH + 10;
        }
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(7);
        pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
      }

      pdf.save(`Etude_IR_${study.client_nom || 'Client'}_${new Date().toISOString().split('T')[0]}.pdf`);
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
      .actions-sticky {
        position: sticky; top: 0; z-index: 10;
        background: linear-gradient(135deg, #0ea5e9 0%, #0ea5a5 100%);
        box-shadow: 0 4px 12px rgba(14,165,233,0.3);
        padding: 12px 16px; margin: -16px -16px 16px -16px;
        border-radius: 0;
      }
      .ir-canvas-wrap { height: 560px; }
      @media (max-width: 767px) { .ir-canvas-wrap { height: 460px; } }
      canvas.ir-grid { touch-action: none; display: block; width: 100%; height: 100%; }
      button, input, select, textarea { min-height: 44px; }
      button:active:not(:disabled) { transform: scale(0.97); opacity: 0.8; }
      .legend svg { vertical-align: middle; }
      .header-card {
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border: 2px solid #0ea5a5;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .header-card h2 {
        letter-spacing: .5px;
        background: linear-gradient(135deg, #0ea5e9, #0ea5a5);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .photo-item {
        position: relative;
        aspect-ratio: 4/3;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid #e5e7eb;
        background: #f8fafc;
      }
      .photo-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .photo-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        min-height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
      }
      .photo-add-btn {
        aspect-ratio: 4/3;
        border: 2px dashed #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        gap: 8px;
        transition: all 0.2s;
      }
      .photo-add-btn:hover {
        border-color: #0ea5a5;
        background: #e0f2fe;
      }
      .photo-add-btn svg {
        width: 32px;
        height: 32px;
        stroke: #64748b;
      }
      @media (max-width: 640px) {
        .photo-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        }
      }
    `}</style>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {styles}

      {/* BARRE D'ACTIONS */}
      <div className="actions-sticky">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, margin: 0, color: "#fff", fontWeight: 700 }}>Documents IR — Douche</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={resetAll} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.1)", color:"#fff", fontWeight:600 }}>
              Nouvelle étude
            </button>
            <button onClick={exportPDF} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid #fff", background:"#fff", color:"#0ea5a5", fontWeight:600 }}>
              Exporter PDF
            </button>
          </div>
        </div>
      </div>

      {/* ONGLETS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("etude")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "etude" ? "#e2e8f0" : "#fff", flex: 1, fontWeight: 600 }}>Étude technique</button>
        <button onClick={() => setTab("plan")}  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: tab === "plan"  ? "#e2e8f0" : "#fff", flex: 1, fontWeight: 600 }}>Plan technique</button>
      </div>

      {/* ======= PAGE 1 — ÉTUDE ======= */}
      <div ref={etudeRef}>
        {tab === "etude" && (
          <>
            <Section className="header-card" style={{ paddingBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ÉTUDE TECHNIQUE</h2>
            </Section>

            <Section title="En-têtes">
              <Row>
                <Col span={4}><Label required>Date de la visite</Label><Input type="date" value={study.date_visite} onChange={(e)=>setStudy(s=>({...s, date_visite:e.target.value}))} /></Col>
                <Col span={4}><Label required>Installateur — Nom</Label><Input value={study.inst_nom} onChange={(e)=>setStudy(s=>({...s, inst_nom:e.target.value}))} /></Col>
                <Col span={4}><Label required>Installateur — Prénom</Label><Input value={study.inst_prenom} onChange={(e)=>setStudy(s=>({...s, inst_prenom:e.target.value}))} /></Col>
              </Row>
              <Row>
                <Col span={4}><Label required>Client — Nom</Label><Input value={study.client_nom} onChange={(e)=>setStudy(s=>({...s, client_nom:e.target.value}))} /></Col>
                <Col span={4}><Label required>Client — Prénom</Label><Input value={study.client_prenom} onChange={(e)=>setStudy(s=>({...s, client_prenom:e.target.value}))} /></Col>
                <Col span={4}><Label>Client — Adresse</Label><Input value={study.client_adresse} onChange={(e)=>setStudy(s=>({...s, client_adresse:e.target.value}))} /></Col>
              </Row>
            </Section>

            <Section title="Étude technique">
              <Row>
                <Col span={6}><Label required>Longueur receveur (mm)</Label><Input type="number" value={study.longueur_receveur} onChange={(e)=>setStudy(s=>({...s, longueur_receveur:e.target.value}))} /></Col>
                <Col span={6}><Label required>Largeur receveur (mm)</Label><Input type="number" value={study.largeur_receveur} onChange={(e)=>setStudy(s=>({...s, largeur_receveur:e.target.value}))} /></Col>
              </Row>
              <Row>
                <Col span={6}><Label required>Largeur d'accès douche (min 65cm)</Label><Input type="number" value={study.largeur_acces} onChange={(e)=>setStudy(s=>({...s, largeur_acces:e.target.value}))} /></Col>
                <Col span={6}><Label>Hauteur plafond (mm)</Label><Input type="number" value={study.hauteur_plafond} onChange={(e)=>setStudy(s=>({...s, hauteur_plafond:e.target.value}))} /></Col>
              </Row>
              <Row>
                <Col span={6}><Label>Hauteur estimée du receveur (mm)</Label><Input type="number" value={study.hauteur_estimee_receveur} onChange={(e)=>setStudy(s=>({...s, hauteur_estimee_receveur:e.target.value}))} /></Col>
                <Col span={6}><Label>Largeur de la salle de bains (mm)</Label><Input type="number" value={study.largeur_sdb} onChange={(e)=>setStudy(s=>({...s, largeur_sdb:e.target.value}))} /></Col>
              </Row>
              <Row>
                <Col span={6}><Label>Longueur de la salle de bains (mm)</Label><Input type="number" value={study.longueur_sdb} onChange={(e)=>setStudy(s=>({...s, longueur_sdb:e.target.value}))} /></Col>
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
                <Col span={4}><Label>Hauteur de fenêtre (mm)</Label><Input type="number" value={study.h_fenetre} onChange={(e)=>setStudy(s=>({...s, h_fenetre:e.target.value}))} /></Col>
                <Col span={4}><Label>Largeur de fenêtre (mm)</Label><Input type="number" value={study.l_fenetre} onChange={(e)=>setStudy(s=>({...s, l_fenetre:e.target.value}))} /></Col>
                <Col span={4}><Label>Distance fenêtre / mur gauche (mm)</Label><Input type="number" value={study.dist_gauche} onChange={(e)=>setStudy(s=>({...s, dist_gauche:e.target.value}))} /></Col>
              </Row>
              <Row>
                <Col span={4}><Label>Distance fenêtre / mur droit (mm)</Label><Input type="number" value={study.dist_droit} onChange={(e)=>setStudy(s=>({...s, dist_droit:e.target.value}))} /></Col>
                <Col span={4}><Label>Distance fenêtre / plafond (mm)</Label><Input type="number" value={study.dist_plafond} onChange={(e)=>setStudy(s=>({...s, dist_plafond:e.target.value}))} /></Col>
                <Col span={4}><Label>Distance fenêtre / sol (mm)</Label><Input type="number" value={study.dist_sol} onChange={(e)=>setStudy(s=>({...s, dist_sol:e.target.value}))} /></Col>
              </Row>
            </Section>

            <Section title="Travaux complémentaires nécessaires">
              <Row>
                <Col span={12}>
                  <Check label="Coffrage" checked={study.travaux.coffrage} onChange={()=>toggleTravaux('coffrage')} />
                  <Check label="Création entretoise" checked={study.travaux.creation_entretoise} onChange={()=>toggleTravaux('creation_entretoise')} />
                  <Check label="Reprise sol" checked={study.travaux.reprise_sol} onChange={()=>toggleTravaux('reprise_sol')} />
                  <Check label="Saignée sol" checked={study.travaux.saignee_sol} onChange={()=>toggleTravaux('saignee_sol')} />
                  <Check label="Modif plomberie" checked={study.travaux.modif_plomberie} onChange={()=>toggleTravaux('modif_plomberie')} />
                  <Check label="Dépose WC ou meuble" checked={study.travaux.depose_wc_ou_meuble} onChange={()=>toggleTravaux('depose_wc_ou_meuble')} />
                  <Check label="Dépose bidet" checked={study.travaux.depose_bidet} onChange={()=>toggleTravaux('depose_bidet')} />
                  <Check label="Dépose douche suppl" checked={study.travaux.depose_douche_suppl} onChange={()=>toggleTravaux('depose_douche_suppl')} />
                  <Check label="Dépose sanitaire" checked={study.travaux.depose_sanitaire} onChange={()=>toggleTravaux('depose_sanitaire')} />
                  <Check label="Dépl machine" checked={study.travaux.depl_machine} onChange={()=>toggleTravaux('depl_machine')} />
                  <Check label="Dépl prise" checked={study.travaux.depl_prise} onChange={()=>toggleTravaux('depl_prise')} />
                  <Check label="Pompe relevage" checked={study.travaux.pompe_relevage} onChange={()=>toggleTravaux('pompe_relevage')} />
                  <Check label="Finition haute" checked={study.travaux.finition_haute} onChange={()=>toggleTravaux('finition_haute')} />
                </Col>
              </Row>
              <Row>
                <Col span={12}><Label>Autres</Label>
                  <textarea value={study.travaux_autres} onChange={(e)=>setStudy(s=>({...s, travaux_autres:e.target.value}))} style={{ width: "100%", minHeight: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, fontSize: 14 }} />
                </Col>
              </Row>
            </Section>

            {/* PHOTOS AVANT */}
            <Section title="Photos AVANT travaux">
              <div className="photo-grid">
                {photosAvant.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <img src={photo.url} alt={photo.name} />
                    </a>
                    <button className="photo-remove" onClick={() => removePhoto(photo.id, 'avant')}>×</button>
                  </div>
                ))}
                <label className="photo-add-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Ajouter</span>
                  <input
                    ref={photoAvantInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoCapture(e, 'avant')}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </Section>

            {/* PHOTOS APRÈS */}
            <Section title="Photos APRÈS travaux">
              <div className="photo-grid">
                {photosApres.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <img src={photo.url} alt={photo.name} />
                    </a>
                    <button className="photo-remove" onClick={() => removePhoto(photo.id, 'apres')}>×</button>
                  </div>
                ))}
                <label className="photo-add-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Ajouter</span>
                  <input
                    ref={photoApresInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoCapture(e, 'apres')}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </Section>

            {/* SIGNATURES */}
            <Section title="Signatures">
              <Row>
                <Col span={6}>
                  <Label>Signature du client</Label>
                  <div style={{ border: "2px solid #cbd5e1", borderRadius: 8, background: "#fff", position: "relative" }}>
                    <canvas
                      ref={signatureClientRef}
                      width={400}
                      height={150}
                      onPointerDown={(e) => startSignature(e, 'client')}
                      onPointerMove={(e) => drawSignature(e, 'client')}
                      onPointerUp={() => endSignature('client')}
                      onTouchStart={(e) => startSignature(e, 'client')}
                      onTouchMove={(e) => drawSignature(e, 'client')}
                      onTouchEnd={() => endSignature('client')}
                      style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
                    />
                    <button
                      onClick={() => clearSignature('client')}
                      style={{ position: 'absolute', top: 4, right: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
                    >
                      Effacer
                    </button>
                  </div>
                  <Small>Nom : {study.client_nom} {study.client_prenom}</Small>
                  <Small>Date : {new Date().toLocaleDateString('fr-FR')}</Small>
                </Col>
                <Col span={6}>
                  <Label>Signature de l'installateur</Label>
                  <div style={{ border: "2px solid #cbd5e1", borderRadius: 8, background: "#fff", position: "relative" }}>
                    <canvas
                      ref={signatureInstallerRef}
                      width={400}
                      height={150}
                      onPointerDown={(e) => startSignature(e, 'installer')}
                      onPointerMove={(e) => drawSignature(e, 'installer')}
                      onPointerUp={() => endSignature('installer')}
                      onTouchStart={(e) => startSignature(e, 'installer')}
                      onTouchMove={(e) => drawSignature(e, 'installer')}
                      onTouchEnd={() => endSignature('installer')}
                      style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
                    />
                    <button
                      onClick={() => clearSignature('installer')}
                      style={{ position: 'absolute', top: 4, right: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
                    >
                      Effacer
                    </button>
                  </div>
                  <Small>Nom : {study.inst_nom} {study.inst_prenom}</Small>
                  <Small>Date : {new Date().toLocaleDateString('fr-FR')}</Small>
                </Col>
              </Row>
            </Section>
          </>
        )}
      </div>

      {/* ======= PAGE 2 — PLAN ======= */}
      {tab === "plan" && (
        <div>
          <Section className="header-card" style={{ paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>PLAN TECHNIQUE INDICATIF DOUCHE</h2>
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

          {/* OUTILS */}
          <Section title="Outils">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button onClick={()=>setTool("select")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="select"?"#e2e8f0":"#fff" }}>Sélection</button>
              <button onClick={()=>setTool("dim")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="dim"?"#e2e8f0":"#fff" }}>Cote</button>
              <button onClick={()=>setTool("rect")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="rect"?"#e2e8f0":"#fff" }}>Rect</button>
              <button onClick={()=>setTool("mixer")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="mixer"?"#e2e8f0":"#fff" }}>Mitigeur</button>
              <button onClick={()=>setTool("seat")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="seat"?"#e2e8f0":"#fff" }}>Siège</button>
              <button onClick={()=>setTool("bar")}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="bar"?"#e2e8f0":"#fff" }}>Barre maintien</button>
              <button onClick={()=>setTool("shower")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="shower"?"#e2e8f0":"#fff" }}>Ciel pluie</button>
              <button onClick={()=>setTool("door")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="door"?"#e2e8f0":"#fff" }}>Porte</button>
              <button onClick={()=>setTool("window")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="window"?"#e2e8f0":"#fff" }}>Fenêtre</button>
              <button onClick={()=>setTool("text")}   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: tool==="text"?"#e2e8f0":"#fff" }}>Texte</button>
              <button onClick={()=>setSnap(s=>!s)}     style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: snap?"#e2e8f0":"#fff" }}>{snap?"Snap ✓":"Snap ✗"}</button>
              <button onClick={()=>setOrtho(o=>!o)}    style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background: ortho?"#e2e8f0":"#fff" }}>{ortho?"Ortho ✓":"Ortho ✗"}</button>
              <button onClick={undo}                   style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff" }}>Undo</button>
              <button onClick={delSelected}            style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #ef4444", color:"#ef4444", background:"#fff" }} disabled={!selectedId}>Supprimer sélection</button>
            </div>
            <Small>Zones bleues = murs. Double-clic pour éditer un texte. Le siège se plaque au mur. Barre de maintien = trait entre 2 points.</Small>
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
                  style={{ cursor: tool==="select" ? "default" : (tool==="mixer"||tool==="seat"||tool==="text") ? "cell" : "crosshair" }}
                />
              </div>
            </div>

            {/* Accessoires au style du schéma */}
            <Section>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:32, height:32, border:"2px solid #0f172a", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>S</div>
                  <span>Siège</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="18" viewBox="0 0 60 18">
                    <line x1="6" y1="9" x2="54" y2="9" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="42" cy="9" r="3.5" fill="#0f172a" />
                  </svg>
                  <span>Barre de maintien</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="48" height="20" viewBox="0 0 48 20">
                    <circle cx="18" cy="10" r="3" fill="none" stroke="#0f172a" strokeWidth="2" />
                    <circle cx="30" cy="10" r="3" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Robinetterie</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="60" height="20" viewBox="0 0 60 20">
                    <line x1="6" y1="6" x2="48" y2="6" stroke="#0f172a" strokeWidth="2" />
                    <circle cx="48" cy="6" r="4" fill="none" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Ciel de pluie</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="36" height="20" viewBox="0 0 36 20">
                    <line x1="8" y1="16" x2="28" y2="16" stroke="#0f172a" strokeWidth="2" />
                    <line x1="8" y1="6" x2="8" y2="16" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                  <span>Échelle 1:1</span>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
                <div><strong>Mitigeur&nbsp;:</strong> symbole rond avec croix et bec orienté vers l'intérieur du plan.</div>
                <div><strong>Siège mural&nbsp;:</strong> demi-ovale plaqué contre le mur le plus proche (haut/gauche/droite).</div>
                <div><strong>Barre de maintien&nbsp;:</strong> segment avec curseur (position libre selon besoin).</div>
                <div><strong>Ciel de pluie&nbsp;:</strong> ligne d'alimentation et pomme de douche en bout.</div>
                <div><strong>Texte libre&nbsp;:</strong> posable et déplaçable précisément, double-clic pour éditer.</div>
              </div>
            </Section>
          </div>

          {/* Actions locales */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={resetPlan} style={{ padding:"10px 14px", borderRadius: 10, border:"1px solid #cbd5e1", background:"#fff" }}>
              Réinitialiser le plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
