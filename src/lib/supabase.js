-- =====================================================
-- CONFIGURATION COMPLÈTE SUPABASE OPTIMISÉE MOBILE
-- À exécuter dans l'onglet SQL de votre dashboard Supabase
-- =====================================================

-- ✅ 1. VÉRIFICATION ET CRÉATION DES BUCKETS SI NÉCESSAIRE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('intervention-files', 'intervention-files', true, 20971520, ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain'
  ]),
  ('vault-files', 'vault-files', false, 15728640, ARRAY[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- ✅ 2. SUPPRESSION DES ANCIENNES POLITIQUES
DROP POLICY IF EXISTS "Authenticated users can upload intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own vault folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own vault files" ON storage.objects;

-- ✅ 3. POLITIQUES RLS OPTIMISÉES POUR INTERVENTION-FILES

-- 3a. Upload intervention-files (avec vérification taille et type)
CREATE POLICY "Optimized upload intervention files"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'intervention-files' 
  AND auth.role() = 'authenticated'
  AND (metadata->>'size')::bigint <= 20971520  -- 20MB max
  AND (
    (metadata->>'mimetype') LIKE 'image/%' OR 
    (metadata->>'mimetype') = 'application/pdf' OR
    (metadata->>'mimetype') = 'text/plain'
  )
);

-- 3b. Lecture intervention-files (public pour CDN)
CREATE POLICY "Public read intervention files"
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'intervention-files');

-- 3c. Mise à jour intervention-files
CREATE POLICY "Authenticated update intervention files"
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'intervention-files' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'intervention-files' 
  AND (metadata->>'size')::bigint <= 20971520
);

-- 3d. Suppression intervention-files
CREATE POLICY "Authenticated delete intervention files"
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'intervention-files' 
  AND auth.role() = 'authenticated'
);

-- ✅ 4. POLITIQUES RLS SÉCURISÉES POUR VAULT-FILES

-- 4a. Upload vault-files (utilisateur propriétaire uniquement)
CREATE POLICY "Secure upload vault files"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'vault-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (metadata->>'size')::bigint <= 15728640  -- 15MB max
  AND (
    (metadata->>'mimetype') = 'application/pdf' OR
    (metadata->>'mimetype') LIKE 'image/%' OR
    (metadata->>'mimetype') LIKE 'application/vnd.ms-%' OR
    (metadata->>'mimetype') LIKE 'application/vnd.openxmlformats-%' OR
    (metadata->>'mimetype') = 'text/plain'
  )
);

-- 4b. Lecture vault-files (utilisateur propriétaire uniquement)
CREATE POLICY "Secure read vault files"
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'vault-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4c. Mise à jour vault-files
CREATE POLICY "Secure update vault files"
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'vault-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'vault-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (metadata->>'size')::bigint <= 15728640
);

-- 4d. Suppression vault-files
CREATE POLICY "Secure delete vault files"
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'vault-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ✅ 5. INDEX DE PERFORMANCE POUR STORAGE
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_folder_optimized 
ON storage.objects (bucket_id, (storage.foldername(name))[1], created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_objects_metadata_size 
ON storage.objects USING GIN (metadata) WHERE metadata ? 'size';

CREATE INDEX IF NOT EXISTS idx_storage_objects_name_pattern 
ON storage.objects (bucket_id, name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_storage_objects_updated_at 
ON storage.objects (updated_at DESC) WHERE updated_at > (now() - interval '30 days');

-- ✅ 6. TABLE DE MONITORING DES UPLOADS
CREATE TABLE IF NOT EXISTS public.upload_monitoring (
  id bigserial PRIMARY KEY,
  bucket_id text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  upload_method text,
  upload_duration_ms integer,
  upload_success boolean DEFAULT true,
  error_message text,
  user_id uuid REFERENCES auth.users(id),
  device_info jsonb,
  connection_info jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT upload_monitoring_bucket_check CHECK (bucket_id IN ('intervention-files', 'vault-files')),
  CONSTRAINT upload_monitoring_method_check CHECK (upload_method IN ('standard', 'chunked', 'resumable'))
);

-- ✅ 7. INDEX POUR MONITORING
CREATE INDEX IF NOT EXISTS idx_upload_monitoring_created_at 
ON public.upload_monitoring (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_monitoring_user_bucket 
ON public.upload_monitoring (user_id, bucket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_monitoring_success_method 
ON public.upload_monitoring (upload_success, upload_method);

CREATE INDEX IF NOT EXISTS idx_upload_monitoring_device_info 
ON public.upload_monitoring USING GIN (device_info);

-- ✅ 8. FONCTION D'OPTIMISATION AUTOMATIQUE DES UPLOADS
CREATE OR REPLACE FUNCTION optimize_upload_metadata()
RETURNS trigger AS $$
DECLARE
  file_size_mb numeric;
  device_type text := 'unknown';
  upload_method text := 'standard';
BEGIN
  -- Calcul taille en MB
  file_size_mb := COALESCE((NEW.metadata->>'size')::numeric, 0) / 1048576;
  
  -- Détection du type d'appareil depuis les métadonnées
  IF NEW.metadata ? 'uploadedFrom' THEN
    device_type := NEW.metadata->>'uploadedFrom';
  END IF;
  
  -- Détection de la méthode d'upload
  IF NEW.metadata ? 'uploadMethod' THEN
    upload_method := NEW.metadata->>'uploadMethod';
  ELSIF file_size_mb > 6 THEN
    upload_method := 'chunked';
  END IF;
  
  -- Enrichissement des métadonnées
  NEW.metadata := NEW.metadata || jsonb_build_object(
    'optimized_for_mobile', CASE WHEN device_type = 'mobile' THEN true ELSE false END,
    'upload_timestamp', extract(epoch from now()),
    'size_mb', round(file_size_mb, 2),
    'optimization_level', CASE 
      WHEN file_size_mb > 10 THEN 'high'
      WHEN file_size_mb > 5 THEN 'medium'
      ELSE 'low'
    END,
    'cdn_eligible', CASE WHEN NEW.bucket_id = 'intervention-files' THEN true ELSE false END
  );
  
  -- Log de monitoring (insertion sécurisée)
  BEGIN
    INSERT INTO public.upload_monitoring (
      bucket_id, 
      file_name, 
      file_size_bytes,
      upload_method,
      user_id,
      device_info,
      created_at
    ) VALUES (
      NEW.bucket_id,
      NEW.name,
      COALESCE((NEW.metadata->>'size')::bigint, 0),
      upload_method,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'type', device_type,
        'connection', COALESCE(NEW.metadata->>'connectionType', 'unknown'),
        'timestamp', now()
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore les erreurs de monitoring pour ne pas bloquer l'upload
    RAISE NOTICE 'Erreur monitoring upload (non critique): %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ 9. TRIGGER D'OPTIMISATION
DROP TRIGGER IF EXISTS trigger_optimize_upload_metadata ON storage.objects;
CREATE TRIGGER trigger_optimize_upload_metadata
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION optimize_upload_metadata();

-- ✅ 10. FONCTION DE NETTOYAGE AUTOMATIQUE
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
  deleted_logs integer;
  deleted_chunks integer;
BEGIN
  -- Nettoyage des logs de monitoring > 90 jours
  DELETE FROM public.upload_monitoring 
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Nettoyage des chunks temporaires > 24h
  DELETE FROM storage.objects 
  WHERE name LIKE '%.chunk%' 
    AND created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_chunks = ROW_COUNT;
  
  RAISE NOTICE 'Nettoyage terminé: % logs supprimés, % chunks temporaires supprimés', 
    deleted_logs, deleted_chunks;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ 11. VUES DE MONITORING POUR DASHBOARD

-- Vue des statistiques d'upload par jour
CREATE OR REPLACE VIEW upload_stats_daily AS
SELECT 
  DATE(created_at) as upload_date,
  bucket_id,
  COUNT(*) as total_uploads,
  COUNT(*) FILTER (WHERE upload_success = true) as successful_uploads,
  ROUND(AVG(file_size_bytes / 1048576.0), 2) as avg_size_mb,
  ROUND(AVG(upload_duration_ms), 0) as avg_duration_ms,
  COUNT(*) FILTER (WHERE device_info->>'type' = 'mobile') as mobile_uploads,
  COUNT(*) FILTER (WHERE device_info->>'type' = 'desktop') as desktop_uploads
FROM public.upload_monitoring 
WHERE created_at > now() - interval '30 days'
GROUP BY DATE(created_at), bucket_id
ORDER BY upload_date DESC, bucket_id;

-- Vue des erreurs d'upload récentes
CREATE OR REPLACE VIEW upload_errors_recent AS
SELECT 
  created_at,
  bucket_id,
  file_name,
  error_message,
  device_info->>'type' as device_type,
  device_info->>'connection' as connection_type,
  file_size_bytes / 1048576.0 as size_mb
FROM public.upload_monitoring 
WHERE upload_success = false 
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Vue des performances par méthode d'upload
CREATE OR REPLACE VIEW upload_performance_by_method AS
SELECT 
  upload_method,
  COUNT(*) as total_uploads,
  COUNT(*) FILTER (WHERE upload_success = true) as successful_uploads,
  ROUND(100.0 * COUNT(*) FILTER (WHERE upload_success = true) / COUNT(*), 2) as success_rate_percent,
  ROUND(AVG(upload_duration_ms), 0) as avg_duration_ms,
  ROUND(AVG(file_size_bytes / 1048576.0), 2) as avg_size_mb,
  MIN(created_at) as first_used,
  MAX(created_at) as last_used
FROM public.upload_monitoring 
WHERE created_at > now() - interval '30 days'
GROUP BY upload_method
ORDER BY success_rate_percent DESC;

-- ✅ 12. FONCTION D'ANALYSE DE PERFORMANCE
CREATE OR REPLACE FUNCTION analyze_upload_performance(days_back integer DEFAULT 7)
RETURNS TABLE (
  metric_name text,
  metric_value text,
  recommendation text
) AS $$
DECLARE
  total_uploads integer;
  success_rate numeric;
  avg_mobile_duration numeric;
  avg_desktop_duration numeric;
  large_file_failures integer;
BEGIN
  -- Statistiques générales
  SELECT COUNT(*), 
         ROUND(100.0 * COUNT(*) FILTER (WHERE upload_success = true) / COUNT(*), 2),
         AVG(upload_duration_ms) FILTER (WHERE device_info->>'type' = 'mobile'),
         AVG(upload_duration_ms) FILTER (WHERE device_info->>'type' = 'desktop'),
         COUNT(*) FILTER (WHERE upload_success = false AND file_size_bytes > 5242880)
  INTO total_uploads, success_rate, avg_mobile_duration, avg_desktop_duration, large_file_failures
  FROM public.upload_monitoring 
  WHERE created_at > now() - (days_back || ' days')::interval;

  -- Retour des métriques avec recommandations
  RETURN QUERY VALUES 
    ('Total Uploads', total_uploads::text, 
     CASE WHEN total_uploads < 10 THEN 'Pas assez de données pour analyse' ELSE 'Volume normal' END),
    ('Success Rate', success_rate::text || '%', 
     CASE WHEN success_rate < 95 THEN 'Taux de succès faible - vérifier la configuration réseau' 
          WHEN success_rate < 98 THEN 'Taux de succès acceptable'
          ELSE 'Excellent taux de succès' END),
    ('Avg Mobile Duration', COALESCE(ROUND(avg_mobile_duration)::text || 'ms', 'N/A'), 
     CASE WHEN avg_mobile_duration > 30000 THEN 'Uploads mobiles lents - activer compression'
          WHEN avg_mobile_duration > 15000 THEN 'Performance mobile acceptable'
          ELSE 'Bonne performance mobile' END),
    ('Large File Failures', large_file_failures::text, 
     CASE WHEN large_file_failures > 3 THEN 'Trop d\'échecs sur gros fichiers - activer chunked upload'
          WHEN large_file_failures > 0 THEN 'Quelques échecs sur gros fichiers'
          ELSE 'Gros fichiers bien gérés' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ 13. POLITIQUES RLS POUR LES TABLES DE MONITORING
ALTER TABLE public.upload_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own upload logs" ON public.upload_monitoring
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert upload logs" ON public.upload_monitoring
FOR INSERT TO authenticated
WITH CHECK (true);

-- ✅ 14. FONCTION DE DIAGNOSTIC SYSTÈME
CREATE OR REPLACE FUNCTION diagnose_storage_system()
RETURNS TABLE (
  component text,
  status text,
  details text,
  action_needed text
) AS $$
DECLARE
  bucket_count integer;
  policy_count integer;
  recent_uploads integer;
  recent_errors integer;
BEGIN
  -- Vérification des buckets
  SELECT COUNT(*) INTO bucket_count 
  FROM storage.buckets 
  WHERE id IN ('intervention-files', 'vault-files');
  
  -- Vérification des politiques
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'storage' AND tablename = 'objects';
  
  -- Vérification des uploads récents
  SELECT COUNT(*) INTO recent_uploads 
  FROM public.upload_monitoring 
  WHERE created_at > now() - interval '24 hours';
  
  -- Vérification des erreurs récentes
  SELECT COUNT(*) INTO recent_errors 
  FROM public.upload_monitoring 
  WHERE created_at > now() - interval '24 hours' AND upload_success = false;