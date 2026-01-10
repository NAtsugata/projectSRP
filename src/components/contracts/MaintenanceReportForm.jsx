import React, { useState, useRef } from 'react';
import './MaintenanceReportForm.css';

// Types d'intervention
const INTERVENTION_TYPES = {
    entretien_annuel: 'Entretien annuel',
    entretien_semestriel: 'Entretien semestriel',
    depannage: 'Dépannage',
    mise_en_service: 'Mise en service',
    controle: 'Contrôle/Vérification',
    remplacement_piece: 'Remplacement pièce',
    autre: 'Autre'
};

// Actions d'entretien courantes par type d'équipement
const MAINTENANCE_ACTIONS = {
    chaudiere: [
        'Vérification étanchéité circuit gaz',
        'Nettoyage brûleur',
        'Contrôle veilleuse/allumage',
        'Vérification ventilation',
        'Contrôle évacuation fumées',
        'Mesure CO/CO2',
        'Ramonage conduit',
        'Contrôle pression eau',
        'Purge radiateurs',
        'Vérification sécurités'
    ],
    climatisation: [
        'Nettoyage filtres',
        'Vérification fluide frigorigène',
        'Contrôle condenseur',
        'Nettoyage évaporateur',
        'Vérification drainage',
        'Contrôle électrique',
        'Test télécommande'
    ],
    pompe_chaleur: [
        'Vérification circuit frigorifique',
        'Nettoyage échangeur',
        'Contrôle pressions',
        'Vérification dégivrage',
        'Test des sécurités'
    ],
    cumulus: [
        'Détartrage cuve',
        'Vérification anode',
        'Contrôle thermostat',
        'Test groupe sécurité',
        'Vérification isolation'
    ],
    default: [
        'Contrôle visuel',
        'Nettoyage général',
        'Test de fonctionnement',
        'Vérification sécurités'
    ]
};

// Mesures spécifiques par type d'équipement
const EQUIPMENT_MEASUREMENTS = {
    chaudiere: {
        label: '🔥 Mesures Chaudière',
        fields: [
            { name: 'co_reading', label: 'Taux de CO (ppm)', type: 'number', placeholder: 'Ex: 15' },
            { name: 'co2_reading', label: 'Taux de CO2 (%)', type: 'number', step: '0.1', placeholder: 'Ex: 9.5' },
            { name: 'combustion_efficiency', label: 'Rendement combustion (%)', type: 'number', step: '0.1', placeholder: 'Ex: 92.5' },
            { name: 'flue_temp', label: 'Température fumées (°C)', type: 'number', placeholder: 'Ex: 180' },
            { name: 'water_pressure', label: 'Pression eau (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 1.5' }
        ]
    },
    climatisation: {
        label: '❄️ Mesures Climatisation',
        fields: [
            { name: 'refrigerant_pressure_hp', label: 'Pression HP (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 25' },
            { name: 'refrigerant_pressure_bp', label: 'Pression BP (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
            { name: 'superheat', label: 'Surchauffe (°C)', type: 'number', step: '0.1', placeholder: 'Ex: 8' },
            { name: 'subcooling', label: 'Sous-refroidissement (°C)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
            { name: 'filter_condition', label: 'État des filtres', type: 'select', options: ['Propre', 'Légèrement sale', 'Sale - nettoyé', 'Remplacé'] }
        ]
    },
    pompe_chaleur: {
        label: '🌡️ Mesures PAC Air/Eau',
        fields: [
            { name: 'refrigerant_pressure_hp', label: 'Pression HP (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 25' },
            { name: 'refrigerant_pressure_bp', label: 'Pression BP (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
            { name: 'water_temp_out', label: 'Temp. eau sortie (°C)', type: 'number', step: '0.1', placeholder: 'Ex: 45' },
            { name: 'water_temp_in', label: 'Temp. eau entrée (°C)', type: 'number', step: '0.1', placeholder: 'Ex: 40' },
            { name: 'defrost_ok', label: 'Dégivrage fonctionnel', type: 'select', options: ['Oui', 'Non', 'Non testé'] },
            { name: 'cop_estimated', label: 'COP estimé', type: 'number', step: '0.1', placeholder: 'Ex: 4.2' }
        ]
    },
    cumulus: {
        label: '🚿 Mesures Chauffe-eau',
        fields: [
            { name: 'water_temp', label: 'Température eau (°C)', type: 'number', placeholder: 'Ex: 55' },
            { name: 'anode_condition', label: 'État anode', type: 'select', options: ['Bon état', 'Usée 50%', 'À remplacer', 'Remplacée'] },
            { name: 'scale_level', label: 'Niveau de tartre', type: 'select', options: ['Faible', 'Moyen', 'Important', 'Détartré'] }
        ]
    },
    vmc: {
        label: '💨 Mesures VMC',
        fields: [
            { name: 'airflow_rate', label: 'Débit d\'air (m³/h)', type: 'number', placeholder: 'Ex: 150' },
            { name: 'filter_condition', label: 'État des filtres', type: 'select', options: ['Propre', 'Légèrement sale', 'Sale - nettoyé', 'Remplacé'] },
            { name: 'noise_level', label: 'Niveau sonore', type: 'select', options: ['Normal', 'Légèrement bruyant', 'Bruyant', 'Très bruyant'] }
        ]
    }
};

function MaintenanceReportForm({
    isOpen,
    onClose,
    onSubmit,
    contract,
    equipment = [],
    visit = null,
    technician = '',
    isSubmitting = false
}) {
    const [formData, setFormData] = useState({
        intervention_type: 'entretien_annuel',
        intervention_date: new Date().toISOString().split('T')[0],
        equipment_ids: [],
        actions_performed: [],
        custom_actions: '',
        parts_replaced: '',
        observations: '',
        recommendations: '',
        next_visit_notes: '',
        // Mesures chaudière
        co_reading: '',
        co2_reading: '',
        combustion_efficiency: '',
        flue_temp: '',
        water_pressure: '',
        // Mesures clim/PAC
        refrigerant_pressure_hp: '',
        refrigerant_pressure_bp: '',
        superheat: '',
        subcooling: '',
        water_temp_out: '',
        water_temp_in: '',
        defrost_ok: '',
        cop_estimated: '',
        // Mesures cumulus
        water_temp: '',
        anode_condition: '',
        scale_level: '',
        // Mesures VMC
        airflow_rate: '',
        noise_level: '',
        // Commun
        filter_condition: '',
        client_present: true,
        client_signature: null
    });

    const [activeStep, setActiveStep] = useState(1);
    const signatureCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEquipmentToggle = (eqId) => {
        setFormData(prev => ({
            ...prev,
            equipment_ids: prev.equipment_ids.includes(eqId)
                ? prev.equipment_ids.filter(id => id !== eqId)
                : [...prev.equipment_ids, eqId]
        }));
    };

    const handleActionToggle = (action) => {
        setFormData(prev => ({
            ...prev,
            actions_performed: prev.actions_performed.includes(action)
                ? prev.actions_performed.filter(a => a !== action)
                : [...prev.actions_performed, action]
        }));
    };

    // Signature canvas handlers
    const startDrawing = (e) => {
        setIsDrawing(true);
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');

        // Configure signature style
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getSignatureDataUrl = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return null;

        // Create a temporary canvas to invert the colors (White -> Black) for the PDF
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');

        // 1. Draw the original signature (white on transparent)
        ctx.drawImage(canvas, 0, 0);

        // 2. Change the color to black using composite operation
        // 'source-in' keeps the alpha of the drawing but replaces the color
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        return tempCanvas.toDataURL('image/png');
    };

    // Get relevant actions based on selected equipment
    const getRelevantActions = () => {
        const selectedEquipment = equipment.filter(eq => formData.equipment_ids.includes(eq.id));
        const allActions = new Set();

        selectedEquipment.forEach(eq => {
            const typeActions = MAINTENANCE_ACTIONS[eq.equipment_type] || MAINTENANCE_ACTIONS.default;
            typeActions.forEach(action => allActions.add(action));
        });

        if (allActions.size === 0) {
            return MAINTENANCE_ACTIONS.default;
        }

        return Array.from(allActions);
    };

    // Get relevant measurements based on selected equipment types
    const getRelevantMeasurements = () => {
        const selectedEquipment = equipment.filter(eq => formData.equipment_ids.includes(eq.id));
        const measurementSections = [];

        // Get unique equipment types
        const uniqueTypes = [...new Set(selectedEquipment.map(eq => eq.equipment_type))];

        uniqueTypes.forEach(type => {
            const config = EQUIPMENT_MEASUREMENTS[type];
            if (config) {
                measurementSections.push({
                    type,
                    label: config.label,
                    fields: config.fields
                });
            }
        });

        return measurementSections;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const reportData = {
            ...formData,
            client_signature: formData.client_present ? getSignatureDataUrl() : null,
            contract_id: contract?.id,
            visit_id: visit?.id,
            technician_name: technician,
            created_at: new Date().toISOString()
        };

        onSubmit(reportData);
    };

    const nextStep = () => setActiveStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setActiveStep(prev => Math.max(prev - 1, 1));

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📋 Rapport d'Entretien</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Progress Steps */}
                <div className="report-steps">
                    <div className={`step ${activeStep >= 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}>
                        <span className="step-num">1</span>
                        <span className="step-label">Infos</span>
                    </div>
                    <div className={`step ${activeStep >= 2 ? 'active' : ''} ${activeStep > 2 ? 'completed' : ''}`}>
                        <span className="step-num">2</span>
                        <span className="step-label">Actions</span>
                    </div>
                    <div className={`step ${activeStep >= 3 ? 'active' : ''} ${activeStep > 3 ? 'completed' : ''}`}>
                        <span className="step-num">3</span>
                        <span className="step-label">Mesures</span>
                    </div>
                    <div className={`step ${activeStep >= 4 ? 'active' : ''}`}>
                        <span className="step-num">4</span>
                        <span className="step-label">Signature</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Step 1: Basic Info */}
                        {activeStep === 1 && (
                            <div className="report-step-content">
                                <h3>Informations générales</h3>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Type d'intervention *</label>
                                        <select
                                            name="intervention_type"
                                            value={formData.intervention_type}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            {Object.entries(INTERVENTION_TYPES).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Date d'intervention *</label>
                                        <input
                                            type="date"
                                            name="intervention_date"
                                            value={formData.intervention_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Équipements concernés *</label>
                                    <div className="equipment-checkboxes">
                                        {equipment.length === 0 ? (
                                            <p className="no-equipment">Aucun équipement enregistré</p>
                                        ) : (
                                            equipment.map(eq => (
                                                <label key={eq.id} className="checkbox-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.equipment_ids.includes(eq.id)}
                                                        onChange={() => handleEquipmentToggle(eq.id)}
                                                    />
                                                    <span>{eq.equipment_type} {eq.brand && `- ${eq.brand}`} {eq.model && eq.model}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="checkbox-item">
                                        <input
                                            type="checkbox"
                                            name="client_present"
                                            checked={formData.client_present}
                                            onChange={handleInputChange}
                                        />
                                        <span>Client présent lors de l'intervention</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Actions Performed */}
                        {activeStep === 2 && (
                            <div className="report-step-content">
                                <h3>Actions réalisées</h3>

                                <div className="form-group">
                                    <label>Cochez les actions effectuées :</label>
                                    <div className="actions-checkboxes">
                                        {getRelevantActions().map(action => (
                                            <label key={action} className="checkbox-item">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.actions_performed.includes(action)}
                                                    onChange={() => handleActionToggle(action)}
                                                />
                                                <span>{action}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Autres actions (séparer par virgule)</label>
                                    <input
                                        type="text"
                                        name="custom_actions"
                                        value={formData.custom_actions}
                                        onChange={handleInputChange}
                                        placeholder="Action 1, Action 2..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Pièces remplacées</label>
                                    <textarea
                                        name="parts_replaced"
                                        value={formData.parts_replaced}
                                        onChange={handleInputChange}
                                        placeholder="Liste des pièces remplacées..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Measurements & Observations */}
                        {activeStep === 3 && (
                            <div className="report-step-content">
                                <h3>Mesures & Observations</h3>

                                {/* Dynamic measurement sections based on equipment types */}
                                {getRelevantMeasurements().length > 0 ? (
                                    getRelevantMeasurements().map((section) => (
                                        <div key={section.type} className="measurement-section">
                                            <h4>{section.label}</h4>
                                            <div className="form-row measurements-grid">
                                                {section.fields.map((field) => (
                                                    <div key={field.name} className="form-group">
                                                        <label>{field.label}</label>
                                                        {field.type === 'select' ? (
                                                            <select
                                                                name={field.name}
                                                                value={formData[field.name] || ''}
                                                                onChange={handleInputChange}
                                                            >
                                                                <option value="">-- Sélectionner --</option>
                                                                {field.options.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type={field.type}
                                                                step={field.step}
                                                                name={field.name}
                                                                value={formData[field.name] || ''}
                                                                onChange={handleInputChange}
                                                                placeholder={field.placeholder}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-measurements-notice">
                                        <p>⚠️ Sélectionnez des équipements à l'étape 1 pour afficher les mesures spécifiques</p>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Observations</label>
                                    <textarea
                                        name="observations"
                                        value={formData.observations}
                                        onChange={handleInputChange}
                                        placeholder="État général, points d'attention..."
                                        rows={3}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Recommandations</label>
                                    <textarea
                                        name="recommendations"
                                        value={formData.recommendations}
                                        onChange={handleInputChange}
                                        placeholder="Travaux à prévoir, conseils..."
                                        rows={3}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Notes pour la prochaine visite</label>
                                    <textarea
                                        name="next_visit_notes"
                                        value={formData.next_visit_notes}
                                        onChange={handleInputChange}
                                        placeholder="Rappels pour le prochain passage..."
                                        rows={2}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Signature */}
                        {activeStep === 4 && (
                            <div className="report-step-content">
                                <h3>Validation & Signature</h3>

                                {/* Summary */}
                                <div className="report-summary">
                                    <div className="summary-item">
                                        <span className="summary-label">Type:</span>
                                        <span>{INTERVENTION_TYPES[formData.intervention_type]}</span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Date:</span>
                                        <span>{formData.intervention_date}</span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Actions:</span>
                                        <span>{formData.actions_performed.length} action(s)</span>
                                    </div>
                                </div>

                                {formData.client_present && (
                                    <div className="signature-section">
                                        <label>Signature du client</label>
                                        <div className="signature-container">
                                            <canvas
                                                ref={signatureCanvasRef}
                                                width={350}
                                                height={150}
                                                className="signature-canvas"
                                                onMouseDown={startDrawing}
                                                onMouseMove={draw}
                                                onMouseUp={stopDrawing}
                                                onMouseLeave={stopDrawing}
                                                onTouchStart={startDrawing}
                                                onTouchMove={draw}
                                                onTouchEnd={stopDrawing}
                                            />
                                            <button
                                                type="button"
                                                className="btn-clear-signature"
                                                onClick={clearSignature}
                                            >
                                                Effacer
                                            </button>
                                        </div>
                                        <p className="signature-hint">Dessinez la signature dans le cadre ci-dessus</p>
                                    </div>
                                )}

                                {!formData.client_present && (
                                    <div className="no-signature-notice">
                                        <p>📝 Client absent - Le rapport sera généré sans signature</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer report-footer">
                        {activeStep > 1 && (
                            <button type="button" className="btn-secondary" onClick={prevStep}>
                                ← Précédent
                            </button>
                        )}

                        <div className="footer-spacer"></div>

                        {activeStep < 4 ? (
                            <button type="button" className="btn-primary" onClick={nextStep}>
                                Suivant →
                            </button>
                        ) : (
                            <button type="submit" className="btn-success" disabled={isSubmitting}>
                                {isSubmitting ? 'Génération...' : '✅ Valider et Générer PDF'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export { INTERVENTION_TYPES, MAINTENANCE_ACTIONS };
export default MaintenanceReportForm;
