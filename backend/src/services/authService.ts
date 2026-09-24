import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

const JWT_SECRET = process.env.JWT_SECRET || 'reachinbox-scheduler-super-secret-key-2026';

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

export async function upsertGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
}): Promise<AuthUser> {
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: {
      name: profile.name,
      avatar: profile.avatar || null,
      googleId: profile.googleId,
    },
    create: {
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar || null,
      googleId: profile.googleId,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  };
}

export async function getOrCreateDevUser(): Promise<AuthUser> {
  const email = 'alex.morgan@reachinbox.ai';
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Alex Morgan',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    },
    create: {
      email,
      name: 'Alex Morgan',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  };
}
