// Salted SHA-256 is enough for a browser mock; a real server should use bcrypt or argon2.
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function newSalt(): string {
  const a = new Uint8Array(16);
  globalThis.crypto.getRandomValues(a);
  return hex(a.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return hex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const got = await hashPassword(password, salt);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function newId(prefix: string): string {
  const a = new Uint8Array(6);
  globalThis.crypto.getRandomValues(a);
  return `${prefix}_${hex(a.buffer)}`;
}
