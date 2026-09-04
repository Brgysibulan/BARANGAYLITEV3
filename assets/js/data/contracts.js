/**
 * Purpose: allowlist the existing tables, fields, publish flags, and Storage links.
 * Source: legacy code and read-only inspection of the live schema on 2026-09-02.
 * Debug: a missing/unsupported field should be checked against this file first.
 * This describes the database; it never creates, renames, seeds, or resets it.
 */
const define = (label, title, fields, flag, order, extra = {}) => Object.freeze({
  label, title, fields: Object.freeze(fields.split(',')), flag, order, ...extra,
});

/** Existing verification people receive Directory metadata; their identity is never copied. */
export const DIRECTORY_SECTIONS = Object.freeze({
  officials: 'Barangay Officials',
  staff: 'Barangay Staff',
  functionaries: 'Barangay Functionaries',
});
export const DIRECTORY_SUBCATEGORIES = Object.freeze({
  staff: Object.freeze([
    'Administrative Staff', 'Barangay Clerk', 'Utility / Maintenance',
    'Driver', 'Security / Watchman', 'Messenger', 'Other Staff',
  ]),
  functionaries: Object.freeze([
    'BHW', 'BNS', 'Barangay Tanod', 'Day Care Worker (DCW)', 'Lupon',
    'Monitoring Team', 'Solid Waste Enforcer', 'Barangay Dengue Coordinator',
    'Senior Citizen President', 'PWD President', 'Barangay Watchman',
    'Barangay Camp Manager',
  ]),
});
/** The legacy directory table remains only for Barangay Hall contact entries. */
export const DIRECTORY_GROUPS = Object.freeze({
  contacts: Object.freeze(['Contact']),
  staff: DIRECTORY_SUBCATEGORIES.staff,
  functionaries: DIRECTORY_SUBCATEGORIES.functionaries,
});
export const DIRECTORY_CATEGORY_OPTIONS = Object.freeze([
  ...DIRECTORY_GROUPS.contacts,
  ...DIRECTORY_SUBCATEGORIES.staff,
  ...DIRECTORY_SUBCATEGORIES.functionaries,
]);

export const CONTENT = Object.freeze({
  announcements: define('Announcements', 'title', 'title,slug,excerpt,content,cover_url,published_at,is_published,is_featured', 'is_published', 'published_at', { descending: true, bucket: 'gallery-media', fileField: 'cover_url', optionalFile: true }),
  services: define('Services', 'name', 'name,description,requirements,fee_text,processing_time,sort_order,is_active', 'is_active', 'sort_order'),
  officials: define('Barangay Officials', 'full_name', 'full_name,position,photo_url,bio,sort_order,is_active', 'is_active', 'sort_order', { bucket: 'gallery-media', fileField: 'photo_url', optionalFile: true }),
  directory_entries: define('Contact Directory', 'name', 'category,name,role_title,contact,location,photo_url,sort_order,is_active', 'is_active', 'sort_order', { bucket: 'gallery-media', fileField: 'photo_url', optionalFile: true }),
  disclosures: define('Disclosures', 'title', 'title,category,description,file_url,document_date,is_published,sort_order', 'is_published', 'sort_order', { bucket: 'disclosure-documents', fileField: 'file_url' }),
  forms: define('Downloadable Forms', 'name', 'name,category,description,file_url,file_name,file_type,file_size,is_published,sort_order', 'is_published', 'sort_order', { bucket: 'forms', fileField: 'file_url' }),
  gallery_items: define('Gallery', 'title', 'title,caption,image_url,album,sort_order,is_published', 'is_published', 'sort_order', { bucket: 'gallery-media', fileField: 'image_url' }),
  pages: define('Barangay Profile / Pages', 'title', 'slug,title,summary,content,is_published,sort_order', 'is_published', 'sort_order'),
});

export const VERIFICATION_FIELDS = Object.freeze('control_number,first_name,middle_name,last_name,designation,date_acquired,expiration_date,status'.split(','));
export const SETTINGS_FIELDS = Object.freeze('barangay_name,municipality_city,province,address,contact_number,email,logo_url,facebook_url,map_embed_url,hero_title,hero_text,maintenance_mode,maintenance_title,maintenance_message'.split(','));
// Saved legacy theme values are preserved in Supabase but intentionally not loaded.
export const SETTINGS_SELECT = ['id', ...SETTINGS_FIELDS, 'updated_at'].join(',');

export const PROFILE_SECTIONS = Object.freeze([
  { slug: 'barangay-about', title: 'About the Barangay', order: 10 },
  { slug: 'barangay-history', title: 'History', order: 20 },
  { slug: 'barangay-vision', title: 'Vision', order: 30 },
  { slug: 'barangay-mission', title: 'Mission', order: 40 },
  { slug: 'barangay-highlights', title: 'Profile Highlights', order: 50 },
]);

/** Block private/unknown tables and inherited object names such as __proto__. */
export function contentContract(table) {
  if (!Object.hasOwn(CONTENT, table)) throw new Error('Unsupported content module.');
  return CONTENT[table];
}

/** Copy only allowed fields; omitted values leave existing database fields alone. */
export function pickFields(values, allowed) {
  const result = {};
  for (const name of allowed) {
    if (Object.hasOwn(values, name) && values[name] !== undefined) result[name] = values[name];
  }
  return result;
}

/** Shared input checks before a write; database constraints still remain authoritative. */
export function validatePayload(payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (/^(is_|maintenance_mode$)/.test(key) && typeof value !== 'boolean') throw new Error(`${key} must be true or false.`);
    if (key === 'sort_order' && (!Number.isInteger(value) || value < 0)) throw new Error('Sort order must be a non-negative integer.');
    if (key.endsWith('_url') && value) {
      let parsed;
      try { parsed = new URL(value); } catch { throw new Error(`${key} must be a valid HTTPS URL.`); }
      if (parsed.protocol !== 'https:') throw new Error(`${key} must use HTTPS.`);
    }
  }
  return payload;
}
