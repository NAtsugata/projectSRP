/**
 * ====================================================================
 * EXEMPLE D'INTÉGRATION: Signature Électronique
 * ====================================================================
 * Ce fichier montre comment intégrer le système de signature
 * dans votre application (ex: signature d'une intervention)
 *
 * ⚠️ CE FICHIER EST UN EXEMPLE - NE PAS L'IMPORTER DANS L'APPLICATION
 * ====================================================================
 */

import React, { useState, useEffect } from 'react';
import { ElectronicSignaturePad, SignatureViewer } from './index';
import useElectronicSignature from '../../hooks/useElectronicSignature';
import { supabase } from '../../lib/supabase';

/**
 * EXEMPLE 1: Signature d'une Intervention
 */
export function InterventionSignatureExample({ interventionId }) {
  const [intervention, setIntervention] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureCompleted, setSignatureCompleted] = useState(false);

  // Charger l'intervention
  useEffect(() => {
    loadIntervention();
  }, [interventionId]);

  const loadIntervention = async () => {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', interventionId)
      .single();

    if (data) {
      setIntervention(data);
    }
  };

  // Callback de succès
  const handleSignatureComplete = async (signatureData) => {
    console.log('✅ Signature enregistrée:', signatureData);

    // Mettre à jour l'intervention avec l'ID de la signature
    const { error } = await supabase
      .from('interventions')
      .update({
        electronic_signature_id: signatureData.signatureId,
        is_signed: true,
        signed_at: signatureData.signedAt,
      })
      .eq('id', interventionId);

    if (!error) {
      setSignatureCompleted(true);
      setShowSignaturePad(false);
      alert('✅ Intervention signée avec succès !');
    }
  };

  if (!intervention) {
    return <div>Chargement de l'intervention...</div>;
  }

  return (
    <div className="intervention-signature-container">
      <h2>Intervention #{intervention.id}</h2>

      {/* Bouton pour ouvrir le pad de signature */}
      {!signatureCompleted && !showSignaturePad && (
        <button
          onClick={() => setShowSignaturePad(true)}
          className="btn-primary"
        >
          ✍️ Signer l'intervention
        </button>
      )}

      {/* Pad de signature */}
      {showSignaturePad && (
        <ElectronicSignaturePad
          documentType="intervention"
          documentId={interventionId}
          documentContent={JSON.stringify(intervention)} // Contenu du document pour le hash
          signerInfo={{
            // Les informations seront automatiquement récupérées depuis le profil
            // mais vous pouvez les surcharger si besoin
            context: {
              client: intervention.client_name,
              site: intervention.site_name,
              description: intervention.description,
            },
          }}
          requestGeolocation={false} // Mettre à true pour demander la géolocalisation
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}

      {/* Affichage de la signature si elle existe */}
      {intervention.electronic_signature_id && (
        <div className="signature-display">
          <h3>Signature électronique</h3>
          <SignatureViewer
            signatureId={intervention.electronic_signature_id}
            showCertificate={true}
            showMetadata={false}
            compact={false}
          />
        </div>
      )}
    </div>
  );
}

/**
 * EXEMPLE 2: Vérifier si un document est signé
 */
export function CheckSignatureExample() {
  const { isDocumentSigned, getLatestSignature } = useElectronicSignature();
  const [isSigned, setIsSigned] = useState(false);
  const [signature, setSignature] = useState(null);

  const checkSignature = async (documentType, documentId) => {
    // Méthode 1: Vérification simple
    const signed = await isDocumentSigned(documentType, documentId);
    setIsSigned(signed);

    // Méthode 2: Récupérer la signature complète
    if (signed) {
      const sig = await getLatestSignature(documentType, documentId);
      setSignature(sig);
    }
  };

  return (
    <div>
      <h3>Vérification de signature</h3>
      <button onClick={() => checkSignature('intervention', 'uuid-here')}>
        Vérifier
      </button>

      {isSigned && <p>✅ Document signé</p>}
      {signature && <SignatureViewer signatureData={signature} compact />}
    </div>
  );
}

/**
 * EXEMPLE 3: Signature avec Modal
 */
export function ModalSignatureExample({ interventionId, onClose }) {
  const [intervention, setIntervention] = useState(null);

  useEffect(() => {
    // Charger l'intervention
    loadIntervention();
  }, []);

  const loadIntervention = async () => {
    const { data } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', interventionId)
      .single();

    setIntervention(data);
  };

  const handleComplete = (signatureData) => {
    // Mettre à jour l'intervention
    supabase
      .from('interventions')
      .update({
        electronic_signature_id: signatureData.signatureId,
        is_signed: true,
        signed_at: signatureData.signedAt,
      })
      .eq('id', interventionId)
      .then(() => {
        alert('✅ Signature enregistrée !');
        onClose();
      });
  };

  if (!intervention) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <ElectronicSignaturePad
          documentType="intervention"
          documentId={interventionId}
          documentContent={JSON.stringify(intervention)}
          onSignatureComplete={handleComplete}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

/**
 * EXEMPLE 4: Liste des signatures d'un utilisateur
 */
export function UserSignaturesExample() {
  const [signatures, setSignatures] = useState([]);

  useEffect(() => {
    loadUserSignatures();
  }, []);

  const loadUserSignatures = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('user_id', user.id)
      .order('signed_at', { ascending: false });

    setSignatures(data || []);
  };

  return (
    <div className="user-signatures">
      <h2>Mes signatures</h2>
      {signatures.map((sig) => (
        <SignatureViewer
          key={sig.id}
          signatureData={sig}
          compact
          showCertificate={false}
        />
      ))}
    </div>
  );
}

/**
 * EXEMPLE 5: Révoquer une signature (RGPD)
 */
export function RevokeSignatureExample({ signatureId }) {
  const { revokeSignature } = useElectronicSignature();

  const handleRevoke = async () => {
    const reason = prompt('Raison de la révocation:');
    if (!reason) return;

    try {
      await revokeSignature(signatureId, reason);
      alert('✅ Signature révoquée');
    } catch (err) {
      alert('❌ Erreur: ' + err.message);
    }
  };

  return (
    <button onClick={handleRevoke} className="btn-danger">
      ⚠️ Révoquer cette signature
    </button>
  );
}

/**
 * EXEMPLE 6: Intégration complète dans un formulaire
 */
export function CompleteFormExample() {
  const [formData, setFormData] = useState({
    client: '',
    description: '',
  });
  const [showSignature, setShowSignature] = useState(false);
  const [interventionId, setInterventionId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Créer l'intervention
    const { data, error } = await supabase
      .from('interventions')
      .insert({
        client_name: formData.client,
        description: formData.description,
        status: 'pending_signature',
      })
      .select()
      .single();

    if (error) {
      alert('❌ Erreur: ' + error.message);
      return;
    }

    // 2. Afficher le pad de signature
    setInterventionId(data.id);
    setShowSignature(true);
  };

  const handleSignatureComplete = async (signatureData) => {
    // 3. Mettre à jour l'intervention avec la signature
    await supabase
      .from('interventions')
      .update({
        electronic_signature_id: signatureData.signatureId,
        is_signed: true,
        signed_at: signatureData.signedAt,
        status: 'completed',
      })
      .eq('id', interventionId);

    alert('✅ Intervention créée et signée !');
    setShowSignature(false);
    setFormData({ client: '', description: '' });
  };

  return (
    <div>
      {!showSignature ? (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Client"
            value={formData.client}
            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          <button type="submit">Créer et signer</button>
        </form>
      ) : (
        <ElectronicSignaturePad
          documentType="intervention"
          documentId={interventionId}
          documentContent={JSON.stringify(formData)}
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignature(false)}
        />
      )}
    </div>
  );
}

/**
 * ====================================================================
 * GUIDE D'UTILISATION RAPIDE
 * ====================================================================
 *
 * 1. IMPORTER LES COMPOSANTS:
 *
 * import { ElectronicSignaturePad, SignatureViewer } from './components/signatures';
 * import useElectronicSignature from './hooks/useElectronicSignature';
 *
 *
 * 2. UTILISER LE PAD DE SIGNATURE:
 *
 * <ElectronicSignaturePad
 *   documentType="intervention"
 *   documentId="uuid-de-l-intervention"
 *   documentContent={JSON.stringify(intervention)}
 *   onSignatureComplete={(data) => console.log('Signé!', data)}
 *   onCancel={() => console.log('Annulé')}
 * />
 *
 *
 * 3. AFFICHER UNE SIGNATURE:
 *
 * <SignatureViewer signatureId="uuid-de-la-signature" />
 *
 *
 * 4. UTILISER LE HOOK:
 *
 * const { isDocumentSigned, getLatestSignature } = useElectronicSignature();
 *
 * const signed = await isDocumentSigned('intervention', interventionId);
 * const signature = await getLatestSignature('intervention', interventionId);
 *
 *
 * 5. AJOUTER LA COLONNE À VOTRE TABLE (SQL):
 *
 * ALTER TABLE public.interventions
 * ADD COLUMN IF NOT EXISTS electronic_signature_id UUID
 *   REFERENCES public.electronic_signatures(id) ON DELETE SET NULL,
 * ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false,
 * ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
 *
 * ====================================================================
 */
