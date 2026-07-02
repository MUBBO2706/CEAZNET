export default async function handler(req: any, res: any) {
  const { action, stream } = req.query;

  // 1. Handle clear logs action
  if (action === 'clear' || req.method === 'POST') {
    return res.status(200).json({ success: true, message: "Logs are native and managed by Vercel." });
  }

  // 2. Handle Stream SSE logs action
  const isStream = stream === 'true' || (req.url && req.url.includes('/stream'));
  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Keepalive / Ping to client
    res.write(': ping\n\n');

    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    let deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!vercelApiToken || (!deploymentId && !projectId)) {
      const initialLogs = [
        {
          id: 'setup-warning',
          type: 'log',
          timestamp: new Date().toISOString(),
          message: "[Vercel Config Required] To see serverless logs here, please add VERCEL_API_TOKEN and VERCEL_PROJECT_ID in your Vercel Environment Variables."
        }
      ];
      res.write(`event: initial\ndata: ${JSON.stringify(initialLogs)}\n\n`);
      res.end();
      return;
    }

    try {
      if (!deploymentId && projectId) {
        // Fetch the latest deployment for this project
        const depsRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
          headers: { 'Authorization': `Bearer ${vercelApiToken}` }
        });
        const depsData = await depsRes.json();
        if (depsData && depsData.deployments && depsData.deployments.length > 0) {
          deploymentId = depsData.deployments[0].uid;
        } else {
          throw new Error('No deployments found for this project.');
        }
      }

      // Send initial successful connection log
      const initialLogs = [
        {
          id: 'connected',
          type: 'log',
          timestamp: new Date().toISOString(),
          message: `Connected to Vercel live logs stream (Deployment: ${deploymentId})...`
        }
      ];
      res.write(`event: initial\ndata: ${JSON.stringify(initialLogs)}\n\n`);

      // Fetch the events stream
      const eventsRes = await fetch(`https://api.vercel.com/v2/deployments/${deploymentId}/events?direction=forward&follow=1`, {
        headers: { 'Authorization': `Bearer ${vercelApiToken}` }
      });

      if (!eventsRes.ok) {
        throw new Error(`Failed to fetch Vercel events: ${eventsRes.statusText}`);
      }

      if (!eventsRes.body) {
        throw new Error('No body in Vercel events response');
      }

      let active = true;
      req.on('close', () => {
        active = false;
        try {
          if ((eventsRes.body as any).cancel) {
            (eventsRes.body as any).cancel();
          }
        } catch(e) {}
      });

      // Stream parsing loop
      const decoder = new TextDecoder();
      
      // Node.js 18+ Web Streams or node-fetch Streams
      if (typeof (eventsRes.body as any).getReader === 'function') {
        const reader = (eventsRes.body as any).getReader();
        let buffer = '';
        
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (Object.keys(event).length === 0) continue;
              if (event.payload && event.payload.info && event.payload.info.type === 'build') continue;
              const messageText = (event.payload && event.payload.text) || event.text || JSON.stringify(event);
              let logType = (event.type === 'stderr' || event.type === 'error') ? 'error' : 'log';
              if (logType === 'error' && typeof messageText === 'string') {
                if (messageText.includes('[Image-Proxy] Batch complete') || messageText.includes('Successfully resolved image') || messageText.includes('[Image-Proxy] Successfully resolved')) {
                  logType = 'log';
                }
              }
              const logObj = {
                id: event.id || Math.random().toString(36).slice(2, 9),
                type: logType,
                timestamp: event.created ? new Date(event.created).toISOString() : new Date().toISOString(),
                message: messageText
              };
              res.write(`data: ${JSON.stringify(logObj)}\n\n`);
            } catch (err) {
              const logObj = {
                id: Math.random().toString(36).slice(2, 9),
                type: 'log',
                timestamp: new Date().toISOString(),
                message: line
              };
              res.write(`data: ${JSON.stringify(logObj)}\n\n`);
            }
          }
        }
      } else {
        // Fallback for Node.js readable streams
        const body: any = eventsRes.body;
        body.on('data', (chunk: any) => {
          if (!active) return;
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (Object.keys(event).length === 0) continue;
              if (event.payload && event.payload.info && event.payload.info.type === 'build') continue;
              const messageText = (event.payload && event.payload.text) || event.text || JSON.stringify(event);
              let logType = (event.type === 'stderr' || event.type === 'error') ? 'error' : 'log';
              if (logType === 'error' && typeof messageText === 'string') {
                if (messageText.includes('[Image-Proxy] Batch complete') || messageText.includes('Successfully resolved image') || messageText.includes('[Image-Proxy] Successfully resolved')) {
                  logType = 'log';
                }
              }
              const logObj = {
                id: event.id || Math.random().toString(36).slice(2, 9),
                type: logType,
                timestamp: event.created ? new Date(event.created).toISOString() : new Date().toISOString(),
                message: messageText
              };
              res.write(`data: ${JSON.stringify(logObj)}\n\n`);
            } catch (err) {
              const logObj = {
                id: Math.random().toString(36).slice(2, 9),
                type: 'log',
                timestamp: new Date().toISOString(),
                message: line
              };
              res.write(`data: ${JSON.stringify(logObj)}\n\n`);
            }
          }
        });
      }
      return;
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ id: 'error', type: 'error', timestamp: new Date().toISOString(), message: `Stream error: ${e.message}` })}\n\n`);
      res.end();
      return;
    }
  }

  // 3. Handle standard plain GET logs JSON
  try {
    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    let deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (vercelApiToken && (deploymentId || projectId)) {
        if (!deploymentId) {
            const depsRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
                headers: { 'Authorization': `Bearer ${vercelApiToken}` }
            });
            const depsData = await depsRes.json();
            if (depsData && depsData.deployments && depsData.deployments.length > 0) {
                deploymentId = depsData.deployments[0].uid;
            }
        }
        
        if (deploymentId) {
            const eventsRes = await fetch(`https://api.vercel.com/v2/deployments/${deploymentId}/events?direction=backward&limit=100`, {
                headers: { 'Authorization': `Bearer ${vercelApiToken}` }
            });
            const eventsData = await eventsRes.json();
            
            // Ensure eventsData is an array
            const eventsArray = Array.isArray(eventsData) ? eventsData : (eventsData && eventsData.events ? eventsData.events : []);
            
            const logs = eventsArray.filter((event: any) => Object.keys(event).length > 0 && !(event.payload && event.payload.info && event.payload.info.type === 'build')).map((event: any) => {
                const messageText = (event.payload && event.payload.text) ? event.payload.text : (event.text ? event.text : JSON.stringify(event));
                let logType = (event.type === 'stderr' || event.type === 'error') ? 'error' : 'log';
                if (logType === 'error' && typeof messageText === 'string') {
                    if (messageText.includes('[Image-Proxy] Batch complete') || messageText.includes('Successfully resolved image') || messageText.includes('[Image-Proxy] Successfully resolved')) {
                        logType = 'log';
                    }
                }
                return {
                    id: event.id || Math.random().toString(36).slice(2, 9),
                    type: logType,
                    timestamp: event.created ? new Date(event.created).toISOString() : new Date().toISOString(),
                    message: messageText
                };
            });
            return res.status(200).json({ logs: logs.reverse() });
        }
    }

    return res.status(200).json({
      logs: [
        {
          id: 'setup-warning',
          type: 'log',
          timestamp: new Date().toISOString(),
          message: "[Vercel Config Required] Please configure VERCEL_API_TOKEN and VERCEL_PROJECT_ID to view recent logs."
        }
      ]
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
