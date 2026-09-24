import { z } from 'zod';
import { TRADE_KEYS } from './certifications.ts';

export const DESIGNATION_TYPES = [
  'LICENSE',
  'RED_SEAL',
  'PROVINCIAL_CERT',
  'BBB',
  'INSURANCE',
  'BONDING',
  'MANUFACTURER',
  'OTHER',
] as const;

export type DesignationType = (typeof DESIGNATION_TYPES)[number];

const dateField = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Enter a valid date');

export const designationSchema = z.object({
  type: z.enum(DESIGNATION_TYPES),
  title: z.string().trim().min(2, 'Title is required').max(120),
  issuer: z.string().trim().max(120).optional().default(''),
  number: z.string().trim().max(60).optional().default(''),
  issuedAt: dateField,
  expiresAt: dateField,
});

export const tradeProfileSchema = z.object({
  trade: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === '' || (TRADE_KEYS as readonly string[]).includes(v), 'Unknown trade'),
  yearsInBusiness: z.coerce.number().int().min(0).max(150).nullable().optional(),
  specialties: z
    .array(z.string().trim().min(1).max(80))
    .max(12, 'Keep it to 12 specialties or fewer')
    .optional()
    .default([]),
});

export type DesignationInput = z.input<typeof designationSchema>;
export type TradeProfileInput = z.input<typeof tradeProfileSchema>;
