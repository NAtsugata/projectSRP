/**
 * Utility to generate maintenance report PDF
 * Creates a printable HTML document that can be saved as PDF
 */

import { INTERVENTION_TYPES } from '../components/contracts/MaintenanceReportForm';

// Equipment type labels
const EQUIPMENT_TYPES = {
    chaudiere: 'Chaudière',
    climatisation: 'Climatisation',
    pompe_chaleur: 'Pompe à chaleur',
    cumulus: 'Cumulus / Chauffe-eau',
    vmc: 'VMC',
    adoucisseur: 'Adoucisseur',
    chauffe_eau_thermodynamique: 'Chauffe-eau thermodynamique',
    autre: 'Autre'
};

/**
 * Generate a printable maintenance report
 */
export function generateMaintenanceReportPDF(reportData, contract, equipment) {
    const {
        intervention_type,
        intervention_date,
        equipment_ids,
        actions_performed,
        custom_actions,
        parts_replaced,
        observations,
        recommendations,
        co_reading,
        co2_reading,
        combustion_efficiency,
        client_present,
        client_signature,
        technician_name
    } = reportData;

    // Get selected equipment details
    const selectedEquipment = equipment.filter(eq => equipment_ids.includes(eq.id));

    // Format date
    const formattedDate = new Date(intervention_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Build actions list
    const allActions = [...actions_performed];
    if (custom_actions) {
        custom_actions.split(',').forEach(a => allActions.push(a.trim()));
    }

    // Create HTML content
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Entretien - ${contract.client_name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .company-info h1 {
            color: #2563eb;
            font-size: 24px;
            margin-bottom: 5px;
        }
        .company-info p {
            color: #666;
            font-size: 11px;
        }
        .report-title {
            text-align: right;
        }
        .report-title h2 {
            color: #1e40af;
            font-size: 18px;
        }
        .report-title .date {
            color: #666;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            background: #f3f4f6;
            padding: 10px 15px;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
        }
        .section-content {
            padding: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .info-item label {
            display: block;
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 3px;
        }
        .info-item span {
            font-weight: 500;
        }
        .equipment-list {
            margin-top: 10px;
        }
        .equipment-item {
            background: #f9fafb;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 8px;
        }
        .equipment-item h4 {
            color: #2563eb;
            margin-bottom: 5px;
        }
        .equipment-item p {
            font-size: 11px;
            color: #666;
        }
        .actions-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
        }
        .action-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .action-item::before {
            content: '✓';
            color: #10b981;
            font-weight: bold;
        }
        .measurements {
            display: flex;
            gap: 30px;
        }
        .measurement {
            text-align: center;
            padding: 10px 20px;
            background: #eff6ff;
            border-radius: 8px;
        }
        .measurement .value {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
        }
        .measurement .unit {
            font-size: 10px;
            color: #666;
        }
        .notes-box {
            background: #fefce8;
            border-left: 4px solid #f59e0b;
            padding: 10px 15px;
            margin-top: 10px;
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        .signature-box {
            width: 45%;
        }
        .signature-box h4 {
            margin-bottom: 10px;
            color: #374151;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 60px;
            margin-bottom: 5px;
        }
        .signature-image {
            max-width: 200px;
            max-height: 80px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
        }
        @media print {
            body { padding: 0; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>SRP Plomberie</h1>
            <p>Services de plomberie et chauffage</p>
            <p>Tél: 01 23 45 67 89 | contact@srp-plomberie.fr</p>
        </div>
        <div class="report-title">
            <h2>RAPPORT D'ENTRETIEN</h2>
            <p class="date">${formattedDate}</p>
        </div>
    </div>

    <!-- Client Info -->
    <div class="section">
        <div class="section-header">👤 Informations Client</div>
        <div class="section-content">
            <div class="info-grid">
                <div class="info-item">
                    <label>Nom</label>
                    <span>${contract.client_name}</span>
                </div>
                <div class="info-item">
                    <label>Adresse</label>
                    <span>${contract.client_address || '-'}</span>
                </div>
                <div class="info-item">
                    <label>Téléphone</label>
                    <span>${contract.client_phone || '-'}</span>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <span>${contract.client_email || '-'}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Intervention Info -->
    <div class="section">
        <div class="section-header">🔧 Intervention</div>
        <div class="section-content">
            <div class="info-grid">
                <div class="info-item">
                    <label>Type d'intervention</label>
                    <span>${INTERVENTION_TYPES[intervention_type] || intervention_type}</span>
                </div>
                <div class="info-item">
                    <label>Technicien</label>
                    <span>${technician_name || '-'}</span>
                </div>
                <div class="info-item">
                    <label>N° Contrat</label>
                    <span>${contract.contract_number || '-'}</span>
                </div>
                <div class="info-item">
                    <label>Client présent</label>
                    <span>${client_present ? 'Oui' : 'Non'}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Equipment -->
    <div class="section">
        <div class="section-header">🔩 Équipements Contrôlés</div>
        <div class="section-content">
            <div class="equipment-list">
                ${selectedEquipment.map(eq => `
                    <div class="equipment-item">
                        <h4>${EQUIPMENT_TYPES[eq.equipment_type] || eq.equipment_type}</h4>
                        <p>
                            ${eq.brand ? `Marque: ${eq.brand}` : ''}
                            ${eq.model ? ` | Modèle: ${eq.model}` : ''}
                            ${eq.serial_number ? ` | N° série: ${eq.serial_number}` : ''}
                        </p>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- Actions Performed -->
    <div class="section">
        <div class="section-header">✅ Actions Réalisées</div>
        <div class="section-content">
            <div class="actions-list">
                ${allActions.map(action => `
                    <div class="action-item">${action}</div>
                `).join('')}
            </div>
            ${parts_replaced ? `
                <div class="notes-box" style="margin-top: 15px;">
                    <strong>Pièces remplacées:</strong><br>
                    ${parts_replaced}
                </div>
            ` : ''}
        </div>
    </div>

    <!-- Measurements -->
    ${(co_reading || co2_reading || combustion_efficiency) ? `
    <div class="section">
        <div class="section-header">📊 Mesures de Combustion</div>
        <div class="section-content">
            <div class="measurements">
                ${co_reading ? `
                    <div class="measurement">
                        <div class="value">${co_reading}</div>
                        <div class="unit">CO (ppm)</div>
                    </div>
                ` : ''}
                ${co2_reading ? `
                    <div class="measurement">
                        <div class="value">${co2_reading}</div>
                        <div class="unit">CO₂ (%)</div>
                    </div>
                ` : ''}
                ${combustion_efficiency ? `
                    <div class="measurement">
                        <div class="value">${combustion_efficiency}</div>
                        <div class="unit">Rendement (%)</div>
                    </div>
                ` : ''}
            </div>
        </div>
    </div>
    ` : ''}

    <!-- Observations -->
    ${observations ? `
    <div class="section">
        <div class="section-header">👁️ Observations</div>
        <div class="section-content">
            <p>${observations}</p>
        </div>
    </div>
    ` : ''}

    <!-- Recommendations -->
    ${recommendations ? `
    <div class="section">
        <div class="section-header">💡 Recommandations</div>
        <div class="section-content">
            <div class="notes-box">
                ${recommendations}
            </div>
        </div>
    </div>
    ` : ''}

    <!-- Signatures -->
    <div class="signature-section">
        <div class="signature-box">
            <h4>Signature du technicien</h4>
            <div class="signature-line"></div>
            <p>${technician_name || ''}</p>
        </div>
        <div class="signature-box">
            <h4>Signature du client</h4>
            ${client_signature && client_signature !== 'data:,' ? `
                <img src="${client_signature}" alt="Signature client" class="signature-image">
            ` : `
                <div class="signature-line"></div>
            `}
            <p>${contract.client_name}</p>
        </div>
    </div>

    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>SRP Plomberie - Ce document atteste de la réalisation des travaux mentionnés</p>
    </div>
</body>
</html>`;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Auto-trigger print dialog and close on finish
    setTimeout(() => {
        printWindow.print();
        // Close window after print dialog is closed (supported in most modern browsers)
        printWindow.onafterprint = function () {
            printWindow.close();
        };
    }, 500);

    return htmlContent;
}

/**
 * Save report to database (for history)
 */
export function prepareReportForDatabase(reportData) {
    return {
        contract_id: reportData.contract_id,
        visit_id: reportData.visit_id,
        intervention_type: reportData.intervention_type,
        intervention_date: reportData.intervention_date,
        equipment_ids: reportData.equipment_ids,
        actions_performed: reportData.actions_performed,
        parts_replaced: reportData.parts_replaced || null,
        observations: reportData.observations || null,
        recommendations: reportData.recommendations || null,
        co_reading: reportData.co_reading ? parseFloat(reportData.co_reading) : null,
        co2_reading: reportData.co2_reading ? parseFloat(reportData.co2_reading) : null,
        combustion_efficiency: reportData.combustion_efficiency ? parseFloat(reportData.combustion_efficiency) : null,
        client_present: reportData.client_present,
        client_signature: reportData.client_signature,
        technician_name: reportData.technician_name,
        created_at: reportData.created_at
    };
}
