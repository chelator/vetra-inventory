import { z } from "zod";

// Schema version for localStorage migration
export const SCHEMA_VERSION = 1;

export const ItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1, "Name is required"),
  quantity: z.number().min(0).default(0),
  unit: z.string().default(""),
  category: z.string().default("Other"),
  notes: z.string().default(""),
  minStock: z.number().min(0).default(0),
  batchNumber: z.string().default(""),
  expiryDate: z.string().default(""),
  stockAlert: z.boolean().optional().default(false),
});

export const DamageSchema = z.object({
  id: z.string(),
  number: z.string().default(""),
  type: z.string().default(""),
  severity: z.string().default(""),
  radius: z.string().default(""),
  locations: z.array(z.string()).default([]),
  notes: z.string().default(""),
  estimatedHours: z.union([z.number(), z.string()]).optional().default(0),
  status: z.enum(["notstarted", "inprogress", "complete"]).default("notstarted"),
});

export const BladeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  damages: z.array(DamageSchema).default([]),
});

export const TurbineSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  blades: z.array(BladeSchema).default([]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Project name is required"),
  status: z.string().default("notstarted"),
  turbines: z.array(TurbineSchema).default([]),
  client: z.string().optional().default(""),
  windFarm: z.string().optional().default(""),
  location: z.string().optional().default(""),
  projectRef: z.string().optional().default(""),
  turbineModel: z.string().optional().default(""),
  bladeType: z.string().optional().default(""),
  team: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  mobDate: z.string().optional().default(""),
  plannedEndDate: z.string().optional().default(""),
  projectNotes: z.string().optional().default(""),
  archived: z.boolean().optional().default(false),
});

export const MaterialUsageSchema = z.object({
  itemId: z.union([z.string(), z.number()]),
  amount: z.union([z.string(), z.number()]),
});

export const OperationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().min(1, "Operation type is required"),
  duration: z.union([z.string(), z.number()]).default(""),
  notes: z.string().default(""),
  materials: z.array(MaterialUsageSchema).default([]),
});

export const JobSchema = z.object({
  id: z.union([z.string(), z.number()]),
  projectId: z.string().optional(),
  turbineId: z.string().optional(),
  bladeId: z.string().optional(),
  damageId: z.string().optional(),
  turbine: z.string().default(""),
  bladeRef: z.string().default(""),
  damage: z.object({}).passthrough().optional(),
  date: z.string().default(""),
  technician: z.string().default(""),
  accessMethod: z.string().default(""),
  weather: z.object({}).passthrough().optional(),
  notes: z.string().default(""),
  operations: z.array(OperationSchema).default([]),
  materials: z.array(MaterialUsageSchema).default([]),
});

// Validate and sanitize data loaded from localStorage
export function validateItems(data) {
  if (!Array.isArray(data)) return { valid: false, data: [], errors: ["Items is not an array"] };
  const items = [];
  const errors = [];
  for (let i = 0; i < data.length; i++) {
    const result = ItemSchema.safeParse(data[i]);
    if (result.success) {
      items.push(result.data);
    } else {
      // Keep the item as-is but log the error
      items.push(data[i]);
      errors.push(`Item ${i}: ${result.error.issues.map((e) => e.message).join(", ")}`);
    }
  }
  return { valid: errors.length === 0, data: items, errors };
}

export function validateProjects(data) {
  if (!Array.isArray(data)) return { valid: false, data: [], errors: ["Projects is not an array"] };
  const projects = [];
  const errors = [];
  for (let i = 0; i < data.length; i++) {
    const result = ProjectSchema.safeParse(data[i]);
    if (result.success) {
      projects.push(result.data);
    } else {
      projects.push(data[i]);
      errors.push(`Project ${i}: ${result.error.issues.map((e) => e.message).join(", ")}`);
    }
  }
  return { valid: errors.length === 0, data: projects, errors };
}

export function validateJobs(data) {
  if (!Array.isArray(data)) return { valid: false, data: [], errors: ["Jobs is not an array"] };
  const jobs = [];
  const errors = [];
  for (let i = 0; i < data.length; i++) {
    const result = JobSchema.safeParse(data[i]);
    if (result.success) {
      jobs.push(result.data);
    } else {
      jobs.push(data[i]);
      errors.push(`Job ${i}: ${result.error.issues.map((e) => e.message).join(", ")}`);
    }
  }
  return { valid: errors.length === 0, data: jobs, errors };
}

// Schema versioning — run migrations on localStorage data
export function migrateLocalStorage() {
  try {
    const version = parseInt(localStorage.getItem("vetra-schema-version") || "0", 10);
    if (version < SCHEMA_VERSION) {
      // Future migrations go here:
      // if (version < 2) { ... }
      localStorage.setItem("vetra-schema-version", String(SCHEMA_VERSION));
    }
  } catch {
    // localStorage unavailable, skip
  }
}
