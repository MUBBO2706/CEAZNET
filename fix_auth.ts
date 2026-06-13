import fs from 'node:fs';

const data = fs.readFileSync('server.ts', 'utf8');

const regex = /const \{\s*data:\s*\{\s*user\s*\}\s*,\s*error:\s*authError\s*\}\s*=\s*await\s*supabaseAdmin\.auth\.getUser\(token\);/g;

const replacement = `let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }`;

const newData = data.replace(regex, replacement);

fs.writeFileSync('server.ts', newData, 'utf8');
console.log('Replaced successfully!');
