/** Custom-field targets (slice 6): which record type a field definition
 * belongs to. Lives here — NOT in the actions file — because 'use server'
 * files may only export async functions (plus types); a const export
 * breaks action invocation at runtime with "A use server file can only
 * export async functions, found object". Pure and client-safe. */
export const CUSTOM_FIELD_TARGETS = ['CUSTOMER', 'PROPERTY', 'JOB'] as const;

export type CustomFieldTarget = (typeof CUSTOM_FIELD_TARGETS)[number];
