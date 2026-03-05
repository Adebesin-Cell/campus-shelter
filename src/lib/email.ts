import nodemailer from "nodemailer";
import { env } from "@/lib/env";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth:
		env.SMTP_USER && env.SMTP_PASS
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
});

export async function sendPasswordResetEmail(
	to: string,
	resetToken: string,
): Promise<void> {
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to,
		subject: "Campus Shelter — Password Reset",
		html: `
			<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
				<h2>Password Reset Request</h2>
				<p>You requested a password reset for your Campus Shelter account.</p>
				<p>Use the following token to reset your password:</p>
				<div style="background: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center; font-size: 24px; letter-spacing: 4px; font-weight: bold;">
					${resetToken}
				</div>
				<p style="margin-top: 16px; color: #666;">This token expires in 1 hour.</p>
				<p style="color: #666;">If you did not request this, you can safely ignore this email.</p>
			</div>
		`,
	});
}

export async function sendAppealSubmittedEmail(
	to: string,
	name: string,
): Promise<void> {
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to,
		subject: "Campus Shelter — Appeal Received",
		html: `
			<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
				<h2>Appeal Received</h2>
				<p>Hi ${name},</p>
				<p>We've received your suspension appeal. Our admin team will review it and get back to you as soon as possible.</p>
				<p style="color: #666;">You can check the status of your appeal from your profile page.</p>
			</div>
		`,
	});
}

export async function sendAppealDecisionEmail(
	to: string,
	name: string,
	decision: "APPROVED" | "REJECTED",
	adminNote?: string,
): Promise<void> {
	const isApproved = decision === "APPROVED";
	const subject = isApproved
		? "Campus Shelter — Appeal Approved"
		: "Campus Shelter — Appeal Rejected";
	const statusText = isApproved
		? "Your suspension appeal has been <strong>approved</strong>. Your landlord account has been reinstated and you can now access all features again."
		: "Your suspension appeal has been <strong>rejected</strong>. Your account remains suspended.";
	const noteHtml = adminNote
		? `<div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin-top: 16px;">
				<strong>Admin note:</strong>
				<p style="margin: 8px 0 0;">${adminNote}</p>
			</div>`
		: "";

	await transporter.sendMail({
		from: env.SMTP_FROM,
		to,
		subject,
		html: `
			<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
				<h2>Appeal ${isApproved ? "Approved" : "Rejected"}</h2>
				<p>Hi ${name},</p>
				<p>${statusText}</p>
				${noteHtml}
				<p style="margin-top: 16px; color: #666;">Log in to your account to see the updated status.</p>
			</div>
		`,
	});
}
