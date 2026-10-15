/** Minimal Next.js server stubs for unit tests. */
export class NextResponse extends Response {
  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  }
}
// next/headers + next/navigation: imported by some lib modules but unused on
// the code paths under test.
export async function headers() {
  return { get: () => null };
}
export async function cookies() {
  return { get: () => undefined, set: () => {} };
}
export function redirect() {
  throw new Error('NEXT_REDIRECT');
}
export function notFound() {
  throw new Error('NEXT_NOT_FOUND');
}
