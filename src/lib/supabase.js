// src/lib/supabase.js
// Barrel file - Réexporte tous les services pour rétrocompatibilité
// Le code a été séparé dans des fichiers dédiés pour une meilleure maintenabilité

// Imports en premier (ESLint import/first)
import { supabase } from './supabaseClient';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { interventionService } from '../services/interventionService';
import { leaveService } from '../services/leaveService';
import { vaultService } from '../services/vaultService';
import { storageService } from '../services/storageService';
import { maintenanceContractService } from '../services/maintenanceContractService';

// Ré-exports nommés
export {
  supabase,
  authService,
  profileService,
  interventionService,
  leaveService,
  vaultService,
  storageService,
  maintenanceContractService,
};

// Export par défaut pour compatibilité avec les imports existants
const supabaseClient = {
  supabase,
  authService,
  profileService,
  interventionService,
  leaveService,
  vaultService,
  storageService,
  maintenanceContractService,
};

export default supabaseClient;
