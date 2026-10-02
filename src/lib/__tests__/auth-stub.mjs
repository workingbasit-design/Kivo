/**
 * In-memory stand-in for the modules the auth rate-limit tests touch.
 * The REAL @/lib/rate-limit is used (that's what's under test); everything
 * else is stubbed. Pure helper modules (validations, password-policy,
 * password-reset, client-ip, zod) are not intercepted.
 */

let testIp = '9.9.9.9';
export function setTestIp(ip) {
  testIp = ip;
}

let businessUser = null;
let customerUserRow = null;
export function setBusinessUser(u) {
  businessUser = u;
}
export function setCustomerUser(u) {
  customerUserRow = u;
}

export function resetAuthStub() {
  businessUser = null;
  customerUserRow = null;
  testIp = '9.9.9.9';
}

// next/headers
export async function headers() {
  return {
    get: (name) =>
      String(name).toLowerCase() === 'x-forwarded-for' ? testIp : null,
  };
}

// next/navigation
export function redirect() {
  throw new Error('NEXT_REDIRECT');
}

// next/cache
export function revalidatePath() {}

// bcryptjs (default import)
const bcryptStub = {
  hash: async () => 'hashed',
  compare: async () => false,
};
export default bcryptStub;

// @/lib/prisma
export const prisma = {
  user: {
    findUnique: async ({ where }) =>
      businessUser && where?.email === businessUser.email ? businessUser : null,
  },
  customerUser: {
    findUnique: async ({ where }) =>
      customerUserRow && where?.email === customerUserRow.email
        ? customerUserRow
        : null,
  },
};

// @/lib/auth
export async function createSession() {
  return { id: 'sess_1' };
}
export async function destroySession() {}
export async function getSession() {
  return null;
}
export async function requireAuth() {
  throw new Error('not authenticated in tests');
}

// @/lib/customer-auth
export async function createCustomerSession() {
  return { id: 'csess_1' };
}
export async function destroyCustomerSession() {}
export function hashCustomerPassword() {
  return 'hashed';
}
export function verifyCustomerPassword() {
  return false;
}

// @/lib/i18n/server
export async function getLocale() {
  return 'en';
}

// @/lib/i18n
export function t() {
  return '';
}

// @/lib/messaging/platform-email
export async function sendPlatformEmail() {}

// @/lib/messaging/email-templates
export function welcomeEmail() {
  return { subject: '', text: '', html: '' };
}
export function passwordResetEmail() {
  return { subject: '', text: '', html: '' };
}

// @/lib/google-auth
export function validateCanadianPhone() {
  return { ok: true, digits: '5550000000' };
}

// @/lib/app-url
export async function appBaseUrl() {
  return null;
}
