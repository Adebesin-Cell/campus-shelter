import { NextResponse } from "next/server";

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function paginated<T>(data: T[], meta: PaginationMeta) {
  return NextResponse.json({ success: true, data, meta }, { status: 200 });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function badRequest(message: string, errors?: unknown) {
  return NextResponse.json(
    { success: false, message, errors },
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ success: false, message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  console.error("[Server Error]", message);
  return NextResponse.json({ success: false, message }, { status: 500 });
}

/**
 * Extract pagination params from URL search params.
 */
export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
