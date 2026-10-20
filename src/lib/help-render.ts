/**
 * Help-article body renderer (Prompt 3, B5.2).
 *
 * Minimal markdown-ish renderer: ## headings, - bullets, paragraphs.
 * ALL text is HTML-escaped first - article bodies are admin-authored trusted
 * data, but escaping keeps the renderer safe by construction, so even a
 * compromised article cannot inject script. The allowlist of emitted tags is
 * fixed: h2, ul, li, p (with fixed class attributes). No <a>, no <img>, no
 * event handlers, no user-controlled attributes - nothing to sanitize beyond
 * the escaping.
 *
 * Pure; runs under plain node:test.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHelpBody(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(
        `<h2 class="mt-6 mb-2 text-base font-bold text-ink">${escapeHtml(line.slice(3))}</h2>`
      );
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul class="my-2 space-y-1.5 list-disc pl-5 text-sm text-ink">');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line === '') {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    } else if (/^\d+\. /.test(line)) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<p class="my-1.5 text-sm text-ink">${escapeHtml(line)}</p>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<p class="my-2 text-sm leading-6 text-ink">${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}
