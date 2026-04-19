import { createClient } from '@supabase/supabase-js';

// Usando as chaves dinâmicas das Variáveis de Ambiente da Vercel e AI Studio
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
