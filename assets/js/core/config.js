/**
 * Purpose: one source of configuration for the existing barangay database.
 * Used by: client initialization, Storage ownership checks, live verification.
 * Debug: confirm the project URL and pinned SDK before changing other modules.
 * Security: the publishable key is public; never use a secret/service_role key.
 */
export const SUPABASE_URL = 'https://pkvorwvkqjnbgktkgjhr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RbaENAflMzLgXpemymGApA_TkVAhMoU';
export const SDK_VERSION = '2.112.4';
// Same Auth users/passwords, separate browser session: leave old-site tokens alone.
export const AUTH_STORAGE_KEY = 'brgyweblitev3:auth:pkvorwvkqjnbgktkgjhr';
export const SOURCE_COMMIT = 'a602a8f17123aab7dc7dc13fed44b7f9b9a7e55d';
