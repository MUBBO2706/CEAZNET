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

    // 1. Try local filesystem (for local dev or if files are bundled/included in serverless context)
    try {
      let versionFilePath = path.join(process.cwd(), 'dist', 'version.json');
      if (!fs.existsSync(versionFilePath)) {
        versionFilePath = path.join(process.cwd(), 'public', 'version.json');
      }
      if (fs.existsSync(versionFilePath)) {
        const fileContent = fs.readFileSync(versionFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        serverVersion = parsed.version || 'unknown';
      }
    } catch (fsErr) {
      console.warn('[Vercel Serverless] Failed to read version.json from filesystem:', fsErr);
    }

    // 2. If filesystem failed, try fetching via HTTP from the current host
    if (serverVersion === 'unknown' && req.headers.host) {
      try {
        const host = req.headers.host;
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const url = `${protocol}://${host}/version.json`;
        const response = await fetch(url);
        if (response.ok) {
          const parsed = await response.json();
          serverVersion = parsed.version || 'unknown';
        }
      } catch (httpErr) {
        console.warn('[Vercel Serverless] Failed to fetch version.json via HTTP:', httpErr);
      }
    }

    const isNewVersionAvailable = clientVersion && clientVersion !== 'dev' && serverVersion !== 'unknown' && serverVersion !== clientVersion;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      serverVersion,
      clientVersion: clientVersion || 'unknown',
      hasUpdate: !!isNewVersionAvailable,
      message: isNewVersionAvailable 
        ? `New version found! Update from version ${clientVersion} to ${serverVersion} is available.` 
        : `You are up to date (Version ${clientVersion}).`
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
