# 🔄 GUIDE DE MIGRATION - Signatures Conformes eIDAS & RGPD

## Migration depuis l'Ancien Système vers Signatures Sécurisées

---

## 📋 ÉTAPES DE MIGRATION

### 1️⃣ Installation de la Base de Données

```bash
# Dans Supabase SQL Editor ou via CLI
psql -h <your-supabase-host> -d postgres -U postgres \
  -f sql/electronic_signatures.sql
```

**Vérifications** :
```sql
-- Vérifier que la table est créée
SELECT COUNT(*) FROM electronic_signatures;

-- Vérifier que le bucket existe
SELECT * FROM storage.buckets WHERE id = 'signature-files';

-- Vérifier les RLS policies
SELECT * FROM pg_policies WHERE tablename = 'electronic_signatures';
```

---

### 2️⃣ Remplacement de l'Ancien Composant

#### ❌ AVANT (SignaturePad.jsx - Non conforme)

```javascript
import SignaturePad from '../components/SignaturePad';

function MyComponent({ intervention }) {
  const handleSave = (signatureBase64) => {
    // Sauvegarder directement le base64 dans intervention.signature
    updateIntervention({
      ...intervention,
      signature: signatureBase64
    });
  };

  return (
    <SignaturePad
      onSave={handleSave}
      initialValue={intervention.signature}
    />
  );
}
```

**Problèmes** :
- ❌ Pas de consentement RGPD
- ❌ Pas de métadonnées eIDAS
- ❌ Pas de hash du document
- ❌ Pas de certificat de signature
- ❌ Pas de traçabilité

---

#### ✅ APRÈS (SecureSignaturePad.jsx - Conforme)

```javascript
import React, { useState } from 'react';
import SecureSignaturePad from '../components/SecureSignaturePad';
import useSecureSignature from '../hooks/useSecureSignature';

function MyComponent({ intervention }) {
  const [showSignature, setShowSignature] = useState(false);
  const { isCreating, error } = useSecureSignature();

  const handleSignatureSave = async (signatureData) => {
    // signatureData contient:
    // - signature: Enregistrement complet avec métadonnées
    // - certificate: Certificat eIDAS
    // - documentHash: Hash SHA-256 du document

    console.log('✅ Signature conforme eIDAS créée:', signatureData.signature.id);

    // Mettre à jour l'intervention avec la référence à la signature
    await updateIntervention({
      ...intervention,
      electronic_signature_id: signatureData.signature.id, // Référence
      is_signed: true,
      signed_at: signatureData.signature.signed_at
    });

    setShowSignature(false);
  };

  return (
    <div>
      {!intervention.is_signed ? (
        <button onClick={() => setShowSignature(true)}>
          ✍️ Signer l'intervention
        </button>
      ) : (
        <SignatureDisplay signatureId={intervention.electronic_signature_id} />
      )}

      {showSignature && (
        <SecureSignaturePad
          documentType="intervention"
          documentId={intervention.id}
          documentData={intervention} // Document complet pour hash
          signatureContext={{
            clientName: intervention.client_name,
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

### 3️⃣ Affichage d'une Signature Sécurisée

```javascript
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getSignatureImageUrl, verifyElectronicSignature } from '../services/electronicSignatureService';

function SignatureDisplay({ signatureId }) {
  const [signature, setSignature] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSignature();
  }, [signatureId]);

  const loadSignature = async () => {
    try {
      // 1. Charger les données de signature
      const { data, error } = await supabase
        .from('electronic_signatures')
        .select('*')
        .eq('id', signatureId)
        .single();

      if (error) throw error;

      setSignature(data);

      // 2. Obtenir l'URL signée de l'image
      if (data.signature_image_url) {
        const url = await getSignatureImageUrl(data.signature_image_url);
        setImageUrl(url);
      }

      // 3. Vérifier la validité (optionnel)
      // const verif = await verifyElectronicSignature(signatureId, currentDocument);
      // setVerification(verif);

    } catch (err) {
      console.error('Erreur chargement signature:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement signature...</div>;
  if (!signature) return <div>Signature introuvable</div>;

  const certificate = JSON.parse(signature.signature_certificate);

  return (
    <div className="signature-display">
      <h3>✅ Document Signé Électroniquement</h3>

      {/* Image de signature */}
      {imageUrl && (
        <div className="signature-image">
          <img src={imageUrl} alt="Signature" style={{ maxWidth: 300, border: '1px solid #ccc' }} />
        </div>
      )}

      {/* Informations signataire */}
      <div className="signature-info">
        <p><strong>Signé par :</strong> {signature.signer_name}</p>
        <p><strong>Email :</strong> {signature.signer_email}</p>
        <p><strong>Date :</strong> {new Date(signature.signed_at).toLocaleString('fr-FR')}</p>
        <p><strong>Rôle :</strong> {signature.signer_role}</p>
      </div>

      {/* Badge de conformité */}
      <div className="compliance-badge">
        <span className="badge eidas">🔐 Conforme eIDAS (AES)</span>
        <span className="badge rgpd">🛡️ Conforme RGPD</span>
      </div>

      {/* Certificat */}
      <details>
        <summary>📜 Voir le certificat de signature</summary>
        <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify(certificate, null, 2)}
        </pre>
      </details>

      {/* Hash du document */}
      <details>
        <summary>🔒 Hash d'intégrité (SHA-256)</summary>
        <code style={{ wordBreak: 'break-all', display: 'block', padding: '0.5rem', background: '#f5f5f5' }}>
          {signature.document_hash}
        </code>
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
          Ce hash cryptographique garantit que le document n'a pas été modifié après signature.
        </p>
      </details>

      {/* Vérification */}
      {verification && (
        <div className={`verification ${verification.valid ? 'valid' : 'invalid'}`}>
          {verification.valid ? (
            <p>✅ Signature valide - Document intact</p>
          ) : (
            <p>❌ Signature invalide - {verification.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SignatureDisplay;
```

---

### 4️⃣ Migration des Signatures Existantes (Optionnel)

Si vous avez déjà des signatures dans l'ancien format (base64 direct), vous pouvez créer un script de migration :

```javascript
// scripts/migrateSignatures.js
import { supabase } from '../lib/supabase';
import { createElectronicSignature } from '../services/electronicSignatureService';

async function migrateOldSignatures() {
  console.log('🔄 Migration des anciennes signatures...');

  // 1. Récupérer toutes les interventions avec anciennes signatures
  const { data: interventions, error } = await supabase
    .from('interventions')
    .select('*')
    .not('signature', 'is', null)
    .is('electronic_signature_id', null); // Pas encore migrées

  if (error) {
    console.error('Erreur récupération interventions:', error);
    return;
  }

  console.log(`📊 ${interventions.length} signatures à migrer`);

  let migrated = 0;
  let failed = 0;

  for (const intervention of interventions) {
    try {
      console.log(`Migrating intervention ${intervention.id}...`);

      // Créer signature électronique à partir de l'ancienne
      const result = await createElectronicSignature({
        // Signataire (estimation basée sur les données disponibles)
        userId: intervention.user_id || intervention.created_by,
        signerName: intervention.client_name || 'Signataire inconnu',
        signerEmail: intervention.client_email || 'email@inconnu.fr',
        signerRole: 'client',

        // Document
        documentType: 'intervention',
        documentId: intervention.id,
        documentData: intervention,

        // Signature (ancienne)
        signatureImageBase64: intervention.signature,

        // Consentement (rétroactif - à adapter selon vos besoins légaux)
        consentGiven: true,
        consentText: 'Migration rétroactive - Consentement implicite par signature manuscrite antérieure',

        // Contexte
        signatureContext: {
          migrated: true,
          originalDate: intervention.updated_at,
          migratedAt: new Date().toISOString()
        }
      });

      if (result.success) {
        // Mettre à jour l'intervention avec la nouvelle signature
        await supabase
          .from('interventions')
          .update({
            electronic_signature_id: result.signature.id,
            is_signed: true,
            // Garder l'ancienne signature pour l'historique
            legacy_signature: intervention.signature,
            signature: null // Supprimer l'ancien champ
          })
          .eq('id', intervention.id);

        migrated++;
        console.log(`✅ Migration réussie: ${intervention.id}`);
      } else {
        failed++;
        console.error(`❌ Échec migration ${intervention.id}:`, result.error);
      }

    } catch (err) {
      failed++;
      console.error(`❌ Erreur migration ${intervention.id}:`, err);
    }
  }

  console.log('\n📊 Résultat de la migration:');
  console.log(`✅ Migrées: ${migrated}`);
  console.log(`❌ Échecs: ${failed}`);
  console.log(`📈 Total: ${interventions.length}`);
}

// Exécuter
migrateOldSignatures().catch(console.error);
```

**⚠️ ATTENTION** : La migration rétroactive doit être **justifiée juridiquement**. Consultez votre DPO ou un avocat avant de migrer des signatures existantes.

---

### 5️⃣ Mise à Jour du Schéma de Base de Données

Ajouter les colonnes nécessaires aux tables existantes :

```sql
-- Ajouter référence à la signature électronique
ALTER TABLE interventions
ADD COLUMN IF NOT EXISTS electronic_signature_id UUID REFERENCES electronic_signatures(id),
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS legacy_signature TEXT; -- Pour archiver anciennes signatures

-- Même chose pour les CERFA
ALTER TABLE cerfa_documents
ADD COLUMN IF NOT EXISTS electronic_signature_id UUID REFERENCES electronic_signatures(id),
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false;

-- Et pour les contrats
ALTER TABLE contracts_list
ADD COLUMN IF NOT EXISTS electronic_signature_id UUID REFERENCES electronic_signatures(id),
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_interventions_signature
  ON interventions(electronic_signature_id);

CREATE INDEX IF NOT EXISTS idx_cerfa_signature
  ON cerfa_documents(electronic_signature_id);
```

---

### 6️⃣ Intégration dans les Pages Existantes

#### Intervention Detail Page

```javascript
// pages/InterventionDetailView.jsx
import React, { useState } from 'react';
import SecureSignaturePad from '../components/SecureSignaturePad';
import SignatureDisplay from '../components/SignatureDisplay';

function InterventionDetailView({ intervention }) {
  const [showSignature, setShowSignature] = useState(false);

  return (
    <div className="intervention-detail">
      {/* ... reste du formulaire ... */}

      {/* Section Signature */}
      <div className="signature-section">
        <h3>Signature Client</h3>

        {intervention.is_signed ? (
          <SignatureDisplay signatureId={intervention.electronic_signature_id} />
        ) : (
          <>
            <p>Cette intervention n'est pas encore signée.</p>
            <button onClick={() => setShowSignature(true)}>
              ✍️ Signer l'intervention
            </button>
          </>
        )}

        {showSignature && (
          <SecureSignaturePad
            documentType="intervention"
            documentId={intervention.id}
            documentData={intervention}
            signatureContext={{
              clientName: intervention.client_name,
              interventionType: intervention.type,
              address: intervention.address
            }}
            onSave={async (signatureData) => {
              await updateIntervention({
                ...intervention,
                electronic_signature_id: signatureData.signature.id,
                is_signed: true,
                signed_at: signatureData.signature.signed_at
              });
              setShowSignature(false);
            }}
            onCancel={() => setShowSignature(false)}
          />
        )}
      </div>
    </div>
  );
}
```

---

### 7️⃣ Export PDF avec Signature Conforme

```javascript
// utils/pdfExport.js
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { getSignatureImageUrl } from '../services/electronicSignatureService';

async function exportInterventionPDF(intervention) {
  const pdf = new jsPDF();

  // ... Contenu du PDF ...

  // Si l'intervention est signée
  if (intervention.electronic_signature_id) {
    // Charger la signature
    const { data: signature } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('id', intervention.electronic_signature_id)
      .single();

    if (signature) {
      // Obtenir l'image
      const imageUrl = await getSignatureImageUrl(signature.signature_image_url);

      // Ajouter au PDF
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Signature Électronique Conforme eIDAS', 20, 20);

      // Image de signature
      if (imageUrl) {
        pdf.addImage(imageUrl, 'PNG', 20, 40, 80, 40);
      }

      // Informations
      pdf.setFontSize(10);
      pdf.text(`Signé par: ${signature.signer_name}`, 20, 90);
      pdf.text(`Email: ${signature.signer_email}`, 20, 100);
      pdf.text(`Date: ${new Date(signature.signed_at).toLocaleString('fr-FR')}`, 20, 110);

      // Certificat
      pdf.setFontSize(8);
      pdf.text('Niveau de signature: Signature Électronique Avancée (AES) - Règlement eIDAS (UE) 910/2014', 20, 120);
      pdf.text(`Hash du document (SHA-256): ${signature.document_hash}`, 20, 130);
      pdf.text(`Certificat: ${signature.id}`, 20, 140);

      // Badge de conformité
      pdf.setFillColor(76, 175, 80);
      pdf.rect(20, 150, 60, 10, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text('✓ Conforme eIDAS & RGPD', 25, 157);
    }
  }

  return pdf;
}
```

---

## ✅ CHECKLIST DE MIGRATION

- [ ] Table `electronic_signatures` créée
- [ ] Bucket `signature-files` créé
- [ ] RLS policies activées
- [ ] Colonnes `electronic_signature_id` ajoutées aux tables
- [ ] `SecureSignaturePad` intégré dans les pages
- [ ] `SignatureDisplay` créé pour affichage
- [ ] Hook `useSecureSignature` importé où nécessaire
- [ ] Anciennes signatures migrées (optionnel)
- [ ] Export PDF mis à jour
- [ ] Tests effectués
- [ ] Documentation mise à jour
- [ ] Mentions légales mises à jour avec info signatures
- [ ] Contact DPO ajouté

---

## 🧪 TESTS RECOMMANDÉS

```javascript
// Test 1: Créer une signature
test('Signature électronique conforme', async () => {
  const result = await createElectronicSignature({
    userId: 'test-user-id',
    signerName: 'Jean Dupont',
    signerEmail: 'jean@example.com',
    signerRole: 'client',
    documentType: 'intervention',
    documentId: 'test-intervention-id',
    documentData: { foo: 'bar' },
    signatureImageBase64: 'data:image/png;base64,...',
    consentGiven: true,
    consentText: 'Consentement test'
  });

  expect(result.success).toBe(true);
  expect(result.signature.signature_level).toBe('AES');
  expect(result.certificate.standard).toBe('eIDAS-AES');
});

// Test 2: Vérifier intégrité
test('Vérification intégrité document', async () => {
  const originalDoc = { foo: 'bar' };
  const modifiedDoc = { foo: 'baz' };

  // Créer signature
  const { signature } = await createElectronicSignature({ documentData: originalDoc, ... });

  // Vérifier avec document original
  const valid = await verifyElectronicSignature(signature.id, originalDoc);
  expect(valid.valid).toBe(true);

  // Vérifier avec document modifié
  const invalid = await verifyElectronicSignature(signature.id, modifiedDoc);
  expect(invalid.valid).toBe(false);
  expect(invalid.reason).toContain('modifié');
});

// Test 3: RGPD - Suppression
test('Droit à l\'effacement RGPD', async () => {
  const { signature } = await createElectronicSignature({ ... });

  const result = await deleteElectronicSignature(signature.id, userId);
  expect(result.success).toBe(true);

  // Vérifier que c'est bien supprimé
  const { data } = await supabase
    .from('electronic_signatures')
    .select('*')
    .eq('id', signature.id)
    .single();

  expect(data).toBeNull();
});
```

---

## 📞 SUPPORT

Pour toute question sur la migration :
- **Technique** : dev@votre-entreprise.fr
- **Juridique/RGPD** : rgpd@votre-entreprise.fr
- **Documentation** : Voir `SIGNATURE_COMPLIANCE.md`

---

**Bonne migration ! 🚀**
