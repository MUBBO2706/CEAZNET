import { loadDeviceCacheUnified, saveDeviceCacheUnified } from '../../../utils/deviceCacheShared.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: "Model parameter is required" });
    const cleanModel = model.toString().trim().toUpperCase();
    
    // Load current cache from unified storage (Telegram support included!)
    const data = await loadDeviceCacheUnified();
    
    let found = false;
    // Search and delete matching keys case-insensitively
    for (const key of Object.keys(data)) {
      if (key.trim().toUpperCase() === cleanModel) {
        delete data[key];
        found = true;
      }
    }
    
    if (found) {
      await saveDeviceCacheUnified(data);
    }
    
    return res.status(200).json({ success: true, model: cleanModel });
  } catch (err: any) {
    console.error("Error deleting cache entry:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
