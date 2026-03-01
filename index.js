/**
 * OpenCode Qwen API Plugin
 * 
 * Uses local proxy (like Pollinations) to handle auth automatically.
 * Auto-fetches models, validates and refreshes tokens.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_DIR = path.join(os.homedir(), '.cache', 'opencode', 'qwen-plugin');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');
const PROVIDER_ID = 'qwen';
const API_BASE_URL = 'https://qwen.aikit.club/v1';

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (e) { }
}

function log(msg) {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) { }
}

function getAuthFilePath() {
  const home = os.homedir();
  return path.join(home, '.local', 'share', 'opencode', 'auth.json');
}

function readApiKeyFromAuth() {
  try {
    const authPath = getAuthFilePath();
    
    if (fs.existsSync(authPath)) {
      const content = fs.readFileSync(authPath, 'utf-8');
      const auth = JSON.parse(content);
      
      const providerAuth = auth[PROVIDER_ID];
      if (providerAuth) {
        return providerAuth.key || providerAuth.apiKey || providerAuth.token || null;
      }
    }
  } catch (e) {
    log(`[Auth] Error: ${e.message}`);
  }
  return null;
}

function saveApiKeyToAuth(newKey) {
  try {
    const authPath = getAuthFilePath();
    let auth = {};
    
    if (fs.existsSync(authPath)) {
      const content = fs.readFileSync(authPath, 'utf-8');
      auth = JSON.parse(content);
    }
    
    auth[PROVIDER_ID] = {
      type: 'api',
      key: newKey
    };
    
    fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));
    log(`[Auth] Saved new token to auth file`);
    return true;
  } catch (e) {
    log(`[Auth] Error saving: ${e.message}`);
    return false;
  }
}

async function validateToken(apiKey) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'qwen.aikit.club',
      port: 443,
      path: '/v1/validate',
      method: 'POST',
      headers: {
        'Host': 'qwen.aikit.club',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          log(`[Validate] Status: ${res.statusCode}`);
          
          if (res.statusCode === 200 && json.id) {
            resolve({ valid: true, data: json });
          } else {
            resolve({ valid: false, error: json.error || 'Unknown error' });
          }
        } catch (e) {
          resolve({ valid: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ valid: false, error: e.message }));
    req.write(JSON.stringify({ token: apiKey }));
    req.end();
  });
}

async function refreshToken() {
  const currentKey = readApiKeyFromAuth();
  if (!currentKey) return null;

  return new Promise((resolve) => {
    const options = {
      hostname: 'qwen.aikit.club',
      port: 443,
      path: '/v1/refresh',
      method: 'POST',
      headers: {
        'Host': 'qwen.aikit.club',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          log(`[Refresh] Status: ${res.statusCode}`);
          
          if (res.statusCode === 200 && json.access_token) {
            saveApiKeyToAuth(json.access_token);
            resolve(json.access_token);
          } else if (res.statusCode === 200 && json.id) {
            resolve(currentKey);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => resolve(null));
    req.write(JSON.stringify({ token: currentKey }));
    req.end();
  });
}

async function checkAndRefreshToken() {
  const apiKey = readApiKeyFromAuth();
  if (!apiKey) {
    log(`[Token] No token found`);
    return null;
  }

  log(`[Token] Validating current token...`);
  const result = await validateToken(apiKey);
  
  if (result.valid) {
    log(`[Token] Token is valid`);
    return apiKey;
  }

  log(`[Token] Token invalid/expired, attempting refresh...`);
  const newToken = await refreshToken();
  
  if (newToken) {
    log(`[Token] Token refreshed successfully`);
    return newToken;
  }

  log(`[Token] Could not refresh token`);
  return null;
}

const MODEL_CAPABILITIES = {
  'qvq-max': { name: 'QVQ Max', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen-deep-research': { name: 'Qwen Deep Research', vision: false, reasoning: true, webSearch: false, toolCalling: false },
  'qwen2.5-max': { name: 'Qwen2.5 Max', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen3-next-80b-a3b': { name: 'Qwen3 Next 80B A3B', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen2.5-plus': { name: 'Qwen2.5 Plus', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen2.5-turbo': { name: 'Qwen2.5 Turbo', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen2.5-14b-instruct-1m': { name: 'Qwen2.5 14B Instruct 1M', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen2.5-72b-instruct': { name: 'Qwen2.5 72B Instruct', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen2.5-coder-32b-instruct': { name: 'Qwen2.5 Coder 32B', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen2.5-omni-7b': { name: 'Qwen2.5 Omni 7B', vision: true, reasoning: false, webSearch: true, toolCalling: false },
  'qwen2.5-vl-32b-instruct': { name: 'Qwen2.5 VL 32B', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen3-235b-a22b-2507': { name: 'Qwen3 235B A22B', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen3-30b-a3b-2507': { name: 'Qwen3 30B A3B', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen3-coder': { name: 'Qwen3 Coder', vision: true, reasoning: false, webSearch: true, toolCalling: true },
  'qwen3-coder-flash': { name: 'Qwen3 Coder Flash', vision: true, reasoning: false, webSearch: true, toolCalling: false },
  'qwen3-max': { name: 'Qwen3 Max', vision: true, reasoning: false, webSearch: true, toolCalling: false },
  'qwen3-omni-flash': { name: 'Qwen3 Omni Flash', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen3-vl-235b-a22b': { name: 'Qwen3 VL 235B', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen3-vl-32b': { name: 'Qwen3 VL 32B', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen3-vl-30b-a3b': { name: 'Qwen3 VL 30B A3B', vision: true, reasoning: true, webSearch: false, toolCalling: false },
  'qwen3-max-2026-01-23': { name: 'Qwen3 Max 2026-01-23', vision: true, reasoning: false, webSearch: true, toolCalling: false },
  'qwen3-vl-plus': { name: 'Qwen3 VL Plus', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen3-coder-plus': { name: 'Qwen3 Coder Plus', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwq-32b': { name: 'QWQ 32B', vision: false, reasoning: true, webSearch: true, toolCalling: false },
  'qwen-web-dev': { name: 'Qwen Web Dev', vision: true, reasoning: false, webSearch: false, toolCalling: false },
  'qwen-full-stack': { name: 'Qwen Full Stack', vision: true, reasoning: false, webSearch: false, toolCalling: false },
  'qwen-cogview': { name: 'Qwen CogView', vision: false, reasoning: false, webSearch: false, toolCalling: false },
  'qwen-max': { name: 'Qwen Max', vision: true, reasoning: true, webSearch: true, toolCalling: false },
  'qwen-max-latest': { name: 'Qwen Max Latest', vision: true, reasoning: true, webSearch: true, toolCalling: false }
};

async function fetchModels() {
  const apiKey = readApiKeyFromAuth();
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'qwen.aikit.club',
      port: 443,
      path: '/v1/models',
      method: 'GET',
      headers: {
        'Host': 'qwen.aikit.club',
        'Content-Type': 'application/json'
      }
    };

    if (apiKey) {
      options.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && Array.isArray(json.data)) {
            const models = {};
            json.data.forEach(model => {
              const id = model.id;
              const caps = MODEL_CAPABILITIES[id] || {};
              models[id] = { 
                name: caps.name || id,
                limit: caps.vision ? { context: 262144, output: 32768 } : undefined
              };
            });
            log(`[Models] Fetched ${Object.keys(models).length} models from API`);
            resolve(models);
          } else {
            log(`[Models] Using default models`);
            resolve(getDefaultModels());
          }
        } catch (e) {
          log(`[Models] Parse error: ${e.message}`);
          resolve(getDefaultModels());
        }
      });
    });

    req.on('error', (e) => {
      log(`[Models] Error: ${e.message}`);
      resolve(getDefaultModels());
    });

    req.end();
  });
}

function getDefaultModels() {
  const models = {};
  Object.keys(MODEL_CAPABILITIES).forEach(id => {
    const caps = MODEL_CAPABILITIES[id];
    models[id] = { 
      name: caps.name,
      limit: caps.vision ? { context: 262144, output: 32768 } : undefined
    };
  });
  return models;
}

let cachedModels = null;
let proxyPort = 0;

function startProxy() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        const apiKey = readApiKeyFromAuth();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          provider: 'qwen',
          hasKey: !!apiKey,
          modelsCount: cachedModels ? Object.keys(cachedModels).length : 0
        }));
        return;
      }

      if (req.url.startsWith('/v1/')) {
        const apiKey = readApiKeyFromAuth();

        const options = {
          hostname: 'qwen.aikit.club',
          port: 443,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            'Host': 'qwen.aikit.club',
            'Content-Type': 'application/json'
          }
        };

        if (apiKey) {
          options.headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const proxyReq = https.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    server.listen(0, '127.0.0.1', () => {
      proxyPort = server.address().port;
      log(`[Proxy] Started on port ${proxyPort}`);
      resolve(proxyPort);
    });

    server.on('error', (e) => {
      log(`[Proxy] Error: ${e.message}`);
      resolve(0);
    });
  });
}

export const QwenPlugin = async (ctx) => {
  log('[Plugin] Starting Qwen Plugin v3.2.0...');

  await startProxy();
  
  log('[Plugin] Checking and refreshing token...');
  await checkAndRefreshToken();
  
  log('[Plugin] Fetching models from API...');
  cachedModels = await fetchModels();
  log(`[Plugin] Loaded ${Object.keys(cachedModels).length} models`);

  const localBaseUrl = `http://127.0.0.1:${proxyPort}/v1`;

  return {
    config: async (config) => {
      log('[Hook] config() called');

      if (!config.provider) config.provider = {};

      config.provider[PROVIDER_ID] = {
        id: PROVIDER_ID,
        name: 'Qwen AI',
        options: { baseURL: localBaseUrl },
        models: cachedModels
      };

      log(`[Hook] Registered provider with ${Object.keys(cachedModels).length} models`);
    }
  };
};

export default QwenPlugin;
