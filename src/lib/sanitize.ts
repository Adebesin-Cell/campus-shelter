/**
 * Basic text sanitization — strips HTML tags and trims whitespace.
 * Used for user-submitted text fields (appeal reasons, admin notes, etc.)
 */
export function sanitizeText(input: string): string {
	return input
		.replace(/<[^>]*>/g, "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.trim();
}
