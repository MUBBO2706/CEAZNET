import deviceListLib from 'android-device-list';
import { GoogleGenAI } from '@google/genai';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';
import {
  loadDeviceCacheUnified,
  saveDeviceCacheUnified,
  lastDeviceCacheSource,
  loadApiKeyCacheUnified,
  saveApiKeyCacheUnified
} from '../utils/deviceCacheShared.js';

interface DeviceMapperApiKey {
  id: string;
  name: string;
  key: string;
  domain?: string;
  created_at: string;
}

const API_KEYS_FILE_PATH = path.join(process.cwd(), '.device_mapper_api_keys.json');

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function loadApiKeys(): Promise<DeviceMapperApiKey[]> {
  try {
    const cache = await loadApiKeyCacheUnified();
    return cache.keys || [];
  } catch (e) {
    return [];
  }
}

async function saveApiKeys(keys: DeviceMapperApiKey[]) {
  try {
    const preferredModel = await loadPreferredAiModel();
    await saveApiKeyCacheUnified({ keys, preferredAiModel: preferredModel });
  } catch (e) {}
}

async function resolveReverseDns(ip: string): Promise<string | null> {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  const cleanIp = ip.split(',')[0].trim();
  if (
    cleanIp.startsWith('192.168.') || 
    cleanIp.startsWith('10.') || 
    cleanIp.startsWith('172.16.') || 
    cleanIp.startsWith('172.17.') || 
    cleanIp.startsWith('172.18.') || 
    cleanIp.startsWith('172.19.') || 
    cleanIp.startsWith('127.')
  ) {
    return null;
  }
  try {
    const hostnames = await Promise.race([
      dns.promises.reverse(cleanIp),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ]);
    if (hostnames && hostnames.length > 0) {
      let host = hostnames[0].toLowerCase();
      if (host.endsWith('.')) host = host.slice(0, -1);
      return host;
    }
  } catch (e) {}
  return null;
}

function safeParseGeminiJson(text: string): { brand?: string; name?: string } | null {
  if (!text) return null;
  let cleanText = text.trim();
  
  // Remove markdown code blocks if present
  if (cleanText.includes('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }
  }
  
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to parse Gemini JSON normally, attempting regex extraction. Raw text:", text);
    // Attempt relaxed JSON extraction or manual regex
    const brandMatch = cleanText.match(/"brand"\s*:\s*"([^"]+)"/i);
    const nameMatch = cleanText.match(/"name"\s*:\s*"([^"]+)"/i);
    
    if (brandMatch || nameMatch) {
      return {
        brand: brandMatch ? brandMatch[1] : undefined,
        name: nameMatch ? nameMatch[1] : undefined
      };
    }
  }
  return null;
}

function getEnvValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');
      const match = content.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          return val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  } catch (err) {
    console.error(`Error reading ${key} from .env manually:`, err);
  }
  return undefined;
}

async function executeWithGeminiRotation<T>(
  category: string,
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');
  
  const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : new Proxy({}, {
        get: () => {
          throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables are required in production.");
        }
      }) as any;

  // 1. Fetch all active Gemini keys, ordered by last_used_at ASC nulls first to achieve round-robin
  const { data: keys, error: fetchError } = await supabase
    .from('news_api_keys')
    .select('id, api_key')
    .eq('provider', 'gemini')
    .eq('status', 'active')
    .order('last_used_at', { ascending: true, nullsFirst: true });

  let keysList = keys ? [...keys] : [];
  const envKey = getEnvValue('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (envKey) {
    keysList.push({ id: 'env-fallback', api_key: envKey });
  }

  if (keysList.length === 0) {
    const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found in news_api_keys table or local environment.";
    throw new Error(`[Gemini Rotation] Failed to retrieve keys: ${errorMsg}`);
  }

  console.log(`[Gemini Rotation] Loaded ${keysList.length} active keys for category "${category}".`);

  let lastError: any = null;

  for (let i = 0; i < keysList.length; i++) {
    const keyConfig = keysList[i];
    console.log(`[Gemini Rotation] Attempting operation with key index ${i} (ID: ${keyConfig.id})`);
    
    try {
      const ai = new GoogleGenAI({ apiKey: keyConfig.api_key });
      const result = await operation(ai);
      
      // Success! Mark key used
      if (keyConfig.id !== 'env-fallback') {
        await supabase.rpc('mark_news_key_used', { key_id: keyConfig.id, cat: category });
      }
      console.log(`[Gemini Rotation] Key ${keyConfig.id} succeeded and tracked as used.`);
      return result;
    } catch (err: any) {
      console.error(`[Gemini Rotation] Key ${keyConfig.id} failed: ${err.message}`);
      lastError = err;
      
      // Track key failure in Supabase (automatic exhaustion handling with max_failures = 10)
      if (keyConfig.id !== 'env-fallback') {
        try {
          await supabase.rpc('mark_news_key_failed', { key_id: keyConfig.id, err_msg: err.message, max_failures: 10 });
        } catch (trackErr: any) {
          console.error(`[Gemini Rotation] Failed to track failure for key ${keyConfig.id}:`, trackErr.message);
        }
      }

      // Log API key audit fallback if there is a next key
      if (i + 1 < keysList.length) {
        const nextKeyConfig = keysList[i + 1];
        console.log(`[Gemini Rotation] Rolling over to next key (ID: ${nextKeyConfig.id}) after failure.`);
        if (keyConfig.id !== 'env-fallback' && nextKeyConfig.id !== 'env-fallback') {
          try {
            await supabase.rpc('log_api_key_audit', {
              failed_id: keyConfig.id,
              fallback_id: nextKeyConfig.id,
              cat: category,
              err: err.message
            });
          } catch (auditErr: any) {
            console.error(`[Gemini Rotation] Failed to log fallback audit:`, auditErr.message);
          }
        }
      }
    }
  }

  // If we reach here, all keys failed
  throw lastError || new Error("All active Gemini keys failed to execute the request.");
}

// Memory audit log fallback buffer (holds up to 200 recent requests)
const memoryAuditLogs: any[] = [];
const MAX_MEMORY_AUDIT_LOGS = 200;

let preferredAiModel = 'gemini-2.5-flash';

async function loadPreferredAiModel(): Promise<string> {
  try {
    const cache = await loadApiKeyCacheUnified();
    if (cache.preferredAiModel) {
      preferredAiModel = cache.preferredAiModel;
    }
  } catch (e) {}
  return preferredAiModel;
}

async function savePreferredAiModel(model: string) {
  const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
  if (validModels.includes(model)) {
    preferredAiModel = model;
    try {
      const keys = await loadApiKeys();
      await saveApiKeyCacheUnified({ keys, preferredAiModel: model });
    } catch (e) {}
  }
}

// Initialize preferred AI model on module load
loadPreferredAiModel().catch(() => {});

async function recordDeviceMapperAudit(req: any, meta: {
  statusCode: number;
  responseBody: any;
  startTime: number;
  model?: string;
  action?: string;
  errorMessage?: string;
}) {
  const executionTimeMs = Math.round(Date.now() - meta.startTime);

  function cleanDomainName(raw: string): string {
    if (!raw) return '';
    let cleaned = raw.trim();
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      try {
        const u = new URL(cleaned);
        cleaned = u.hostname;
      } catch {}
    } else {
      cleaned = cleaned.split('/')[0].split(':')[0];
    }
    return cleaned.toLowerCase();
  }

  const hostHeader = (req.headers?.['host'] || '').toString().trim();
  const currentHost = cleanDomainName(hostHeader);
  const selfDomains = [currentHost, 'ceaznet.vercel.app', 'task-manager-ceaznet.vercel.app', 'localhost', '127.0.0.1'];

  function isSelfDomain(domainStr: string): boolean {
    if (!domainStr) return false;
    const clean = cleanDomainName(domainStr);
    if (!clean) return false;
    return selfDomains.some(sd => sd && (clean === sd || clean.endsWith('.' + sd) || sd.endsWith('.' + clean)));
  }

  const originHeader = (req.headers?.['origin'] || '').toString().trim();
  const rawReferer = (
    req.headers?.['referer'] || 
    req.headers?.['x-referer'] || 
    req.body?.referer || 
    req.query?.referer || 
    ''
  ).toString().trim();

  // Filter out self-application domain from referer header
  let refererHeader = '';
  if (rawReferer) {
    const cleanedRefDomain = cleanDomainName(rawReferer);
    if (!isSelfDomain(cleanedRefDomain) && !isSelfDomain(rawReferer)) {
      refererHeader = rawReferer;
    }
  }

  const customOriginHeader = (
    req.headers?.['x-origin'] || 
    req.headers?.['x-origin-domain'] || 
    req.headers?.['x-client-domain'] || 
    req.headers?.['x-app-domain'] ||
    req.headers?.['x-forwarded-host'] ||
    ''
  ).toString().trim();

  const appNameHeader = (
    req.headers?.['x-app-name'] ||
    req.headers?.['x-client-app'] ||
    req.headers?.['x-app'] ||
    req.headers?.['x-application-name'] ||
    ''
  ).toString().trim();

  const bodyAppName = (
    req.body?.app_name || req.query?.app_name ||
    req.body?.app || req.query?.app ||
    req.body?.client_app || req.query?.client_app ||
    ''
  ).toString().trim();

  const bodyDomain = (
    req.body?.domain || req.query?.domain || 
    req.body?.origin || req.query?.origin || 
    req.body?.client_domain || req.query?.client_domain ||
    req.body?.app_domain || req.query?.app_domain ||
    req.body?.source_domain || req.query?.source_domain ||
    ''
  ).toString().trim();

  const userAgent = (req.headers?.['user-agent'] || req.headers?.['x-user-agent'] || '').toString().trim();
  
  // Extract or synthesize Node Agent for backend/external API clients
  const rawNodeAgent = (
    req.headers?.['node-agent'] ||
    req.headers?.['x-node-agent'] ||
    req.headers?.['x-node-version'] ||
    req.body?.node_agent ||
    req.query?.node_agent ||
    ''
  ).toString().trim();

  let nodeAgent = rawNodeAgent;
  if (!nodeAgent) {
    if (userAgent && (userAgent.toLowerCase().includes('node') || userAgent.toLowerCase().includes('undici') || userAgent.toLowerCase().includes('axios') || userAgent.toLowerCase().includes('fetch') || userAgent.toLowerCase().includes('curl') || userAgent.toLowerCase().includes('python'))) {
      nodeAgent = userAgent;
    } else if (!userAgent) {
      nodeAgent = 'Node.js / Server API Client';
    } else {
      nodeAgent = userAgent;
    }
  }

  const apiKey = (req.headers?.['x-api-key'] || req.headers?.['authorization'] || '').toString().trim();
  const clientIp = (req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || req.connection?.remoteAddress || '').toString().trim();

  let extractedDomain = '';
  if (customOriginHeader) extractedDomain = cleanDomainName(customOriginHeader);
  else if (bodyDomain) extractedDomain = cleanDomainName(bodyDomain);
  else if (originHeader && !isSelfDomain(originHeader)) extractedDomain = cleanDomainName(originHeader);
  else if (refererHeader && !isSelfDomain(refererHeader)) extractedDomain = cleanDomainName(refererHeader);

  // Internal DevTools management actions to exclude from audit logs
  const INTERNAL_ACTIONS = ['cache_list', 'audit_logs', 'clear_audit_logs', 'get_ai_model', 'set_ai_model', 'api_keys_list', 'api_key_create', 'api_key_delete'];
  const isInternalAction = INTERNAL_ACTIONS.includes(meta.action || '');

  if (isInternalAction) {
    return;
  }

  // Check registered API key matching
  let apiKeyMatch: DeviceMapperApiKey | undefined;
  if (apiKey) {
    const keys = await loadApiKeys();
    const cleanKey = apiKey.replace(/^Bearer\s+/i, '').trim();
    apiKeyMatch = keys.find(k => k.key === cleanKey);
  }

  // Non-browser API client or external detection
  const lowerUA = userAgent.toLowerCase();
  const isNonBrowserClient = !userAgent || (!userAgent.includes('Mozilla') || lowerUA.includes('node') || lowerUA.includes('undici') || lowerUA.includes('axios') || lowerUA.includes('fetch') || lowerUA.includes('curl'));
  const isCrossSite = req.headers?.['sec-fetch-site'] === 'cross-site';
  const hasApiKey = !!apiKey;
  const hasExplicitExternalDomain = !!extractedDomain && !isSelfDomain(extractedDomain);

  const isExternal = hasExplicitExternalDomain || 
    hasApiKey || 
    isCrossSite || 
    isNonBrowserClient || 
    !!customOriginHeader ||
    !!bodyDomain ||
    !!appNameHeader ||
    !!bodyAppName ||
    (!!extractedDomain && !isSelfDomain(extractedDomain));

  // Determine Origin App Name
  let appName = '';
  if (apiKeyMatch && apiKeyMatch.name) {
    appName = apiKeyMatch.name.trim();
  } else if (appNameHeader) {
    appName = appNameHeader;
  } else if (bodyAppName) {
    appName = bodyAppName;
  } else if (extractedDomain && !isSelfDomain(extractedDomain)) {
    appName = extractedDomain;
  } else if (isExternal) {
    appName = 'External App';
  } else {
    appName = 'Ceaznet Client';
  }

  // Determine Origin Domain
  let domain = '';
  if (apiKeyMatch && apiKeyMatch.domain) {
    domain = apiKeyMatch.domain.trim();
  } else if (extractedDomain && !isSelfDomain(extractedDomain)) {
    domain = extractedDomain;
  } else if (originHeader && !isSelfDomain(originHeader)) {
    domain = cleanDomainName(originHeader);
  } else if (refererHeader && !isSelfDomain(refererHeader)) {
    domain = cleanDomainName(refererHeader);
  }

  // Reverse DNS lookup on Client IP if domain is still missing
  if (!domain && clientIp && clientIp !== 'Unknown' && clientIp !== '127.0.0.1' && clientIp !== '::1') {
    try {
      const ptrDomain = await resolveReverseDns(clientIp);
      if (ptrDomain) {
        domain = ptrDomain;
      }
    } catch (e) {}
  }

  if (!domain) {
    if (isExternal) {
      domain = appName !== 'External App' ? appName : (clientIp ? `External (${clientIp})` : 'External Domain');
    } else {
      domain = currentHost || 'localhost';
    }
  }

  const logRecord = {
    id: generateUUID(),
    created_at: new Date().toISOString(),
    app_name: appName || 'Unknown App',
    domain: domain || 'Unknown Domain',
    origin: originHeader || customOriginHeader || bodyDomain || 'None',
    referer: refererHeader || 'None',
    client_ip: clientIp || 'Unknown',
    user_agent: userAgent || 'N/A',
    node_agent: nodeAgent || 'N/A',
    method: req.method || 'GET',
    action: meta.action || 'resolve_device',
    model: meta.model || null,
    is_external: isExternal,
    status_code: meta.statusCode,
    request_query: req.query || {},
    request_body: req.body || {},
    response_body: meta.responseBody || {},
    execution_time_ms: executionTimeMs,
    error_message: meta.errorMessage || null
  };

  // Prepend to memory buffer for immediate fast inspection
  memoryAuditLogs.unshift(logRecord);
  if (memoryAuditLogs.length > MAX_MEMORY_AUDIT_LOGS) {
    memoryAuditLogs.pop();
  }

  console.log(`[Device Mapper Audit] App: "${logRecord.app_name}" | Domain: "${logRecord.domain}" | Action: ${logRecord.action} | Model: ${logRecord.model || 'N/A'} | External: ${isExternal} | Status: ${logRecord.status_code} (${executionTimeMs}ms)`);

  // Asynchronously persist to Supabase audit log table
  try {
    const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');

    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey);
      const payload: any = {
        id: logRecord.id,
        domain: logRecord.domain,
        origin: logRecord.origin,
        referer: logRecord.referer,
        client_ip: logRecord.client_ip,
        user_agent: logRecord.user_agent,
        method: logRecord.method,
        action: logRecord.action,
        model: logRecord.model,
        is_external: logRecord.is_external,
        status_code: logRecord.status_code,
        request_query: logRecord.request_query,
        request_body: logRecord.request_body,
        response_body: logRecord.response_body,
        execution_time_ms: logRecord.execution_time_ms,
        error_message: logRecord.error_message
      };

      try {
        const { error } = await client.from('device_mapper_audit_logs').insert([{
          ...payload,
          app_name: logRecord.app_name,
          node_agent: logRecord.node_agent
        }]);
        if (error) {
          // Fallback if app_name or node_agent column doesn't exist in Supabase table
          await client.from('device_mapper_audit_logs').insert([payload]);
        }
      } catch (e) {
        await client.from('device_mapper_audit_logs').insert([payload]);
      }
    }
  } catch (err: any) {
    console.warn("[Device Mapper Audit] Supabase insertion notice:", err?.message || err);
  }
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();

  // Helper function to send response and trigger asynchronous audit logging
  const sendJson = (statusCode: number, body: any, metaExtra?: { model?: string; action?: string; errorMessage?: string }) => {
    recordDeviceMapperAudit(req, {
      statusCode,
      responseBody: body,
      startTime,
      model: metaExtra?.model,
      action: metaExtra?.action || currentAction,
      errorMessage: metaExtra?.errorMessage || (body?.error ? String(body.error) : undefined)
    }).catch((e) => console.error("Audit log record error:", e));

    return res.status(statusCode).json(body);
  };

  // 1. Enable Cross-Origin Resource Sharing (CORS) for external domains
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-origin, x-origin-domain, x-client-domain, x-app-domain, x-requested-with');

  // Handle browser preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let action = req.query?.action;
  if (!action && req.url) {
     try {
       const urlObj = new URL(req.url, 'http://localhost');
       action = urlObj.searchParams.get('action');
     } catch(e) {}
  }

  let currentAction = action || 'resolve_device';

  // Get current preferred AI model
  if (action === 'get_ai_model' && req.method === 'GET') {
    const model = await loadPreferredAiModel();
    return sendJson(200, { success: true, aiModel: model }, { action: 'get_ai_model' });
  }

  // Set preferred AI model
  if (action === 'set_ai_model' && (req.method === 'POST' || req.method === 'GET')) {
    const newModel = req.body?.aiModel || req.query?.aiModel;
    if (newModel) {
      await savePreferredAiModel(newModel);
    }
    return sendJson(200, { success: true, aiModel: preferredAiModel }, { action: 'set_ai_model' });
  }

  // List API Keys
  if (action === 'api_keys_list' && req.method === 'GET') {
    const keysRaw = await loadApiKeys();
    const keys = keysRaw.map(k => ({
      id: k.id,
      name: k.name,
      domain: k.domain || '',
      key: k.key,
      maskedKey: k.key.substring(0, 9) + '...' + k.key.substring(k.key.length - 4),
      created_at: k.created_at
    }));
    return sendJson(200, { success: true, keys }, { action: 'api_keys_list' });
  }

  // Create API Key
  if (action === 'api_key_create' && req.method === 'POST') {
    const { name, domain: targetDomain } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return sendJson(400, { error: 'API Key Name is required' }, { action: 'api_key_create' });
    }
    const cleanName = name.trim();
    const cleanTargetDomain = (targetDomain || '').toString().trim();
    
    const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const newKeyStr = `sk_dm_${randomHex}`;
    
    const keys = await loadApiKeys();
    const newEntry: DeviceMapperApiKey = {
      id: generateUUID(),
      name: cleanName,
      key: newKeyStr,
      domain: cleanTargetDomain || undefined,
      created_at: new Date().toISOString()
    };
    keys.push(newEntry);
    await saveApiKeys(keys);

    return sendJson(200, { success: true, key: newEntry }, { action: 'api_key_create' });
  }

  // Delete API Key
  if (action === 'api_key_delete' && req.method === 'POST') {
    const { id } = req.body || {};
    if (!id) {
      return sendJson(400, { error: 'Key ID is required' }, { action: 'api_key_delete' });
    }
    let keys = await loadApiKeys();
    keys = keys.filter(k => k.id !== id);
    await saveApiKeys(keys);
    return sendJson(200, { success: true, id }, { action: 'api_key_delete' });
  }

  // Audit Logs Retrieval Endpoint for Debugging External Requests
  if (action === 'audit_logs' && req.method === 'GET') {
    try {
      const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');

      const limit = parseInt(req.query?.limit || '200', 10);
      const externalOnly = req.query?.externalOnly === 'true';

      let dbLogs: any[] = [];
      let dbError: string | null = null;

      if (supabaseUrl && supabaseKey) {
        try {
          const client = createClient(supabaseUrl, supabaseKey);
          let query = client
            .from('device_mapper_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (externalOnly) {
            query = query.eq('is_external', true);
          }

          const { data, error } = await query;
          if (!error && data) {
            dbLogs = data;
          } else if (error) {
            dbError = error.message;
          }
        } catch (e: any) {
          dbError = e.message;
        }
      }

      // Combine DB logs and memory logs into a single deduplicated array
      const logMap = new Map<string, any>();
      if (dbLogs && dbLogs.length > 0) {
        for (const log of dbLogs) {
          if (log && log.id) logMap.set(String(log.id), log);
        }
      }
      if (memoryAuditLogs && memoryAuditLogs.length > 0) {
        for (const log of memoryAuditLogs) {
          if (log && log.id && !logMap.has(String(log.id))) {
            logMap.set(String(log.id), log);
          }
        }
      }

      let combinedLogs = Array.from(logMap.values());
      combinedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Normalize logs so legacy DB entries or memory entries have consistent app_name, domain, node_agent, and sanitized referer
      const hostHeader = (req.headers?.['host'] || '').toString().trim();
      const currentHost = hostHeader.split('/')[0].split(':')[0].toLowerCase();
      const selfDomains = [currentHost, 'ceaznet.vercel.app', 'task-manager-ceaznet.vercel.app', 'localhost', '127.0.0.1'];

      combinedLogs = combinedLogs.map((log: any) => {
        const cleanedReferer = (log.referer || '').toString().trim();
        let safeReferer = cleanedReferer;
        if (cleanedReferer) {
          const lowerRef = cleanedReferer.toLowerCase();
          if (selfDomains.some(sd => sd && lowerRef.includes(sd))) {
            safeReferer = 'None';
          }
        } else {
          safeReferer = 'None';
        }

        const appName = log.app_name || log.request_body?.app_name || log.request_body?.app || (log.domain && !log.domain.includes('.') ? log.domain : null) || 'External App';
        const domainName = log.domain || log.origin || 'External Domain';
        const nodeAgentStr = log.node_agent || (log.user_agent && log.user_agent !== 'N/A' ? log.user_agent : 'Node.js / Server API Client');

        return {
          ...log,
          app_name: appName,
          domain: domainName,
          referer: safeReferer,
          node_agent: nodeAgentStr
        };
      });

      if (externalOnly) {
        combinedLogs = combinedLogs.filter((l: any) => l.is_external === true);
      }

      if (limit > 0 && combinedLogs.length > limit) {
        combinedLogs = combinedLogs.slice(0, limit);
      }

      return res.status(200).json({
        success: true,
        count: combinedLogs.length,
        source: dbLogs.length > 0 ? 'supabase' : 'memory_fallback',
        dbError,
        logs: combinedLogs
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Clear Audit Logs Endpoint
  if (action === 'clear_audit_logs' && req.method === 'POST') {
    try {
      memoryAuditLogs.length = 0;
      const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');

      if (supabaseUrl && supabaseKey) {
        const client = createClient(supabaseUrl, supabaseKey);
        await client.from('device_mapper_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      return res.status(200).json({ success: true, message: "Audit logs cleared successfully" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'cache_list' && req.method === 'GET') {
    try {
      const data = await loadDeviceCacheUnified();
      return sendJson(200, data, { action: 'cache_list' });
    } catch (err: any) {
      console.error("Error reading cache list:", err.message);
      return sendJson(500, { error: err.message }, { action: 'cache_list' });
    }
  }

  if (action === 'cache_update' && req.method === 'POST') {
    try {
      const { model, name } = req.body || {};
      if (!model) return sendJson(400, { error: "Model parameter is required" }, { action: 'cache_update' });
      const cleanModel = model.toString().trim().toUpperCase();
      const cleanName = name === "" || name === null ? null : name.toString().trim();
      
      const data = await loadDeviceCacheUnified();
      data[cleanModel] = cleanName;
      await saveDeviceCacheUnified(data, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
      
      return sendJson(200, { success: true, model: cleanModel, name: cleanName }, { model: cleanModel, action: 'cache_update' });
    } catch (err: any) {
      console.error("Error adding/updating cache entry:", err.message);
      return sendJson(500, { error: err.message }, { action: 'cache_update' });
    }
  }

  if (action === 'cache_delete' && req.method === 'POST') {
    try {
      const { model } = req.body || {};
      if (!model) return sendJson(400, { error: "Model parameter is required" }, { action: 'cache_delete' });
      const cleanModel = model.toString().trim().toUpperCase();
      
      const data = await loadDeviceCacheUnified();
      let found = false;
      for (const key of Object.keys(data)) {
        if (key.trim().toUpperCase() === cleanModel) {
          delete data[key];
          found = true;
        }
      }
      
      if (found) await saveDeviceCacheUnified(data, { newlyUpdatedCount: 1, newlyUpdatedDevices: [`${cleanModel} (Deleted)`] });
      return sendJson(200, { success: true, model: cleanModel }, { model: cleanModel, action: 'cache_delete' });
    } catch (err: any) {
      console.error("Error deleting cache entry:", err.message);
      return sendJson(500, { error: err.message }, { action: 'cache_delete' });
    }
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(405, { error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    let model = req.body?.model || req.query?.model;
    let skipCache = req.body?.skipCache ?? (req.query?.skipCache === 'true');
    let aiModel = req.body?.aiModel || req.query?.aiModel;

    if (!model && req.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        model = model || urlObj.searchParams.get('model');
        if (urlObj.searchParams.has('skipCache')) {
          skipCache = urlObj.searchParams.get('skipCache') === 'true';
        }
        aiModel = aiModel || urlObj.searchParams.get('aiModel');
      } catch (e) {}
    }

    if (!model) return sendJson(400, { error: "Model parameter is required" });
    
    const cleanModel = String(model).trim().toUpperCase();
    if (!cleanModel) return sendJson(200, { name: null, source: "static" }, { model: '' });

    if (!skipCache) {
      // Always Try Unified cache (Telegram with local server fallback)
      const cacheData = await loadDeviceCacheUnified();
      if (cleanModel in cacheData) {
        const cachedVal = cacheData[cleanModel];
        return sendJson(200, { name: cachedVal, source: lastDeviceCacheSource }, { model: cleanModel, action: 'resolve_cache' });
      }

      // In some environments, it imports as an object with default, in others it's the module itself.
      const list = ('deviceList' in deviceListLib) 
        ? (deviceListLib as any).deviceList() 
        : (deviceListLib as any).default.deviceList();

      // 3. Try Static Database lookup
      let match = list.find((d: any) => 
        d.model?.toUpperCase() === cleanModel && 
        (d.brand?.trim() || d.name?.trim())
      );
      
      if (!match) {
        match = list.find((d: any) => {
          const dModel = d.model?.toUpperCase();
          const dName = d.name?.toUpperCase();
          
          if (!dModel || dModel.length < 4) return false;
          if (!dName || dName.length < 4) return false;
          if (!d.brand?.trim() && !d.name?.trim()) return false;

          return cleanModel === dModel || cleanModel === dName;
        });
      }

      if (match) {
        const rawName = `${match.brand || ''} ${match.name || ''}`.trim();
        const words = rawName.split(/\s+/);
        const seen = new Set<string>();
        const uniqueWords = words.filter((word: string) => {
          const lower = word.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        const finalName = uniqueWords.join(' ');
        
        const updatedCache = await loadDeviceCacheUnified();
        updatedCache[cleanModel] = finalName;
        await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
        
        return sendJson(200, { name: finalName, source: "static" }, { model: cleanModel, action: 'resolve_static' });
      }
    }

    // 4. Try Gemini API Resolver with Google Search Grounding capabilities!
    try {
      if (aiModel) {
        await savePreferredAiModel(aiModel);
      }
      const currentPreferredModel = await loadPreferredAiModel();
      const response = await executeWithGeminiRotation('device_mapper', async (ai) => {
        const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
        const chosenModel = (aiModel && validModels.includes(aiModel))
          ? aiModel
          : (currentPreferredModel && validModels.includes(currentPreferredModel))
            ? currentPreferredModel
            : 'gemini-2.5-flash';
        return await ai.models.generateContent({
          model: chosenModel,
          contents: `Identify this mobile device model code: "${cleanModel}".`,
          config: {
            systemInstruction: `You are a professional device model to marketing name resolver.
Identify the official device brand and marketing model name for the given model code (e.g. "SM-S928U" -> Brand: "Samsung", Name: "Galaxy S24 Ultra"; "CPH2581" -> Brand: "OnePlus", Name: "12"; "GC3VE" -> Brand: "Google", Name: "Pixel 8a"; "M1912G7BI" -> Brand: "Xiaomi", Name: "Redmi Note 8 Pro").
Ensure you distinguish between sub-brands like "Poco", "Redmi", "OnePlus", "Samsung", "Google", "Apple", "iPad", etc.
Ensure the returned brand and name are accurate, realistic marketing names.
You CAN and SHOULD perform a Google Search to lookup specifications or find exact brand/name mappings for newer/unfamiliar model codes.
Provide your response strictly in raw JSON format with fields "brand" and "name" inside a markdown code block. If the device model code is invalid or completely unidentifiable, return null for both fields. Do not add any conversational text. Example:
\`\`\`json
{
  "brand": "Samsung",
  "name": "Galaxy S24 Ultra"
}
\`\`\``,
            tools: [{ googleSearch: {} }]
          }
        });
      });

      const text = response.text?.trim() || "";
      const parsed = safeParseGeminiJson(text);

      const metadata = response?.candidates?.[0]?.groundingMetadata;
      const webQueries = metadata?.webSearchQueries || [];
      const groundingChunks = metadata?.groundingChunks || [];
      const usedSearchTool = !!(webQueries && webQueries.length > 0) || !!(groundingChunks && groundingChunks.length > 0);
      const searchMethod = usedSearchTool ? "google_search" : "internal_knowledge";
      
      const sources = usedSearchTool ? (groundingChunks.map((c: any) => {
        const title = c.web?.title || c.webSource?.title || c.title || '';
        const uri = c.web?.uri || c.webSource?.uri || c.uri || '';
        return { title, uri };
      }).filter((s: any) => s.uri)) : [];

      console.log(`[Device Mapper] Model: ${cleanModel}, usedSearchTool: ${usedSearchTool}, groundingMetadata:`, JSON.stringify(metadata, null, 2));

      if (parsed && (parsed.brand || parsed.name)) {
        const brand = (parsed.brand || "").trim();
        const name = (parsed.name || "").trim();
        let fullName = "";
        if (brand && name) {
          if (name.toUpperCase().startsWith(brand.toUpperCase())) {
            fullName = name;
          } else {
            fullName = `${brand} ${name}`;
          }
        } else {
          fullName = name || brand;
        }

        if (fullName) {
          const words = fullName.split(/\s+/);
          const seen = new Set<string>();
          const uniqueWords = words.filter(word => {
            const lower = word.toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
          });
          const finalName = uniqueWords.join(' ');

          const updatedCache = await loadDeviceCacheUnified();
          updatedCache[cleanModel] = finalName;
          await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
          
          return sendJson(200, { 
            name: finalName, 
            source: "gemini",
            usedSearchTool,
            searchMethod,
            sources
          }, { model: cleanModel, action: 'resolve_gemini' });
        }
      }
      
      // If parsed response has no brand and no name, it's explicitly identified as an invalid/unidentifiable code by the model.
      const updatedCache = await loadDeviceCacheUnified();
      updatedCache[cleanModel] = null;
      await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [`${cleanModel} (Unknown)`] });
      
      return sendJson(200, { 
        name: null, 
        source: "gemini",
        usedSearchTool,
        searchMethod,
        sources
      }, { model: cleanModel, action: 'resolve_gemini' });

    } catch (geminiError: any) {
      console.error("Gemini Device Resolver Error:", geminiError.message);
      let finalErrorMsg = geminiError.message;
      if (finalErrorMsg.includes("leaked")) {
        finalErrorMsg = "The Gemini API key fetched from your Supabase 'news_api_keys' table has been blocked by Google as leaked. Please replace it in the database.";
      }
      return sendJson(200, { name: null, source: "gemini", error: finalErrorMsg }, { model: cleanModel, action: 'resolve_gemini_error', errorMessage: finalErrorMsg });
    }
  } catch (e: any) {
    console.error("Device Mapper Error:", e.message);
    return sendJson(500, { error: e.message }, { action: 'error', errorMessage: e.message });
  }
}
