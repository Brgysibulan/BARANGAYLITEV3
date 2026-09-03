/**
 * Purpose: clearly labelled, non-sensitive sample content for layout previews only.
 * Depends on: preview.js; never imported by the live public data loader.
 * Debug: sample text is not a claim about existing barangay records or services.
 */
export const SAMPLE_SETTINGS = Object.freeze({ barangay_name: 'Sibulan', municipality_city: 'Sta. Cruz', province: 'Davao del Sur', hero_title: 'A better-connected barangay starts here.', hero_text: 'Your local government, closer to you. Find services, community updates, and the information you need in one place.' });
export const SAMPLE_CONTENT = Object.freeze({
  announcements: [{ title: 'Community announcements', excerpt: 'Published barangay updates will appear here.', category: 'Sample advisory' }, { title: 'Programs for our residents', excerpt: 'Share important program information with your community.', category: 'Sample program' }, { title: 'Keep in touch with your barangay', excerpt: 'A dedicated space for timely notices and public information.', category: 'Sample notice' }],
  services: [{ name: 'Barangay services', description: 'Describe the service and how residents can apply.', requirements: 'Published requirements appear here.' }, { name: 'Resident assistance', description: 'A clear starting point for the help residents need.' }, { name: 'Document requests', description: 'Requirements, office instructions, and processing details in one place.' }],
  officials: [{ full_name: 'Official name', position: 'Published position', bio: 'Your existing officials will appear here.' }],
  disclosures: [{ title: 'Public transparency report', category: 'Sample document', description: 'Published reports and downloadable public documents.' }],
  forms: [{ name: 'Downloadable form', description: 'Your published forms will be listed here.' }],
  pages: [{ title: 'About our barangay', summary: 'History, programs, and official barangay information.' }],
  gallery_items: [{ title: 'Community moments', caption: 'Your published gallery photos will appear here.' }],
  directory_entries: [{ name: 'Barangay hall', category: 'Public assistance', role_title: 'Your existing contact directory will appear here.' }],
});
