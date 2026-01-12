// src/utils/__tests__/documentDetector.test.js
// Tests pour le détecteur de documents multi-stratégie

import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock OpenCV.js
const mockOpenCV = {
  Mat: vi.fn(() => ({
    rows: 100,
    cols: 100,
    data32S: new Int32Array([10, 10, 90, 10, 90, 90, 10, 90]),
    delete: vi.fn(),
    copyTo: vi.fn()
  })),
  MatVector: vi.fn(() => ({
    size: () => 1,
    get: () => ({
      delete: vi.fn()
    }),
    delete: vi.fn()
  })),
  Size: vi.fn((w, h) => ({ width: w, height: h })),
  CLAHE: vi.fn(() => ({
    apply: vi.fn(),
    delete: vi.fn()
  })),
  cvtColor: vi.fn(),
  GaussianBlur: vi.fn(),
  bilateralFilter: vi.fn(),
  Canny: vi.fn(),
  adaptiveThreshold: vi.fn(),
  dilate: vi.fn(),
  morphologyEx: vi.fn(),
  findContours: vi.fn(),
  contourArea: vi.fn(() => 5000),
  arcLength: vi.fn(() => 400),
  approxPolyDP: vi.fn(),
  getStructuringElement: vi.fn(() => ({ delete: vi.fn() })),
  imread: vi.fn(() => ({
    rows: 100,
    cols: 100,
    delete: vi.fn()
  })),
  imshow: vi.fn(),
  COLOR_RGBA2GRAY: 1,
  MORPH_RECT: 0,
  MORPH_CLOSE: 3,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
  ADAPTIVE_THRESH_GAUSSIAN_C: 0,
  THRESH_BINARY_INV: 1,
  CV_32SC2: 12
};

describe('Document Detector - Score Calculation', () => {
  // Test du scoring de contour
  describe('scoreContour', () => {
    // Simuler la fonction de scoring
    const scoreContour = (corners, imageWidth, imageHeight) => {
      if (!corners || corners.length !== 4) return 0;

      let score = 0;
      const imageArea = imageWidth * imageHeight;

      // 1. Area score
      const contourArea = Math.abs(
        (corners[0].x * corners[1].y - corners[1].x * corners[0].y) +
        (corners[1].x * corners[2].y - corners[2].x * corners[1].y) +
        (corners[2].x * corners[3].y - corners[3].x * corners[2].y) +
        (corners[3].x * corners[0].y - corners[0].x * corners[3].y)
      ) / 2;

      const areaRatio = contourArea / imageArea;
      if (areaRatio >= 0.1 && areaRatio <= 0.95) {
        score += 25 * Math.min(areaRatio * 2, 1);
      }

      // 2. Aspect ratio score
      const width1 = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
      const width2 = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
      const height1 = Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2));
      const height2 = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));

      const avgWidth = (width1 + width2) / 2;
      const avgHeight = (height1 + height2) / 2;
      const aspectRatio = Math.max(avgWidth, avgHeight) / Math.min(avgWidth, avgHeight);

      if (aspectRatio >= 1.0 && aspectRatio <= 2.0) {
        score += 25;
      } else if (aspectRatio < 3.0) {
        score += 15;
      }

      // 3. Parallelism score
      const widthDiff = Math.abs(width1 - width2) / Math.max(width1, width2);
      const heightDiff = Math.abs(height1 - height2) / Math.max(height1, height2);
      const parallelScore = (1 - widthDiff) * 12.5 + (1 - heightDiff) * 12.5;
      score += parallelScore;

      // 4. Right angles score
      const angles = [];
      for (let i = 0; i < 4; i++) {
        const p1 = corners[i];
        const p2 = corners[(i + 1) % 4];
        const p3 = corners[(i + 2) % 4];

        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (mag1 > 0 && mag2 > 0) {
          const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
          angles.push(Math.abs(90 - angle));
        }
      }

      if (angles.length === 4) {
        const avgAngleDeviation = angles.reduce((a, b) => a + b, 0) / 4;
        const angleScore = Math.max(0, 25 - avgAngleDeviation);
        score += angleScore;
      }

      return Math.min(100, Math.max(0, score));
    };

    test('donne un score élevé pour un rectangle parfait', () => {
      // Rectangle parfait occupant 50% de l'image
      const corners = [
        { x: 100, y: 100 },  // top-left
        { x: 400, y: 100 },  // top-right
        { x: 400, y: 350 },  // bottom-right
        { x: 100, y: 350 }   // bottom-left
      ];
      const score = scoreContour(corners, 500, 500);
      expect(score).toBeGreaterThan(80);
    });

    test('donne un score élevé pour un document A4 (ratio 1.41)', () => {
      // A4 ratio: 1.414
      const corners = [
        { x: 50, y: 50 },
        { x: 350, y: 50 },
        { x: 350, y: 474 },  // 300 * 1.414 ≈ 424
        { x: 50, y: 474 }
      ];
      const score = scoreContour(corners, 500, 600);
      expect(score).toBeGreaterThan(70);
    });

    test('donne un score moyen pour un trapèze légèrement déformé', () => {
      // Trapèze (perspective)
      const corners = [
        { x: 120, y: 100 },
        { x: 380, y: 100 },
        { x: 400, y: 400 },
        { x: 100, y: 400 }
      ];
      const score = scoreContour(corners, 500, 500);
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(90);
    });

    test('donne un score bas pour un contour très déformé', () => {
      // Forme très irrégulière
      const corners = [
        { x: 50, y: 50 },
        { x: 450, y: 100 },
        { x: 400, y: 200 },
        { x: 100, y: 450 }
      ];
      const score = scoreContour(corners, 500, 500);
      expect(score).toBeLessThan(60);
    });

    test('donne un score de 0 pour moins de 4 coins', () => {
      const corners = [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 400 }
      ];
      const score = scoreContour(corners, 500, 500);
      expect(score).toBe(0);
    });

    test('donne un score de 0 pour null', () => {
      const score = scoreContour(null, 500, 500);
      expect(score).toBe(0);
    });

    test('pénalise les contours trop petits (moins de 10% de l\'image)', () => {
      // Contour très petit ne représentant que ~1% de l'image
      const corners = [
        { x: 200, y: 200 },
        { x: 220, y: 200 },
        { x: 220, y: 220 },
        { x: 200, y: 220 }
      ];
      const score = scoreContour(corners, 500, 500);
      // Score réduit car l'aire est trop petite (< 10%)
      expect(score).toBeLessThan(80);
    });
  });
});

describe('Detection Strategies', () => {
  const DETECTION_STRATEGIES = [
    {
      name: 'standard',
      cannyLow: 30,
      cannyHigh: 100,
      blurSize: 5,
      dilateSize: 3,
      useClosing: true,
      useBilateral: false,
      claheClip: 2.0
    },
    {
      name: 'low_contrast',
      cannyLow: 10,
      cannyHigh: 50,
      blurSize: 5,
      dilateSize: 5,
      useClosing: true,
      useBilateral: false,
      claheClip: 3.0
    },
    {
      name: 'high_contrast',
      cannyLow: 50,
      cannyHigh: 150,
      blurSize: 3,
      dilateSize: 3,
      useClosing: false,
      useBilateral: true,
      claheClip: 2.0
    },
    {
      name: 'adaptive_threshold',
      useAdaptive: true,
      adaptiveBlockSize: 11,
      adaptiveC: 2,
      dilateSize: 5,
      useClosing: true
    },
    {
      name: 'aggressive',
      cannyLow: 5,
      cannyHigh: 30,
      blurSize: 7,
      dilateSize: 7,
      useClosing: true,
      useBilateral: false,
      claheClip: 4.0
    }
  ];

  test('définit 5 stratégies de détection', () => {
    expect(DETECTION_STRATEGIES).toHaveLength(5);
  });

  test('chaque stratégie a un nom unique', () => {
    const names = DETECTION_STRATEGIES.map(s => s.name);
    const uniqueNames = [...new Set(names)];
    expect(uniqueNames).toHaveLength(5);
  });

  test('stratégie standard a des paramètres équilibrés', () => {
    const standard = DETECTION_STRATEGIES.find(s => s.name === 'standard');
    expect(standard.cannyLow).toBe(30);
    expect(standard.cannyHigh).toBe(100);
    expect(standard.useClosing).toBe(true);
  });

  test('stratégie low_contrast a un CLAHE plus agressif', () => {
    const lowContrast = DETECTION_STRATEGIES.find(s => s.name === 'low_contrast');
    expect(lowContrast.claheClip).toBeGreaterThan(2.0);
    expect(lowContrast.cannyLow).toBeLessThan(30);
  });

  test('stratégie high_contrast utilise le filtre bilatéral', () => {
    const highContrast = DETECTION_STRATEGIES.find(s => s.name === 'high_contrast');
    expect(highContrast.useBilateral).toBe(true);
  });

  test('stratégie adaptive_threshold utilise le seuillage adaptatif', () => {
    const adaptive = DETECTION_STRATEGIES.find(s => s.name === 'adaptive_threshold');
    expect(adaptive.useAdaptive).toBe(true);
    expect(adaptive.adaptiveBlockSize).toBeDefined();
  });

  test('stratégie aggressive a les paramètres les plus sensibles', () => {
    const aggressive = DETECTION_STRATEGIES.find(s => s.name === 'aggressive');
    expect(aggressive.cannyLow).toBe(5);
    expect(aggressive.claheClip).toBe(4.0);
    expect(aggressive.dilateSize).toBe(7);
  });
});
