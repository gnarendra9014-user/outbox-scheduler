import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { getGoogleAuthUrl, handleGoogleCallback, verifyToken } from '../services/authService';
import { authMiddleware } from '../middleware/auth';
import { config } from '../config';

const router = Router();

/**
 * GET /api/auth/google
 * Redirect to Google OAuth consent screen.
 */
router.get('/google', (_req: Request, res: Response) => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
});

/**
 * POST /api/auth/demo
 * Quick login for development / demonstration testing.
 */
router.post('/demo', async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.upsert({
      where: { googleId: 'demo-user-google-id-12345' },
      update: {},
      create: {
        googleId: 'demo-user-google-id-12345',
        email: 'naninani38817@gmail.com',
        name: 'Nani',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocL8XoM6Y5aYk8eW4TfG7',
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (err: any) {
    console.error('[Auth] Demo login error:', err.message);
    res.status(500).json({ error: 'Failed to log in with demo account' });
  }
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback, issue JWT, redirect to frontend.
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${config.frontendUrl}/login?error=missing_code`);
      return;
    }

    const { token, user } = await handleGoogleCallback(code);

    // Set JWT as HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Redirect to frontend dashboard with token in URL for SPA to capture
    res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
  } catch (err: any) {
    console.error('[Auth] Google callback error:', err.message);
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user.
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Get token from header or cookie
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      res.status(401).json({ error: 'No token found' });
      return;
    }

    const user = await verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Clear auth cookie.
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

export default router;
