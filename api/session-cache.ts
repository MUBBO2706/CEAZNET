import { loadSessionCacheUnified, saveSessionCacheUnified, lastSessionCacheSource } from '../utils/deviceCacheShared.js';

export default async function handler(req: any, res: any) {
  let action = req.query?.action;
  if (!action && req.url) {
     try {
       const urlObj = new URL(req.url, 'http://localhost');
       action = urlObj.searchParams.get('action');
     } catch(e) {}
  }

  if (action === 'get' && req.method === 'GET') {
    try {
      const data = await loadSessionCacheUnified();
      const nowTime = new Date().getTime();
      let hasChanges = false;
      
      // Auto-abandon sessions without heartbeat for 2 minutes
      Object.keys(data).forEach(deviceHash => {
        const deviceData = data[deviceHash];
        Object.keys(deviceData.accounts || {}).forEach(username => {
          const sessions = deviceData.accounts[username].sessions || [];
          sessions.forEach((session: any) => {
            if (session.status === 'active' || session.status === 'background') {
              const lastHeartbeatStr = session.lastHeartbeat || session.startTime;
              const lastHeartbeatTime = new Date(lastHeartbeatStr).getTime();
              if (nowTime - lastHeartbeatTime > 120000) { // 2 minutes
                session.status = 'abandoned';
                session.endTime = new Date(lastHeartbeatTime).toISOString();
                session.duration = Math.floor((lastHeartbeatTime - new Date(session.startTime).getTime()) / 1000);
                hasChanges = true;
              }
            }
          });
        });
      });
      
      if (hasChanges) {
        await saveSessionCacheUnified(data, { deviceModel: "Unknown Device" }); // the meta argument is just for partial updates, unified cache handles it
      }
      
      return res.status(200).json(data);
    } catch (err: any) {
      console.error("Error reading session cache:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update' && req.method === 'POST') {
    try {
      const { deviceHash, deviceModel, username, sessionId, status, location, ip } = req.body;
      if (!deviceHash || !username || !sessionId || !status) {
        return res.status(400).json({ error: "deviceHash, username, sessionId, and status are required" });
      }

      const data = await loadSessionCacheUnified();
      
      if (!data[deviceHash]) {
        data[deviceHash] = { deviceModel: deviceModel || 'Unknown Device', accounts: {} };
      }
      
      // Update device model if provided and currently unknown
      if (deviceModel && data[deviceHash].deviceModel === 'Unknown Device') {
          data[deviceHash].deviceModel = deviceModel;
      }
      
      if (!data[deviceHash].accounts[username]) {
        data[deviceHash].accounts[username] = { sessions: [] };
      }

      const sessions = data[deviceHash].accounts[username].sessions;
      const existingSessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId);
      
      const now = new Date().toISOString();

      if (existingSessionIndex >= 0) {
        // Update existing session
        const session = sessions[existingSessionIndex];
        session.status = status;
        if (status !== 'active') {
            session.endTime = now;
            session.duration = Math.floor((new Date(now).getTime() - new Date(session.startTime).getTime()) / 1000);
        }
        if (location) session.location = location;
        if (ip) session.ip = ip;
      } else {
        // Create new session
        sessions.push({
          sessionId,
          username,
          startTime: now,
          endTime: null,
          location: location || null,
          ip: ip || null,
          duration: 0,
          status
        });
      }

      await saveSessionCacheUnified(data, { deviceModel: data[deviceHash].deviceModel });
      if (typeof (global as any).broadcastSessionUpdate === 'function') {
        (global as any).broadcastSessionUpdate(data);
      }
      return res.status(200).json({ success: true, sessionId, status });
    } catch (err: any) {
      console.error("Error updating session cache:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'delete' && req.method === 'POST') {
    try {
      const { deviceHash, username, sessionId } = req.body;
      if (!deviceHash || !username || !sessionId) {
        return res.status(400).json({ error: "deviceHash, username, and sessionId are required" });
      }

      const data = await loadSessionCacheUnified();
      if (data[deviceHash] && data[deviceHash].accounts[username]) {
        const sessions = data[deviceHash].accounts[username].sessions;
        const newSessions = sessions.filter((s: any) => s.sessionId !== sessionId);
        data[deviceHash].accounts[username].sessions = newSessions;
        
        // Clean up empty accounts or devices
        if (newSessions.length === 0) {
            delete data[deviceHash].accounts[username];
        }
        if (Object.keys(data[deviceHash].accounts).length === 0) {
            delete data[deviceHash];
        }

        await saveSessionCacheUnified(data, { deviceModel: data[deviceHash]?.deviceModel || 'Unknown Device' });
        
        if (typeof (global as any).broadcastSessionUpdate === 'function') {
          (global as any).broadcastSessionUpdate(data);
        }
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error deleting session from cache:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
