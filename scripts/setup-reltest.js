/**
 * Test setup for workstream A verification (temporary).
 * Creates a uniquely-named test business with user + session cookie.
 * Run: node scripts/setup-reltest.js   (prints session cookie + ids)
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

(async () => {
  const tag = 'RelTest A';
  // Clean any previous run first.
  const prev = await prisma.business.findMany({ where: { name: { startsWith: tag } }, select: { id: true } });
  for (const b of prev) {
    await prisma.business.delete({ where: { id: b.id } });
  }

  const business = await prisma.business.create({
    data: { name: `${tag} ShareTokens`, regionCode: 'IN', currency: 'INR', taxRegion: '18' },
  });
  const passwordHash = await bcrypt.hash('testpass123', 12);
  const user = await prisma.user.create({
    data: { email: 'reltest-a@example.com', name: 'RelTest A', passwordHash, role: 'ADMIN', businessId: business.id },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });
  const customer = await prisma.customer.create({
    data: { name: 'RelTest Customer', phone: '+91 99999 88888', businessId: business.id },
  });

  // Second business for tenant-isolation checks.
  const businessB = await prisma.business.create({
    data: { name: `${tag} OtherBiz`, regionCode: 'IN', currency: 'INR' },
  });
  const userB = await prisma.user.create({
    data: { email: 'reltest-b@example.com', name: 'RelTest B', passwordHash, role: 'ADMIN', businessId: businessB.id },
  });
  const sessionB = await prisma.session.create({
    data: { userId: userB.id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });

  console.log(JSON.stringify({
    businessId: business.id,
    sessionCookie: session.id,
    customerId: customer.id,
    businessBId: businessB.id,
    sessionBCookie: sessionB.id,
  }));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
