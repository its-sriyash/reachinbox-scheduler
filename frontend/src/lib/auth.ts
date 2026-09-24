export function getGoogleAuthUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${base}/auth/google`;
}
