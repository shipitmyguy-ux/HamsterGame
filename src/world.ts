import type { WorldPayload } from "./types";

const ENDPOINT = "https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/hamster-data-v1";

export async function loadWorld(channel:"draft"|"published"="draft"):Promise<WorldPayload>{
  const response = await fetch(`${ENDPOINT}?channel=${channel}&include=archetypes`, { cache:"no-store" });
  if(!response.ok) throw new Error(`World load failed (${response.status})`);
  const payload = await response.json();
  if(!payload?.ok || !payload?.world) throw new Error("World response was incomplete");
  return payload as WorldPayload;
}
