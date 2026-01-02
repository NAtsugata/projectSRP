// src/lib/supabase.js
// Barrel file - Réexporte tous les services pour rétrocompatibilité
// Le code a été séparé dans des fichiers dédiés pour une meilleure maintenabilité

// Client Supabase de base
export { supabase } from './supabaseClient';

// Services
export { authService } from '../services/authService';
export { profileService } from '../services/profileService';
export { interventionService } from '../services/interventionService';
export { leaveService } from '../services/leaveService';
export { vaultService } from '../services/vaultService';
export { storageService } from '../services/storageService';
export { maintenanceContractService } from '../services/maintenanceContractService';

// Export par défaut pour compatibilité avec les imports existants
import { supabase } from './supabaseClient';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { interventionService } from '../services/interventionService';
import { leaveService } from '../services/leaveService';
import { vaultService } from '../services/vaultService';
import { storageService } from '../services/storageService';
import { maintenanceContractService } from '../services/maintenanceContractService';

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
