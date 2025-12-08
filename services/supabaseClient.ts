import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || process.env[key.replace('VITE_', '')];
    }
    return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
// Prefer Service Key in Worker (Node), Anon Key in Frontend
const supabaseKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_KEY)
    ? process.env.SUPABASE_SERVICE_KEY
    : getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing or incomplete.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
