import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(10).max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, { message: "Passwords do not match", path: ["confirmation"] });
export const appRoles = ["super_admin","admin","manager","sales_executive","installation_staff","service_technician","accountant","customer"];

export const indianMobile = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number");
export const pinCode = z.string().regex(/^[1-9]\d{5}$/, "Enter a valid PIN code");
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional()
});
export const leadSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  mobile: indianMobile,
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  customerType: z.enum(["Residential", "Commercial", "Industrial"]),
  monthlyBill: z.number().nonnegative().optional(),
  capacityKw: z.number().positive().max(100000).optional(),
  source: z.string().trim().min(1).max(80),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  notes: z.string().trim().max(2000).optional()
});
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: indianMobile,
  email: z.string().email().optional().or(z.literal("")),
  type: z.enum(["site_survey", "quotation", "contact"]),
  message: z.string().trim().max(2000).optional()
});
