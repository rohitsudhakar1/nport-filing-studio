// Check-digit validation for securities identifiers.
// A fund admin sending a transposed or mistyped CUSIP is a real, common data-quality
// failure; validating the check digit catches it before it lands in an SEC filing.

/**
 * CUSIP: 9 characters. First 8 are the issuer+issue; the 9th is a check digit computed
 * via the modulus-10 "double-add-double" algorithm (SEC/CUSIP Global Services spec).
 * Letters map A=10..Z=35; '*'=36, '@'=37, '#'=38.
 */
export function isValidCusip(raw: string): boolean {
  const cusip = raw.trim().toUpperCase();
  if (!/^[0-9A-Z*@#]{9}$/.test(cusip)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const c = cusip[i];
    let v: number;
    if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55; // A=10
    else if (c === "*") v = 36;
    else if (c === "@") v = 37;
    else v = 38; // '#'

    if (i % 2 === 1) v *= 2; // double every second digit (0-indexed odd positions)
    sum += Math.floor(v / 10) + (v % 10);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(cusip[8]);
}

/**
 * ISIN: 12 chars — 2-letter country code + 9-char NSIN + 1 check digit (Luhn over the
 * digit expansion of all letters).
 */
export function isValidIsin(raw: string): boolean {
  const isin = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;

  // Expand letters to numbers (A=10..Z=35), building a long digit string.
  let digits = "";
  for (const c of isin) {
    digits += c >= "0" && c <= "9" ? c : (c.charCodeAt(0) - 55).toString();
  }

  // Luhn from the right.
  let sum = 0;
  let dbl = true;
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits.charCodeAt(digits.length - 1) - 48;
}

/** LEI: 20 alphanumerics; last 2 are ISO 17442 mod-97-10 check digits. */
export function isValidLei(raw: string): boolean {
  const lei = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) return false;
  // mod-97-10 (ISO 7064): expand letters, treat as big integer, mod 97 must equal 1.
  let expanded = "";
  for (const c of lei) {
    expanded += c >= "0" && c <= "9" ? c : (c.charCodeAt(0) - 55).toString();
  }
  // Chunked mod to avoid BigInt overhead.
  let remainder = 0;
  for (const ch of expanded) {
    remainder = (remainder * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}
