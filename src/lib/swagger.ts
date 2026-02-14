import type { OpenAPIV3_1 } from "openapi-types";

export function getApiDocs(): OpenAPIV3_1.Document {
  return {
    openapi: "3.1.0",
    info: {
      title: "Campus Shelter — Student Housing API",
      version: "1.0.0",
      description:
        "Production-grade REST API for a student housing rental marketplace. Built with Next.js App Router, Prisma ORM, PostgreSQL, and JWT authentication.",
      contact: {
        name: "Campus Shelter Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Development",
      },
    ],

    // ── Tags ──────────────────────────────────────────
    tags: [
      { name: "Auth", description: "Registration and login" },
      { name: "Properties", description: "Property listing CRUD and search" },
      { name: "Bookings", description: "Booking management" },
      { name: "Leases", description: "Lease document management" },
      { name: "Reviews", description: "Property reviews and ratings" },
      { name: "Messages", description: "Student ↔ Landlord messaging" },
      { name: "Maintenance", description: "Maintenance request management" },
      { name: "Documents", description: "Document / file uploads" },
      { name: "Admin", description: "Admin-only operations" },
    ],

    // ── Global Security ───────────────────────────────
    security: [{ bearerAuth: [] }],

    // ── Paths ─────────────────────────────────────────
    paths: {
      // ─── AUTH ───────────────────────────────────────
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new user",
          description:
            "Create a new STUDENT or LANDLORD account. Returns user info and a JWT token.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterRequest" },
                example: {
                  name: "John Student",
                  email: "john@futa.edu.ng",
                  phone: "08012345678",
                  password: "password123",
                  role: "STUDENT",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User registered successfully",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: {
                              user: { $ref: "#/components/schemas/User" },
                              token: { type: "string" },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
          },
        },
      },

      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          description:
            "Authenticate with email and password. Returns user info and a JWT token.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
                example: {
                  email: "john@futa.edu.ng",
                  password: "password123",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: {
                              user: { $ref: "#/components/schemas/User" },
                              token: { type: "string" },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      // ─── PROPERTIES ─────────────────────────────────
      "/api/properties": {
        get: {
          tags: ["Properties"],
          summary: "List properties",
          description:
            "Get all approved properties with advanced filtering and pagination.",
          security: [],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
              description: "Page number",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10, maximum: 100 },
              description: "Items per page",
            },
            {
              name: "minPrice",
              in: "query",
              schema: { type: "number" },
              description: "Minimum monthly price",
            },
            {
              name: "maxPrice",
              in: "query",
              schema: { type: "number" },
              description: "Maximum monthly price",
            },
            {
              name: "location",
              in: "query",
              schema: { type: "string" },
              description: "Location (case-insensitive partial match)",
            },
            {
              name: "wifi",
              in: "query",
              schema: { type: "string", enum: ["true"] },
              description: "Filter by WiFi availability",
            },
            {
              name: "furnished",
              in: "query",
              schema: { type: "string", enum: ["true"] },
              description: "Filter by furnished status",
            },
            {
              name: "roomType",
              in: "query",
              schema: {
                type: "string",
                enum: ["SINGLE", "SELF_CON", "MINI_FLAT"],
              },
              description: "Filter by room type",
            },
            {
              name: "distanceFromFUTA",
              in: "query",
              schema: { type: "number" },
              description: "Maximum distance from FUTA (km)",
            },
            {
              name: "minRating",
              in: "query",
              schema: { type: "number", minimum: 1, maximum: 5 },
              description: "Minimum average rating",
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of properties",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PaginatedPropertyResponse",
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Properties"],
          summary: "Create property",
          description: "Create a new property listing. **Landlord only.**",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePropertyRequest" },
                example: {
                  title: "Cozy Self-Con Near FUTA",
                  description:
                    "A beautiful self-contained apartment close to campus",
                  priceMonthly: 150000,
                  location: "Aule, Akure",
                  rooms: 1,
                  bathrooms: 1,
                  roomType: "SELF_CON",
                  wifi: true,
                  furnished: true,
                  availableFrom: "2026-03-01T00:00:00.000Z",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Property created",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Property" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      "/api/properties/{id}": {
        get: {
          tags: ["Properties"],
          summary: "Get single property",
          description:
            "Get property details including landlord info, reviews, average rating, and availability.",
          security: [],
          parameters: [
            { $ref: "#/components/parameters/ResourceId" },
          ],
          responses: {
            "200": {
              description: "Property details",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/PropertyDetail" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          tags: ["Properties"],
          summary: "Update property",
          description:
            "Update a property listing. **Owner landlord only.** All fields are optional.",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePropertyRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Property updated",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Property" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          tags: ["Properties"],
          summary: "Delete property",
          description:
            "Delete a property listing. **Owner landlord or Admin only.**",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          responses: {
            "200": {
              description: "Property deleted",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: {
                              message: { type: "string" },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/properties/{id}/reviews": {
        get: {
          tags: ["Reviews"],
          summary: "Get reviews for a property",
          description:
            "Get paginated reviews for a specific property.",
          security: [],
          parameters: [
            { $ref: "#/components/parameters/ResourceId" },
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/Limit" },
          ],
          responses: {
            "200": {
              description: "Paginated reviews",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PaginatedResponse",
                  },
                },
              },
            },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── BOOKINGS ───────────────────────────────────
      "/api/bookings": {
        get: {
          tags: ["Bookings"],
          summary: "List bookings",
          description:
            "Students see their own bookings, landlords see bookings on their properties, admins see all.",
          parameters: [
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/Limit" },
          ],
          responses: {
            "200": {
              description: "Paginated bookings",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaginatedResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Bookings"],
          summary: "Create booking",
          description:
            "Book a property. **Student only.** Checks availability and prevents double booking.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateBookingRequest" },
                example: {
                  propertyId: "clxyz123",
                  leaseStart: "2026-03-01T00:00:00.000Z",
                  leaseEnd: "2026-09-01T00:00:00.000Z",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Booking created with PENDING status",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Booking" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/bookings/{id}": {
        patch: {
          tags: ["Bookings"],
          summary: "Approve or reject a booking",
          description:
            "Update booking status. **Landlord only.** Only PENDING bookings can be updated.",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateBookingStatusRequest",
                },
                example: { status: "APPROVED" },
              },
            },
          },
          responses: {
            "200": {
              description: "Booking status updated",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Booking" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── LEASES ─────────────────────────────────────
      "/api/leases": {
        post: {
          tags: ["Leases"],
          summary: "Create lease",
          description:
            "Attach a lease document to an approved booking. **Landlord only.**",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateLeaseRequest" },
                example: {
                  bookingId: "clxyz456",
                  documentUrl: "https://example.com/lease.pdf",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Lease created",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Lease" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/leases/{id}": {
        get: {
          tags: ["Leases"],
          summary: "Get lease details",
          description:
            "View lease details. Accessible by the booking student, property landlord, or admin.",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          responses: {
            "200": {
              description: "Lease details",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Lease" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── REVIEWS ────────────────────────────────────
      "/api/reviews": {
        post: {
          tags: ["Reviews"],
          summary: "Create review",
          description:
            "Review a property. **Student only.** Requires an approved booking. One review per student per property.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateReviewRequest" },
                example: {
                  propertyId: "clxyz123",
                  rating: 5,
                  comment: "Great place, very close to campus!",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Review created",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Review" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ─── MESSAGES ───────────────────────────────────
      "/api/messages": {
        get: {
          tags: ["Messages"],
          summary: "List messages",
          description:
            "Get messages for the authenticated user. Optionally filter by conversation partner with `userId` query param.",
          parameters: [
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/Limit" },
            {
              name: "userId",
              in: "query",
              schema: { type: "string" },
              description: "Conversation partner user ID",
            },
          ],
          responses: {
            "200": {
              description: "Paginated messages",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaginatedResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Messages"],
          summary: "Send message",
          description:
            "Send a message to another user. Optionally reference a property.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SendMessageRequest" },
                example: {
                  receiverId: "clxyz789",
                  content: "Is this property still available?",
                  propertyId: "clxyz123",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Message sent",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Message" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── MAINTENANCE ────────────────────────────────
      "/api/maintenance": {
        get: {
          tags: ["Maintenance"],
          summary: "List maintenance requests",
          description:
            "Students see their own, landlords see requests on their properties, admins see all.",
          parameters: [
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/Limit" },
          ],
          responses: {
            "200": {
              description: "Paginated maintenance requests",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaginatedResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Maintenance"],
          summary: "Create maintenance request",
          description:
            "Submit a maintenance request for a rented property. **Student only.** Requires approved booking.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateMaintenanceRequest",
                },
                example: {
                  propertyId: "clxyz123",
                  description:
                    "The bathroom tap is leaking and needs urgent repair.",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Maintenance request created",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            $ref: "#/components/schemas/MaintenanceRequest",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/maintenance/{id}": {
        patch: {
          tags: ["Maintenance"],
          summary: "Update maintenance request status",
          description:
            "Update status of a maintenance request. **Landlord or Admin only.**",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateMaintenanceStatusRequest",
                },
                example: { status: "IN_PROGRESS" },
              },
            },
          },
          responses: {
            "200": {
              description: "Maintenance request updated",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            $ref: "#/components/schemas/MaintenanceRequest",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── DOCUMENTS ──────────────────────────────────
      "/api/documents/upload": {
        post: {
          tags: ["Documents"],
          summary: "Upload a document",
          description:
            "Upload a file (max 10 MB). Stored locally in `public/uploads/`. Returns the file URL.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file", "type"],
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                      description: "The file to upload (max 10 MB)",
                    },
                    type: {
                      type: "string",
                      description:
                        'Document type, e.g. "ID", "LEASE", "TRANSCRIPT"',
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Document uploaded",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Document" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      // ─── ADMIN ──────────────────────────────────────
      "/api/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List all users",
          description:
            "Get paginated list of all users with relationship counts. **Admin only.**",
          parameters: [
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/Limit" },
            {
              name: "role",
              in: "query",
              schema: {
                type: "string",
                enum: ["STUDENT", "LANDLORD", "ADMIN"],
              },
              description: "Filter by user role",
            },
          ],
          responses: {
            "200": {
              description: "Paginated user list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaginatedResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      "/api/admin/analytics": {
        get: {
          tags: ["Admin"],
          summary: "Platform analytics",
          description:
            "Get aggregate analytics: total counts, booking trends, revenue estimates, top properties. **Admin only.**",
          responses: {
            "200": {
              description: "Analytics data",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            $ref: "#/components/schemas/AnalyticsResponse",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      "/api/admin/properties/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Approve / unapprove property",
          description:
            "Set the approved status of a property listing. **Admin only.**",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["approved"],
                  properties: {
                    approved: { type: "boolean" },
                  },
                },
                example: { approved: true },
              },
            },
          },
          responses: {
            "200": {
              description: "Property approval updated",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Property" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          tags: ["Admin"],
          summary: "Delete property (admin)",
          description: "Delete any property listing. **Admin only.**",
          parameters: [{ $ref: "#/components/parameters/ResourceId" }],
          responses: {
            "200": {
              description: "Property deleted",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: { message: { type: "string" } },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
    },

    // ── Components ────────────────────────────────────
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Enter your JWT token from the /api/auth/login or /api/auth/register response.",
        },
      },

      // ── Reusable Parameters ─────────────────────────
      parameters: {
        ResourceId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Resource ID (cuid)",
        },
        Page: {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Page number",
        },
        Limit: {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10, maximum: 100 },
          description: "Items per page",
        },
      },

      // ── Reusable Responses ──────────────────────────
      responses: {
        BadRequest: {
          description: "Validation error or bad request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Validation failed",
                errors: { email: ["Invalid email address"] },
              },
            },
          },
        },
        Unauthorized: {
          description: "Missing or invalid JWT token",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Unauthorized" },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions / wrong role",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Forbidden" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, message: "Not found" },
            },
          },
        },
      },

      // ── Schemas ─────────────────────────────────────
      schemas: {
        // ── Envelopes ──────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", const: true },
            data: {},
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
            errors: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", const: true },
            data: { type: "array", items: {} },
            meta: { $ref: "#/components/schemas/PaginationMeta" },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },

        // ── Request Bodies ─────────────────────────
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            password: { type: "string", minLength: 6 },
            role: {
              type: "string",
              enum: ["STUDENT", "LANDLORD"],
              default: "STUDENT",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        CreatePropertyRequest: {
          type: "object",
          required: [
            "title",
            "description",
            "priceMonthly",
            "location",
            "rooms",
            "bathrooms",
            "roomType",
            "availableFrom",
          ],
          properties: {
            title: { type: "string", minLength: 3 },
            description: { type: "string", minLength: 10 },
            priceMonthly: { type: "number" },
            priceWeekly: { type: "number" },
            location: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            rooms: { type: "integer" },
            bathrooms: { type: "integer" },
            furnished: { type: "boolean" },
            wifi: { type: "boolean" },
            electricityBackup: { type: "boolean" },
            water: { type: "boolean" },
            security: { type: "boolean" },
            roomType: {
              type: "string",
              enum: ["SINGLE", "SELF_CON", "MINI_FLAT"],
            },
            distanceFromFUTA: { type: "number" },
            availableFrom: { type: "string", format: "date-time" },
          },
        },
        CreateBookingRequest: {
          type: "object",
          required: ["propertyId", "leaseStart", "leaseEnd"],
          properties: {
            propertyId: { type: "string" },
            leaseStart: { type: "string", format: "date-time" },
            leaseEnd: { type: "string", format: "date-time" },
          },
        },
        UpdateBookingStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["APPROVED", "REJECTED"],
            },
          },
        },
        CreateLeaseRequest: {
          type: "object",
          required: ["bookingId", "documentUrl"],
          properties: {
            bookingId: { type: "string" },
            documentUrl: { type: "string", format: "uri" },
          },
        },
        CreateReviewRequest: {
          type: "object",
          required: ["propertyId", "rating"],
          properties: {
            propertyId: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
          },
        },
        SendMessageRequest: {
          type: "object",
          required: ["receiverId", "content"],
          properties: {
            receiverId: { type: "string" },
            propertyId: { type: "string" },
            content: { type: "string", minLength: 1 },
          },
        },
        CreateMaintenanceRequest: {
          type: "object",
          required: ["propertyId", "description"],
          properties: {
            propertyId: { type: "string" },
            description: { type: "string", minLength: 10 },
          },
        },
        UpdateMaintenanceStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["OPEN", "IN_PROGRESS", "RESOLVED"],
            },
          },
        },

        // ── Model Schemas ──────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            role: {
              type: "string",
              enum: ["STUDENT", "LANDLORD", "ADMIN"],
            },
            verified: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Property: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            priceMonthly: { type: "number" },
            priceWeekly: { type: "number" },
            location: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            rooms: { type: "integer" },
            bathrooms: { type: "integer" },
            furnished: { type: "boolean" },
            wifi: { type: "boolean" },
            electricityBackup: { type: "boolean" },
            water: { type: "boolean" },
            security: { type: "boolean" },
            roomType: {
              type: "string",
              enum: ["SINGLE", "SELF_CON", "MINI_FLAT"],
            },
            distanceFromFUTA: { type: "number" },
            availableFrom: { type: "string", format: "date-time" },
            approved: { type: "boolean" },
            landlordId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        PropertyDetail: {
          allOf: [
            { $ref: "#/components/schemas/Property" },
            {
              type: "object",
              properties: {
                landlord: { $ref: "#/components/schemas/User" },
                reviews: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Review" },
                },
                availability: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Availability" },
                },
                avgRating: { type: "number" },
                _count: {
                  type: "object",
                  properties: {
                    bookings: { type: "integer" },
                    reviews: { type: "integer" },
                  },
                },
              },
            },
          ],
        },
        PaginatedPropertyResponse: {
          allOf: [
            { $ref: "#/components/schemas/PaginatedResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    allOf: [
                      { $ref: "#/components/schemas/Property" },
                      {
                        type: "object",
                        properties: {
                          avgRating: { type: "number" },
                          landlord: { $ref: "#/components/schemas/User" },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
        Availability: {
          type: "object",
          properties: {
            id: { type: "string" },
            propertyId: { type: "string" },
            date: { type: "string", format: "date-time" },
            isBooked: { type: "boolean" },
          },
        },
        Booking: {
          type: "object",
          properties: {
            id: { type: "string" },
            studentId: { type: "string" },
            propertyId: { type: "string" },
            status: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
            leaseStart: { type: "string", format: "date-time" },
            leaseEnd: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            student: { $ref: "#/components/schemas/User" },
            property: { $ref: "#/components/schemas/Property" },
          },
        },
        Lease: {
          type: "object",
          properties: {
            id: { type: "string" },
            bookingId: { type: "string" },
            documentUrl: { type: "string", format: "uri" },
            signedAt: { type: "string", format: "date-time" },
            booking: { $ref: "#/components/schemas/Booking" },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
            studentId: { type: "string" },
            propertyId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            student: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string" },
            senderId: { type: "string" },
            receiverId: { type: "string" },
            propertyId: { type: "string" },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            sender: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
            },
            receiver: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
        MaintenanceRequest: {
          type: "object",
          properties: {
            id: { type: "string" },
            propertyId: { type: "string" },
            studentId: { type: "string" },
            description: { type: "string" },
            status: {
              type: "string",
              enum: ["OPEN", "IN_PROGRESS", "RESOLVED"],
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            student: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
              },
            },
            property: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                location: { type: "string" },
              },
            },
          },
        },
        Document: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            type: { type: "string" },
            fileUrl: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AnalyticsResponse: {
          type: "object",
          properties: {
            overview: {
              type: "object",
              properties: {
                totalUsers: { type: "integer" },
                totalProperties: { type: "integer" },
                totalBookings: { type: "integer" },
                recentBookings: { type: "integer" },
                totalRevenue: { type: "number" },
              },
            },
            bookingsByStatus: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  count: { type: "integer" },
                },
              },
            },
            usersByRole: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  count: { type: "integer" },
                },
              },
            },
            topPropertiesByBookings: {
              type: "array",
              items: { $ref: "#/components/schemas/Property" },
            },
            topPropertiesByRating: {
              type: "array",
              items: {
                allOf: [
                  { $ref: "#/components/schemas/Property" },
                  {
                    type: "object",
                    properties: {
                      avgRating: { type: "number" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  } as OpenAPIV3_1.Document;
}
