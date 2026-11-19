const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function isValidPassword(value: string) {
  return value.length >= 8;
}

export function isValidPersonName(value: string) {
  return value.length >= 2 && value.length <= 120;
}

export function isValidFarmName(value: string) {
  return value.length >= 2 && value.length <= 120;
}
