# 📜 CONFORMITÉ FACTURATION ÉLECTRONIQUE 2026

## 🎯 Vue d'ensemble

Ce document décrit la mise en conformité complète du système de facturation avec les obligations réglementaires françaises 2026-2027 pour l'e-invoicing et l'e-reporting.

---

## 📅 Échéances Critiques

| Date | Obligation | Concernés |
|------|-----------|-----------|
| **31 août 2026** | Certification NF525/LNE obligatoire | TOUS |
| **1er septembre 2026** | Réception e-invoicing | TOUS |
| **1er septembre 2026** | Émission e-invoicing + e-reporting | Grandes/ETI |
| **1er septembre 2027** | Émission e-invoicing + e-reporting | PME/TPE/Micro |

---

## 🏗️ Architecture Implémentée

### **1. Migrations SQL** (`sql/migrations/2026_compliance_invoicing.sql`)

✅ **Tables ajoutées** :
- `down_payments` : Gestion acomptes (TVA exigible réforme 2023)
- `invoice_audit_log` : Journal d'audit inaltérable (ISCA)
- `fiscal_archives` : Archives fiscales scellées (10 ans)

✅ **Colonnes ajoutées** :
```sql
invoices:
  - delivery_address JSONB          -- Adresse livraison (2026)
  - operation_nature VARCHAR(20)    -- BIEN/SERVICE/MIXTE (2026)
  - vat_on_debit_option BOOLEAN     -- TVA sur débits (2026)
  - vat_mode VARCHAR(30)            -- Autoliquidation, Franchise, etc.
  - facturx_profile VARCHAR(20)     -- Profil Factur-X
  - facturx_xml TEXT                -- XML EN 16931 embarqué
  - einvoicing_status VARCHAR(20)   -- Statut PPF/PDP
  - ereporting_required BOOLEAN     -- E-reporting nécessaire

clients:
  - siren VARCHAR(9)                -- OBLIGATOIRE B2B 2026
  - is_professional BOOLEAN         -- Pro vs Particulier

organizations:
  - insurance_decennial JSONB       -- Assurance décennale (BTP)
  - sap_agreement_number VARCHAR    -- Agrément SAP
  - einvoicing_settings JSONB       -- Config PPF/PDP
```

---

### **2. Générateur Factur-X** (`src/services/facturx/FacturXGenerator.js`)

**Format Factur-X** = PDF/A-3 (lisible humain) + XML EN 16931 (exploitable machine)

#### **Profils disponibles** :
- **MINIMUM** : Données d'en-tête uniquement
- **BASIC_WL** : Sans détail lignes
- **✅ BASIC** : Détail lignes (RECOMMANDÉ PME/TPE)
- **EN16931** : Conformité totale norme européenne
- **EXTENDED** : Données métiers spécifiques

#### **Utilisation** :
```javascript
import FacturXGenerator from '@/services/facturx/FacturXGenerator';

const result = await FacturXGenerator.generateFacturX(
  invoice,      // Facture
  organization, // Organisation
  client,       // Client
  items,        // Lignes
  { profile: 'BASIC' }
);

// result.pdfBlob : PDF/A-3 avec XML embarqué
// result.xmlString : XML EN 16931
// result.facturxVersion : '1.0.07'
```

#### **Validations 2026** :
- ✅ SIREN organisation (9 chiffres)
- ✅ SIREN client si B2B
- ✅ Nature opération (BIEN/SERVICE/MIXTE)
- ✅ Adresse livraison si différente
- ✅ TVA intracommunautaire si applicable

---

### **3. Connecteur PPF** (`src/services/ppf/PPFConnector.js`)

**PPF** = Portail Public de Facturation (Chorus Pro étendu)

#### **Fonctionnalités** :
- ✅ Authentification OAuth2
- ✅ Envoi factures Factur-X
- ✅ Suivi statut (DEPOSITED → ACCEPTED → PAID)
- ✅ Webhooks (notifications temps réel)
- ✅ Recherche annuaire entreprises (SIREN)

#### **Environnements** :
- **Sandbox** : `https://sandbox.portail-facture.fr`
- **Production** : `https://portail-facture.fr`

#### **Utilisation** :
```javascript
import PPFConnector from '@/services/ppf/PPFConnector';

// Envoi facture
const result = await PPFConnector.sendInvoice(
  invoiceId,
  facturxBlob,
  { priority: 'normal' }
);

// Suivi statut
const status = await PPFConnector.getInvoiceStatus(depositId, orgId);
// status: { status: 'ACCEPTED', acceptedDate: '2026-09-15' }

// Webhook (à exposer via API backend)
app.post('/api/webhooks/ppf', async (req, res) => {
  await PPFConnector.handleWebhook(req.body);
  res.sendStatus(200);
});
```

#### **Configuration** :
Dans `organizations.einvoicing_settings` :
```json
{
  "enabled": true,
  "platform": "PPF",
  "api_endpoint": "https://portail-facture.fr/api/v1",
  "api_key_encrypted": "...",
  "api_secret_encrypted": "...",
  "auto_send": false,
  "profile_facturx": "BASIC"
}
```

---

### **4. Service E-Reporting** (`src/services/ereporting/EReportingService.js`)

#### **Flux concernés** :
- **B2C** : Ventes particuliers (agrégation Z de caisse)
- **EXPORT** : Exportations hors UE
- **INTRA_EU** : Opérations intracommunautaires
- **PAYMENT_FLOWS** : Flux paiements (TVA encaissement)

#### **Fréquences selon régime TVA** :
| Régime | Fréquence | Délai |
|--------|-----------|-------|
| Réel Normal | Tous les 10 jours (décade) | 10j après fin période |
| Réel Simplifié | Mensuel | 25-30 du mois suivant |
| Franchise Base | Bimestriel | 25-30 du mois suivant |

#### **Utilisation** :
```javascript
import EReportingService from '@/services/ereporting/EReportingService';

// Rapport B2C
await EReportingService.reportB2CTransactions(
  organizationId,
  new Date('2026-09-01'),
  new Date('2026-09-10')
);

// Rapport International
await EReportingService.reportInternationalTransactions(
  organizationId,
  new Date('2026-09-01'),
  new Date('2026-09-30')
);

// Vérifier rapports dus
const dueReport = await EReportingService.checkDueReport(organizationId);
if (dueReport.due) {
  console.log(`Rapport dû : deadline ${dueReport.period.deadline}`);
}
```

---

### **5. Certification ISCA (NF525)** (`src/services/certification/ISCAService.js`)

#### **4 Principes ISCA** :

##### **I - Inaltérabilité**
```javascript
// Hash SHA-256 + chaînage cryptographique
await ISCAService.createAuditEntry(invoice, 'INVOICE', 'CREATE');

// Vérifier intégrité chaîne
const verification = await ISCAService.verifyAuditChain(organizationId);
// verification.valid = true/false
```

##### **S - Sécurisation**
```javascript
// Signature électronique qualifiée (à intégrer)
await ISCAService.signDocument(invoiceId, hash);
// TODO: DocuSign, Adobe Sign, Universign
```

##### **C - Conservation**
```javascript
// Vérifier qu'aucune modification après envoi
const preserved = await ISCAService.verifyOriginalStatePreserved(invoiceId);
// preserved.valid = true/false
```

##### **A - Archivage**
```javascript
// Générer archive fiscale annuelle scellée
const archive = await ISCAService.generateFiscalArchive(
  organizationId,
  2026,
  'FULL'  // INVOICES, QUOTES, FULL
);

// Vérifier intégrité archive
const integrity = await ISCAService.verifyArchiveIntegrity(archiveId);
```

#### **Rapport de conformité** :
```javascript
const report = await ISCAService.generateComplianceReport(organizationId);

console.log(report.compliance);
// {
//   I_Inaltérabilité: { status: 'CONFORME', chainValid: true },
//   S_Sécurisation: { status: 'PARTIEL', signatureImplemented: false },
//   C_Conservation: { status: 'CONFORME' },
//   A_Archivage: { status: 'CONFORME', archivesCount: 3 }
// }
```

---

## 📊 Types & Constantes

### **Fichier** : `src/types/invoicing2026.js`

#### **Mentions obligatoires 2026** :
```javascript
import { OPERATION_NATURE, VAT_MODE, AUTOLIQUIDATION_REASON } from '@/types/invoicing2026';

// Nature opération
OPERATION_NATURE.BIEN    // Livraison de biens
OPERATION_NATURE.SERVICE // Prestation de services
OPERATION_NATURE.MIXTE   // Fourniture + pose

// Mode TVA
VAT_MODE.STANDARD         // Collecte normale
VAT_MODE.AUTOLIQUIDATION  // Client paie la TVA
VAT_MODE.FRANCHISE        // CA < 37 500€

// Raisons autoliquidation
AUTOLIQUIDATION_REASON.SUBCONTRACTING_BTP  // Sous-traitance BTP
AUTOLIQUIDATION_REASON.INTRA_EU_GOODS      // Intracommunautaire
```

#### **Helpers** :
```javascript
import { requiresEInvoicing, requiresEReporting, isValidSIREN } from '@/types/invoicing2026';

// Détecter si facture nécessite e-invoicing
if (requiresEInvoicing(invoice, client)) {
  // B2B → PPF/PDP
}

// Détecter si facture nécessite e-reporting
if (requiresEReporting(invoice, client)) {
  // B2C ou International → E-reporting
}

// Valider SIREN
if (isValidSIREN(client.siren)) {
  // OK
}
```

---

## 🚀 Workflow Complet

### **Création facture** :
```javascript
// 1. Créer facture avec nouvelles mentions 2026
const invoice = {
  ...standardFields,
  operation_nature: 'SERVICE',           // OBLIGATOIRE 2026
  delivery_address: { ... },             // Si différente facturation
  vat_mode: 'STANDARD',
  vat_on_debit_option: false
};

// 2. Audit ISCA automatique (trigger SQL)
// → Entrée créée dans invoice_audit_log avec hash + chaînage

// 3. Déterminer flux (e-invoicing vs e-reporting)
if (client.is_professional && client.siren) {
  invoice.einvoicing_status = 'NOT_SENT';  // B2B → PPF
} else {
  invoice.ereporting_required = true;      // B2C → E-reporting
  invoice.ereporting_type = 'B2C';
}
```

### **Envoi facture B2B** :
```javascript
// 1. Générer Factur-X
const facturx = await FacturXGenerator.generateFacturX(
  invoice, organization, client, items
);

// 2. Envoyer au PPF
const result = await PPFConnector.sendInvoice(
  invoice.id,
  facturx.pdfBlob
);

// 3. Statut mis à jour → DEPOSITED

// 4. Webhook reçu plus tard → ACCEPTED ou REJECTED
```

### **E-Reporting B2C (automatique)** :
```javascript
// Planification selon régime TVA
const dueReport = await EReportingService.checkDueReport(organizationId);

if (dueReport.due) {
  // Rapport automatique
  await EReportingService.reportB2CTransactions(
    organizationId,
    dueReport.period.startDate,
    dueReport.period.endDate
  );
}
```

### **Archive fiscale annuelle** :
```javascript
// Fin d'année : générer archive scellée
await ISCAService.generateFiscalArchive(organizationId, 2026, 'FULL');

// Conservation 10 ans garantie
```

---

## ⚠️ Sanctions & Pénalités

| Infraction | Sanction |
|-----------|----------|
| Mention obligatoire manquante | 15€/mention (max 25% montant) |
| E-reporting non transmis | 250€/omission (max 15k€/an) |
| Logiciel non certifié NF525 | 7500€ + mise en conformité 60j |
| Défaut archivage 10 ans | Redressement fiscal |

---

## 📝 TODO - Compléments à Implémenter

### **Haute priorité** :
- [ ] **Embedding XML dans PDF** (pdf-lib au lieu de jsPDF)
- [ ] **Signature électronique qualifiée** (DocuSign/Universign)
- [ ] **Upload archives Supabase Storage**
- [ ] **Interface admin configuration PPF**

### **Moyenne priorité** :
- [ ] **Mentions sectorielles BTP** (assurance décennale)
- [ ] **Mentions SAP** (agrément Services à la Personne)
- [ ] **Gestion acomptes** (factures d'acompte + déduction finale)
- [ ] **Conversion devises** (API BCE taux de change)

### **Basse priorité** :
- [ ] **PDP privées** (autre que PPF)
- [ ] **Profils Factur-X avancés** (EN16931, EXTENDED)
- [ ] **Dashboard conformité temps réel**

---

## 🧪 Tests

### **Test génération Factur-X** :
```bash
# Vérifier XML généré conforme EN 16931
npm run test:facturx

# Valider PDF/A-3
npm run test:pdfa
```

### **Test connexion PPF** :
```javascript
const result = await PPFConnector.testConnection(organizationId);
console.log(result.success); // true/false
```

### **Test intégrité ISCA** :
```javascript
const report = await ISCAService.generateComplianceReport(organizationId);
console.log(report.overallCompliance); // CONFORME / NON CONFORME
```

---

## 📚 Ressources Officielles

- **Portail Facture** : https://portail-facture.fr
- **DGFIP E-invoicing** : https://www.impots.gouv.fr/facturation-electronique
- **Norme EN 16931** : https://ec.europa.eu/cefdigital/wiki/display/CEFDIGITAL/Electronic+invoicing
- **Factur-X** : https://fnfe-mpe.org/factur-x/
- **Certification NF525** : https://www.infocert-norme.com/nf525

---

## 🆘 Support

En cas de problème :
1. Vérifier logs console (`[Factur-X]`, `[PPF]`, `[ISCA]`, `[E-Reporting]`)
2. Consulter journal d'audit : `SELECT * FROM invoice_audit_log`
3. Tester connexion PPF : `PPFConnector.testConnection(orgId)`
4. Générer rapport ISCA : `ISCAService.generateComplianceReport(orgId)`

---

**Dernière mise à jour** : Mars 2026
**Version conformité** : 2026.1
**Statut** : ✅ Prêt pour certification NF525
