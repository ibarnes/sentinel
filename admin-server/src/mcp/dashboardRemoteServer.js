#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDashboardMcpServer, DATA_ROOT, WORKSPACE_ROOT } from './dashboardMcpFactory.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { installDashboardOAuth } from './dashboardOAuth.js';

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx <= 0) continue;
      const key = t.slice(0, idx).trim();
      let val = t.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

const ENV_FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '.env');
loadEnvFile(ENV_FILE);

const HOST = process.env.DASHBOARD_MCP_HOST || '0.0.0.0';
const PORT = Number(process.env.DASHBOARD_MCP_PORT || '4191');
const MCP_PATH = process.env.DASHBOARD_MCP_PATH || '/mcp/dashboard';
const AUTH_TOKEN = process.env.DASHBOARD_MCP_AUTH_TOKEN || '';
const PUBLIC_BASE_URL = process.env.DASHBOARD_MCP_PUBLIC_BASE_URL || 'https://dashboard.hiethel.ai';
const PUBLIC_MCP_URL = new URL(MCP_PATH, PUBLIC_BASE_URL);
const OAUTH_RESOURCE_METADATA_URL = getOAuthProtectedResourceMetadataUrl(PUBLIC_MCP_URL);
const ALLOWED_HOSTS = String(process.env.DASHBOARD_MCP_ALLOWED_HOSTS || 'dashboard.hiethel.ai,127.0.0.1,localhost')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const TEAM_USERS_FILE = path.join(WORKSPACE_ROOT, 'mission-control', 'auth', 'users.json');
const OAUTH_SESSION_SECRET = process.env.DASHBOARD_MCP_OAUTH_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || AUTH_TOKEN;
const COOKIE_SECURE = String(process.env.DASHBOARD_MCP_OAUTH_COOKIE_SECURE || process.env.ADMIN_COOKIE_SECURE || 'true') === 'true';

if (!AUTH_TOKEN) {
  console.error('Missing DASHBOARD_MCP_AUTH_TOKEN. Refuse to start unauthenticated remote MCP server.');
  process.exit(1);
}

if (!OAUTH_SESSION_SECRET) {
  console.error('Missing OAuth session secret. Set DASHBOARD_MCP_OAUTH_SESSION_SECRET or ADMIN_SESSION_SECRET.');
  process.exit(1);
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

const app = createMcpExpressApp({
  host: HOST,
  allowedHosts: ALLOWED_HOSTS
});

const oauthProvider = installDashboardOAuth(app, {
  publicBaseUrl: PUBLIC_BASE_URL,
  resourceServerUrl: PUBLIC_MCP_URL,
  usersFile: TEAM_USERS_FILE,
  sessionSecret: OAUTH_SESSION_SECRET,
  cookieSecure: COOKIE_SECURE,
  serviceDocumentationUrl: new URL('/admin/MCP-README.md', PUBLIC_BASE_URL).href
});

const requireDashboardMcpAuth = requireBearerAuth({
  requiredScopes: ['mcp:tools'],
  resourceMetadataUrl: OAUTH_RESOURCE_METADATA_URL,
  verifier: {
    async verifyAccessToken(token) {
      if (safeEqual(token, AUTH_TOKEN)) {
        return {
          token,
          clientId: 'static-bearer',
          scopes: ['mcp:tools'],
          expiresAt: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60),
          resource: PUBLIC_MCP_URL,
          extra: {
            authMode: 'static-bearer'
          }
        };
      }
      return oauthProvider.verifyAccessToken(token);
    }
  }
});

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    name: 'dashboard-data-mcp',
    transport: 'streamable-http',
    auth: ['static-bearer', 'oauth'],
    mcp_path: MCP_PATH,
    oauth_resource_metadata_url: OAUTH_RESOURCE_METADATA_URL,
    oauth_authorization_server: PUBLIC_BASE_URL,
    workspace_root: WORKSPACE_ROOT,
    data_root: DATA_ROOT
  });
});

app.post(MCP_PATH, requireDashboardMcpAuth, async (req, res) => {
  const server = createDashboardMcpServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling remote MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
    server.close();
  }
});

app.get(MCP_PATH, requireDashboardMcpAuth, async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed.'
    },
    id: null
  }));
});

app.delete(MCP_PATH, requireDashboardMcpAuth, async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed.'
    },
    id: null
  }));
});

app.listen(PORT, HOST, (error) => {
  if (error) {
    console.error('Failed to start dashboard remote MCP server:', error);
    process.exit(1);
  }
  console.error(`dashboard-data-mcp remote server listening on http://${HOST}:${PORT}${MCP_PATH}`);
});
