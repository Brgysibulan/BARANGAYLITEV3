/**
 * Purpose: catch syntax errors, broken module/script paths, and legacy design coupling.
 * Depends on: Node built-ins and the checked-in source; no database/network access.
 * Debug: the thrown error names the file or script rule that failed.
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
/** Enumerate project files without inspecting Git internals or installed dependencies. */
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(root);
for (const file of files) {
  if (/\.(m?js)$/.test(file)) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    const source = await readFile(file, 'utf8');
    // Preserve the owner's rule: every code module explains its role and debugging entry point.
    const header = source.match(/^\/\*\*[\s\S]*?\*\//)?.[0] || '';
    if (!header.includes('Purpose:') || !header.includes('Debug:')) throw new Error(`Missing maintenance/debugging header: ${file}`);
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"](\.[^'"]+)['"]/g)) await access(path.resolve(path.dirname(file), match[1]));
  }
  if (file.endsWith('.html')) {
    const source = await readFile(file, 'utf8');
    if (/<style\b|\sstyle=|rel=["']stylesheet/i.test(source)) throw new Error(`Unexpected legacy styling: ${file}`);
    for (const match of source.matchAll(/src="([^"]+)"/g)) {
      if (match[1].startsWith('https:')) {
        if (match[1] !== 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/dist/umd/supabase.js') throw new Error('Unapproved external script');
      } else await access(path.resolve(path.dirname(file), match[1]));
    }
  }
}
// DOM/router utilities are intentionally presentation-related; data services are not.
const logicFiles = files.filter(file => /assets[\\/]js[\\/](core|data)[\\/]/.test(file) && !/dom\.js|router\.js/.test(file));
for (const file of logicFiles) {
  const text = await readFile(file, 'utf8');
  if (/\bdocument\.|\bcreateElement\b|\binnerHTML\b|\bstyle\.setProperty|\bserviceWorker\b|\blocalStorage\.removeItem/.test(text)) throw new Error(`Presentation side effect in logic module: ${file}`);
}
console.log(`Checked ${files.length} files: syntax, imports, HTML script paths, and presentation/logic separation.`);
