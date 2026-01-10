import React, { useState, useEffect } from 'react';
import './EquipmentForm.css';

const EQUIPMENT_TYPES = {
    chaudiere: 'Chaudière',
    climatisation: 'Climatisation',
    pompe_chaleur: 'Pompe à chaleur',
    cumulus: 'Cumulus / Chauffe-eau',
    vmc: 'VMC',
    adoucisseur: 'Adoucisseur',
    chauffe_eau_thermodynamique: 'Chauffe-eau thermodynamique',
    radiateur: 'Radiateur',
    plancher_chauffant: 'Plancher chauffant',
    autre: 'Autre'
};

const EQUIPMENT_CONDITIONS = {
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Mauvais',
    needs_replacement: 'À remplacer'
};

const INITIAL_FORM = {
    equipment_type: 'chaudiere',
    brand: '',
    model: '',
    serial_number: '',
    installation_date: '',
    warranty_end_date: '',
    location: '',
    condition: 'good',
    notes: ''
};

function EquipmentForm({
    isOpen,
    onClose,
    onSubmit,
    editingEquipment = null,
    isSubmitting = false
}) {
    const [formData, setFormData] = useState(INITIAL_FORM);

    useEffect(() => {
        if (editingEquipment) {
            setFormData({
                equipment_type: editingEquipment.equipment_type || 'autre',
                brand: editingEquipment.brand || '',
                model: editingEquipment.model || '',
                serial_number: editingEquipment.serial_number || '',
                installation_date: editingEquipment.installation_date || '',
                warranty_end_date: editingEquipment.warranty_end_date || '',
                location: editingEquipment.location || '',
                condition: editingEquipment.condition || 'good',
                notes: editingEquipment.notes || ''
            });
        } else {
            setFormData(INITIAL_FORM);
        }
    }, [editingEquipment, isOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Sanitize data
        const sanitizedData = {
            ...formData,
            brand: formData.brand?.trim() || null,
            model: formData.model?.trim() || null,
            serial_number: formData.serial_number?.trim() || null,
            installation_date: formData.installation_date || null,
            warranty_end_date: formData.warranty_end_date || null,
            location: formData.location?.trim() || null,
            notes: formData.notes?.trim() || null
        };

        onSubmit(sanitizedData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content equipment-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingEquipment ? '✏️ Modifier l\'équipement' : '➕ Ajouter un équipement'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Type et Marque */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Type d'équipement *</label>
                                <select
                                    name="equipment_type"
                                    value={formData.equipment_type}
                                    onChange={handleInputChange}
                                    required
                                >
                                    {Object.entries(EQUIPMENT_TYPES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Marque</label>
                                <input
                                    type="text"
                                    name="brand"
                                    value={formData.brand}
                                    onChange={handleInputChange}
                                    placeholder="Ex: Saunier Duval"
                                />
                            </div>
                        </div>

                        {/* Modèle et N° série */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Modèle</label>
                                <input
                                    type="text"
                                    name="model"
                                    value={formData.model}
                                    onChange={handleInputChange}
                                    placeholder="Ex: ThemaPlus Condens F30"
                                />
                            </div>
                            <div className="form-group">
                                <label>Numéro de série</label>
                                <input
                                    type="text"
                                    name="serial_number"
                                    value={formData.serial_number}
                                    onChange={handleInputChange}
                                    placeholder="Ex: SN2024-XXX-XXX"
                                />
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Date d'installation</label>
                                <input
                                    type="date"
                                    name="installation_date"
                                    value={formData.installation_date}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Fin de garantie</label>
                                <input
                                    type="date"
                                    name="warranty_end_date"
                                    value={formData.warranty_end_date}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        {/* Localisation et État */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Localisation</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    placeholder="Ex: Sous-sol, Cuisine, Garage..."
                                />
                            </div>
                            <div className="form-group">
                                <label>État</label>
                                <select
                                    name="condition"
                                    value={formData.condition}
                                    onChange={handleInputChange}
                                >
                                    {Object.entries(EQUIPMENT_CONDITIONS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                placeholder="Observations, remarques particulières..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Enregistrement...' : (editingEquipment ? 'Mettre à jour' : 'Ajouter')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export { EQUIPMENT_TYPES, EQUIPMENT_CONDITIONS };
export default EquipmentForm;
