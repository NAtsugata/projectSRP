// FILE: src/pages/IRShowerFormsView.jsx
// Refactoré - Composants UI et hook Canvas extraits dans des modules séparés
import React, { useRef, useState, useEffect, useCallback } from "react";
import { storageService, supabase } from '../lib/supabase';
import logger from '../utils/logger';
import { Section, Row, Col, Label, Input, Check, Radio, Small } from '../components/ir-shower';
import { usePlanCanvas } from '../hooks/usePlanCanvas';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { PLAN_TEMPLATES, getTemplateElements } from '../data/planTemplates';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const GRID_SIZE = 20;
const HIT_PAD = 10;
const BANNER_H = 40;
const LABEL_OFFSET = 8;

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

/* ---------- Main ---------- */
export default function IRShowerFormsView({ profile }) {
  const [tab, setTab] = useState("etude");
  const [toolCategory, setToolCategory] = useState('draw'); // draw, symbols, options

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

  // Use undo/redo hook for elements with history
  const {
    elements,
    setElements,
    setElementsNoHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory
  } = useUndoRedo([]);

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
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire
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
            logger.log(`📸 Compression: ${(file.size/1024).toFixed(0)}KB → ${(b.size/1024).toFixed(0)}KB (${((1-b.size/file.size)*100).toFixed(0)}% économisé)`);
            res(compressed);
          } else {
            res(file);
          }
        }, 'image/jpeg', 0.65);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire en cas d'erreur
        res(file);
      };
      img.src = objectUrl;
    });
  };

  const handlePhotoCapture = async (e, type) => {
    logger.log('📸 handlePhotoCapture appelé, type:', type, 'event:', e);
    const files = Array.from(e.target.files);
    logger.log('📸 Fichiers détectés:', files.length);
    if (files.length === 0) {
      console.warn('⚠️ Aucun fichier capturé');
      return;
    }

    if (!userId) {
      console.error('❌ Pas d\'userId disponible pour l\'upload');
      return;
    }

    logger.log('📸 Début upload des fichiers vers le cloud...');

    try {
      // Uploader tous les fichiers en parallèle
      const uploadPromises = files.map(async (file) => {
        try {
          logger.log('📸 Upload fichier:', file.name);

          // Compresser l'image d'abord
          const compressedFile = await compressImage(file);

          // Upload vers le cloud
          const { publicURL, error } = await storageService.uploadExpenseFile(
            compressedFile,
            userId,
            (progress) => {
              logger.log(`📤 Progression ${file.name}: ${progress}%`);
            }
          );

          if (error) throw error;

          logger.log('✅ Fichier uploadé avec succès:', publicURL);

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

      logger.log('✅ Tous les fichiers uploadés:', uploadedPhotos.length);

      if (type === 'avant') {
        logger.log('📸 Ajout photos AVANT');
        setPhotosAvant(prev => [...prev, ...uploadedPhotos]);
      } else {
        logger.log('📸 Ajout photos APRÈS');
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

  // Restauration au chargement (without adding to undo history)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ir-shower-draft');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.study) setStudy(data.study);
        if (data.elements) setElementsNoHistory(data.elements);
        if (data.photosAvant) setPhotosAvant(data.photosAvant);
        if (data.photosApres) setPhotosApres(data.photosApres);
        if (data.signatureClient) setSignatureClient(data.signatureClient);
        if (data.signatureInstaller) setSignatureInstaller(data.signatureInstaller);
      }
    } catch (e) {
      console.error('Restauration échouée:', e);
    }
  }, [setElementsNoHistory]);

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
      resetHistory();
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

  // Plan validation - check if plan has required elements
  const validatePlan = useCallback(() => {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      tips: [],
      score: 0,
      maxScore: 100,
      elements: {
        rect: elements.filter(el => el.type === 'rect').length,
        dim: elements.filter(el => el.type === 'dim').length,
        shower: elements.filter(el => el.type === 'symbol' && el.kind === 'shower').length,
        mixer: elements.filter(el => el.type === 'symbol' && el.kind === 'mixer').length,
        seat: elements.filter(el => el.type === 'symbol' && el.kind === 'seat').length,
        bar: elements.filter(el => el.type === 'symbol' && el.kind === 'bar').length,
        door: elements.filter(el => el.type === 'symbol' && el.kind === 'door').length,
        drain: elements.filter(el => el.type === 'symbol' && el.kind === 'drain').length,
      }
    };

    const { rect, dim, shower, mixer, seat, bar, door, drain } = validation.elements;

    // CRITICAL: Room definition (20 pts)
    if (rect === 0) {
      validation.errors.push('Tracez les contours de la pièce (Rectangle ⬜)');
    } else {
      validation.score += 20;
    }

    // CRITICAL: Shower position (20 pts)
    if (shower === 0) {
      validation.errors.push('Placez le ciel de pluie 🚿');
    } else {
      validation.score += 20;
    }

    // IMPORTANT: Mixer (15 pts)
    if (mixer === 0) {
      validation.warnings.push('Ajoutez le mitigeur 🔵');
    } else {
      validation.score += 15;
    }

    // IMPORTANT: Dimensions (15 pts)
    if (dim < 2) {
      validation.warnings.push(`Ajoutez des cotes (${dim}/2 min) 📏`);
      validation.score += dim * 5;
    } else {
      validation.score += 15;
    }

    // RECOMMENDED: Door (10 pts)
    if (door === 0) {
      validation.tips.push('Indiquez la porte 🚪');
    } else {
      validation.score += 10;
    }

    // RECOMMENDED: Grab bars (10 pts)
    if (bar === 0) {
      validation.tips.push('Barre de maintien recommandée ➖');
    } else {
      validation.score += 10;
    }

    // RECOMMENDED: Drain position (5 pts)
    if (drain === 0) {
      validation.tips.push('Position évacuation ⚫');
    } else {
      validation.score += 5;
    }

    // BONUS: Seat for accessibility (5 pts)
    if (seat > 0) {
      validation.score += 5;
    }

    // Cap score at 100
    validation.score = Math.min(100, validation.score);

    // Plan is valid if no critical errors
    validation.isValid = validation.errors.length === 0;

    return validation;
  }, [elements]);

  // Get current validation state
  const planValidation = validatePlan();

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
    const { w, h, midY } = getZones();
    const pad = 8; // padding from wall

    // Determine which zone we're in (top half or bottom half)
    const inTopZone = p.y < midY;
    const zoneTop = inTopZone ? BANNER_H : midY + BANNER_H;
    const zoneBottom = inTopZone ? midY - pad : h - pad;

    // Calculate distances to all 4 walls of the current zone
    const distTop = Math.abs(p.y - zoneTop);
    const distBottom = Math.abs(p.y - zoneBottom);
    const distLeft = Math.abs(p.x - 0);
    const distRight = Math.abs(p.x - w);

    // Find the closest wall
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    let orient = "top", x = p.x, y = p.y;

    if (minDist === distTop) {
      // Snap to top wall
      y = zoneTop + pad;
      x = Math.max(pad, Math.min(w - pad, p.x));
      orient = "top";
    } else if (minDist === distBottom) {
      // Snap to bottom wall
      y = zoneBottom - pad;
      x = Math.max(pad, Math.min(w - pad, p.x));
      orient = "bottom";
    } else if (minDist === distLeft) {
      // Snap to left wall
      x = pad;
      y = Math.max(zoneTop + pad, Math.min(zoneBottom - pad, p.y));
      orient = "left";
    } else {
      // Snap to right wall
      x = w - pad;
      y = Math.max(zoneTop + pad, Math.min(zoneBottom - pad, p.y));
      orient = "right";
    }

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
        } else if (el.kind === "wc") {
          // WC is larger - ellipse 15x20 + reservoir extends to y-35
          if (x >= el.x - 20 && x <= el.x + 20 && y >= el.y - 40 && y <= el.y + 25) return el;
        } else if (el.kind === "sink") {
          // Sink is roundRect 40x30
          if (x >= el.x - 25 && x <= el.x + 25 && y >= el.y - 20 && y <= el.y + 20) return el;
        } else if (el.kind === "towelrack") {
          // Towel rack is horizontal line -25 to +25
          if (x >= el.x - 30 && x <= el.x + 30 && y >= el.y - 10 && y <= el.y + 10) return el;
        } else if (el.kind === "seat") {
          // Seat hitbox based on orientation (half-circle r=18)
          const r = 20;
          switch (el.orient) {
            case "top":    if (x >= el.x - r && x <= el.x + r && y >= el.y && y <= el.y + r + HIT_PAD) return el; break;
            case "bottom": if (x >= el.x - r && x <= el.x + r && y >= el.y - r - HIT_PAD && y <= el.y) return el; break;
            case "left":   if (x >= el.x && x <= el.x + r + HIT_PAD && y >= el.y - r && y <= el.y + r) return el; break;
            case "right":  if (x >= el.x - r - HIT_PAD && x <= el.x && y >= el.y - r && y <= el.y + r) return el; break;
            default:       if ((x - el.x) ** 2 + (y - el.y) ** 2 <= (r + HIT_PAD) ** 2) return el;
          }
        } else {
          // mixer (r=14), shower (r=48), drain (r=15)
          const r = el.kind === "mixer" ? 16 : (el.kind === "shower" ? 50 : 15);
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

    // Helper to place symbol and auto-switch to select mode
    const placeSymbol = (symbolData) => {
      const id = newId();
      setElements((els) => [...els, { id, ...symbolData }]);
      setSelectedId(id);
      setTool('select'); // Auto-switch to select mode for easier mobile UX
    };

    if (tool === "mixer") {
      placeSymbol({ type: "symbol", kind: "mixer", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "seat") {
      const seat = clampSeatToWall(p);
      placeSymbol({ type: "symbol", kind: "seat", x: seat.x, y: seat.y, orient: seat.orient });
      return;
    }

    if (tool === "text") {
      const t = window.prompt("Texte :");
      if (t && t.trim()) {
        placeSymbol({ type: "text", x: p.x, y: clampYOutOfBanner(p.y), text: t });
      }
      return;
    }

    if (tool === "shower") {
      placeSymbol({ type: "symbol", kind: "shower", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "door") {
      placeSymbol({ type: "symbol", kind: "door", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "window") {
      placeSymbol({ type: "symbol", kind: "window", x: p.x, y: clampYOutOfBanner(p.y), w: 60, h: 40 });
      return;
    }

    // New symbols with rotation support
    if (tool === "wc") {
      placeSymbol({ type: "symbol", kind: "wc", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "sink") {
      placeSymbol({ type: "symbol", kind: "sink", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "towelrack") {
      placeSymbol({ type: "symbol", kind: "towelrack", x: p.x, y: clampYOutOfBanner(p.y), rotation: 0 });
      return;
    }

    if (tool === "drain") {
      placeSymbol({ type: "symbol", kind: "drain", x: p.x, y: clampYOutOfBanner(p.y) });
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

  // Undo with clear selection (from useUndoRedo hook)
  const handleUndo = useCallback(() => {
    undo();
    setSelectedId(null);
  }, [undo]);

  // Redo with clear selection
  const handleRedo = useCallback(() => {
    redo();
    setSelectedId(null);
  }, [redo]);

  const delSelected = () => { if (!selectedId) return; setElements((els) => els.filter((x) => x.id !== selectedId)); setSelectedId(null); };
  const resetPlan = () => { resetHistory(); setPreview(null); setSelectedId(null); };

  // Rotate selected element by 90 degrees
  const rotateSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => els.map((el) => {
      if (el.id !== selectedId) return el;
      // Only rotate symbols that support rotation
      if (el.type === 'symbol' && ['wc', 'sink', 'towelrack', 'door', 'shower', 'mixer'].includes(el.kind)) {
        const currentRotation = el.rotation || 0;
        return { ...el, rotation: (currentRotation + 90) % 360 };
      }
      // Rotate seat orientation
      if (el.type === 'symbol' && el.kind === 'seat') {
        const orientations = ['top', 'right', 'bottom', 'left'];
        const currentIndex = orientations.indexOf(el.orient || 'top');
        const nextOrient = orientations[(currentIndex + 1) % orientations.length];
        return { ...el, orient: nextOrient };
      }
      return el;
    }));
  }, [selectedId, setElements]);

  // Check if selected element can be rotated
  const canRotate = useCallback(() => {
    if (!selectedId) return false;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return false;
    return el.type === 'symbol' && ['wc', 'sink', 'towelrack', 'door', 'shower', 'seat', 'mixer'].includes(el.kind);
  }, [selectedId, elements]);

  // Load a template into the canvas
  const loadTemplate = useCallback((templateId) => {
    if (elements.length > 0) {
      if (!window.confirm('Charger ce template effacera le plan actuel. Continuer ?')) {
        return;
      }
    }
    const templateElements = getTemplateElements(templateId);
    setElementsNoHistory(templateElements);
    setSelectedId(null);
    setPreview(null);
    setTool('select');
  }, [elements.length, setElementsNoHistory]);

  // Keyboard shortcuts for undo/redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle when plan tab is active and not in text input
      if (tab !== 'plan') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab, handleUndo, handleRedo]);

  /* ---------- Export PDF ---------- */
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const waitPaint = async (ms = 200) => { await raf(); await new Promise((r) => setTimeout(r, ms)); };

  const exportPDF = async () => {
    if (!validateStudy()) return;

    try {
      const prevTab = tab;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let y = 0;

      // ========== PAGE 1: ÉTUDE TECHNIQUE (généré directement) ==========
      // En-tête
      pdf.setFillColor(14, 165, 165);
      pdf.rect(0, 0, pageW, 18, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont(undefined, "bold");
      pdf.text("ÉTUDE TECHNIQUE - INSTALLATION DOUCHE", pageW / 2, 12, { align: "center" });

      y = 25;
      pdf.setTextColor(0, 0, 0);

      // Helper pour ajouter une section
      const addSection = (title) => {
        if (y > pageH - 30) { pdf.addPage(); y = 15; }
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, y, pageW - margin * 2, 7, "F");
        pdf.setFontSize(10);
        pdf.setFont(undefined, "bold");
        pdf.setTextColor(14, 165, 165);
        pdf.text(title, margin + 2, y + 5);
        pdf.setTextColor(0, 0, 0);
        y += 10;
      };

      // Helper pour ajouter une ligne de données
      const addRow = (label, value, col = 0, totalCols = 2) => {
        const colW = (pageW - margin * 2) / totalCols;
        const x = margin + col * colW;
        pdf.setFontSize(8);
        pdf.setFont(undefined, "bold");
        pdf.text(label + ":", x, y);
        pdf.setFont(undefined, "normal");
        pdf.text(String(value || "-"), x + colW * 0.5, y);
      };

      // ---- INFORMATIONS GÉNÉRALES ----
      addSection("INFORMATIONS GÉNÉRALES");
      addRow("Date visite", study.date_visite || "-", 0, 3);
      addRow("Client", `${study.client_nom} ${study.client_prenom}`, 1, 3);
      addRow("Adresse", study.client_adresse || "-", 2, 3);
      y += 5;
      addRow("Installateur", `${study.inst_nom} ${study.inst_prenom}`, 0, 2);
      y += 8;

      // ---- DIMENSIONS ----
      addSection("DIMENSIONS");
      addRow("Longueur receveur", `${study.longueur_receveur || "-"} mm`, 0, 3);
      addRow("Largeur receveur", `${study.largeur_receveur || "-"} mm`, 1, 3);
      addRow("Largeur accès", `${study.largeur_acces || "-"} mm`, 2, 3);
      y += 5;
      addRow("Hauteur plafond", `${study.hauteur_plafond || "-"} mm`, 0, 3);
      addRow("Hauteur receveur", `${study.hauteur_estimee_receveur || "-"} mm`, 1, 3);
      addRow("Dimensions SdB", `${study.largeur_sdb || "-"} x ${study.longueur_sdb || "-"} mm`, 2, 3);
      y += 8;

      // ---- ÉQUIPEMENTS ----
      addSection("ÉQUIPEMENTS");
      addRow("Robinetterie", study.robinetterie_type === "thermostatique" ? "Thermostatique" : "Mitigeur classique", 0, 3);
      addRow("Vanne d'arrêt OK", study.vanne_ok === "oui" ? "✓ Oui" : "✗ Non", 1, 3);
      addRow("Fenêtre", study.fenetre === "oui" ? "✓ Oui" : "✗ Non", 2, 3);
      y += 5;
      if (study.fenetre === "oui") {
        addRow("Dim. fenêtre", `${study.h_fenetre || "-"} x ${study.l_fenetre || "-"} mm`, 0, 3);
        addRow("Dist. gauche", `${study.dist_gauche || "-"} mm`, 1, 3);
        addRow("Dist. droite", `${study.dist_droit || "-"} mm`, 2, 3);
        y += 5;
        addRow("Dist. plafond", `${study.dist_plafond || "-"} mm`, 0, 3);
        addRow("Dist. sol", `${study.dist_sol || "-"} mm`, 1, 3);
        y += 5;
      }
      y += 3;

      // ---- TRAVAUX COMPLÉMENTAIRES ----
      addSection("TRAVAUX COMPLÉMENTAIRES");
      const travaux = [];
      if (study.travaux.coffrage) travaux.push("Coffrage");
      if (study.travaux.creation_entretoise) travaux.push("Création entretoise");
      if (study.travaux.reprise_sol) travaux.push("Reprise sol");
      if (study.travaux.saignee_sol) travaux.push("Saignée sol");
      if (study.travaux.modif_plomberie) travaux.push("Modif. plomberie");
      if (study.travaux.depose_wc_ou_meuble) travaux.push("Dépose WC/meuble");
      if (study.travaux.depose_bidet) travaux.push("Dépose bidet");
      if (study.travaux.depose_douche_suppl) travaux.push("Dépose douche suppl.");
      if (study.travaux.depose_sanitaire) travaux.push("Dépose sanitaire");
      if (study.travaux.depl_machine) travaux.push("Dépl. machine");
      if (study.travaux.depl_prise) travaux.push("Dépl. prise");
      if (study.travaux.pompe_relevage) travaux.push("Pompe relevage");
      if (study.travaux.finition_haute) travaux.push("Finition haute");

      pdf.setFontSize(9);
      if (travaux.length > 0) {
        const travauxText = travaux.join(" • ");
        const lines = pdf.splitTextToSize(travauxText, pageW - margin * 2 - 4);
        pdf.text(lines, margin + 2, y);
        y += lines.length * 4 + 2;
      } else {
        pdf.setFont(undefined, "italic");
        pdf.text("Aucun travail complémentaire", margin + 2, y);
        y += 5;
      }

      if (study.travaux_autres && study.travaux_autres.trim()) {
        y += 2;
        pdf.setFont(undefined, "bold");
        pdf.text("Autres:", margin + 2, y);
        y += 4;
        pdf.setFont(undefined, "normal");
        const autresLines = pdf.splitTextToSize(study.travaux_autres, pageW - margin * 2 - 4);
        pdf.text(autresLines, margin + 2, y);
        y += autresLines.length * 4;
      }
      y += 5;

      // ---- SIGNATURES ----
      if (signatureClient || signatureInstaller) {
        if (y > pageH - 60) { pdf.addPage(); y = 15; }
        addSection("SIGNATURES");

        const sigW = 70, sigH = 25;
        if (signatureClient) {
          pdf.setFontSize(8);
          pdf.text("Client: " + study.client_nom + " " + study.client_prenom, margin, y);
          y += 3;
          pdf.addImage(signatureClient, "PNG", margin, y, sigW, sigH);
          pdf.text("Date: " + new Date().toLocaleDateString('fr-FR'), margin, y + sigH + 3);
        }
        if (signatureInstaller) {
          const sigX = signatureClient ? pageW / 2 : margin;
          const sigY = signatureClient ? y - 3 : y;
          pdf.setFontSize(8);
          pdf.text("Installateur: " + study.inst_nom + " " + study.inst_prenom, sigX, sigY);
          pdf.addImage(signatureInstaller, "PNG", sigX, sigY + 3, sigW, sigH);
          pdf.text("Date: " + new Date().toLocaleDateString('fr-FR'), sigX, sigY + sigH + 6);
        }
        y += sigH + 15;
      }

      // Footer page 1
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(7);
      pdf.text("Document généré automatiquement - Page 1", pageW / 2, pageH - 5, { align: "center" });

      // ========== PAGE 2: PLAN TECHNIQUE ==========
      pdf.addPage();

      // Switch to plan tab for visual feedback
      setTab("plan");
      window.scrollTo(0, 0);
      await waitPaint(300);

      // Force canvas redraw
      if (plan && plan.draw) {
        plan.draw(elements, preview, selectedId);
      }
      await waitPaint(300);

      // Expand canvas for capture
      const canvasWrap = planExportRef.current?.querySelector('.ir-canvas-wrap');
      const originalHeight = canvasWrap?.style.height;
      if (canvasWrap) {
        canvasWrap.style.height = '560px';
      }
      await waitPaint(200);
      if (plan && plan.draw) {
        plan.draw(elements, preview, selectedId);
      }
      await waitPaint(200);

      const canvasOptions = {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false
      };

      const c2 = await html2canvas(planExportRef.current, canvasOptions);
      const img2 = c2.toDataURL("image/png");

      // Restore height
      if (canvasWrap && originalHeight !== undefined) {
        canvasWrap.style.height = originalHeight || '';
      }

      // En-tête page 2
      pdf.setFillColor(14, 165, 165);
      pdf.rect(0, 0, pageW, 15, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont(undefined, "bold");
      pdf.text("PLAN TECHNIQUE INDICATIF", pageW / 2, 10, { align: "center" });

      // Image du plan
      const planY = 18;
      const planW = pageW - margin * 2;
      const planH = (c2.height / c2.width) * planW;
      const maxPlanH = pageH - planY - 15;

      if (planH > maxPlanH) {
        const scale = maxPlanH / planH;
        const scaledW = planW * scale;
        const xOffset = (pageW - scaledW) / 2;
        pdf.addImage(img2, "PNG", xOffset, planY, scaledW, maxPlanH, undefined, "FAST");
      } else {
        pdf.addImage(img2, "PNG", margin, planY, planW, planH, undefined, "FAST");
      }

      // Footer page 2
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(7);
      pdf.text("Document généré automatiquement - Page 2", pageW / 2, pageH - 5, { align: "center" });

      // ========== PAGES PHOTOS ==========
      let pageNum = 3;

      // Photos AVANT
      if (photosAvant.length > 0) {
        pdf.addPage();
        pdf.setFillColor(14, 165, 233);
        pdf.rect(0, 0, pageW, 15, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont(undefined, "bold");
        pdf.text("PHOTOS AVANT TRAVAUX", pageW / 2, 10, { align: "center" });

        let photoY = 20;
        for (const photo of photosAvant) {
          if (photoY > pageH - 80) {
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(7);
            pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
            pdf.addPage();
            pageNum++;
            photoY = 15;
          }
          const imgW = pageW - 40;
          const imgH = imgW * 0.75;
          try {
            pdf.addImage(photo.url, "JPEG", 20, photoY, imgW, imgH);
          } catch (e) {
            console.warn("Could not add photo:", e);
          }
          photoY += imgH + 10;
        }
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(7);
        pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
        pageNum++;
      }

      // Photos APRÈS
      if (photosApres.length > 0) {
        pdf.addPage();
        pdf.setFillColor(34, 197, 94);
        pdf.rect(0, 0, pageW, 15, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont(undefined, "bold");
        pdf.text("PHOTOS APRÈS TRAVAUX", pageW / 2, 10, { align: "center" });

        let photoY = 20;
        for (const photo of photosApres) {
          if (photoY > pageH - 80) {
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(7);
            pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
            pdf.addPage();
            pageNum++;
            photoY = 15;
          }
          const imgW = pageW - 40;
          const imgH = imgW * 0.75;
          try {
            pdf.addImage(photo.url, "JPEG", 20, photoY, imgW, imgH);
          } catch (e) {
            console.warn("Could not add photo:", e);
          }
          photoY += imgH + 10;
        }
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(7);
        pdf.text(`Document généré automatiquement - Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
      }

      // Télécharger
      const filename = `etude_${study.client_nom || 'client'}_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(filename);
      setTab(prevTab);
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("❌ Erreur lors de l'export PDF:\n" + (err.message || err));
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
      .ir-canvas-wrap { height: 560px; position: relative; }
      @media (max-width: 767px) { .ir-canvas-wrap { height: 400px; } }
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

      /* MOBILE TOOLBAR - Collapsible categories */
      .tool-categories {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-bottom: 4px;
      }
      .tool-categories::-webkit-scrollbar { display: none; }
      .tool-category-btn {
        padding: 8px 16px;
        border-radius: 20px;
        border: 2px solid #e2e8f0;
        background: #fff;
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        transition: all 0.2s;
        min-height: 40px;
      }
      .tool-category-btn.active {
        background: #0ea5a5;
        color: white;
        border-color: #0ea5a5;
      }

      /* Tool grid for mobile */
      .tool-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
        gap: 6px;
      }
      @media (min-width: 768px) {
        .tool-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      }
      .tool-btn {
        padding: 10px 8px;
        border-radius: 10px;
        border: 2px solid #e2e8f0;
        background: #fff;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        transition: all 0.15s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-height: 56px;
      }
      .tool-btn.active {
        background: #e0f2fe;
        border-color: #0ea5a5;
        color: #0ea5a5;
      }
      .tool-btn:active {
        transform: scale(0.95);
      }
      .tool-btn .tool-icon {
        font-size: 18px;
      }
      @media (min-width: 768px) {
        .tool-btn {
          flex-direction: row;
          padding: 8px 14px;
          min-height: 44px;
        }
        .tool-btn .tool-icon {
          font-size: 14px;
        }
      }

      /* Floating action buttons for mobile */
      .mobile-fab-container {
        position: fixed;
        bottom: 80px;
        right: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 100;
      }
      @media (min-width: 768px) {
        .mobile-fab-container { display: none; }
      }
      .fab-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: transform 0.2s;
      }
      .fab-btn:active { transform: scale(0.9); }
      .fab-btn.primary { background: #0ea5a5; color: white; }
      .fab-btn.danger { background: #ef4444; color: white; }
      .fab-btn.secondary { background: #fff; color: #475569; }

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
        width: 32px;
        height: 32px;
        min-height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
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
        min-height: 100px;
      }
      .photo-add-btn:hover, .photo-add-btn:active {
        border-color: #0ea5a5;
        background: #e0f2fe;
      }
      .photo-add-btn svg {
        width: 40px;
        height: 40px;
        stroke: #64748b;
      }
      @media (max-width: 640px) {
        .photo-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Improved signature canvas for mobile */
      .signature-canvas-wrap {
        border: 2px solid #cbd5e1;
        border-radius: 12px;
        background: #fff;
        position: relative;
        overflow: hidden;
      }
      .signature-canvas-wrap canvas {
        display: block;
        width: 100%;
        height: auto;
        min-height: 120px;
        touch-action: none;
      }
      .signature-clear-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 8px 14px;
        border-radius: 8px;
        border: 2px solid #ef4444;
        background: #fff;
        color: #ef4444;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      /* Better tabs for mobile */
      .tab-container {
        display: flex;
        gap: 0;
        margin-bottom: 16px;
        background: #f1f5f9;
        border-radius: 12px;
        padding: 4px;
      }
      .tab-btn {
        flex: 1;
        padding: 12px 16px;
        border-radius: 10px;
        border: none;
        background: transparent;
        font-weight: 600;
        font-size: 14px;
        color: #64748b;
        transition: all 0.2s;
        min-height: 48px;
      }
      .tab-btn.active {
        background: #fff;
        color: #0ea5a5;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
      <div className="tab-container">
        <button className={`tab-btn ${tab === 'etude' ? 'active' : ''}`} onClick={() => setTab("etude")}>
          📋 Étude
        </button>
        <button className={`tab-btn ${tab === 'plan' ? 'active' : ''}`} onClick={() => setTab("plan")}>
          📐 Plan
        </button>
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
      <div style={{ display: tab === "plan" ? "block" : "none" }}>
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

          {/* TEMPLATES */}
          <Section title="Templates de plan">
            <Small style={{ marginBottom: 8, display: 'block' }}>Cliquez sur un template pour charger une configuration prédéfinie</Small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {PLAN_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => loadTemplate(template.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '2px solid #e2e8f0',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    minWidth: 150,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#0ea5a5';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(14,165,165,0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                    {template.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* OUTILS - Interface simplifiée mobile */}
          <Section title="Outils">
            {/* Barre d'outils principale - 5 boutons essentiels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <button
                onClick={() => setTool('select')}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: tool === 'select' ? '3px solid #0ea5a5' : '2px solid #e2e8f0',
                  background: tool === 'select' ? '#e0f2fe' : '#fff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                👆
              </button>
              <button
                onClick={() => setTool('rect')}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: tool === 'rect' ? '3px solid #0ea5a5' : '2px solid #e2e8f0',
                  background: tool === 'rect' ? '#e0f2fe' : '#fff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ⬜
              </button>
              <button
                onClick={() => setTool('shower')}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: tool === 'shower' ? '3px solid #0ea5a5' : '2px solid #e2e8f0',
                  background: tool === 'shower' ? '#e0f2fe' : '#fff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                🚿
              </button>
              <button
                onClick={() => setTool('dim')}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: tool === 'dim' ? '3px solid #0ea5a5' : '2px solid #e2e8f0',
                  background: tool === 'dim' ? '#e0f2fe' : '#fff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                📏
              </button>
              <button
                onClick={() => setToolCategory(toolCategory === 'more' ? 'hide' : 'more')}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: toolCategory === 'more' ? '#fef3c7' : '#fff',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                {toolCategory === 'more' ? '✕' : '＋'}
              </button>
            </div>

            {/* Panneau étendu */}
            {toolCategory === 'more' && (
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid #e2e8f0'
              }}>
                {/* Symboles en grille 5x2 */}
                <div style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Symboles sanitaires
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {[
                    { t: 'mixer', e: '🔵' },
                    { t: 'seat', e: '💺' },
                    { t: 'bar', e: '➖' },
                    { t: 'door', e: '🚪' },
                    { t: 'window', e: '🪟' },
                    { t: 'wc', e: '🚽' },
                    { t: 'sink', e: '🚰' },
                    { t: 'drain', e: '⚫' },
                    { t: 'towelrack', e: '🧴' },
                    { t: 'text', e: '📝' }
                  ].map(item => (
                    <button
                      key={item.t}
                      onClick={() => setTool(item.t)}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: tool === item.t ? '3px solid #0ea5a5' : '2px solid #cbd5e1',
                        background: tool === item.t ? '#e0f2fe' : '#fff',
                        fontSize: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      {item.e}
                    </button>
                  ))}
                </div>

                {/* Options snap/ortho + undo/redo */}
                <div style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Options
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSnap(s => !s)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      background: snap ? '#dcfce7' : '#fff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🧲 {snap ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setOrtho(o => !o)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      background: ortho ? '#dcfce7' : '#fff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📐 {ortho ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '18px',
                      cursor: canUndo ? 'pointer' : 'not-allowed',
                      opacity: canUndo ? 1 : 0.4
                    }}
                  >
                    ↩️
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '18px',
                      cursor: canRedo ? 'pointer' : 'not-allowed',
                      opacity: canRedo ? 1 : 0.4
                    }}
                  >
                    ↪️
                  </button>
                </div>
              </div>
            )}

            {/* Barre d'actions sur sélection */}
            {selectedId && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '12px',
                border: '2px solid #f59e0b'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                  ✓ Élément sélectionné
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  {canRotate() && (
                    <button
                      onClick={rotateSelected}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '2px solid #0ea5a5',
                        background: '#fff',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0ea5a5',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Pivoter
                    </button>
                  )}
                  <button
                    onClick={delSelected}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '2px solid #ef4444',
                      background: '#fee2e2',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#dc2626',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Suppr.
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* ZONE EXPORTABLE - Canvas en premier pour mobile */}
          <div ref={planExportRef}>
            <div style={{ border: "1px solid #94a3b8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <div className="ir-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="ir-grid"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => { setStartPt(null); setPreview(null); }}
                  onDoubleClick={onDoubleClick}
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

          {/* VALIDATION - Barre compacte en bas */}
          <div style={{
            marginTop: '12px',
            borderRadius: '12px',
            border: `2px solid ${planValidation.score >= 70 ? '#86efac' : planValidation.score >= 40 ? '#fde68a' : '#fecaca'}`,
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: planValidation.score >= 70 ? '#dcfce7' : planValidation.score >= 40 ? '#fef3c7' : '#fee2e2',
            }}>
              {/* Barre de progression circulaire */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `conic-gradient(${planValidation.score >= 70 ? '#22c55e' : planValidation.score >= 40 ? '#f59e0b' : '#ef4444'} ${planValidation.score * 3.6}deg, #e2e8f0 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: planValidation.score >= 70 ? '#166534' : planValidation.score >= 40 ? '#92400e' : '#991b1b'
                }}>
                  {planValidation.score}%
                </div>
              </div>

              {/* Status */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: planValidation.score >= 70 ? '#166534' : planValidation.score >= 40 ? '#92400e' : '#991b1b' }}>
                  {planValidation.score >= 70 ? '✅ Plan complet' : planValidation.score >= 40 ? '⚠️ À compléter' : '❌ Éléments requis'}
                </div>
                {planValidation.errors.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '2px' }}>
                    {planValidation.errors[0]}
                  </div>
                )}
                {planValidation.errors.length === 0 && planValidation.warnings.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>
                    {planValidation.warnings[0]}
                  </div>
                )}
              </div>

              {/* Bouton reset */}
              <button
                onClick={resetPlan}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '2px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                🔄
              </button>
            </div>

            {/* Conseils supplémentaires (collapsible) */}
            {(planValidation.warnings.length > 0 || planValidation.tips.length > 0) && planValidation.score < 100 && (
              <div style={{
                padding: '8px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                fontSize: '12px'
              }}>
                {planValidation.warnings.length > 0 && (
                  <div style={{ color: '#92400e', marginBottom: planValidation.tips.length > 0 ? '4px' : 0 }}>
                    <strong>Important:</strong> {planValidation.warnings.join(' • ')}
                  </div>
                )}
                {planValidation.tips.length > 0 && (
                  <div style={{ color: '#64748b' }}>
                    <strong>Conseils:</strong> {planValidation.tips.join(' • ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
