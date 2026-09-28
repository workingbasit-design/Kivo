/**
 * Professional HTML email templates for EveryJob transactional emails.
 *
 * Design: clean, minimal, human. Table-based layout with inline styles for
 * maximum email-client compatibility (Gmail, Outlook, Apple Mail).
 * Every template carries the EveryJob logo in the header and a branded
 * footer. Copy is written to sound like a person, not a robot — bilingual
 * EN/FR throughout.
 *
 * Each template returns { subject, html, text } so callers can send both
 * parts (HTML preferred, plain-text fallback).
 */

const LOGO_URL = 'https://kivo-nine-silk.vercel.app/apple-touch-icon.png';
const BRAND_DARK = '#161616';
const BRAND_LIME = '#C8F04A';
const TEXT_DARK = '#1a1a1a';
const TEXT_MUTED = '#6b7280';
const BORDER = '#e5e7eb';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function shell(opts: {
  preheader: string;
  bodyEn: string;
  bodyFr: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EveryJob</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:${BRAND_DARK};padding:28px 32px;text-align:center;">
<img src="${LOGO_URL}" alt="EveryJob" width="44" height="44" style="display:inline-block;border-radius:10px;">
<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;margin-top:10px;">EveryJob</div>
<div style="color:${BRAND_LIME};font-size:13px;margin-top:4px;">Every job. One place.</div>
</td></tr>
<tr><td style="padding:32px 32px 8px 32px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">
${opts.bodyEn}
</td></tr>
<tr><td style="padding:8px 32px 8px 32px;"><hr style="border:none;border-top:1px solid ${BORDER};margin:16px 0;"></td></tr>
<tr><td style="padding:0 32px 8px 32px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">
${opts.bodyFr}
</td></tr>
<tr><td style="padding:24px 32px 32px 32px;text-align:center;">
<img src="${LOGO_URL}" alt="EveryJob" width="32" height="32" style="display:inline-block;border-radius:8px;opacity:0.9;">
<div style="color:${TEXT_MUTED};font-size:12px;margin-top:10px;line-height:1.5;">
EveryJob — Every job. One place.<br>
Made in Canada
</div>
<div style="color:${TEXT_MUTED};font-size:11px;margin-top:12px;line-height:1.5;max-width:420px;margin-left:auto;margin-right:auto;">
You're receiving this because it's related to your EveryJob account. EveryJob never sends marketing email — only account, quote, and invoice messages you asked for.<br>
Vous recevez ce courriel parce qu'il concerne votre compte EveryJob. EveryJob n'envoie jamais de courriels marketing — seulement les messages de compte, devis et factures que vous avez demandés.
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(label: string, url: string): string {
  return `<div style="margin:24px 0;text-align:center;">
<a href="${url}" style="display:inline-block;background-color:${BRAND_DARK};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:8px;">${label}</a>
</div>`;
}

function greeting(name: string): string {
  return `<p style="margin:0 0 16px 0;">Hi ${name},</p>`;
}

function greetingFr(name: string): string {
  return `<p style="margin:0 0 16px 0;">Bonjour ${name},</p>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 16px 0;">${text}</p>`;
}

function signoff(teamEn = '— The EveryJob team', teamFr = '— L’équipe EveryJob'): string {
  return `<p style="margin:24px 0 0 0;">${teamEn}</p>`;
}

function signoffFr(): string {
  return `<p style="margin:24px 0 0 0;">— L’équipe EveryJob</p>`;
}

/**
 * Plain-text footer appended to every transactional email: explains why the
 * recipient got it and states the no-marketing-email policy. (CAN-SPAM /
 * CASL hygiene for the day we ever send anything promotional.)
 */
function textFooter(): string[] {
  return [
    '',
    '---',
    '',
    "You're receiving this because it's related to your EveryJob account. EveryJob never sends marketing email — only account, quote, and invoice messages you asked for.",
    'Vous recevez ce courriel parce qu\u2019il concerne votre compte EveryJob. EveryJob n\u2019envoie jamais de courriels marketing.',
  ];
}

/** Escape user-controlled values interpolated into HTML. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- Welcome ---------------- */

export function welcomeEmail(name: string, business: string): EmailTemplate {
  const n = esc(name.trim() || 'there');
  const b = esc(business.trim());
  const subject = `Welcome to EveryJob, ${name.trim() || 'there'} — let's get your first job booked`;
  const bodyEn =
    greeting(n) +
    para(`Your account for <strong>${b}</strong> is ready. Everything's in one place now — jobs, schedule, quotes, invoices, and customers.`) +
    para(`A good first step: add your first job and see how the schedule comes together. It takes about a minute.`) +
    button('Open your dashboard', 'https://kivo-nine-silk.vercel.app/dashboard') +
    para(`If you ever get stuck, just reply to this email. A real person reads these.`) +
    signoff();
  const bodyFr =
    greetingFr(n) +
    para(`Votre compte pour <strong>${b}</strong> est prêt. Tout est maintenant au même endroit — travaux, horaire, devis, factures et clients.`) +
    para(`Pour commencer : ajoutez votre premier travail et voyez votre horaire se remplir. Ça prend environ une minute.`) +
    button('Ouvrir votre tableau de bord', 'https://kivo-nine-silk.vercel.app/dashboard') +
    para(`Si vous avez besoin d’aide, répondez simplement à ce courriel. Une vraie personne lit ces messages.`) +
    signoffFr();
  const text = [
    `Hi ${name.trim() || 'there'},`,
    '',
    `Your account for ${business.trim()} is ready. Everything's in one place now — jobs, schedule, quotes, invoices, and customers.`,
    '',
    'Open your dashboard: https://kivo-nine-silk.vercel.app/dashboard',
    '',
    'If you ever get stuck, just reply to this email. A real person reads these.',
    '',
    '— The EveryJob team',
    '',
    '---',
    '',
    `Bonjour ${name.trim() || 'there'},`,
    '',
    `Votre compte pour ${business.trim()} est prêt.`,
    '',
    'Ouvrir votre tableau de bord : https://kivo-nine-silk.vercel.app/dashboard',
    '',
    '— L’équipe EveryJob',
    ...textFooter(),
  ].join('\n');
  return {
    subject,
    html: shell({ preheader: `Your EveryJob account for ${business.trim()} is ready.`, bodyEn, bodyFr }),
    text,
  };
}

/* ---------------- Password reset ---------------- */

export function passwordResetEmail(name: string, link: string): EmailTemplate {
  const n = esc(name.trim() || 'there');
  const subject = 'Reset your EveryJob password / Réinitialisez votre mot de passe EveryJob';
  const bodyEn =
    greeting(n) +
    para(`Someone asked to reset the password on your EveryJob account. If that was you, here's your link — it's good for one hour and works once:`) +
    button('Reset my password', esc(link)) +
    para(`Didn't ask for this? Just ignore this email. Your password stays exactly as it is.`) +
    signoff();
  const bodyFr =
    greetingFr(n) +
    para(`Quelqu’un a demandé à réinitialiser le mot de passe de votre compte EveryJob. Si c’était vous, voici votre lien — valide une heure, usage unique :`) +
    button('Réinitialiser mon mot de passe', esc(link)) +
    para(`Vous n’avez rien demandé? Ignorez simplement ce courriel. Votre mot de passe reste inchangé.`) +
    signoffFr();
  const text = [
    `Hi ${name.trim() || 'there'},`,
    '',
    'Someone asked to reset the password on your EveryJob account.',
    `Reset it here (valid 1 hour, one-time use): ${link}`,
    '',
    'Didn’t ask for this? Just ignore this email — your password is unchanged.',
    '',
    '— The EveryJob team',
    '',
    '---',
    '',
    `Bonjour ${name.trim() || 'there'},`,
    '',
    `Réinitialisez-le ici (valide 1 heure, usage unique) : ${link}`,
    '',
    '— L’équipe EveryJob',
    ...textFooter(),
  ].join('\n');
  return {
    subject,
    html: shell({ preheader: 'A password reset was requested for your EveryJob account.', bodyEn, bodyFr }),
    text,
  };
}

/* ---------------- Quote sent ---------------- */

export function quoteEmail(opts: {
  customerName: string;
  businessName: string;
  quoteNumber: string;
  quoteTitle: string;
  total: string;
  link: string;
}): EmailTemplate {
  const c = esc(opts.customerName);
  const b = esc(opts.businessName);
  const qn = esc(opts.quoteNumber);
  const qt = esc(opts.quoteTitle);
  const total = esc(opts.total);
  const subject = `Quote ${opts.quoteNumber} from ${opts.businessName} / Devis ${opts.quoteNumber} de ${opts.businessName}`;
  const bodyEn =
    greeting(c) +
    para(`<strong>${b}</strong> put together quote <strong>${qn}</strong> for you — <strong>${qt}</strong>, total <strong>${total}</strong>.`) +
    para(`You can look it over and approve it right here:`) +
    button('View quote', esc(opts.link)) +
    para(`Questions? Just reply to this email and it'll reach them directly.`) +
    signoff(`— ${b} <span style="color:${TEXT_MUTED};">via EveryJob</span>`);
  const bodyFr =
    greetingFr(c) +
    para(`<strong>${b}</strong> a préparé le devis <strong>${qn}</strong> pour vous — <strong>${qt}</strong>, total <strong>${total}</strong>.`) +
    para(`Vous pouvez le consulter et l’approuver ici :`) +
    button('Voir le devis', esc(opts.link)) +
    para(`Des questions? Répondez simplement à ce courriel, il leur parviendra directement.`) +
    signoffFr();
  const text = [
    `Hi ${opts.customerName},`,
    '',
    `${opts.businessName} put together quote ${opts.quoteNumber} for you — ${opts.quoteTitle}, total ${opts.total}.`,
    `View it here: ${opts.link}`,
    '',
    `— ${opts.businessName} via EveryJob`,
    '',
    '---',
    '',
    `Bonjour ${opts.customerName},`,
    '',
    `Voir le devis ici : ${opts.link}`,
    '',
    `— ${opts.businessName} via EveryJob`,
    ...textFooter(),
  ].join('\n');
  return {
    subject,
    html: shell({ preheader: `${opts.businessName} sent you quote ${opts.quoteNumber} (${opts.total}).`, bodyEn, bodyFr }),
    text,
  };
}

/* ---------------- Invoice sent ---------------- */

export function invoiceEmail(opts: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  total: string;
  link: string;
}): EmailTemplate {
  const c = esc(opts.customerName);
  const b = esc(opts.businessName);
  const inv = esc(opts.invoiceNumber);
  const total = esc(opts.total);
  const subject = `Invoice ${opts.invoiceNumber} from ${opts.businessName} / Facture ${opts.invoiceNumber} de ${opts.businessName}`;
  const bodyEn =
    greeting(c) +
    para(`Here's invoice <strong>${inv}</strong> from <strong>${b}</strong> — total <strong>${total}</strong>.`) +
    para(`You can view it and pay online:`) +
    button('View invoice', esc(opts.link)) +
    para(`Questions about the invoice? Just reply to this email.`) +
    signoff(`— ${b} <span style="color:${TEXT_MUTED};">via EveryJob</span>`);
  const bodyFr =
    greetingFr(c) +
    para(`Voici la facture <strong>${inv}</strong> de <strong>${b}</strong> — total <strong>${total}</strong>.`) +
    para(`Vous pouvez la consulter et payer en ligne :`) +
    button('Voir la facture', esc(opts.link)) +
    para(`Des questions au sujet de la facture? Répondez simplement à ce courriel.`) +
    signoffFr();
  const text = [
    `Hi ${opts.customerName},`,
    '',
    `Here is invoice ${opts.invoiceNumber} from ${opts.businessName} — total ${opts.total}.`,
    `View and pay here: ${opts.link}`,
    '',
    `— ${opts.businessName} via EveryJob`,
    '',
    '---',
    '',
    `Bonjour ${opts.customerName},`,
    '',
    `Voir la facture ici : ${opts.link}`,
    '',
    `— ${opts.businessName} via EveryJob`,
    ...textFooter(),
  ].join('\n');
  return {
    subject,
    html: shell({ preheader: `Invoice ${opts.invoiceNumber} from ${opts.businessName} (${opts.total}).`, bodyEn, bodyFr }),
    text,
  };
}
