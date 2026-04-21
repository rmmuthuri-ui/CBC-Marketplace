export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "");

  if (/^07\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`;
  }

  if (/^\+254\d{9}$/.test(cleaned)) {
    return cleaned.slice(1);
  }

  if (/^254\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  throw new Error("Invalid phone number format. Use 07XXXXXXXX or +254XXXXXXXXX.");
}

export function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export function generatePassword(
  shortcode: string,
  passkey: string,
  timestamp: string,
): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}
