# Version Control Updates & Fixes Log

**Timestamp:** 21 September 2026, 06:05 PM

---

### 1. User Issue Reported (Aapne Kya Bataya)
- **Double Request:** Tab visibility change par version-control request ek saath do baar fire ho rahi thi.
- **Interval & Throttling:** Polling interval ko 60 seconds karna tha, aur visibility change par strict 30 seconds ka throttle lagana tha taaki baar-baar tab switch karne par 30 seconds se pehle nayi request na jaye.
- **Initial Load False Update:** Initial load par actual version change na hone par bhi API response mein `hasUpdate: true` aa raha tha (timestamp vs commit SHA mismatch).
- **Update Modal & Persistence:** Actual deployment/version change par hi modal trigger ho, aur reload ke baad naya version persist ho jaye taaki baar-baar modal na dikhe.

---

### 2. Resolution Implemented (Humne Kya Kiya)
- **Fixed Double Fire:** Duplicate `window.focus` listener remove kiya aur `isCheckingRef` concurrency lock lagaya taaki parallel requests completely block ho jayein.
- **60s Polling + 30s Visibility Throttle:** Polling interval ko 60s set kiya aur `visibilitychange` par check lagaya ki pichhli request ke 30s beetne par hi nayi request fire ho.
- **Version Identifier Alignment:** `vite.config.ts`, `api/version-control.ts`, aur `server.ts` mein Vercel ke Git Commit SHA (`VERCEL_GIT_COMMIT_SHA`) ko uniform priority di, jisse initial load par `hasUpdate: false` ("You are up to date") aayega.
- **Modal Trigger & Storage Persistence:** Modal sirf tab trigger hoga jab actual newer build deploy ho (`serverVersion !== clientVersion`). Reload karne par target version `localStorage` aur `sessionStorage` mein persist ho jata hai, jisse next load par modal suppress rehta hai.

---

**Timestamp:** 21 September 2026, 07:04 AM

### 1. User Problem Reported
- Security rules ko `AGENTS.md` se hata kar directly script file (`/scripts/vercel-deployment-cleaner.mjs`) ke andar consolidate karne ka request.

### 2. Resolution Implemented
- `AGENTS.md` se security directive bullets ko remove karke clean reference rakha gaya.
- Sabhi critical security directives (no-bypass, no password disclosure/auto-guessing) ko mukammal taur par `/scripts/vercel-deployment-cleaner.mjs` ke header protocol mein centralize kar diya gaya.
