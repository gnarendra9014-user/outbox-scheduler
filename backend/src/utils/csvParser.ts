/**
 * Parse email addresses from CSV content or plain text.
 * Supports:
 *  - One email per line
 *  - CSV with "email" column header
 *  - Comma-separated emails
 */
export function parseEmailsFromContent(content: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const lines = content.split(/[\r\n]+/).filter((line) => line.trim());

  const emails: Set<string> = new Set();

  for (const line of lines) {
    // Skip header rows
    const lower = line.toLowerCase().trim();
    if (lower === 'email' || lower === 'emails' || lower === 'email_address' || lower === 'email address') {
      continue;
    }

    const matches = line.match(emailRegex);
    if (matches) {
      for (const match of matches) {
        emails.add(match.toLowerCase());
      }
    }
  }

  return Array.from(emails);
}
