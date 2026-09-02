/**
 * Purpose: reduce uploaded photos before Storage sees them; preserve a small file when suitable.
 * Depends on: browser image decoding/canvas and File APIs, used only after a staff file selection.
 * Debug: unsupported/oversized input fails before upload; the original file is never modified.
 */
/** Resize to 1600px and target 350 KB; this is media handling, separate from data services. */
export async function optimizeImage(file, { maxSide = 1600, target = 350 * 1024 } = {}) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or GIF image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB before compression.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50000000) throw new Error('This image is too large to process safely. Resize it first.');
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (ratio === 1 && file.size <= target && file.type !== 'image/gif') return file;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.82, 0.7, 0.58, 0.46]) { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality)); if (blob && blob.size <= target) break; }
    if (!blob || blob.size > 700 * 1024) throw new Error('Could not reduce this image below 700 KB. Choose a smaller image.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.png'), { type: blob.type });
  } finally { bitmap.close(); }
}
