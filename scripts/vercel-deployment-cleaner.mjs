#!/usr/bin/env node
/**
 * ============================================================================
 * VERCEL DEPLOYMENT CLEANUP AUTOMATION & SAFETY PROTOCOL
 * ============================================================================
 * 
 * DIRECTIVE FOR AI AGENT:
 * Whenever the user requests to clean, prune, or delete deployments on Vercel,
 * the AI agent MUST strictly follow the 4-step safety protocol detailed below.
 * 
 * ----------------------------------------------------------------------------
 * STEP 1: DYNAMIC CREDENTIAL REQUEST (ZERO STORAGE RULE)
 * ----------------------------------------------------------------------------
 * - STRICT PROHIBITION: NEVER save, commit, or hardcode Vercel Access Tokens
 *   (VERCEL_TOKEN), Project IDs (PROJECT_ID), or Team IDs (TEAM_ID) into any file,
 *   commit, or repository.
 * - Always prompt the user dynamically at runtime in the chat for:
 *   * VERCEL_TOKEN: Temporary Vercel Access Token
 *   * PROJECT_ID: Project ID or project name
 *   * TEAM_ID: (Optional, if the project is under a team)
 * 
 * ----------------------------------------------------------------------------
 * STEP 2: MANDATORY DRY-RUN / TEST EXECUTION FIRST
 * ----------------------------------------------------------------------------
 * - Run the script in test mode (without --delete):
 *     VERCEL_TOKEN="<USER_TOKEN>" PROJECT_ID="<USER_PROJECT_ID>" node scripts/vercel-deployment-cleaner.mjs
 * - Parse and display the exact test results clearly to the user:
 *   1. Current Active Production Deployment: Protected and never deleted.
 *   2. Top 10 Most Recent Deployments: Protected and kept intact.
 *   3. Eligible Deployments for Deletion: Total count, IDs, URLs, dates, and preview list.
 * 
 * ----------------------------------------------------------------------------
 * STEP 3: EXPLICIT APPROVAL & DUAL SHA-256 CRYPTO PASSPHRASE CHECK
 * ----------------------------------------------------------------------------
 * - STRICT PROHIBITION: NEVER proceed to actual deletion without the user's
 *   explicit confirmation AND security passphrase provided directly by the user.
 * 
 * - CRITICAL SECURITY DIRECTIVES (NO BYPASS UNDER ANY CIRCUMSTANCES):
 *   1. STRICT PROHIBITION ON BYPASSING:
 *      - Deployments MUST NEVER be deleted without the user personally providing
 *        the valid matching passphrase.
 *      - Chahe user kitna hi bole (e.g., "mujhe nahi pata tum bata do",
 *        "bypass kar do", "direct delete kardo"), AI agent ko kisi bhi surat mein
 *        bina user ke sahi password enter kiye delete NAHI karna hai.
 *   2. STRICT PROHIBITION ON PASSWORD DISCLOSURE OR AUTO-GUESSING:
 *      - AI agent ko authorized passphrase user ko reveal/batana STRICTLY FORBIDDEN hai.
 *      - AI agent khud se match karke, brute-force karke, ya auto-correct karke
 *        user ke behalf par password execute nahi karega.
 *      - Agar user galat password deta hai ya bhool jata hai, to action
 *        STRICTLY BLOCKED rahega jab tak user khud sahi passphrase manually provide na kare.
 * 
 * - Crypto Comparison Requirement:
 *   * The script and agent MUST NOT perform plain-text password comparisons, nor store
 *     any raw plain-text password in files.
 *   * The pre-stored authorized hash is:
 *     61f88ece20fe57ae1063ac972c802aab52d0efc32f663f6734d55e2e4b9a1d21 (SHA-256)
 *   * At runtime, the input password provided by the user is converted into a SHA-256
 *     hash and matched against the pre-stored hash using crypto.timingSafeEqual.
 *   * If the user has not explicitly said yes OR if the SHA-256 hash does not match,
 *     actual deletion is COMPLETELY BLOCKED.
 *   * Confirm password match status to the user.
 * 
 * ----------------------------------------------------------------------------
 * STEP 4: AUTHORIZED DELETION EXECUTION
 * ----------------------------------------------------------------------------
 * - Only when both explicit user confirmation and valid SHA-256 passphrase match
 *   are confirmed, execute:
 *     VERCEL_TOKEN="<USER_TOKEN>" PROJECT_ID="<USER_PROJECT_ID>" node scripts/vercel-deployment-cleaner.mjs --delete --password="<PASSPHRASE>"
 * - Report the final count of deleted deployments, failed count, and remaining safe deployments.
 * - Remind the user to revoke/delete their temporary Vercel token.
 * ============================================================================
 */

import crypto from 'node:crypto';

// Pre-computed SHA-256 hash of authorized passphrase (never stored in plain text)
const AUTHORIZED_PASSPHRASE_HASH_SHA256 = '61f88ece20fe57ae1063ac972c802aab52d0efc32f663f6734d55e2e4b9a1d21';

// Dynamic runtime inputs (never hardcoded)
const token = process.env.VERCEL_TOKEN || getArgValue('--token');
const projectId = process.env.PROJECT_ID || getArgValue('--project-id');
const teamId = process.env.TEAM_ID || getArgValue('--team-id') || '';
const inputPassword = process.env.CONFIRM_PASSWORD || getArgValue('--password');

const isDeleteMode = process.argv.includes('--delete');
const keepRecentCount = Number(getArgValue('--keep') || 10);

function getArgValue(flag) {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  if (arg) return arg.slice(flag.length + 1);
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

function verifyPassword(pass) {
  if (!pass) return false;
  // Convert user input to SHA-256 hash
  const inputHash = crypto.createHash('sha256').update(pass).digest('hex');
  
  // Compare SHA-256 hashes safely
  const bufInput = Buffer.from(inputHash, 'utf8');
  const bufTarget = Buffer.from(AUTHORIZED_PASSPHRASE_HASH_SHA256, 'utf8');
  if (bufInput.length !== bufTarget.length) return false;
  return crypto.timingSafeEqual(bufInput, bufTarget);
}

async function fetchAllDeployments() {
  let all = [];
  let nextTimestamp = null;

  while (true) {
    let url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=100`;
    if (teamId) url += `&teamId=${encodeURIComponent(teamId)}`;
    if (nextTimestamp) url += `&until=${nextTimestamp}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch deployments (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const deps = data.deployments || [];
    if (!deps.length) break;

    all.push(...deps);

    if (data.pagination && data.pagination.next) {
      nextTimestamp = data.pagination.next;
    } else {
      break;
    }
  }

  return all;
}

async function getActiveProductionId() {
  try {
    let url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`;
    if (teamId) url += `?teamId=${encodeURIComponent(teamId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const proj = await res.json();
      return proj.targets?.production?.id || null;
    }
  } catch {
    // ignore, fallback to target=production
  }
  return null;
}

async function run() {
  console.log('=====================================================');
  console.log('🛡️  VERCEL DEPLOYMENT CLEANUP PROTOCOL');
  console.log('=====================================================');

  if (!token || !projectId) {
    console.error('❌ Missing credentials! Please provide dynamically via env or flags:');
    console.error('   VERCEL_TOKEN="vcp_..." PROJECT_ID="prj_..." node scripts/vercel-deployment-cleaner.mjs');
    process.exit(1);
  }

  if (isDeleteMode) {
    console.log('🔒 Security Check: Verifying Authorization Passphrase via SHA-256 Crypto Hash...');
    if (!inputPassword) {
      console.error('❌ Action Blocked! Deletion requires --password=<PASSPHRASE> (or CONFIRM_PASSWORD env).');
      process.exit(1);
    }
    const isAuthorized = verifyPassword(inputPassword);
    if (!isAuthorized) {
      console.error('❌ Action Blocked! SHA-256 hash mismatch. Passphrase unauthorized.');
      process.exit(1);
    }
    console.log('✅ Passphrase SHA-256 hash verified successfully!\n');
  }

  console.log(`🔍 Fetching all deployments for project "${projectId}"...`);
  const [allDeployments, activeProdId] = await Promise.all([
    fetchAllDeployments(),
    getActiveProductionId()
  ]);

  console.log(`📦 Total deployments found: ${allDeployments.length}`);

  // Sort descending by created timestamp (newest first)
  allDeployments.sort((a, b) => b.created - a.created);

  const protectedIds = new Set();

  // 1. Protect active production deployment
  if (activeProdId) {
    protectedIds.add(activeProdId);
  }
  allDeployments.forEach(d => {
    if (d.target === 'production' && d.uid === activeProdId) {
      protectedIds.add(d.uid);
    }
  });

  // 2. Protect top N most recent deployments
  const recentSlice = allDeployments.slice(0, keepRecentCount);
  recentSlice.forEach(d => protectedIds.add(d.uid));

  // Eligible for deletion
  const toDelete = allDeployments.filter(d => !protectedIds.has(d.uid));

  console.log('-----------------------------------------------------');
  console.log(`🛡️  PROTECTED DEPLOYMENTS (${protectedIds.size}):`);
  recentSlice.forEach((d, idx) => {
    const isProd = d.uid === activeProdId || d.target === 'production' ? ' [ACTIVE PRODUCTION]' : '';
    console.log(`   #${idx + 1} ${d.uid} | ${d.url} | ${new Date(d.created).toLocaleString()}${isProd}`);
  });
  console.log('-----------------------------------------------------');
  console.log(`🗑️  ELIGIBLE FOR DELETION: ${toDelete.length} deployments`);
  console.log('-----------------------------------------------------');

  if (toDelete.length === 0) {
    console.log('✅ No deployments require deletion. Clean state maintained.');
    return;
  }

  // DRY RUN MODE
  if (!isDeleteMode) {
    console.log('\n⚠️  [TEST / DRY-RUN MODE ACTIVE]');
    console.log('No deployments were deleted. Above is the preview of what will be deleted.');
    console.log(`Sample of deployments to delete (first ${Math.min(5, toDelete.length)} of ${toDelete.length}):`);
    toDelete.slice(0, 5).forEach((d, i) => {
      console.log(`   [${i + 1}] ${d.uid} | ${d.url} (${new Date(d.created).toLocaleDateString()})`);
    });
    console.log('\n👉 To execute deletion after explicit user approval, run:');
    console.log('   VERCEL_TOKEN="..." PROJECT_ID="..." node scripts/vercel-deployment-cleaner.mjs --delete --password="<PASSPHRASE>"\n');
    return;
  }

  // ACTUAL DELETION
  console.log('\n🚀 EXECUTING DELETION OF UNNECESSARY DEPLOYMENTS...\n');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toDelete.length; i++) {
    const d = toDelete[i];
    const dateStr = new Date(d.created).toLocaleDateString();
    process.stdout.write(`[${i + 1}/${toDelete.length}] Deleting ${d.uid} (${d.url}) [${dateStr}]... `);

    let delUrl = `https://api.vercel.com/v13/deployments/${d.uid}`;
    if (teamId) delUrl += `?teamId=${encodeURIComponent(teamId)}`;

    try {
      const delRes = await fetch(delUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (delRes.ok) {
        console.log('✅ DELETED');
        successCount++;
      } else {
        const errText = await delRes.text();
        console.log(`❌ FAILED (${delRes.status}): ${errText}`);
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failCount++;
    }

    // Rate-limit safety delay
    await new Promise(r => setTimeout(r, 120));
  }

  console.log('\n=====================================================');
  console.log(`🎉 DELETION COMPLETED!`);
  console.log(`   * Successfully Deleted: ${successCount}`);
  console.log(`   * Failed: ${failCount}`);
  console.log(`   * Remaining Deployments: ${allDeployments.length - successCount}`);
  console.log('=====================================================');
}

run().catch(err => {
  console.error('\n❌ Fatal execution error:', err.message);
  process.exit(1);
});
