-- ========================================
-- MIGRATION: Ajout des colonnes manquantes pour maintenance_contracts
-- À exécuter si la table existe déjà mais sans les nouvelles colonnes
-- ========================================

-- Supprime d'abord les vues qui dépendent des colonnes
DROP VIEW IF EXISTS v_contracts_summary CASCADE;
DROP VIEW IF EXISTS v_today_visits CASCADE;

-- Ajouter les nouvelles colonnes à maintenance_contracts si elles n'existent pas
DO $$ 
BEGIN
    -- priority
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='priority') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;
    
    -- response_time_hours
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='response_time_hours') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN response_time_hours INTEGER;
    END IF;
    
    -- latitude
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='latitude') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    
    -- longitude
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='longitude') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    
    -- access_instructions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='access_instructions') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN access_instructions TEXT;
    END IF;
    
    -- client_secondary_phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='client_secondary_phone') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN client_secondary_phone TEXT;
    END IF;
    
    -- client_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='client_notes') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN client_notes TEXT;
    END IF;
    
    -- auto_renew
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='auto_renew') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN auto_renew BOOLEAN DEFAULT false;
    END IF;
    
    -- payment_method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='payment_method') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN payment_method TEXT;
    END IF;
    
    -- billing_period
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='billing_period') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN billing_period TEXT DEFAULT 'annual';
    END IF;
    
    -- send_email_reminders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='send_email_reminders') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN send_email_reminders BOOLEAN DEFAULT true;
    END IF;
    
    -- send_sms_reminders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='send_sms_reminders') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN send_sms_reminders BOOLEAN DEFAULT false;
    END IF;
    
    -- visit_reminder_days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='visit_reminder_days') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN visit_reminder_days INTEGER DEFAULT 7;
    END IF;
    
    -- internal_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='internal_notes') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN internal_notes TEXT;
    END IF;
    
    -- contract_document_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='contract_document_url') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN contract_document_url TEXT;
    END IF;
    
    -- preferred_technician_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='preferred_technician_id') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN preferred_technician_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Mettre à jour la fréquence si nécessaire
DO $$
BEGIN
    -- Ajouter bimonthly à la contrainte de fréquence si elle n'existe pas
    ALTER TABLE maintenance_contracts DROP CONSTRAINT IF EXISTS maintenance_contracts_frequency_check;
    ALTER TABLE maintenance_contracts ADD CONSTRAINT maintenance_contracts_frequency_check 
        CHECK (frequency IN ('monthly', 'bimonthly', 'quarterly', 'biannual', 'annual'));
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore si ça échoue
END $$;

-- Mettre à jour le statut si nécessaire
DO $$
BEGIN
    ALTER TABLE maintenance_contracts DROP CONSTRAINT IF EXISTS maintenance_contracts_status_check;
    ALTER TABLE maintenance_contracts ADD CONSTRAINT maintenance_contracts_status_check 
        CHECK (status IN ('draft', 'active', 'on_hold', 'expired', 'pending_renewal', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Recréer les vues
CREATE OR REPLACE VIEW v_contracts_summary AS
SELECT 
    mc.*,
    p.display_name as created_by_name,
    pt.display_name as preferred_technician_name,
    (mc.end_date - CURRENT_DATE) as days_until_expiry,
    (SELECT COUNT(*) FROM contract_visits cv WHERE cv.contract_id = mc.id) as total_visits,
    (SELECT COUNT(*) FROM contract_visits cv WHERE cv.contract_id = mc.id AND cv.status = 'completed') as completed_visits
FROM maintenance_contracts mc
LEFT JOIN profiles p ON mc.created_by = p.id
LEFT JOIN profiles pt ON mc.preferred_technician_id = pt.id;

CREATE OR REPLACE VIEW v_today_visits AS
SELECT 
    cv.*,
    mc.client_name,
    mc.client_address,
    mc.client_phone,
    mc.contract_type,
    p.display_name as technician_name
FROM contract_visits cv
JOIN maintenance_contracts mc ON cv.contract_id = mc.id
LEFT JOIN profiles p ON cv.assigned_technician_id = p.id
WHERE cv.scheduled_date = CURRENT_DATE
ORDER BY cv.scheduled_time;

SELECT 'Migration terminée avec succès!' as result;
