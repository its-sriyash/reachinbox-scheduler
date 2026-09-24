import { Router, Request, Response } from 'express';
import {
  signToken,
  upsertGoogleUser,
  getOrCreateDevUser,
} from '../services/authService.js';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

router.get('/google', (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(
      `${FRONTEND_URL}?auth_error=Google_OAuth_credentials_not_configured_in_backend_env._Please_set_GOOGLE_CLIENT_ID_or_use_Development_Sandbox.`
    );
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    console.error('Google OAuth error or code missing:', error);
    return res.redirect(`${FRONTEND_URL}?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Failed to exchange code with Google:', errText);
      return res.redirect(`${FRONTEND_URL}?auth_error=token_exchange_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // 2. Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      console.error('Failed to fetch userinfo from Google:', errText);
      return res.redirect(`${FRONTEND_URL}?auth_error=profile_fetch_failed`);
    }

    const profile = (await profileRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    // 3. Upsert user in database
    const user = await upsertGoogleUser({
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      avatar: profile.picture,
    });

    // 4. Generate JWT and set HTTP-only cookie
    const token = signToken(user);
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${FRONTEND_URL}?token=${token}`);
  } catch (err) {
    console.error('Error during Google OAuth callback:', err);
    return res.redirect(`${FRONTEND_URL}?auth_error=server_error`);
  }
});

router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json(req.user);
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token');
  return res.json({ message: 'Logged out successfully' });
});

router.post('/dev-login', async (_req: Request, res: Response) => {
  try {
    const user = await getOrCreateDevUser();
    const token = signToken(user);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user, token });
  } catch (err) {
    console.error('Dev login failed:', err);
    return res.status(500).json({ error: 'Dev login failed' });
  }
});

export default router;
