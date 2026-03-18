export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/chat";
  }

  return value;
}

export function buildNextPath(pathname: string, search: string): string {
  return sanitizeNextPath(`${pathname}${search || ""}`);
}
