import { z } from "zod";

export const registerSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z
		.string()
		.email("Invalid email address")
		.transform((e) => e.toLowerCase()),
	phone: z.string().optional(),
	password: z.string().min(8, "Password must be at least 8 characters"),
	role: z.enum(["STUDENT", "LANDLORD"]).default("STUDENT"),
	idCardUrl: z.string().min(1).optional(),
});

export const updateLandlordStatusSchema = z.object({
	status: z.enum(["VERIFIED", "REJECTED", "SUSPENDED"]),
	suspensionReason: z.string().min(1).optional(),
});

export const loginSchema = z.object({
	email: z
		.string()
		.email("Invalid email address")
		.transform((e) => e.toLowerCase()),
	password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
	email: z
		.string()
		.email("Invalid email address")
		.transform((e) => e.toLowerCase()),
});

export const resetPasswordSchema = z.object({
	token: z.string().min(1, "Reset token is required"),
	newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const createPropertySchema = z.object({
	title: z.string().min(10, "Title must be at least 10 characters"),
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
	images: z
		.array(z.string().min(1, "Image path must not be empty"))
		.optional()
		.default([]),
	roomType: z.enum(["SINGLE", "SELF_CON", "MINI_FLAT"]),
	distanceFromFUTA: z.number().optional(),
	availableFrom: z.string().datetime({ message: "Invalid date format" }),
	landlordId: z.string().optional(),
	notes: z
		.string()
		.max(2000, "Notes must be under 2000 characters")
		.optional()
		.nullable(),
});

export const updatePropertyStatusSchema = z
	.object({
		status: z.enum(["APPROVED", "REJECTED", "ARCHIVED"]),
		rejectionNote: z.string().min(1).max(2000).optional(),
	})
	.refine(
		(data) => data.status !== "REJECTED" || !!data.rejectionNote?.trim(),
		{ message: "A rejection reason is required", path: ["rejectionNote"] },
	);

export const updatePropertySchema = createPropertySchema.partial();

export const createBookingSchema = z.object({
	propertyId: z.string().min(1, "Property ID is required"),
	leaseStart: z.string().datetime({ message: "Invalid lease start date" }),
	leaseEnd: z.string().datetime({ message: "Invalid lease end date" }),
});

export const updateBookingStatusSchema = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
});

export const createLeaseSchema = z.object({
	bookingId: z.string().min(1, "Booking ID is required"),
	documentUrl: z.string().url("Invalid document URL"),
	gracePeriodDays: z.number().int().min(0).max(365).default(0),
	terms: z.string().max(5000, "Terms must be under 5000 characters").optional(),
	duration: z.string().max(100).optional(),
});

export const updateLeaseSchema = z.object({
	gracePeriodDays: z.number().int().min(0).max(365).optional(),
	terms: z.string().max(5000, "Terms must be under 5000 characters").optional(),
	duration: z.string().max(100).optional(),
	documentUrl: z.string().url("Invalid document URL").optional(),
});

export const evictBookingSchema = z.object({
	reason: z.string().min(10, "Eviction reason must be at least 10 characters"),
});

export const createReviewSchema = z.object({
	propertyId: z.string().min(1, "Property ID is required"),
	rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
	comment: z.string().optional(),
});

export const sendMessageSchema = z.object({
	receiverId: z.string().min(1, "Receiver ID is required"),
	propertyId: z.string().optional(),
	content: z.string().min(1, "Message content is required"),
});

export const createMaintenanceSchema = z.object({
	propertyId: z.string().min(1, "Property ID is required"),
	description: z.string().min(10, "Description must be at least 10 characters"),
});

export const updateMaintenanceSchema = z.object({
	status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
});

export const uploadDocumentSchema = z.object({
	type: z.string().min(1, "Document type is required"),
	fileUrl: z.string().url("Invalid file URL"),
});

export const saveBankDetailSchema = z.object({
	bankCode: z.string().min(1, "Bank code is required"),
	accountNumber: z.string().length(10, "Account number must be 10 digits"),
});

export const initializePaymentSchema = z.object({
	bookingId: z.string().min(1, "Booking ID is required"),
});

export const refundPaymentSchema = z.object({
	reason: z.string().min(5, "Refund reason is required"),
});

export const fundWalletSchema = z.object({
	amount: z
		.number()
		.min(500, "Minimum funding amount is ₦500")
		.max(1000000, "Maximum funding amount is ₦1,000,000"),
});

export const walletPaySchema = z.object({
	bookingId: z.string().min(1, "Booking ID is required"),
});
