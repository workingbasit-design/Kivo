import { cookies } from 'next/headers';
import { prisma } from './prisma';
import crypto from 'crypto';

export async function createSession(userId: string) {
  // Scoped cleanup on login: purge this user's expired sessions so repeated
  // logins can't accumulate dead rows for active users.
  await prisma.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

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

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: { business: true } } },
  });

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
  // slowed — a failed sweep just retries on a later request.
  if (Math.random() < 0.02) {
    void prisma.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
  }

  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session || !session.user.businessId) {
    throw new Error('Unauthorized');
  }
  return {
    user: session.user,
    businessId: session.user.businessId,
  };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('kivo_session')?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookieStore.delete('kivo_session');
}
