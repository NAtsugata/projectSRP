// src/lib/supabaseClient.js
// Client Supabase de base - configuration et initialisation

import { createClient } from '@supabase/supabase-js';

// Load environment variables (must be defined in .env)
// Vite utilise import.meta.env avec le préfixe VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement Supabase manquantes.\n' +
    'Copiez .env.example vers .env et renseignez vos clés:\n' +
    '  cp .env.example .env\n' +
    'Voir README.md > Installation pour plus de détails.'
  );
}

// Initialise Supabase client avec optimisations mobile
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-mobile',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
    fetch: (url, options = {}) => {
      // Timeout de 30 secondes pour les requêtes mobiles, sans perdre
      // l'annulation éventuellement demandée par l'appelant (options.signal)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const callerSignal = options.signal;
      if (callerSignal) {
        if (callerSignal.aborted) controller.abort();
        else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    },
  },
  db: { schema: 'public' },
});

export default supabase;
