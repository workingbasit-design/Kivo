/**
 * Unit tests for CSV import pure logic (src/lib/csv.ts — Track 6B).
 * No DB, no network.
 * Run: node --test src/lib/__tests__/csv.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  rowToRecord,
  validateCsvRows,
  csvTemplate,
  type CsvType,
} from '@/lib/csv.ts';

test('parseCsv handles BOM, CRLF and simple rows', () => {
  const rows = parseCsv('\uFEFFname,phone\r\nMarie,514-555-0100\r\nJean,438-555-0101\r\n');
  assert.deepEqual(rows, [
    ['name', 'phone'],
    ['Marie', '514-555-0100'],
    ['Jean', '438-555-0101'],
  ]);
});

test('parseCsv handles quoted commas, doubled quotes and embedded newlines', () => {
  const rows = parseCsv(
    'name,address,notes\n"Marie, Jr.","123 Rue Sainte-Catherine\nMontréal QC","Said ""call me"" please"\nBob,Simple St,ok\n'
  );
  assert.deepEqual(rows, [
    ['name', 'address', 'notes'],
    ['Marie, Jr.', '123 Rue Sainte-Catherine\nMontréal QC', 'Said "call me" please'],
    ['Bob', 'Simple St', 'ok'],
  ]);
});

test('parseCsv skips blank lines and keeps empty cells', () => {
  const rows = parseCsv('a,b\n\n1,\n,2\n');
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', ''],
    ['', '2'],
  ]);
});

test('rowToRecord maps customers/services/jobs records', () => {
  const c = rowToRecord('customers', ['Name', 'Phone', 'Email'], ['Marie', '514', 'm@x.ca']);
  assert.deepEqual(c, { name: 'Marie', phone: '514', email: 'm@x.ca', address: null, notes: null });
  const s = rowToRecord('services', ['name', 'price', 'durationmin'], ['Drain', '120', '60']);
  assert.deepEqual(s, { name: 'Drain', price: 120, durationMin: 60, description: null });
  const j = rowToRecord(
    'jobs',
    ['title', 'customer', 'date', 'time', 'price'],
    ['Sink', 'Marie', '2026-10-05', '09:30', '150']
  );
  assert.deepEqual(j, {
    title: 'Sink',
    customerMatch: 'Marie',
    date: '2026-10-05',
    time: '09:30',
    price: 150,
    address: null,
    notes: null,
  });
});

const customersCsv = (rows: string) => `name,phone,email,address,notes\n${rows}`;
const servicesCsv = (rows: string) => `name,price,durationMin,description\n${rows}`;
const jobsCsv = (rows: string) => `title,customer,date,time,price,address,notes\n${rows}`;

test('validateCsvRows accepts a clean customers file', () => {
  const { valid, errors } = validateCsvRows(
    'customers',
    parseCsv(customersCsv('Marie,514-555-0100,m@x.ca,123 Rue,notes\n')),
    false
  );
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 1);
});

test('validateCsvRows: customers require a name (EN + FR)', () => {
  const en = validateCsvRows('customers', parseCsv(customersCsv(',514,,,\n')), false);
  assert.equal(en.errors.length, 1);
  assert.equal(en.errors[0].row, 2);
  assert.match(en.errors[0].message, /name is required/i);

  const fr = validateCsvRows('customers', parseCsv(customersCsv(',514,,,\n')), true);
  assert.match(fr.errors[0].message, /nom du client est requis/i);
});

test('validateCsvRows: services need name and price >= 0', () => {
  const bad = validateCsvRows(
    'services',
    parseCsv(servicesCsv(',120,,\nDrain,-5,,\nPlumbing,abc,,\n')),
    false
  );
  assert.equal(bad.errors.length, 3);
  assert.match(bad.errors[0].message, /name is required/i);
  assert.match(bad.errors[1].message, /negative/i);
  assert.match(bad.errors[2].message, /number/i);
});

test('validateCsvRows: jobs need title, valid YYYY-MM-DD date, price >= 0', () => {
  const { errors } = validateCsvRows(
    'jobs',
    parseCsv(
      jobsCsv(
        ',Marie,2026-10-05,09:30,150,,\n' + // missing title
          'Sink,Marie,2026-02-30,09:30,150,,\n' + // impossible date
          'Sink,Marie,10/05/2026,09:30,150,,\n' + // wrong format
          'Sink,Marie,2026-10-05,25:00,150,,\n' + // bad time
          'Sink,Marie,2026-10-05,09:30,-1,,\n' + // negative price
          'Sink,,2026-10-05,09:30,150,,\n' // missing customer
      )
    ),
    false
  );
  assert.equal(errors.length, 6);
  assert.match(errors[1].message, /valid calendar date/i);
  assert.match(errors[3].message, /HH:MM/i);
});

test('validateCsvRows accepts leap day and zero price', () => {
  const { valid, errors } = validateCsvRows(
    'jobs',
    parseCsv(jobsCsv('Sink,Marie,2024-02-29,,0,,\n')),
    false
  );
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 1);
});

test('validateCsvRows flags invalid email, bilingual', () => {
  const en = validateCsvRows('customers', parseCsv(customersCsv('Marie,,not-an-email,,\n')), false);
  assert.match(en.errors[0].message, /email/i);
  const fr = validateCsvRows('customers', parseCsv(customersCsv('Marie,,not-an-email,,\n')), true);
  assert.match(fr.errors[0].message, /courriel/i);
});

test('validateCsvRows flags empty file', () => {
  const { errors } = validateCsvRows('customers', parseCsv(''), false);
  assert.equal(errors.length, 1);
});

test('csvTemplate returns header + one example row per type', () => {
  const types: CsvType[] = ['customers', 'services', 'jobs'];
  const expected: Record<CsvType, string> = {
    customers: 'name,phone,email,address,notes',
    services: 'name,price,durationMin,description',
    jobs: 'title,customer,date,time,price,address,notes',
  };
  for (const t of types) {
    const lines = csvTemplate(t).split('\n').filter(Boolean);
    assert.equal(lines.length, 2, t);
    assert.equal(lines[0], expected[t]);
    // Example row parses back to the same column count
    assert.equal(parseCsv(csvTemplate(t))[1].length, expected[t].split(',').length);
  }
});
