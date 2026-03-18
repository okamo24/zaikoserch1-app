function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

const allowedEmails = parseAllowedEmails(process.env.AUTH_ALLOWED_EMAILS);

export function hasAllowedEmailConfig(): boolean {
  return allowedEmails.size > 0;
}

export function isAllowedEmail(email: string): boolean {
  if (!hasAllowedEmailConfig()) {
    return true;
  }

  return allowedEmails.has(normalizeEmail(email));
}

export function getAllowedEmailError(): string {
  return "このメールアドレスは許可されていません。管理者に確認してください。";
}

export function getAllowedEmails(): string[] {
  return Array.from(allowedEmails);
}
