const FULL_TO_HALF_DIGITS = strMap("０１２３４５６７８９", "0123456789");

function strMap(source: string, target: string): Map<string, string> {
  return new Map(source.split("").map((char, index) => [char, target[index]]));
}

export function normalizeText(value: string | null | undefined): string {
  return `${value ?? ""}`.trim();
}

export function normalizeDigits(value: string | null | undefined): string {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  return text
    .split("")
    .map((char) => FULL_TO_HALF_DIGITS.get(char) ?? char)
    .filter((char) => /\d/.test(char))
    .join("");
}

export function extractJan(productName: string | null | undefined): string | null {
  const source = normalizeText(productName);
  const matched = source.match(/[（(]([0-9０-９]{13})[）)]/);

  if (!matched) {
    return null;
  }

  const jan = normalizeDigits(matched[1]);
  return jan.length === 13 ? jan : null;
}

export function buildItfCore(itf: string | null | undefined): string | null {
  const normalized = normalizeDigits(itf);

  if (normalized.length <= 2) {
    return null;
  }

  return normalized.slice(1, -1);
}

export function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeNullableDigits(value: string | null | undefined): string | null {
  const normalized = normalizeDigits(value);
  return normalized.length > 0 ? normalized : null;
}
