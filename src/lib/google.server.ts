// Server-only helper for Google APIs via the Lovable connector gateway.
export type GoogleService = "sheets" | "drive" | "gmail";

const GATEWAY = "https://connector-gateway.lovable.dev";

const SERVICES: Record<GoogleService, { connector: string; base: string; keyEnv: string }> = {
  gmail: { connector: "google_mail", base: "/gmail/v1", keyEnv: "GOOGLE_MAIL_API_KEY" },
  drive: { connector: "google_drive", base: "/drive/v3", keyEnv: "GOOGLE_DRIVE_API_KEY" },
  sheets: { connector: "google_sheets", base: "/v4", keyEnv: "GOOGLE_SHEETS_API_KEY" },
};

export async function googleFetch(service: GoogleService, path: string, init?: RequestInit): Promise<Response> {
  const cfg = SERVICES[service];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env[cfg.keyEnv];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY mancante");
  if (!connKey) throw new Error(`${cfg.keyEnv} mancante`);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connKey);
  const clean = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${GATEWAY}/${cfg.connector}${cfg.base}${clean}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body)?.error?.message ?? body; } catch { /* testo semplice */ }
    throw new Error(`Google ${service} [${res.status}]: ${msg}`);
  }
  return res;
}
