const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/app\.post\("\/api\/db\/query"/g, 'app.post("/api/db"');

content = content.replace(/app\.get\("\/api\/device-mapper\/cache"/g, 'app.get("/api/device-mapper-cache"');
content = content.replace(/app\.post\("\/api\/device-mapper\/cache"/g, 'app.post("/api/device-mapper-cache"');
content = content.replace(/app\.post\("\/api\/device-mapper\/cache\/delete"/g, 'app.post("/api/device-mapper-cache-delete"');

content = content.replace(/app\.post\("\/api\/device-mapper"/g, `app.all("/api/device-mapper", async (req, res, next) => {
    const { action } = req.query;
    if (action === "cache" && req.method === "GET") return app._router.handle({ ...req, method: "GET", url: "/api/device-mapper-cache" }, res, next);
    if (action === "cache" && req.method === "POST") return app._router.handle({ ...req, method: "POST", url: "/api/device-mapper-cache" }, res, next);
    if (action === "cache_delete" && req.method === "POST") return app._router.handle({ ...req, method: "POST", url: "/api/device-mapper-cache-delete" }, res, next);
    if (req.method !== "POST") return res.status(405).json({error: "Method not allowed"});
    // Below is the mapped logic
`);
// NOTE: Express doesn't easily let you reroute without next(route), so instead I can just use a middleware.

fs.writeFileSync('server.ts', content);
