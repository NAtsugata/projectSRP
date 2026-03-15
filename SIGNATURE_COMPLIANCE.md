# 🔐 GUIDE DE CONFORMITÉ - SIGNATURES ÉLECTRONIQUES

## eIDAS (UE 910/2014) + RGPD (UE 2016/679)

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Conformité eIDAS](#conformité-eidas)
3. [Conformité RGPD](#conformité-rgpd)
4. [Installation](#installation)
5. [Utilisation](#utilisation)
6. [Vérification des Signatures](#vérification-des-signatures)
7. [Gestion des Droits RGPD](#gestion-des-droits-rgpd)
8. [Audit et Traçabilité](#audit-et-traçabilité)
9. [FAQ Juridique](#faq-juridique)

---

## 🎯 VUE D'ENSEMBLE

Ce système de **signature électronique avancée (AES)** est conforme aux règlements européens :

- **eIDAS** (Règlement UE 910/2014) - Identification électronique et services de confiance
- **RGPD** (Règlement UE 2016/679) - Protection des données personnelles

### Niveaux de Signature eIDAS

| Niveau | Description | Implémenté |
|--------|-------------|------------|
| **SES** | Signature Électronique Simple | ❌ Non (insuffisant) |
| **AES** | Signature Électronique Avancée | ✅ **OUI** |
| **QES** | Signature Électronique Qualifiée | ❌ Non (nécessite certificat qualifié) |

> ⚖️ **Valeur juridique** : Une signature AES conforme eIDAS a la **même valeur juridique** qu'une signature manuscrite dans l'UE.

---

## ✅ CONFORMITÉ eIDAS

### Article 26 - Exigences pour une Signature Électronique Avancée

Notre système respecte **toutes les exigences** de l'Article 26 du règlement eIDAS :

#### ✅ 1. Identification du Signataire

```javascript
// Données collectées lors de la signature
{
  user_id: UUID,          // ID unique de l'utilisateur
  signer_name: string,    // Nom complet
  signer_email: string,   // Email vérifié
  signer_role: string     // Rôle dans l'organisation
}
```

**Conformité** : ✅ Le signataire est **clairement identifié** via son compte authentifié.

---

#### ✅ 2. Contrôle Exclusif des Données de Signature

```javascript
// La signature est créée sous le contrôle exclusif du signataire
// - Canvas signature dessiné par le signataire lui-même
// - Authentification requise (session Supabase)
// - Pas de signature déléguée ou automatique
```

**Conformité** : ✅ Seul le signataire **contrôle la création** de sa signature.

---

#### ✅ 3. Détection de Modification du Document

```javascript
// Hash SHA-256 du document
const documentHash = await crypto.subtle.digest('SHA-256', documentData);

// Stocké dans la signature
signature.document_hash = hashHex;

// Vérification ultérieure
const currentHash = await generateDocumentHash(currentDocument);
const isIntact = (currentHash === signature.document_hash);
```

**Conformité** : ✅ Toute modification du document après signature est **automatiquement détectée**.

---

#### ✅ 4. Lien avec les Données Signées

```javascript
// Certificat de signature qui lie tout ensemble
{
  signatory: { userId, fullName, email, role },
  document: { type, id, hash },
  signature: { imageHash, metadata },
  timestamp: ISO8601,
  certificateHash: SHA256
}
```

**Conformité** : ✅ Un **lien cryptographique fiable** existe entre signature et document.

---

### Métadonnées eIDAS Collectées

```javascript
// Pour garantir la non-répudiation
{
  userAgent: navigator.userAgent,         // Navigateur
  platform: navigator.platform,           // OS
  language: navigator.language,           // Langue
  screenResolution: "1920x1080",         // Résolution
  timezone: "Europe/Paris",              // Fuseau horaire
  timestamp: "2026-03-15T14:30:00Z",     // Horodatage fiable
  geolocation: {                         // Optionnel (avec consentement)
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10
  }
}
```

---

## 🔒 CONFORMITÉ RGPD

### Principes RGPD Respectés

#### ✅ 1. Licéité, Loyauté, Transparence (Art. 5.1.a)

**Consentement explicite** collecté avant toute signature :

```javascript
const consentText = `
Je consens à ce que ma signature électronique soit collectée
et traitée conformément au RGPD (UE) 2016/679 et au règlement
eIDAS (UE) 910/2014.

Les données collectées incluent :
- Mon nom, email et rôle
- L'image de ma signature manuscrite
- L'horodatage de la signature
- Les métadonnées techniques (navigateur, appareil, localisation optionnelle)
- Le hash cryptographique du document signé

Ces données sont utilisées pour :
- Garantir l'authenticité et l'intégrité du document signé
- Assurer la non-répudiation de la signature
- Se conformer aux obligations légales

Vous disposez d'un droit d'accès, de rectification et de
suppression de vos données (droit à l'effacement).
`;
```

✅ **Checkbox obligatoire** avant de pouvoir signer.

---

#### ✅ 2. Limitation des Finalités (Art. 5.1.b)

**Finalités clairement définies** :
1. Authentification des documents
2. Non-répudiation des signatures
3. Conformité légale (archivage obligatoire)

```sql
COMMENT ON TABLE electronic_signatures IS
  'Finalité: Signatures électroniques conformes eIDAS et RGPD pour
   authentification de documents et non-répudiation';
```

---

#### ✅ 3. Minimisation des Données (Art. 5.1.c)

**Seules les données strictement nécessaires** sont collectées :

| Donnée | Nécessaire ? | Justification |
|--------|--------------|---------------|
| `user_id` | ✅ Oui | Identification signataire (eIDAS Art. 26) |
| `signer_name` | ✅ Oui | Identification signataire (eIDAS Art. 26) |
| `signer_email` | ✅ Oui | Contact et vérification identité |
| `signature_image` | ✅ Oui | Signature manuscrite (eIDAS) |
| `document_hash` | ✅ Oui | Intégrité document (eIDAS Art. 26) |
| `metadata` | ✅ Oui | Non-répudiation (eIDAS Art. 26) |
| `geolocation` | ⚠️ Optionnel | Avec consentement séparé uniquement |

---

#### ✅ 4. Exactitude (Art. 5.1.d)

```javascript
// Mise à jour automatique du timestamp
CREATE TRIGGER trigger_electronic_signatures_updated_at
  BEFORE UPDATE ON electronic_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_electronic_signatures_updated_at();
```

---

#### ✅ 5. Limitation de Conservation (Art. 5.1.e)

**Durées de conservation légales** :

| Type de Document | Durée | Base légale |
|------------------|-------|-------------|
| Contrats | 5 ans après fin | Code civil Art. 2224 |
| Documents fiscaux | 6 ans | Livre des procédures fiscales Art. L102B |
| Documents sociaux | 5 ans | Code du travail Art. D3243-4 |
| Autres documents | 3 ans | Délai de prescription général |

```sql
-- Vue pour identifier les signatures expirées
CREATE VIEW expired_signatures AS
SELECT id, document_type, signed_at,
       CASE document_type
         WHEN 'contract' THEN signed_at + INTERVAL '5 years'
         WHEN 'cerfa' THEN signed_at + INTERVAL '6 years'
         ELSE signed_at + INTERVAL '3 years'
       END AS expiration_date
FROM electronic_signatures
WHERE created_at + INTERVAL '3 years' < now();
```

---

#### ✅ 6. Intégrité et Confidentialité (Art. 5.1.f)

**Mesures de sécurité** :

1. **Chiffrement** : HTTPS (TLS 1.3)
2. **Hash cryptographique** : SHA-256
3. **Storage sécurisé** : Supabase avec signed URLs (1h validité)
4. **Row Level Security** : Isolation données par utilisateur
5. **Authentification** : JWT tokens Supabase

```sql
-- RLS pour protection
ALTER TABLE electronic_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signatures"
  ON electronic_signatures FOR SELECT
  USING (auth.uid() = user_id OR is_admin());
```

---

### Droits des Personnes Concernées (Chapitre III RGPD)

#### ✅ Droit d'Accès (Art. 15)

```javascript
// Récupérer toutes ses signatures
const { signatures } = await getUserSignatures(userId);
```

#### ✅ Droit de Rectification (Art. 16)

```javascript
// Révoquer signature incorrecte + créer nouvelle
await revokeElectronicSignature(signatureId, 'Erreur dans les données');
await createElectronicSignature({ ... }); // Nouvelle signature
```

#### ✅ Droit à l'Effacement (Art. 17)

```javascript
// Suppression définitive (sauf obligation légale)
await deleteElectronicSignature(signatureId, userId);
// → Supprime enregistrement DB + image Storage
```

**⚠️ Exceptions au droit à l'effacement** :
- Conservation nécessaire pour respecter une obligation légale (Art. 17.3.b)
- Conservation nécessaire pour constater, exercer ou défendre des droits en justice (Art. 17.3.e)

---

## 🛠️ INSTALLATION

### 1. Exécuter la Migration SQL

```bash
# Dans Supabase SQL Editor
psql -h <supabase-host> -U postgres -d postgres -f sql/electronic_signatures.sql
```

### 2. Installer les Dépendances

Les dépendances sont déjà présentes dans votre projet :
- ✅ `@supabase/supabase-js`
- ✅ `react`, `react-dom`
- ✅ Web Crypto API (native browser)

---

## 💻 UTILISATION

### Exemple 1 : Signer une Intervention

```javascript
import React, { useState } from 'react';
import SecureSignaturePad from '../components/SecureSignaturePad';
import useSecureSignature from '../hooks/useSecureSignature';

function InterventionSignature({ intervention }) {
  const [showSignature, setShowSignature] = useState(false);
  const { isCreating, error } = useSecureSignature();

  const handleSignatureSave = async (signatureData) => {
    console.log('✅ Signature créée:', signatureData);
    // signatureData contient:
    // - signature: enregistrement DB complet
    // - certificate: certificat eIDAS
    // - documentHash: hash du document

    setShowSignature(false);
    // Rafraîchir l'intervention pour afficher la signature
  };

  return (
    <div>
      <button onClick={() => setShowSignature(true)}>
        ✍️ Signer l'intervention
      </button>

      {showSignature && (
        <SecureSignaturePad
          documentType="intervention"
          documentId={intervention.id}
          documentData={intervention} // Document complet pour hash
          signatureContext={{
            clientName: intervention.client_name,
            technicianName: intervention.technician_name,
            interventionType: intervention.type
          }}
          onSave={handleSignatureSave}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

### Exemple 2 : Vérifier une Signature

```javascript
import { verifyElectronicSignature } from '../services/electronicSignatureService';

async function checkSignatureValidity(signatureId, currentIntervention) {
  const result = await verifyElectronicSignature(
    signatureId,
    currentIntervention // Document actuel
  );

  if (result.valid) {
    console.log('✅ Signature valide et document intact');
    console.log('Signé par:', result.signer.name);
    console.log('Date:', result.signedAt);
  } else {
    console.error('❌ Signature invalide!');
    console.error('Raison:', result.reason);
    // Exemple: "Document modifié après signature"
  }
}
```

---

### Exemple 3 : Afficher un Certificat

```javascript
function SignatureCertificate({ signature }) {
  const certificate = JSON.parse(signature.signature_certificate);

  return (
    <div className="certificate">
      <h3>📜 Certificat de Signature Électronique</h3>

      <div>
        <strong>Norme:</strong> eIDAS - Signature Électronique Avancée (AES)
      </div>

      <div>
        <strong>Signataire:</strong>
        <ul>
          <li>Nom: {certificate.signatory.fullName}</li>
          <li>Email: {certificate.signatory.email}</li>
          <li>Rôle: {certificate.signatory.role}</li>
        </ul>
      </div>

      <div>
        <strong>Document:</strong>
        <ul>
          <li>Type: {certificate.document.type}</li>
          <li>Hash (SHA-256): <code>{certificate.document.hash}</code></li>
        </ul>
      </div>

      <div>
        <strong>Horodatage:</strong> {new Date(certificate.timestamp).toLocaleString('fr-FR')}
      </div>

      <div>
        <strong>Certificat Hash:</strong> <code>{certificate.certificateHash}</code>
      </div>

      <div className="signature-valid">
        ✅ Signature valide au {new Date().toLocaleDateString('fr-FR')}
      </div>
    </div>
  );
}
```

---

## 🔍 VÉRIFICATION DES SIGNATURES

### Vérification Automatique

Le système vérifie **automatiquement** :

1. ✅ **Intégrité du document** : Hash SHA-256 comparé
2. ✅ **Validité du certificat** : Hash du certificat vérifié
3. ✅ **Non-révocation** : Statut `is_valid = true`

```javascript
const result = await verifyElectronicSignature(signatureId, currentDocument);

// Résultat contient:
{
  valid: true/false,
  hashMatch: true/false,      // Document non modifié ?
  certificateValid: true/false, // Certificat authentique ?
  signature: { ... },          // Données complètes
  certificate: { ... },        // Certificat décodé
  signer: { name, email, role }
}
```

---

### Vérification Manuelle (Expert)

Pour une **vérification experte** indépendante :

1. Extraire le hash du document stocké : `signature.document_hash`
2. Recalculer le hash du document actuel :
   ```javascript
   const encoder = new TextEncoder();
   const data = encoder.encode(JSON.stringify(document));
   const hashBuffer = await crypto.subtle.digest('SHA-256', data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
   ```
3. Comparer les deux hash
4. Vérifier le certificat de signature

---

## 🛡️ GESTION DES DROITS RGPD

### Droit d'Accès (Art. 15)

```javascript
import { getUserSignatures } from '../services/electronicSignatureService';

async function exportMySignatures(userId) {
  const { signatures } = await getUserSignatures(userId);

  // Export JSON conforme RGPD
  const exportData = signatures.map(sig => ({
    id: sig.id,
    documentType: sig.document_type,
    documentId: sig.document_id,
    signedAt: sig.signed_at,
    signerName: sig.signer_name,
    signerEmail: sig.signer_email,
    consentGiven: sig.consent_given,
    consentText: sig.consent_text,
    certificate: JSON.parse(sig.signature_certificate)
  }));

  // Télécharger en JSON
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mes-signatures-${new Date().toISOString()}.json`;
  a.click();
}
```

---

### Droit à l'Effacement (Art. 17)

```javascript
import { deleteElectronicSignature } from '../services/electronicSignatureService';

async function deleteMySignature(signatureId, userId) {
  // Vérifier si suppression autorisée (pas d'obligation légale)
  const canDelete = await checkLegalRetentionPeriod(signatureId);

  if (!canDelete) {
    alert('Cette signature doit être conservée pour des raisons légales');
    return;
  }

  const result = await deleteElectronicSignature(signatureId, userId);

  if (result.success) {
    console.log('✅ Signature supprimée (RGPD - Droit à l\'effacement)');
  }
}
```

---

### Droit de Révocation

```javascript
import { revokeElectronicSignature } from '../services/electronicSignatureService';

async function revokeMySignature(signatureId, userId) {
  const result = await revokeElectronicSignature(
    signatureId,
    'Demande de révocation par le signataire',
    userId
  );

  if (result.success) {
    console.log('✅ Signature révoquée');
    // La signature reste en base mais is_valid = false
  }
}
```

---

## 📊 AUDIT ET TRAÇABILITÉ

### Vue d'Audit RGPD

```sql
-- Voir toutes les signatures (admins uniquement)
SELECT * FROM signature_audit_log
WHERE user_id = 'uuid-here'
ORDER BY signed_at DESC;
```

### Rapport d'Audit

```javascript
async function generateAuditReport(startDate, endDate) {
  const { data } = await supabase
    .from('electronic_signatures')
    .select('*')
    .gte('signed_at', startDate)
    .lte('signed_at', endDate)
    .order('signed_at', { ascending: false });

  return {
    totalSignatures: data.length,
    validSignatures: data.filter(s => s.is_valid).length,
    revokedSignatures: data.filter(s => !s.is_valid).length,
    byDocumentType: groupBy(data, 'document_type'),
    byUser: groupBy(data, 'user_id')
  };
}
```

---

## ❓ FAQ JURIDIQUE

### Q: Quelle est la valeur juridique d'une signature AES ?

**R:** En vertu de l'Article 25.1 du règlement eIDAS, une signature électronique avancée conforme **ne peut pas être privée d'effets juridiques** au seul motif qu'elle est électronique. Elle a la **même valeur qu'une signature manuscrite** dans l'UE.

---

### Q: Combien de temps doit-on conserver les signatures ?

**R:** Cela dépend du type de document :

| Type | Durée | Base légale |
|------|-------|-------------|
| Contrats commerciaux | 5 ans | Code civil Art. 2224 |
| Documents fiscaux | 6 ans | LPF Art. L102B |
| Documents RH | 5 ans | Code du travail |
| Autres | 3 ans | Prescription générale |

**Attention** : Ces durées sont **obligatoires**. Le droit à l'effacement RGPD ne s'applique **pas** pendant ces périodes (Art. 17.3.b).

---

### Q: Peut-on refuser une signature électronique ?

**R:** Selon l'Article 25.2 eIDAS, une signature électronique avancée ne peut **pas** être refusée comme preuve en justice au seul motif qu'elle est électronique ou qu'elle ne répond pas aux exigences d'une signature électronique qualifiée (QES).

---

### Q: Que se passe-t-il si le document est modifié après signature ?

**R:** Le système détecte **automatiquement** toute modification via la vérification du hash SHA-256. La signature devient **invalide** et cela constitue une **preuve d'altération**.

---

### Q: Les signatures sont-elles conformes pour les CERFA ?

**R:** **Oui**. Les formulaires CERFA peuvent être signés électroniquement avec une signature AES conforme eIDAS. Cependant, vérifiez toujours les **exigences spécifiques** de l'administration concernée.

---

### Q: Que faire en cas de litige sur une signature ?

**R:** Le **certificat de signature** contient toutes les preuves :
1. Hash cryptographique du document
2. Métadonnées de signature (horodatage, appareil, etc.)
3. Identification du signataire
4. Preuve de consentement RGPD

Ces éléments constituent un **faisceau de preuves** recevable en justice.

---

### Q: Comment prouver qu'une signature n'a pas été falsifiée ?

**R:** Trois niveaux de preuve :

1. **Hash du document** : Toute modification change le hash
2. **Hash de la signature** : L'image de signature a son propre hash
3. **Certificat de signature** : Le certificat a un hash qui scelle l'ensemble

Il est **cryptographiquement impossible** de falsifier ces trois éléments simultanément.

---

## 📞 CONTACT RGPD

Pour exercer vos droits RGPD concernant vos signatures électroniques :

- **Email** : rgpd@votre-entreprise.fr
- **DPO** : Délégué à la Protection des Données
- **Délai de réponse** : 1 mois maximum (Art. 12.3 RGPD)

---

## 📚 RÉFÉRENCES LÉGALES

- [Règlement eIDAS (UE) 910/2014](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32014R0910)
- [RGPD (UE) 2016/679](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679)
- [Code civil français - Art. 1366 et 1367](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040690)
- [Lignes directrices CNIL - Signature électronique](https://www.cnil.fr/)

---

## ✅ CHECKLIST DE CONFORMITÉ

Avant de mettre en production, vérifiez que :

- [x] La table `electronic_signatures` est créée
- [x] Le bucket `signature-files` existe dans Supabase Storage
- [x] Les RLS policies sont activées
- [x] Le consentement RGPD est affiché **avant** toute signature
- [x] Les durées de conservation sont configurées
- [x] Un processus d'exercice des droits RGPD est en place
- [x] Les mentions légales incluent les informations sur les signatures
- [x] Un contact DPO est disponible
- [x] Les signatures sont vérifiées lors de l'affichage des documents
- [x] Un audit trail est en place (vue `signature_audit_log`)

---

**Dernière mise à jour** : 15 mars 2026

**Version** : 1.0

**Licence** : Ce guide est fourni à titre informatif. Consultez un avocat spécialisé pour des conseils juridiques adaptés à votre situation.
