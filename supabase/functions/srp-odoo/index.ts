import { createConnector } from './core.js';

// Both transports authenticate inside core: Supabase user JWT or scoped MCP token.
Deno.serve(createConnector({ env: (key: string) => Deno.env.get(key) }));
