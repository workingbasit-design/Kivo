/**
 * Copy lint (Part A Item 12): Fails on copy violations in translation files.
 * - Em dashes (—), en dashes (–)
 * - Spaced hyphens used as dashes (" - ")
 * - Middle dots (·)
 * - Exclamation marks (!)
 * - All-caps strings (3+ consecutive uppercase letters, excluding placeholders)
 *
 * Usage: node scripts/check-copy-lint.mjs
 * Exit 0 if clean, 1 if violations found.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, '../src/lib/i18n');

let violations = [];

function checkFile(filepath, content) {
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Skip comments and non-string lines
    if (!line.includes("'") && !line.includes('"')) return;

    // Em dash
    if (line.includes('—')) {
      violations.push(`${filepath}:${lineNum}: em dash (—) found`);
    }
    // En dash (allow in date ranges like "Oct 12 - Oct 18"? No, use "to")
    if (line.includes('–')) {
      violations.push(`${filepath}:${lineNum}: en dash (–) found`);
    }
    // Spaced hyphen as dash (but allow in compound words, phone numbers)
    // Pattern: space-hyphen-space between words
    if (/[a-zA-Z] - [a-zA-Z]/.test(line)) {
      violations.push(`${filepath}:${lineNum}: spaced hyphen as dash (" - ") found`);
    }
    // Middle dot
    if (line.includes('·')) {
      violations.push(`${filepath}:${lineNum}: middle dot (·) found`);
    }
    // Exclamation mark (in user-facing strings, not code)
    if (line.includes('!') && (line.includes(":'") || line.includes(':"'))) {
      violations.push(`${filepath}:${lineNum}: exclamation mark (!) found`);
    }
    // All-caps strings (3+ uppercase, not a placeholder like {COUNT})
    const matches = line.match(/'([^']*)'/g) || [];
    for (const m of matches) {
      const str = m.slice(1, -1);
      // Skip if it's mostly placeholders or short
      if (str.length < 3) continue;
      const withoutPlaceholders = str.replace(/\{[^}]+\}/g, '');
      if (/[A-Z]{3,}/.test(withoutPlaceholders) && !/^[A-Z0-9\s.,'()-]+$/.test(withoutPlaceholders)) {
        // Allowlist: common abbreviations
        if (!/\b(CAD|USD|GST|HST|QST|PST|URL|API|SMS|PDF|CSV)\b/.test(withoutPlaceholders)) {
          violations.push(`${filepath}:${lineNum}: all-caps string found: ${str.slice(0, 40)}`);
        }
      }
    }
  });
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (entry.name.endsWith('.ts')) {
      const content = readFileSync(path, 'utf8');
      checkFile(path, content);
    }
  }
}

walk(I18N_DIR);

if (violations.length > 0) {
  console.error('Copy lint FAILED:');
  violations.slice(0, 50).forEach(v => console.error(`  ${v}`));
  if (violations.length > 50) {
    console.error(`  ... and ${violations.length - 50} more`);
  }
  process.exit(1);
} else {
  console.log('Copy lint PASSED');
}
