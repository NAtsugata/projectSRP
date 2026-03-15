-- ====================================================================
-- TABLE: electronic_signatures
-- Description: Signatures électroniques conformes eIDAS (AES) et RGPD
-- Norme: Règlement eIDAS (UE) 910/2014 + RGPD (UE) 2016/679
-- ====================================================================

-- 1. Créer le bucket Storage pour les images de signature
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-files', 'signature-files', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Créer la table des signatures électroniques
CREATE TABLE IF NOT EXISTS public.electronic_signatures (
  -- Identifiant unique
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SIGNATAIRE (eIDAS - Identification)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_role TEXT, -- 'admin', 'manager', 'technician', 'client', etc.

  -- DOCUMENT SIGNÉ (eIDAS - Intégrité)
  document_type TEXT NOT NULL, -- 'intervention', 'cerfa', 'contract', 'pv_reception', etc.
  document_id UUID NOT NULL, -- ID du document dans sa table respective
  document_hash TEXT NOT NULL, -- Hash SHA-256 du document (preuve d'intégrité)

  -- SIGNATURE (eIDAS - Non-répudiation)
  signature_image_hash TEXT NOT NULL, -- Hash SHA-256 de l'image de signature
  signature_image_url TEXT, -- Chemin dans Storage (bucket signature-files)
  signature_certificate JSONB NOT NULL, -- Certificat de signature (preuve complète)

  -- MÉTADONNÉES TECHNIQUES (eIDAS - Non-répudiation)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Contient: userAgent, platform, language, screenResolution, timezone,
  -- geolocation (optionnel), connectionType, etc.

  -- CONTEXTE DE SIGNATURE
  signature_context JSONB DEFAULT '{}'::jsonb,
  -- Contexte métier: type intervention, client, etc.

  -- CONSENTEMENT RGPD
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT NOT NULL, -- Texte exact du consentement affiché
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- HORODATAGE (eIDAS - Timestamp fiable)
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NIVEAU DE SIGNATURE (eIDAS)
  signature_level TEXT NOT NULL DEFAULT 'AES',
  -- 'SES' = Simple Electronic Signature
  -- 'AES' = Advanced Electronic Signature (défaut)
  -- 'QES' = Qualified Electronic Signature (nécessite certificat qualifié)

  -- VALIDITÉ ET RÉVOCATION (RGPD - Droit à l'effacement)
  is_valid BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  revoked_by UUID REFERENCES auth.users(id),

  -- TIMESTAMPS
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index pour performance
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_user_id
  ON public.electronic_signatures(user_id);

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_document
  ON public.electronic_signatures(document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_signed_at
  ON public.electronic_signatures(signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_valid
  ON public.electronic_signatures(is_valid)
  WHERE is_valid = true;

-- 4. Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_electronic_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_electronic_signatures_updated_at
  BEFORE UPDATE ON public.electronic_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_electronic_signatures_updated_at();

-- 5. ROW LEVEL SECURITY (RGPD - Protection données)
ALTER TABLE public.electronic_signatures ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres signatures
CREATE POLICY "Users can view own signatures"
  ON public.electronic_signatures
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Politique: Seul le service backend peut créer des signatures
-- (via service account ou fonction edge)
CREATE POLICY "Service can create signatures"
  ON public.electronic_signatures
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Politique: Les utilisateurs peuvent révoquer leurs signatures (RGPD)
CREATE POLICY "Users can revoke own signatures"
  ON public.electronic_signatures
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Politique: Les utilisateurs peuvent supprimer leurs signatures (RGPD - Droit à l'effacement)
CREATE POLICY "Users can delete own signatures"
  ON public.electronic_signatures
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 6. Politiques Storage pour signature-files
CREATE POLICY "Users can upload own signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signature-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own signature files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signature-files' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      )
    )
  );

CREATE POLICY "Users can delete own signature files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'signature-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Commentaires de documentation
COMMENT ON TABLE public.electronic_signatures IS
  'Signatures électroniques conformes eIDAS (AES) et RGPD';

COMMENT ON COLUMN public.electronic_signatures.document_hash IS
  'Hash SHA-256 du document (preuve intégrité eIDAS)';

COMMENT ON COLUMN public.electronic_signatures.signature_certificate IS
  'Certificat de signature complet (non-répudiation eIDAS)';

COMMENT ON COLUMN public.electronic_signatures.consent_given IS
  'Consentement explicite RGPD pour traitement données signature';

COMMENT ON COLUMN public.electronic_signatures.signature_level IS
  'Niveau signature eIDAS: SES, AES, ou QES';

-- 8. Fonction helper: Vérifier si un document est signé
CREATE OR REPLACE FUNCTION public.is_document_signed(
  p_document_type TEXT,
  p_document_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.electronic_signatures
    WHERE document_type = p_document_type
      AND document_id = p_document_id
      AND is_valid = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Fonction helper: Obtenir la dernière signature valide d'un document
CREATE OR REPLACE FUNCTION public.get_latest_signature(
  p_document_type TEXT,
  p_document_id UUID
)
RETURNS SETOF public.electronic_signatures AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.electronic_signatures
  WHERE document_type = p_document_type
    AND document_id = p_document_id
    AND is_valid = true
  ORDER BY signed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Vue pour audit RGPD (pour les admins)
CREATE OR REPLACE VIEW public.signature_audit_log AS
SELECT
  id,
  user_id,
  signer_name,
  signer_email,
  document_type,
  document_id,
  signed_at,
  is_valid,
  revoked_at,
  revocation_reason,
  created_at
FROM public.electronic_signatures
ORDER BY signed_at DESC;

-- Grant accès aux admins seulement
GRANT SELECT ON public.signature_audit_log TO authenticated;

-- ====================================================================
-- FIN DE LA MIGRATION
-- ====================================================================

-- Exemple d'utilisation:
--
-- -- Vérifier si un document est signé
-- SELECT public.is_document_signed('intervention', 'uuid-here');
--
-- -- Obtenir la dernière signature
-- SELECT * FROM public.get_latest_signature('cerfa', 'uuid-here');
--
-- -- Audit trail RGPD
-- SELECT * FROM public.signature_audit_log WHERE user_id = 'uuid-here';
