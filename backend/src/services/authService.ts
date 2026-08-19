import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../db/prisma';
import { UserResponse } from '../types';

const oauth2Client = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl
);

/**
 * Generate the Google OAuth consent URL.
 */
export function getGoogleAuthUrl(): string {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

/**
 * Exchange the OAuth authorization code for user info,
 * upsert the user in the database, and issue a JWT.
 */
export async function handleGoogleCallback(
  code: string
): Promise<{ token: string; user: UserResponse }> {
  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info from Google
  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: config.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }

  const { sub: googleId, email, name, picture } = payload;

  if (!googleId || !email || !name) {
    throw new Error('Missing required user info from Google');
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { googleId },
    update: {
      email,
      name,
      avatar: picture || null,
    },
    create: {
      googleId,
      email,
      name,
      avatar: picture || null,
    },
  });

  // Issue JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  };
}

/**
 * Verify a JWT and return the user.
 */
export async function verifyToken(token: string): Promise<UserResponse | null> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
  } catch {
    return null;
  }
}
