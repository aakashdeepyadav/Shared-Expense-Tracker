
import fs from 'fs';
import path from 'path';

// A simple cache to avoid reading the file multiple times per request
let envCache: Record<string, string> | null = null;

export function loadEnv(): Record<string, string> {
  if (envCache) {
    return envCache;
  }

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envFileContent = fs.readFileSync(envPath, 'utf8');
    const envConfig: Record<string, string> = {};
    
    envFileContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        // Remove quotes if they exist
        if (value.startsWith('"') && value.endsWith('"')) {
          envConfig[key.trim()] = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          envConfig[key.trim()] = value.substring(1, value.length - 1);
        } else {
          envConfig[key.trim()] = value;
        }
      }
    });
    
    envCache = envConfig;
    return envConfig;
  } catch (error) {
    console.error('Failed to load or parse .env file:', error);
    // Return a subset from process.env as a fallback, which might be populated in some environments
    return {
        GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '',
        GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY || '',
        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
        SYNC_SECRET: process.env.SYNC_SECRET || '',
    };
  }
}
