// supabase/functions/ppf-authenticate/index.ts
// Handles PPF OAuth2 token exchange server-side so API credentials never reach the browser.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PPF_AUTH_URLS: Record<string, string> = {
  production: 'https://portail-facture.fr/oauth/token',
  sandbox: 'https://sandbox.portail-facture.fr/oauth/token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify caller JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { organizationId, env = 'sandbox' } = await req.json();
    if (!organizationId) return json({ error: 'organizationId required' }, 400);

    // Read credentials server-side — never returned to client
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('einvoicing_settings')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) return json({ error: 'Organization not found' }, 404);

    const settings = org.einvoicing_settings ?? {};
    const clientId = settings.api_key_encrypted;
    const clientSecret = settings.api_secret_encrypted;

    if (!clientId || !clientSecret) {
      return json({ error: 'PPF credentials not configured' }, 400);
    }

    const authURL = PPF_AUTH_URLS[env] ?? PPF_AUTH_URLS.sandbox;
    const tokenRes = await fetch(authURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'facture:write facture:read',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      return json({ error: err.error_description ?? 'PPF OAuth failed' }, 502);
    }

    const tokenData = await tokenRes.json();

    return json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
