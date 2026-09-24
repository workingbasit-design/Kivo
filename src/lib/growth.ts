import { prisma } from './prisma';
import { computeProfileStrength, nextStrengthActions, type StrengthCheck } from './profile-strength';
import { getCertificationRoadmap, type Certification } from './certifications';

export interface GrowthData {
  score: number;
  nextActions: StrengthCheck[];
  allChecks: StrengthCheck[];
  roadmap: Certification[];
  trade: string | null;
  province: string | null;
  designationCount: number;
}

/**
 * Loads everything the growth UI needs, scoped to the caller's business.
 * All inputs to the score are the business's own records — nothing external.
 */
export async function getGrowthData(businessId: string): Promise<GrowthData> {
  const [business, designationCount, serviceCount, userCount, bookingPage] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        phone: true,
        address: true,
        workingHours: true,
        logoUrl: true,
        trade: true,
        taxRegion: true,
        yearsInBusiness: true,
        specialties: true,
        interacEmail: true,
        taxId: true,
        directoryOptIn: true,
      },
    }),
    prisma.designation.count({ where: { businessId } }),
    prisma.service.count({ where: { businessId } }),
    prisma.user.count({ where: { businessId } }),
    prisma.bookingPage.findUnique({ where: { businessId }, select: { enabled: true } }),
  ]);

  if (!business) {
    throw new Error('Business not found.');
  }

  let specialties: string[] = [];
  try {
    const parsed = JSON.parse(business.specialties ?? '[]');
    if (Array.isArray(parsed)) specialties = parsed.filter((s) => typeof s === 'string');
  } catch {
    specialties = [];
  }

  const { score, checks } = computeProfileStrength({
    name: business.name,
    phone: business.phone,
    address: business.address,
    workingHours: business.workingHours,
    logoUrl: business.logoUrl,
    trade: business.trade,
    province: business.taxRegion,
    yearsInBusiness: business.yearsInBusiness,
    specialties,
    interacEmail: business.interacEmail,
    taxId: business.taxId,
    directoryOptIn: business.directoryOptIn,
    bookingPageActive: bookingPage?.enabled === true,
    serviceCount,
    designationCount,
    teamMemberCount: userCount,
  });

  return {
    score,
    nextActions: nextStrengthActions(checks),
    allChecks: checks,
    roadmap: getCertificationRoadmap(business.trade, business.taxRegion),
    trade: business.trade,
    province: business.taxRegion,
    designationCount,
  };
}
