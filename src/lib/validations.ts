import { z } from "zod";

export const JOB_STATUSES = [
  "NEW",
  "SCHEDULED",
  "IN PROGRESS",
  "COMPLETED",
  "PAID",
  "CANCELLED",
] as const;

export const INVOICE_STATUSES = ["UNPAID", "PARTIALLY PAID", "PAID"] as const;
export const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "DECLINED"] as const;
export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED"] as const;
export const RECURRING_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  // Format is validated in the action via libphonenumber-js for the
  // business's region; Zod only guards shape/length here.
  phone: z.string().trim().max(25).optional().default(""),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email")
    .optional()
    .default(""),
  address: z.string().trim().max(500).optional().default(""),
  province: z.string().trim().max(40).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const jobSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  customerId: z.string().min(1, "Customer is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  price: z.coerce.number().min(0, "Price can't be negative").max(10_000_000),
  status: z.enum(JOB_STATUSES).default("SCHEDULED"),
  notes: z.string().trim().max(2000).optional().default(""),
  technician: z.string().trim().max(120).optional().default(""),
  assignedToId: z.string().optional().nullable(),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  price: z.coerce.number().min(0, "Price can't be negative").max(10_000_000),
});

export const quoteSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  customerId: z.string().min(1, "Customer is required"),
  total: z.coerce.number().min(0, "Total can't be negative").max(10_000_000),
  status: z.enum(QUOTE_STATUSES).default("DRAFT"),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  subtotal: z.coerce.number().min(0).max(10_000_000),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  taxType: z.string().trim().max(20).optional().default("GST"),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive").max(10_000_000),
  provider: z.enum(["CASH", "INTERAC", "CHEQUE", "STRIPE"]).default("CASH"),
  transactionId: z.string().trim().max(200).optional().default(""),
});

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  // Format is validated in the action via libphonenumber-js for the
  // business's region; Zod only guards shape/length here.
  phone: z.string().trim().max(25).optional().default(""),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email")
    .optional()
    .default(""),
  details: z.string().trim().max(2000).optional().default(""),
  source: z.string().trim().max(100).optional().default(""),
  status: z.enum(LEAD_STATUSES).default("NEW"),
});

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(200),
  regionCode: z.string().trim().max(10).optional().default("CA"),
});

export const recurringSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  customerId: z.string().min(1, "Customer is required"),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  price: z.coerce.number().min(0, "Price can't be negative").max(10_000_000),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(100),
  businessName: z.string().trim().min(2, "Business name is required").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(128),
});
