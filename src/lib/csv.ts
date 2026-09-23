/**
 * Pure CSV import helpers (Track 6B: CSV import).
 *
 * parseCsv is a real state-machine parser (quoted commas/quotes/embedded
 * newlines, BOM, CRLF). rowToRecord maps rows to typed import records.
 * validateCsvRows enforces strict per-type rules with bilingual messages
 * (fr flag) and returns per-row errors with 1-based file line numbers
 * (header = row 1, first data row = row 2).
 *
 * No Next.js imports — runs under plain node:test.
 */
import { escapeCsvCell } from './costing.ts';

export type CsvType = 'customers' | 'services' | 'jobs';

export type CustomerRecord = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export type ServiceRecord = {
  name: string;
  price: number;
  durationMin: number | null;
  description: string | null;
};

export type JobRecord = {
  title: string;
  customerMatch: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  price: number;
  address: string | null;
  notes: string | null;
};

export type CsvRecord = CustomerRecord | ServiceRecord | JobRecord;

export type CsvRowError = { row: number; message: string };

const m = (fr: boolean, en: string, french: string) => (fr ? french : en);

/** Parse CSV text into rows of cells. Handles BOM, CRLF, quoted commas,
 *  doubled quotes, and embedded newlines inside quoted fields. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushRow = () => {
    // Skip fully blank lines (a single empty cell).
    if (row.length === 1 && row[0] === '') return;
    rows.push(row);
  };

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += c;
        i += 1;
      }
    } else if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
      i += 1;
    } else if (c === '\r') {
      row.push(cell);
      cell = '';
      pushRow();
      row = [];
      i += src[i + 1] === '\n' ? 2 : 1;
    } else if (c === '\n') {
      row.push(cell);
      cell = '';
      pushRow();
      row = [];
      i += 1;
    } else {
      cell += c;
      i += 1;
    }
  }
  row.push(cell);
  pushRow();
  return rows;
}

/** Header row (first row) → normalized column name → index map. */
function headerMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, idx) => {
    const key = h.trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
}

function col(map: Map<string, number>, row: string[], name: string): string {
  const idx = map.get(name);
  return idx === undefined ? '' : (row[idx] ?? '').trim();
}

/** Map one CSV data row to a typed record for the given type. */
export function rowToRecord(type: CsvType, header: string[], row: string[]): CsvRecord {
  const map = headerMap(header);
  if (type === 'customers') {
    return {
      name: col(map, row, 'name'),
      phone: col(map, row, 'phone') || null,
      email: col(map, row, 'email') || null,
      address: col(map, row, 'address') || null,
      notes: col(map, row, 'notes') || null,
    } as CustomerRecord;
  }
  if (type === 'services') {
    const durationRaw = col(map, row, 'durationmin');
    return {
      name: col(map, row, 'name'),
      price: Number(col(map, row, 'price')),
      durationMin: durationRaw === '' ? null : Number(durationRaw),
      description: col(map, row, 'description') || null,
    } as ServiceRecord;
  }
  return {
    title: col(map, row, 'title'),
    customerMatch: col(map, row, 'customer'),
    date: col(map, row, 'date'),
    time: col(map, row, 'time') || null,
    price: Number(col(map, row, 'price')),
    address: col(map, row, 'address') || null,
    notes: col(map, row, 'notes') || null,
  } as JobRecord;
}

function isValidDateISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, mo, d] = s.split('-').map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isValidTime(s: string): boolean {
  const mt = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return !!mt;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCustomer(r: CustomerRecord, fr: boolean): string | null {
  if (!r.name) return m(fr, 'Customer name is required.', 'Le nom du client est requis.');
  if (r.email && !EMAIL_RE.test(r.email))
    return m(fr, 'Email address looks invalid.', 'L’adresse courriel semble invalide.');
  return null;
}

function validateService(r: ServiceRecord, fr: boolean): string | null {
  if (!r.name) return m(fr, 'Service name is required.', 'Le nom du service est requis.');
  if (r.price === undefined || r.price === null || Number.isNaN(r.price))
    return m(fr, 'Price is required and must be a number.', 'Le prix est requis et doit être un nombre.');
  if (r.price < 0)
    return m(fr, 'Price cannot be negative.', 'Le prix ne peut pas être négatif.');
  if (r.durationMin !== null && (Number.isNaN(r.durationMin) || r.durationMin < 0 || !Number.isInteger(r.durationMin)))
    return m(
      fr,
      'Duration must be a whole number of minutes, 0 or more.',
      'La durée doit être un nombre entier de minutes, 0 ou plus.'
    );
  return null;
}

function validateJob(r: JobRecord, fr: boolean): string | null {
  if (!r.title) return m(fr, 'Job title is required.', 'Le titre du travail est requis.');
  if (!r.customerMatch)
    return m(
      fr,
      'Customer is required (must match an existing customer name or phone).',
      'Le client est requis (doit correspondre au nom ou au téléphone d’un client existant).'
    );
  if (!isValidDateISO(r.date))
    return m(
      fr,
      'Date must be a valid calendar date in YYYY-MM-DD format.',
      'La date doit être une date valide au format AAAA-MM-JJ.'
    );
  if (r.time && !isValidTime(r.time))
    return m(fr, 'Time must be HH:MM (24-hour).', 'L’heure doit être au format HH:MM (24 h).');
  if (Number.isNaN(r.price))
    return m(fr, 'Price is required and must be a number.', 'Le prix est requis et doit être un nombre.');
  if (r.price < 0) return m(fr, 'Price cannot be negative.', 'Le prix ne peut pas être négatif.');
  return null;
}

/**
 * Validate data rows for a CSV import. `rows` is the raw output of
 * parseCsv (header included); `fr` selects French error messages.
 * Returns the valid typed records plus per-row errors.
 */
export function validateCsvRows(
  type: CsvType,
  rows: string[][],
  fr: boolean
): { valid: CsvRecord[]; errors: CsvRowError[] } {
  const valid: CsvRecord[] = [];
  const errors: CsvRowError[] = [];
  if (rows.length === 0) {
    errors.push({ row: 0, message: m(fr, 'The file is empty.', 'Le fichier est vide.') });
    return { valid, errors };
  }
  const header = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const rowNum = i + 1; // 1-based file line number
    const rec = rowToRecord(type, header, rows[i]);
    const problem =
      type === 'customers'
        ? validateCustomer(rec as CustomerRecord, fr)
        : type === 'services'
          ? validateService(rec as ServiceRecord, fr)
          : validateJob(rec as JobRecord, fr);
    if (problem) errors.push({ row: rowNum, message: problem });
    else valid.push(rec);
  }
  return { valid, errors };
}

const TEMPLATE_HEADERS: Record<CsvType, string[]> = {
  customers: ['name', 'phone', 'email', 'address', 'notes'],
  services: ['name', 'price', 'durationMin', 'description'],
  jobs: ['title', 'customer', 'date', 'time', 'price', 'address', 'notes'],
};

const TEMPLATE_EXAMPLES: Record<CsvType, string[]> = {
  customers: ['Marie Tremblay', '(514) 555-0123', 'marie@example.ca', '123 Rue Sainte-Catherine, Montréal QC', 'Prefers morning visits'],
  services: ['Drain cleaning', '120', '60', 'Clear clogged drains with snake and camera'],
  jobs: ['Kitchen sink repair', 'Marie Tremblay', '2026-10-05', '09:30', '150', '123 Rue Sainte-Catherine, Montréal QC', 'Bring replacement trap'],
};

/** Header + one example row for a CSV import template. */
export function csvTemplate(type: CsvType): string {
  const header = TEMPLATE_HEADERS[type].map(escapeCsvCell).join(',');
  const example = TEMPLATE_EXAMPLES[type].map(escapeCsvCell).join(',');
  return `${header}\n${example}\n`;
}
