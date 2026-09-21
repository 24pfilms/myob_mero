/**
 * Local development sign-in, so the login screen does not interrupt your own work.
 *
 * This does NOT fake the auth check. It asks the server for a real token for the
 * local `dev` account, so owner scoping and the journal's work/personal isolation
 * behave exactly as they will in production. A faked client-side bypass would
 * break that isolation, which is the one rule the journal rests on.
 *
 * There is no password here and none in the bundle. The server refuses
 * /auth/dev-login unless it is explicitly running in development, so a built
 * bundle cannot reach past it even though this code ships inside one.
 *
 * When the product goes commercial, drop MERO_ALLOW_DEV_LOGIN from the server
 * environment and the login screen returns with no frontend change.
 */

import { api, ApiUser } from './api';

export function isDevAutoLoginEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_DEV_AUTO_LOGIN !== 'false';
}

export async function attemptDevAutoLogin(): Promise<ApiUser | null> {
  if (!isDevAutoLoginEnabled()) return null;
  try {
    const user = await api.devLogin();
    console.info(`[dev] Signed in as "${user.username}". Set VITE_DEV_AUTO_LOGIN=false in Mero/.env.local for the login screen.`);
    return user;
  } catch (error) {
    console.warn('[dev] Automatic sign-in is unavailable, showing the login screen. The server allows it only when MERO_ALLOW_DEV_LOGIN=true.', error);
    return null;
  }
}
