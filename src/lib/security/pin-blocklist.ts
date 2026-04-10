/**
 * Trivially-guessable PINs blocked at signup.
 * Existing accounts are NOT affected — login is unrestricted.
 */
const BLOCKED: ReadonlySet<string> = new Set([
  // All-same digits
  "0000", "1111", "2222", "3333", "4444",
  "5555", "6666", "7777", "8888", "9999",
  // Sequential runs
  "0123", "1234", "2345", "3456", "4567",
  "5678", "6789", "9876", "8765", "7654",
  "6543", "5432", "4321", "3210", "1230",
  // Common patterns
  "1010", "2020", "0101", "1212", "2121",
  "1122", "2211", "1100", "0011",
]);

export function isWeakPin(pin: string): boolean {
  return BLOCKED.has(pin);
}
