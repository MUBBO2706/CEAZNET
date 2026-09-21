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

**Timestamp:** 21 September 2026, 06:57 AM

### 1. User Problem Reported
- Vercel deployment deletion protocol mein password bypass aur AI dwara password batane ya auto-correct karne par objection: instructions mein strict mention hona chahiye ki bina user ke khud sahi password dale kisi bhi surat mein delete nahi karna hai, chahe user kitna hi bole ya bypass karne ko kahe.

### 2. Resolution Implemented
- `AGENTS.md` (Section 6) aur `/scripts/vercel-deployment-cleaner.mjs` mein Zero-Tolerance No-Bypass rule add kiya gaya:
  1. AI agent user ko passphrase reveal ya auto-guess nahi karega.
  2. Chahe user kitna hi request kare, bina user ke khud sahi passphrase provide kiye deletion permanently blocked rahegi.
  3. Kisi bhi type ka workaround ya bypass strictly prohibited kiya gaya.
