import { loadSessionCacheUnified, saveSessionCacheUnified, lastSessionCacheSource } from '../utils/deviceCacheShared.js';

export default async function handler(req: any, res: any) {
  let action = req.query?.action;
  let force = req.query?.force === 'true' || req.query?.bypassCache === 'true';
  if (!action && req.url) {
     try {
       const urlObj = new URL(req.url, 'http://localhost');
       action = urlObj.searchParams.get('action');
       if (urlObj.searchParams.get('force') === 'true' || urlObj.searchParams.get('bypassCache') === 'true') {
         force = true;
       }
     } catch(e) {}
  }

  if (action === 'get' && req.method === 'GET') {
    try {
      const data = await loadSessionCacheUnified(force);
      const nowTime = new Date().getTime();
      let hasChanges = false;
      
      // Auto-abandon sessions without heartbeat for 60 seconds
      Object.keys(data).forEach(deviceHash => {
        if (deviceHash === '_summary' || deviceHash === '_resultSummary') return;
        const deviceData = data[deviceHash];
        Object.keys(deviceData.accounts || {}).forEach(username => {
          const sessions = deviceData.accounts[username].sessions || [];
          sessions.forEach((session: any) => {
            if (session.status === 'active' || session.status === 'background') {
              const lastHeartbeatStr = session.lastHeartbeat || session.startTime;
              const lastHeartbeatTime = new Date(lastHeartbeatStr).getTime();
              if (nowTime - lastHeartbeatTime > 60000) { // 60 seconds
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
        await saveSessionCacheUnified(data, { deviceModel: "Unknown Device" }); 
      }
      
      // Advanced Search & Pagination Logic
      let { search, limit, status, isIncognito, timeRange, browserName, startDate, endDate } = req.query;
      if (!limit && req.url) {
         try {
           const urlObj = new URL(req.url, 'http://localhost');
           search = urlObj.searchParams.get('search') || search;
           limit = urlObj.searchParams.get('limit') || limit;
           status = urlObj.searchParams.get('status') || status;
           isIncognito = urlObj.searchParams.get('isIncognito') || isIncognito;
           timeRange = urlObj.searchParams.get('timeRange') || timeRange;
           browserName = urlObj.searchParams.get('browserName') || browserName;
           startDate = urlObj.searchParams.get('startDate') || startDate;
           endDate = urlObj.searchParams.get('endDate') || endDate;
         } catch(e) {}
      }
      
      const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
      const filteredData: Record<string, any> = {};
      
      let allSessions: any[] = [];
      const deviceKeys = Object.keys(data).filter(k => k !== '_summary' && k !== '_resultSummary');
      for (const hash of deviceKeys) {
        const device = data[hash];
        if (!device?.accounts) continue;
        for (const username of Object.keys(device.accounts)) {
           const sessions = device.accounts[username].sessions || [];
           for (const s of sessions) {
              allSessions.push({
                 hash,
                 deviceModel: device.deviceModel || 'Unknown Device',
                 username,
                 fullName: device.accounts[username].fullName,
                 ...s
              });
           }
        }
      }
      
      // Sorting (Newest first)
      allSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      
      // Filtering
      allSessions = allSessions.filter(s => {
          if (search) {
             const term = (search as string).toLowerCase();
             const matches = (
                (s.hash && s.hash.toLowerCase().includes(term)) ||
                (s.deviceModel && s.deviceModel.toLowerCase().includes(term)) ||
                (s.username && s.username.toLowerCase().includes(term)) ||
                (s.fullName && s.fullName.toLowerCase().includes(term)) ||
                (s.ip && s.ip.toLowerCase().includes(term)) ||
                (s.location && s.location.toLowerCase().includes(term)) ||
                (s.sessionId && s.sessionId.toLowerCase().includes(term)) ||
                (s.browser_name && s.browser_name.toLowerCase().includes(term))
             );
             if (!matches) return false;
          }
          
          if (status && status !== 'all') {
             if (s.status !== status) return false;
          }
          
          if (isIncognito && isIncognito !== 'all') {
             const wantIncognito = isIncognito === 'true';
             if (Boolean(s.is_incognito) !== wantIncognito) return false;
          }
          
          if (browserName && browserName !== 'all') {
             if (!s.browser_name || s.browser_name.toLowerCase() !== (browserName as string).toLowerCase()) return false;
          }
          
          if (timeRange && timeRange !== 'all') {
             const sTime = new Date(s.startTime).getTime();
             if (timeRange === '24h' && (nowTime - sTime > 24 * 60 * 60 * 1000)) return false;
             if (timeRange === '7d' && (nowTime - sTime > 7 * 24 * 60 * 60 * 1000)) return false;
             if (timeRange === '30d' && (nowTime - sTime > 30 * 24 * 60 * 60 * 1000)) return false;
             if (timeRange === 'custom') {
                if (startDate) {
                   const startMs = new Date(startDate as string).getTime();
                   if (!isNaN(startMs) && sTime < startMs) return false;
                }
                if (endDate) {
                   const endMs = new Date(endDate as string).getTime();
                   if (!isNaN(endMs) && sTime > endMs) return false;
                }
             }
          }
          
          return true;
      });
      
      const resultSummary = {
          totalMatches: allSessions.length,
          returned: Math.min(allSessions.length, parsedLimit)
      };
      
      if (parsedLimit > 0) {
          allSessions = allSessions.slice(0, parsedLimit);
      }
      
      for (const s of allSessions) {
          if (!filteredData[s.hash]) {
              filteredData[s.hash] = { deviceModel: s.deviceModel, accounts: {} };
          }
          if (!filteredData[s.hash].accounts[s.username]) {
              filteredData[s.hash].accounts[s.username] = { fullName: s.fullName, sessions: [] };
          }
          const { hash, deviceModel, username, fullName, ...pureSession } = s;
          filteredData[s.hash].accounts[s.username].sessions.push(pureSession);
      }
      
      filteredData._summary = data._summary || {
         totalDevices: deviceKeys.length, activeSessions: 0, totalSessions: 0, activeUsers: 0, avgSessionTime: 0, avgSessionsPerDevice: 0, privateSessions: 0, locations: 0
      };
      filteredData._resultSummary = resultSummary;

      return res.status(200).json(filteredData);
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

      const data = await loadSessionCacheUnified(true);
      
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

      const data = await loadSessionCacheUnified(true);
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

  if (action === 'delete_device' && req.method === 'POST') {
    try {
      const { deviceHash } = req.body;
      if (!deviceHash) {
        return res.status(400).json({ error: "deviceHash is required" });
      }

      const data = await loadSessionCacheUnified(true);
      if (data[deviceHash]) {
        delete data[deviceHash];
        await saveSessionCacheUnified(data, { deviceModel: 'Unknown Device' });
        
        if (typeof (global as any).broadcastSessionUpdate === 'function') {
          (global as any).broadcastSessionUpdate(data);
        }
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error deleting device sessions from cache:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'delete_all' && req.method === 'POST') {
    try {
      const emptyData = {};
      await saveSessionCacheUnified(emptyData, { deviceModel: 'Unknown Device' });
      if (typeof (global as any).broadcastSessionUpdate === 'function') {
        (global as any).broadcastSessionUpdate(emptyData);
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error clearing all sessions from cache:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
