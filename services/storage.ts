import { EvoConfig } from '../types';

const STORAGE_KEY = 'evodash_config_v1';

export const getStoredConfig = (): EvoConfig | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Failed to parse config", e);
    return null;
  }
};

export const saveConfig = (config: EvoConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const clearConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
};
