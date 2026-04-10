import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function issueAccessToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = '15m',
): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn } as jwt.SignOptions);
}
