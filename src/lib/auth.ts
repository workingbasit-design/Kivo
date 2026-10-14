import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma.ts';
import { DatabaseUnavailableError } from './db-errors.ts';
import { getActiveMembershipForUser } from './membership.ts';
import crypto from 'crypto';

export async function createSession(userId: string) {
  // B7.5 session rotation on login: invalidate ALL of this user's prior
  // sessions before issuing the new one, so a fresh login always rotates
  // the session id and kills sessions from other devices. (The old code
  // only purged expired rows.)
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set('kivo_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('kivo_session')?.value;
  if (!sessionId) return null;

  let session;
  try {
    session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  } catch {
    // Database unreachable: the session might be perfectly valid, so
    // report "unknown" loudly instead of the lie "not logged in".
    throw new DatabaseUnavailableError();
  }

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Deterministic cleanup: the presented session is expired, so delete
    // that exact row now. This is the path hit when a stale cookie arrives,
    // keeping the hot path to a single delete.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Opportunistic global sweep: ~2% of authenticated requests delete ALL
  // expired sessions. Cheap amortized cost (one extra query per ~50
  // requests); guarantees the Session table can't grow unboundedly even if a
  // user never logs in/out again. Fire-and-forget so the request isn't
  // slowed - a failed sweep just retries on a later request.
  if (Math.random() < 0.02) {
    void prisma.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
  }

  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    // Pages and server actions: send the visitor to sign in instead of
    // rendering the generic error page. (API routes must NOT use this -
    // they need a 401 JSON response, so they call getSession() directly.)
    redirect('/login');
  }
  // M9: the business context comes from the user's ACTIVE membership
  // (Membership is the authority for role + business assignment since M1;
  // User.role / User.businessId were dropped in M9). A user with no active
  // membership has no business context and is sent back to sign in.
  const membership = await getActiveMembershipForUser(session.user.id);
  if (!membership) {
    redirect('/login');
  }
  return {
    user: session.user,
    businessId: membership.businessId,
    role: membership.role,
    membershipId: membership.id,
  };
}

/**
 * B7.5: end ALL of a user's sessions immediately. Called when a team
 * member is removed (or their role changes, when a role-change path
 * exists) so a removed member cannot keep using an existing session.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('kivo_session')?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookieStore.delete('kivo_session');
}
