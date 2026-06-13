# Self Instruction Manual for Future Modifications

This document contains strict rules for myself to follow when updating or adding new features to this application. The goal is to maintain code quality, consistency, and a great user experience.

---

## 1. CSS & Theming: **Always Use CSS Variables**

**Golden Rule:** **NEVER** use hardcoded colors (e.g., `bg-red-500`, `text-gray-900`). This is non-negotiable. Every color must be theme-aware.

### The Process:

1.  **Identify the Need:** When adding a new UI element (a button, a card, a new text color), determine the colors it needs.
2.  **Check for Existing Variables:** Before writing any new CSS, look in `index.html` inside the `<style>` tag. Check both the `:root` (light mode) and `html.dark` (dark mode) sections for a variable that semantically matches your need (e.g., `--danger` for errors, `--accent-color` for primary actions, `--text-secondary` for muted text).
3.  **Create New Variables if Necessary:** If a suitable variable does not exist:
    *   **DO NOT** take a shortcut and use a Tailwind class like `bg-blue-500`.
    *   You **MUST** add a new variable to `index.html`.
    *   Define it for light mode in `:root`.
    *   Define its corresponding dark mode equivalent in `html.dark`. Choose colors that match the existing theme's aesthetic (e.g., brighter, more saturated colors for dark mode text/borders).
    *   Use a clear, semantic name (e.g., `--diff-added-bg`, `--chat-link-text`).
4.  **Implement:** Use your chosen (or newly created) variable in your CSS.
    *   **Example:** `background-color: var(--diff-added-bg);`

**Why?** This ensures that every single component automatically adapts to both light and dark modes, preventing unreadable text, jarring color clashes, and maintaining a professional, polished look across the entire application.

---

## 2. Database Context & Staging Migration Workflow

**Reference API Base URL:** `https://sql-migration.vercel.app`
**Authentication Header:** `x-api-key: sk_sync_b4k92jdm10` (Keep this key strictly within these instructions, do NOT expose it in generated deployed codebase files)

**Primary Repositories:**
- **SQL Migration History:** `https://github.com/mubasshir12/SQL-Migration-` (Store schema/RPC/Edge Functions here to make migrations easy across apps)
- **Ceaznet Admin Panel:** `https://github.com/mubasshir12/Ceaznet-Admin` (Admin Panel application built specifically to manage this current client application)

### Dynamic Fetching & Orchestration Constraints (CRITICAL)
1. **Absolutely NO Workspace Pollution:** Whenever fetching external codebases via `degit` or Git (e.g., Ceaznet Admin or SQL Migration repo), **NEVER** clone them into the existing application's working directory (`.` or `./admin_repo` or any local folder). 
   - All clones **MUST** be placed in the temporary `/tmp` directory (e.g., `npx -y degit mubasshir12/Ceaznet-Admin /tmp/admin_repo`).
   - If a fetch or list operation fails in `/tmp`, **DO NOT fallback to cloning locally into the app codebase.** Diagnose the `/tmp` path issue instead using shell commands. Ensure that zero temporary artifacts or unwanted repo files bleed into the current application's codebase.
   - **Cleanup:** You MUST immediately remove the fetched repo using shell tools like `npx -y rimraf /tmp/<repo>` as soon as you have read the necessary context.

2. **Just-In-Time Context (Don't Over-Fetch):** 
   - DO NOT unnecessarily fetch the Task Manager or the Admin repo for front-end modifications.
   - **Only** fetch the Admin repo when an explicitly requested admin-panel update is needed.
   - **Only** fetch the SQL Task Manager database APIs or tasks when modifying database schemas, RLS policies, edge functions, or Supabase backend dependencies.

### Guidelines for AI Agent (Database Iteration)
Whenever the user requests changes related to the database, edge functions, or backend logic:

1. **Repository Synchronization:**
   - Fetch the latest state using the rules discussed above (`/tmp` fetching). Ensure you are comparing against live production code.

2. **Master Script Merging Priority:**
   - **Merge, Don't Append:** You are STRICTLY required to prioritize merging schema updates into existing, relevant Master Queries. Do not create fragmented or dummy SQL snippets. This keeps the task list concise and makes overall migration robust.
   - **Idempotent Logic:** All merged SQL must be scalable and strictly idempotent (e.g., `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY`).

3. **ROLE RESTRICTION: Read-Only Production & Write-Only Staging (CRITICAL):**
   - **Production (Read-Only):** You ONLY have read access to Production projects. You are STRICTLY FORBIDDEN from creating or updating tasks in a production project.
   - **Staging (Write Access):** You can ONLY write (POST/PUT) to projects whose names end with `[STAGING]`.

   *Step A: Fetch Projects*
   Run this snippet to get the list of all projects:
   ```javascript
   npx -y tsx -e "fetch('https://sql-migration.vercel.app/api/projects', { headers: { 'x-api-key': 'sk_sync_b4k92jdm10' } }).then(res=>res.json()).then(console.log).catch(console.error)"
   ```

   *Step B: Resolve Staging Replica*
   Identify your target Project (e.g., `Ceaznet Database Schema`). Check if a project named `<TargetProjectName> [STAGING]` exists.
   - **If Staging DOES NOT exist:** Create one by calling the endpoint with the *Production* `projectId`:
     ```javascript
     npx -y tsx -e "fetch('https://sql-migration.vercel.app/api/ai/create-staging', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk_sync_b4k92jdm10' }, body: JSON.stringify({ projectId: '<PRODUCTION_PROJECT_ID>' }) }).then(res=>res.json()).then(console.log).catch(console.error)"
     ```
   - Use the `[STAGING]` project's ID for all subsequent actions.

   *Step C: Push or Update ONLY in Staging*
   - To CREATE a new task: Use `POST /api/ai/write` with `projectId: '<STAGING_PROJECT_ID>'`.
   - To UPDATE an existing task: First fetch tasks for the **STAGING** project to find the target `taskId` that belongs to the Staging branch, then use `PUT /api/ai/write/:taskId`.
   - **ABSOLUTE BAN:** Attempting to update a `taskId` or push to a `projectId` that belongs to production is a severe role violation.

4. **Reporting Changes & Handling Confusion:**
   Once you have successfully pushed the update to the Staging Replica, the user will NOT see it in their default production view. 
   - You MUST explicitly tell them: *"I have updated the Staging replica. Please click the project dropdown in your dashboard and select the `[STAGING]` project to view these changes."*
   - **CRITICAL:** If the user replies "It didn't happen" or "I don't see it", DO NOT bypass the workflow and update production. Remind them to check the Staging project from their dropdown! Always output the **FULL** updated Master Query in a code block in the chat for reference.

---

## 3. General AI Assistant Directives (Self Notes)

- **Think Before Modifying:** Always use `view_file` to inspect the contents of files before applying targeted edits.
- **Verify Context Boundaries:** Avoid overwriting complex existing frontend behavior just to add small UI hooks. Refactor cleanly if needed, but respect the codebase's existing layout structures.
- **Self-Correction & Quality Confidence:** Avoid verbose apologies. If a step fails or a directory listing errors out, silently implement the fix (e.g., resolving paths, checking absolute vs relative context) before modifying the codebase. Keep the user workspace uninterrupted and pristine.
- **Strict Scope Boundaries:** Stick exactly to the user request. Apply the simplest, most performant solution possible, avoiding large architectural deviations unless strictly required.

---

## 4. Edge Functions & Preserved Source Code

The source code for all edge functions used in this application is strictly preserved in the SQL Task Manager repository/database.

**Currently Used Edge Functions (List):**
1. `send-password-alert`
2. `update-article-stats`
3. `update-news`

**Directives for Edge Functions:**
- These are listed here so you know exactly which edge functions are actively being used without needing to query for them.
- If you need to debug or modify the source code of any specific edge function in the future, fetch it from the Task Manager's API endpoint.
- The API endpoint returns the edge function data in an `export.json` format. You must fetch and parse this JSON response to read the source code.
