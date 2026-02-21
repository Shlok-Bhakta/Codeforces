import { join } from "path";

export interface CodeforcesConfig {
  apiKey: string;
  apiSecret: string;
  handle: string;
  // Session cookies for web-based submission (copied from browser)
  jsessionid?: string;
  cookie39ce7?: string;
}

function loadEnv(): Record<string, string> {
  const envPaths = [
    join(import.meta.dir, "../../../.env"),
    join(import.meta.dir, "../../.env"),
  ];

  const env: Record<string, string> = {};

  for (const p of envPaths) {
    const file = Bun.file(p);
    // Use synchronous-style approach via file exists check
    try {
      const content = Bun.file(p).toString();
      if (content) {
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim();
          env[key] = value;
        }
        break;
      }
    } catch {
      // ignore
    }
  }

  return env;
}

async function loadEnvAsync(): Promise<Record<string, string>> {
  const envPaths = [
    join(import.meta.dir, "../../../.env"),
    join(import.meta.dir, "../../.env"),
  ];

  const env: Record<string, string> = {};

  for (const p of envPaths) {
    const file = Bun.file(p);
    if (await file.exists()) {
      const content = await file.text();
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (value) env[key] = value;
      }
      break;
    }
  }

  return env;
}

export async function loadCodeforcesConfig(): Promise<CodeforcesConfig> {
  const env = await loadEnvAsync();

  const apiKey = env["CF_API_KEY"] || "";
  const apiSecret = env["CF_API_SECRET"] || "";
  const handle = env["CF_HANDLE"] || "";

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing CF_API_KEY or CF_API_SECRET in .env file.\n" +
      "Generate an API key at https://codeforces.com/settings/api"
    );
  }

  return {
    apiKey,
    apiSecret,
    handle,
    jsessionid: env["CF_SESSION_JSESSIONID"],
    cookie39ce7: env["CF_SESSION_39CE7"],
  };
}

/** Build a signed Codeforces API URL */
export function buildCfApiUrl(
  method: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string
): string {
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  const allParams: Record<string, string> = {
    ...params,
    apiKey,
    time: Math.floor(Date.now() / 1000).toString(),
  };

  // Sort params lexicographically
  const sortedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const sigBase = `${rand}/${method}?${sortedParams}#${apiSecret}`;

  // SHA-512 using Web Crypto (available in Bun)
  const encoder = new TextEncoder();
  const data = encoder.encode(sigBase);

  // We'll use the sync version via Bun's built-in crypto
  const hash = require("crypto")
    .createHash("sha512")
    .update(sigBase)
    .digest("hex");

  const apiSig = rand + hash;

  return `https://codeforces.com/api/${method}?${sortedParams}&apiSig=${apiSig}`;
}
