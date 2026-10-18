/** Preserve today's pg SSL semantics explicitly when parsing older connection URLs. */
export function databaseUrlOptions(connectionString: string, disableSsl = false) {
  const url = new URL(connectionString);
  const mode = url.searchParams.get('sslmode');
  if (disableSsl) {
    for (const key of ['ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
    url.searchParams.set('sslmode', 'disable');
  } else if (url.searchParams.get('uselibpqcompat') !== 'true' && ['prefer', 'require', 'verify-ca'].includes(mode || '')) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  const urlControlsSsl = ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some(key => url.searchParams.has(key));
  return {
    connectionString: url.toString(),
    ...(urlControlsSsl ? {} : { ssl: { rejectUnauthorized: true } }),
  };
}

export function appOrigin(...values: Array<string | undefined>): string {
  for (const value of values) {
    try {
      const url = new URL(value || '');
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.hostname.includes('*') && !url.username && !url.password) return url.origin;
    } catch { /* Try the next configured origin. */ }
  }
  return 'https://chat.makwanatechsolution.in';
}

export function pushCredentialsError(env: Record<string, string | undefined>): string | null {
  if (env.RENDER === 'true' && !env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() && !env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return 'Push notifications are not configured on Render. Set FIREBASE_SERVICE_ACCOUNT_KEY to the Firebase service-account JSON, or set GOOGLE_APPLICATION_CREDENTIALS to a mounted credential file, then redeploy.';
  }
  return null;
}
