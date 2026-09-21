import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const clientVersion = req.query.currentVersion;
    let serverVersion = 'unknown';

    // 1. Primary: Check Vercel deployment identifiers first (most authoritative on Vercel deployments)
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      serverVersion = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 10);
    } else if (process.env.VERCEL_DEPLOYMENT_ID) {
      serverVersion = process.env.VERCEL_DEPLOYMENT_ID;
    }

    // 2. Secondary: Check local filesystem candidate locations (for local dev / containers)
    if (serverVersion === 'unknown') {
      try {
        const candidatePaths = [
          path.join(process.cwd(), 'public', 'version.json'),
          path.join(process.cwd(), 'dist', 'version.json'),
          path.join(process.cwd(), 'api', 'version.json'),
          path.join(__dirname, 'version.json'),
          path.join(process.cwd(), 'version.json'),
        ];

        let highestTimestamp = 0;
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            try {
              const fileContent = fs.readFileSync(p, 'utf8');
              const parsed = JSON.parse(fileContent);
              if (parsed.version) {
                const num = parseInt(parsed.version, 10);
                if (!isNaN(num) && num > highestTimestamp) {
                  highestTimestamp = num;
                  serverVersion = String(num);
                } else if (serverVersion === 'unknown') {
                  serverVersion = String(parsed.version);
                }
              }
            } catch {}
          }
        }
      } catch (fsErr) {
        console.warn('[Vercel Serverless] Failed to read version.json from filesystem:', fsErr);
      }
    }

    // 3. Fallback: If still unknown, try fetching via HTTP from the current host
    if (serverVersion === 'unknown' && req.headers.host) {
      try {
        const host = req.headers.host;
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const url = `${protocol}://${host}/version.json?t=${Date.now()}`;
        const response = await fetch(url, {
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        if (response.ok) {
          const parsed = await response.json();
          serverVersion = parsed.version || 'unknown';
        }
      } catch (httpErr) {
        console.warn('[Vercel Serverless] Failed to fetch version.json via HTTP:', httpErr);
      }
    }

    const isNewVersionAvailable = Boolean(
      clientVersion &&
      clientVersion !== 'unknown' &&
      serverVersion !== 'unknown' &&
      serverVersion !== clientVersion
    );

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      serverVersion,
      clientVersion: clientVersion || 'unknown',
      hasUpdate: isNewVersionAvailable,
      message: isNewVersionAvailable 
        ? `New version found! Update from version ${clientVersion} to ${serverVersion} is available.` 
        : `You are up to date (Version ${clientVersion || serverVersion}).`
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
