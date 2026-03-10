const ACCOUNT_NUMBER_REGEX = /\b\d{10}\b/;

/**
 * Detects if a message contains what looks like a Nigerian bank account number
 * (standalone 10-digit sequence). Nigerian phone numbers are 11 digits,
 * so word boundaries help avoid false positives.
 */
export function detectAccountNumber(content: string): boolean {
	return ACCOUNT_NUMBER_REGEX.test(content);
}

export const FLAG_REASON_ACCOUNT_NUMBER =
	"This message was flagged for containing a possible bank account number. For your safety, never share bank details or make payments outside CampusShelter. All transactions must go through our secure payment system.";
