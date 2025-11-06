-- ==========================================
-- TABLES: CHECKLISTS D'INTERVENTION PLOMBERIE
-- ==========================================
-- À exécuter dans Supabase SQL Editor

-- ==================== TABLE TEMPLATES ====================

CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('installation', 'reparation', 'entretien', 'depannage', 'diagnostic', 'mise_service')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de {id, text, required, photoRequired, category}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON public.checklist_templates(category);

-- RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut voir les templates
CREATE POLICY "Everyone can view checklist templates"
    ON public.checklist_templates
    FOR SELECT
    USING (true);

-- Policy: Seuls les admins peuvent créer/modifier/supprimer
CREATE POLICY "Admins can manage checklist templates"
    ON public.checklist_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Commentaires
COMMENT ON TABLE public.checklist_templates IS 'Templates de checklists créés par les admins';
COMMENT ON COLUMN public.checklist_templates.name IS 'Nom du template (ex: Installation chauffe-eau)';
COMMENT ON COLUMN public.checklist_templates.category IS 'Catégorie: installation, reparation, entretien, depannage, diagnostic, mise_service';
COMMENT ON COLUMN public.checklist_templates.items IS 'Array JSON des items: {id, text, required, photoRequired, category}';

-- ==================== TABLE CHECKLISTS ====================

CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
    template_name TEXT NOT NULL, -- Copie du nom pour référence
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    items_state JSONB NOT NULL DEFAULT '{}'::jsonb, -- {itemId: {checked: bool, timestamp: ISO}}
    photos JSONB NOT NULL DEFAULT '{}'::jsonb, -- {itemId: [{id, url, name, timestamp}]}
    notes JSONB NOT NULL DEFAULT '{}'::jsonb, -- {itemId: "note text"}
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_checklists_intervention ON public.checklists(intervention_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user ON public.checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON public.checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklists_template ON public.checklists(template_id);

-- RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Policy: Les employés voient leurs checklists
CREATE POLICY "Users can view their own checklists"
    ON public.checklists
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Les employés peuvent mettre à jour leurs checklists
CREATE POLICY "Users can update their own checklists"
    ON public.checklists
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Les admins voient toutes les checklists
CREATE POLICY "Admins can view all checklists"
    ON public.checklists
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Policy: Les admins peuvent créer/supprimer des checklists
CREATE POLICY "Admins can manage checklists"
    ON public.checklists
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Commentaires
COMMENT ON TABLE public.checklists IS 'Checklists assignées aux employés pour chaque intervention';
COMMENT ON COLUMN public.checklists.intervention_id IS 'Intervention liée';
COMMENT ON COLUMN public.checklists.template_id IS 'Template utilisé';
COMMENT ON COLUMN public.checklists.user_id IS 'Employé assigné';
COMMENT ON COLUMN public.checklists.items_state IS 'État des items: {itemId: {checked, timestamp}}';
COMMENT ON COLUMN public.checklists.photos IS 'Photos par item: {itemId: [{id, url, name, timestamp}]}';
COMMENT ON COLUMN public.checklists.notes IS 'Notes par item: {itemId: "note"}';
COMMENT ON COLUMN public.checklists.status IS 'Statut: pending, in_progress, completed';

-- ==================== TRIGGERS ====================

-- Trigger pour updated_at sur templates
CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checklist_templates_updated_at_trigger ON public.checklist_templates;
CREATE TRIGGER update_checklist_templates_updated_at_trigger
    BEFORE UPDATE ON public.checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_checklist_templates_updated_at();

-- Trigger pour updated_at sur checklists
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checklists_updated_at_trigger ON public.checklists;
CREATE TRIGGER update_checklists_updated_at_trigger
    BEFORE UPDATE ON public.checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_checklists_updated_at();

-- ==================== DONNÉES EXEMPLE (OPTIONNEL) ====================

-- Template exemple: Installation chauffe-eau
INSERT INTO public.checklist_templates (name, description, category, items)
VALUES (
    'Installation Chauffe-eau',
    'Checklist complète pour installation d''un chauffe-eau électrique ou gaz',
    'installation',
    '[
        {"id": "item_1", "text": "Vérifier l''alimentation électrique (230V)", "required": true, "photoRequired": false, "category": "Électricité"},
        {"id": "item_2", "text": "Contrôler l''arrivée d''eau froide", "required": true, "photoRequired": false, "category": "Plomberie"},
        {"id": "item_3", "text": "Installer le groupe de sécurité", "required": true, "photoRequired": true, "category": "Sécurité"},
        {"id": "item_4", "text": "Fixer solidement le chauffe-eau au mur", "required": true, "photoRequired": true, "category": "Installation"},
        {"id": "item_5", "text": "Raccorder l''eau chaude", "required": true, "photoRequired": false, "category": "Plomberie"},
        {"id": "item_6", "text": "Vérifier l''étanchéité de tous les raccords", "required": true, "photoRequired": true, "category": "Sécurité"},
        {"id": "item_7", "text": "Remplir le ballon et purger l''air", "required": true, "photoRequired": false, "category": "Mise en service"},
        {"id": "item_8", "text": "Mettre sous tension et tester", "required": true, "photoRequired": false, "category": "Test"},
        {"id": "item_9", "text": "Régler la température (55-60°C recommandé)", "required": true, "photoRequired": false, "category": "Réglage"},
        {"id": "item_10", "text": "Photo du chauffe-eau installé", "required": true, "photoRequired": true, "category": "Documentation"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Template exemple: Réparation fuite
INSERT INTO public.checklist_templates (name, description, category, items)
VALUES (
    'Réparation Fuite',
    'Procédure standard pour réparer une fuite d''eau',
    'reparation',
    '[
        {"id": "item_1", "text": "Couper l''arrivée d''eau générale", "required": true, "photoRequired": false, "category": "Sécurité"},
        {"id": "item_2", "text": "Identifier précisément la source de la fuite", "required": true, "photoRequired": true, "category": "Diagnostic"},
        {"id": "item_3", "text": "Photo de la fuite avant intervention", "required": true, "photoRequired": true, "category": "Documentation"},
        {"id": "item_4", "text": "Préparer le matériel nécessaire", "required": true, "photoRequired": false, "category": "Préparation"},
        {"id": "item_5", "text": "Effectuer la réparation", "required": true, "photoRequired": false, "category": "Réparation"},
        {"id": "item_6", "text": "Vérifier l''étanchéité après réparation", "required": true, "photoRequired": true, "category": "Test"},
        {"id": "item_7", "text": "Remettre l''eau en pression progressivement", "required": true, "photoRequired": false, "category": "Mise en service"},
        {"id": "item_8", "text": "Contrôle final: aucune fuite", "required": true, "photoRequired": true, "category": "Validation"},
        {"id": "item_9", "text": "Nettoyer la zone d''intervention", "required": false, "photoRequired": false, "category": "Finition"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Template exemple: Entretien chaudière
INSERT INTO public.checklist_templates (name, description, category, items)
VALUES (
    'Entretien Chaudière Gaz',
    'Entretien annuel obligatoire d''une chaudière gaz',
    'entretien',
    '[
        {"id": "item_1", "text": "Vérifier la ventilation de la chaufferie", "required": true, "photoRequired": false, "category": "Sécurité"},
        {"id": "item_2", "text": "Nettoyer le brûleur", "required": true, "photoRequired": false, "category": "Nettoyage"},
        {"id": "item_3", "text": "Contrôler la veilleuse/allumage", "required": true, "photoRequired": false, "category": "Fonctionnement"},
        {"id": "item_4", "text": "Vérifier la pression du circuit (1-1.5 bar)", "required": true, "photoRequired": false, "category": "Pression"},
        {"id": "item_5", "text": "Mesurer le taux de CO et CO2", "required": true, "photoRequired": true, "category": "Sécurité"},
        {"id": "item_6", "text": "Contrôler l''étanchéité du circuit gaz", "required": true, "photoRequired": false, "category": "Sécurité"},
        {"id": "item_7", "text": "Nettoyer le corps de chauffe", "required": true, "photoRequired": false, "category": "Nettoyage"},
        {"id": "item_8", "text": "Vérifier le vase d''expansion", "required": true, "photoRequired": false, "category": "Circuit"},
        {"id": "item_9", "text": "Tester le thermostat", "required": true, "photoRequired": false, "category": "Test"},
        {"id": "item_10", "text": "Remplir l''attestation d''entretien", "required": true, "photoRequired": true, "category": "Administratif"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;
