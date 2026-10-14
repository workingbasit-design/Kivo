/**
 * B5 injection tests: XSS payloads across render surfaces, CSV formula
 * injection, and email header injection.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderHelpBody } from '../help-render.ts';
import { esc, quoteEmail, invoiceEmail } from '../messaging/email-templates.ts';
import { escapeCsvCell } from '../costing.ts';
import { sanitizeHeader } from '../header-sanitize.ts';

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  'javascript:alert(1)',
];

describe('B5.2 help renderer neutralizes markup', () => {
  for (const p of PAYLOADS) {
    it(`escapes ${p.slice(0, 24)}...`, () => {
      const html = renderHelpBody(`## ${p}\n- ${p}\n${p}`);
      assert.ok(!html.includes('<script>'), 'raw script tag must not survive');
      assert.ok(!/<img[\s>]/.test(html), 'raw img tag must not survive');
      assert.ok(!/<svg[\s>]/.test(html), 'raw svg tag must not survive');
      assert.ok(!/onerror\s*=/.test(html.replace(/&lt;[^&]*&gt;/g, '')), 'live event handler must not survive');
      if (p.includes('<')) {
        assert.ok(html.includes('&lt;'), 'payload must be escaped');
      }
    });
  }
  it('emits only the fixed tag allowlist', () => {
    const html = renderHelpBody('## T\n- a\n1. b\nplain');
    const tags = [...html.matchAll(/<(\/?[a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
    for (const t of tags) {
      assert.ok(['h2', 'ul', 'li', 'p'].includes(t.replace('/', '')), `unexpected tag: ${t}`);
    }
  });
});

describe('B5.3 email templates escape user content', () => {
  for (const p of PAYLOADS) {
    it(`quoteEmail escapes ${p.slice(0, 24)}...`, () => {
      const tpl = quoteEmail({
        customerName: p,
        businessName: p,
        quoteNumber: 'Q-1',
        quoteTitle: p,
        total: '$10.00',
        link: 'https://example.com/q/1',
        locale: 'en',
      });
      assert.ok(!tpl.html.includes('<script>alert(1)</script>'), 'raw payload in HTML body');
      // A live handler would appear outside escaped regions; inert text inside &lt;...&gt; is fine.
      const live = tpl.html.replace(/&lt;[^&]*?&gt;/g, '');
      assert.ok(!/onerror\s*=/.test(live), 'live event handler in HTML body');
    });
    it(`invoiceEmail escapes ${p.slice(0, 24)}...`, () => {
      const tpl = invoiceEmail({
        customerName: p,
        businessName: p,
        invoiceNumber: 'INV-1',
        total: '$10.00',
        dueDate: '2026-11-01',
        link: 'https://example.com/i/1',
        locale: 'en',
      });
      assert.ok(!tpl.html.includes('<script>alert(1)</script>'), 'raw payload in HTML body');
    });
  }
  it('esc() handles the full payload set', () => {
    for (const p of PAYLOADS) {
      const out = esc(p);
      assert.ok(!out.includes('<'), `esc() left a raw <: ${p}`);
    }
  });
});

describe('B5.4 CSV formula injection is neutralized', () => {
  it("prefixes cells starting with = + - @", () => {
    const evil = `=2+5+cmd|' /C calc'!A0`;
    const cell = escapeCsvCell(evil);
    assert.ok(!cell.startsWith('='), `cell must not start with =: ${cell}`);
    // The original value is still visible (text marker), just unevaluable.
    assert.ok(cell.includes('=2+5'), 'original text preserved');
  });
  for (const prefix of ['=HYPERLINK("https://evil.example","x")', '+cmd', '-2+3', '@SUM(1:1)']) {
    it(`neutralizes ${prefix.slice(0, 18)}...`, () => {
      const cell = escapeCsvCell(prefix);
      assert.ok(!/^[=+\-@]/.test(cell), `cell starts with formula char: ${cell}`);
    });
  }
  it('leaves plain numbers summable', () => {
    assert.equal(escapeCsvCell(123.45), '123.45');
    assert.equal(escapeCsvCell('Marie Tremblay'), 'Marie Tremblay');
  });
});

describe('B5.5 email header injection is stripped', () => {
  it('strips CRLF Bcc injection from names', () => {
    const evil = 'Acme Corp\r\nBcc: evil@x.com';
    const clean = sanitizeHeader(evil);
    assert.ok(!clean.includes('\r') && !clean.includes('\n'), 'no CR/LF may survive');
    // "Bcc:" may remain as inert text, but without CR/LF it cannot start a new header.
    assert.ok(!/[\r\n]/.test(clean), 'no header boundary characters');
  });
  it('strips URL-encoded CRLF', () => {
    const clean = sanitizeHeader('Hi%0d%0aSubject: pwned');
    assert.ok(!/%0d|%0a/i.test(clean), 'encoded CRLF must be gone');
  });
  it('keeps legitimate names intact', () => {
    assert.equal(sanitizeHeader('Café Béton Inc.'), 'Café Béton Inc.');
  });
});
