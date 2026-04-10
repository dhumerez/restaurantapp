import bcrypt from 'bcryptjs';

export const DUMMY_HASH =
  '$2b$12$invalidhashpadding0000000000000000000000000000000000000000000';

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
