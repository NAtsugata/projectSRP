// src/components/ir-shower/planEditor/PlanEditorModal.jsx
// Modal qui orchestre l'éditeur 2D et le viewer 3D.

import React, { useState, useCallback } from 'react';
import PlanEditor2D from './PlanEditor2D';
import PlanViewer3D from './PlanViewer3D';
import { createEmptyPlan, normalizePlan } from '../../../lib/planModel';

export default function PlanEditorModal({ initialPlan, onSave, onClose }) {
  const [plan, setPlan] = useState(() => normalizePlan(initialPlan) || createEmptyPlan());
  const [mode, setMode] = useState('2d'); // '2d' | '3d'

  const handleClose = useCallback(() => {
    if (onSave) onSave(plan);
    onClose?.();
  }, [plan, onSave, onClose]);

  if (mode === '3d') {
    return (
      <PlanViewer3D
        plan={plan}
        onClose={handleClose}
        onBackTo2D={() => setMode('2d')}
      />
    );
  }

  return (
    <PlanEditor2D
      plan={plan}
      onChange={setPlan}
      onOpen3D={() => setMode('3d')}
      onClose={handleClose}
    />
  );
}
