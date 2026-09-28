import { supabase } from './supabaseClient';

export interface DeveloperProfile {
  name: string;
  age: number;
  location: string;
  role: string;
  appName: string;
  bio?: string;
}

export const defaultDeveloperProfile: DeveloperProfile = {
  name: "Mubasshir",
  age: 20,
  location: "Mumbai, India",
  role: "the developer",
  appName: "Ceaznet",
  bio: "Mubasshir is a 20-year-old developer from Mumbai, India, driven by curiosity and a genuine interest in understanding how things work. He enjoys turning ideas into practical software, with a focus on clean code, minimal design systems, responsive layouts, and interfaces that feel natural rather than overcomplicated. He is the creator of Ceaznet, an engineered personal operating system that brings real-time voice, finance, and dynamic notes together into a cohesive digital workspace. Beyond building software, he enjoys exploring new ideas, refining details, and continuously improving the way he learns, designs, and builds. His work reflects a simple philosophy: technology should be thoughtfully engineered, purposeful, and easy to live with."
};

export const getDeveloperProfile = async (): Promise<DeveloperProfile> => {
    return defaultDeveloperProfile;
};
