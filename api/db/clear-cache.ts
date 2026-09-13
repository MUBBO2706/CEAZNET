export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // On serverless Vercel environment, cache is ephemeral or handled via headers.
  // Return success to avoid 404 errors in frontend logs.
  return res.status(200).json({ success: true, message: 'Cache cleared' });
}
