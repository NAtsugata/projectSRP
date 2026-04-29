# 🚀 Démarrage Rapide - Signatures Électroniques eIDAS

## ✅ Installation Terminée !

Le système de signature électronique conforme **eIDAS (AES)** et **RGPD** est installé et prêt à l'emploi !

---

## 📦 Fichiers Créés

```
✅ src/lib/signature/signatureUtils.js          # Utilitaires (hash, certificat)
✅ src/hooks/useElectronicSignature.js          # Hook React
✅ src/components/signatures/
   ├── ElectronicSignaturePad.jsx              # Composant de capture
   ├── ElectronicSignaturePad.css              # Styles
   ├── SignatureViewer.jsx                     # Affichage signature
   ├── SignatureViewer.css                     # Styles
   ├── IntegrationExample.jsx                  # Exemples d'usage
   ├── index.js                                # Exports
   └── README.md                               # Documentation complète
```

---

## 🎯 Test Rapide (2 minutes)

### **1. Créer une page de test**

Créez `src/pages/TestSignature.jsx` :

```jsx
import React, { useState } from 'react';
import { ElectronicSignaturePad } from '../components/signatures';

export default function TestSignature() {
  const [showPad, setShowPad] = useState(false);
  const [signatureId, setSignatureId] = useState(null);

  const handleComplete = (data) => {
    console.log('✅ Signature enregistrée:', data);
    setSignatureId(data.signatureId);
    setShowPad(false);
    alert('Signature enregistrée avec succès !');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>🧪 Test Signature Électronique</h1>

      {!showPad && !signatureId && (
        <button onClick={() => setShowPad(true)} style={{ padding: '12px 24px' }}>
          ✍️ Signer
        </button>
      )}

      {showPad && (
        <ElectronicSignaturePad
          documentType="test"
          documentId={crypto.randomUUID()}
          documentContent={JSON.stringify({ test: true, date: new Date() })}
          onSignatureComplete={handleComplete}
          onCancel={() => setShowPad(false)}
        />
      )}

      {signatureId && (
        <div style={{ marginTop: '20px' }}>
          <h3>✅ Signature ID: {signatureId}</h3>
          <p>Vérifiez dans Supabase → Table "electronic_signatures"</p>
        </div>
      )}
    </div>
  );
}
```

### **2. Ajouter la route dans App.jsx**

```jsx
import TestSignature from './pages/TestSignature';

// Dans vos routes:
<Route path="/test-signature" element={<TestSignature />} />
```

### **3. Tester !**

1. Aller sur `/test-signature`
2. Cliquer "Signer"
3. Dessiner votre signature
4. Cocher le consentement RGPD
5. Valider

✅ **C'est prêt !**

---

## 🔗 Intégration dans Interventions

### **Étape 1: Ajouter les colonnes SQL**

Exécutez dans **Supabase SQL Editor** :

```sql
-- Ajouter les colonnes de signature aux interventions
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS electronic_signature_id UUID
  REFERENCES public.electronic_signatures(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_interventions_signature
  ON public.interventions(electronic_signature_id);
```

### **Étape 2: Utiliser dans votre code**

```jsx
import { ElectronicSignaturePad, SignatureViewer } from '../components/signatures';
import useElectronicSignature from '../hooks/useElectronicSignature';

function InterventionDetail({ interventionId }) {
  const [intervention, setIntervention] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const handleSignatureComplete = async (signatureData) => {
    // Mettre à jour l'intervention
    await supabase
      .from('interventions')
      .update({
        electronic_signature_id: signatureData.signatureId,
        is_signed: true,
        signed_at: signatureData.signedAt,
      })
      .eq('id', interventionId);

    setShowSignaturePad(false);
    alert('✅ Intervention signée !');
  };

  return (
    <div>
      {/* Bouton signer */}
      {!intervention?.is_signed && (
        <button onClick={() => setShowSignaturePad(true)}>
          ✍️ Signer l'intervention
        </button>
      )}

      {/* Pad de signature */}
      {showSignaturePad && (
        <ElectronicSignaturePad
          documentType="intervention"
          documentId={interventionId}
          documentContent={JSON.stringify(intervention)}
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}

      {/* Afficher la signature si elle existe */}
      {intervention?.electronic_signature_id && (
        <SignatureViewer
          signatureId={intervention.electronic_signature_id}
          showCertificate={true}
        />
      )}
    </div>
  );
}
```

---

## 📖 Documentation Complète

👉 **Lisez `src/components/signatures/README.md`** pour :

- Toutes les props des composants
- Guide complet du hook `useElectronicSignature`
- Exemples avancés
- Troubleshooting
- Conformité eIDAS & RGPD

👉 **Consultez `src/components/signatures/IntegrationExample.jsx`** pour 6 exemples complets :

1. Signature d'intervention
2. Vérification de signature
3. Modal de signature
4. Liste des signatures utilisateur
5. Révocation de signature (RGPD)
6. Formulaire complet avec signature

---

## 🔐 Sécurité & Conformité

✅ **eIDAS (UE) 910/2014** - Advanced Electronic Signature (AES)
✅ **RGPD (UE) 2016/679** - Consentement + Droit à l'effacement
✅ **Hash SHA-256** - Intégrité document + signature
✅ **Certificat complet** - Métadonnées + horodatage
✅ **Storage privé** - URL signées (1h)
✅ **RLS activé** - Row Level Security
✅ **Révocation** - Droit RGPD respecté

---

## 🧪 Vérification Base de Données

```sql
-- Voir toutes les signatures
SELECT * FROM public.electronic_signatures ORDER BY signed_at DESC;

-- Vérifier si un document est signé
SELECT public.is_document_signed('intervention', 'uuid-ici');

-- Voir le certificat eIDAS complet
SELECT signature_certificate FROM public.electronic_signatures LIMIT 1;

-- Voir les signatures valides
SELECT count(*) FROM public.electronic_signatures WHERE is_valid = true;

-- Audit trail RGPD
SELECT * FROM public.signature_audit_log;
```

---

## 📊 Structure du Certificat eIDAS

Chaque signature contient un certificat JSON complet :

```json
{
  "version": "1.0",
  "standard": "eIDAS-AES",
  "signatureLevel": "AES",
  "timestamp": "2026-03-15T10:30:00Z",
  "signer": {
    "id": "uuid",
    "name": "Jean Dupont",
    "email": "jean@example.com"
  },
  "integrity": {
    "documentHash": "sha256...",
    "signatureImageHash": "sha256...",
    "certificateHash": "sha256...",
    "hashAlgorithm": "SHA-256"
  },
  "technical": {
    "userAgent": "...",
    "platform": "...",
    "timezone": "Europe/Paris"
  },
  "compliance": {
    "eIDAS": "EU 910/2014",
    "RGPD": "EU 2016/679"
  }
}
```

---

## 🎨 Personnalisation

### **Modifier le style du canvas**

Éditez `src/components/signatures/ElectronicSignaturePad.css` :

```css
.signature-canvas {
  cursor: crosshair;
  background: #ffffff; /* Fond blanc */
  border: 2px dashed #3498db; /* Bordure bleue */
}
```

### **Changer la couleur du trait**

Éditez `src/components/signatures/ElectronicSignaturePad.jsx` ligne ~68 :

```jsx
ctx.strokeStyle = '#000000'; // Noir (défaut)
ctx.lineWidth = 2; // Épaisseur
```

### **Modifier le texte de consentement**

Éditez `src/lib/signature/signatureUtils.js` ligne ~390 :

```js
export const CONSENT_TEXT = {
  FR: `Votre texte personnalisé ici...`,
};
```

---

## 🐛 Problèmes Fréquents

### **Erreur: "Impossible de charger la signature"**

✅ Vérifier que le bucket `signature-files` existe
✅ Vérifier les politiques RLS Storage
✅ Vérifier que l'utilisateur est authentifié

### **La signature ne s'affiche pas**

✅ L'URL signée expire après 1h → recharger
✅ Vérifier que `signature_image_url` est renseigné
✅ Vérifier les permissions Storage

### **Canvas vide après dessin**

✅ Vérifier que le navigateur supporte Canvas
✅ Vérifier la console pour les erreurs JavaScript
✅ Tester dans un autre navigateur

---

## 🎉 C'est Tout !

Le système est **prêt à l'emploi** !

**Prochaines étapes recommandées :**

1. ✅ Tester avec la page de test
2. ✅ Ajouter les colonnes SQL à vos tables
3. ✅ Intégrer dans vos formulaires
4. ✅ Former vos utilisateurs

**Questions ?** Consultez `src/components/signatures/README.md` ! 📖

---

## 📞 Support

- Documentation complète : `src/components/signatures/README.md`
- Exemples d'intégration : `src/components/signatures/IntegrationExample.jsx`
- Règlement eIDAS : [EUR-Lex](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32014R0910)
- RGPD : [EUR-Lex](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679)

**Bon développement ! 🚀**
