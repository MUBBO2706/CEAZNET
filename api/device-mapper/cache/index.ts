import { loadDeviceCacheUnified, saveDeviceCacheUnified } from '../../../utils/deviceCacheShared.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const data = await loadDeviceCacheUnified();
      return res.status(200).json(data);
    } catch (err: any) {
      console.error("Error reading cache list:", err.message);
      return res.status(500).json({ error: err.message });
    }
  } 
  
  if (req.method === 'POST') {
    try {
      const { model, name } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      const cleanModel = model.toString().trim().toUpperCase();
      const cleanName = name === "" || name === null ? null : name.toString().trim();
      
      // Update persistent unified cache (Telegram support included inside!)
      const data = await loadDeviceCacheUnified();
      data[cleanModel] = cleanName;
      await saveDeviceCacheUnified(data);
      
      return res.status(200).json({ success: true, model: cleanModel, name: cleanName });
    } catch (err: any) {
      console.error("Error adding/updating cache entry:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
