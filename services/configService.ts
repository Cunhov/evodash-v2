
import { supabase } from './supabaseClient';
import { EvoConfig } from '../types';

const LOCAL_STORAGE_KEY = 'evodash_config_v1';

export const getConfig = async (): Promise<EvoConfig | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        // 1. If logged in, try fetching from Supabase
        if (session?.user) {
            const { data, error } = await supabase
                .from('user_configs')
                .select('config')
                .eq('user_id', session.user.id)
                .single();

            if (data?.config) {
                // Determine if we need to sync to local storage or strictly use DB
                // For now, let's keep local storage as a cache/backup
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.config));
                return data.config;
            }
        }

        // 2. Fallback to LocalStorage (migration or offline-ish)
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localData) {
            return JSON.parse(localData);
        }

        return null;

    } catch (e) {
        console.error('Error loading config:', e);
        return null;
    }
};

export const saveConfig = async (config: EvoConfig): Promise<void> => {
    // 1. Save to Local
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));

    // 2. Save to Supabase if logged in
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { error } = await supabase
                .from('user_configs')
                .upsert({
                    user_id: session.user.id,
                    config: config,
                    updated_at: new Date().toISOString()
                });

            if (error) console.error('Failed to save config to DB:', error.message);
        }
    } catch (e) {
        console.error('Error saving config to DB:', e);
    }
};

export const clearConfig = async (): Promise<void> => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // Optional: Clear from DB too? Requirements say "guard keys", so deleting locally is "Logout/Disconnect". 
    // Usually we don't wipe the DB config on logout, only on explicit "Delete Data" action. 
    // Layout.tsx handleLogout uses this. We probably just want to clear local state.
};
