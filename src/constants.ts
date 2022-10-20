import * as dotenv from "dotenv";
import * as fs from "fs";

loadEnv(".env");

export const GOOGLE_OAUTH_CLIENT_SECRET = readEnv("GOOGLE_OAUTH_CLIENT_SECRET");
export const GOOGLE_OAUTH_CLIENT_ID = readEnv("GOOGLE_OAUTH_CLIENT_ID");

export const SIGNALWIRE_API_TOKEN = readEnv("SIGNALWIRE_API_TOKEN");
export const SIGNALWIRE_PROJECT_ID = readEnv("SIGNALWIRE_PROJECT_ID");
export const SIGNALWIRE_CONTEXT = readEnv("SIGNALWIRE_CONTEXT");
export const SIGNALWIRE_SPACE = readEnv("SIGNALWIRE_SPACE");

export const BASE_URL = readEnv("BASE_URL");
export const SESSION_SECRET = readEnv("SESSION_SECRET");

function loadEnv(path: string): void {
  const config = dotenv.parse(fs.readFileSync(path));
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      process.env[key] = config[key];
    }
  }
}

function readEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env key ${key}`);
  }
  return value;
}
