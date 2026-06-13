# 🚀 Feature Implementation Guide: Staging & Merging Workflow

**Target App:** SQL Migration Task Manager
**Audience:** SQL Task Manager Developer

## 📌 Concepts
We need to bypass the manual copy/paste step while maintaining safety. The AI shouldn't push directly into the "Production" project tasks, as that might break things. Instead, we want the AI to push code to a **Staging (Testing)** project or environment. You (Admin) can test it in Staging, and if it looks good, click "Merge" to apply the changes to the Production project.

## 🛠 What the Developer Needs to Do

### 1. Database Schema Updates
Add an `environment` flag or a `parent_project_id` to establish the relationship between Staging and Production.
Alternatively, keep it simple: just create two separate projects (e.g., "Ceaznet Prod" and "Ceaznet Staging") and handle merging via logic.
If modifying `projects` table:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production'; -- 'production' | 'staging'
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id TEXT REFERENCES projects(id); -- Links staging to prod
```

### 2. API Updates for AI Access (Write Access)
Currently, `export.json` fetches all tasks arbitrarily. We need endpoints that allow AI to Read and Write to the **Staging** project.

Update your `api/index.ts` to include:
*   **READ Endpoint:** `GET /export.json?projectId=<STAGING_PROJECT_ID>` 
    *   (Should return tasks ONLY for the specified project).
*   **WRITE/PUSH Endpoint:** `POST /api/push-task`
    *   Expected Body: `{ "apiKey": "sk_sync_...", "projectId": "<STAGING_PROJECT_ID>", "task": { "title": "...", "sql": "...", "type": "sql" } }`
    *   This API inserts or updates a single task directly in the Staging project.

### 3. UI/UX: Project Cloning (Replication)
In the UI, add an option on a Project called **"Create Staging Replica"**.
*   **Action:** When clicked, duplicate the Project, its Folders, and ALL its Tasks into a new Project called `[Project Name] - Staging`.
*   *Why?* The AI needs a full copy of the current system to correctly create dependencies (like edge functions referencing existing schemas).

### 4. UI/UX: Merge Staging to Production
In the Staging Project view, add a header button: **"Merge to Production"**.
*   **Action:** Compare tasks in Staging vs Production. Find what is different (new queries, modified functions).
*   Upsert those modified/new tasks into the Production Project's tasks.
*   Highlight differences (Diff View) so the Admin can see exactly what the AI changed before approving the merge.


## 🤖 What the AI (Me) Will Do
Once the developer adds these API endpoints:
1.  **Analyze Context:** I will fetch the Staging `export.json` to understand the current DB schema and edge functions.
2.  **Generate Solutions:** I will generate the required SQL/Edge Functions idempotently (e.g., `CREATE OR REPLACE...`).
3.  **Automatic Push:** Instead of just sending you a code block to copy-paste, I will make an HTTP API call to `POST /api/push-task` mapping my output directly into your **Staging** project.
4.  **Confirm to Admin:** I will tell you, "I have pushed the changes to the Staging project. Please test them and click 'Merge' if they work perfectly."

---

*Written by Google AI Studio Coders (Gemini) for Ceaznet Systems.*
