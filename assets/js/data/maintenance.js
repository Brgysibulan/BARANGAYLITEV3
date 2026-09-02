/**
 * Purpose: shared fallback copy for the existing maintenance settings.
 * Depends on: no services or browser APIs; saved notice text always takes precedence.
 * Debug: these defaults do not write or enable maintenance in the database.
 */
export const MAINTENANCE_DEFAULTS = Object.freeze({
  maintenance_title: 'We will be right back',
  maintenance_message: 'The barangay website is temporarily undergoing maintenance and improvements. Please check back shortly.',
});
