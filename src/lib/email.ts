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
