import { supabase } from './supabaseClient';

export interface DeveloperProfile {
  name: string;
  age: number;
  location: string;
  role: string;
  appName: string;
}

export const defaultDeveloperProfile: DeveloperProfile = {
  name: "Mubasshir",
  age: 20,
  location: "Mumbai, India",
  role: "the developer",
  appName: "Ceaznet",
};

export const getDeveloperProfile = async (): Promise<DeveloperProfile> => {
    return defaultDeveloperProfile;
};
