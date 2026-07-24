import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import express from 'express';
import session from 'express-session';
import {
  InvalidGrantError,
  InvalidRequestError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js';

const DEFAULT_SCOPE = 'mcp:tools';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return value || 'observer';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  const next = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(next, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(next, filePath);
}

class InMemoryOAuthClientsStore {
  constructor() {
    this.clients = new Map();
  }

  async getClient(clientId) {
    const existing = this.clients.get(clientId);
    if (existing) return existing;

    // Support SEP-991 style URL-based client IDs by resolving the client
    // metadata document on demand and caching it locally for later token use.
    if (!this.isHttpsClientMetadataUrl(clientId)) {
      return undefined;
    }

    try {
      const response = await fetch(clientId, {
        method: 'GET',
        headers: {
          accept: 'application/json'
        }
      });
      if (!response.ok) return undefined;
      const json = await response.json();
      const parsed = OAuthClientMetadataSchema.safeParse(json);
      if (!parsed.success) return undefined;
      const metadata = {
        client_id: clientId,
        ...parsed.data
      };
      this.clients.set(clientId, metadata);
      return metadata;
    } catch {
      return undefined;
    }
  }

  async registerClient(clientMetadata) {
    this.clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }

  isHttpsClientMetadataUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && Boolean(url.pathname && url.pathname !== '/');
    } catch {
      return false;
    }
  }
}

class DashboardOAuthProvider {
  constructor({ resourceServerUrl, usersFile, stateFile }) {
    this.resourceServerUrl = resourceServerUrl;
    this.usersFile = usersFile;
    this.stateFile = stateFile;
    this.clientsStore = new InMemoryOAuthClientsStore();
    this.codes = new Map();
    this.accessTokens = new Map();
    this.refreshTokens = new Map();
    this.stateLoaded = false;
    this.stateLoadPromise = null;
  }

  async ensureStateLoaded() {
    if (this.stateLoaded) return;
    if (!this.stateLoadPromise) {
      this.stateLoadPromise = this.loadState();
    }
    await this.stateLoadPromise;
  }

  async loadState() {
    const state = await readJson(this.stateFile, {
      clients: [],
      codes: [],
      accessTokens: [],
      refreshTokens: []
    });
    const now = nowSeconds();

    for (const client of Array.isArray(state?.clients) ? state.clients : []) {
      if (client?.client_id) {
        this.clientsStore.clients.set(client.client_id, client);
      }
    }

    for (const code of Array.isArray(state?.codes) ? state.codes : []) {
      if (!code?.code || !code?.clientId || !code?.redirectUri || !code?.username) continue;
      if ((code.createdAt || 0) + 15 * 60 <= now) continue;
      this.codes.set(code.code, {
        clientId: code.clientId,
        codeChallenge: code.codeChallenge,
        redirectUri: code.redirectUri,
        scopes: Array.isArray(code.scopes) ? code.scopes : [DEFAULT_SCOPE],
        resource: new URL(code.resource || this.resourceServerUrl.href),
        username: code.username,
        role: normalizeRole(code.role),
        createdAt: code.createdAt || now
      });
    }

    for (const token of Array.isArray(state?.accessTokens) ? state.accessTokens : []) {
      if (!token?.token || !token?.clientId || !token?.expiresAt || token.expiresAt <= now) continue;
      this.accessTokens.set(token.token, {
        clientId: token.clientId,
        scopes: Array.isArray(token.scopes) ? token.scopes : [DEFAULT_SCOPE],
        resource: new URL(token.resource || this.resourceServerUrl.href),
        username: token.username || '',
        role: normalizeRole(token.role),
        expiresAt: token.expiresAt
      });
    }

    for (const token of Array.isArray(state?.refreshTokens) ? state.refreshTokens : []) {
      if (!token?.token || !token?.clientId || !token?.expiresAt || token.expiresAt <= now) continue;
      this.refreshTokens.set(token.token, {
        clientId: token.clientId,
        scopes: Array.isArray(token.scopes) ? token.scopes : [DEFAULT_SCOPE],
        resource: new URL(token.resource || this.resourceServerUrl.href),
        username: token.username || '',
        role: normalizeRole(token.role),
        expiresAt: token.expiresAt
      });
    }

    this.stateLoaded = true;
    await this.persistState();
  }

  async persistState() {
    const state = {
      clients: Array.from(this.clientsStore.clients.values()),
      codes: Array.from(this.codes.entries()).map(([code, value]) => ({
        code,
        clientId: value.clientId,
        codeChallenge: value.codeChallenge,
        redirectUri: value.redirectUri,
        scopes: value.scopes,
        resource: value.resource?.href || this.resourceServerUrl.href,
        username: value.username,
        role: value.role,
        createdAt: value.createdAt
      })),
      accessTokens: Array.from(this.accessTokens.entries()).map(([token, value]) => ({
        token,
        clientId: value.clientId,
        scopes: value.scopes,
        resource: value.resource?.href || this.resourceServerUrl.href,
        username: value.username,
        role: value.role,
        expiresAt: value.expiresAt
      })),
      refreshTokens: Array.from(this.refreshTokens.entries()).map(([token, value]) => ({
        token,
        clientId: value.clientId,
        scopes: value.scopes,
        resource: value.resource?.href || this.resourceServerUrl.href,
        username: value.username,
        role: value.role,
        expiresAt: value.expiresAt
      }))
    };
    await writeJsonAtomic(this.stateFile, state);
  }

  async authorize(client, params, res) {
    await this.ensureStateLoaded();
    const req = res.req;
    const user = req?.session?.dashboardMcpOAuthUser;
    if (!user?.username) {
      const returnTo = req?.originalUrl || '/authorize';
      return res.redirect(`/oauth/login?return_to=${encodeURIComponent(returnTo)}`);
    }

    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new InvalidRequestError('Unregistered redirect_uri');
    }

    if (params.resource && params.resource.href !== this.resourceServerUrl.href) {
      throw new InvalidRequestError(`Invalid resource: ${params.resource.href}`);
    }

    const code = crypto.randomUUID();
    this.codes.set(code, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: this.normalizeScopes(params.scopes),
      resource: params.resource || this.resourceServerUrl,
      username: user.username,
      role: normalizeRole(user.role),
      createdAt: nowSeconds()
    });
    await this.persistState();

    const targetUrl = new URL(params.redirectUri);
    targetUrl.searchParams.set('code', code);
    if (params.state !== undefined) {
      targetUrl.searchParams.set('state', params.state);
    }
    res.redirect(targetUrl.toString());
  }

  async challengeForAuthorizationCode(client, authorizationCode) {
    await this.ensureStateLoaded();
    const code = this.codes.get(authorizationCode);
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }
    return code.codeChallenge;
  }

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, resource) {
    await this.ensureStateLoaded();
    const code = this.codes.get(authorizationCode);
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }

    if (redirectUri && redirectUri !== code.redirectUri) {
      throw new InvalidGrantError('redirect_uri mismatch');
    }

    const targetResource = resource || code.resource || this.resourceServerUrl;
    if (targetResource.href !== this.resourceServerUrl.href) {
      throw new InvalidGrantError(`Invalid resource: ${targetResource.href}`);
    }

    this.codes.delete(authorizationCode);
    await this.persistState();
    return this.issueTokens({
      clientId: client.client_id,
      scopes: code.scopes,
      resource: targetResource,
      username: code.username,
      role: code.role
    });
  }

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    await this.ensureStateLoaded();
    const current = this.refreshTokens.get(refreshToken);
    if (!current || current.clientId !== client.client_id || current.expiresAt <= nowSeconds()) {
      throw new InvalidGrantError('Invalid refresh token');
    }

    const normalizedScopes = scopes && scopes.length ? this.normalizeScopes(scopes) : current.scopes;
    const allowed = normalizedScopes.every((scope) => current.scopes.includes(scope));
    if (!allowed) {
      throw new InvalidGrantError('Requested scopes exceed granted scopes');
    }

    const targetResource = resource || current.resource || this.resourceServerUrl;
    if (targetResource.href !== this.resourceServerUrl.href) {
      throw new InvalidGrantError(`Invalid resource: ${targetResource.href}`);
    }

    this.refreshTokens.delete(refreshToken);
    await this.persistState();
    return this.issueTokens({
      clientId: current.clientId,
      scopes: normalizedScopes,
      resource: targetResource,
      username: current.username,
      role: current.role
    });
  }

  async verifyAccessToken(token) {
    await this.ensureStateLoaded();
    const current = this.accessTokens.get(token);
    if (!current || current.expiresAt <= nowSeconds()) {
      throw new InvalidGrantError('Invalid or expired access token');
    }

    if (!current.resource || current.resource.href !== this.resourceServerUrl.href) {
      throw new InvalidGrantError('Token audience mismatch');
    }

    return {
      token,
      clientId: current.clientId,
      scopes: current.scopes,
      expiresAt: current.expiresAt,
      resource: current.resource,
      extra: {
        username: current.username,
        role: current.role
      }
    };
  }

  async loadUsers() {
    const data = await readJson(this.usersFile, { users: [] });
    return Array.isArray(data?.users) ? data.users : [];
  }

  normalizeScopes(scopes) {
    const values = Array.isArray(scopes) ? scopes : [];
    const unique = Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
    return unique.length ? unique : [DEFAULT_SCOPE];
  }

  issueTokens({ clientId, scopes, resource, username, role }) {
    const now = nowSeconds();
    for (const [token, current] of this.accessTokens.entries()) {
      if (current.expiresAt <= now) {
        this.accessTokens.delete(token);
      }
    }
    for (const [token, current] of this.refreshTokens.entries()) {
      if (current.expiresAt <= now) {
        this.refreshTokens.delete(token);
      }
    }

    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const issuedAt = now;
    const accessExpiresAt = issuedAt + 60 * 60;
    const refreshExpiresAt = issuedAt + 30 * 24 * 60 * 60;

    this.accessTokens.set(accessToken, {
      clientId,
      scopes,
      resource,
      username,
      role,
      expiresAt: accessExpiresAt
    });
    this.refreshTokens.set(refreshToken, {
      clientId,
      scopes,
      resource,
      username,
      role,
      expiresAt: refreshExpiresAt
    });

    this.persistState().catch(() => undefined);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 60 * 60,
      refresh_token: refreshToken,
      scope: scopes.join(' ')
    };
  }
}

function loginPage({ error = '', returnTo = '' }) {
  const safeReturnTo = String(returnTo || '').startsWith('/') ? returnTo : '/authorize';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dashboard MCP OAuth Login</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111d;
        --card: #0f1c2e;
        --border: #27405f;
        --text: #edf4ff;
        --muted: #9fb6d5;
        --accent: #5bd1ff;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(900px 460px at 85% -10%, rgba(91, 209, 255, 0.18), transparent 55%),
          radial-gradient(700px 380px at 0% 100%, rgba(56, 189, 248, 0.14), transparent 55%),
          var(--bg);
        color: var(--text);
        font: 16px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .card {
        width: min(440px, calc(100vw - 32px));
        background: rgba(15, 28, 46, 0.96);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 1.5rem;
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
      }
      label {
        display: block;
        margin: 12px 0 6px;
        font-size: 0.92rem;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #081321;
        color: var(--text);
        padding: 12px 14px;
      }
      button {
        width: 100%;
        margin-top: 18px;
        border: 0;
        border-radius: 12px;
        padding: 12px 14px;
        background: linear-gradient(135deg, #5bd1ff, #38bdf8);
        color: #03111d;
        font-weight: 700;
        cursor: pointer;
      }
      .error {
        margin: 0 0 14px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(248, 113, 113, 0.16);
        border: 1px solid rgba(248, 113, 113, 0.35);
        color: #ffd3d3;
      }
      .caption {
        margin-top: 16px;
        font-size: 0.88rem;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Connect Dashboard MCP</h1>
      <p>Sign in with your dashboard team credentials so ChatGPT can complete the OAuth connection.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/oauth/login">
        <input type="hidden" name="return_to" value="${escapeHtml(safeReturnTo)}" />
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" type="password" name="password" autocomplete="current-password" required />
        <button type="submit">Continue</button>
      </form>
      <p class="caption">This keeps the existing static bearer-token path intact for desktop and Codex clients.</p>
    </main>
  </body>
</html>`;
}

export function installDashboardOAuth(app, {
  publicBaseUrl,
  resourceServerUrl,
  usersFile,
  sessionSecret,
  cookieSecure = true,
  serviceDocumentationUrl
}) {
  const provider = new DashboardOAuthProvider({
    resourceServerUrl,
    usersFile,
    stateFile: path.join(path.dirname(usersFile), 'dashboard-mcp-oauth-state.json')
  });
  provider.ensureStateLoaded().catch((error) => {
    console.error('Failed to initialize dashboard OAuth state:', error);
  });

  app.set('trust proxy', 1);
  app.use(session({
    name: 'dashboard_mcp_oauth_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  const loginRouter = express.Router();
  loginRouter.use(express.urlencoded({ extended: false }));

  loginRouter.get('/oauth/login', (req, res) => {
    const returnTo = String(req.query.return_to || '/authorize');
    res.type('html').send(loginPage({ returnTo }));
  });

  loginRouter.post('/oauth/login', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const returnTo = String(req.body.return_to || '/authorize');

    const users = await provider.loadUsers();
    const user = users.find((entry) => entry.username === username && entry.active !== false);
    const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/authorize';

    if (!user || !(await bcrypt.compare(password, user.passwordHash || ''))) {
      return res.status(401).type('html').send(loginPage({
        error: 'Invalid credentials',
        returnTo: safeReturnTo
      }));
    }

    req.session.dashboardMcpOAuthUser = {
      username: user.username,
      role: normalizeRole(user.role)
    };
    return res.redirect(safeReturnTo);
  });

  loginRouter.post('/oauth/logout', (req, res) => {
    req.session.destroy(() => undefined);
    res.redirect('/oauth/login');
  });

  app.use(loginRouter);

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer: new URL(publicBaseUrl).href,
      service_documentation: serviceDocumentationUrl ? new URL(serviceDocumentationUrl).href : undefined,
      authorization_endpoint: new URL('/authorize', publicBaseUrl).href,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint: new URL('/token', publicBaseUrl).href,
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: [DEFAULT_SCOPE],
      registration_endpoint: new URL('/register', publicBaseUrl).href,
      client_id_metadata_document_supported: true
    });
  });

  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL(publicBaseUrl),
    resourceServerUrl,
    scopesSupported: [DEFAULT_SCOPE],
    resourceName: 'USG Dashboard MCP',
    serviceDocumentationUrl: serviceDocumentationUrl ? new URL(serviceDocumentationUrl) : undefined
  }));

  return provider;
}
