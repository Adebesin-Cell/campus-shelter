import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({ message: "Hello world!", method: "GET" });
}

export async function POST() {
	return NextResponse.json({ message: "Hello world!", method: "POST" });
}

export async function PUT() {
	return NextResponse.json({ message: "Hello world!", method: "PUT" });
}

export async function DELETE() {
	return NextResponse.json({ message: "Hello world!", method: "DELETE" });
}

export async function PATCH() {
	return NextResponse.json({ message: "Hello world!", method: "PATCH" });
}
