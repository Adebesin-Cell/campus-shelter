import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["STUDENT", "LANDLORD"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── Property ─────────────────────────────────────────────

export const createPropertySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priceMonthly: z.number().positive("Monthly price must be positive"),
  priceWeekly: z.number().positive("Weekly price must be positive").optional(),
  location: z.string().min(2, "Location is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  rooms: z.number().int().positive("Rooms must be a positive integer"),
  bathrooms: z.number().int().positive("Bathrooms must be a positive integer"),
  furnished: z.boolean().default(false),
  wifi: z.boolean().default(false),
  electricityBackup: z.boolean().default(false),
  water: z.boolean().default(false),
  security: z.boolean().default(false),
  roomType: z.enum(["SINGLE", "SELF_CON", "MINI_FLAT"]),
  distanceFromFUTA: z.number().optional(),
  availableFrom: z.string().datetime({ message: "Invalid date format" }),
});

export const updatePropertySchema = createPropertySchema.partial();

// ─── Booking ──────────────────────────────────────────────

export const createBookingSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  leaseStart: z.string().datetime({ message: "Invalid lease start date" }),
  leaseEnd: z.string().datetime({ message: "Invalid lease end date" }),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// ─── Lease ────────────────────────────────────────────────

export const createLeaseSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  documentUrl: z.string().url("Invalid document URL"),
});

// ─── Review ───────────────────────────────────────────────

export const createReviewSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().optional(),
});

// ─── Message ──────────────────────────────────────────────

export const sendMessageSchema = z.object({
  receiverId: z.string().min(1, "Receiver ID is required"),
  propertyId: z.string().optional(),
  content: z.string().min(1, "Message content is required"),
});

// ─── Maintenance ──────────────────────────────────────────

export const createMaintenanceSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export const updateMaintenanceSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
});

// ─── Document ─────────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  type: z.string().min(1, "Document type is required"),
  fileUrl: z.string().url("Invalid file URL"),
});
