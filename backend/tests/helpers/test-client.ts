import { signAccessToken } from '../../src/utils/tokens';
import crypto from 'crypto';

let cookies: string[] = [];
let csrfToken: string | null = null;
let accessToken: string | null = null;

export function resetClientState() {
  cookies = [];
  csrfToken = null;
  accessToken = null;
}

export function setAuthToken(token: string) {
  accessToken = token;
}

export function clearCookies() {
  cookies = [];
  csrfToken = null;
  accessToken = null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/**
 * Bootstrap the client session by registering a user, then logging in to set
 * auth cookies. CSRF is disabled in test mode, so we don't require the CSRF token.
 */
export async function bootstrapSession(baseUrl: string): Promise<void> {
  const suffix = crypto.randomBytes(4).toString('hex');
  const email = `bootstrap-${suffix}@test.com`;
  const regRes = await request(baseUrl, 'POST', '/api/v1/auth/register', {
    name: 'Bootstrap User',
    email,
    password: 'Str0ng!Pass123',
  });
  if (regRes.status !== 201) {
    throw new Error(`Bootstrap registration failed: ${regRes.status}`);
  }

  // Login to set auth cookies
  const loginRes = await request(baseUrl, 'POST', '/api/v1/auth/login', {
    email,
    password: 'Str0ng!Pass123',
  });
  if (loginRes.status !== 200) {
    throw new Error(`Bootstrap login failed: ${loginRes.status}`);
  }
}

export async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<{ status: number; body: any; headers: Headers }> {
  if (token) setAuthToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookies.length ? { Cookie: cookies.join('; ') } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(`${baseUrl}${path}`, fetchOptions);

  // Capture Set-Cookie headers
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const cookieHeader = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookieHeader) {
      const cookiePart = c.split(';')[0];
      const [name, value] = cookiePart.split('=');
      if (name && value) {
        cookies = cookies.filter((existing) => !existing.startsWith(`${name}=`));
        cookies.push(`${name}=${value}`);
        if (name === 'cf_csrf_token') csrfToken = value;
        if (name === 'cf_access_token') accessToken = value;
      }
    }
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, body: json, headers: res.headers };
}
