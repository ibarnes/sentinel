import express from 'express';
import session from 'express-session';
import multer from 'multer';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Ajv from 'ajv';
import nodemailer from 'nodemailer';
import revealRoutes from './reveal/routes/revealRoutes.js';
import { ensureRevealStorage } from './reveal/storage/revealStorage.js';

const app = express();
app.set('trust proxy', 1);

const ROOT = path.resolve('/home/ec2-user/.openclaw/workspace');
const UOS_ROOT = path.join(ROOT, 'workspace', 'uos');
const INBOX_ROOT = path.join(UOS_ROOT, 'inbox');
const CURRENT_ROOT = path.join(UOS_ROOT, 'current');
const ARCHIVE_ROOT = path.join(UOS_ROOT, 'archive');
const UOS_INDEX = path.join(UOS_ROOT, 'UOS_INDEX.md');

const DASHBOARD_STATE_FILE = path.join(ROOT, 'dashboard', 'state', 'state.json');
const DASHBOARD_CHANGELOG = path.join(ROOT, 'dashboard', 'state', 'changelog.md');
const DASHBOARD_SNAPSHOTS = path.join(ROOT, 'dashboard', 'snapshots');
const DASHBOARD_SIGNALS_FILE = path.join(ROOT, 'dashboard', 'data', 'signals.json');
const DASHBOARD_TEAM_FILE = path.join(ROOT, 'dashboard', 'data', 'team.json');
const DASHBOARD_CONTACT_PATHS_FILE = path.join(ROOT, 'dashboard', 'data', 'contact_paths.json');
const DASHBOARD_DECISION_ARCH_FILE = path.join(ROOT, 'dashboard', 'data', 'decision_architecture.json');
const BEACON_QUEUE_FILE = path.join(ROOT, 'mission-control', 'beacon', 'beacons.json');
const BEACON_QUEUE_SCHEMA_FILE = path.join(ROOT, 'mission-control', 'beacon', 'beacons.schema.json');
const DASHBOARD_DECKSPECS_FILE = path.join(ROOT, 'dashboard', 'data', 'deckspecs.v2.json');
const DASHBOARD_DECKSPEC_SCHEMA_FILE = path.join(ROOT, 'dashboard', 'deckspec.schema.v2.json');
const DASHBOARD_PIPELINE_RUNS_FILE = path.join(ROOT, 'dashboard', 'data', 'pipeline_runs.v1.json');
const DASHBOARD_SLIDE_SPECS_FILE = path.join(ROOT, 'dashboard', 'data', 'slidespecs.v2.json');
const DASHBOARD_SAVEPOINTS_FILE = path.join(ROOT, 'dashboard', 'data', 'savepoints.v1.json');
const DASHBOARD_CAPITAL_MAP_FILE = path.join(ROOT, 'dashboard', 'data', 'capital-map.json');
const DASHBOARD_PLATFORM_PRESSURE_FILE = path.join(ROOT, 'dashboard', 'data', 'platform_pressure.json');
const DASHBOARD_TEMPLATE_LIBRARY_ROOT = path.join(ROOT, 'dashboard', 'templates', 'presentation-templates');

const ADMIN_LOG_ROOT = path.join(ROOT, 'mission-control', 'logs', 'admin-actions');

const TEAM_AUTH_ROOT = path.join(ROOT, 'mission-control', 'auth');
const TEAM_USERS_FILE = path.join(TEAM_AUTH_ROOT, 'users.json');
const BOARD_ROOT = path.join(ROOT, 'mission-control', 'board');
const BOARD_FILE = path.join(BOARD_ROOT, 'BOARD.json');
const BOARD_SCHEMA_FILE = path.join(BOARD_ROOT, 'BOARD.schema.json');
const BOARD_HISTORY_ROOT = path.join(BOARD_ROOT, 'history');
const ACTIVITY_ROOT = path.join(ROOT, 'mission-control', 'activity');
const REVIEW_PACKET_ROOT = path.join(ROOT, 'mission-control', 'review-packets');
const UOS_PENDING_ROOT = path.join(UOS_ROOT, 'pending');

const BOARD_COLUMNS = ['Backlog', 'Doing', 'Blocked', 'Ready for Review', 'Done'];
const BOARD_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const ARCHITECT_USERNAME = (process.env.ARCHITECT_USERNAME || 'isaac').toLowerCase();

const REQUIRED_FIELDS = ['executionEngine', 'canon', 'revenueOS'];
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES_PER_CATEGORY = 100;

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const ADMIN_COOKIE_SECURE = String(process.env.ADMIN_COOKIE_SECURE || 'true') === 'true';
const ADMIN_PORT = Number(process.env.ADMIN_PORT || '4180');
const ADMIN_HOST = process.env.ADMIN_HOST || '127.0.0.1';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || '';

if (!ADMIN_PASSWORD_HASH || !ADMIN_SESSION_SECRET) {
  console.error('Missing ADMIN_PASSWORD_HASH or ADMIN_SESSION_SECRET env var. Ref: admin-server/.env.example');
  process.exit(1);
}

let mailTransport = null;
function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) return null;
  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return mailTransport;
}

function uiHead(title) {
  return `
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script defer src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script defer src="https://unpkg.com/lucide@latest"></script>
<script defer src="/dashboard/vendor/cytoscape.min.js"></script>
<style>
  :root {
    --bg: #0f1115;
    --surface: #151922;
    --surface-elevated: #1a202b;
    --border: #252c39;
    --text: #e8ecf3;
    --text-muted: #9aa5b4;
    --accent: #4f8cff;
    --accent-soft: rgba(79, 140, 255, 0.16);
    --radius-sm: 12px;
    --radius-md: 14px;
    --radius-lg: 16px;
    --shadow-sm: 0 12px 24px rgba(2, 8, 20, 0.18);
    --shadow-lg: 0 20px 44px rgba(2, 8, 20, 0.28);
    --tr-fast: 180ms ease;
  }

  html, body { background: var(--bg); color: var(--text); font-family: Inter, "Segoe UI", Roboto, sans-serif; }
  body { min-height: 100vh; }
  body.nav-drawer-open { overflow: hidden; }
  a { color: #86b2ff; text-decoration: none; }
  a:hover { color: #a3c6ff; }
  .app-shell { max-width: 1380px; margin: 24px auto; padding: 0 16px; }
  .page-title { font-size: 1.65rem; font-weight: 650; margin: 0; letter-spacing: -0.02em; }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0; }
  .text-muted { color: var(--text-muted) !important; }

  .surface-card,
  .card,
  .navbar,
  .form-control,
  .form-select,
  .table,
  .list-group-item,
  .dropdown-menu {
    background: var(--surface) !important;
    color: var(--text);
    border-color: var(--border) !important;
  }

  .card,
  .navbar,
  .form-control,
  .form-select,
  .btn,
  .table,
  .dropdown-menu {
    border-radius: var(--radius-md) !important;
  }

  .card,
  .navbar { box-shadow: var(--shadow-sm); }
  .card.elevated { box-shadow: var(--shadow-lg); background: var(--surface-elevated) !important; }

  .form-control,
  .form-select,
  textarea.form-control,
  input.form-control {
    min-height: 40px;
    color: var(--text) !important;
    -webkit-text-fill-color: var(--text) !important;
    caret-color: var(--text);
  }
  .form-control:active,
  .form-control:focus,
  .form-select:active,
  .form-select:focus,
  textarea.form-control:active,
  textarea.form-control:focus,
  input.form-control:active,
  input.form-control:focus {
    color: var(--text) !important;
    -webkit-text-fill-color: var(--text) !important;
  }
  .form-select option { background: var(--surface); color: var(--text); }

  /* Login pages keep legacy light field readability */
  body.login-page .form-control,
  body.login-page .form-select,
  body.login-page textarea.form-control,
  body.login-page input.form-control {
    color: #212529 !important;
    -webkit-text-fill-color: #212529 !important;
    caret-color: #212529;
    background: #ffffff !important;
  }
  body.login-page .form-control:focus,
  body.login-page .form-control:active,
  body.login-page .form-select:focus,
  body.login-page .form-select:active {
    color: #212529 !important;
    -webkit-text-fill-color: #212529 !important;
  }
  .form-control::placeholder { color: #7f8998; }
  .form-control:focus,
  .form-select:focus,
  .btn:focus,
  .nav-link:focus {
    box-shadow: 0 0 0 3px var(--accent-soft) !important;
    border-color: var(--accent) !important;
    outline: none;
  }

  .btn { transition: all var(--tr-fast); min-height: 38px; }
  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #f8fbff;
  }
  .btn-primary:hover { background: #669bff; border-color: #669bff; }
  .btn-outline-secondary,
  .btn-outline-primary {
    border-color: var(--border);
    color: var(--text);
  }
  .btn-outline-secondary:hover,
  .btn-outline-primary:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: #394457;
    color: var(--text);
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
  }
  .btn-ghost:hover { color: var(--text); background: rgba(255,255,255,.04); }

  .metric-card { min-height: 126px; }
  .metric-label { color: var(--text-muted); font-size: .78rem; font-weight: 500; text-transform: uppercase; letter-spacing: .06em; }
  .metric-value { font-size: 1.9rem; line-height: 1.05; font-weight: 680; letter-spacing: -0.02em; }

  .table { --bs-table-bg: transparent; --bs-table-color: var(--text); margin-bottom: 0; }
  .table thead th {
    background: rgba(255,255,255,.03);
    color: #c7d1df;
    border-bottom: 1px solid var(--border);
    font-size: .76rem;
    text-transform: uppercase;
    letter-spacing: .05em;
    font-weight: 600;
    padding: .85rem .9rem;
  }
  .table td {
    border-color: rgba(255,255,255,.06);
    padding: .82rem .9rem;
    vertical-align: middle;
  }
  .table tbody tr:nth-child(even) { background: rgba(255,255,255,.015); }
  .table tbody tr { transition: background var(--tr-fast); }
  .table tbody tr:hover { background: rgba(79,140,255,.09); }

  .mono { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; }
  .dropzone { border: 2px dashed var(--bs-border-color); border-radius: .75rem; padding: .9rem; background: var(--bs-tertiary-bg); }
  .dropzone.dragover { border-color: var(--bs-primary); background: color-mix(in srgb, var(--bs-primary) 8%, white); }

  .panel-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  .panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

  /* Studio button/layout polish */
  .studio-actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
  .studio-actions .btn { min-height:40px; }
  .studio-editor-actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:flex-end; justify-content:flex-end; }
  .studio-editor-actions .btn { min-height:40px; }
  @media (max-width: 768px) {
    .studio-actions, .studio-editor-actions { flex-direction:column; align-items:stretch; }
    .studio-actions .btn, .studio-editor-actions .btn { width:100%; }
  }

  /* SaaS sidebar navigation */
  .app-shell { --sidebar-w: 252px; }

  .oc-nav {
    position: fixed;
    top: 24px;
    left: max(16px, calc((100vw - 1380px) / 2 + 16px));
    z-index: 20;
    width: var(--sidebar-w);
    max-height: calc(100vh - 48px);
    overflow: auto;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 14px;
    box-shadow: var(--shadow-sm);
  }
  .app-shell > .oc-nav::after {
    content: '';
    position: absolute;
    top: 0;
    right: -14px;
    width: 1px;
    height: 100%;
    background: linear-gradient(to bottom, transparent, rgba(255,255,255,.16), transparent);
    pointer-events: none;
  }
  .app-shell > .oc-nav ~ * {
    margin-left: calc(var(--sidebar-w) + 28px);
    min-width: 0;
  }
  .oc-nav-title {
    font-size: .96rem;
    font-weight: 650;
    letter-spacing: .01em;
    color: var(--text);
    padding: 4px 6px 10px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .oc-nav-links { display: grid; gap: 4px; }
  .oc-nav-group-label {
    margin: 8px 6px 2px;
    font-size: .66rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #7f8ca0;
    font-weight: 650;
  }
  .oc-nav .nav-link {
    color: var(--text-muted);
    border-radius: 10px;
    padding: .54rem .66rem;
    line-height: 1.25;
    transition: all var(--tr-fast);
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .oc-nav .nav-icon {
    width: 18px;
    height: 18px;
    color: #cfd8e6;
    opacity: .95;
    flex: 0 0 auto;
  }
  .oc-nav .nav-link.active .nav-icon {
    color: #eef4ff;
  }
  .oc-nav .nav-label { white-space: nowrap; }
  .oc-nav .nav-link:hover { color: var(--text); background: rgba(255,255,255,.045); }
  .oc-nav .nav-link.active {
    color: #f4f8ff;
    background: var(--accent-soft);
    border-color: rgba(79, 140, 255, .45);
  }
  .oc-nav-footer { margin-top: auto; display: grid; gap: 8px; }
  .oc-nav-footer .btn { width: 100%; justify-content: center; }
  .oc-nav-toggle,
  .oc-nav-backdrop,
  .oc-mobile-topbar,
  .oc-desktop-toggle { display: none; }

  @media (min-width: 1024px) {
    .app-shell { --sidebar-collapsed-w: 56px; }

    .oc-desktop-toggle {
      display: inline-flex;
      position: absolute;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      line-height: 1;
      font-size: .9rem;
      z-index: 2;
    }
    .oc-desktop-toggle:hover { color: var(--text); background: rgba(255,255,255,.06); }

    .app-shell.nav-collapsed > .oc-nav {
      width: var(--sidebar-collapsed-w);
      padding: 10px 8px;
      overflow: visible;
    }
    .app-shell.nav-collapsed > .oc-nav ~ * {
      margin-left: calc(var(--sidebar-collapsed-w) + 28px);
    }
    .app-shell.nav-collapsed .oc-nav-title,
    .app-shell.nav-collapsed .oc-nav-footer,
    .app-shell.nav-collapsed .oc-nav-group-label {
      display: none;
    }
    .app-shell.nav-collapsed .oc-nav-links {
      display: grid;
      gap: 8px;
      margin-top: 36px;
    }
    .app-shell.nav-collapsed .oc-nav .nav-link {
      justify-content: center;
      padding: .5rem 0;
      position: relative;
    }
    .app-shell.nav-collapsed .oc-nav .nav-link:hover::after {
      content: attr(title);
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      white-space: nowrap;
      background: #0f141d;
      color: #e8ecf3;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: .75rem;
      z-index: 30;
      box-shadow: var(--shadow-sm);
      pointer-events: none;
    }
    .app-shell.nav-collapsed .oc-nav .nav-label { display: none; }
    .app-shell.nav-collapsed .oc-nav .oc-nav-user { display: none; }
    .app-shell.nav-collapsed .oc-desktop-toggle {
      right: auto;
      left: 50%;
      transform: translateX(-50%);
      top: 8px;
    }
  }

  @media (max-width: 1023px) {
    .app-shell { padding: 0 12px; --mobile-topbar-h: 56px; }
    .app-shell > .oc-nav ~ * { margin-left: 0; }

    .oc-mobile-topbar {
      display: flex;
      position: sticky;
      top: 0;
      z-index: 1035;
      height: var(--mobile-topbar-h);
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      margin-bottom: 10px;
      background: color-mix(in srgb, var(--surface-elevated) 94%, black 6%);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-sm);
    }

    .oc-mobile-title {
      font-size: .95rem;
      font-weight: 620;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .oc-nav-toggle {
      display: inline-flex;
      width: 38px;
      height: 38px;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-elevated);
      color: var(--text);
      font-size: 1.05rem;
      line-height: 1;
      flex: 0 0 auto;
    }

    .oc-nav-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1040;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(1px);
    }

    .oc-nav {
      position: fixed;
      top: 0;
      left: 0;
      width: min(84vw, 320px);
      max-height: 100vh;
      height: 100vh;
      border-radius: 0 14px 14px 0;
      padding: 14px;
      z-index: 1050;
      transform: translateX(-108%);
      transition: transform var(--tr-fast);
      overflow: auto;
      margin: 0;
    }

    .app-shell.nav-open .oc-nav { transform: translateX(0); }
    .app-shell.nav-open .oc-nav-backdrop { display: block; }
    .oc-nav-links { grid-template-columns: 1fr; gap: 6px; }
  }
</style>
<script>
(function(){
  const COLLAPSE_KEY = 'oc.nav.desktop.collapsed';

  function setupNavDrawer(){
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    const desktop = !mobile;
    document.querySelectorAll('.app-shell').forEach((shell)=>{
      const nav = shell.querySelector(':scope > .oc-nav');
      if(!nav) return;

      let topbar = shell.querySelector(':scope > .oc-mobile-topbar');
      let toggle = shell.querySelector(':scope > .oc-nav-toggle');
      let backdrop = shell.querySelector(':scope > .oc-nav-backdrop');
      let deskToggle = nav.querySelector(':scope > .oc-desktop-toggle');

      if(!topbar){
        topbar = document.createElement('div');
        topbar.className = 'oc-mobile-topbar';
        shell.prepend(topbar);
      }

      if(!toggle){
        toggle = document.createElement('button');
        toggle.className = 'oc-nav-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label','Open navigation');
        toggle.textContent = '☰';
      }

      if(!topbar.querySelector('.oc-nav-toggle')) topbar.prepend(toggle);

      let title = topbar.querySelector('.oc-mobile-title');
      if(!title){
        title = document.createElement('div');
        title.className = 'oc-mobile-title';
        title.textContent = (nav.querySelector('.oc-nav-title')?.textContent || 'Navigation').trim();
        topbar.appendChild(title);
      }

      if(!backdrop){
        backdrop = document.createElement('button');
        backdrop.className = 'oc-nav-backdrop';
        backdrop.type = 'button';
        backdrop.setAttribute('aria-label','Close navigation');
        shell.prepend(backdrop);
      }

      if(!deskToggle){
        deskToggle = document.createElement('button');
        deskToggle.className = 'oc-desktop-toggle';
        deskToggle.type = 'button';
        deskToggle.setAttribute('aria-label','Collapse sidebar');
        deskToggle.textContent = '⟨';
        nav.appendChild(deskToggle);
      }


      const close = ()=>{ shell.classList.remove('nav-open'); document.body.classList.remove('nav-drawer-open'); };
      const open = ()=>{ if(!mobile) return; shell.classList.add('nav-open'); document.body.classList.add('nav-drawer-open'); };
      const toggleDrawer = ()=>{ if(shell.classList.contains('nav-open')) close(); else open(); };

      const applyCollapsed = (collapsed)=>{
        if(!desktop){
          shell.classList.remove('nav-collapsed');
          deskToggle.textContent = '⟨';
          deskToggle.setAttribute('aria-label','Collapse sidebar');
          return;
        }
        const isCollapsed = !!collapsed;
        shell.classList.toggle('nav-collapsed', isCollapsed);
        deskToggle.textContent = isCollapsed ? '⟩' : '⟨';
        deskToggle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
      };

      const persisted = localStorage.getItem(COLLAPSE_KEY) === '1';
      applyCollapsed(persisted);

      if(!toggle.dataset.bound){
        toggle.addEventListener('click', toggleDrawer);
        backdrop.addEventListener('click', close);
        nav.querySelectorAll('a').forEach((a)=>a.addEventListener('click', close));

        deskToggle.addEventListener('click', ()=>{
          const nextCollapsed = !shell.classList.contains('nav-collapsed');
          localStorage.setItem(COLLAPSE_KEY, nextCollapsed ? '1' : '0');
          applyCollapsed(nextCollapsed);
        });

        toggle.dataset.bound = '1';
      }

      if(!mobile) close();
    });
  }

  function refreshLucide(){
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  window.addEventListener('resize', () => { setupNavDrawer(); refreshLucide(); });
  window.addEventListener('DOMContentLoaded', () => { setupNavDrawer(); refreshLucide(); });
})();
</script>`;
}

function adminNav(active = '') {
  const is = (k) => active === k ? 'active' : '';
  return `<nav class="oc-nav" aria-label="Admin navigation">
    <a class="oc-nav-title" href="/admin">Sentinel Admin</a>
    <div class="oc-nav-links">
      <a class="nav-link ${is('panel')}" href="/admin" title="Panel"><i data-lucide="compass" class="nav-icon"></i><span class="nav-label">Panel</span></a>
      <a class="nav-link ${is('upload')}" href="/admin/upload" title="Upload"><i data-lucide="upload" class="nav-icon"></i><span class="nav-label">Upload</span></a>
      <a class="nav-link ${is('dashboard')}" href="/dashboard/" title="Dashboard"><i data-lucide="layout-dashboard" class="nav-icon"></i><span class="nav-label">Dashboard</span></a>
      <a class="nav-link ${is('buyers')}" href="/dashboard/buyers" title="Buyers"><i data-lucide="building-2" class="nav-icon"></i><span class="nav-label">Buyers</span></a>
      <a class="nav-link ${is('initiatives')}" href="/dashboard/initiatives" title="Initiatives"><i data-lucide="puzzle" class="nav-icon"></i><span class="nav-label">Initiatives</span></a>
      <a class="nav-link ${is('activity')}" href="/dashboard/activity" title="Activity"><i data-lucide="activity" class="nav-icon"></i><span class="nav-label">Activity</span></a>
      <a class="nav-link ${is('review')}" href="/dashboard/review" title="Review"><i data-lucide="file-text" class="nav-icon"></i><span class="nav-label">Review</span></a>
      <a class="nav-link ${is('board')}" href="/dashboard/board" title="Board"><i data-lucide="kanban-square" class="nav-icon"></i><span class="nav-label">Board</span></a>
      <a class="nav-link ${is('uos')}" href="/dashboard/uos" title="UOS"><i data-lucide="book-open" class="nav-icon"></i><span class="nav-label">UOS</span></a>
      <a class="nav-link ${is('capital-map')}" href="/dashboard/capital-map" title="Capital Map"><i data-lucide="network" class="nav-icon"></i><span class="nav-label">Capital Map</span></a>
      <a class="nav-link ${is('platform-pressure')}" href="/dashboard/platform-pressure" title="Platforms"><i data-lucide="radar" class="nav-icon"></i><span class="nav-label">Platforms</span></a>
    </div>
    <form method="post" action="/admin/logout" class="oc-nav-footer m-0">
      <button class="btn btn-sm btn-outline-secondary logout-btn" type="submit">Logout</button>
    </form>
  </nav>`;
}

function dashboardNav(active = '') {
  const is = (k) => active === k ? 'active' : '';
  return `<nav class="oc-nav" aria-label="Dashboard navigation">
    <a class="oc-nav-title" href="/dashboard/">UOS Dashboard</a>
    <div class="oc-nav-links">
      <div class="oc-nav-group-label">Market Intelligence</div>
      <a class="nav-link ${is('signals')}" href="/dashboard/signals" title="Signals"><i data-lucide="radio" class="nav-icon"></i><span class="nav-label">Signals</span></a>
      <a class="nav-link ${is('platform-pressure')}" href="/dashboard/platform-pressure" title="Platforms"><i data-lucide="radar" class="nav-icon"></i><span class="nav-label">Platforms</span></a>
      <a class="nav-link ${is('beacons')}" href="/dashboard/beacons" title="Beacons"><i data-lucide="satellite" class="nav-icon"></i><span class="nav-label">Beacons</span></a>

      <div class="oc-nav-group-label">Origination</div>
      <a class="nav-link ${is('buyers')}" href="/dashboard/buyers" title="Buyers"><i data-lucide="building-2" class="nav-icon"></i><span class="nav-label">Buyers</span></a>
      <a class="nav-link ${is('initiatives')}" href="/dashboard/initiatives" title="Initiatives"><i data-lucide="puzzle" class="nav-icon"></i><span class="nav-label">Initiatives</span></a>
      <a class="nav-link ${is('capital-map')}" href="/dashboard/capital-map" title="Capital Map"><i data-lucide="network" class="nav-icon"></i><span class="nav-label">Capital Map</span></a>

      <div class="oc-nav-group-label">Control</div>
      <a class="nav-link ${is('home')}" href="/dashboard/" title="Dashboard"><i data-lucide="home" class="nav-icon"></i><span class="nav-label">Dashboard</span></a>
      <a class="nav-link ${is('activity')}" href="/dashboard/activity" title="Activity"><i data-lucide="activity" class="nav-icon"></i><span class="nav-label">Activity</span></a>
      <a class="nav-link ${is('review')}" href="/dashboard/review" title="Review"><i data-lucide="file-text" class="nav-icon"></i><span class="nav-label">Review</span></a>
      <a class="nav-link ${is('board')}" href="/dashboard/board" title="Board"><i data-lucide="kanban-square" class="nav-icon"></i><span class="nav-label">Board</span></a>

      <div class="oc-nav-group-label">Production</div>
      <a class="nav-link ${is('studio')}" href="/dashboard/presentation-studio" title="Presentation Studio"><i data-lucide="presentation" class="nav-icon"></i><span class="nav-label">Presentation Studio</span></a>

      <div class="oc-nav-group-label">Ops</div>
      <a class="nav-link ${is('uos')}" href="/dashboard/uos" title="UOS"><i data-lucide="book-open" class="nav-icon"></i><span class="nav-label">UOS</span></a>
      <a class="nav-link ${is('team')}" href="/dashboard/team" title="Team"><i data-lucide="users" class="nav-icon"></i><span class="nav-label">Team</span></a>
    </div>
    <div class="oc-nav-footer">
      <a class="btn btn-sm btn-outline-secondary team-btn" href="/board">Team Board</a>
    </div>
  </nav>`;
}

function pageHeader(title, actions = '', meta = '') {
  return `<div class="panel-header">
    <div>
      <h1 class="page-title">${title}</h1>
      ${meta ? `<div class="small text-muted mt-1">${meta}</div>` : ''}
    </div>
    ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
  </div>`;
}

function statCard(label, value, meta = '') {
  return `<div class="card metric-card"><div class="card-body d-flex flex-column justify-content-between">
    <div class="metric-label">${label}</div>
    <div class="metric-value">${value}</div>
    ${meta ? `<div class="small text-muted mono">${meta}</div>` : ''}
  </div></div>`;
}

function tableShell(headers, rows, emptyRow = '', colspan = headers.length) {
  const content = rows.length ? rows.join('') : `<tr><td colspan="${colspan}" class="text-muted">${emptyRow || 'No rows'}</td></tr>`;
  return `<div class="card"><div class="table-responsive"><table class="table table-sm align-middle">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${content}</tbody>
  </table></div></div>`;
}

async function ensureDirs() {
  const dirs = [
    INBOX_ROOT,
    CURRENT_ROOT,
    ARCHIVE_ROOT,
    path.dirname(DASHBOARD_STATE_FILE),
    DASHBOARD_SNAPSHOTS,
    ADMIN_LOG_ROOT,
    TEAM_AUTH_ROOT,
    BOARD_ROOT,
    BOARD_HISTORY_ROOT,
    ACTIVITY_ROOT,
    REVIEW_PACKET_ROOT,
    UOS_PENDING_ROOT
  ];
  await Promise.all(dirs.map((d) => fs.mkdir(d, { recursive: true })));
}

function nowIso() {
  return new Date().toISOString();
}

function dateOnly() {
  return nowIso().slice(0, 10);
}

function tsForPath() {
  return nowIso().replace(/[:.]/g, '-');
}

function safeName(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ext(name) {
  return path.extname(name || '').toLowerCase();
}

function base(name) {
  return path.basename(name || '', path.extname(name || ''));
}

function currentUser(req) {
  return req.session?.user || null;
}

function requireAdminAuth(req, res, next) {
  const u = currentUser(req);
  if (u?.scope === 'admin') return next();
  return res.redirect('/admin/login');
}

function requireTeamAuth(req, res, next) {
  const u = currentUser(req);
  if (u?.scope === 'team') return next();
  return res.redirect('/auth/login');
}

function requireAnyAuth(req, res, next) {
  const u = currentUser(req);
  if (u) return next();
  return res.redirect('/auth/login');
}

function normalizedRole(role) {
  if (role === 'admin') return 'architect';
  if (role === 'viewer') return 'observer';
  return role;
}

function effectiveRole(req) {
  const u = currentUser(req);
  if (!u) return null;
  if (u.scope === 'admin') return 'architect';
  return normalizedRole(u.role);
}

function isArchitect(req) {
  const u = currentUser(req);
  if (!u) return false;
  if (u.scope === 'admin') return true;
  return normalizedRole(u.role) === 'architect' || String(u.username || '').toLowerCase() === ARCHITECT_USERNAME;
}

function requireRole(...roles) {
  return (req, res, next) => {
    const r = effectiveRole(req);
    if (!r || !roles.includes(r)) {
      appendAuditEvent({
        ts: nowIso(),
        actor: getUserLabel(req),
        role: r || 'anonymous',
        event_type: 'permission.denied',
        entity_type: 'route',
        entity_id: req.originalUrl,
        meta: { required_roles: roles }
      }).catch(() => {});
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
}

const loginAttempts = new Map(); // ip -> { count, firstTs }
const MAX_LOGIN_ATTEMPTS = 7;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function loginRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const row = loginAttempts.get(ip);

  if (!row) {
    loginAttempts.set(ip, { count: 1, firstTs: now });
    return next();
  }

  if (now - row.firstTs > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstTs: now });
    return next();
  }

  if (row.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).send('Too many login attempts. Try again later.');
  }

  row.count += 1;
  loginAttempts.set(ip, row);
  return next();
}

function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    name: 'uos_admin_session',
    secret: ADMIN_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: ADMIN_COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use('/dashboard', requireAnyAuth);
app.use('/dashboard', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }
  return next();
});

app.get(['/dashboard', '/dashboard/'], async (_req, res) => {
  const state = await readJson(DASHBOARD_STATE_FILE, {});
  const liveBoard = await readJson(BOARD_FILE, defaultBoard());
  const boardCounts = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, (liveBoard.tasks || []).filter((t) => t.status === c).length]));
  const packets = await listReviewPackets(300);
  const pendingRps = packets.filter((rp) => String(rp.status || '').toLowerCase() === 'ready for review').length;
  const recent = await readActivityEvents({ limit: 200 });
  const latestUosPublish = (recent.find((e) => String(e.event_type || '') === 'uos.publish')?.ts) || 'N/A';
  const lastUpdatedLive = recent[0]?.ts || state.lastUpdated || 'N/A';

  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Dashboard')}</head><body>
  <div class="app-shell">
    ${dashboardNav('home')}
    ${pageHeader('Operations Dashboard', '', 'Mission Control overview')}

    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6 col-xl-3">${statCard('Active Tasks', Object.values(boardCounts).reduce((a,b)=>a+Number(b||0),0))}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Pending Review Packets', pendingRps)}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Latest UOS Publish', '-', escapeHtml(latestUosPublish))}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Last Updated', '-', escapeHtml(lastUpdatedLive))}</div>
    </div>

    ${tableShell(
      ['Time', 'Actor', 'Event', 'Entity'],
      recent.map(e => `<tr><td class="mono small">${escapeHtml(e.ts || '')}</td><td>${escapeHtml(e.actor || '')}</td><td>${escapeHtml(e.event_type || '')}</td><td>${escapeHtml((e.entity_type || '') + ':' + (e.entity_id || ''))}</td></tr>`),
      'No activity yet'
    )}
  </div>
</body></html>`);
});

app.get('/capital-map', requireAnyAuth, async (req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect('/dashboard/capital-map' + qs);
});

app.get('/dashboard/capital-map', requireAnyAuth, async (_req, res) => {
  res.type('html').send(`<!doctype html><html><head>${uiHead('Capital Systems Map')}</head><body>
  <div class="app-shell">
    ${dashboardNav('capital-map')}
    ${pageHeader('Capital Systems Map')}
    <div class="card mb-3"><div class="card-body py-2">
      <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
        <button id="reset-map" class="btn btn-sm btn-outline-secondary" type="button">Reset Map</button>
        <button id="center-graph" class="btn btn-sm btn-outline-secondary" type="button">Center Graph</button>
        <button id="highlight-path" class="btn btn-sm btn-outline-secondary" type="button">Highlight Capital Path</button>
        <button id="toggle-labels" class="btn btn-sm btn-outline-secondary" type="button">Toggle Labels</button>
        <button id="organize-viewport" class="btn btn-sm btn-outline-secondary" type="button">Organize View</button>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
        <span class="small text-muted">Focus Mode</span>
        <div class="btn-group btn-group-sm" role="group" aria-label="Focus Mode">
          <input type="radio" class="btn-check" name="focus-mode" id="mode-buyer" value="buyer" checked>
          <label class="btn btn-outline-secondary" for="mode-buyer">Buyer</label>
          <input type="radio" class="btn-check" name="focus-mode" id="mode-initiative" value="initiative">
          <label class="btn btn-outline-secondary" for="mode-initiative">Initiative</label>
          <input type="radio" class="btn-check" name="focus-mode" id="mode-signal" value="signal">
          <label class="btn btn-outline-secondary" for="mode-signal">Signal</label>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-12 col-md-3"><select id="filter-buyer" class="form-select form-select-sm"><option value="">Buyer (All)</option></select></div>
        <div class="col-12 col-md-3"><select id="filter-signal" class="form-select form-select-sm"><option value="">Signal (All)</option></select></div>
        <div class="col-12 col-md-3"><select id="filter-initiative" class="form-select form-select-sm"><option value="">Initiative (All)</option></select></div>
        <div class="col-12 col-md-3"><select id="filter-pressure" class="form-select form-select-sm"><option value="">Pressure Layer (All)</option></select></div>
      </div>
    </div></div>
    <div class="row g-3">
      <div class="col-12 col-lg-9">
        <div class="card"><div class="card-body p-2">
          <div id="capital-map" style="height:calc(100vh - 190px); min-height:520px;"></div>
        </div></div>
      </div>
      <div class="col-12 col-lg-3">
        <div class="card h-100"><div class="card-body">
          <h6 class="mb-2">Node Details</h6>
          <div id="node-details" class="small text-muted">Select a node to inspect.</div>
        </div></div>
      </div>
    </div>
  </div>
  <script src="/dashboard/js/capital-map.js"></script>
</body></html>`);
});

app.get('/platform-pressure', requireAnyAuth, async (req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect('/dashboard/platform-pressure' + qs);
});

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function computePpi(scores = {}) {
  return clampScore(scores.capitalReality) + clampScore(scores.fidDefinability) + clampScore(scores.multiActorDependency) + clampScore(scores.structuralAmbiguity) + clampScore(scores.mandateFeasibility);
}

function derivePlatformPressureStatus(ppi = 0) {
  const n = Number(ppi) || 0;
  if (n <= 8) return 'Noise';
  if (n <= 14) return 'Early Pressure';
  if (n <= 19) return 'Platform Formation';
  return 'Mandate Proximate';
}

const PLATFORM_PRESSURE_WEIGHTS = {
  capitalReality: 0.3,
  fidDefinability: 0.2,
  multiActorDependency: 0.2,
  structuralAmbiguity: 0.2,
  mandateFeasibility: 0.1,
};

function normalizePlatformPressureRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const scores = {
      capitalReality: clampScore(row?.scores?.capitalReality),
      fidDefinability: clampScore(row?.scores?.fidDefinability),
      multiActorDependency: clampScore(row?.scores?.multiActorDependency),
      structuralAmbiguity: clampScore(row?.scores?.structuralAmbiguity),
      mandateFeasibility: clampScore(row?.scores?.mandateFeasibility),
    };
    const ppi = Number(row?.ppi ?? computePpi(scores));
    const weightedPpi = Number((
      (scores.capitalReality * PLATFORM_PRESSURE_WEIGHTS.capitalReality) +
      (scores.fidDefinability * PLATFORM_PRESSURE_WEIGHTS.fidDefinability) +
      (scores.multiActorDependency * PLATFORM_PRESSURE_WEIGHTS.multiActorDependency) +
      (scores.structuralAmbiguity * PLATFORM_PRESSURE_WEIGHTS.structuralAmbiguity) +
      (scores.mandateFeasibility * PLATFORM_PRESSURE_WEIGHTS.mandateFeasibility)
    ).toFixed(2));
    return {
      ...row,
      scores,
      ppi,
      weightedPpi,
      status: derivePlatformPressureStatus(ppi),
      actors: Array.isArray(row?.actors) ? row.actors : [],
      signals: Array.isArray(row?.signals) ? row.signals : [],
      linkRefs: row?.linkRefs && typeof row.linkRefs === 'object' ? row.linkRefs : { buyerIds: [], initiativeIds: [], signalIds: [] },
      delta30d: Number(row?.delta30d || 0),
      delta90d: Number(row?.delta90d || 0),
      lastUpdated: String(row?.lastUpdated || ''),
      region: String(row?.region || row?.theater || 'Unspecified'),
    };
  });
}

function normalizeRefToken(v) {
  return String(v || '').trim().toUpperCase();
}

function resolvePlatformPressureRefs(rows = [], { buyers = [], initiatives = [], signals = [] } = {}) {
  const buyerMap = new Map((Array.isArray(buyers) ? buyers : []).map((b) => [normalizeRefToken(b?.buyer_id), b]));
  const initiativeMap = new Map((Array.isArray(initiatives) ? initiatives : []).map((i) => [normalizeRefToken(i?.initiative_id), i]));
  const signalMap = new Map((Array.isArray(signals) ? signals : []).map((s) => [normalizeRefToken(s?.signal_id), s]));

  const isCanonicalRef = (id) => String(id || '').trim().length > 0 && !String(id).includes('::');

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const refs = row?.linkRefs || {};
    const buyerIds = Array.isArray(refs.buyerIds) ? refs.buyerIds : [];
    const initiativeIds = Array.isArray(refs.initiativeIds) ? refs.initiativeIds : [];
    const signalIds = Array.isArray(refs.signalIds) ? refs.signalIds : [];

    const resolvedBuyers = buyerIds
      .map((id) => ({ id: String(id || ''), entity: isCanonicalRef(id) ? (buyerMap.get(normalizeRefToken(id)) || null) : null }))
      .filter((x) => x.id);
    const resolvedInitiatives = initiativeIds
      .map((id) => ({ id: String(id || ''), entity: isCanonicalRef(id) ? (initiativeMap.get(normalizeRefToken(id)) || null) : null }))
      .filter((x) => x.id);
    const resolvedSignals = signalIds
      .map((id) => ({ id: String(id || ''), entity: isCanonicalRef(id) ? (signalMap.get(normalizeRefToken(id)) || null) : null }))
      .filter((x) => x.id);

    const linkedSignalHydrated = resolvedSignals
      .filter((x) => x.entity)
      .map((x) => ({
        id: x.entity.signal_id,
        date: String(x.entity.observed_at || '').slice(0, 10),
        type: x.entity.signal_class || 'signal',
        title: x.entity.title || x.id,
        summary: x.entity.summary || 'Linked dashboard signal.',
        sourceCategory: 'dashboard_signals',
        impact: x.entity.status === 'Actioned' ? 'positive' : (x.entity.status === 'Verified' ? 'neutral' : 'neutral'),
        confidence: x.entity.confidence || 'medium'
      }));

    const baseSignals = Array.isArray(row?.signals) ? row.signals : [];
    const mergedSignals = [...linkedSignalHydrated, ...baseSignals].filter(Boolean);
    const seen = new Set();
    const dedupedSignals = mergedSignals.filter((s) => {
      const key = `${String(s.id || '')}::${String(s.date || '')}::${String(s.title || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ...row,
      linkRefs: {
        buyerIds,
        initiativeIds,
        signalIds,
        resolved: {
          buyers: resolvedBuyers.map((x) => ({ id: x.id, found: Boolean(x.entity), name: x.entity?.name || null })),
          initiatives: resolvedInitiatives.map((x) => ({ id: x.id, found: Boolean(x.entity), name: x.entity?.name || null })),
          signals: resolvedSignals.map((x) => ({ id: x.id, found: Boolean(x.entity), title: x.entity?.title || null }))
        }
      },
      signals: dedupedSignals,
    };
  });
}

app.get('/dashboard/platform-pressure', requireAnyAuth, async (_req, res) => {
  const sourceRows = await readJson(DASHBOARD_PLATFORM_PRESSURE_FILE, []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const signalPhysics = await readJson(path.join(ROOT, 'dashboard/data/signal_physics_snapshot.json'), { initiatives: [], ontologyLayers: [] });
  const rows = resolvePlatformPressureRefs(normalizePlatformPressureRows(sourceRows), { buyers, initiatives, signals });
  const payload = JSON.stringify({ rows, weights: PLATFORM_PRESSURE_WEIGHTS, signalPhysics }).replace(/</g, '\\u003c');

  res.type('html').send(`<!doctype html><html><head>${uiHead('Platform Pressure')}
  <style>
    .pp-table thead th { font-size:.69rem; }
    .pp-table td { padding:.52rem .58rem; }
    .pp-table tbody tr { border-left: 2px solid transparent; }
    .pp-table tbody tr:hover { border-left-color: rgba(79,140,255,.5); }
    .pp-sector { font-weight: 620; letter-spacing:-.01em; }
    .pp-sub { color: var(--text-muted); font-size:.75rem; }
    .pp-ppi { font-weight:700; font-size:.93rem; padding:.2rem .48rem; border:1px solid rgba(79,140,255,.35); border-radius:999px; color:#dbe8ff; background:rgba(79,140,255,.15); }
    .pp-status,.pp-rel { font-size:.72rem; padding:.18rem .42rem; border-radius:999px; border:1px solid var(--border); color:#d7deeb; background:rgba(255,255,255,.03); }
    .pp-kicker { color: var(--text-muted); font-size:.72rem; text-transform: uppercase; letter-spacing:.06em; }
    .pp-signal-row { border:1px solid var(--border); border-radius:10px; padding:.55rem .65rem; background:rgba(255,255,255,.02); }
    .pp-empty { border:1px dashed var(--border); border-radius:12px; padding:18px; color:var(--text-muted); text-align:center; }
    .pp-heat-row { border-bottom:1px solid rgba(255,255,255,.06); padding:.45rem 0; }
    .pp-heat-row:last-child { border-bottom:0; }
    .pp-legend { font-size:.74rem; color:var(--text-muted); }
    .lem-heat { display:grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap:6px; width:100%; }
    .lem-cell { width:100%; aspect-ratio:1/1; border-radius: 6px; border: 1px solid rgba(255,255,255,.08); padding:0; touch-action: manipulation; -webkit-tap-highlight-color: rgba(79,140,255,.25); color:#dbe6ff; font-size:.62rem; line-height:1; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .lem-cell.off { background: rgba(255,255,255,.05); color:#9da8ba; }
    .lem-cell.on { background: linear-gradient(180deg, #5f97ff 0%, #376fe0 100%); }
    .lem-legend-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:6px; }
    .lem-tooltip { border:1px solid var(--border); border-radius:8px; padding:6px 8px; background:rgba(255,255,255,.02); min-height:40px; }
    @media (max-width: 1100px){ .lem-heat { grid-template-columns: repeat(8, minmax(0,1fr)); } }
    .lem-strip { display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; }
    .lem-strip .tile { border:1px solid var(--border); border-radius:10px; padding:8px; background:rgba(255,255,255,.02); }
    .lem-row { border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,.015); overflow:hidden; }
    .lem-row-head { padding:10px; display:flex; justify-content:space-between; align-items:flex-start; gap:8px; cursor:pointer; }
    .lem-row-body { padding:0 10px 10px; }
    .lem-layer-tag { font-size:.68rem; border:1px solid var(--border); padding:.12rem .35rem; border-radius:999px; color:#dbe2ee; background:rgba(255,255,255,.03); }
    .lem-phase-bar { height:8px; border-radius:999px; background:rgba(255,255,255,.06); overflow:hidden; }
    .lem-phase-fill { height:100%; background:linear-gradient(90deg,#3d7cff,#63a0ff); }
    @media (max-width: 1360px){ .pp-wide-col{ display:none; } }
    @media (max-width: 1050px){ .pp-hide-md{ display:none; } }
    @media (max-width: 980px){ .pp-table td,.pp-table th{ padding:.48rem .4rem; } }
  </style>
  </head><body><div class="app-shell">
    ${dashboardNav('platform-pressure')}
    ${pageHeader('Platform Pressure', '', 'Internal operating radar for pre-obvious infrastructure platform formation')}

    <div id="pp-js-errors" class="card mb-3" style="display:none;border-color:#8b2d2d">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-center">
          <strong style="color:#ffb4b4">Temporary JS Error Logger</strong>
          <div>
            <button class="btn btn-sm btn-outline-secondary" onclick="window.__ppShowErrors && window.__ppShowErrors()">Show Errors</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="localStorage.removeItem('pp_error_log_v1'); window.__ppShowErrors && window.__ppShowErrors()">Clear</button>
          </div>
        </div>
        <pre id="pp-js-errors-pre" class="small mb-0 mt-2" style="white-space:pre-wrap;max-height:180px;overflow:auto"></pre>
      </div>
    </div>

    <div id="pp-summary" class="row g-2 mb-3"></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">USG Opportunity Window</h6>
        <span class="pp-legend">Decision-and-motion view</span>
      </div>
      <div id="pp-usg-window" class="small"></div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Platform Signal Map</h6>
        <span class="pp-legend" id="lem-generated-at">No snapshot loaded</span>
      </div>
      <div class="pp-legend mb-2">Signals across the infrastructure lifecycle</div>
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="pp-legend">Lifecycle stages (click to filter) · Blue = active signals · Gray = missing stage</span>
        <button id="lem-legend-toggle" type="button" class="btn btn-sm btn-outline-secondary py-0 px-2">Show Stage Legend</button>
      </div>
      <div id="lem-legend" class="small d-none mb-2"></div>
      <div id="lem-panel" class="vstack gap-2 small"></div>
    </div></div>

    <div class="card mb-3"><div class="card-body py-2">
      <div class="row g-2 align-items-center">
        <div class="col-12 col-md-2"><select id="f-sector" class="form-select form-select-sm"><option value="">Sector (All)</option></select></div>
        <div class="col-12 col-md-2"><select id="f-region" class="form-select form-select-sm"><option value="">Region (All)</option></select></div>
        <div class="col-12 col-md-2"><select id="f-status" class="form-select form-select-sm"><option value="">Status (All)</option><option>Noise</option><option>Early Pressure</option><option>Platform Formation</option><option>Mandate Proximate</option></select></div>
        <div class="col-12 col-md-2"><select id="f-buyer" class="form-select form-select-sm"><option value="">Buyer Class (All)</option></select></div>
        <div class="col-12 col-md-2"><select id="f-fid" class="form-select form-select-sm"><option value="">FID Boundary (All)</option></select></div>
        <div class="col-6 col-md-1"><input id="f-min-ppi" type="number" class="form-control form-control-sm" min="0" max="25" value="0" placeholder="Min PPI"/></div>
        <div class="col-6 col-md-1"><button id="f-reset" class="btn btn-sm btn-outline-secondary w-100">Reset</button></div>
      </div>
      <div class="row g-2 mt-1"><div class="col-12"><input id="f-search" class="form-control form-control-sm" placeholder="Search sector, notes, actors, bottlenecks"/></div></div>
      <div id="pp-active-filter" class="pp-legend mt-2"></div>
    </div></div>

    <div class="card mb-3"><div class="table-responsive"><table class="table table-sm align-middle pp-table">
      <thead><tr>
        <th><button data-sort="sector" class="btn btn-sm btn-ghost p-0">Sector</button></th>
        <th><button data-sort="region" class="btn btn-sm btn-ghost p-0">Region</button></th>
        <th><button data-sort="ppi" class="btn btn-sm btn-ghost p-0">PPI</button></th>
        <th>Status</th>
        <th class="pp-hide-md">Buyer Path</th>
        <th class="pp-hide-md">USG Relevance</th>
        <th><button data-sort="delta90d" class="btn btn-sm btn-ghost p-0">90D Δ</button></th>
        <th>Buyer Class</th>
        <th class="pp-wide-col">Next Intelligence Action</th>
        <th><button data-sort="lastUpdated" class="btn btn-sm btn-ghost p-0">Updated</button></th>
      </tr></thead>
      <tbody id="pp-table"></tbody>
    </table></div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2"><h6 class="mb-0">Top mandate-proximate sectors by buyer class</h6><span class="pp-legend">PPI ≥ 20 or (PPI ≥ 15 and 90D Δ ≥ +4)</span></div>
      <div id="pp-top-by-buyer" class="small"></div>
    </div></div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xl-6"><div class="card h-100"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2"><h6 class="mb-0">Buyer Class Heatmap</h6><span class="pp-legend">Where buyer classes are clustering now</span></div>
        <div id="pp-heatmap" class="small"></div>
      </div></div></div>
      <div class="col-12 col-xl-6"><div class="card h-100"><div class="card-body">
        <h6 class="mb-2">Mandate-Proximate Watchlist</h6>
        <div id="pp-watchlist" class="small"></div>
      </div></div></div>
    </div>

    <div class="offcanvas offcanvas-end" tabindex="-1" id="pp-drawer" style="width:min(740px,98vw)">
      <div class="offcanvas-header"><h5 class="offcanvas-title">Platform Detail</h5><button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas"></button></div>
      <div class="offcanvas-body" id="pp-drawer-body"></div>
    </div>
  </div>

  <script>
    (function installTempErrorLogger(){
      try {
        const key = 'pp_error_log_v1';
        const push = (entry) => {
          try {
            const logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs.push({ t: new Date().toISOString(), ...entry });
            localStorage.setItem(key, JSON.stringify(logs.slice(-30)));
          } catch {}
        };
        window.addEventListener('error', (e) => {
          push({ type:'error', message: e.message, source: e.filename, line: e.lineno, col: e.colno });
          const box = document.getElementById('pp-js-errors');
          if (box) box.style.display = 'block';
        });
        window.addEventListener('unhandledrejection', (e) => {
          push({ type:'unhandledrejection', message: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || 'unknown') });
          const box = document.getElementById('pp-js-errors');
          if (box) box.style.display = 'block';
        });
        window.__ppShowErrors = function(){
          const logs = JSON.parse(localStorage.getItem(key) || '[]');
          const pre = document.getElementById('pp-js-errors-pre');
          const box = document.getElementById('pp-js-errors');
          if (pre) pre.textContent = logs.map(x => '[' + x.t + '] ' + x.type + ': ' + (x.message || '') + (x.source ? (' @ ' + x.source + ':' + (x.line||0) + ':' + (x.col||0)) : '')).join('\\n') || '(no browser errors captured)';
          if (box) box.style.display = 'block';
          return logs;
        };
      } catch {}
    })();

    const platformData = ${payload};
    let rows = [...platformData.rows];
    const signalPhysics = platformData.signalPhysics || { initiatives: [], ontologyLayers: [] };
    const physicsByInitiative = new Map((signalPhysics.initiatives || []).map((x) => [String(x.initiative_id || ''), x]));
    const ontologyOrder = (signalPhysics.ontologyLayers || []).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    const els = {
      table: document.getElementById('pp-table'), summary: document.getElementById('pp-summary'), usgWindow: document.getElementById('pp-usg-window'), heatmap: document.getElementById('pp-heatmap'), topByBuyer: document.getElementById('pp-top-by-buyer'),
      watchlist: document.getElementById('pp-watchlist'), filterLabel: document.getElementById('pp-active-filter'), lemPanel: document.getElementById('lem-panel'), lemGeneratedAt: document.getElementById('lem-generated-at'), lemLegend: document.getElementById('lem-legend'), lemLegendToggle: document.getElementById('lem-legend-toggle'),
      fSector: document.getElementById('f-sector'), fRegion: document.getElementById('f-region'), fStatus: document.getElementById('f-status'), fBuyer: document.getElementById('f-buyer'),
      fFid: document.getElementById('f-fid'), fMinPpi: document.getElementById('f-min-ppi'), fSearch: document.getElementById('f-search')
    };
    const drawer = window.bootstrap ? new bootstrap.Offcanvas(document.getElementById('pp-drawer')) : null;
    const drawerBody = document.getElementById('pp-drawer-body');
    const state = {
      sortBy: 'ppi',
      sortDir: 'desc',
      ontologyLayer: '',
      missingLayer: '',
      buyerFocus: '',
      phaseFocus: '',
      stuckReason: ''
    };
    const focusClasses = ['Sovereign Wealth Fund','DFI / MDB','Hyperscaler / Tech Platform','Strategic Industrial Sponsor'];
    const relevanceOrder = ['Observe','Track','Engage Soon','Mandate Window'];
    const sectorInitiativeAlias = {
      'INIT_SECTOR::PPS-AI-INFRASTRUCTURE': 'INIT-AI-OPT-B',
      'INIT_SECTOR::PPS-MANGANESE': 'INIT-2026-03-05-COMMODITY-CORRIDOR',
      'INIT_SECTOR::PPS-COPPER': 'INIT-653305',
      'INIT_SECTOR::PPS-BATTERY-MATERIALS': 'INIT-653305',
      'INIT_SECTOR::PPS-INDUSTRIAL-POWER-CORRIDORS': 'INIT-001',
      'INIT_SECTOR::PPS-LOGISTICS-CORRIDORS': 'INIT-2026-03-05-COMMODITY-CORRIDOR',
      'INIT_SECTOR::PPS-DIGITAL-FINANCIAL-RAILS': 'INIT-NG-FIN-ENERGY-SPINE',
      'INIT_SECTOR::PPS-WATER-INFRASTRUCTURE': 'INIT-653305',
      'INIT_SECTOR::PPS-FOOD-SECURITY-INFRASTRUCTURE': 'INIT-653305',
      'INIT_SECTOR::PPS-INDUSTRIAL-ZONES': 'INIT-AI-OPT-D'
    };

    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const delta = (n) => { const v = Number(n||0); if(v>0) return '<span class="badge text-bg-success">+'+v+'</span>'; if(v<0) return '<span class="badge text-bg-secondary">'+v+'</span>'; return '<span class="badge text-bg-dark">0</span>'; };
    const nextRel = (r) => relevanceOrder[Math.min(relevanceOrder.length-1, relevanceOrder.indexOf(r.usgRelevance || 'Track') + 1)] || 'Track';
    const layerMeta = {
      demand: { name:'Demand', desc:'AI/energy/industrial demand growth and pressure signals.', phase:'Early' },
      narrative_legitimacy: { name:'Narrative / Legitimacy', desc:'Policy narratives, strategic framing, and national programs.', phase:'Early' },
      data_intelligence: { name:'Data / Intelligence', desc:'Studies, forecasts, research, and analytical justification.', phase:'Early' },
      governance: { name:'Governance', desc:'Regulatory frameworks, PPP laws, ministries, cross-border agreements.', phase:'Early/Mid' },
      capital_allocation: { name:'Capital Allocation', desc:'SWF/DFI mandates, facilities, and deployment posture.', phase:'Mid' },
      resource: { name:'Resource', desc:'Land, concessions, feedstock, minerals, and input rights.', phase:'Mid' },
      platform_architecture: { name:'Platform Architecture', desc:'Corridor/cluster/system design and sequencing.', phase:'Mid' },
      financial_structuring: { name:'Financial Structuring', desc:'SPVs, blended finance, capital stack, project finance.', phase:'Mid' },
      connectivity: { name:'Connectivity', desc:'Fiber, ports, rail, logistics corridors, integration links.', phase:'Mid' },
      energy: { name:'Energy', desc:'Generation, grid, PPAs, fuel security, power reliability.', phase:'Mid' },
      compute_digital: { name:'Compute / Digital', desc:'Data centers, AI compute, cloud, telecom digital layer.', phase:'Mid' },
      industrial_production: { name:'Industrial Production', desc:'Factories, processing plants, industrial manufacturing.', phase:'Late' },
      construction: { name:'Construction', desc:'EPC awards, groundbreaking, engineering mobilization.', phase:'Late' },
      operator: { name:'Operator', desc:'Operators, lessees, utility/asset operations activation.', phase:'Late' },
      market_access: { name:'Market Access', desc:'Offtake, export agreements, and customer commitments.', phase:'Late' }
    };
    const layerLabel = (id) => (layerMeta[id]?.name || String(id||'').replaceAll('_',' '));
    const phasePlain = (p) => p === 'early' ? 'early-stage signals' : (p === 'mid' ? 'forming-stage signals' : 'execution-stage signals');
    const blockerLabel = (s) => ({
      'Capital Without Architecture': 'Capital present, but no clear structure',
      'Late Signal / No Early Coherence': 'Late activity without early support',
      'Narrative Without Mandate': 'Story exists, but no mandate yet',
      'Demand Without Operator Path': 'Demand exists, but no operator path'
    }[String(s||'')] || String(s||'none'));
    const stageLabel = (s) => ({
      'Monitor':'Watch', 'Shaping':'Taking shape', 'Platform Formation':'Platform forming', 'Capital Alignment':'Capital aligning', 'Pre-FID':'Near execution', 'Execution':'In execution'
    }[String(s||'')] || String(s||''));

    function populateFilters(){
      const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
      const inject = (el, vals, label) => { el.innerHTML = '<option value="">'+label+' (All)</option>' + vals.map(v => '<option>'+esc(v)+'</option>').join(''); };
      inject(els.fSector, uniq(rows.map(r => r.sector)), 'Sector');
      inject(els.fRegion, uniq(rows.map(r => r.region)), 'Region');
      inject(els.fBuyer, uniq(rows.map(r => r.likelyBuyerClass)), 'Buyer Class');
      inject(els.fFid, uniq(rows.map(r => r.fidBoundaryType)), 'FID Boundary');
    }

    function getFiltered(){
      const q = String(els.fSearch.value || '').trim().toLowerCase();
      const minPpi = Number(els.fMinPpi.value || 0);
      return rows.filter(r => {
        if (els.fSector.value && r.sector !== els.fSector.value) return false;
        if (els.fRegion.value && r.region !== els.fRegion.value) return false;
        if (els.fStatus.value && r.status !== els.fStatus.value) return false;
        if (els.fBuyer.value && r.likelyBuyerClass !== els.fBuyer.value) return false;
        if (els.fFid.value && r.fidBoundaryType !== els.fFid.value) return false;
        if (r.ppi < minPpi) return false;

        const pId = linkedInitiativeIds(r).find((id) => physicsByInitiative.has(id));
        const p = pId ? physicsByInitiative.get(pId) : null;
        const activeLayers = new Set((((p || {}).ontology || {}).activeLayers || []));
        const buyerIds = ((p || {}).buyerAlignment || []).map((b) => String(b.buyer_id || ''));

        if (state.ontologyLayer && !activeLayers.has(state.ontologyLayer)) return false;
        if (state.missingLayer && activeLayers.has(state.missingLayer)) return false;
        if (state.buyerFocus && !buyerIds.includes(state.buyerFocus)) return false;
        if (state.phaseFocus && Number(((p || {}).phaseMix || {})[state.phaseFocus] || 0) <= 0) return false;

        const reasons = p ? stuckReasonRanked(p).map((x) => x.reason) : [];
        if (state.stuckReason && !reasons.includes(state.stuckReason)) return false;

        if (!q) return true;
        const blob = [r.sector,r.thesisSummary,r.analystNotes,r.mainStructuralBottleneck,r.whyItMatters,r.nextIntelligenceAction,r.buyerPath,r.usgRelevance,(r.actors||[]).map(a=>a.name).join(' ')].join(' ').toLowerCase();
        return blob.includes(q);
      });
    }

    function sortRows(list){
      const dir = state.sortDir === 'asc' ? 1 : -1;
      const key = state.sortBy;
      return [...list].sort((a,b) => {
        const av = a[key], bv = b[key];
        if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*dir;
        return String(av||'').localeCompare(String(bv||''))*dir;
      });
    }

    function renderSummary(list){
      const total = list.length;
      const mandate = list.filter(r => r.ppi >= 20).length;
      const highest = list.slice().sort((a,b)=>b.ppi-a.ppi)[0];
      const mover = list.slice().sort((a,b)=>b.delta90d-a.delta90d)[0];
      const buyers = new Set(list.map(r => r.likelyBuyerClass)).size;
      const cards = [
        ['Total sectors tracked', total, 'Filtered universe'],
        ['Mandate-Proximate sectors', mandate, 'PPI ≥ 20'],
        ['Highest PPI sector', highest ? (highest.sector+' ('+highest.ppi+')') : '—', 'Strength'],
        ['Fastest 90-day mover', mover ? (mover.sector+' (+'+mover.delta90d+')') : '—', 'Velocity'],
        ['Buyer classes active', buyers, 'Current spread']
      ];
      els.summary.innerHTML = cards.map(c => '<div class="col-12 col-md-6 col-xl"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">'+esc(c[0])+'</div><div class="metric-value" style="font-size:1.05rem">'+esc(c[1])+'</div><div class="small text-muted mono">'+esc(c[2])+'</div></div></div></div>').join('');
    }

    function renderUSGWindow(list){
      if (!els.usgWindow) return;
      const rowsWithPhysics = list.map((r) => {
        const pid = linkedInitiativeIds(r).find((id) => physicsByInitiative.has(id));
        const p = pid ? physicsByInitiative.get(pid) : null;
        return { r, p };
      }).filter((x) => x.p);

      if (!rowsWithPhysics.length) {
        els.usgWindow.innerHTML = '<div class="pp-empty">No initiative-physics mapping available for current filter set.</div>';
        return;
      }

      const accelerating = rowsWithPhysics.filter((x) => Number(x.p.momentum || 0) > 0.2).length;
      const highPressure = rowsWithPhysics.filter((x) => Number(x.p.pressure || 0) >= 15).length;
      const topMotions = rowsWithPhysics
        .map((x) => x.p.recommendedUSGMotion || 'Monitor only')
        .reduce((a,m)=>{a[m]=(a[m]||0)+1;return a;},{});
      const motionLead = Object.entries(topMotions).sort((a,b)=>b[1]-a[1])[0];
      const topGaps = rowsWithPhysics.flatMap((x) => (((x.p||{}).recommendedUSGDrivers||{}).missing || []).slice(0,2))
        .reduce((a,m)=>{a[m]=(a[m]||0)+1;return a;},{});
      const gapLead = Object.entries(topGaps).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k])=>k.replaceAll('_',' '));

      els.usgWindow.innerHTML =
        '<div class="row g-2">' +
          '<div class="col-12 col-md-3"><div class="border rounded p-2"><div class="pp-kicker">Initiatives in scope</div><div class="mono">'+rowsWithPhysics.length+'</div></div></div>' +
          '<div class="col-12 col-md-3"><div class="border rounded p-2"><div class="pp-kicker">Accelerating</div><div class="mono">'+accelerating+'</div></div></div>' +
          '<div class="col-12 col-md-3"><div class="border rounded p-2"><div class="pp-kicker">High pressure</div><div class="mono">'+highPressure+'</div></div></div>' +
          '<div class="col-12 col-md-3"><div class="border rounded p-2"><div class="pp-kicker">Leading motion</div><div class="mono">'+esc((motionLead && motionLead[0]) || 'Monitor only')+'</div></div></div>' +
        '</div>' +
        '<div class="mt-2 text-muted">Missing key stages: '+esc(gapLead.join(' · ') || 'none')+'</div>';
    }

    function renderTable(list){
      if (!list.length) {
        els.table.innerHTML = '<tr><td colspan="10"><div class="pp-empty">No sectors match current filters. Reset filters or lower minimum PPI.</div></td></tr>';
        return;
      }
      els.table.innerHTML = list.map(r => '<tr data-id="'+esc(r.id)+'" style="cursor:pointer">'+
        '<td><div class="pp-sector">'+esc(r.sector)+'</div><div class="pp-sub">'+esc(r.theater||'')+'</div></td>'+
        '<td>'+esc(r.region)+'</td>'+
        '<td><span class="pp-ppi">'+esc(r.ppi)+'/25</span></td>'+
        '<td><span class="pp-status">'+esc(r.status)+'</span></td>'+
        '<td class="pp-hide-md small">'+esc(r.buyerPath || 'Mixed / Multi-actor')+'</td>'+
        '<td class="pp-hide-md"><span class="pp-rel">'+esc(r.usgRelevance || 'Track')+'</span></td>'+
        '<td>'+delta(r.delta90d)+'</td>'+
        '<td><span class="badge text-bg-light border">'+esc(r.likelyBuyerClass)+'</span></td>'+
        '<td class="pp-wide-col small text-muted">'+esc(r.nextIntelligenceAction || 'Validate FID boundary')+'</td>'+
        '<td class="mono small">'+esc(r.lastUpdated)+'</td></tr>').join('');
      els.table.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openDetail(tr.dataset.id)));
    }

    function renderTopByBuyer(list){
      const watch = list.filter(r => r.ppi >= 20 || (r.ppi >= 15 && r.delta90d >= 4));
      if (!watch.length) { els.topByBuyer.innerHTML = '<div class="pp-empty">No sectors currently meet mandate-proximate criteria.</div>'; return; }
      const groups = {};
      watch.forEach(r => { const k=r.likelyBuyerClass || 'Unspecified'; if(!groups[k]) groups[k]=[]; groups[k].push(r); });
      const ordered = Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
      els.topByBuyer.innerHTML = ordered.map(([k,v]) => {
        const top = v.sort((a,b)=>b.ppi-a.ppi).slice(0,3);
        return '<div class="mb-2"><div class="pp-kicker">'+esc(k)+'</div>'+top.map(r => '<div class="d-flex justify-content-between border rounded px-2 py-1 mb-1"><span>'+esc(r.sector)+'</span><span class="pp-legend">PPI '+r.ppi+' · 90D '+(r.delta90d>0?'+':'')+r.delta90d+'</span></div>').join('')+'</div>';
      }).join('');
    }

    function renderHeatmap(list){
      if (!list.length) { els.heatmap.innerHTML = '<div class="pp-empty">No distribution available for current filter set.</div>'; return; }
      const grouped = {};
      list.forEach(r => {
        const k = r.likelyBuyerClass || 'Unspecified';
        if(!grouped[k]) grouped[k] = {count:0, ppi:0, high:0, sectors:[]};
        grouped[k].count += 1; grouped[k].ppi += Number(r.ppi||0); if (r.ppi >= 20) grouped[k].high += 1; grouped[k].sectors.push(r.sector);
      });
      const order = Object.entries(grouped).sort((a,b) => {
        const af = focusClasses.includes(a[0]) ? 1 : 0; const bf = focusClasses.includes(b[0]) ? 1 : 0;
        if (bf !== af) return bf - af;
        return b[1].count - a[1].count;
      });
      els.heatmap.innerHTML = order.map(([k,v]) => {
        const avg = Number((v.ppi / Math.max(1,v.count)).toFixed(1));
        const w = Math.min(100, (avg / 25) * 100);
        return '<div class="pp-heat-row"><div class="d-flex justify-content-between"><strong>'+esc(k)+'</strong><span class="pp-legend">'+v.count+' sectors · Avg '+avg+' · M-prox '+v.high+'</span></div>'+
          '<div class="progress" style="height:7px;background:rgba(255,255,255,.05)"><div class="progress-bar" style="width:'+w+'%;background:#4f8cff"></div></div>'+
          '<div class="pp-legend">'+esc(v.sectors.slice(0,4).join(', ')) + (v.sectors.length>4?'...':'') + '</div></div>';
      }).join('');
    }

    function renderWatchlist(list){
      const watch = list.filter(r => r.ppi >= 20 || (r.ppi >= 15 && r.delta90d >= 4)).sort((a,b)=>b.ppi-a.ppi);
      if (!watch.length) { els.watchlist.innerHTML = '<div class="pp-empty">No sectors currently satisfy watchlist thresholds.</div>'; return; }
      els.watchlist.innerHTML = watch.map(r => '<div class="card mb-2"><div class="card-body py-2">'+
        '<div class="d-flex justify-content-between align-items-center"><strong>'+esc(r.sector)+'</strong><span class="pp-ppi">'+r.ppi+'/25</span></div>'+
        '<div class="pp-sub">'+esc(r.region)+' · '+esc(r.likelyBuyerClass)+'</div>'+
        '<div class="small mt-1">'+esc(r.mandateFeasibilityNote || 'Buyer path is emerging')+'</div></div></div>').join('');
    }

    function scoreBar(label, v){
      const width = Math.min(100, (Number(v||0)/5)*100);
      return '<div class="mb-2"><div class="d-flex justify-content-between"><span class="small">'+esc(label)+'</span><span class="small mono">'+v+'/5</span></div><div class="progress" style="height:7px;background:rgba(255,255,255,.05)"><div class="progress-bar" style="width:'+width+'%;background:#4f8cff"></div></div></div>';
    }

    function linkedInitiativeIds(r){
      const rawIds = ((r.linkRefs || {}).initiativeIds || []).map(x => String(x || '').trim()).filter(Boolean);
      const ids = rawIds.map((id) => {
        const key = id.toUpperCase();
        return sectorInitiativeAlias[key] || id;
      });
      // Keep explicit mapping first; only then fallback.
      return [...new Set([...ids, 'USG', 'GLOBAL'])];
    }

    function layerGapDiagnostics(p){
      const active = new Set((((p||{}).ontology||{}).activeLayers || []));
      const has = (x) => active.has(x);
      const msgs = [];
      if ((has('demand') || has('compute_digital')) && has('narrative_legitimacy') && !has('governance')) msgs.push('High demand/narrative/compute signals; weak governance layer.');
      if (has('capital_allocation') && (!has('energy') || !has('connectivity'))) msgs.push('Capital signals present; energy/connectivity layers weak.');
      if ((has('operator') || has('construction')) && !has('platform_architecture')) msgs.push('Late-stage operator/construction signals appearing before architecture coherence.');
      if (has('platform_architecture') && !has('financial_structuring')) msgs.push('Architecture is forming; financial structuring layer remains underdeveloped.');
      return msgs;
    }

    function stuckReasonRanked(p){
      const active = new Set((((p||{}).ontology||{}).activeLayers || []));
      const has = (x) => active.has(x);
      const candidates = [];
      const add = (reason, score) => candidates.push({ reason, score });

      if ((has('demand') || has('compute_digital')) && !has('operator')) add('Demand Without Operator Path', 0.92);
      if (!has('governance') && (has('narrative_legitimacy') || has('capital_allocation'))) add('Governance Gap', 0.95);
      if (!has('financial_structuring') && (has('capital_allocation') || has('platform_architecture'))) add('Structuring Gap', 0.9);
      if (!has('energy') && (has('compute_digital') || has('industrial_production'))) add('Energy Constraint', 0.85);
      if (!has('connectivity') && (has('platform_architecture') || has('market_access'))) add('Connectivity Gap', 0.78);
      if (has('capital_allocation') && !has('platform_architecture')) add('Capital Without Architecture', 0.88);
      if ((has('operator') || has('construction')) && !(has('demand') && has('narrative_legitimacy') && has('platform_architecture'))) add('Late Signal / No Early Coherence', 0.8);
      if (has('narrative_legitimacy') && !has('capital_allocation')) add('Narrative Without Mandate', 0.76);

      return candidates.sort((a,b)=>b.score-a.score).slice(0,2);
    }

    function stuckBadge(reason){
      const raw = String(reason || 'none');
      return '<button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1 mb-1 js-stuck-reason" data-stuck-reason="'+esc(raw)+'">'+esc(blockerLabel(raw))+'</button>';
    }

    function bindTap(el, fn){
      if (!el) return;
      let touched = false;
      el.addEventListener('touchend', (e) => { touched = true; e.preventDefault(); fn(); }, { passive:false });
      el.addEventListener('click', (e) => { if (touched) { touched = false; return; } e.preventDefault(); fn(); });
    }

    function renderLayerLegend(){
      if (!els.lemLegend) return;
      els.lemLegend.innerHTML = '<div class="pp-legend mb-1">Infrastructure Lifecycle stages</div><div class="lem-legend-grid">' + ontologyOrder.map((l) => {
        const meta = layerMeta[l.id] || {};
        return '<div class="border rounded p-2"><strong>' + Number(l.order || 0) + '. ' + esc(meta.name || l.id) + '</strong><div class="text-muted small">' + esc(meta.desc || '') + '</div></div>';
      }).join('') + '</div>';
    }

    function renderLayerEmissionsMap(list){
      if (!els.lemPanel) return;
      const rowsWithPhysics = list.map((r) => {
        const pid = linkedInitiativeIds(r).find((id) => physicsByInitiative.has(id));
        const p = pid ? physicsByInitiative.get(pid) : null;
        return { row: r, initiativeId: pid || linkedInitiativeIds(r)[0], p };
      }).filter((x) => x.p);

      if (!rowsWithPhysics.length) {
        els.lemPanel.innerHTML = '<div class="pp-empty">Signal physics snapshot is missing or initiative links are not mapped yet.</div>';
        if (els.lemGeneratedAt) els.lemGeneratedAt.textContent = 'No snapshot loaded';
        return;
      }

      if (els.lemGeneratedAt) els.lemGeneratedAt.textContent = 'Snapshot: ' + esc(String(signalPhysics.generatedAt || '').replace('T',' ').slice(0,19));

      const top = rowsWithPhysics
        .sort((a,b) => Number((b.p || {}).pressure || 0) - Number((a.p || {}).pressure || 0))
        .slice(0, 8);

      els.lemPanel.innerHTML = top.map(({row:r, initiativeId, p}) => {
        const active = new Set((((p||{}).ontology||{}).activeLayers || []));
        const missing = ontologyOrder.filter((l) => !active.has(l.id)).map((l) => l.id).slice(0, 4);
        const phaseMix = (p.phaseMix || { early:0, mid:0, late:0 });
        const phaseProgress = Math.round(Number(((p.ontology || {}).progression || 0) * 100));
        const buyers = (p.buyerAlignment || []).slice(0,4).map((b) => b.buyer_id).join(' · ') || 'No buyer alignment yet';
        const gaps = layerGapDiagnostics(p);

        const heat = ontologyOrder.map((l) => {
          const on = active.has(l.id);
          const cls = on ? 'on' : 'off';
          const kind = on ? 'emit' : 'missing';
          const meta = layerMeta[l.id] || {};
          const tip = (meta.name || l.id) + ' — ' + (meta.desc || '') + ' Timing: ' + (meta.phase || phasePlain(l.phase) || 'n/a');
          return '<button class="lem-cell '+cls+' js-layer-cell" data-layer-kind="'+kind+'" data-layer-id="'+esc(l.id)+'" title="'+esc(tip)+'" aria-label="'+esc(tip)+'">'+Number(l.order || 0)+'</button>';
        }).join('');
        const phaseLabel = 'early ' + Math.round((phaseMix.early||0)*100) + '% · mid ' + Math.round((phaseMix.mid||0)*100) + '% · late ' + Math.round((phaseMix.late||0)*100) + '%';
        const ranked = stuckReasonRanked(p);
        const primary = ranked[0]?.reason || 'None';
        const secondary = ranked[1]?.reason || 'None';

        return '<div class="lem-row">' +
          '<div class="lem-row-head js-lem-toggle" role="button" tabindex="0" aria-expanded="false">' +
            '<div><strong>' + esc(r.sector) + '</strong><div class="pp-sub">Initiative ' + esc(initiativeId) + ' · current stage ' + esc(stageLabel(p.state || 'Monitor')) + '</div></div>' +
            '<div class="small text-end"><span class="pp-ppi">P ' + Number(p.pressure || 0).toFixed(1) + '</span><div class="pp-legend">Tap to expand</div></div>' +
          '</div>' +
          '<div class="lem-row-body d-none">' +
            '<div class="lem-heat mt-2">' + heat + '</div>' +
            '<div class="mt-1"><span class="pp-kicker">Click stages to filter</span> <span class="pp-legend">Blue = active signals · Gray = missing stage</span></div>' +
            '<div class="lem-tooltip mt-1 js-layer-tooltip">Tap or hover a square to view stage meaning.</div>' +
            '<div class="mt-2"><div class="d-flex justify-content-between pp-legend"><span>Stage progress</span><span>' + phaseProgress + '%</span></div><div class="lem-phase-bar"><div class="lem-phase-fill" style="width:' + phaseProgress + '%"></div></div><div class="pp-legend">Signal timing mix: ' + esc(phaseLabel) + '</div><div class="pp-legend">Early = early-stage signals · Mid = forming-stage signals · Late = execution-stage signals</div><div class="d-flex gap-1 mt-1"><button class="btn btn-sm btn-outline-secondary py-0 px-2 js-phase" data-phase="early">early</button><button class="btn btn-sm btn-outline-secondary py-0 px-2 js-phase" data-phase="mid">mid</button><button class="btn btn-sm btn-outline-secondary py-0 px-2 js-phase" data-phase="late">late</button></div></div>' +
            '<div class="lem-strip mt-2">' +
              '<div class="tile"><div class="pp-kicker">Opportunity Strength</div><div class="mono">' + Number(p.pressure||0).toFixed(2) + '</div><div class="pp-legend">How strong the opportunity looks right now</div></div>' +
              '<div class="tile"><div class="pp-kicker">Change Speed</div><div class="mono">' + (Number(p.momentum||0)>=0?'+':'') + Number(p.momentum||0).toFixed(3) + '</div><div class="pp-legend">How fast it is improving or weakening</div></div>' +
              '<div class="tile"><div class="pp-kicker">Change Trend</div><div class="mono">' + (Number(p.acceleration||0)>=0?'+':'') + Number(p.acceleration||0).toFixed(3) + '</div><div class="pp-legend">Whether that change is speeding up or slowing down</div></div>' +
            '</div>' +
            '<div class="mt-2"><span class="pp-kicker">Best buyer matches</span><div class="small">' + ((p.buyerAlignment || []).slice(0,4).map((b)=>'<button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1 mb-1 js-buyer-focus" data-buyer="'+esc(b.buyer_id)+'">'+esc(b.buyer_id)+'</button>').join('') || 'No buyer matches yet') + '</div></div>' +
            '<div class="mt-2"><span class="pp-kicker">Recommended USG Move</span><div class="small"><span class="badge text-bg-primary">' + esc(p.recommendedUSGMotion || 'Monitor only') + '</span> <span class="pp-legend">Confidence level ' + Math.round(Number(p.recommendedUSGMotionConfidence || 0.5) * 100) + '%</span><div class="text-muted small mt-1"><strong>Why this move:</strong> ' + esc(p.recommendedUSGMotionRationale || 'No rationale generated.') + '</div><div class="pp-legend mt-1">Main blocker: ' + esc(blockerLabel((((p.recommendedUSGDrivers||{}).stuck||{}).primary || 'none')) ) + ' · Second blocker: ' + esc(blockerLabel((((p.recommendedUSGDrivers||{}).stuck||{}).secondary || 'none'))) + '</div><div class="pp-legend">What may slow this down: ' + esc((((p.recommendedUSGDrivers||{}).counterevidence||[]).slice(0,2).join(' | ') || 'none')) + '</div></div></div>' +
            '<div class="mt-2"><span class="pp-kicker">Missing key stages</span><div class="small">' + (missing.length ? missing.map(x=>'<button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1 mb-1 js-missing-layer" data-layer-id="'+esc(x)+'">'+esc(layerLabel(x))+'</button>').join('') : 'None') + '</div></div>' +
            '<div class="mt-2"><span class="pp-kicker">Blocker tags</span><div class="small">Main blocker: ' + stuckBadge(primary) + ' Second blocker: ' + stuckBadge(secondary) + '</div></div>' +
            '<div class="mt-2"><span class="pp-kicker">What\\'s Missing</span><div class="small text-muted">' + (gaps.length ? gaps.map(esc).join(' ') : 'No major missing stages right now.') + '</div></div>' +
          '</div>' +
        '</div>';
      }).join('');

      els.lemPanel.querySelectorAll('.js-lem-toggle').forEach((head) => {
        const row = head.closest('.lem-row');
        const body = row ? row.querySelector('.lem-row-body') : null;
        const toggle = () => {
          if (!body) return;
          const hidden = body.classList.toggle('d-none');
          head.setAttribute('aria-expanded', String(!hidden));
          const note = head.querySelector('.pp-legend');
          if (note) note.textContent = hidden ? 'Tap to expand' : 'Tap to collapse';
        };
        bindTap(head, toggle);
        head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });

      els.lemPanel.querySelectorAll('.js-layer-cell').forEach((btn) => {
        const updateTooltip = () => {
          const id = String(btn.dataset.layerId || '');
          const meta = layerMeta[id] || {};
          const row = btn.closest('.lem-row');
          const tip = row ? row.querySelector('.js-layer-tooltip') : null;
          if (tip) tip.textContent = (meta.name || id) + ' — ' + (meta.desc || '') + ' Timing: ' + (meta.phase || 'n/a');
        };
        btn.addEventListener('mouseenter', updateTooltip);
        btn.addEventListener('focus', updateTooltip);
        btn.addEventListener('touchstart', updateTooltip, { passive: true });
        bindTap(btn, () => {
          const id = String(btn.dataset.layerId || '');
          if (btn.dataset.layerKind === 'emit') {
            state.ontologyLayer = state.ontologyLayer === id ? '' : id;
            state.missingLayer = '';
          } else {
            state.missingLayer = state.missingLayer === id ? '' : id;
            state.ontologyLayer = '';
          }
          renderAll();
        });
      });

      els.lemPanel.querySelectorAll('.js-missing-layer').forEach((btn) => bindTap(btn, () => {
        const id = String(btn.dataset.layerId || '');
        state.missingLayer = state.missingLayer === id ? '' : id;
        state.ontologyLayer = '';
        renderAll();
      }));

      els.lemPanel.querySelectorAll('.js-buyer-focus').forEach((btn) => bindTap(btn, () => {
        const b = String(btn.dataset.buyer || '');
        state.buyerFocus = state.buyerFocus === b ? '' : b;
        renderAll();
      }));

      els.lemPanel.querySelectorAll('.js-phase').forEach((btn) => bindTap(btn, () => {
        const p = String(btn.dataset.phase || '');
        state.phaseFocus = state.phaseFocus === p ? '' : p;
        renderAll();
      }));

      els.lemPanel.querySelectorAll('.js-stuck-reason').forEach((btn) => bindTap(btn, () => {
        const reason = String(btn.dataset.stuckReason || '');
        state.stuckReason = state.stuckReason === reason ? '' : reason;
        renderAll();
      }));
    }

    function scoreInterpretation(r){
      const hi=[], lo=[];
      const map = {
        capitalReality: 'capital is real', fidDefinability: 'FID boundary is clear', multiActorDependency: 'coordination pressure is high',
        structuralAmbiguity: 'structural ambiguity is elevated', mandateFeasibility: 'mandate feasibility is emerging'
      };
      Object.entries(r.scores||{}).forEach(([k,v]) => { if (Number(v)>=4) hi.push(map[k]); if (Number(v)<=2) lo.push(map[k]); });
      const a = hi.length ? 'Strength: ' + hi.join('; ') + '.' : 'Strength: no score bucket is in breakout range yet.';
      const b = lo.length ? 'Constraint: ' + lo.join('; ') + '.' : 'Constraint: no bucket is currently in red-band weakness.';
      return a + ' ' + b;
    }

    function originationReadiness(r){
      const cap = r.scores.capitalReality >= 4 ? 'Yes' : 'Not yet';
      const fid = r.scores.fidDefinability >= 4 ? 'Yes' : 'Partial';
      const buyer = ['Sovereign / DFI','Strategic Industrial Sponsor','Hyperscaler'].includes(r.buyerPath || '') ? 'Likely' : 'Mixed';
      const mand = r.scores.mandateFeasibility >= 4 ? 'Yes' : 'Emerging';
      const next = nextRel(r.usgRelevance || 'Track');
      return {
        cap, fid, buyer, mand,
        uplift: 'To move from '+(r.usgRelevance||'Track')+' to '+next+', we need one new verifiable signal that de-risks '+(r.mainStructuralBottleneck || 'the core FID blocker')+'.'
      };
    }

    function openDetail(id){
      const r = rows.find(x => x.id === id); if (!r) return;
      const rr = originationReadiness(r);
      const actorGroups = {};
      (r.actors || []).forEach(a => { const g = a.category || 'other'; if(!actorGroups[g]) actorGroups[g]=[]; actorGroups[g].push(a); });
      const actorHtml = Object.entries(actorGroups).map(([k,v]) => '<div class="mb-2"><div class="pp-kicker">'+esc(k.replaceAll('_',' / '))+'</div><ul class="small mb-1">'+v.map(a => '<li><strong>'+esc(a.name)+'</strong> — '+esc(a.role||'')+'</li>').join('')+'</ul></div>').join('');
      const signals = (r.signals||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

      drawerBody.innerHTML =
        '<div class="mb-3"><div class="pp-kicker">Sector Priority</div><h5 class="mb-1">'+esc(r.sector)+'</h5><div class="small text-muted mb-2">'+esc(r.region)+'</div><div class="small">'+esc(r.whyItMatters)+'</div></div>'+
        '<div class="card mb-3"><div class="card-body py-2"><div class="row g-2"><div class="col-6"><div class="pp-kicker">Pressure Strength</div><div><span class="pp-ppi">'+r.ppi+'/25</span> <span class="ms-2 pp-status">'+esc(r.status)+'</span></div></div><div class="col-6"><div class="pp-kicker">Likely Buyer</div><div class="small"><strong>'+esc(r.likelyBuyerClass)+'</strong><div class="text-muted">'+esc(r.buyerRationale)+'</div></div></div><div class="col-6"><div class="pp-kicker">FID Boundary</div><div class="small">'+esc(r.fidBoundaryType)+'</div></div><div class="col-6"><div class="pp-kicker">Primary Blocker</div><div class="small">'+esc(r.mainStructuralBottleneck)+'</div></div></div></div></div>'+
        '<div class="card mb-3"><div class="card-body py-2"><h6 class="mb-2">Origination Readiness</h6><div class="row g-2 small"><div class="col-6"><strong>Is capital real?</strong><div>'+esc(rr.cap)+'</div></div><div class="col-6"><strong>Is FID definable?</strong><div>'+esc(rr.fid)+'</div></div><div class="col-6"><strong>Is buyer above execution?</strong><div>'+esc(rr.buyer)+'</div></div><div class="col-6"><strong>Is mandate feasibility emerging?</strong><div>'+esc(rr.mand)+'</div></div><div class="col-12"><strong>USG relevance:</strong> <span class="pp-rel">'+esc(r.usgRelevance || 'Track')+'</span> · <strong>Buyer path:</strong> '+esc(r.buyerPath || 'Mixed / Multi-actor')+'</div><div class="col-12 text-muted">'+esc(rr.uplift)+'</div><div class="col-12"><strong>Next Intelligence Action:</strong> '+esc(r.nextIntelligenceAction || 'Validate FID boundary')+'</div></div></div></div>'+
        '<div class="mb-3"><h6 class="mb-2">Why this score?</h6><div class="small text-muted">'+esc(scoreInterpretation(r))+'</div></div>'+
        '<div class="mb-3"><h6 class="mb-2">PPI Breakdown</h6>'+scoreBar('Capital Reality', r.scores.capitalReality)+scoreBar('FID Definability', r.scores.fidDefinability)+scoreBar('Multi-Actor Dependency', r.scores.multiActorDependency)+scoreBar('Structural Ambiguity', r.scores.structuralAmbiguity)+scoreBar('Mandate Feasibility', r.scores.mandateFeasibility)+'<div class="pp-legend">Weighted config score: '+esc(r.weightedPpi)+'</div></div>'+
        '<div class="mb-3"><h6 class="mb-2">Signals Feed</h6>'+
          (signals.map(s => '<div class="pp-signal-row mb-2"><div class="d-flex justify-content-between"><strong>'+esc(s.type||'signal')+'</strong><span class="mono pp-legend">'+esc(s.date||'')+'</span></div><div class="small">'+esc(s.title||'')+'</div><div class="small text-muted">'+esc(s.summary||'No summary.')+'</div></div>').join('') || '<div class="pp-empty">No signals logged for this sector.</div>')+
        '</div>'+
        '<div class="mb-3"><h6 class="mb-2">Key Actors</h6>' + (actorHtml || '<div class="pp-empty">No mapped actors.</div>') + '</div>'+
        '<div class="mb-3"><h6 class="mb-1">Analyst Notes</h6><div class="small" style="white-space:pre-wrap">'+esc(r.analystNotes || 'No analyst notes yet.')+'</div></div>'+
        '<div class="mb-2"><button id="pp-network-toggle" class="btn btn-sm btn-outline-secondary">Toggle Network View</button></div><div id="pp-network" style="display:none;height:260px;border:1px solid var(--border);border-radius:10px"></div>'+
        '<div class="pp-kicker mt-3">Integration refs</div><pre class="small" style="white-space:pre-wrap">'+esc(JSON.stringify(r.linkRefs || {}, null, 2))+'</pre>';

      drawerBody.querySelector('#pp-network-toggle')?.addEventListener('click', () => {
        const box = drawerBody.querySelector('#pp-network'); if (!box) return;
        const show = box.style.display === 'none'; box.style.display = show ? 'block' : 'none';
        if (show && window.cytoscape) {
          const nodes = [{ data: { id:'sector', label:r.sector } }, { data: { id:'buyer', label:r.likelyBuyerClass } }, { data:{ id:'fid', label:r.fidBoundaryType } }]
            .concat((r.actors||[]).map((a,i)=>({ data:{ id:'a'+i, label:a.name } })));
          const edges = [{ data:{ source:'sector', target:'buyer' } }, { data:{ source:'sector', target:'fid' } }]
            .concat((r.actors||[]).map((a,i)=>({ data:{ source:'sector', target:'a'+i } })));
          window.cytoscape({ container: box, elements:{nodes,edges}, style:[{selector:'node',style:{'background-color':'#4f8cff','label':'data(label)','font-size':10,'color':'#d9e3f2','text-wrap':'wrap','text-max-width':120}},{selector:'edge',style:{'line-color':'#5f6b7d','width':1.2,'curve-style':'bezier'}}], layout:{name:'cose',animate:false,padding:12} });
        }
      });

      if (drawer) drawer.show();
    }

    function renderAll(){
      const filtered = sortRows(getFiltered());
      renderSummary(filtered); renderUSGWindow(filtered); renderTable(filtered); renderTopByBuyer(filtered); renderHeatmap(filtered); renderWatchlist(filtered); renderLayerEmissionsMap(filtered);
      const tags = [els.fSector.value, els.fRegion.value, els.fStatus.value, els.fBuyer.value, els.fFid.value].filter(Boolean);
      if (state.ontologyLayer) tags.push('Active stage: ' + layerLabel(state.ontologyLayer));
      if (state.missingLayer) tags.push('Missing stage: ' + layerLabel(state.missingLayer));
      if (state.buyerFocus) tags.push('Buyer match: ' + state.buyerFocus);
      if (state.phaseFocus) tags.push('Stage timing: ' + state.phaseFocus + ' (' + phasePlain(state.phaseFocus) + ')');
      if (state.stuckReason) tags.push('Blocker tag: ' + blockerLabel(state.stuckReason));
      const minLabel = Number(els.fMinPpi.value || 0) > 0 ? ('Min PPI ' + Number(els.fMinPpi.value || 0)) : '';
      if (minLabel) tags.push(minLabel);
      if (els.fSearch.value.trim()) tags.push('Search active');
      els.filterLabel.textContent = tags.length ? ('Active filters: ' + tags.join(' · ')) : 'No active filters';
    }

    renderLayerLegend();
    els.lemLegendToggle?.addEventListener('click', () => {
      if (!els.lemLegend) return;
      const open = els.lemLegend.classList.toggle('d-none');
      els.lemLegendToggle.textContent = open ? 'Show Stage Legend' : 'Hide Stage Legend';
    });

    populateFilters(); renderAll();
    ['change','keyup'].forEach(evt => [els.fSector,els.fRegion,els.fStatus,els.fBuyer,els.fFid,els.fMinPpi,els.fSearch].forEach(el => el.addEventListener(evt, renderAll)));
    document.getElementById('f-reset')?.addEventListener('click', () => {
      els.fSector.value=''; els.fRegion.value=''; els.fStatus.value=''; els.fBuyer.value=''; els.fFid.value=''; els.fMinPpi.value='0'; els.fSearch.value='';
      state.ontologyLayer=''; state.missingLayer=''; state.buyerFocus=''; state.phaseFocus=''; state.stuckReason='';
      renderAll();
    });
    document.querySelectorAll('button[data-sort]').forEach(btn => btn.addEventListener('click', () => { const k = btn.getAttribute('data-sort'); if(state.sortBy===k) state.sortDir = state.sortDir==='asc'?'desc':'asc'; else {state.sortBy=k; state.sortDir='desc';} renderAll(); }));
  </script>
  </body></html>`);
});

app.get('/dashboard/activity', async (req, res) => {
  const actor = req.query.actor ? String(req.query.actor) : undefined;
  const entity_type = req.query.entity_type ? String(req.query.entity_type) : undefined;
  const date = req.query.date ? String(req.query.date) : undefined;
  const events = await readActivityEvents({ limit: 1000, actor, entity_type, date, maxScan: 1000 });
  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Activity')}</head><body><div class="app-shell">
    ${dashboardNav('activity')}
    ${pageHeader('Activity Feed')}
    <form class="row g-2 mb-3" method="get" action="/dashboard/activity">
      <div class="col"><input class="form-control" name="actor" placeholder="actor" value="${escapeHtml(actor || '')}"></div>
      <div class="col"><input class="form-control" name="entity_type" placeholder="entity_type" value="${escapeHtml(entity_type || '')}"></div>
      <div class="col"><input class="form-control" name="date" placeholder="YYYY-MM-DD" value="${escapeHtml(date || '')}"></div>
      <div class="col-auto"><button class="btn btn-primary" type="submit">Filter</button></div>
    </form>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ts</th><th>actor</th><th>role</th><th>event_type</th><th>entity</th><th>meta</th></tr></thead><tbody>
      ${(events.map(e => `<tr><td class="mono small">${escapeHtml(e.ts||'')}</td><td>${escapeHtml(e.actor||'')}</td><td>${escapeHtml(e.role||'')}</td><td>${escapeHtml(e.event_type||'')}</td><td>${escapeHtml((e.entity_type||'')+':' + (e.entity_id||''))}</td><td><code>${escapeHtml(JSON.stringify(e.meta||{}))}</code></td></tr>`).join('')) || '<tr><td colspan="6">No events</td></tr>'}
    </tbody></table></div>
  </div></body></html>`);
});

app.get('/dashboard/review', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const showAll = String(req.query.showAll || 'false') === 'true';
  const pageSizeRaw = Number.parseInt(String(req.query.pageSize || '25'), 10) || 25;

  const all = await listReviewPackets(5000);
  const pageSize = showAll ? Math.max(1, all.length) : Math.min(100, Math.max(10, pageSizeRaw));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const rps = all.slice(start, end);

  const qp = (p) => `/dashboard/review?page=${p}&pageSize=${pageSize}`;

  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Review Packets')}</head><body><div class="app-shell">
    ${dashboardNav('review')}
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h1 class="page-title">Review Packets</h1>
      <div class="small text-muted">Total: ${total} • Page ${safePage}/${totalPages}</div>
    </div>
    <div class="d-flex gap-2 mb-2">
      <a class="btn btn-sm btn-outline-secondary" href="/dashboard/review?showAll=true">Show All</a>
      <a class="btn btn-sm btn-outline-secondary" href="/dashboard/review?page=1&pageSize=25">Paged View</a>
    </div>
    <div class="card"><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ID</th><th>Title</th><th>Compact</th><th>Status</th><th>Linked Task</th><th>Created</th><th>By</th><th>File</th></tr></thead><tbody>
      ${(rps.map(r => `<tr><td>${escapeHtml(r.rp_id||'')}</td><td><a href="/dashboard/review/${encodeURIComponent(r.rp_id || '')}">${escapeHtml(r.title||'')}</a></td><td class="small" style="max-width:420px">${escapeHtml(r.compact||'—')}</td><td>${escapeHtml(r.status||'')}</td><td>${escapeHtml(r.linked_task||'')}</td><td class="mono small">${escapeHtml(r.created_at||'')}</td><td>${escapeHtml(r.created_by||'')}</td><td class="mono small">${escapeHtml(r.path||'')}</td></tr>`).join('')) || '<tr><td colspan="8">No review packets</td></tr>'}
    </tbody></table></div></div>

    <div class="d-flex flex-wrap gap-2 align-items-center mt-2">
      <a class="btn btn-sm btn-outline-secondary ${safePage <= 1 ? 'disabled' : ''}" href="${safePage <= 1 ? '#' : qp(1)}">« First</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage <= 1 ? 'disabled' : ''}" href="${safePage <= 1 ? '#' : qp(safePage - 1)}">‹ Prev</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage >= totalPages ? 'disabled' : ''}" href="${safePage >= totalPages ? '#' : qp(safePage + 1)}">Next ›</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage >= totalPages ? 'disabled' : ''}" href="${safePage >= totalPages ? '#' : qp(totalPages)}">Last »</a>
      <form class="d-flex gap-2 ms-auto" method="get" action="/dashboard/review">
        <input type="hidden" name="pageSize" value="${pageSize}" />
        <input class="form-control form-control-sm" style="width:90px" type="number" min="1" max="${totalPages}" name="page" value="${safePage}" />
        <button class="btn btn-sm btn-primary" type="submit">Go</button>
      </form>
    </div>
  </div></body></html>`);
});

app.get('/dashboard/review/:rpId', async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) {
    return res.status(404).type('html').send(`<!doctype html><html><head>${uiHead('Review Packet Not Found')}</head><body><div class="app-shell">${dashboardNav('review')}${pageHeader('Review Packet Not Found')}<p>No review packet found for <code>${escapeHtml(rpId)}</code>.</p><a class="btn btn-secondary" href="/dashboard/review">Back to Review Packets</a></div></body></html>`);
  }

  const body = rp.text.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  const frontRows = Object.entries(rp.front || {})
    .map(([k, v]) => `<tr><th style="width:220px">${escapeHtml(k)}</th><td>${escapeHtml(String(v ?? ''))}</td></tr>`)
    .join('') || '<tr><td colspan="2">No metadata</td></tr>';
  const rendered = renderSimpleMarkdown(body);

  res.type('html').send(`<!doctype html><html><head>${uiHead(`Review Packet ${rpId}`)}</head><body><div class="app-shell">
    ${dashboardNav('review')}
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h1 class="page-title">${escapeHtml(rp.front?.title || rpId)}</h1>
      <a class="btn btn-sm btn-outline-secondary" href="/dashboard/review">Back to list</a>
    </div>
    <div class="card mb-3"><div class="table-responsive"><table class="table table-sm align-middle"><tbody>${frontRows}</tbody></table></div></div>
    <div class="card"><div class="card-body markdown-body">${rendered}</div></div>
  </div></body></html>`);
});

app.get('/dashboard/board', async (_req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const counts = Object.fromEntries(BOARD_COLUMNS.map(c => [c, board.tasks.filter(t => t.status===c).length]));
  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Board')}</head><body><div class="app-shell">
    ${dashboardNav('board')}
    ${pageHeader('Board Snapshot')}
    <div class="row g-3 mb-3">${BOARD_COLUMNS.map(c=>`<div class="col-12 col-md-6 col-xl">${statCard(c, counts[c])}</div>`).join('')}</div>
    <a class="btn btn-primary" href="/board">Open Board UI</a>
  </div></body></html>`);
});

app.get('/dashboard/uos', async (_req, res) => {
  const state = await readJson(DASHBOARD_STATE_FILE, {});
  const idxPath = path.join(UOS_ROOT, 'UOS_INDEX.md');
  const indexTxt = await fs.readFile(idxPath, 'utf8').catch(() => 'UOS index not found.');

  let currentFiles = [];
  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (fssync.existsSync(dir)) {
      const files = await fs.readdir(dir);
      currentFiles.push(...files.filter(f => f.endsWith('.md')).map(f => `${key}/${f}`));
    }
  }

  const pendingRoot = path.join(UOS_ROOT, 'pending');
  const pendingBatches = (await fs.readdir(pendingRoot).catch(() => [])).sort().reverse();

  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard UOS')}</head><body><div class="app-shell">
    ${dashboardNav('uos')}
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h1 class="page-title">UOS Documents</h1>
      <a class="btn btn-sm btn-primary" href="/admin/upload">Upload UOS Documents</a>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-12 col-lg-6"><div class="card"><div class="card-body">
        <h6>Latest Publish</h6>
        <p class="mb-1"><strong>Timestamp:</strong> ${escapeHtml(state.latestUosPublish || 'N/A')}</p>
        <p class="mb-1"><strong>Batch:</strong> ${escapeHtml(state.latestUosPublishedBatch || 'N/A')}</p>
        <p class="mb-0"><strong>Current docs:</strong> ${currentFiles.length}</p>
      </div></div></div>
      <div class="col-12 col-lg-6"><div class="card"><div class="card-body">
        <h6>Pending Batches</h6>
        <ul class="mb-0">${pendingBatches.slice(0,20).map(b => `<li class="mono small">${escapeHtml(b)}</li>`).join('') || '<li>None</li>'}</ul>
      </div></div></div>
    </div>

    <div class="card mb-3"><div class="card-body">
      <h6>Current UOS Markdown Files</h6>
      <ul>${currentFiles.map(f => `<li class="mono small">${escapeHtml(f)}</li>`).join('') || '<li>No current files</li>'}</ul>
    </div></div>

    <div class="card"><div class="card-body">
      <h6>UOS Index</h6>
      <pre class="small" style="max-height:45vh;overflow:auto">${escapeHtml(indexTxt)}</pre>
    </div></div>
  </div></body></html>`);
});

app.get('/dashboard/buyers', async (req, res) => {
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const sector = req.query.sector ? String(req.query.sector) : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const perPage = Math.min(50, Math.max(5, Number(req.query.per_page || 10)));
  const filtered = buyers.filter(b => !sector || (b.sector_focus || []).includes(sector))
    .sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);
  const sectors = [...new Set(buyers.flatMap(b=>b.sector_focus||[]))].sort();
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const hqCountryByBuyerId = {
    PIF: 'Saudi Arabia',
    GIC: 'Kuwait',
    AFC: 'Nigeria',
    NSIA: 'Nigeria',
    'FMF-NG': 'Nigeria',
    ADFD: 'United Arab Emirates',
    SFD: 'Saudi Arabia',
    AfDB: 'Côte d’Ivoire',
    IFC: 'United States',
    MUBADALA: 'United Arab Emirates',
    TPO: 'United States',
    HCC: 'United States',
    ANSCHUTZ: 'United States',
    DFC: 'United States',
    KOCH: 'United States',
    COX: 'United States',
    WORLDBANK: 'United States',
    ADB: 'Philippines',
    EBRD: 'United Kingdom',
    IDB: 'United States',
    TEMASEK: 'Singapore',
    ADQ: 'United Arab Emirates',
    QIA: 'Qatar',
    JBIC: 'Japan',
  };
  res.type('html').send(`<!doctype html><html><head>${uiHead('Buyers')}</head><body><div class="app-shell">
    ${dashboardNav('buyers')}
    <div class="d-flex justify-content-between align-items-center mb-2"><h1 class="page-title">Buyers</h1></div>
    ${canEdit ? `<div id="addBuyerBox" class="collapse mb-3"><div class="card"><div class="card-body">
      <h6>Add Buyer</h6>
      <form method="post" action="/api/buyers" class="row g-2">
        <div class="col-md-3"><input class="form-control" name="buyer_id" placeholder="Buyer ID (e.g., PIF)" required></div>
        <div class="col-md-5"><input class="form-control" name="name" placeholder="Buyer name" required></div>
        <div class="col-md-2"><input class="form-control" name="type" placeholder="Type" value="Sovereign"></div>
        <div class="col-md-2"><input class="form-control" name="score" placeholder="Score" value="1.0"></div>
        <div class="col-12"><textarea class="form-control" name="mandate_summary" rows="2" placeholder="Mandate summary"></textarea></div>
        <div class="col-md-6"><input class="form-control" name="geo_focus" placeholder="Geo focus (comma separated)"></div>
        <div class="col-md-6"><input class="form-control" name="sector_focus" placeholder="Sector focus (comma separated)"></div>
        <div class="col-12"><button class="btn btn-primary" type="submit">Save Buyer</button></div>
      </form>
    </div></div></div>` : ''}
    <form id="buyersFilterForm" class="row g-2 mb-3" method="get" action="/dashboard/buyers"><div class="col-4"><select class="form-select" name="sector"><option value="">All sectors</option>${sectors.map(s=>`<option ${s===sector?'selected':''}>${s}</option>`).join('')}</select></div><div class="col-2"><select class="form-select" name="per_page"><option value="10" ${perPage===10?'selected':''}>10</option><option value="20" ${perPage===20?'selected':''}>20</option><option value="50" ${perPage===50?'selected':''}>50</option></select></div></form>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>#</th><th>Buyer</th><th>HQ Country</th><th>Type</th><th>Score</th><th>Tracking</th><th>Sectors</th></tr></thead><tbody>${pageRows.map((b, idx)=>`<tr><td class="mono text-muted">${start + idx + 1}</td><td><a href="/dashboard/buyer/${encodeURIComponent(b.buyer_id)}">${escapeHtml(b.name)}</a><div class="small text-muted mono">${escapeHtml(b.buyer_id || '')}</div></td><td>${escapeHtml(b.hq_country || hqCountryByBuyerId[String(b.buyer_id || '')] || '—')}</td><td>${escapeHtml(b.type||'')}</td><td>${b.score ?? ''}</td><td><span class="badge text-bg-${String(b.signal_status||'Monitor') === 'Verified' ? 'success' : (String(b.signal_status||'Monitor') === 'Actioned' ? 'primary' : 'secondary')}">${escapeHtml(String(b.signal_status||'Monitor'))}</span></td><td>${escapeHtml((b.sector_focus||[]).join(', '))}</td></tr>`).join('') || '<tr><td colspan="7">No buyers found</td></tr>'}</tbody></table></div>
    <div class="d-flex justify-content-between align-items-center small text-muted mb-3"><span>Showing ${start + 1}-${Math.min(start + perPage, total)} of ${total}</span><div class="btn-group btn-group-sm"><a class="btn btn-outline-secondary ${currentPage<=1?'disabled':''}" href="?sector=${encodeURIComponent(sector)}&per_page=${perPage}&page=${Math.max(1,currentPage-1)}">Prev</a><span class="btn btn-outline-secondary disabled">Page ${currentPage} / ${totalPages}</span><a class="btn btn-outline-secondary ${currentPage>=totalPages?'disabled':''}" href="?sector=${encodeURIComponent(sector)}&per_page=${perPage}&page=${Math.min(totalPages,currentPage+1)}">Next</a></div></div>

    ${canEdit ? `<div class="card mt-3"><div class="card-body">
      <h6>Initiative Idea Builder (UOS-grounded)</h6>
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label">Buyer</label><select id="ideaBuyer" class="form-select">${buyers.map(b=>`<option value="${escapeHtml(b.buyer_id)}">${escapeHtml(b.buyer_id)} — ${escapeHtml(b.name)}</option>`).join('')}</select></div>
        <div class="col-md-6"><label class="form-label">Prompt (optional)</label><input id="ideaPrompt" class="form-control" placeholder="e.g., focus on West Africa, pre-FID, risk-compression" /></div>
        <div class="col-md-2 d-flex align-items-end"><button id="genIdeasBtn" class="btn btn-primary w-100" type="button">Suggest Initiatives</button></div>
      </div>
      <div id="ideaResults" class="mt-3"></div>
    </div></div>` : ''}
  </div>
  <script>
    document.querySelectorAll('#buyersFilterForm select').forEach((el) => {
      el.addEventListener('change', () => {
        const form = document.getElementById('buyersFilterForm');
        if (form) form.submit();
      });
    });
  </script>
  ${canEdit ? `<script>
    const addBuyerToggle = document.getElementById('addBuyerToggle');
    const addBuyerBox = document.getElementById('addBuyerBox');
    addBuyerToggle?.addEventListener('click', () => {
      addBuyerBox?.classList.toggle('show');
    });

    async function createInitiative(payload){
      const r = await fetch('/api/initiatives', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(!r.ok){ const t=await r.text(); alert('Create failed: '+t); return; }
      const j=await r.json();
      window.location.href = '/dashboard/initiative/' + encodeURIComponent(j.initiative_id) + '?buyer_id=' + encodeURIComponent(payload.linked_buyers?.[0] || '');
    }

    document.getElementById('genIdeasBtn')?.addEventListener('click', async () => {
      const buyer_id = document.getElementById('ideaBuyer').value;
      const prompt = document.getElementById('ideaPrompt').value || '';
      const r = await fetch('/api/initiatives/suggest', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ buyer_id, prompt, count: 5 })});
      const box = document.getElementById('ideaResults');
      if(!r.ok){ box.innerHTML = '<div class="text-danger">Suggestion failed.</div>'; return; }
      const j = await r.json();
      const ideas = j.ideas || [];
      if(!ideas.length){ box.innerHTML = '<div class="text-muted">No suggestions.</div>'; return; }
      box.innerHTML = ideas.map((x,i)=>{
        return '<div class="card mb-2"><div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-center"><strong>' + x.name + '</strong><button class="btn btn-sm btn-success" data-idx="' + i + '">Use this</button></div>' +
          '<div class="small text-muted">Status: ' + x.status + '</div>' +
          '<div class="small">' + x.macro_gravity_summary + '</div>' +
        '</div></div>';
      }).join('');
      box.querySelectorAll('button[data-idx]').forEach(btn => btn.addEventListener('click', () => createInitiative(ideas[Number(btn.dataset.idx)])));
    });
  </script>` : ''}
</body></html>`);
});

app.get('/dashboard/signals', async (req, res) => {
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const byId = Object.fromEntries(buyers.map((b) => [b.buyer_id, b.name]));
  const classes = ['Capital Reality','FID Definability','Structural Ambiguity','Platform Pressure','Sponsor Altitude','Ecosystem / Theater'];
  const selectedClass = String(req.query.signal_class || 'All');
  const filteredSignals = selectedClass === 'All' ? signals : signals.filter((s) => String(s.signal_class || '') === selectedClass);
  const sorted = [...filteredSignals].sort((a, b) => String(b.observed_at || '').localeCompare(String(a.observed_at || '')));
  const statusBadge = (s) => {
    const v = String(s || 'Monitor');
    const cls = v === 'Verified' ? 'success' : (v === 'Actioned' ? 'primary' : 'secondary');
    return `<span class="badge text-bg-${cls}">${escapeHtml(v)}</span>`;
  };
  const signalRowsJson = JSON.stringify(sorted.map((s) => `<tr><td class="mono small">${escapeHtml(String(s.observed_at || '').slice(0,10))}</td><td><strong>${escapeHtml(s.title || '')}</strong><div class="small text-muted">${escapeHtml(s.summary || '')}</div></td><td>${escapeHtml(s.signal_class || '—')}</td><td>${statusBadge(s.status)}</td><td>${escapeHtml(s.confidence || '')}</td><td>${(s.buyer_ids || []).map((id) => `<span tabindex="0" class="badge text-bg-light border me-1 buyer-tip" title="${escapeHtml(byId[id] || id)}" data-fullname="${escapeHtml(byId[id] || id)}">${escapeHtml(id)}</span>`).join('') || '—'}</td><td><a class="btn btn-sm btn-outline-secondary" href="/dashboard/capital-map?signal=${encodeURIComponent(String(s.signal_id || ''))}">View Capital Map</a></td></tr>`)).replace(/</g, '\\u003c');
  res.type('html').send(`<!doctype html><html><head>${uiHead('Signals')}</head><body><div class="app-shell">
    ${dashboardNav('signals')}
    ${pageHeader('Signal Register', '<a class="btn btn-sm btn-outline-secondary" href="/dashboard/capital-map">View Capital Map</a>', 'Pressure surface tracking over time')}
    <form method="get" action="/dashboard/signals" class="row g-2 mb-3">
      <div class="col-md-4">
        <label class="form-label">Filter by Signal Class</label>
        <select class="form-select" name="signal_class">
          <option ${selectedClass==='All'?'selected':''}>All</option>
          ${classes.map((c)=>`<option ${selectedClass===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-2 d-flex align-items-end"><button class="btn btn-outline-primary">Apply</button></div>
    </form>
    ${canEdit ? `<details class="card mb-3"><summary class="card-header"><strong>Add Signal</strong></summary><div class="card-body"><form method="post" action="/api/signals" class="row g-2"><div class="col-md-4"><label class="form-label">Title *</label><input class="form-control" name="title" required /></div><div class="col-md-2"><label class="form-label">Status</label><select class="form-select" name="status"><option>Monitor</option><option>Verified</option><option>Actioned</option></select></div><div class="col-md-2"><label class="form-label">Confidence</label><select class="form-select" name="confidence"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="col-md-4"><label class="form-label">Signal Class *</label><select class="form-select" name="signal_class" required>${classes.map((c)=>`<option>${c}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Buyer IDs (comma)</label><input class="form-control" name="buyer_ids" placeholder="PIF, AFC" /></div><div class="col-md-8"><label class="form-label">Summary</label><input class="form-control" name="summary" /></div><div class="col-12"><button class="btn btn-sm btn-primary">Save Signal</button></div></form></div></details>` : ''}
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Date</th><th>Signal</th><th>Signal Class</th><th>Status</th><th>Confidence</th><th>Linked Buyers</th><th></th></tr></thead><tbody id="signalsTbody"></tbody></table></div>
    <div id="signalsEnd" class="text-center small text-muted py-3"></div>
    <div id="signalsSentinel" style="height:1px"></div>
  </div>
  <script>
    (() => {
      const rows = ${signalRowsJson};
      const tbody = document.getElementById('signalsTbody');
      const sentinel = document.getElementById('signalsSentinel');
      const end = document.getElementById('signalsEnd');
      if (!tbody || !sentinel || !end) return;

      const pageSize = 20;
      let idx = 0;
      function initTooltips(scope) {
        (scope || document).querySelectorAll('.buyer-tip').forEach((el) => {
          if (el.dataset.tipBound === '1') return;
          el.dataset.tipBound = '1';
          el.addEventListener('click', () => {
            const full = el.getAttribute('data-fullname') || el.getAttribute('title') || '';
            if (!full) return;
            const existing = el.parentElement.querySelector('.buyer-tip-inline');
            if (existing) existing.remove();
            const tag = document.createElement('span');
            tag.className = 'buyer-tip-inline ms-1 small text-info';
            tag.textContent = full;
            el.insertAdjacentElement('afterend', tag);
            setTimeout(() => tag.remove(), 2200);
          });
        });
      }
      function renderNext() {
        if (idx >= rows.length) {
          end.textContent = rows.length ? 'End of signals' : 'No signals yet';
          return false;
        }
        const slice = rows.slice(idx, idx + pageSize).join('');
        tbody.insertAdjacentHTML('beforeend', slice);
        initTooltips(tbody);
        idx += pageSize;
        end.textContent = idx < rows.length ? ('Loaded ' + Math.min(idx, rows.length) + ' of ' + rows.length) : 'End of signals';
        return idx < rows.length;
      }

      renderNext();
      const io = new IntersectionObserver((entries) => {
        if (!entries.some(e => e.isIntersecting)) return;
        const hasMore = renderNext();
        if (!hasMore) io.disconnect();
      }, { rootMargin: '300px 0px' });
      io.observe(sentinel);
    })();
  </script>
  </body></html>`);
});

app.get('/dashboard/beacons', requireAnyAuth, async (req, res) => {
  const q = await readBeaconQueue();
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const rows = [...(q.beacons || [])].sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  const view = String(req.query.view || 'cards').toLowerCase() === 'table' ? 'table' : 'cards';
  const nextOptions = ['draft','harden','review','approved','published','hold','rejected'];
  const statusBadge = (v) => {
    const c = ({ draft:'secondary', harden:'info', review:'warning', approved:'primary', published:'success', hold:'dark', rejected:'danger' }[String(v||'').toLowerCase()]) || 'secondary';
    return `<span class="badge text-bg-${c}">${escapeHtml(String(v || 'draft'))}</span>`;
  };
  res.type('html').send(`<!doctype html><html><head>${uiHead('Beacons')}</head><body><div class="app-shell">
    ${dashboardNav('beacons')}
    ${pageHeader('Beacons Queue', '', 'Sponsor Beacon operating queue with governance transitions')}
    ${canEdit ? `<details class="card mb-3"><summary class="card-header"><strong>Generate Beacon from Signal</strong></summary><div class="card-body"><form method="post" action="/api/beacons/generate-from-signal" class="row g-2"><div class="col-md-4"><label class="form-label">Signal</label><select class="form-select" name="signal_id" required>${signals.map((s)=>`<option value="${escapeHtml(s.signal_id || '')}">${escapeHtml(s.signal_id || '')} — ${escapeHtml(s.title || '')}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Initiative</label><select class="form-select" name="initiative_id" required>${initiatives.map((i)=>`<option value="${escapeHtml(i.initiative_id || '')}">${escapeHtml(i.initiative_id || '')} — ${escapeHtml(i.name || '')}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Mandate Implication <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1 align-baseline" aria-label="What is mandate implication" onclick="const n=this.parentElement.parentElement.querySelector('.mi-help'); if(n){n.classList.toggle('d-none');}">ⓘ</button></label><div class="mi-help small text-muted d-none mb-1">Write 1-2 lines on what action this signal should trigger for mandate progress (e.g., refine narrative, shape mandate, build governance path, structure capital pathway, or monitor only).</div><input class="form-control" name="mandate_implication" placeholder="Ex: Capital signal is rising but governance is weak -> prioritize governance path with DFI co-sponsor." required /></div><div class="col-12"><button class="btn btn-sm btn-success">Generate Beacon</button></div></form></div></details>
    <details class="card mb-3"><summary class="card-header"><strong>Add Beacon Draft</strong></summary><div class="card-body"><form method="post" action="/api/beacons" class="row g-2"><div class="col-md-4"><label class="form-label">Title</label><input class="form-control" name="title" required /></div><div class="col-md-4"><label class="form-label">Signal ID</label><input class="form-control" name="signal_id" required /></div><div class="col-md-4"><label class="form-label">Initiative ID</label><input class="form-control" name="initiative_id" required /></div><div class="col-12"><label class="form-label">Mandate Implication <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1 align-baseline" aria-label="What is mandate implication" onclick="const n=this.parentElement.parentElement.querySelector('.mi-help'); if(n){n.classList.toggle('d-none');}">ⓘ</button></label><div class="mi-help small text-muted d-none mb-1">Write the specific mandate consequence of this beacon: what should USG do next, for whom, and why now.</div><input class="form-control" name="mandate_implication" placeholder="Ex: Move from Track -> Engage Soon by validating governance sponsor and drafting structuring pathway." required /></div><div class="col-12"><label class="form-label">Draft Text</label><textarea class="form-control" name="draft_text" rows="3" required></textarea></div><div class="col-12"><button class="btn btn-sm btn-primary">Create Beacon</button></div></form></div></details>` : ''}
    <div class="d-flex gap-2 mb-3">
      <a class="btn btn-sm ${view==='cards' ? 'btn-primary' : 'btn-outline-primary'}" href="/dashboard/beacons?view=cards">Cards</a>
      <a class="btn btn-sm ${view==='table' ? 'btn-primary' : 'btn-outline-primary'}" href="/dashboard/beacons?view=table">Table</a>
    </div>
    ${view==='table' ? `<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Beacon</th><th>Status</th><th>Signal</th><th>Initiative</th><th>Lint</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((b)=>`<tr><td><strong>${escapeHtml(b.title || b.beacon_id || '')}</strong><div class="small mono text-muted">${escapeHtml(b.beacon_id || '')}</div></td><td>${statusBadge(b.status || '')}</td><td>${escapeHtml(b.signal_id || '')}</td><td>${escapeHtml(b.initiative_id || '')}</td><td>${escapeHtml(b.lint_status || 'UNKNOWN')}</td><td class="mono small">${escapeHtml(String(b.updated_at || '').slice(0,19).replace('T',' '))}</td><td>${canEdit ? `<form method="post" action="/api/beacons/${encodeURIComponent(b.beacon_id || '')}/transition" class="d-flex gap-1"><select class="form-select form-select-sm" name="to_status">${nextOptions.map((s)=>`<option>${s}</option>`).join('')}</select><button class="btn btn-sm btn-outline-primary">Move</button></form>` : '—'}</td></tr>`).join('') || '<tr><td colspan="7">No beacons in queue</td></tr>'}
    </tbody></table></div>` : `<div class="row g-3">${rows.map((b)=>`<div class="col-12"><div class="card"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-2"><div><h5 class="mb-1">${escapeHtml(b.title || b.beacon_id || '')}</h5><div class="small mono text-muted">${escapeHtml(b.beacon_id || '')}</div></div><div>${statusBadge(b.status || '')}</div></div><div class="small text-muted mt-2">Signal: <strong>${escapeHtml(b.signal_id || '—')}</strong> · Initiative: <strong>${escapeHtml(b.initiative_id || '—')}</strong> · Lint: <strong>${escapeHtml(b.lint_status || 'UNKNOWN')}</strong> · Updated: <span class="mono">${escapeHtml(String(b.updated_at || '').slice(0,19).replace('T',' '))}</span></div><div class="mt-3" style="white-space:pre-wrap">${escapeHtml(b.draft_text || '(no draft text)')}</div>${canEdit ? `<form method="post" action="/api/beacons/${encodeURIComponent(b.beacon_id || '')}/transition" class="d-flex gap-1 mt-3"><select class="form-select form-select-sm" name="to_status" style="max-width:180px">${nextOptions.map((s)=>`<option>${s}</option>`).join('')}</select><button class="btn btn-sm btn-outline-primary">Move</button></form>` : ''}</div></div></div>`).join('') || '<div class="col-12"><div class="card"><div class="card-body text-muted">No beacons in queue</div></div></div>'}</div>`}
  </div></body></html>`);
});

app.get('/dashboard/team', async (_req, res) => {
  const team = await readJson(DASHBOARD_TEAM_FILE, []);
  const sorted = [...team].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  res.type('html').send(`<!doctype html><html><head>${uiHead('Team')}</head><body><div class="app-shell">
    ${dashboardNav('team')}
    ${pageHeader('Team Directory', '', 'USG operator contacts and roles')}
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Name</th><th>Title</th><th>Role</th><th>Email</th><th>Status</th></tr></thead><tbody>
      ${sorted.map((m)=>`<tr><td>${escapeHtml(m.name || '')}</td><td>${escapeHtml(m.title || 'TBD')}</td><td>${escapeHtml(m.role || 'TBD')}</td><td>${m.email ? `<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>` : '—'}</td><td>${escapeHtml(m.status || 'active')}</td></tr>`).join('') || '<tr><td colspan="5">No team records</td></tr>'}
    </tbody></table></div>
  </div></body></html>`);
});

app.get('/dashboard/initiatives', async (req, res) => {
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const byId = Object.fromEntries(buyers.map(b => [b.buyer_id, b.name]));
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const category = String(req.query.category || 'All');
  const weakestLayerFilter = String(req.query.weakest_layer || 'All');
  const primaryConstraintFilter = String(req.query.primary_constraint || 'All');
  const sortBy = String(req.query.sort_by || 'updated_desc');
  const categories = ['All', ...new Set(initiatives.map((i)=>String(i.infrastructure_category || '').trim()).filter((c)=>Boolean(c) && c !== 'All'))];
  const sorted = [...initiatives].sort((a, b) => {
    const at = Date.parse(String(a.gate_updated_at || '')) || 0;
    const bt = Date.parse(String(b.gate_updated_at || '')) || 0;
    if (bt !== at) return bt - at;
    return String(a.initiative_id).localeCompare(String(b.initiative_id));
  });
  const gateOptions = ['Gate 0','Gate 1','Gate 2','Gate 3','Gate 4','Gate 5','Gate 6','Gate 7'];
  const inferGate = (i) => i.gate_stage || (String(i.status || '').toLowerCase()==='pre-fid' ? 'Gate 1' : 'Gate 1');
  const LAYERS = ['political','asset','development','capital','delivery'];
  const WEIGHT = { missing: 0, identified: 0.25, validated: 0.5, engaged: 0.75, committed: 1 };
  const normLayers = (i) => normalizeActorAlignment(i);
  const alignmentSummary = (i) => {
    const layers = normLayers(i);
    const layerScores = {};
    let all = [];
    for (const l of LAYERS) {
      const rows = layers[l];
      all = all.concat(rows.map((r) => ({ ...r, layer: l })));
      if (!rows.length) { layerScores[l] = 0; continue; }
      const avg = rows.reduce((s, r) => s + (WEIGHT[String(r?.status || 'missing')] ?? 0), 0) / rows.length;
      layerScores[l] = Number((avg * 100).toFixed(0));
    }
    const overall = Number((LAYERS.reduce((s, l) => s + layerScores[l], 0) / LAYERS.length).toFixed(0));
    const missingRoles = all.filter((r) => String(r?.status || 'missing') === 'missing').length;
    let weakestLayer = LAYERS[0];
    for (const l of LAYERS) if (layerScores[l] < layerScores[weakestLayer]) weakestLayer = l;
    const rank = ['political_sponsor','regulator','asset_owner','operator','off_taker','anchor_equity','development_finance_lender','project_developer','technical_integrator','epc_contractor','key_supplier'];
    const sortKey = (r) => {
      const w = WEIGHT[String(r?.status || 'missing')] ?? 0;
      const idx = rank.indexOf(String(r?.role_id || ''));
      return `${w.toFixed(2)}_${idx >= 0 ? String(idx).padStart(3,'0') : '999'}`;
    };
    const candidatesCritical = all.filter((r) => Boolean(r?.is_critical_role) && ['missing','identified','validated'].includes(String(r?.status || 'missing'))).sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
    const candidatesAny = all.filter((r) => ['missing','identified','validated'].includes(String(r?.status || 'missing'))).sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
    const primary = candidatesCritical[0] || candidatesAny[0] || null;
    return { layerScores, overall, missingRoles, weakestLayer, primaryConstraint: primary ? (primary.role_label || primary.role_id || 'Unspecified role') : 'None' };
  };
  const enrichedAll = sorted.map((i) => ({ initiative: i, align: alignmentSummary(i) }));
  const weakestLayerOptions = ['All', ...LAYERS.map((x) => x)];
  const primaryConstraintOptions = ['All', ...new Set(enrichedAll.map((x) => x.align.primaryConstraint).filter((x) => x && x !== 'None'))];
  let enriched = enrichedAll.filter(({ initiative:i, align:a }) => {
    if (category !== 'All' && String(i.infrastructure_category || '') !== category) return false;
    if (weakestLayerFilter !== 'All' && String(a.weakestLayer || '') !== weakestLayerFilter) return false;
    if (primaryConstraintFilter !== 'All' && String(a.primaryConstraint || '') !== primaryConstraintFilter) return false;
    return true;
  });
  if (sortBy === 'alignment_asc') enriched.sort((x,y)=>x.align.overall - y.align.overall);
  else if (sortBy === 'alignment_desc') enriched.sort((x,y)=>y.align.overall - x.align.overall);
  else if (sortBy === 'actor_gaps_desc') enriched.sort((x,y)=>y.align.missingRoles - x.align.missingRoles);
  else if (sortBy === 'actor_gaps_asc') enriched.sort((x,y)=>x.align.missingRoles - y.align.missingRoles);
  else if (sortBy === 'weakest_layer') enriched.sort((x,y)=>String(x.align.weakestLayer).localeCompare(String(y.align.weakestLayer)));
  else if (sortBy === 'primary_constraint') enriched.sort((x,y)=>String(x.align.primaryConstraint).localeCompare(String(y.align.primaryConstraint)));
  const weakestCounts = Object.fromEntries(LAYERS.map((l) => [l, enrichedAll.filter((x) => x.align.weakestLayer === l).length]));

  res.type('html').send(`<!doctype html><html><head>${uiHead('Initiatives')}</head><body><div class="app-shell">
    ${dashboardNav('initiatives')}
    ${pageHeader('Initiatives', '', 'Gate 0–7 is the canonical initiative workflow')}
    <form id="initiativesFilterForm" method="get" action="/dashboard/initiatives" class="row g-2 mb-3"><div class="col-md-2"><select class="form-select" name="category">${categories.map((c)=>`<option value="${escapeHtml(c)}" ${c===category?'selected':''}>${escapeHtml(c||'Uncategorized')}</option>`).join('')}</select></div><div class="col-md-2"><select class="form-select" name="weakest_layer">${weakestLayerOptions.map((c)=>`<option value="${escapeHtml(c)}" ${c===weakestLayerFilter?'selected':''}>Weakest Layer: ${escapeHtml(c)}</option>`).join('')}</select></div><div class="col-md-3"><select class="form-select" name="primary_constraint">${primaryConstraintOptions.map((c)=>`<option value="${escapeHtml(c)}" ${c===primaryConstraintFilter?'selected':''}>Primary Constraint: ${escapeHtml(c)}</option>`).join('')}</select></div><div class="col-md-3"><select class="form-select" name="sort_by"><option value="updated_desc" ${sortBy==='updated_desc'?'selected':''}>Sort: Updated</option><option value="alignment_desc" ${sortBy==='alignment_desc'?'selected':''}>Sort: Alignment ↓</option><option value="alignment_asc" ${sortBy==='alignment_asc'?'selected':''}>Sort: Alignment ↑</option><option value="actor_gaps_desc" ${sortBy==='actor_gaps_desc'?'selected':''}>Sort: Actor Gaps ↓</option><option value="actor_gaps_asc" ${sortBy==='actor_gaps_asc'?'selected':''}>Sort: Actor Gaps ↑</option><option value="weakest_layer" ${sortBy==='weakest_layer'?'selected':''}>Sort: Weakest Layer</option><option value="primary_constraint" ${sortBy==='primary_constraint'?'selected':''}>Sort: Primary Constraint</option></select></div><div class="col-md-2"><a class="btn btn-outline-secondary w-100" href="/dashboard/initiatives">Reset</a></div></form>
    <div class="card mb-3"><div class="card-body py-2"><div class="small text-muted mb-1">Actor Gap Analytics (all initiatives)</div><div class="d-flex flex-wrap gap-2">${LAYERS.map((l)=>`<span class="badge text-bg-light border">${escapeHtml(l)}: ${weakestCounts[l]}</span>`).join('')}</div></div></div>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ID</th><th>Name</th><th>Infrastructure Type</th><th>Gate Stage</th><th>Actor Gaps</th><th>Alignment %</th><th>Weakest Layer</th><th>Primary Constraint</th><th>Linked Buyers</th><th>Updated</th><th class="text-end">Actions</th></tr></thead><tbody>
      ${enriched.map(({initiative:i, align:a})=>`<tr><td><a href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}">${escapeHtml(i.initiative_id)}</a></td><td>${escapeHtml(i.name || '')}</td><td>${escapeHtml(i.infrastructure_category || '—')}</td><td>${canEdit ? `<form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/gate" class="initiative-gate-form d-inline"><select name="gate_stage" class="form-select form-select-sm initiative-gate-select" style="min-width:110px">${gateOptions.map(g=>`<option value="${g}" ${inferGate(i)===g?'selected':''}>${g}</option>`).join('')}</select></form>` : escapeHtml(inferGate(i))}</td><td>${a.missingRoles}</td><td><strong>${a.overall}%</strong></td><td class="text-capitalize">${escapeHtml(a.weakestLayer)}</td><td>${escapeHtml(a.primaryConstraint)}</td><td>${(i.linked_buyers || []).map((id) => `<span tabindex="0" class="badge text-bg-light border me-1 buyer-tip" title="${escapeHtml(byId[id] || id)}" data-fullname="${escapeHtml(byId[id] || id)}">${escapeHtml(id)}</span>`).join('') || '—'}</td><td class="small text-muted mono">${escapeHtml(String(i.gate_updated_at || '').slice(0,10) || '—')}</td><td class="text-end">${canEdit ? `<details class="initiative-actions-menu d-inline-block text-start"><summary class="btn btn-sm btn-outline-secondary" aria-label="More actions">⋯</summary><div class="card p-1 mt-1" style="position:absolute;z-index:20;min-width:160px;"><a class="dropdown-item" href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}">View Initiative</a><a class="dropdown-item" href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}?edit=1">Edit</a><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/delete" onsubmit="return confirm('Delete initiative ${escapeHtml(i.initiative_id)}? This cannot be undone.');"><button class="dropdown-item text-danger" type="submit">Delete</button></form></div></details>` : '—'}</td></tr>`).join('') || '<tr><td colspan="11">No initiatives</td></tr>'}
    </tbody></table></div>
  </div>
  <script>
    document.querySelectorAll('#initiativesFilterForm select').forEach((el) => {
      el.addEventListener('change', () => {
        document.getElementById('initiativesFilterForm')?.submit();
      });
    });
    document.querySelectorAll('.initiative-gate-select').forEach((el) => {
      el.addEventListener('change', () => {
        const form = el.closest('form');
        if (form) form.submit();
      });
    });
  </script>
</body></html>`);
});

app.get('/dashboard/buyer/:id', async (req, res) => {
  const id = String(req.params.id);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const contactPaths = await readJson(DASHBOARD_CONTACT_PATHS_FILE, []);
  const decisionArch = await readJson(DASHBOARD_DECISION_ARCH_FILE, []);
  const board = await readJson(BOARD_FILE, { version: 1, tasks: [] });
  const b = buyers.find(x=>x.buyer_id===id);
  if(!b) return res.status(404).send('Buyer not found');

  const linked = initiatives.filter(i => (b.initiatives||[]).includes(i.initiative_id));
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const buyerSignals = signals
    .filter((s) => Array.isArray(s.buyer_ids) && s.buyer_ids.includes(id))
    .sort((a,b) => String(b.observed_at || '').localeCompare(String(a.observed_at || '')));

  const statusWeight = { High: 3, Medium: 2, Low: 1 };
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recencyFactor = (ageDays) => {
    if (ageDays <= 7) return 1.0;
    if (ageDays <= 14) return 0.7;
    if (ageDays <= 30) return 0.4;
    return 0;
  };
  const weightedScore = (s) => {
    const observed = Date.parse(String(s.observed_at || ''));
    if (!Number.isFinite(observed)) return 0;
    const ageDays = Math.max(0, (nowMs - observed) / dayMs);
    return (statusWeight[String(s.confidence || 'Low')] || 1) * recencyFactor(ageDays);
  };

  const currentWindow = buyerSignals.filter((s) => {
    const observed = Date.parse(String(s.observed_at || ''));
    return Number.isFinite(observed) && (nowMs - observed) <= (30 * dayMs);
  });

  const previousWindow = buyerSignals.filter((s) => {
    const observed = Date.parse(String(s.observed_at || ''));
    if (!Number.isFinite(observed)) return false;
    const age = nowMs - observed;
    return age > (30 * dayMs) && age <= (60 * dayMs);
  });

  const pressureIndex = Number(currentWindow.reduce((sum, s) => sum + weightedScore(s), 0).toFixed(1));
  const previousPressure = Number(previousWindow.reduce((sum, s) => sum + weightedScore(s), 0).toFixed(1));
  const trend = pressureIndex > previousPressure ? 'Rising' : (pressureIndex < previousPressure ? 'Cooling' : 'Stable');
  const topSignals = currentWindow.slice(0,2);

  const highRecent = currentWindow.filter((s) => String(s.confidence || '') === 'High').length;
  const mediumRecent = currentWindow.filter((s) => String(s.confidence || '') === 'Medium').length;

  const buyerTasks = (board.tasks || [])
    .filter((t) => {
      const refs = (t.linked_refs || []).map((x) => String(x).toUpperCase());
      const tags = (t.tags || []).map((x) => String(x).toUpperCase());
      return refs.includes(id) || tags.includes(`BUYER:${id}`);
    })
    .filter((t) => !['Done'].includes(String(t.status || '')))
    .sort((a,b) => String(a.priority || 'P3').localeCompare(String(b.priority || 'P3')))
    .slice(0,3);

  const inProgressCount = buyerTasks.filter((t) => ['Doing','Ready for Review'].includes(String(t.status || ''))).length;
  const nextAction = buyerTasks[0]?.title || 'No action set yet';
  const nextOwnerDue = buyerTasks[0] ? `${buyerTasks[0].owner || 'Unassigned'} / ${buyerTasks[0].due_date || 'No due date'}` : 'Unassigned / No due date';
  const blocker = buyerSignals.length ? 'Verification evidence path still open' : 'No linked signals yet';

  const canUpgradeToVerified = !!String(b.transfer_hypothesis || '').trim() && (highRecent >= 1 || mediumRecent >= 2) && buyerTasks.length >= 1;
  const canUpgradeToActioned = inProgressCount >= 1 && linked.length >= 1;
  const tc = b.transfer_chain || null;
  const accessPaths = (contactPaths || [])
    .filter((p) => String(p.buyer_id || '').toUpperCase() === String(id || '').toUpperCase())
    .sort((a, b) => Number(b.influence_score || 0) - Number(a.influence_score || 0))
    .slice(0, 3);
  const daLevel = String(req.query.da || 'all').toLowerCase();
  const decisionRows = (decisionArch || [])
    .filter((x) => String(x.buyer_id || '').toUpperCase() === String(id || '').toUpperCase())
    .filter((x) => daLevel === 'all' ? true : String(x.influence || '').toLowerCase() === daLevel)
    .sort((a, b) => {
      const w = { high: 3, medium: 2, low: 1 };
      return (w[String(b.influence || '').toLowerCase()] || 0) - (w[String(a.influence || '').toLowerCase()] || 0);
    });

  res.type('html').send(`<!doctype html><html><head>${uiHead('Buyer Detail')}</head><body><div class="app-shell">
    ${dashboardNav('buyers')}
    <a class="btn btn-sm btn-outline-secondary mb-2" href="/dashboard/buyers">← Buyers</a>
    <h3>${escapeHtml(b.name)}</h3>
    <p>${escapeHtml(b.mandate_summary || '')}</p>
    <ul><li><strong>Score:</strong> ${b.score ?? ''}</li><li><strong>Geo:</strong> ${escapeHtml((b.geo_focus||[]).join(', '))}</li><li><strong>Sectors:</strong> ${escapeHtml((b.sector_focus||[]).join(', '))}</li><li><strong>Tracking Status:</strong> ${escapeHtml(String(b.signal_status || 'Monitor'))}</li><li><strong>Website:</strong> ${b.website ? `<a href="${escapeHtml(String(b.website))}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(b.website))}</a>` : 'Not set'}</li></ul>
    ${Array.isArray(b.website_notes) && b.website_notes.length ? `<div class="card mb-3"><div class="card-body"><h6>USG Positioning</h6><ul class="mb-0">${b.website_notes.map((n)=>`<li>${escapeHtml(String(n))}</li>`).join('')}</ul></div></div>` : ''}

    <details class="card mb-3">
      <summary class="card-header"><strong>Linked Initiatives</strong></summary>
      <div class="card-body">
        <ul class="mb-0">${linked.map(i=>`<li><a href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}?buyer_id=${encodeURIComponent(b.buyer_id)}">${escapeHtml(i.name)}</a></li>`).join('') || '<li>None</li>'}</ul>
      </div>
    </details>

    ${b.transfer_hypothesis ? `<div class="card mb-3"><div class="card-body"><h6>Transfer Hypothesis</h6><pre class="small mb-0" style="white-space:pre-wrap">${escapeHtml(String(b.transfer_hypothesis || ''))}</pre></div></div>` : ''}

    <details class="card mb-3">
      <summary class="card-header"><strong>Access Paths (Top 3)</strong></summary>
      <div class="card-body">
        <div class="small text-muted mb-2">Who in-network can open a trusted path into this buyer.</div>
        <ul class="mb-3">${accessPaths.map((p) => `<li class="mb-2"><strong>${escapeHtml(p.name || 'Unknown')}</strong> — ${escapeHtml(p.role || 'Role TBD')} · Score ${escapeHtml(String(p.influence_score ?? '0'))}<br/><span class="text-muted">Best ask: ${escapeHtml(p.best_ask_type || 'TBD')} · Status: ${escapeHtml(p.status || 'TBD')}</span>${canEdit ? `<form method="post" action="/api/contact-paths/${encodeURIComponent(p.path_id || '')}/delete" class="d-inline ms-2"><input type="hidden" name="buyer_id" value="${escapeHtml(b.buyer_id)}"/><button class="btn btn-sm btn-outline-danger">Delete</button></form>` : ''}</li>`).join('') || '<li>No access paths mapped yet.</li>'}</ul>
        ${canEdit ? `<details>
          <summary class="small"><strong>Add / Update Access Path</strong></summary>
          <form method="post" action="/api/contact-paths" class="row g-2 mt-2">
            <input type="hidden" name="buyer_id" value="${escapeHtml(b.buyer_id)}" />
            <div class="col-md-3"><label class="form-label">Path ID (optional)</label><input class="form-control" name="path_id" placeholder="PATH-${escapeHtml(b.buyer_id)}-001" /></div>
            <div class="col-md-3"><label class="form-label">Name *</label><input class="form-control" name="name" required /></div>
            <div class="col-md-3"><label class="form-label">Role</label><input class="form-control" name="role" /></div>
            <div class="col-md-3"><label class="form-label">Org</label><input class="form-control" name="org" /></div>
            <div class="col-md-2"><label class="form-label">Access</label><input type="number" step="1" min="0" max="5" class="form-control" name="access_score" value="3" /></div>
            <div class="col-md-2"><label class="form-label">Credibility</label><input type="number" step="1" min="0" max="5" class="form-control" name="credibility_score" value="3" /></div>
            <div class="col-md-2"><label class="form-label">Relevance</label><input type="number" step="1" min="0" max="5" class="form-control" name="relevance_score" value="3" /></div>
            <div class="col-md-2"><label class="form-label">Freshness(d)</label><input type="number" step="1" min="0" class="form-control" name="freshness_days" value="7" /></div>
            <div class="col-md-2"><label class="form-label">Influence</label><input type="number" step="0.1" min="0" max="5" class="form-control" name="influence_score" value="3.0" /></div>
            <div class="col-md-2"><label class="form-label">Status</label><select class="form-select" name="status"><option>Ready</option><option>Warming</option><option>Blocked</option></select></div>
            <div class="col-12"><label class="form-label">Best Ask Type</label><input class="form-control" name="best_ask_type" /></div>
            <div class="col-12"><label class="form-label">Evidence Note</label><textarea class="form-control" name="evidence_note" rows="2"></textarea></div>
            <div class="col-md-6"><label class="form-label">Last Touch</label><input class="form-control" name="last_touch_at" placeholder="YYYY-MM-DD" /></div>
            <div class="col-md-6"><label class="form-label">Next Touch</label><input class="form-control" name="next_touch_at" placeholder="YYYY-MM-DD" /></div>
            <div class="col-12"><button class="btn btn-sm btn-primary">Save Access Path</button></div>
          </form>
        </details>` : ''}
      </div>
    </details>

    <details class="card mb-3">
      <summary class="card-header"><strong>Decision Architecture</strong></summary>
      <div class="card-body">
        <div class="small text-muted mb-2">Who influences buyer decisions and which lane they control.</div>
        <div class="btn-group btn-group-sm mb-2" role="group" aria-label="Decision Architecture filter">
          <a class="btn ${daLevel==='all'?'btn-primary':'btn-outline-primary'}" href="?da=all">All</a>
          <a class="btn ${daLevel==='high'?'btn-primary':'btn-outline-primary'}" href="?da=high">High</a>
          <a class="btn ${daLevel==='medium'?'btn-primary':'btn-outline-primary'}" href="?da=medium">Medium</a>
          <a class="btn ${daLevel==='low'?'btn-primary':'btn-outline-primary'}" href="?da=low">Low</a>
        </div>
        <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Person</th><th>Role</th><th>Lane</th><th>Influence</th><th>Engagement Use</th><th>Source</th></tr></thead><tbody>
          ${decisionRows.map((r)=>`<tr><td>${escapeHtml(r.person || '')}</td><td>${escapeHtml(r.title || '')}</td><td>${escapeHtml(r.lane || '')}</td><td><span class="badge text-bg-${String(r.influence||'').toLowerCase()==='high'?'danger':(String(r.influence||'').toLowerCase()==='medium'?'warning':'secondary')}">${escapeHtml(r.influence || 'Low')}</span></td><td>${escapeHtml(r.engagement_use || '')}</td><td>${r.source_url ? `<a href="${escapeHtml(String(r.source_url))}" target="_blank" rel="noopener noreferrer">Profile</a>` : '—'}</td></tr>`).join('') || '<tr><td colspan="6">No decision-architecture entries yet for this buyer.</td></tr>'}
        </tbody></table></div>
      </div>
    </details>

    <details class="card mb-3">
      <summary class="card-header"><strong>Access &amp; Mandate Architecture</strong></summary>
      <div class="card-body">
        ${b.buyer_state ? `
          <h6>How You Actually Reach ${escapeHtml(b.buyer_id || 'Buyer')}</h6>
          <ul class="small">${(b.buyer_state.reach_profile || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul>
          <h6>The 4 Real Pathways</h6>
          ${(b.buyer_state.pathways || []).map((p)=>`<div class="mb-2"><strong>${escapeHtml(String(p.title||''))}</strong><ul class="small mb-1">${(p.points||[]).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>`).join('')}
          <h6>How You Move Inside Their System</h6>
          <ul class="small">${(b.buyer_state.system_dynamics || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul>
          <h6>Channels That Fit</h6>
          <div class="small"><strong>Primary</strong><ul>${((b.buyer_state.channels||{}).primary || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>
          <div class="small"><strong>Secondary</strong><ul>${((b.buyer_state.channels||{}).secondary || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>
          <div class="small"><strong>Avoid</strong><ul>${((b.buyer_state.channels||{}).avoid || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>
          <h6>How It Converts to Mandate</h6>
          <ol class="small mb-0">${(b.buyer_state.conversion_steps || []).map((x)=>`<li>${escapeHtml(String(x))}</li>`).join('')}</ol>
        ` : `<div class="small text-muted">No buyer-state profile yet for this buyer.</div>`}
      </div>
    </details>

    ${tc ? `<details class="card mb-3">
      <summary class="card-header"><strong>Transfer Chain (Operational View)</strong></summary>
      <div class="card-body">
        <h6>1️⃣ Stored Energy (Source Account)</h6>
        <ul class="small">
          <li><strong>Stored Energy Source:</strong> ${escapeHtml(tc.stored_energy_source || 'TBD')}</li>
          <li><strong>Budget Program / Facility:</strong> ${escapeHtml(tc.budget_program || 'TBD')}</li>
          <li><strong>Funding Type:</strong> ${escapeHtml(tc.funding_type || 'TBD')}</li>
          <li><strong>Approval Authority:</strong> ${escapeHtml(tc.approval_authority || 'TBD')}</li>
          <li><strong>Verification Status:</strong> ${escapeHtml(tc.verification_status || 'TBD')}</li>
          <li><strong>Confidence Level:</strong> ${escapeHtml(tc.confidence_level || 'TBD')}</li>
        </ul>
        <h6>2️⃣ Pressure Surface</h6>
        <ul class="small">
          <li><strong>Primary Infrastructure Pressure:</strong> ${escapeHtml(tc.primary_infrastructure_pressure || 'TBD')}</li>
          <li><strong>Linked Signals (30d):</strong> ${escapeHtml(tc.linked_signals_30d || 'TBD')}</li>
          <li><strong>Signal Trend:</strong> ${escapeHtml(tc.signal_trend || 'TBD')}</li>
        </ul>
        <h6>3️⃣ Value Recognition</h6>
        <ul class="small">
          <li><strong>Strategic Alignment Thesis:</strong> ${escapeHtml(tc.strategic_alignment_thesis || 'TBD')}</li>
          <li><strong>Linked Initiative:</strong> ${escapeHtml(tc.linked_initiative || 'TBD')}</li>
          <li><strong>Recognition Evidence Status:</strong> ${escapeHtml(tc.recognition_evidence_status || 'TBD')}</li>
        </ul>
        <h6>4️⃣ Release Conditions</h6>
        <ul class="small">
          <li><strong>Required Governance Artifacts:</strong> ${escapeHtml(tc.required_governance_artifacts || 'TBD')}</li>
          <li><strong>Mandate Pathway Stage:</strong> ${escapeHtml(tc.mandate_pathway_stage || 'TBD')}</li>
          <li><strong>Checklist Coverage:</strong> ${escapeHtml(tc.checklist_coverage || 'TBD')}</li>
          <li><strong>Critical Blocker:</strong> ${escapeHtml(tc.critical_blocker || 'TBD')}</li>
        </ul>
        <h6>5️⃣ Transfer</h6>
        <ul class="small">
          <li><strong>Transfer Vehicle:</strong> ${escapeHtml(tc.transfer_vehicle || 'TBD')}</li>
          <li><strong>Payment Trigger:</strong> ${escapeHtml(tc.payment_trigger || 'TBD')}</li>
          <li><strong>Estimated Time to Transfer:</strong> ${escapeHtml(tc.estimated_time_to_transfer || 'TBD')}</li>
        </ul>
        <h6>6️⃣ Value Capture</h6>
        <ul class="small mb-0">
          <li><strong>Mandate Fee Structure:</strong> ${escapeHtml(tc.mandate_fee_structure || 'TBD')}</li>
          <li><strong>Promote Trigger:</strong> ${escapeHtml(tc.promote_trigger || 'TBD')}</li>
          <li><strong>Recurrence Potential:</strong> ${escapeHtml(tc.recurrence_potential || 'TBD')}</li>
        </ul>
      </div>
    </details>` : ''}

    <details class="card mb-3">
      <summary class="card-header"><strong>Decision Snapshot</strong></summary>
      <div class="card-body">
      <ul class="mb-0">
        <li><strong>Buyer Stage:</strong> ${escapeHtml(String(b.signal_status || 'Monitor'))}</li>
        <li><strong>Next Best Action:</strong> ${escapeHtml(nextAction)}</li>
        <li><strong>Owner / Due:</strong> ${escapeHtml(nextOwnerDue)}</li>
        <li><strong>Primary Blocker:</strong> ${escapeHtml(blocker)}</li>
      </ul>
      </div>
    </details>

    <details class="card mb-3">
      <summary class="card-header"><strong>Pressure Surface (Last 30 Days)</strong></summary>
      <div class="card-body">
      <ul class="mb-0">
        <li><strong>Pressure Index:</strong> ${pressureIndex}</li>
        <li><strong>Signal Trend:</strong> ${escapeHtml(trend)}</li>
        <li><strong>Top Signal #1:</strong> ${topSignals[0] ? `${escapeHtml(topSignals[0].title || '')} (${escapeHtml(topSignals[0].confidence || 'Low')})` : 'None'}</li>
        <li><strong>Top Signal #2:</strong> ${topSignals[1] ? `${escapeHtml(topSignals[1].title || '')} (${escapeHtml(topSignals[1].confidence || 'Low')})` : 'None'}</li>
      </ul>
      <div class="small mt-2"><a href="/dashboard/signals">Open full Signal Register →</a></div>
      </div>
    </details>

    <details class="card mb-3">
      <summary class="card-header"><strong>Mandate Readiness</strong></summary>
      <div class="card-body">
      <ul class="mb-2">
        <li><strong>Pathway Stage:</strong> ${buyerSignals.length ? 'Evidence Gathering' : 'Not Started'}</li>
        <li><strong>Evidence Coverage:</strong> ${buyerSignals.length} / 4 complete</li>
        <li><strong>Latest Review Packet:</strong> Not linked yet</li>
        <li><strong>Upgrade Readiness:</strong> ${canUpgradeToVerified || canUpgradeToActioned ? 'Ready' : (buyerSignals.length >= 1 ? 'Partial' : 'Not Ready')}</li>
      </ul>
      <div class="small text-muted mb-2">Status Guardrails</div>
      <ul class="small mb-3">
        <li>Monitor → Verified: transfer hypothesis + (≥1 High OR ≥2 Medium signals in 30d) + ≥1 linked task (${canUpgradeToVerified ? '✅ ready' : '❌ blocked'})</li>
        <li>Verified → Actioned: ≥1 in-progress linked task + ≥1 linked initiative (${canUpgradeToActioned ? '✅ ready' : '❌ blocked'})</li>
      </ul>
      ${canEdit ? `<div class="d-flex gap-2 flex-wrap">
        ${String(b.signal_status || 'Monitor') === 'Monitor' ? `<form method="post" action="/api/buyers/${encodeURIComponent(b.buyer_id)}/upgrade-status"><input type="hidden" name="to" value="Verified"/><button class="btn btn-sm btn-success" ${canUpgradeToVerified ? '' : 'disabled'}>Upgrade to Verified</button></form>` : ''}
        ${String(b.signal_status || 'Monitor') === 'Verified' ? `<form method="post" action="/api/buyers/${encodeURIComponent(b.buyer_id)}/upgrade-status"><input type="hidden" name="to" value="Actioned"/><button class="btn btn-sm btn-primary" ${canUpgradeToActioned ? '' : 'disabled'}>Upgrade to Actioned</button></form>` : ''}
      </div>` : ''}
      </div>
    </details>

    <details class="card mb-3">
      <summary class="card-header"><strong>Execution Queue (Top 3)</strong></summary>
      <div class="card-body">
      <ul class="mb-0">${buyerTasks.map((t)=>`<li>${escapeHtml(t.title)} <span class="text-muted small">(${escapeHtml(t.priority || 'P2')} · ${escapeHtml(t.status || 'Backlog')})</span></li>`).join('') || '<li>No linked execution tasks</li>'}</ul>
      </div>
    </details>
  </div></body></html>`);
});

app.get('/dashboard/initiative/:id', async (req, res) => {
  const id = String(req.params.id);
  const buyer_id = req.query.buyer_id ? String(req.query.buyer_id) : '';
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const i = initiatives.find(x=>x.initiative_id===id);
  if(!i) return res.status(404).send('Initiative not found');
  const linkedBuyers = buyers.filter(b => (i.linked_buyers||[]).includes(b.buyer_id));
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  const editMode = String(req.query.edit || '') === '1';
  const LAYERS = ['political','asset','development','capital','delivery'];
  const LAYER_LABEL = { political:'Political', asset:'Asset', development:'Development', capital:'Capital', delivery:'Delivery' };
  const STATUS_ICON = { committed:'✔', engaged:'●', validated:'◐', identified:'◔', missing:'⬜' };
  const WEIGHT = { missing: 0, identified: 0.25, validated: 0.5, engaged: 0.75, committed: 1 };
  const actorLayers = normalizeActorAlignment(i);
  const layerScore = (rows=[]) => rows.length ? Number(((rows.reduce((s,r)=>s + (WEIGHT[String(r?.status || 'missing')] ?? 0),0) / rows.length) * 100).toFixed(0)) : 0;
  const perLayer = Object.fromEntries(LAYERS.map((l)=>[l, layerScore(actorLayers[l])]));
  const overallAlign = Number((LAYERS.reduce((s,l)=>s + perLayer[l],0)/LAYERS.length).toFixed(0));
  const rolesAll = LAYERS.flatMap((l)=>(actorLayers[l]||[]).map((r)=>({...r, layer:l})));
  const ROLE_RANK = ['political_sponsor','regulator','asset_owner','operator','off_taker','anchor_equity','development_finance_lender','project_developer','technical_integrator','epc_contractor','key_supplier'];
  const roleSortKey = (r) => {
    const w = WEIGHT[String(r?.status || 'missing')] ?? 0;
    const idx = ROLE_RANK.indexOf(String(r?.role_id || ''));
    return `${w.toFixed(2)}_${idx >= 0 ? String(idx).padStart(3,'0') : '999'}`;
  };
  const primaryConstraint = (rolesAll.filter((r)=>Boolean(r?.is_critical_role) && ['missing','identified','validated'].includes(String(r?.status || 'missing'))).sort((a,b)=>roleSortKey(a).localeCompare(roleSortKey(b)))[0]) ||
    (rolesAll.filter((r)=>['missing','identified','validated'].includes(String(r?.status || 'missing'))).sort((a,b)=>roleSortKey(a).localeCompare(roleSortKey(b)))[0]) || null;
  const decksRoot = path.join(ROOT, 'presentations', id, 'decks');
  const deckLinks = [];
  if (fssync.existsSync(decksRoot)) {
    const walk=(d)=>{ for(const e of fssync.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name==='index.html') deckLinks.push(path.relative(ROOT,p)); }};
    walk(decksRoot);
  }
  res.type('html').send(`<!doctype html><html><head>${uiHead('Initiative Detail')}</head><body><div class="app-shell">
    ${dashboardNav('initiatives')}
    <a class="btn btn-sm btn-outline-secondary mb-2" href="/dashboard/initiatives">← Initiatives</a>
    <div class="d-flex justify-content-between align-items-center mb-2"><h3 class="mb-0">${escapeHtml(i.name)}</h3>${canEdit ? `<a class="btn btn-sm btn-outline-secondary" href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}?edit=1">Edit</a>` : ''}</div>
    ${canEdit && editMode ? `<div class="card mb-3"><div class="card-body"><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/update" class="row g-2"><div class="col-md-6"><label class="form-label">Name</label><input class="form-control" name="name" value="${escapeHtml(i.name || '')}" required /></div><div class="col-md-3"><label class="form-label">Status</label><input class="form-control" name="status" value="${escapeHtml(i.status || '')}" /></div><div class="col-md-3"><label class="form-label">Infrastructure Type</label><input class="form-control" name="infrastructure_category" value="${escapeHtml(i.infrastructure_category || '')}" /></div><div class="col-12"><label class="form-label">Macro Gravity Summary</label><textarea class="form-control" name="macro_gravity_summary" rows="3">${escapeHtml(i.macro_gravity_summary || '')}</textarea></div><div class="col-12"><label class="form-label">Initiative Stakeholders</label><div class="d-flex flex-wrap gap-2 mb-2"><button class="btn btn-sm btn-outline-primary" type="submit" formaction="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/apply-template">Apply Template</button><button class="btn btn-sm btn-outline-secondary" type="submit" formaction="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/apply-template" name="overwrite" value="true">Apply Template (Overwrite)</button></div><div class="border rounded p-2 small text-muted">Use “+ Add Actor Role” below to manage stakeholder roles. Raw JSON is hidden in normal workflow.</div></div><div class="col-12 d-flex gap-2"><button class="btn btn-sm btn-primary" type="submit">Save Initiative</button><a class="btn btn-sm btn-outline-secondary" href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}">Cancel</a></div></form></div></div><div class="card mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-center"><h6 class="mb-2">Actor Role Management</h6><span class="small text-muted">+ Add Actor Role</span></div><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/add" class="row g-2"><div class="col-md-2"><label class="form-label">Layer</label><select class="form-select form-select-sm" name="layer" required>${LAYERS.map((l)=>`<option value="${l}">${escapeHtml(LAYER_LABEL[l])}</option>`).join('')}</select></div><div class="col-md-3"><label class="form-label">Role</label><input class="form-control form-control-sm" name="role_label" list="commonRoleList" placeholder="e.g., Anchor Equity" required /><datalist id="commonRoleList"><option>Political Sponsor</option><option>Regulator</option><option>Asset Owner</option><option>Operator</option><option>Project Developer</option><option>Technical Integrator</option><option>Off-Taker</option><option>Anchor Equity</option><option>Development Finance Lender</option><option>Commercial Lender</option><option>EPC Contractor</option><option>Key Supplier / OEM</option></datalist></div><div class="col-md-2"><label class="form-label">Status</label><select class="form-select form-select-sm" name="status">${['missing','identified','validated','engaged','committed'].map((s)=>`<option value="${s}">${s}</option>`).join('')}</select></div><div class="col-md-2"><label class="form-label">Entity Type</label><select class="form-select form-select-sm" name="mapped_entity_type"><option value="">(none)</option><option>buyer</option><option>organization</option><option>team</option><option>regulator</option><option>operator</option><option>other</option></select></div><div class="col-md-3"><label class="form-label">Linked Entity</label><input class="form-control form-control-sm" name="mapped_entity_ref" placeholder="buyer_id or org" /></div><div class="col-md-4"><label class="form-label">Notes</label><input class="form-control form-control-sm" name="notes" /></div><div class="col-md-2"><label class="form-label">Owner</label><input class="form-control form-control-sm" name="owner" placeholder="e.g., Tyreek" /></div><div class="col-md-2"><label class="form-label">Due</label><input class="form-control form-control-sm" type="date" name="due" /></div><div class="col-md-2 d-flex align-items-end"><div class="form-check mb-1"><input class="form-check-input" type="checkbox" name="is_critical_role" id="criticalRoleTick" /><label class="form-check-label" for="criticalRoleTick">Critical</label></div></div><div class="col-md-2 d-flex align-items-end"><button class="btn btn-sm btn-primary w-100" type="submit">+ Add Actor Role</button></div></form></div></div><div class="card mb-3"><div class="card-body"><h6 class="mb-2">Update Existing Role</h6><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/update" class="row g-2"><div class="col-md-3"><label class="form-label">Role</label><select class="form-select form-select-sm" name="role_id" required>${rolesAll.map((r)=>`<option value="${escapeHtml(String(r.role_id||''))}">${escapeHtml(LAYER_LABEL[r.layer])} · ${escapeHtml(r.role_label || r.role_id || 'Unnamed role')}</option>`).join('')}</select></div><div class="col-md-2"><label class="form-label">Status</label><select class="form-select form-select-sm" name="status">${['missing','identified','validated','engaged','committed'].map((s)=>`<option value="${s}">${s}</option>`).join('')}</select></div><div class="col-md-2"><label class="form-label">Entity Type</label><select class="form-select form-select-sm" name="mapped_entity_type"><option value="">(none)</option><option>buyer</option><option>organization</option><option>team</option><option>regulator</option><option>operator</option><option>other</option></select></div><div class="col-md-3"><label class="form-label">Linked Entity</label><input class="form-control form-control-sm" name="mapped_entity_ref" /></div><div class="col-md-2"><label class="form-label">Owner</label><input class="form-control form-control-sm" name="owner" /></div><div class="col-md-2"><label class="form-label">Due</label><input class="form-control form-control-sm" type="date" name="due" /></div><div class="col-md-6"><label class="form-label">Notes</label><input class="form-control form-control-sm" name="notes" /></div><div class="col-md-2 d-flex align-items-end"><div class="form-check mb-1"><input class="form-check-input" type="checkbox" name="is_critical_role" id="criticalRoleTickUpdate" /><label class="form-check-label" for="criticalRoleTickUpdate">Critical</label></div></div><div class="col-md-2 d-flex align-items-end"><button class="btn btn-sm btn-outline-primary w-100" type="submit">Update Role</button></div></form></div></div>` : `<p>${escapeHtml(i.macro_gravity_summary || '')}</p>
    <p><strong>Status:</strong> ${escapeHtml(i.status || '')}</p>`}
    <details class="card mb-3" open><summary class="card-header"><strong>Actor Alignment Map</strong> <span class="small text-muted ms-2">(collapsible)</span></summary><div class="card-body">
      <div class="small text-muted mb-2">Structural alignment proxy (not literal FID readiness).</div>

      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4 col-lg-2"><div class="border rounded p-2"><div class="small text-muted">Overall Alignment</div><div><strong>${overallAlign}%</strong></div></div></div>
        <div class="col-6 col-md-4 col-lg-2"><div class="border rounded p-2"><div class="small text-muted">Weakest Layer</div><div class="text-capitalize"><strong>${escapeHtml(((() => { let w=LAYERS[0]; for (const l of LAYERS) if (perLayer[l] < perLayer[w]) w=l; return w; })()))}</strong></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="border rounded p-2"><div class="small text-muted">Primary Constraint</div><div><strong>${escapeHtml(primaryConstraint ? (primaryConstraint.role_label || primaryConstraint.role_id || 'None') : 'None')}</strong></div></div></div>
        <div class="col-6 col-md-4 col-lg-2"><div class="border rounded p-2"><div class="small text-muted">Critical Roles Missing</div><div><strong>${rolesAll.filter((r)=>Boolean(r?.is_critical_role) && String(r?.status||'missing')==='missing').length}</strong></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="border rounded p-2"><div class="small text-muted">Last Updated</div><div><strong>${escapeHtml(String(i.updated_at || i.gate_updated_at || '—').slice(0,19).replace('T',' '))}</strong></div></div></div>
      </div>

      <div class="d-flex gap-2 mb-2">
        <button type="button" class="btn btn-sm btn-outline-secondary active" data-view-mode="layer">View by Layer</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-view-mode="status">View by Status</button>
      </div>

      <div id="actor-view-layer" class="row g-2 mb-3">
        ${LAYERS.map((l)=>`<div class="col-12 col-lg"><div class="border rounded p-2 h-100"><div class="d-flex justify-content-between"><strong>${escapeHtml(LAYER_LABEL[l])}</strong><span class="small text-muted">${perLayer[l]}%</span></div><div class="mt-2 d-flex flex-column gap-1">${(actorLayers[l]||[]).map((r)=>`<div class="border rounded px-2 py-1 small ${r?.is_critical_role ? 'border-danger-subtle' : ''}">${escapeHtml(STATUS_ICON[String(r?.status||'missing')] || '⬜')} ${escapeHtml(r.role_label || r.role_id || 'Unnamed role')}${r?.mapped_entity_ref ? ` <span class="text-muted">— ${escapeHtml(String(r.mapped_entity_ref))}</span>` : ''}${r?.is_critical_role ? ' <span class="badge text-bg-light border ms-1">Critical</span>' : ''}</div>`).join('') || '<div class="small text-muted">No roles defined</div>'}</div></div></div>`).join('')}
      </div>

      <div id="actor-view-status" class="mb-3" style="display:none">
        ${['missing','identified','validated','engaged','committed'].map((s)=>`<div class="mb-2"><div><strong>${escapeHtml(s)}</strong></div><div class="d-flex flex-wrap gap-1 mt-1">${rolesAll.filter((r)=>String(r?.status||'missing')===s).map((r)=>`<span class="badge text-bg-light border">${escapeHtml(LAYER_LABEL[r.layer])}: ${escapeHtml(r.role_label || r.role_id || 'Unnamed role')}${r?.is_critical_role ? ' *' : ''}</span>`).join('') || '<span class="small text-muted">None</span>'}</div></div>`).join('')}
      </div>

      <div class="card mb-2"><div class="card-body py-2">
        <div><strong>Primary Constraint:</strong> ${escapeHtml(primaryConstraint ? (primaryConstraint.role_label || primaryConstraint.role_id || 'None') : 'None')}</div>
        <div class="small text-muted">Why it matters: alignment is below engaged for a critical path role, which blocks forward progression.</div>
        <div class="small">Next action: identify and validate candidate role owner, then move to engaged.</div>
        <div class="small">Owner: ${escapeHtml(primaryConstraint?.owner || 'TBD')} · Due: ${escapeHtml(primaryConstraint?.due || 'TBD')}</div>
      </div></div>

      <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>#</th><th>Layer</th><th>Role</th><th>Status</th><th>Mapped Entity</th><th>Critical</th><th>Owner</th><th>Due</th><th>Notes</th>${canEdit && editMode ? '<th></th>' : ''}</tr></thead><tbody>
        ${rolesAll.map((r, idx)=>`<tr><td class="text-muted">${idx + 1}</td><td>${escapeHtml(LAYER_LABEL[r.layer])}</td><td>${escapeHtml(r.role_label || r.role_id || 'Unnamed role')}</td><td>${escapeHtml(String(r.status || 'missing'))}</td><td>${escapeHtml(String(r.mapped_entity_ref || '—'))}</td><td>${r?.is_critical_role ? 'Yes' : 'No'}</td><td>${escapeHtml(String(r.owner || '—'))}</td><td>${escapeHtml(String(r.due || '—'))}</td><td>${escapeHtml(String(r.notes || ''))}</td>${canEdit && editMode ? `<td class="text-end"><details><summary class="btn btn-sm btn-outline-secondary">Edit</summary><div class="card p-2 mt-1" style="min-width:360px"><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/update" class="row g-1"><input type="hidden" name="role_id" value="${escapeHtml(String(r.role_id || ''))}"/><div class="col-12"><label class="form-label small mb-0">Role Label</label><input class="form-control form-control-sm" name="role_label" value="${escapeHtml(String(r.role_label || ''))}" /></div><div class="col-6"><label class="form-label small mb-0">Status</label><select class="form-select form-select-sm" name="status">${['missing','identified','validated','engaged','committed'].map((s)=>`<option value="${s}" ${String(r.status||'missing')===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="col-6"><label class="form-label small mb-0">Entity Type</label><select class="form-select form-select-sm" name="mapped_entity_type"><option value="" ${!r.mapped_entity_type?'selected':''}>(none)</option>${['buyer','organization','team','regulator','operator','other'].map((t)=>`<option value="${t}" ${String(r.mapped_entity_type||'')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="col-12"><label class="form-label small mb-0">Linked Entity</label><input class="form-control form-control-sm" name="mapped_entity_ref" value="${escapeHtml(String(r.mapped_entity_ref || ''))}"/></div><div class="col-6"><label class="form-label small mb-0">Owner</label><input class="form-control form-control-sm" name="owner" value="${escapeHtml(String(r.owner || ''))}"/></div><div class="col-6"><label class="form-label small mb-0">Due</label><input class="form-control form-control-sm" type="date" name="due" value="${escapeHtml(String(r.due || ''))}"/></div><div class="col-12"><label class="form-label small mb-0">Notes</label><input class="form-control form-control-sm" name="notes" value="${escapeHtml(String(r.notes || ''))}"/></div><div class="col-6 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" name="is_critical_role" id="crit_${escapeHtml(String(r.role_id||''))}" ${r?.is_critical_role ? 'checked' : ''}/><label class="form-check-label" for="crit_${escapeHtml(String(r.role_id||''))}">Critical</label></div></div><div class="col-6 d-flex justify-content-end gap-1 align-items-end"><button class="btn btn-sm btn-primary" type="submit">Save</button></form><form method="post" action="/api/initiatives/${encodeURIComponent(i.initiative_id)}/actor-roles/${encodeURIComponent(String(r.role_id || ''))}/delete" onsubmit="return confirm('Remove role ${escapeHtml(r.role_label || r.role_id || '')}?');"><button class="btn btn-sm btn-outline-danger" type="submit">Remove</button></form></div></form></div></details></td>` : ''}</tr>`).join('') || `<tr><td colspan="${canEdit && editMode ? '10' : '9'}" class="text-muted">No actor roles defined. Apply Template or + Add Actor Role to begin.</td></tr>`}
      </tbody></table></div>
    </div></details>
    <h5>Linked Buyers</h5><ul>${linkedBuyers.map(b=>`<li>${escapeHtml(b.name)}</li>`).join('')}</ul>
    <h5 class="mt-3">Decks</h5>
    <ul>${deckLinks.map(p=>`<li><a href="/${p}">${escapeHtml(p)}</a></li>`).join('') || '<li>No decks yet</li>'}</ul>
    <div class="card mt-3"><div class="card-body">
      <h5>Create Presentation</h5>
      <form method="post" action="/api/presentations/generate" class="row g-2">
        <input type="hidden" name="initiative_id" value="${escapeHtml(i.initiative_id)}" />
        <div class="col-md-3"><label class="form-label">Type</label><select class="form-select" name="deck_type"><option value="utc-internal">UTC Internal</option><option value="buyer-mandate-mirror">Buyer Mandate Mirror</option></select></div>
        <div class="col-md-3"><label class="form-label">Template</label><select class="form-select" name="template_id"><option>sovereign-memo</option><option>clean-minimal</option><option>blueprint</option><option>dark-institutional</option></select></div>
        <div class="col-md-3"><label class="form-label">Image Provider</label><select class="form-select" name="image_provider"><option value="placeholder">Placeholder</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="grok">Grok (xAI)</option></select></div>
        <div class="col-md-3"><label class="form-label">Copy Provider</label><select class="form-select" name="copy_provider"><option value="local">Local Rewriter</option><option value="claude">Claude (Anthropic)</option></select></div>
        <div class="col-md-3"><label class="form-label">Buyer (for mirror)</label><select class="form-select" name="buyer_id"><option value="">(none)</option>${linkedBuyers.map(b=>`<option ${b.buyer_id===buyer_id?'selected':''} value="${b.buyer_id}">${escapeHtml(b.buyer_id)}</option>`).join('')}</select></div>
        <div class="col-12"><small class="text-muted">Reading level is locked to 8–9th grade.</small></div>
        <div class="col-12"><button class="btn btn-primary">Generate</button></div>
      </form>
    </div></div>
  </div>
  <script>
    document.querySelectorAll('[data-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layer = document.getElementById('actor-view-layer');
        const status = document.getElementById('actor-view-status');
        const mode = btn.getAttribute('data-view-mode');
        if (mode === 'status') {
          if (layer) layer.style.display = 'none';
          if (status) status.style.display = '';
        } else {
          if (layer) layer.style.display = '';
          if (status) status.style.display = 'none';
        }
        document.querySelectorAll('[data-view-mode]').forEach((x) => x.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  </script>
  </body></html>`);
});

app.get('/api/presentations/whoami', requireAnyAuth, async (req, res) => {
  res.json({ user: currentUser(req), effectiveRole: effectiveRole(req) });
});

app.post('/api/presentations/export', requireRole('architect','editor','observer'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const format = String(req.body.format || 'both');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [path.join(ROOT,'scripts/export_deck.js'), '--deck', deck, '--format', format], { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).send(`export failed: ${r.stderr || r.stdout}`);
  return res.type('application/json').send(r.stdout || '{}');
});

app.get('/dashboard/presentation-studio', requireAnyAuth, async (req, res) => {
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiative_id = String(req.query.initiative_id || initiatives[0]?.initiative_id || '');
  const buyer_id = String(req.query.buyer_id || '');
  const deck_type = String(req.query.deck_type || 'utc-internal');

  if (initiative_id) {
    await getOrCreateDeckSpecBySelectors({ initiativeId: initiative_id, buyerId: buyer_id || null, deckType: deck_type }, { createIfMissing: true });
  }

  const optsInitiatives = initiatives.map(i => `<option value="${i.initiative_id}" ${i.initiative_id===initiative_id?'selected':''}>${escapeHtml(i.initiative_id)} — ${escapeHtml(i.name)}</option>`).join('');
  const optsBuyers = ['<option value="">(none)</option>', ...buyers.map(b => `<option value="${b.buyer_id}" ${b.buyer_id===buyer_id?'selected':''}>${escapeHtml(b.buyer_id)} — ${escapeHtml(b.name)}</option>` )].join('');

  res.type('html').send(`<!doctype html><html><head>${uiHead('Presentation Studio')}</head><body>
  <div class="app-shell" style="max-width:1400px">
    ${dashboardNav('studio')}
    <div class="row g-3">
      <div class="col-12 col-lg-4">
        <div class="card shadow-sm"><div class="card-body">
          <h5>Prompt + Generate</h5>
          <form id="studioForm" class="vstack gap-2">
            <label class="form-label">Initiative</label>
            <select class="form-select" name="initiative_id">${optsInitiatives}</select>
            <label class="form-label">Buyer (optional)</label>
            <select class="form-select" name="buyer_id">${optsBuyers}</select>
            <label class="form-label">Deck Type</label>
            <select class="form-select" name="deck_type"><option value="utc-internal">UTC Internal</option><option value="buyer-mandate-mirror">Buyer Mandate Mirror</option></select>
            <label class="form-label">Template</label>
            <select class="form-select" name="template_id"><option>sovereign-memo</option><option>clean-minimal</option><option>blueprint</option><option>dark-institutional</option></select>
            <label class="form-label">Image Provider</label>
            <select class="form-select" name="image_provider"><option value="placeholder">Placeholder</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="grok">Grok (xAI)</option></select>
            <label class="form-label">Copy Provider</label>
            <select class="form-select" name="copy_provider"><option value="local">Local Rewriter</option><option value="claude">Claude</option></select>
            <label class="form-label">Prompt</label>
            <textarea class="form-control" rows="8" name="prompt" placeholder="Tell Sentinel what to change in this deck..."></textarea>
            <div class="studio-actions">
              <button class="btn btn-primary" type="button" id="btnGenerate">Generate from Prompt</button>
              <button class="btn btn-outline-primary" type="button" id="btnAuto">Generate for Me</button>
            </div>
            <small class="text-muted">Slides are HTML + CSS. Prompt updates slide content and regenerates preview.</small>
          </form>
        </div></div>
      </div>
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm"><div class="card-body">
          <div class="d-flex justify-content-between align-items-center"><h5 class="mb-0">Slides Preview</h5><a id="openDeck" class="btn btn-sm btn-outline-secondary" target="_blank" href="#">Open Deck</a></div>
          <div id="slideList" class="small text-muted my-2">No deck generated yet.</div>
          <div class="row g-2 mb-2" id="thumbRow"></div>
          <iframe id="deckFrame" style="width:100%;height:44vh;border:1px solid #ddd;border-radius:8px"></iframe>

          <div class="card mt-2"><div class="card-body">
            <h6 class="mb-2">Slide Editor v1 (SlideSpec source)</h6>
            <div class="row g-2">
              <div class="col-md-2"><label class="form-label">Slide</label><select id="editSlideId" class="form-select"></select></div>
              <div class="col-md-4"><label class="form-label">Layout</label><select id="editLayout" class="form-select"><option>title</option><option>section</option><option>proof</option><option>diagram</option><option>close</option></select></div>
              <div class="col-md-6"><label class="form-label">Title</label><input id="editTitle" class="form-control" /></div>
              <div class="col-12"><label class="form-label">Bullets (one per line)</label><textarea id="editBullets" rows="5" class="form-control"></textarea></div>
              <div class="col-md-8"><label class="form-label">Image prompt (slot 1)</label><input id="editImagePrompt" class="form-control" /></div>
              <div class="col-md-4 studio-editor-actions">
                <button id="saveSlideBtn" class="btn btn-primary" type="button">Save + Re-render Slide</button>
                <button id="regenImageBtn" class="btn btn-outline-secondary" type="button">Regen Image</button>
                <button id="deleteSlideBtn" class="btn btn-outline-danger" type="button">Delete Slide</button>
              </div>
            </div>
          </div></div>
        </div></div>
      </div>
    </div>
  </div>
  <script>
    let lastDeckPath = '';
    let lastDeckRoot = '';
    let deckSpec = null;
    let selectedSlide = '';

    async function setDeckRoot(root){
      if(!root) return;
      lastDeckRoot = root;
      lastDeckPath = lastDeckRoot + '/index.html';
      document.getElementById('openDeck').href = lastDeckPath;
      document.getElementById('deckFrame').src = lastDeckPath + '?t=' + Date.now();
      localStorage.setItem('studio:lastDeckRoot', lastDeckRoot);
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      document.getElementById('slideList').textContent = 'Deck: ' + lastDeckRoot.replace(/^\\//,'') + ' • Slides: ' + ((deckSpec?.slides || []).length || 0);
    }

    async function loadDeckSpec(){
      if(!lastDeckRoot) return;
      const r = await fetch(lastDeckRoot + '/deck.json?t=' + Date.now());
      if(!r.ok) return;
      deckSpec = await r.json();
      const sel = document.getElementById('editSlideId');
      sel.innerHTML = '';
      (deckSpec.slides || []).forEach(s => {
        const o = document.createElement('option');
        o.value = s.slide_id;
        o.textContent = s.slide_id + ' — ' + (s.copy?.title || s.title || 'Slide');
        sel.appendChild(o);
      });
      if((deckSpec.slides||[]).length){
        selectedSlide = (deckSpec.slides[0].slide_id);
        sel.value = selectedSlide;
        populateEditor(selectedSlide);
      }
    }

    function populateEditor(slideId){
      selectedSlide = slideId;
      const s = (deckSpec?.slides || []).find(x => x.slide_id === slideId);
      if(!s) return;
      document.getElementById('editLayout').value = s.layout || 'section';
      document.getElementById('editTitle').value = s.copy?.title || s.title || '';
      document.getElementById('editBullets').value = (s.copy?.bullets || s.bullets || []).join('\\n');
      document.getElementById('editImagePrompt').value = s.images?.[0]?.prompt || '';
      document.getElementById('deckFrame').src = lastDeckRoot + '/slides/' + slideId + '.html?t=' + Date.now();
    }

    function renderThumbs(slideCount){
      const row = document.getElementById('thumbRow');
      row.innerHTML = '';
      if(!lastDeckRoot || !slideCount) return;
      for(let i=1;i<=slideCount;i++){
        const id = String(i).padStart(3,'0');
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-xl-3';
        col.innerHTML = '<button type="button" class="btn btn-outline-secondary p-1 w-100 text-start" data-slide="' + id + '" style="height:120px;overflow:hidden">' +
          '<div class="small fw-semibold px-1">Slide ' + i + '</div>' +
          '<iframe src="' + lastDeckRoot + '/slides/' + id + '.html" style="width:220%;height:210px;transform:scale(.45);transform-origin:0 0;border:0;pointer-events:none"></iframe>' +
          '</button>';
        row.appendChild(col);
      }
      row.querySelectorAll('button[data-slide]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.slide;
          document.getElementById('deckFrame').src = lastDeckRoot + '/slides/' + id + '.html?t=' + Date.now();
        });
      });
    }

    async function generate(auto){
      const form = document.getElementById('studioForm');
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.auto_generate = !!auto;
      const r = await fetch('/api/presentations/pipeline-v2/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Generation failed'); return; }
      await setDeckRoot('/' + j.deck);
      document.getElementById('slideList').textContent = 'Deck: ' + j.deck + ' • Slides: ' + j.slideCount + ' • Images: ' + j.images;
    }

    async function saveSlide(regenImage){
      if(!lastDeckRoot || !selectedSlide) return;
      const payload = {
        deck: lastDeckRoot.replace(/^\\//,''),
        slide_id: selectedSlide,
        layout: document.getElementById('editLayout').value,
        title: document.getElementById('editTitle').value,
        bullets: document.getElementById('editBullets').value.split('\\n').map(x=>x.trim()).filter(Boolean),
        image_prompt: document.getElementById('editImagePrompt').value,
        regen_image: !!regenImage
      };
      const r = await fetch('/api/presentations/slide/update', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Slide update failed'); return; }
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      populateEditor(selectedSlide);
    }

    async function deleteSlide(){
      if(!lastDeckRoot || !selectedSlide) return;
      if(!confirm('Delete slide ' + selectedSlide + '? This will renumber following slides.')) return;
      const payload = { deck: lastDeckRoot.replace(/^\\//,''), slide_id: selectedSlide };
      const r = await fetch('/api/presentations/slide/delete', {method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Delete failed'); return; }
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      if((deckSpec?.slides || []).length){ populateEditor(deckSpec.slides[0].slide_id); }
      else { document.getElementById('deckFrame').src=''; document.getElementById('slideList').textContent='No slides left in deck.'; }
    }

    document.getElementById('btnGenerate').addEventListener('click', ()=>generate(false));
    document.getElementById('btnAuto').addEventListener('click', ()=>generate(true));
    document.getElementById('editSlideId').addEventListener('change', (e)=>populateEditor(e.target.value));
    document.getElementById('saveSlideBtn').addEventListener('click', ()=>saveSlide(false));
    document.getElementById('regenImageBtn').addEventListener('click', ()=>saveSlide(true));
    document.getElementById('deleteSlideBtn').addEventListener('click', ()=>deleteSlide());

    // Restore last deck after refresh so slide editor is not empty.
    const savedDeck = localStorage.getItem('studio:lastDeckRoot');
    if (savedDeck) {
      setDeckRoot(savedDeck).catch(()=>{});
    }

  </script>
  </body></html>`);
});

app.post('/api/presentations/pipeline-v2/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const prompt = String(req.body.prompt || '');

  const cmd = ['node', path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--prompt', prompt];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'pipeline v2 failed').trim() });

  const out = JSON.parse((r.stdout || '{}').trim() || '{}');
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.complete', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { stage: 'pipeline_v2', template_id, image_provider, buyer_id: buyer_id || null } });
  await createSnapshot('presentation.pipeline_v2.generate');
  res.json({ ok:true, deck: out.deck || '', slideCount: out.slideCount || 0, images: out.images || 'pipeline' });
});

app.patch('/api/presentations/slide/update', requireRole('architect','editor'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const slide_id = String(req.body.slide_id || '');
  if (!deck || !slide_id) return res.status(400).json({ error: 'deck and slide_id required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });
  const s = spec.slides.find(x => x.slide_id === slide_id);
  if (!s) return res.status(404).json({ error: 'slide not found' });

  s.layout = String(req.body.layout || s.layout || 'section');
  const layoutResolution = resolveTemplateIdFromLegacyLayout(s.layout);
  s.template_id = layoutResolution.templateId;
  if (layoutResolution.fallbackApplied) {
    s.normalization = {
      ...(s.normalization || {}),
      layoutFallbackApplied: true,
      legacyLayout: s.layout,
      note: layoutResolution.note,
      normalizedAt: nowIso(),
    };
  }
  s.copy = s.copy || {};
  s.copy.title = String(req.body.title || s.copy.title || '');
  s.copy.bullets = Array.isArray(req.body.bullets) ? req.body.bullets : (s.copy.bullets || []);
  if (!Array.isArray(s.bullets)) s.bullets = [];
  s.bullets = s.copy.bullets;
  s.title = s.copy.title;
  if (!Array.isArray(s.images)) s.images = [];
  if (!s.images[0]) s.images[0] = { slot_id: 'img-001', prompt: '', provider: 'placeholder', output_path: `${deck}/assets/${slide_id}-img-001.png` };
  if (typeof req.body.image_prompt === 'string') s.images[0].prompt = req.body.image_prompt;

  // TASK-0051: legacy fields -> SlideSpec v2 slots mapping (non-breaking)
  s.slots = legacyFieldsToSlotsContract({
    title: s.copy.title || s.title || '',
    bullets: s.copy.bullets || s.bullets || [],
    imagePrompt: s.images?.[0]?.prompt || ''
  });
  s.slots_schema_version = 2;

  await writeJson(deckPath, spec);

  const cmd = ['node', path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--deck_path', deck, '--template_id', spec.deckPlan?.template_id || 'sovereign-memo', '--rerender_slide', slide_id];
  if (Boolean(req.body.regen_image) && s.images[0]?.prompt) cmd.push('--image_provider', s.images[0].provider || 'placeholder');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'rerender failed').trim() });

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation_slide', entity_id: `${deck}:${slide_id}`, meta: { action: 'slide_update' } });
  res.json({ ok: true, slide_id });
});

app.delete('/api/presentations/slide/delete', requireRole('architect','editor'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const slide_id = String(req.body.slide_id || '');
  if (!deck || !slide_id) return res.status(400).json({ error: 'deck and slide_id required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });
  const idx = spec.slides.findIndex(x => x.slide_id === slide_id);
  if (idx < 0) return res.status(404).json({ error: 'slide not found' });

  spec.slides.splice(idx, 1);
  if (spec.slides.length < 1) return res.status(400).json({ error: 'cannot delete last slide' });

  // Renumber slide ids and image output paths
  spec.slides.forEach((s, i) => {
    const newId = String(i + 1).padStart(3, '0');
    const oldId = s.slide_id;
    s.slide_id = newId;
    if (Array.isArray(s.images)) {
      s.images = s.images.map((img, j) => ({
        ...img,
        output_path: `${deck}/assets/${newId}-img-${String(j + 1).padStart(3, '0')}.png`
      }));
    }
    if (oldId !== newId) {
      // keep copy/title as-is; renderer rebuild will regenerate HTML files with new ids
    }
  });

  spec.deckPlan = spec.deckPlan || {};
  spec.deckPlan.slide_count = spec.slides.length;
  await writeJson(deckPath, spec);

  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--deck_path', deck, '--template_id', spec.deckPlan?.template_id || 'sovereign-memo', '--rebuild_all', 'true'], { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'rebuild failed').trim() });

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'task.update', entity_type: 'presentation_slide', entity_id: `${deck}:${slide_id}`, meta: { action: 'slide_delete' } });
  res.json({ ok: true, deleted: slide_id, slideCount: spec.slides.length });
});

app.post('/api/presentations/studio/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const copy_provider = String(req.body.copy_provider || 'local');
  const prompt = String(req.body.prompt || '');
  const auto_generate = Boolean(req.body.auto_generate);

  const cmd = ['node', path.join(ROOT,'scripts/generate_deck.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--copy_provider', copy_provider, '--prompt', prompt, '--auto_generate', auto_generate ? 'true' : 'false'];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'generation failed').trim() });

  const out = JSON.parse((r.stdout || '{}').trim() || '{}');
  const deckPath = out.deck || '';
  let slideCount = 0;
  try {
    const d = await readJson(path.join(ROOT, deckPath, 'deck.json'), {});
    slideCount = (d.slides || []).length;
  } catch {}

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { template_id, image_provider, copy_provider, buyer_id: buyer_id || null, auto_generate } });
  await createSnapshot('presentation.studio.generate');
  res.json({ ok:true, deck: deckPath, slideCount, images: out.images || 'unknown' });
});

app.post('/api/presentations/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const copy_provider = String(req.body.copy_provider || 'local');
  const cmd = ['node', path.join(ROOT,'scripts/generate_deck.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--copy_provider', copy_provider];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).send(`generation failed: ${r.stderr || r.stdout}`);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { template_id, image_provider, copy_provider, buyer_id: buyer_id || null } });
  await createSnapshot('presentation.generate');
  res.redirect(`/dashboard/initiative/${encodeURIComponent(initiative_id)}${buyer_id ? `?buyer_id=${encodeURIComponent(buyer_id)}` : ''}`);
});

app.use('/presentations', express.static(path.join(ROOT, 'presentations'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) { res.setHeader('Cache-Control', 'no-store'); }
}));

app.use('/reveal', revealRoutes);
app.use('/reveal/editor', express.static(path.join(ROOT, 'public', 'reveal', 'editor'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/reveal/player', express.static(path.join(ROOT, 'public', 'reveal', 'player'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/reveal/storage/assets', express.static(path.join(ROOT, 'reveal', 'storage', 'assets'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/dashboard', express.static(path.join(ROOT, 'dashboard'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/js', express.static(path.join(ROOT, 'dashboard', 'js'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/public', express.static(path.join(ROOT, 'public'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: nowIso() }));

app.get('/admin/login', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Admin Login')}</head>
<body class="login-page">
<div class="app-shell" style="max-width:560px">
  <div class="card shadow-sm">
    <div class="card-body p-4">
      <h3 class="mb-3">Sentinel Admin Login</h3>
      <form method="post" action="/admin/login" class="vstack gap-3">
        <div>
          <label class="form-label">Password</label>
          <input class="form-control" type="password" name="password" required autofocus />
        </div>
        <button class="btn btn-primary" type="submit">Login</button>
      </form>
    </div>
  </div>
</div>
</body></html>`);
});

app.post('/admin/login', loginRateLimit, async (req, res) => {
  const ip = req.ip || 'unknown';
  const password = String(req.body.password || '');
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!ok) {
    await appendAdminLog(`FAILED_LOGIN ip=${ip}`);
    await appendAuditEvent({ ts: nowIso(), actor: 'unknown', role: 'anonymous', event_type: 'login.failed', entity_type: 'auth', entity_id: 'admin', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  resetLoginAttempts(ip);
  req.session.user = { scope: 'admin', username: ARCHITECT_USERNAME, role: 'architect', loginAt: nowIso() };
  await appendAdminLog(`SUCCESS_LOGIN ip=${ip}`);
  await appendAuditEvent({ ts: nowIso(), actor: ARCHITECT_USERNAME, role: 'architect', event_type: 'login.success', entity_type: 'auth', entity_id: 'admin', meta: { ip } });
  return res.redirect('/admin');
});

app.post('/admin/logout', requireAdminAuth, async (req, res) => {
  const ip = req.ip || 'unknown';
  req.session.destroy(() => undefined);
  await appendAdminLog(`LOGOUT ip=${ip}`);
  res.redirect('/admin/login');
});

app.get('/admin', requireAdminAuth, async (_req, res) => {
  let state = null;
  try {
    const raw = await fs.readFile(DASHBOARD_STATE_FILE, 'utf8');
    state = JSON.parse(raw);
  } catch {}

  const updated = Array.isArray(state?.updatedDocs) ? state.updatedDocs.join(', ') : 'N/A';
  const totalFiles = state?.uosCurrent
    ? Object.values(state.uosCurrent).reduce((n, v) => n + (v.fileCount || 0), 0)
    : 0;

  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Admin Panel')}</head><body>
<div class="app-shell">
  ${adminNav('panel')}
  <div class="row g-3">
    <div class="col-12 col-lg-7">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <h4 class="card-title">UOS Upload Control</h4>
          <p class="text-muted">Upload files for Execution Engine, Canon, and Revenue OS.</p>
          <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary" href="/admin/upload">Go to Upload</a>
            <a class="btn btn-outline-secondary" href="/dashboard/">View Dashboard</a>
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 col-lg-5">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <h4 class="card-title">Latest State</h4>
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between"><span>Last updated</span><span class="mono small">${escapeHtml(state?.lastUpdated || 'N/A')}</span></li>
            <li class="list-group-item d-flex justify-content-between"><span>Updated docs</span><span class="small">${escapeHtml(updated)}</span></li>
            <li class="list-group-item d-flex justify-content-between"><span>Total active files</span><strong>${totalFiles}</strong></li>
            <li class="list-group-item d-flex justify-content-between"><span>Archive batch</span><span class="mono small">${escapeHtml(state?.latestArchiveBatch || 'N/A')}</span></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`);
});

app.get('/admin/upload', requireAdminAuth, (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head>${uiHead('UOS Upload')}</head>
<body>
<div class="app-shell">
${adminNav('upload')}
<div class="card shadow-sm">
  <div class="card-body">
    <h3 class="card-title">UOS Admin Upload</h3>
    <p class="text-muted">Upload multiple docs per category (.md, .txt, .pdf, .docx), max 20MB each file.</p>

    <form id="uploadForm" method="post" action="/admin/upload" enctype="multipart/form-data" class="vstack gap-3">
      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="executionEngine">
            <label class="form-label d-flex justify-content-between">Execution Engine <span class="badge text-bg-primary" id="executionEngineCount">0 files</span></label>
            <input class="form-control" type="file" id="executionEngine" name="executionEngine" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="executionEngineList"></div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="canon">
            <label class="form-label d-flex justify-content-between">Canon <span class="badge text-bg-primary" id="canonCount">0 files</span></label>
            <input class="form-control" type="file" id="canon" name="canon" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="canonList"></div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="revenueOS">
            <label class="form-label d-flex justify-content-between">Revenue OS <span class="badge text-bg-primary" id="revenueOSCount">0 files</span></label>
            <input class="form-control" type="file" id="revenueOS" name="revenueOS" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="revenueOSList"></div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary" type="submit">Upload + Rebuild Dashboard State</button>
      </div>
    </form>
  </div>
</div>
</div>

<script>
const allowed = new Set(['.md','.txt','.pdf','.docx']);
const maxBytes = 20 * 1024 * 1024;
function ext(name){ const i=name.lastIndexOf('.'); return i>=0 ? name.slice(i).toLowerCase() : ''; }
function render(inputId){
  const input = document.getElementById(inputId);
  const count = document.getElementById(inputId + 'Count');
  const list = document.getElementById(inputId + 'List');
  const files = Array.from(input.files || []);
  count.textContent = files.length + (files.length === 1 ? ' file' : ' files');
  list.innerHTML = files.slice(0, 12).map(f => {
    const badType = !allowed.has(ext(f.name));
    const badSize = f.size > maxBytes;
    const flags = [badType ? 'bad type' : '', badSize ? 'too large' : ''].filter(Boolean).join(', ');
    return '<div>' + f.name + (flags ? ' ⚠️ ' + flags : '') + '</div>';
  }).join('') || '<em>No files selected</em>';
}
function mergeFiles(input, droppedFiles){
  const dt = new DataTransfer();
  Array.from(input.files || []).forEach(f => dt.items.add(f));
  Array.from(droppedFiles || []).forEach(f => dt.items.add(f));
  input.files = dt.files;
  render(input.id);
}
['executionEngine','canon','revenueOS'].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener('change', () => render(id));
  render(id);
  const zone = document.querySelector('.dropzone[data-input="' + id + '"]');
  ['dragenter','dragover'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', (e) => mergeFiles(input, e.dataTransfer.files));
});
</script>
</body></html>`);
});


app.post(
  '/admin/upload',
  requireAdminAuth,
  upload.fields([
    { name: 'executionEngine', maxCount: MAX_FILES_PER_CATEGORY },
    { name: 'canon', maxCount: MAX_FILES_PER_CATEGORY },
    { name: 'revenueOS', maxCount: MAX_FILES_PER_CATEGORY },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      for (const field of REQUIRED_FIELDS) {
        if (!files[field] || files[field].length === 0) {
          return res.status(400).send(`Missing required file(s): ${field}`);
        }
      }

      const uploads = REQUIRED_FIELDS.flatMap((field) =>
        (files[field] || []).map((file, idx) => ({ field, file, idx }))
      );

      for (const { field, file } of uploads) {
        if (file.size > MAX_FILE_SIZE) {
          return res.status(400).send(`${field} file ${file.originalname} exceeds max size 20MB`);
        }
        const extension = ext(file.originalname);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          return res.status(400).send(`${field} invalid type: ${extension} (${file.originalname})`);
        }
      }

      await ensureDirs();

      const day = dateOnly();
      const stamp = tsForPath();
      const inboxDir = path.join(INBOX_ROOT, day);
      const archiveDir = path.join(ARCHIVE_ROOT, stamp);
      await fs.mkdir(inboxDir, { recursive: true });
      await fs.mkdir(archiveDir, { recursive: true });

      const pendingBatchDir = path.join(UOS_PENDING_ROOT, stamp);
      await fs.mkdir(pendingBatchDir, { recursive: true });
      for (const field of REQUIRED_FIELDS) {
        const key = fieldNameToCanonical(field);
        const pendingCategoryDir = path.join(pendingBatchDir, key);
        await fs.mkdir(pendingCategoryDir, { recursive: true });
      }

      const updates = [];

      for (const { field, file, idx } of uploads) {
        const originalName = safeName(file.originalname);
        const fieldPrefix = fieldNameToCanonical(field);
        const extension = ext(originalName);
        const fileStem = `${String(idx + 1).padStart(3, '0')}-${safeName(base(originalName))}`;

        const inboxPath = path.join(inboxDir, `${fieldPrefix}__${fileStem}${extension}`);
        const archiveOriginalPath = path.join(archiveDir, `${fieldPrefix}__${fileStem}${extension}`);

        await fs.writeFile(inboxPath, file.buffer);
        await fs.writeFile(archiveOriginalPath, file.buffer);

        const normalizedMarkdown = await normalizeToMarkdown(fieldPrefix, originalName, file.buffer);

        const pendingPath = path.join(UOS_PENDING_ROOT, stamp, fieldPrefix, `${fileStem}.md`);
        const archiveNormalizedPath = path.join(archiveDir, `${fieldPrefix}__${fileStem}.md`);

        await fs.writeFile(pendingPath, normalizedMarkdown, 'utf8');
        await fs.writeFile(archiveNormalizedPath, normalizedMarkdown, 'utf8');

        updates.push({
          field,
          key: fieldPrefix,
          originalName,
          extension,
          inboxPath: rel(inboxPath),
          pendingPath: rel(pendingPath),
          archiveOriginalPath: rel(archiveOriginalPath),
          archiveNormalizedPath: rel(archiveNormalizedPath),
        });
      }

      const uosEntityId = `UOS-${stamp}`;
      const rp = await createReviewPacketStub({
        title: `UOS Upload ${stamp}`,
        linkedTaskId: uosEntityId,
        createdBy: getUserLabel(req),
        status: 'Draft',
        recommendedAction: 'Approve',
      });

      const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
      state.lastUpdated = nowIso();
      state.latestUosUpload = {
        id: uosEntityId,
        batch: stamp,
        totalFiles: updates.length,
        pendingDir: rel(path.join(UOS_PENDING_ROOT, stamp)),
        archiveDir: rel(archiveDir),
        reviewPacketId: rp.rpId,
        status: 'Draft',
      };
      await writeJson(DASHBOARD_STATE_FILE, state);

      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.upload', entity_type: 'uos_batch', entity_id: uosEntityId, meta: { total_files: updates.length, pending_dir: rel(path.join(UOS_PENDING_ROOT, stamp)), archive_dir: rel(archiveDir), review_packet_id: rp.rpId } });
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.archive', entity_type: 'uos_batch', entity_id: uosEntityId, meta: { archive_dir: rel(archiveDir) } });
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: uosEntityId } });
      await appendAdminLog(`UPLOAD_SUCCESS count=${updates.length} files=${updates.map((u) => u.originalName).join(',')} archive=${rel(archiveDir)} pending=${rel(path.join(UOS_PENDING_ROOT, stamp))} rp=${rp.rpId}`);
      await createSnapshot('uos.upload');

      res.type('html').send(`<!doctype html>
<html><head>${uiHead('Upload Complete')}</head><body>
<div class="app-shell" style="max-width:860px">
  ${adminNav('upload')}
  <div class="card shadow-sm">
    <div class="card-body">
      <h3 class="card-title">Upload complete</h3>
      <p class="text-muted">Files staged to pending. Publish requires approved review packet.</p>
      <pre class="p-3 bg-body-tertiary border rounded">${escapeHtml(JSON.stringify({ updatedCategories: [...new Set(updates.map((u) => u.key))], totalFiles: updates.length, pendingDir: rel(path.join(UOS_PENDING_ROOT, stamp)), archiveDir: rel(archiveDir), reviewPacketId: rp.rpId, at: nowIso() }, null, 2))}</pre>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <a class="btn btn-primary" href="/dashboard/review">Open Review Queue</a>
        <a class="btn btn-outline-secondary" href="/admin/upload">Upload Another Batch</a>
      </div>
    </div>
  </div>
</div>
</body></html>`);
    } catch (err) {
      await appendAdminLog(`UPLOAD_ERROR error=${String(err?.message || err)}`);
      res.status(500).send(`Upload failed: ${err.message || err}`);
    }
  }
);

// -------- Team Auth + Kanban Board --------
const teamLoginAttempts = new Map();
const ajv = new Ajv({ allErrors: true });
let boardValidator = null;

function defaultBoardSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['version', 'tasks'],
    properties: {
      version: { type: 'integer' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title', 'status', 'priority', 'comments', 'created_at', 'updated_at', 'created_by', 'updated_by'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string', minLength: 1 },
            status: { type: 'string', enum: BOARD_COLUMNS },
            owner: { type: ['string', 'null'] },
            due_date: { type: ['string', 'null'] },
            priority: { type: 'string', enum: BOARD_PRIORITIES },
            tags: { type: 'array', items: { type: 'string' } },
            linked_refs: { type: 'array', items: { type: 'string' } },
            description: { type: ['string', 'null'] },
            comments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'author', 'text', 'created_at'],
                properties: {
                  id: { type: 'string' },
                  author: { type: 'string' },
                  text: { type: 'string' },
                  created_at: { type: 'string' },
                },
              },
            },
            request_approval: { type: ['object', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            created_by: { type: 'string' },
            updated_by: { type: 'string' },
          },
        },
      },
    },
  };
}

function defaultBoard() {
  return { version: 1, tasks: [] };
}

function defaultUsers() {
  return { users: [], invites: [] };
}

function deckSpecSchemaV2() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'DeckSpecV2Store',
    type: 'object',
    required: ['version', 'decks'],
    properties: {
      version: { type: 'integer' },
      decks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['deckId', 'initiativeId', 'buyerId', 'deckType', 'globalTemplateTheme', 'styleMode', 'copyProvider', 'imageProvider', 'slideOrder', 'createdAt', 'updatedAt', 'currentSavePointId'],
          properties: {
            deckId: { type: 'string' },
            initiativeId: { type: 'string' },
            buyerId: { type: ['string', 'null'] },
            deckType: { type: 'string' },
            globalTemplateTheme: { type: 'string' },
            styleMode: { type: 'string', enum: ['professional', 'creative'] },
            copyProvider: { type: 'string' },
            imageProvider: { type: 'string' },
            slideOrder: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            currentSavePointId: { type: ['string', 'null'] }
          }
        }
      }
    }
  };
}

function defaultDeckSpecStore() {
  return { version: 2, decks: [] };
}

function defaultPipelineRunStore() {
  return { version: 1, runs: [] };
}

function defaultSlideSpecStore() {
  return { version: 2, slidesByDeck: {} };
}

function defaultSavepointStore() {
  return { version: 1, savepointsByDeck: {} };
}

function defaultDeckSpecV2({ initiativeId = '', buyerId = null, deckType = 'utc-internal', globalTemplateTheme = 'sovereign-memo', styleMode = 'professional', copyProvider = 'local', imageProvider = 'placeholder' } = {}) {
  const safeInitiative = String(initiativeId || 'INIT-000');
  const safeBuyer = buyerId ? String(buyerId) : null;
  const safeDeckType = String(deckType || 'utc-internal');
  const deckId = `${safeInitiative}::${safeDeckType}::${safeBuyer || 'none'}`;
  const ts = nowIso();
  return {
    deckId,
    initiativeId: safeInitiative,
    buyerId: safeBuyer,
    deckType: safeDeckType,
    globalTemplateTheme: String(globalTemplateTheme || 'sovereign-memo'),
    styleMode: styleMode === 'creative' ? 'creative' : 'professional',
    copyProvider: String(copyProvider || 'local'),
    imageProvider: String(imageProvider || 'placeholder'),
    slideOrder: [],
    createdAt: ts,
    updatedAt: ts,
    currentSavePointId: null,
  };
}

const LEGACY_LAYOUT_TO_TEMPLATE_ID = Object.freeze({
  title: 'cover-hero',
  section: 'two-col-bullets',
  proof: 'feature-grid',
  diagram: 'layered-diagram',
  close: 'closing-cta',
});

const LEGACY_LAYOUT_FALLBACK_TEMPLATE_ID = 'two-col-bullets';

function mapLegacyLayoutToTemplateId(layout) {
  const key = String(layout || '').trim().toLowerCase();
  return LEGACY_LAYOUT_TO_TEMPLATE_ID[key] || null;
}

function resolveTemplateIdFromLegacyLayout(layout) {
  const mapped = mapLegacyLayoutToTemplateId(layout);
  if (mapped) {
    return { templateId: mapped, fallbackApplied: false, normalizedLayout: String(layout || '').trim().toLowerCase() };
  }
  return {
    templateId: LEGACY_LAYOUT_FALLBACK_TEMPLATE_ID,
    fallbackApplied: true,
    normalizedLayout: String(layout || '').trim().toLowerCase() || null,
    note: 'legacy layout missing or unknown; fallback template applied',
  };
}

const SLIDE_SPEC_V2_SLOT_SCHEMA = Object.freeze({
  version: 2,
  required: ['headline', 'bullets', 'imageSlots'],
  defaults: {
    headline: '',
    bullets: [],
    imageSlots: [
      { slotId: 'img-001', prompt: '' }
    ]
  }
});

function legacyFieldsToSlotsContract({ title = '', bullets = [], imagePrompt = '' } = {}) {
  const normalizedBullets = Array.isArray(bullets)
    ? bullets.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  return {
    headline: String(title || '').trim(),
    bullets: normalizedBullets,
    imageSlots: [
      { slotId: 'img-001', prompt: String(imagePrompt || '').trim() }
    ]
  };
}

async function readTemplateManifestById(templateId) {
  const safeId = String(templateId || '').trim();
  if (!safeId) return null;
  const manifestPath = path.join(DASHBOARD_TEMPLATE_LIBRARY_ROOT, safeId, 'template.json');
  if (!fssync.existsSync(manifestPath)) return null;

  const manifest = await readJson(manifestPath, null);
  if (!manifest || typeof manifest !== 'object') return null;

  const layouts = Array.isArray(manifest.layouts)
    ? manifest.layouts.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  return {
    id: String(manifest.id || safeId),
    name: String(manifest.name || safeId),
    description: String(manifest.description || '').trim(),
    layouts,
    tokens: manifest.tokens && typeof manifest.tokens === 'object' && !Array.isArray(manifest.tokens)
      ? manifest.tokens
      : null,
    manifestPath: path.relative(ROOT, manifestPath),
  };
}

async function readTemplateLibraryIndex() {
  if (!fssync.existsSync(DASHBOARD_TEMPLATE_LIBRARY_ROOT)) return [];
  const entries = await fs.readdir(DASHBOARD_TEMPLATE_LIBRARY_ROOT, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const template = await readTemplateManifestById(entry.name);
    if (!template) continue;
    templates.push(template);
  }

  templates.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return templates;
}

async function ensureTeamAndBoardFiles() {
  if (!fssync.existsSync(TEAM_USERS_FILE)) {
    await fs.writeFile(TEAM_USERS_FILE, JSON.stringify(defaultUsers(), null, 2));
  }
  if (!fssync.existsSync(BOARD_SCHEMA_FILE)) {
    await fs.writeFile(BOARD_SCHEMA_FILE, JSON.stringify(defaultBoardSchema(), null, 2));
  }
  if (!fssync.existsSync(BOARD_FILE)) {
    await fs.writeFile(BOARD_FILE, JSON.stringify(defaultBoard(), null, 2));
  }
  if (!fssync.existsSync(DASHBOARD_DECKSPEC_SCHEMA_FILE)) {
    await fs.writeFile(DASHBOARD_DECKSPEC_SCHEMA_FILE, JSON.stringify(deckSpecSchemaV2(), null, 2));
  }
  if (!fssync.existsSync(DASHBOARD_DECKSPECS_FILE)) {
    await fs.writeFile(DASHBOARD_DECKSPECS_FILE, JSON.stringify(defaultDeckSpecStore(), null, 2));
  }
  if (!fssync.existsSync(DASHBOARD_PIPELINE_RUNS_FILE)) {
    await fs.writeFile(DASHBOARD_PIPELINE_RUNS_FILE, JSON.stringify(defaultPipelineRunStore(), null, 2));
  }
  if (!fssync.existsSync(DASHBOARD_SLIDE_SPECS_FILE)) {
    await fs.writeFile(DASHBOARD_SLIDE_SPECS_FILE, JSON.stringify(defaultSlideSpecStore(), null, 2));
  }
  if (!fssync.existsSync(DASHBOARD_SAVEPOINTS_FILE)) {
    await fs.writeFile(DASHBOARD_SAVEPOINTS_FILE, JSON.stringify(defaultSavepointStore(), null, 2));
  }
  if (!fssync.existsSync(BEACON_QUEUE_SCHEMA_FILE)) {
    await fs.copyFile(path.join(ROOT, 'mission-control', 'beacon', 'beacons.schema.json'), BEACON_QUEUE_SCHEMA_FILE).catch(async () => {
      await fs.writeFile(BEACON_QUEUE_SCHEMA_FILE, JSON.stringify({ version: 1 }, null, 2));
    });
  }
  if (!fssync.existsSync(BEACON_QUEUE_FILE)) {
    await fs.writeFile(BEACON_QUEUE_FILE, JSON.stringify(defaultBeaconQueue(), null, 2));
  }
  await loadBoardValidator();
}

async function loadBoardValidator() {
  const schema = JSON.parse(await fs.readFile(BOARD_SCHEMA_FILE, 'utf8'));
  boardValidator = ajv.compile(schema);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function readDeckSpecStore() {
  const store = await readJson(DASHBOARD_DECKSPECS_FILE, defaultDeckSpecStore());
  if (!store || typeof store !== 'object') return defaultDeckSpecStore();
  if (!Array.isArray(store.decks)) store.decks = [];
  if (!store.version) store.version = 2;
  return store;
}

async function writeDeckSpecStore(store) {
  await writeJson(DASHBOARD_DECKSPECS_FILE, store);
}

async function readPipelineRunStore() {
  const store = await readJson(DASHBOARD_PIPELINE_RUNS_FILE, defaultPipelineRunStore());
  if (!store || typeof store !== 'object') return defaultPipelineRunStore();
  if (!Array.isArray(store.runs)) store.runs = [];
  if (!store.version) store.version = 1;
  return store;
}

async function writePipelineRunStore(store) {
  await writeJson(DASHBOARD_PIPELINE_RUNS_FILE, store);
}

async function readSlideSpecStore() {
  const store = await readJson(DASHBOARD_SLIDE_SPECS_FILE, defaultSlideSpecStore());
  if (!store || typeof store !== 'object') return defaultSlideSpecStore();
  if (!store.version) store.version = 2;
  if (!store.slidesByDeck || typeof store.slidesByDeck !== 'object' || Array.isArray(store.slidesByDeck)) {
    store.slidesByDeck = {};
  }
  return store;
}

async function writeSlideSpecStore(store) {
  await writeJson(DASHBOARD_SLIDE_SPECS_FILE, store);
}

async function readSavepointStore() {
  const store = await readJson(DASHBOARD_SAVEPOINTS_FILE, defaultSavepointStore());
  if (!store || typeof store !== 'object') return defaultSavepointStore();
  if (!store.version) store.version = 1;
  if (!store.savepointsByDeck || typeof store.savepointsByDeck !== 'object' || Array.isArray(store.savepointsByDeck)) {
    store.savepointsByDeck = {};
  }
  return store;
}

async function writeSavepointStore(store) {
  await writeJson(DASHBOARD_SAVEPOINTS_FILE, store);
}

const PIPELINE_ALLOWED_SCOPES = new Set(['deck', 'slide']);
const PIPELINE_ALLOWED_STAGES = ['plan', 'draft', 'critique', 'rewrite', 'render', 'qa'];
const PIPELINE_ALLOWED_STAGES_SET = new Set(PIPELINE_ALLOWED_STAGES);
const PIPELINE_STAGE_STATUS_FLOW = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['completed', 'failed', 'skipped'],
  completed: [],
  failed: [],
  skipped: []
};
const PIPELINE_STAGE_ALLOWED_STATUS = new Set(Object.keys(PIPELINE_STAGE_STATUS_FLOW));

function normalizePipelineRunPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'invalid_payload', status: 400 };
  }

  const scope = String(payload.scope || '').trim().toLowerCase();
  if (!PIPELINE_ALLOWED_SCOPES.has(scope)) {
    return { error: 'invalid_scope', status: 400 };
  }

  const slideId = payload.slideId == null ? null : String(payload.slideId || '').trim();
  if (scope === 'slide' && !slideId) {
    return { error: 'slide_id_required', status: 400 };
  }

  if (!Array.isArray(payload.stages) || payload.stages.length === 0) {
    return { error: 'invalid_stages', status: 400 };
  }

  const stages = payload.stages.map((s) => String(s || '').trim().toLowerCase());
  if (stages.some((s) => !PIPELINE_ALLOWED_STAGES_SET.has(s))) {
    return { error: 'invalid_stages', status: 400 };
  }

  if (new Set(stages).size !== stages.length) {
    return { error: 'duplicate_stages', status: 400 };
  }

  return { scope, slideId, stages };
}

function buildPipelineRunId(ts = new Date()) {
  const z = ts.toISOString().replace(/[-:]/g, '');
  const compact = `${z.slice(0, 8)}_${z.slice(9, 15)}`;
  const suffix = crypto.randomBytes(3).toString('hex');
  return `run_${compact}_${suffix}`;
}

function buildInitialPipelineStageState(stages = []) {
  const safeStages = Array.isArray(stages) ? stages : [];
  return safeStages.map((stage, idx) => ({
    stage,
    status: idx === 0 ? 'in_progress' : 'pending',
    updatedAt: nowIso(),
    startedAt: idx === 0 ? nowIso() : null,
    completedAt: null,
    error: null
  }));
}

function derivePipelineRunStatus(stageState = []) {
  if (!Array.isArray(stageState) || stageState.length === 0) return 'started';
  if (stageState.some((s) => s.status === 'failed')) return 'failed';
  if (stageState.every((s) => s.status === 'completed' || s.status === 'skipped')) return 'completed';
  if (stageState.some((s) => s.status === 'in_progress')) return 'running';
  return 'started';
}

async function createPipelineRunRecord({ deckId, scope, slideId = null, stages = [] } = {}) {
  const now = nowIso();
  const stageState = buildInitialPipelineStageState(stages);
  const run = {
    runId: buildPipelineRunId(new Date()),
    deckId: String(deckId || '').trim(),
    scope,
    slideId: scope === 'slide' ? String(slideId || '').trim() : null,
    stages,
    stageState,
    status: derivePipelineRunStatus(stageState),
    createdAt: now,
    updatedAt: now,
  };

  const store = await readPipelineRunStore();
  store.runs.unshift(run);
  await writePipelineRunStore(store);
  return run;
}

async function updatePipelineRunStage({ runId, stage, nextStatus, error = null } = {}) {
  const safeRunId = String(runId || '').trim();
  const safeStage = String(stage || '').trim().toLowerCase();
  const safeNextStatus = String(nextStatus || '').trim().toLowerCase();
  if (!safeRunId || !safeStage || !PIPELINE_ALLOWED_STAGES_SET.has(safeStage) || !PIPELINE_STAGE_ALLOWED_STATUS.has(safeNextStatus)) {
    return { error: 'invalid_stage_transition', status: 400 };
  }

  const store = await readPipelineRunStore();
  const run = store.runs.find((r) => String(r.runId) === safeRunId);
  if (!run) return { error: 'run_not_found', status: 404 };

  if (!Array.isArray(run.stageState) || run.stageState.length === 0) {
    run.stageState = buildInitialPipelineStageState(run.stages || []);
  }

  const stageRow = run.stageState.find((s) => String(s.stage || '').toLowerCase() === safeStage);
  if (!stageRow) return { error: 'stage_not_in_run', status: 400 };

  const allowedNext = PIPELINE_STAGE_STATUS_FLOW[String(stageRow.status || 'pending')] || [];
  if (!allowedNext.includes(safeNextStatus)) {
    return { error: 'invalid_stage_transition', status: 400 };
  }

  const ts = nowIso();
  stageRow.status = safeNextStatus;
  stageRow.updatedAt = ts;
  if (safeNextStatus === 'in_progress' && !stageRow.startedAt) stageRow.startedAt = ts;
  if (safeNextStatus === 'completed' || safeNextStatus === 'failed' || safeNextStatus === 'skipped') {
    stageRow.completedAt = ts;
  }
  stageRow.error = safeNextStatus === 'failed' ? (error ? String(error).slice(0, 500) : 'stage_failed') : null;

  run.status = derivePipelineRunStatus(run.stageState);
  run.updatedAt = ts;

  await writePipelineRunStore(store);
  return { run };
}

function defaultBeaconQueue() {
  return { version: 1, beacons: [] };
}

async function readBeaconQueue() {
  const q = await readJson(BEACON_QUEUE_FILE, defaultBeaconQueue());
  if (!q || typeof q !== 'object') return defaultBeaconQueue();
  if (!Array.isArray(q.beacons)) q.beacons = [];
  if (!q.version) q.version = 1;
  return q;
}

async function writeBeaconQueue(queue) {
  await writeJson(BEACON_QUEUE_FILE, queue);
}

const BEACON_STATUS_FLOW = {
  draft: ['harden', 'hold', 'rejected'],
  harden: ['review', 'hold', 'rejected'],
  review: ['approved', 'rejected', 'hold'],
  approved: ['published', 'hold'],
  hold: ['draft', 'harden', 'review'],
  rejected: ['draft'],
  published: []
};

function beaconStatusAllowed(v) {
  return new Set(['draft', 'harden', 'review', 'approved', 'published', 'hold', 'rejected']).has(String(v || ''));
}

function canTransitionBeaconStatus(fromStatus, toStatus) {
  const from = String(fromStatus || '').trim();
  const to = String(toStatus || '').trim();
  return (BEACON_STATUS_FLOW[from] || []).includes(to);
}

function resolveDeckSelectors(input = {}) {
  return {
    initiativeId: String(input.initiativeId || input.initiative_id || '').trim(),
    deckType: String(input.deckType || input.deck_type || 'utc-internal').trim() || 'utc-internal',
    buyerId: input.buyerId || input.buyer_id ? String(input.buyerId || input.buyer_id).trim() : null,
  };
}

async function getOrCreateDeckSpecBySelectors(input = {}, { createIfMissing = true } = {}) {
  const sel = resolveDeckSelectors(input);
  if (!sel.initiativeId) return { error: 'initiativeId required', status: 400 };

  const store = await readDeckSpecStore();
  let deck = store.decks.find((d) => String(d.initiativeId) === sel.initiativeId && String(d.deckType) === sel.deckType && String(d.buyerId || '') === String(sel.buyerId || ''));

  if (!deck && createIfMissing) {
    deck = defaultDeckSpecV2({
      initiativeId: sel.initiativeId,
      buyerId: sel.buyerId,
      deckType: sel.deckType,
    });
    store.decks.push(deck);
    await writeDeckSpecStore(store);
  }

  return { deck: deck || null, selectors: sel, store };
}

function sanitizeTaskPatch(input = {}) {
  const out = {};
  if (typeof input.title === 'string') out.title = input.title.trim();
  if (typeof input.owner === 'string' || input.owner === null) out.owner = input.owner;
  if (typeof input.due_date === 'string' || input.due_date === null) out.due_date = input.due_date;
  if (typeof input.priority === 'string') out.priority = input.priority;
  if (Array.isArray(input.tags)) out.tags = input.tags.map(String).map((x) => x.trim()).filter(Boolean);
  if (Array.isArray(input.linked_refs)) out.linked_refs = input.linked_refs.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof input.description === 'string' || input.description === null) out.description = input.description;
  return out;
}

function taskSortScore(t) {
  const p = { P0: 0, P1: 1, P2: 2, P3: 3 }[t.priority] ?? 99;
  const d = t.due_date ? new Date(t.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  return [p, d, t.updated_at || ''];
}

function limitAttempt(map, key, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const row = map.get(key);
  if (!row || now - row.firstTs > windowMs) {
    map.set(key, { count: 1, firstTs: now });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  map.set(key, row);
  return true;
}

function clearAttempt(map, key) { map.delete(key); }

async function appendJsonl(dirRoot, obj) {
  const d = dateOnly();
  const p = path.join(dirRoot, `${d}.jsonl`);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, JSON.stringify(obj) + '\n', 'utf8');
}

async function appendAuditEvent(event) {
  const normalized = {
    ts: event.ts || nowIso(),
    actor: event.actor || 'unknown',
    role: event.role || 'unknown',
    event_type: event.event_type || 'system.event',
    entity_type: event.entity_type || 'system',
    entity_id: event.entity_id || null,
    meta: event.meta || {},
  };
  await appendJsonl(ACTIVITY_ROOT, normalized);
  if ((normalized.entity_type === 'task' || String(normalized.event_type || '').startsWith('task.')) && normalized.entity_id) {
    await appendJsonl(BOARD_HISTORY_ROOT, normalized);
  }
}

async function createSnapshot(reason = 'state.change') {
  const stamp = tsForPath();
  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  const snapshotPath = path.join(DASHBOARD_SNAPSHOTS, `${stamp}.json`);
  await writeJson(snapshotPath, state);
  const change = `## ${nowIso()}\n- Snapshot reason: ${reason}\n- Snapshot: \`${rel(snapshotPath)}\`\n\n`;
  if (!fssync.existsSync(DASHBOARD_CHANGELOG)) {
    await fs.writeFile(DASHBOARD_CHANGELOG, '# Dashboard State Changelog\n\n', 'utf8');
  }
  await fs.appendFile(DASHBOARD_CHANGELOG, change, 'utf8');
}

async function writeBoard(board, actor, eventType, taskId, before, after, role = 'editor') {
  if (!boardValidator) await loadBoardValidator();
  const ok = boardValidator(board);
  if (!ok) {
    throw new Error('BOARD validation failed: ' + ajv.errorsText(boardValidator.errors));
  }
  await writeJson(BOARD_FILE, board);

  await appendAuditEvent({
    ts: nowIso(),
    actor,
    role,
    event_type: eventType,
    entity_type: 'task',
    entity_id: taskId || null,
    meta: { before: before || null, after: after || null },
  });
  await refreshBoardStateIntegration(board);
  await createSnapshot(`board.${eventType}`);
}

async function readActivityEvents({ limit = 20, actor, entity_type, date, maxScan = 1000 } = {}) {
  const files = (await fs.readdir(ACTIVITY_ROOT).catch(() => []))
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse();

  const out = [];
  let scanned = 0;

  for (const f of files) {
    if (date && !f.startsWith(date)) continue;
    const lines = (await fs.readFile(path.join(ACTIVITY_ROOT, f), 'utf8').catch(() => '')).split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      if (scanned >= maxScan) break;
      scanned += 1;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (actor && String(ev.actor || '').toLowerCase() !== String(actor).toLowerCase()) continue;
      if (entity_type && ev.entity_type !== entity_type) continue;
      out.push(ev);
      if (out.length >= limit) return out;
    }
    if (scanned >= maxScan) break;
  }

  return out;
}

async function listReviewPackets(limit = 50) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => []))
    .filter((f) => /^RP-\d+/i.test(f) && f.endsWith('.md'))
    .sort((a, b) => {
      const na = Number((a.match(/^RP-(\d+)/i) || [0, 0])[1]);
      const nb = Number((b.match(/^RP-(\d+)/i) || [0, 0])[1]);
      if (na !== nb) return nb - na;
      return b.localeCompare(a);
    })
    .slice(0, limit);

  const out = [];
  for (const f of files) {
    const full = path.join(REVIEW_PACKET_ROOT, f);
    const txt = await fs.readFile(full, 'utf8').catch(() => '');
    const m = txt.match(/^---\n([\s\S]*?)\n---/);
    const front = {};
    if (m) {
      for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    }

    const rpFromFile = (f.match(/^(RP-\d+)/i) || [null, null])[1];
    const titleFromHeader = ((txt.match(/^#\s+(.+)$/m) || [null, null])[1] || '').trim();

    const summaryBlock = ((txt.match(/^##\s+Summary\s*\n([\s\S]*?)(\n##\s+|$)/m) || [null, ''])[1] || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[[^\]]*\]\([^\)]*\)/g, '$1')
      .replace(/[#>*_`-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const compact = summaryBlock ? (summaryBlock.length > 180 ? `${summaryBlock.slice(0, 177)}...` : summaryBlock) : '';

    out.push({
      rp_id: front.rp_id || rpFromFile || 'N/A',
      title: front.title || titleFromHeader || f,
      linked_task: front.linked_task || '',
      created_at: front.created_at || '',
      created_by: front.created_by || '',
      status: front.status || (m ? 'Draft' : 'Legacy'),
      recommended_action: front.recommended_action || '',
      compact,
      path: rel(full),
    });
  }
  return out;
}

async function refreshBoardStateIntegration(board) {
  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  const counts = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, 0]));
  for (const t of board.tasks) counts[t.status] = (counts[t.status] || 0) + 1;

  const sorted = [...board.tasks].sort((a, b) => {
    const [ap, ad] = taskSortScore(a);
    const [bp, bd] = taskSortScore(b);
    if (ap !== bp) return ap - bp;
    return ad - bd;
  });

  state.board = {
    counts,
    top10: sorted.slice(0, 10).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date || null,
      owner: t.owner || null,
      review_packet_id: t.review_packet_id || null,
    })),
    last10Activity: await readActivityEvents({ limit: 10 }),
  };

  state.pendingReviewPackets = (await listReviewPackets(200)).filter((rp) => rp.status === 'Ready for Review').length;
  await writeJson(DASHBOARD_STATE_FILE, state);
}

function formatRpFrontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${k}: ${v === null ? 'null' : String(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

async function createReviewPacketStub({ title, linkedTaskId, createdBy, status = 'Draft', recommendedAction = 'Approve' }) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => [])).filter((f) => /^RP-\d+/i.test(f));
  const maxN = files.reduce((m, f) => {
    const mm = f.match(/^RP-(\d+)/i);
    return mm ? Math.max(m, Number(mm[1])) : m;
  }, 0);
  const next = String(maxN + 1).padStart(4, '0');
  const rpId = `RP-${next}`;
  const slug = safeName((title || linkedTaskId || 'review-packet').toLowerCase()).slice(0, 80);
  const filename = `${rpId}-${slug}.md`;
  const full = path.join(REVIEW_PACKET_ROOT, filename);
  const fm = formatRpFrontmatter({
    rp_id: rpId,
    title: title || 'Review Packet',
    linked_task: linkedTaskId || 'null',
    created_by: createdBy,
    created_at: nowIso(),
    status,
    recommended_action: recommendedAction,
    architect_decision: 'null',
    architect_notes: 'null',
  });
  await fs.writeFile(full, `${fm}# ${title || 'Review Packet'}\n\n## Summary\n\n(complete)\n`, 'utf8');
  return { rpId, path: rel(full), fullPath: full };
}

async function parseRpFileById(rpId) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => []))
    .filter((f) => f.startsWith(rpId + '-'));
  if (!files.length) return null;
  const full = path.join(REVIEW_PACKET_ROOT, files[0]);
  const txt = await fs.readFile(full, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  const front = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { front, full, text: txt };
}

async function updateRpFrontmatter(rpId, patch) {
  const parsed = await parseRpFileById(rpId);
  if (!parsed) throw new Error('RP not found');
  const nextFront = { ...parsed.front, ...patch };
  const rest = parsed.text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const next = formatRpFrontmatter(nextFront) + rest;
  await fs.writeFile(parsed.full, next, 'utf8');
  return { path: rel(parsed.full), front: nextFront };
}

function getUserLabel(req) {
  const u = currentUser(req);
  return u?.username || 'unknown';
}

app.get('/auth/login', (_req, res) => {
  res.type('html').send(`<!doctype html><html><head>${uiHead('Team Login')}</head><body class="login-page">
  <div class="app-shell" style="max-width:560px">
    <div class="card shadow-sm"><div class="card-body p-4">
      <h3>Team Login</h3>
      <form method="post" action="/auth/login" class="vstack gap-3">
        <input class="form-control" name="username" placeholder="Username" required />
        <input class="form-control" type="password" name="password" placeholder="Password" required />
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>
      <p class="text-muted mt-3 mb-0">Need an invite? Ask your admin for a link.</p>
    </div></div></div>
  </body></html>`);
});

app.post('/auth/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!limitAttempt(teamLoginAttempts, `team:${ip}`)) {
    return res.status(429).send('Too many login attempts. Try again later.');
  }

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const user = (data.users || []).find((u) => u.username === username && u.active !== false);
  if (!user) {
    await appendAuditEvent({ ts: nowIso(), actor: username || 'unknown', role: 'anonymous', event_type: 'login.failed', entity_type: 'auth', entity_id: 'team', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) {
    await appendAuditEvent({ ts: nowIso(), actor: username, role: normalizedRole(user.role || 'observer'), event_type: 'login.failed', entity_type: 'auth', entity_id: 'team', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  clearAttempt(teamLoginAttempts, `team:${ip}`);
  req.session.user = { scope: 'team', username: user.username, role: normalizedRole(user.role), loginAt: nowIso() };
  await appendAuditEvent({ ts: nowIso(), actor: user.username, role: normalizedRole(user.role), event_type: 'login.success', entity_type: 'auth', entity_id: 'team', meta: { ip } });
  return res.redirect('/board');
});

app.post('/auth/logout', requireAnyAuth, async (req, res) => {
  const actor = getUserLabel(req);
  const role = effectiveRole(req) || 'anonymous';
  req.session.destroy(() => undefined);
  await appendAuditEvent({ ts: nowIso(), actor, role, event_type: 'admin.logout', entity_type: 'auth', entity_id: 'logout', meta: {} });
  res.redirect('/auth/login');
});

app.get('/auth/invite/:token', async (req, res) => {
  const token = String(req.params.token || '');
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const invite = (data.invites || []).find((i) => i.token === token && !i.usedAt && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now()));
  if (!invite) return res.status(404).send('Invite link is invalid or expired.');
  res.type('html').send(`<!doctype html><html><head>${uiHead('Accept Invite')}</head><body>
  <div class="app-shell" style="max-width:620px"><div class="card shadow-sm"><div class="card-body p-4">
    <h3>Create Team Account</h3>
    <p class="text-muted">Role: ${escapeHtml(invite.role)}</p>
    <form method="post" action="/auth/invite/${encodeURIComponent(token)}" class="vstack gap-3">
      <input class="form-control" name="username" placeholder="Username" required />
      <input class="form-control" type="password" name="password" placeholder="Password" required />
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>
  </div></div></div></body></html>`);
});

app.post('/auth/invite/:token', async (req, res) => {
  const token = String(req.params.token || '');
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || password.length < 8) return res.status(400).send('Username and strong password are required.');

  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const invite = (data.invites || []).find((i) => i.token === token && !i.usedAt && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now()));
  if (!invite) return res.status(404).send('Invite link is invalid or expired.');
  if ((data.users || []).some((u) => u.username === username)) return res.status(409).send('Username already exists.');

  const hash = await bcrypt.hash(password, 12);
  const user = { id: crypto.randomUUID(), username, role: invite.role, passwordHash: hash, active: true, createdAt: nowIso(), invitedBy: invite.createdBy || 'admin' };
  data.users.push(user);
  invite.usedAt = nowIso();
  invite.usedBy = username;
  await writeJson(TEAM_USERS_FILE, data);
  await appendAuditEvent({ ts: nowIso(), actor: username, role: normalizedRole(user.role), event_type: 'admin.invite.accept', entity_type: 'user', entity_id: username, meta: { role: normalizedRole(user.role) } });
  res.redirect('/auth/login');
});

app.get('/board', requireAnyAuth, async (_req, res) => {
  const u = _req.session.user;
  const canWrite = ['architect', 'editor'].includes(u.role);
  res.type('html').send(`<!doctype html><html><head>${uiHead('Task Board')}</head><body>
  <div class="app-shell">
    <nav class="oc-nav" aria-label="Board navigation">
      <a class="oc-nav-title" href="/board">Task Board</a>
      <div class="oc-nav-links">
        <div class="oc-nav-group-label">Market Intelligence</div>
        <a class="nav-link" href="/dashboard/signals" title="Signals"><i data-lucide="radio" class="nav-icon"></i><span class="nav-label">Signals</span></a>
        <a class="nav-link" href="/dashboard/platform-pressure" title="Platforms"><i data-lucide="radar" class="nav-icon"></i><span class="nav-label">Platforms</span></a>
        <a class="nav-link" href="/dashboard/beacons" title="Beacons"><i data-lucide="satellite" class="nav-icon"></i><span class="nav-label">Beacons</span></a>

        <div class="oc-nav-group-label">Origination</div>
        <a class="nav-link" href="/dashboard/buyers" title="Buyers"><i data-lucide="building-2" class="nav-icon"></i><span class="nav-label">Buyers</span></a>
        <a class="nav-link" href="/dashboard/initiatives" title="Initiatives"><i data-lucide="puzzle" class="nav-icon"></i><span class="nav-label">Initiatives</span></a>
        <a class="nav-link" href="/dashboard/capital-map" title="Capital Map"><i data-lucide="network" class="nav-icon"></i><span class="nav-label">Capital Map</span></a>

        <div class="oc-nav-group-label">Control</div>
        <a class="nav-link" href="/dashboard/" title="Dashboard"><i data-lucide="layout-dashboard" class="nav-icon"></i><span class="nav-label">Dashboard</span></a>
        <a class="nav-link" href="/dashboard/activity" title="Activity"><i data-lucide="activity" class="nav-icon"></i><span class="nav-label">Activity</span></a>
        <a class="nav-link" href="/dashboard/review" title="Review"><i data-lucide="file-text" class="nav-icon"></i><span class="nav-label">Review</span></a>
        <a class="nav-link active" href="/board" title="Board"><i data-lucide="kanban-square" class="nav-icon"></i><span class="nav-label">Board</span></a>

        <div class="oc-nav-group-label">Production</div>
        <a class="nav-link" href="/dashboard/presentation-studio" title="Presentation Studio"><i data-lucide="presentation" class="nav-icon"></i><span class="nav-label">Presentation Studio</span></a>

        <div class="oc-nav-group-label">Ops</div>
        <a class="nav-link" href="/dashboard/uos" title="UOS"><i data-lucide="book-open" class="nav-icon"></i><span class="nav-label">UOS</span></a>
        <a class="nav-link" href="/dashboard/team" title="Team"><i data-lucide="users" class="nav-icon"></i><span class="nav-label">Team</span></a>
      </div>
      <div class="small text-muted oc-nav-user">${escapeHtml(u.username)} (${escapeHtml(u.role)})</div>
      <form method="post" action="/auth/logout" class="oc-nav-footer m-0"><button class="btn btn-sm btn-outline-secondary logout-btn" type="submit">Logout</button></form>
    </nav>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <a class="btn btn-outline-secondary" href="/dashboard/">Go to Dashboard</a>
      <a class="btn btn-outline-secondary" href="/dashboard/presentation-studio">Open Presentation Studio</a>
      ${canWrite ? '<button id="newTaskBtn" class="btn btn-primary">New Task</button>' : ''}
      ${u.role === 'architect' ? '<button id="inviteBtn" class="btn btn-outline-primary">Create Invite Link</button>' : ''}
    </div>

    <div id="board" class="row g-3"></div>
  </div>

  <div class="offcanvas offcanvas-end" tabindex="-1" id="taskDetailPanel" style="width:min(680px,98vw)">
    <div class="offcanvas-header">
      <h5 class="offcanvas-title" id="taskPanelTitle">Task Detail</h5>
      <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body">
      <input type="hidden" id="d_taskId" />
      <div class="row g-2">
        <div class="col-12"><label class="form-label small">Title</label><input class="form-control form-control-sm" id="d_title" /></div>
        <div class="col-6"><label class="form-label small">Owner</label><input class="form-control form-control-sm" id="d_owner" /></div>
        <div class="col-6"><label class="form-label small">Due date</label><input type="date" class="form-control form-control-sm" id="d_due_date" /></div>
        <div class="col-6"><label class="form-label small">Priority</label><select class="form-select form-select-sm" id="d_priority"><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></div>
        <div class="col-6"><label class="form-label small">Status</label><select class="form-select form-select-sm" id="d_status"></select></div>
        <div class="col-12"><label class="form-label small">Tags (comma separated)</label><input class="form-control form-control-sm" id="d_tags" /></div>
        <div class="col-12"><label class="form-label small">Linked refs (comma separated)</label><input class="form-control form-control-sm" id="d_refs" /></div>
        <div class="col-12"><label class="form-label small">Description</label><textarea class="form-control form-control-sm" id="d_desc" rows="4"></textarea></div>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button id="panelSaveBtn" class="btn btn-sm btn-primary">Save</button>
        <button id="panelRequestBtn" class="btn btn-sm btn-outline-warning">Request Approval</button>
        <button id="panelApproveBtn" class="btn btn-sm btn-success" style="display:none">Approve</button>
        <button id="panelMoveBtn" class="btn btn-sm btn-dark">Move to Selected Status</button>
      </div>
      <div class="mt-3">
        <label class="form-label small">Add comment</label>
        <textarea class="form-control form-control-sm" id="panelCommentText" rows="3" placeholder="Write a comment..."></textarea>
        <button id="panelCommentBtn" class="btn btn-sm btn-outline-secondary mt-2">Add Comment</button>
      </div>
      <div class="mt-3">
        <div class="small text-muted mb-1">Comments</div>
        <div id="panelComments" class="small"></div>
      </div>
    </div>
  </div>

<script>
const me = ${JSON.stringify(u)};
const canWrite = ${JSON.stringify(canWrite)};
const columns = ${JSON.stringify(BOARD_COLUMNS)};
let boardData = { tasks: [] };
const api = (path) => '/dashboard/api' + path;

const panelEl = document.getElementById('taskDetailPanel');
const panel = (window.bootstrap && window.bootstrap.Offcanvas) ? new bootstrap.Offcanvas(panelEl) : null;
let activeTaskId = null;

function showTaskPanel(){
  if (panel) return panel.show();
  panelEl.classList.add('show');
  panelEl.style.visibility = 'visible';
  panelEl.style.display = 'block';
  panelEl.style.transform = 'translateX(0)';
}

function hideTaskPanel(){
  if (panel) return panel.hide();
  panelEl.classList.remove('show');
  panelEl.style.visibility = 'hidden';
  panelEl.style.display = 'none';
}

function toArray(v){ return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }

function esc(s){ return String(s ?? '').replace(/[&<>]/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

function cardHTML(t){
  const due = t.due_date ? 'Due: ' + t.due_date : '';
  const comments = (t.comments || []).length;
  return [
    '<div class="card mb-2 js-task-card" draggable="' + (canWrite ? 'true' : 'false') + '" data-task-id="' + t.id + '" style="cursor:pointer"><div class="card-body p-2">',
    '<div><strong>' + esc(t.title) + '</strong></div>',
    '<div class="small text-muted d-flex align-items-center gap-2">Owner: ' + esc(t.owner || '—') + ' ' + esc(due) + '<span class="badge text-bg-secondary">' + esc(t.priority) + '</span></div>',
    '<div class="small">' + esc((t.tags||[]).join(', ')) + '</div>',
    '<div class="small text-muted">Comments: ' + comments + '</div>',
    '</div></div>'
  ].join('');
}

function render(){
  const el = document.getElementById('board');
  el.innerHTML = columns.map(c => {
    const tasks = (boardData.tasks||[]).filter(t => t.status===c);
    return [
      '<div class="col-12 col-xl"><div class="card h-100">',
      '<div class="card-header"><strong>' + c + '</strong> <span class="badge text-bg-light">' + tasks.length + '</span></div>',
      '<div class="card-body" data-column="' + c + '" ondragover="allowDrop(event)" ondrop="dropTask(event,this.dataset.column)">',
      tasks.map(cardHTML).join(''),
      '</div></div></div>'
    ].join('');
  }).join('');

  if (canWrite) {
    document.querySelectorAll('[draggable="true"]').forEach(node => {
      node.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', node.dataset.taskId));
    });
  }

  document.querySelectorAll('.js-task-card').forEach(node => {
    node.addEventListener('click', () => openTaskPanel(node.dataset.taskId));
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

async function loadBoard(){
  const r = await fetch(api('/board'));
  boardData = await r.json();
  render();
}

function allowDrop(e){ if (canWrite) e.preventDefault(); }
async function moveTaskTo(id, status){
  if (!canWrite) return;
  const r = await fetch('/board/move/' + encodeURIComponent(id) + '/' + encodeURIComponent(status));
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    alert(j.error || ('Move failed (' + r.status + ')'));
    return;
  }
  await loadBoard();
}
async function dropTask(e, status){
  if (!canWrite) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  await moveTaskTo(id, status);
}

function renderPanelComments(task){
  const list = (task?.comments || []);
  document.getElementById('panelComments').innerHTML = list.length
    ? list.slice().reverse().map(c => '<div class="border rounded p-2 mb-1"><div class="small text-muted">' + esc(c.by || 'user') + ' · ' + esc(String(c.at || '').slice(0,16).replace('T',' ')) + '</div><div>' + esc(c.text || '') + '</div></div>').join('')
    : '<div class="text-muted">No comments yet.</div>';
}

function openTaskPanel(id){
  const t = (boardData.tasks || []).find(x => x.id === id); if (!t) return;
  activeTaskId = id;
  document.getElementById('taskPanelTitle').textContent = 'Task Detail';
  document.getElementById('d_taskId').value = id;
  document.getElementById('d_title').value = t.title || '';
  document.getElementById('d_owner').value = t.owner || '';
  document.getElementById('d_due_date').value = t.due_date || '';
  document.getElementById('d_priority').value = t.priority || 'P2';
  document.getElementById('d_tags').value = (t.tags || []).join(',');
  document.getElementById('d_refs').value = (t.linked_refs || []).join(',');
  document.getElementById('d_desc').value = t.description || '';
  const statusSel = document.getElementById('d_status');
  statusSel.innerHTML = columns.map(c => '<option value="' + c + '"' + (c === t.status ? ' selected' : '') + '>' + c + '</option>').join('');
  document.getElementById('panelApproveBtn').style.display = (me.role === 'architect' && t.request_approval && !t.request_approval.approved) ? '' : 'none';
  renderPanelComments(t);
  showTaskPanel();
}

function openNewTask(){
  if (!canWrite) return;
  activeTaskId = '';
  document.getElementById('taskPanelTitle').textContent = 'Create Task';
  document.getElementById('d_taskId').value = '';
  document.getElementById('d_title').value = '';
  document.getElementById('d_owner').value = '';
  document.getElementById('d_due_date').value = '';
  document.getElementById('d_priority').value = 'P2';
  document.getElementById('d_tags').value = '';
  document.getElementById('d_refs').value = '';
  document.getElementById('d_desc').value = '';
  document.getElementById('d_status').innerHTML = columns.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  document.getElementById('panelApproveBtn').style.display = 'none';
  document.getElementById('panelComments').innerHTML = '<div class="text-muted">Save task first to enable comments.</div>';
  showTaskPanel();
}

async function saveTask(){
  const id = document.getElementById('d_taskId').value;
  const payload = {
    title: document.getElementById('d_title').value.trim(),
    owner: document.getElementById('d_owner').value.trim() || null,
    due_date: document.getElementById('d_due_date').value || null,
    priority: document.getElementById('d_priority').value,
    status: document.getElementById('d_status').value,
    tags: toArray(document.getElementById('d_tags').value),
    linked_refs: toArray(document.getElementById('d_refs').value),
    description: document.getElementById('d_desc').value || ''
  };
  if (!payload.title) return alert('Title is required');
  const url = id ? api('/tasks/' + encodeURIComponent(id)) : api('/tasks');
  const method = id ? 'PATCH' : 'POST';
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok){ alert('Save failed'); return; }
  const j = await r.json().catch(()=>null);
  await loadBoard();
  const reopenId = id || j?.task?.id || '';
  if (reopenId) openTaskPanel(reopenId);
}

async function saveComment(){
  const id = document.getElementById('d_taskId').value;
  const text = document.getElementById('panelCommentText').value.trim();
  if(!id) return alert('Save task first');
  if(!text) return;
  const r = await fetch(api('/tasks/' + encodeURIComponent(id) + '/comment'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
  if(!r.ok){ alert('Comment failed'); return; }
  document.getElementById('panelCommentText').value = '';
  await loadBoard();
  openTaskPanel(id);
}

async function requestApproval(id){
  const title = prompt('Optional review packet title (blank to skip)','') || '';
  const r = await fetch(api('/tasks/' + encodeURIComponent(id) + '/request-approval'), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ create_review_packet: !!title, review_packet_title: title })});
  if(!r.ok){ alert('Request approval failed'); return; }
  await loadBoard();
}

async function approveTask(id){
  const r = await fetch(api('/tasks/' + encodeURIComponent(id) + '/approve'), { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
  if(!r.ok){ alert('Approve failed'); return; }
  await loadBoard();
}

async function createInvite(){
  const role = prompt('Invite role (editor/observer/architect)','observer');
  const r = await fetch(api('/auth/invite'), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role })});
  const j = await r.json();
  if(!r.ok){ alert(j.error || 'Invite failed'); return; }
  prompt('Copy invite link', j.inviteUrl);
}

if(document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').addEventListener('click', openNewTask);
if(document.getElementById('panelSaveBtn')) document.getElementById('panelSaveBtn').addEventListener('click', saveTask);
if(document.getElementById('panelCommentBtn')) document.getElementById('panelCommentBtn').addEventListener('click', saveComment);
if(document.getElementById('panelRequestBtn')) document.getElementById('panelRequestBtn').addEventListener('click', () => {
  const id = document.getElementById('d_taskId').value; if (id) requestApproval(id);
});
if(document.getElementById('panelApproveBtn')) document.getElementById('panelApproveBtn').addEventListener('click', () => {
  const id = document.getElementById('d_taskId').value; if (id) approveTask(id);
});
if(document.getElementById('panelMoveBtn')) document.getElementById('panelMoveBtn').addEventListener('click', async () => {
  const id = document.getElementById('d_taskId').value;
  const status = document.getElementById('d_status').value;
  if (id && status) await moveTaskTo(id, status);
  if (id) openTaskPanel(id);
});
if(document.getElementById('inviteBtn')) document.getElementById('inviteBtn').addEventListener('click', createInvite);
panelEl?.querySelector('.btn-close')?.addEventListener('click', hideTaskPanel);
loadBoard();
</script>
  </body></html>`);
});

app.all(/^\/dashboard\/api\/(.*)$/, (req, _res, next) => {
  const suffix = String(req.params?.[0] || '').replace(/^\/+/, '');
  req.url = '/api/' + suffix;
  next();
});

app.get('/api/me', requireAnyAuth, async (req, res) => {
  res.json({ user: currentUser(req), effectiveRole: effectiveRole(req) });
});

const serveCapitalMap = async (_req, res) => {
  const data = await readJson(DASHBOARD_CAPITAL_MAP_FILE, { nodes: [], edges: [] });
  res.json({
    nodes: Array.isArray(data?.nodes) ? data.nodes : [],
    edges: Array.isArray(data?.edges) ? data.edges : [],
  });
};

app.get('/api/capital-map', serveCapitalMap);
app.get('/dashboard/api/capital-map', serveCapitalMap);

app.post('/api/contact-paths', requireRole('architect','editor'), async (req, res) => {
  const file = DASHBOARD_CONTACT_PATHS_FILE;
  const rows = await readJson(file, []);
  const body = req.body || {};
  const buyer_id = String(body.buyer_id || '').trim();
  const name = String(body.name || '').trim();
  if (!buyer_id || !name) return res.status(400).send('buyer_id and name required');

  const path_id = String(body.path_id || `PATH-${buyer_id}-${Date.now()}`).trim();
  const item = {
    path_id,
    buyer_id,
    contact_id: String(body.contact_id || '').trim() || null,
    name,
    org: String(body.org || '').trim(),
    role: String(body.role || '').trim(),
    relationship_type: String(body.relationship_type || '').trim() || 'partner',
    access_score: Number(body.access_score || 0),
    credibility_score: Number(body.credibility_score || 0),
    relevance_score: Number(body.relevance_score || 0),
    freshness_days: Number(body.freshness_days || 0),
    influence_score: Number(body.influence_score || 0),
    evidence_note: String(body.evidence_note || '').trim(),
    best_ask_type: String(body.best_ask_type || '').trim(),
    last_touch_at: String(body.last_touch_at || '').trim(),
    next_touch_at: String(body.next_touch_at || '').trim(),
    status: String(body.status || 'Ready').trim()
  };

  const idx = rows.findIndex((r) => String(r.path_id) === path_id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...item };
  else rows.push(item);
  await writeJson(file, rows);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'contact_path.upsert', entity_type: 'contact_path', entity_id: path_id, meta: { buyer_id } });
  res.redirect('/dashboard/buyer/' + encodeURIComponent(buyer_id));
});

app.post('/api/contact-paths/:id/delete', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const buyer_id = String(req.body.buyer_id || '').trim();
  const file = DASHBOARD_CONTACT_PATHS_FILE;
  const rows = await readJson(file, []);
  const next = rows.filter((r) => String(r.path_id) !== id);
  await writeJson(file, next);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'contact_path.delete', entity_type: 'contact_path', entity_id: id, meta: { buyer_id } });
  res.redirect('/dashboard/buyer/' + encodeURIComponent(buyer_id || ''));
});

app.post('/api/buyers/:id/upgrade-status', requireRole('architect','editor'), async (req, res) => {
  const buyerId = String(req.params.id || '').trim();
  const target = String(req.body.to || '').trim();
  if (!buyerId || !['Verified','Actioned'].includes(target)) return res.status(400).send('invalid request');

  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');
  const buyers = await readJson(buyersPath, []);
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const board = await readJson(BOARD_FILE, { version: 1, tasks: [] });
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);

  const b = buyers.find((x) => x.buyer_id === buyerId);
  if (!b) return res.status(404).send('buyer not found');

  const from = String(b.signal_status || 'Monitor');
  const buyerSignals = signals.filter((s) => Array.isArray(s.buyer_ids) && s.buyer_ids.includes(buyerId));
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recent = buyerSignals.filter((s) => {
    const t = Date.parse(String(s.observed_at || ''));
    return Number.isFinite(t) && (nowMs - t) <= (30 * dayMs);
  });
  const highCount = recent.filter((s) => String(s.confidence || '') === 'High').length;
  const mediumCount = recent.filter((s) => String(s.confidence || '') === 'Medium').length;

  const linkedTasks = (board.tasks || []).filter((t) => {
    const refs = (t.linked_refs || []).map((x) => String(x).toUpperCase());
    const tags = (t.tags || []).map((x) => String(x).toUpperCase());
    return refs.includes(buyerId.toUpperCase()) || tags.includes(`BUYER:${buyerId.toUpperCase()}`);
  });
  const inProgress = linkedTasks.filter((t) => ['Doing','Ready for Review'].includes(String(t.status || ''))).length;
  const linkedInitiatives = initiatives.filter((i) => Array.isArray(i.linked_buyers) && i.linked_buyers.includes(buyerId)).length;

  const reasons = [];
  if (from === 'Monitor' && target === 'Verified') {
    if (!String(b.transfer_hypothesis || '').trim()) reasons.push('missing_transfer_hypothesis');
    if (!(highCount >= 1 || mediumCount >= 2)) reasons.push('insufficient_recent_signal_evidence');
    if (!linkedTasks.length) reasons.push('no_linked_execution_task');
  } else if (from === 'Verified' && target === 'Actioned') {
    if (inProgress < 1) reasons.push('no_in_progress_execution_task');
    if (linkedInitiatives < 1) reasons.push('no_linked_initiative');
  } else {
    reasons.push(`invalid_transition_${from}_to_${target}`);
  }

  if (reasons.length) {
    return res.status(400).json({ error: 'upgrade_blocked', from, to: target, reasons });
  }

  b.signal_status = target;
  b.status_updated_at = nowIso();
  b.updated_at = nowIso();
  await writeJson(buyersPath, buyers);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'buyer.status.upgrade', entity_type: 'buyer', entity_id: buyerId, meta: { from, to: target } });
  return res.redirect('/dashboard/buyer/' + encodeURIComponent(buyerId));
});

app.post('/api/buyers', requireRole('architect','editor'), async (req, res) => {
  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');
  const buyers = await readJson(buyersPath, []);

  const buyer_id = String(req.body.buyer_id || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  if (!buyer_id || !name) return res.status(400).send('buyer_id and name are required');
  if (buyers.some((b) => String(b.buyer_id || '').toUpperCase() === buyer_id)) {
    return res.status(409).send('buyer_id already exists');
  }

  const parseList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const ts = nowIso();
  const buyer = {
    buyer_id,
    name,
    type: String(req.body.type || 'Sovereign').trim(),
    mandate_summary: String(req.body.mandate_summary || '').trim(),
    geo_focus: parseList(req.body.geo_focus),
    sector_focus: parseList(req.body.sector_focus),
    score: Number.parseFloat(String(req.body.score || '1.0')) || 1.0,
    pressure_factors: {
      capital_deployment: 'Medium',
      regional_alignment: 'Medium',
      timing_urgency: 'Medium'
    },
    initiatives: [],
    created_at: ts,
    updated_at: ts
  };

  buyers.push(buyer);
  await writeJson(buyersPath, buyers);
  await appendAuditEvent({ ts, actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'buyer.create', entity_type: 'buyer', entity_id: buyer_id, meta: { name } });
  res.redirect('/dashboard/buyers');
});

app.post('/api/initiatives/suggest', requireRole('architect','editor'), async (req, res) => {
  const buyer_id = String(req.body.buyer_id || '').trim().toUpperCase();
  const prompt = String(req.body.prompt || '').trim();
  const count = Math.min(10, Math.max(1, Number.parseInt(String(req.body.count || '5'), 10) || 5));

  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyer = buyers.find((b) => String(b.buyer_id || '').toUpperCase() === buyer_id);
  if (!buyer) return res.status(404).json({ error: 'buyer not found' });

  const existing = new Set(initiatives.map((i) => String(i.name || '').toLowerCase()));

  let uosText = '';
  for (const key of ['execution-engine','canon','revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (!fssync.existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files.filter((x)=>x.endsWith('.md')).slice(0, 8)) {
      uosText += '\n' + await fs.readFile(path.join(dir,f), 'utf8').catch(()=> '');
    }
  }
  const u = uosText.toLowerCase();
  const flags = {
    energy: /energy|power|grid/.test(u),
    water: /water|desal|utility/.test(u),
    digital: /digital|data|fiber|ai/.test(u),
    housing: /housing|mortgage/.test(u),
    governance: /governance|fid|pre-fid|risk/.test(u),
  };

  const sector = (buyer.sector_focus || [])[0] || 'Infrastructure';
  const geo = (buyer.geo_focus || [])[0] || 'Regional';
  const baseIdeas = [
    `${geo} ${sector} Pre-FID Acceleration Platform`,
    `${geo} Utility Reliability Corridor`,
    `${geo} Capital Governance & Transparency Layer`,
    `${geo} Cross-Border Infrastructure Activation Program`,
    `${geo} Risk-Compressed Project Sequencing Framework`
  ];
  if (flags.energy && !baseIdeas.some(x=>/Energy/.test(x))) baseIdeas.unshift(`${geo} Energy Security Corridor`);
  if (flags.water) baseIdeas.push(`${geo} Water Security Platform`);
  if (flags.digital) baseIdeas.push(`${geo} Digital Infrastructure Backbone`);

  const ideas = [];
  let n = 1;
  for (const name of baseIdeas) {
    if (ideas.length >= count) break;
    if (existing.has(name.toLowerCase())) continue;
    const summary = [
      `Structure initiative for ${buyer.name} mandate alignment.`,
      `Focus on ${sector.toLowerCase()} deployment and pre-FID clarity.`,
      flags.governance ? 'Embed governance gates and risk allocation early.' : 'Define decision gates and capital sequencing.'
    ].join(' ');
    ideas.push({
      initiative_id: `INIT-${String(Date.now()).slice(-4)}${String(n).padStart(2,'0')}`,
      name,
      status: 'Pre-FID',
      macro_gravity_summary: (prompt ? `${prompt}. ` : '') + summary,
      linked_buyers: [buyer.buyer_id],
      presentations: {
        utc_internal: `presentations/PLACEHOLDER/decks/utc-internal/index.html`,
        buyer_alignment: { [buyer.buyer_id]: `presentations/PLACEHOLDER/decks/buyer-alignment/${buyer.buyer_id}/index.html` }
      }
    });
    n += 1;
  }

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'workflow.run', entity_type: 'initiative_suggestion', entity_id: buyer_id, meta: { count: ideas.length } });
  res.json({ buyer_id, ideas });
});

function normalizeActorAlignment(initiative = {}) {
  const src = initiative?.actor_alignment?.layers && typeof initiative.actor_alignment.layers === 'object'
    ? initiative.actor_alignment.layers
    : (initiative?.actor_alignment_layers && typeof initiative.actor_alignment_layers === 'object' ? initiative.actor_alignment_layers : {});
  const out = {};
  for (const l of ['political','asset','development','capital','delivery']) out[l] = Array.isArray(src[l]) ? src[l] : [];
  return out;
}

function baseInfraRoleTemplate() {
  return [
    { role_id:'political_sponsor', role_label:'Political Sponsor', layer:'political', status:'missing', is_critical_role:true },
    { role_id:'regulator', role_label:'Regulator', layer:'political', status:'missing', is_critical_role:true },
    { role_id:'asset_owner', role_label:'Asset Owner', layer:'asset', status:'missing', is_critical_role:true },
    { role_id:'operator', role_label:'Operator', layer:'asset', status:'missing', is_critical_role:true },
    { role_id:'project_developer', role_label:'Project Developer', layer:'development', status:'missing', is_critical_role:true },
    { role_id:'technical_integrator', role_label:'Technical Integrator', layer:'development', status:'missing', is_critical_role:false },
    { role_id:'off_taker', role_label:'Off-Taker', layer:'capital', status:'missing', is_critical_role:true },
    { role_id:'anchor_equity', role_label:'Anchor Equity', layer:'capital', status:'missing', is_critical_role:true },
    { role_id:'development_finance_lender', role_label:'Development Finance Lender', layer:'capital', status:'missing', is_critical_role:true },
    { role_id:'commercial_lender', role_label:'Commercial Lender', layer:'capital', status:'missing', is_critical_role:false },
    { role_id:'epc_contractor', role_label:'EPC Contractor', layer:'delivery', status:'missing', is_critical_role:false },
    { role_id:'key_supplier', role_label:'Key Supplier / OEM', layer:'delivery', status:'missing', is_critical_role:false }
  ];
}

function infrastructureRoleTemplate(infraType = '') {
  const key = String(infraType || '').toLowerCase();
  if (key.includes('digital health')) {
    return [
      { role_id:'health_ministry', role_label:'Health Ministry / Public Health Sponsor', layer:'political', status:'missing', is_critical_role:true },
      { role_id:'health_regulator', role_label:'Health Regulator', layer:'political', status:'missing', is_critical_role:true },
      { role_id:'data_protection_authority', role_label:'Data Protection Authority', layer:'political', status:'missing', is_critical_role:true },
      { role_id:'hospital_network_owner', role_label:'Hospital Network Owner', layer:'asset', status:'missing', is_critical_role:true },
      { role_id:'clinical_platform_operator', role_label:'Clinical Platform Operator', layer:'asset', status:'missing', is_critical_role:true },
      { role_id:'platform_architect', role_label:'Platform Architect', layer:'development', status:'missing', is_critical_role:true },
      { role_id:'systems_integrator', role_label:'Systems Integrator', layer:'development', status:'missing', is_critical_role:false },
      { role_id:'care_delivery_anchor', role_label:'Care Delivery Anchor', layer:'capital', status:'missing', is_critical_role:true },
      { role_id:'development_finance_partner', role_label:'Development Finance Partner', layer:'capital', status:'missing', is_critical_role:true },
      { role_id:'cloud_infrastructure_provider', role_label:'Cloud Infrastructure Provider', layer:'delivery', status:'missing', is_critical_role:false },
      { role_id:'ehr_or_interoperability_vendor', role_label:'EHR / Interoperability Vendor', layer:'delivery', status:'missing', is_critical_role:false }
    ];
  }
  return baseInfraRoleTemplate();
}

function writeActorAlignment(initiative, layers) {
  initiative.actor_alignment = { layers };
  initiative.actor_alignment_layers = layers;
}

app.post('/api/initiatives', requireRole('architect','editor'), async (req, res) => {
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');
  const initiatives = await readJson(initiativesPath, []);
  const buyers = await readJson(buyersPath, []);

  const payload = req.body || {};
  let initiative_id = String(payload.initiative_id || '').trim();
  const name = String(payload.name || '').trim();
  const status = String(payload.status || 'Pre-FID').trim();
  const macro_gravity_summary = String(payload.macro_gravity_summary || '').trim();
  const linked_buyers = Array.isArray(payload.linked_buyers) ? payload.linked_buyers : [payload.linked_buyers].filter(Boolean);
  if (!name || linked_buyers.length === 0) return res.status(400).send('name and linked_buyers are required');

  if (!initiative_id) {
    const next = initiatives.reduce((m, x) => {
      const mm = String(x.initiative_id || '').match(/^INIT-(\d+)/i);
      return mm ? Math.max(m, Number(mm[1])) : m;
    }, 0) + 1;
    initiative_id = `INIT-${String(next).padStart(3, '0')}`;
  }

  if (initiatives.some((i) => String(i.initiative_id || '').toUpperCase() === initiative_id.toUpperCase())) {
    return res.status(409).send('initiative_id already exists');
  }

  for (const b of linked_buyers) {
    if (!buyers.some((x) => x.buyer_id === b)) return res.status(400).send(`unknown buyer: ${b}`);
  }

  const initiative = {
    initiative_id,
    name,
    status,
    macro_gravity_summary,
    linked_buyers,
    actor_alignment: { layers: { political: [], asset: [], development: [], capital: [], delivery: [] } },
    actor_alignment_layers: { political: [], asset: [], development: [], capital: [], delivery: [] },
    presentations: {
      utc_internal: `presentations/${initiative_id}/decks/utc-internal/index.html`,
      buyer_alignment: Object.fromEntries(linked_buyers.map((b) => [b, `presentations/${initiative_id}/decks/buyer-alignment/${b}/index.html`]))
    }
  };

  initiatives.push(initiative);
  await writeJson(initiativesPath, initiatives);

  for (const b of buyers) {
    if (!Array.isArray(b.initiatives)) b.initiatives = [];
    if (linked_buyers.includes(b.buyer_id) && !b.initiatives.includes(initiative_id)) b.initiatives.push(initiative_id);
  }
  await writeJson(buyersPath, buyers);

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'task.create', entity_type: 'initiative', entity_id: initiative_id, meta: { name, linked_buyers } });
  res.json(initiative);
});

app.post('/api/initiatives/:id/gate', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const gate = String(req.body.gate_stage || '').trim();
  const allowed = new Set(['Gate 0','Gate 1','Gate 2','Gate 3','Gate 4','Gate 5','Gate 6','Gate 7']);
  if (!allowed.has(gate)) return res.status(400).send('invalid gate_stage');

  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const i = initiatives.find((x) => x.initiative_id === id);
  if (!i) return res.status(404).send('initiative not found');

  i.gate_stage = gate;
  i.gate_updated_at = nowIso();
  await writeJson(initiativesPath, initiatives);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'initiative.gate.update', entity_type: 'initiative', entity_id: id, meta: { gate_stage: gate } });
  res.redirect('/dashboard/initiatives');
});

app.post('/api/initiatives/:id/update', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).send('initiative id required');

  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');

  const name = String(req.body.name || '').trim();
  const status = String(req.body.status || '').trim();
  const macro = String(req.body.macro_gravity_summary || '').trim();
  const category = String(req.body.infrastructure_category || '').trim();
  const layersRaw = String(req.body.actor_alignment_layers_json || '').trim();

  if (name) initiative.name = name;
  if (status) initiative.status = status;
  if (macro || macro === '') initiative.macro_gravity_summary = macro;
  if (category || category === '') initiative.infrastructure_category = category;
  if (layersRaw) {
    try {
      const parsed = JSON.parse(layersRaw);
      if (!parsed || typeof parsed !== 'object') return res.status(400).send('invalid actor_alignment_layers_json');
      const next = {};
      for (const l of ['political','asset','development','capital','delivery']) {
        next[l] = Array.isArray(parsed[l]) ? parsed[l] : [];
      }
      writeActorAlignment(initiative, next);
    } catch {
      return res.status(400).send('invalid actor_alignment_layers_json');
    }
  }
  initiative.updated_at = nowIso();

  await writeJson(initiativesPath, initiatives);
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'initiative.update',
    entity_type: 'initiative',
    entity_id: id,
    meta: { fields: ['name','status','macro_gravity_summary','infrastructure_category','actor_alignment_layers'] }
  });

  res.redirect(`/dashboard/initiative/${encodeURIComponent(id)}?updated=1`);
});

app.post('/api/initiatives/:id/actor-roles/add', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');

  const layer = String(req.body.layer || '').trim();
  if (!['political','asset','development','capital','delivery'].includes(layer)) return res.status(400).send('invalid layer');

  const role = {
    role_id: String(req.body.role_id || `role_${Date.now()}`),
    role_label: String(req.body.role_label || '').trim() || 'Unnamed role',
    layer,
    status: ['missing','identified','validated','engaged','committed'].includes(String(req.body.status || 'missing')) ? String(req.body.status) : 'missing',
    notes: String(req.body.notes || '').trim(),
    mapped_entity_type: req.body.mapped_entity_type ? String(req.body.mapped_entity_type) : null,
    mapped_entity_ref: req.body.mapped_entity_ref ? String(req.body.mapped_entity_ref) : null,
    is_critical_role: String(req.body.is_critical_role || '') === 'on' || String(req.body.is_critical_role || '') === 'true',
    owner: req.body.owner ? String(req.body.owner) : '',
    due: req.body.due ? String(req.body.due) : ''
  };

  const layers = normalizeActorAlignment(initiative);
  layers[layer].push(role);
  writeActorAlignment(initiative, layers);
  initiative.updated_at = nowIso();
  await writeJson(initiativesPath, initiatives);
  return res.redirect(`/dashboard/initiative/${encodeURIComponent(id)}?edit=1`);
});

app.post('/api/initiatives/:id/actor-roles/:roleId/delete', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const roleId = String(req.params.roleId || '').trim();
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');
  const layers = normalizeActorAlignment(initiative);
  for (const l of ['political','asset','development','capital','delivery']) {
    layers[l] = layers[l].filter((r) => String(r.role_id || '') !== roleId);
  }
  writeActorAlignment(initiative, layers);
  initiative.updated_at = nowIso();
  await writeJson(initiativesPath, initiatives);
  return res.redirect(`/dashboard/initiative/${encodeURIComponent(id)}?edit=1`);
});

app.post('/api/initiatives/:id/actor-roles/update', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const roleId = String(req.body.role_id || '').trim();
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');
  if (!roleId) return res.status(400).send('role_id required');

  const layers = normalizeActorAlignment(initiative);
  let hit = null;
  for (const l of ['political','asset','development','capital','delivery']) {
    const idx = layers[l].findIndex((r) => String(r.role_id || '') === roleId);
    if (idx >= 0) { hit = { l, idx }; break; }
  }
  if (!hit) return res.status(404).send('role not found');

  const row = layers[hit.l][hit.idx];
  const allowedStatus = ['missing','identified','validated','engaged','committed'];
  if (req.body.status) row.status = allowedStatus.includes(String(req.body.status)) ? String(req.body.status) : row.status;
  if (req.body.role_label) row.role_label = String(req.body.role_label).trim();
  row.notes = String(req.body.notes || '').trim();
  row.owner = String(req.body.owner || '').trim();
  row.due = String(req.body.due || '').trim();
  row.mapped_entity_type = req.body.mapped_entity_type ? String(req.body.mapped_entity_type) : null;
  row.mapped_entity_ref = req.body.mapped_entity_ref ? String(req.body.mapped_entity_ref) : null;
  row.is_critical_role = String(req.body.is_critical_role || '') === 'on' || String(req.body.is_critical_role || '') === 'true';

  writeActorAlignment(initiative, layers);
  initiative.updated_at = nowIso();
  await writeJson(initiativesPath, initiatives);
  return res.redirect(`/dashboard/initiative/${encodeURIComponent(id)}?edit=1`);
});

app.post('/api/initiatives/:id/actor-roles/apply-template', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const overwrite = String(req.body.overwrite || '') === 'true';
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');

  const layers = normalizeActorAlignment(initiative);
  const template = infrastructureRoleTemplate(initiative.infrastructure_category || '');
  for (const r of template) {
    const exists = (layers[r.layer] || []).some((x) => String(x.role_id || '') === String(r.role_id));
    if (overwrite || !exists) {
      if (overwrite) layers[r.layer] = layers[r.layer].filter((x) => String(x.role_id || '') !== String(r.role_id));
      layers[r.layer].push({ ...r, notes: '', mapped_entity_type: null, mapped_entity_ref: null });
    }
  }
  writeActorAlignment(initiative, layers);
  initiative.updated_at = nowIso();
  await writeJson(initiativesPath, initiatives);
  return res.redirect(`/dashboard/initiative/${encodeURIComponent(id)}?edit=1`);
});

app.post('/api/initiatives/:id/delete', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).send('initiative id required');

  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');

  const initiatives = await readJson(initiativesPath, []);
  const initiative = initiatives.find((x) => String(x.initiative_id || '') === id);
  if (!initiative) return res.status(404).send('initiative not found');

  const beacons = await readBeaconQueue();
  const linkedBeacons = (beacons.beacons || []).filter((b) => String(b.initiative_id || '') === id);

  const deckStore = await readDeckSpecStore();
  const linkedDecks = (deckStore.decks || []).filter((d) => String(d.initiativeId || '') === id);

  if (linkedBeacons.length > 0 || linkedDecks.length > 0) {
    return res.status(409).send(`cannot delete initiative with dependencies (beacons=${linkedBeacons.length}, decks=${linkedDecks.length})`);
  }

  const kept = initiatives.filter((x) => String(x.initiative_id || '') !== id);
  await writeJson(initiativesPath, kept);

  const buyers = await readJson(buyersPath, []);
  for (const b of buyers) {
    if (!Array.isArray(b.initiatives)) continue;
    b.initiatives = b.initiatives.filter((iid) => String(iid || '') !== id);
  }
  await writeJson(buyersPath, buyers);

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'task.delete',
    entity_type: 'initiative',
    entity_id: id,
    meta: { linked_buyers: initiative.linked_buyers || [] }
  });

  res.redirect('/dashboard/initiatives');
});

app.post('/api/beacons', requireRole('architect','editor'), async (req, res) => {
  const q = await readBeaconQueue();
  const title = String(req.body.title || '').trim();
  const draft_text = String(req.body.draft_text || '').trim();
  const status = String(req.body.status || 'draft').trim();
  const signal_id = String(req.body.signal_id || '').trim();
  const initiative_id = String(req.body.initiative_id || '').trim();
  const mandate_implication = String(req.body.mandate_implication || '').trim();

  if (!title || !draft_text) return res.status(400).json({ error: 'title and draft_text are required' });
  if (!beaconStatusAllowed(status)) return res.status(400).json({ error: 'invalid status' });
  if (!signal_id || !initiative_id || !mandate_implication) {
    return res.status(400).json({ error: 'signal_id, initiative_id, and mandate_implication are required' });
  }

  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const hasSignal = signals.some((s) => String(s.signal_id || '') === signal_id);
  const hasInitiative = initiatives.some((i) => String(i.initiative_id || '') === initiative_id);
  if (!hasSignal) return res.status(400).json({ error: 'invalid signal_id' });
  if (!hasInitiative) return res.status(400).json({ error: 'invalid initiative_id' });

  const beacon = {
    beacon_id: `BEACON-${Date.now()}`,
    title,
    status,
    signal_id,
    initiative_id,
    mandate_implication,
    draft_text,
    lint_status: 'UNKNOWN',
    lint_violations: [],
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: getUserLabel(req),
    approved_by: null,
    published_at: null
  };

  q.beacons.push(beacon);
  await writeBeaconQueue(q);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'beacon.create', entity_type: 'beacon', entity_id: beacon.beacon_id, meta: { status: beacon.status } });
  if (String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
    return res.redirect('/dashboard/beacons');
  }
  return res.json({ ok: true, beacon });
});

function autoDraftBeaconFromSignal(signal) {
  const title = String(signal?.title || 'Structural Commitment Friction');
  const summary = String(signal?.summary || '').trim();
  const friction = summary || 'A platform-level bottleneck is preventing safe commitment at pre-FID.';
  const boundary = 'If FID boundary and downside absorption are undefined, governance jurisdiction cannot bind signatures safely.';
  const implication = 'Capital stack sequencing must be defined before commitment can harden.';
  const draft = `${friction} ${boundary} ${implication}`.trim();
  return { title: `Beacon: ${title}`, draft_text: draft };
}

app.post('/api/beacons/generate-from-signal', requireRole('architect','editor'), async (req, res) => {
  const signal_id = String(req.body.signal_id || '').trim();
  const initiative_id = String(req.body.initiative_id || '').trim();
  const mandate_implication = String(req.body.mandate_implication || '').trim();
  if (!signal_id || !initiative_id || !mandate_implication) {
    return res.status(400).json({ error: 'signal_id, initiative_id, mandate_implication are required' });
  }

  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const signal = signals.find((s) => String(s.signal_id || '') === signal_id);
  if (!signal) return res.status(400).json({ error: 'invalid signal_id' });

  const q = await readBeaconQueue();
  const auto = autoDraftBeaconFromSignal(signal);
  const beacon = {
    beacon_id: `BEACON-${Date.now()}`,
    title: auto.title,
    status: 'draft',
    signal_id,
    initiative_id,
    mandate_implication,
    draft_text: auto.draft_text,
    lint_status: 'UNKNOWN',
    lint_violations: [],
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: getUserLabel(req),
    approved_by: null,
    published_at: null
  };
  q.beacons.push(beacon);
  await writeBeaconQueue(q);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'beacon.generate', entity_type: 'beacon', entity_id: beacon.beacon_id, meta: { signal_id, initiative_id } });
  return res.redirect('/dashboard/beacons');
});

app.post('/api/beacons/:id/transition', requireRole('architect','editor'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const toStatus = String(req.body.to_status || '').trim();
  if (!id || !beaconStatusAllowed(toStatus)) return res.status(400).json({ error: 'invalid request' });

  const role = effectiveRole(req) || 'editor';
  const architectOnly = new Set(['approved', 'published']);
  if (architectOnly.has(toStatus) && role !== 'architect') {
    return res.status(403).json({ error: 'architect_required', to_status: toStatus });
  }

  const q = await readBeaconQueue();
  const b = q.beacons.find((x) => String(x.beacon_id || '') === id);
  if (!b) return res.status(404).json({ error: 'beacon not found' });

  const from = String(b.status || 'draft');
  if (!canTransitionBeaconStatus(from, toStatus)) {
    return res.status(400).json({ error: 'invalid transition', from, to: toStatus });
  }

  b.status = toStatus;
  b.updated_at = nowIso();
  if (toStatus === 'approved') b.approved_by = getUserLabel(req);
  if (toStatus === 'published') {
    b.published_at = nowIso();
    if (!b.approved_by) b.approved_by = getUserLabel(req);
  }

  await writeBeaconQueue(q);
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role,
    event_type: 'beacon.transition',
    entity_type: 'beacon',
    entity_id: id,
    meta: { from, to: toStatus, architect_required: architectOnly.has(toStatus) }
  });
  if (String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
    return res.redirect('/dashboard/beacons');
  }
  return res.json({ ok: true, beacon: b });
});

app.post('/api/signals', requireRole('architect','editor'), async (req, res) => {
  const classes = new Set(['Capital Reality','FID Definability','Structural Ambiguity','Platform Pressure','Sponsor Altitude','Ecosystem / Theater']);
  const title = String(req.body.title || '').trim();
  const signalClass = String(req.body.signal_class || '').trim();
  if (!title || !classes.has(signalClass)) {
    return res.status(400).send('title and valid signal_class are required');
  }

  const status = String(req.body.status || 'Monitor').trim();
  const confidence = String(req.body.confidence || 'Medium').trim();
  const buyer_ids = String(req.body.buyer_ids || '').split(',').map((x) => x.trim()).filter(Boolean);
  const summary = String(req.body.summary || '').trim();
  const signals = await readJson(DASHBOARD_SIGNALS_FILE, []);
  const signal_id = `SIG-${Date.now()}`;
  signals.push({
    signal_id,
    title,
    signal_class: signalClass,
    status,
    confidence,
    observed_at: nowIso(),
    buyer_ids,
    initiative_ids: [],
    summary,
    verification_note: '',
    sources: []
  });
  await writeJson(DASHBOARD_SIGNALS_FILE, signals);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'signal.create', entity_type: 'signal', entity_id: signal_id, meta: { signal_class: signalClass } });
  res.redirect('/dashboard/signals');
});

app.get('/api/presentation-studio/decks', requireRole('architect','editor','observer'), async (req, res) => {
  const store = await readDeckSpecStore();
  const sel = resolveDeckSelectors(req.query || {});

  const filtered = store.decks.filter((d) => {
    if (sel.initiativeId && String(d.initiativeId) !== sel.initiativeId) return false;
    if (sel.deckType && String(d.deckType) !== sel.deckType) return false;
    if (sel.buyerId !== null && String(d.buyerId || '') !== String(sel.buyerId || '')) return false;
    return true;
  });

  return res.json({
    ok: true,
    count: filtered.length,
    selectors: sel,
    decks: filtered,
  });
});

app.post('/api/presentation-studio/decks', requireRole('architect','editor'), async (req, res) => {
  const sel = resolveDeckSelectors(req.body || {});
  if (!sel.initiativeId) return res.status(400).json({ error: 'initiativeId required' });

  const globalTemplateTheme = String(req.body.globalTemplateTheme || req.body.templateTheme || 'sovereign-memo').trim() || 'sovereign-memo';
  const styleMode = String(req.body.styleMode || 'professional').trim();
  const copyProvider = String(req.body.copyProvider || 'local').trim() || 'local';
  const imageProvider = String(req.body.imageProvider || 'placeholder').trim() || 'placeholder';

  const store = await readDeckSpecStore();
  const existing = store.decks.find((d) =>
    String(d.initiativeId) === sel.initiativeId &&
    String(d.deckType) === sel.deckType &&
    String(d.buyerId || '') === String(sel.buyerId || '')
  );
  if (existing) return res.status(409).json({ error: 'deck already exists for selectors', selectors: sel, deck: existing });

  const deck = defaultDeckSpecV2({
    initiativeId: sel.initiativeId,
    buyerId: sel.buyerId,
    deckType: sel.deckType,
    globalTemplateTheme,
    styleMode,
    copyProvider,
    imageProvider,
  });

  store.decks.push(deck);
  await writeDeckSpecStore(store);
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'deckspec.create',
    entity_type: 'deck',
    entity_id: deck.deckId,
    meta: { selectors: sel }
  });

  return res.status(201).json({ ok: true, deck });
});

app.patch('/api/presentation-studio/decks/:deckId', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'deckId required' });

  const store = await readDeckSpecStore();
  const deck = store.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const before = { ...deck };
  if (typeof req.body.globalTemplateTheme === 'string') deck.globalTemplateTheme = String(req.body.globalTemplateTheme).trim() || deck.globalTemplateTheme;
  if (typeof req.body.styleMode === 'string') {
    const mode = String(req.body.styleMode).trim();
    if (!['professional', 'creative'].includes(mode)) return res.status(400).json({ error: 'invalid styleMode' });
    deck.styleMode = mode;
  }
  if (typeof req.body.copyProvider === 'string') deck.copyProvider = String(req.body.copyProvider).trim() || deck.copyProvider;
  if (typeof req.body.imageProvider === 'string') deck.imageProvider = String(req.body.imageProvider).trim() || deck.imageProvider;
  if (typeof req.body.currentSavePointId === 'string' || req.body.currentSavePointId === null) {
    deck.currentSavePointId = req.body.currentSavePointId ? String(req.body.currentSavePointId).trim() : null;
  }

  deck.updatedAt = nowIso();
  await writeDeckSpecStore(store);
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'deckspec.update',
    entity_type: 'deck',
    entity_id: deck.deckId,
    meta: {
      before: {
        globalTemplateTheme: before.globalTemplateTheme,
        styleMode: before.styleMode,
        copyProvider: before.copyProvider,
        imageProvider: before.imageProvider,
        currentSavePointId: before.currentSavePointId,
      },
      after: {
        globalTemplateTheme: deck.globalTemplateTheme,
        styleMode: deck.styleMode,
        copyProvider: deck.copyProvider,
        imageProvider: deck.imageProvider,
        currentSavePointId: deck.currentSavePointId,
      }
    }
  });

  return res.json({ ok: true, deck });
});

app.get('/api/presentation-studio/decks/:deckId/savepoints', requireRole('architect','editor','observer'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'deckId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const savepointStore = await readSavepointStore();
  const savepoints = Array.isArray(savepointStore.savepointsByDeck?.[deckId]) ? savepointStore.savepointsByDeck[deckId] : [];
  const ordered = [...savepoints].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return res.json({ ok: true, deckId, count: ordered.length, savepoints: ordered });
});

app.post('/api/presentation-studio/decks/:deckId/savepoints', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'deckId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const slides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];

  const savepointStore = await readSavepointStore();
  savepointStore.savepointsByDeck = savepointStore.savepointsByDeck || {};
  const existing = Array.isArray(savepointStore.savepointsByDeck[deckId]) ? savepointStore.savepointsByDeck[deckId] : [];

  const createdAt = nowIso();
  const savePointId = `sp-${Date.now()}`;
  const savepoint = {
    savePointId,
    deckId,
    label: String(req.body.label || '').trim() || null,
    note: String(req.body.note || '').trim() || null,
    snapshot: {
      deck: JSON.parse(JSON.stringify(deck)),
      slides: JSON.parse(JSON.stringify(slides)),
    },
    createdAt,
    createdBy: getUserLabel(req),
  };

  existing.push(savepoint);
  savepointStore.savepointsByDeck[deckId] = existing;
  deck.currentSavePointId = savePointId;
  deck.updatedAt = createdAt;

  await writeSavepointStore(savepointStore);
  await writeDeckSpecStore(deckStore);

  await appendAuditEvent({
    ts: createdAt,
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'presentation.savepoint.create',
    entity_type: 'presentation_savepoint',
    entity_id: `${deckId}:${savePointId}`,
    meta: { deckId, savePointId, slideCount: slides.length }
  });

  return res.status(201).json({ ok: true, deckId, savepoint });
});

app.post('/api/presentation-studio/decks/:deckId/savepoints/:savePointId/restore', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  const savePointId = String(req.params.savePointId || '').trim();
  if (!deckId || !savePointId) return res.status(400).json({ error: 'deckId and savePointId required' });

  const savepointStore = await readSavepointStore();
  const savepoints = Array.isArray(savepointStore.savepointsByDeck?.[deckId]) ? savepointStore.savepointsByDeck[deckId] : [];
  const savepoint = savepoints.find((s) => String(s.savePointId) === savePointId);
  if (!savepoint) return res.status(404).json({ error: 'savepoint not found' });

  const deckStore = await readDeckSpecStore();
  const deckIdx = deckStore.decks.findIndex((d) => String(d.deckId) === deckId);
  if (deckIdx < 0) return res.status(404).json({ error: 'deck not found' });

  const snapshotDeck = savepoint.snapshot?.deck;
  const snapshotSlides = Array.isArray(savepoint.snapshot?.slides) ? savepoint.snapshot.slides : [];
  if (!snapshotDeck || typeof snapshotDeck !== 'object') return res.status(409).json({ error: 'savepoint snapshot invalid' });

  const restoredDeck = {
    ...JSON.parse(JSON.stringify(snapshotDeck)),
    deckId,
    currentSavePointId: savePointId,
    updatedAt: nowIso(),
  };

  const slideStore = await readSlideSpecStore();
  slideStore.slidesByDeck = slideStore.slidesByDeck || {};
  slideStore.slidesByDeck[deckId] = JSON.parse(JSON.stringify(snapshotSlides));
  deckStore.decks[deckIdx] = restoredDeck;

  await writeSlideSpecStore(slideStore);
  await writeDeckSpecStore(deckStore);

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'presentation.savepoint.restore',
    entity_type: 'presentation_savepoint',
    entity_id: `${deckId}:${savePointId}`,
    meta: { deckId, savePointId, slideCount: snapshotSlides.length }
  });

  return res.json({ ok: true, deckId, savePointId, deck: restoredDeck, restoredSlides: snapshotSlides.length });
});

app.get('/api/presentation-studio/decks/resolve', requireRole('architect','editor','observer'), async (req, res) => {
  const createIfMissing = String(req.query.createIfMissing || 'true') !== 'false';
  const resolved = await getOrCreateDeckSpecBySelectors(req.query, { createIfMissing });
  if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });
  if (!resolved.deck) return res.status(404).json({ error: 'deck not found', selectors: resolved.selectors });
  return res.json({ ok: true, selectors: resolved.selectors, deck: resolved.deck });
});

app.get('/api/presentation-studio/templates', requireRole('architect','editor','observer'), async (_req, res) => {
  const templates = await readTemplateLibraryIndex();
  return res.json({ ok: true, count: templates.length, templates });
});

app.get('/api/presentation-studio/templates/:templateId', requireRole('architect','editor','observer'), async (req, res) => {
  const templateId = String(req.params.templateId || '').trim();
  if (!templateId) return res.status(400).json({ error: 'templateId required' });

  const template = await readTemplateManifestById(templateId);
  if (!template) return res.status(404).json({ error: 'template not found' });

  return res.json({ ok: true, template });
});

app.get('/api/presentation-studio/layout-map', requireRole('architect','editor','observer'), async (req, res) => {
  const layout = String(req.query.layout || '').trim();
  const resolved = resolveTemplateIdFromLegacyLayout(layout);
  return res.json({
    ok: true,
    layout,
    templateId: resolved.templateId,
    fallbackApplied: resolved.fallbackApplied,
    normalizedLayout: resolved.normalizedLayout,
    note: resolved.note || null,
    fallbackTemplateId: LEGACY_LAYOUT_FALLBACK_TEMPLATE_ID,
    mapping: LEGACY_LAYOUT_TO_TEMPLATE_ID,
    slotSchema: SLIDE_SPEC_V2_SLOT_SCHEMA,
  });
});

app.get('/api/presentation-studio/slots/contract', requireRole('architect','editor','observer'), async (req, res) => {
  const title = String(req.query.title || '');
  const bullets = String(req.query.bullets || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const imagePrompt = String(req.query.imagePrompt || '');
  return res.json({
    ok: true,
    slotSchema: SLIDE_SPEC_V2_SLOT_SCHEMA,
    exampleSlots: legacyFieldsToSlotsContract({ title, bullets, imagePrompt }),
  });
});

app.post('/api/presentation-studio/slides/normalize-layout', requireRole('architect','editor'), async (req, res) => {
  const deck = String(req.body.deck || '').trim();
  if (!deck) return res.status(400).json({ error: 'deck required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });

  let normalized = 0;
  let slotsMapped = 0;
  for (const s of spec.slides) {
    const resolved = resolveTemplateIdFromLegacyLayout(s.layout);
    const before = s.template_id || null;
    s.template_id = resolved.templateId;
    if (resolved.fallbackApplied) {
      s.normalization = {
        ...(s.normalization || {}),
        layoutFallbackApplied: true,
        legacyLayout: s.layout || null,
        note: resolved.note,
        normalizedAt: nowIso(),
      };
    }

    // TASK-0052: persist slots normalization
    const nextSlots = legacyFieldsToSlotsContract({
      title: s.copy?.title || s.title || '',
      bullets: s.copy?.bullets || s.bullets || [],
      imagePrompt: s.images?.[0]?.prompt || ''
    });
    if (JSON.stringify(s.slots || {}) !== JSON.stringify(nextSlots)) slotsMapped += 1;
    s.slots = nextSlots;
    s.slots_schema_version = 2;

    if (before !== s.template_id) normalized += 1;
  }

  await writeJson(deckPath, spec);
  return res.json({ ok: true, deck, normalized, slotsMapped, slideCount: spec.slides.length });
});

app.get('/api/presentation-studio/slides/slots-preview', requireRole('architect','editor','observer'), async (req, res) => {
  const deck = String(req.query.deck || '').trim();
  const slide_id = String(req.query.slide_id || '').trim();
  if (!deck || !slide_id) return res.status(400).json({ error: 'deck and slide_id required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });
  const s = spec.slides.find((x) => String(x.slide_id) === slide_id);
  if (!s) return res.status(404).json({ error: 'slide not found' });

  const computed = legacyFieldsToSlotsContract({
    title: s.copy?.title || s.title || '',
    bullets: s.copy?.bullets || s.bullets || [],
    imagePrompt: s.images?.[0]?.prompt || ''
  });

  return res.json({
    ok: true,
    deck,
    slide_id,
    persistedSlots: s.slots || null,
    computedSlots: computed,
    slotsSchemaVersion: s.slots_schema_version || null,
    template_id: s.template_id || null
  });
});

app.get('/api/presentation-studio/decks/:deckId/slides', requireRole('architect','editor','observer'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'deckId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const deckSlides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];
  const order = Array.isArray(deck.slideOrder) ? deck.slideOrder : [];
  const orderIndex = new Map(order.map((id, idx) => [String(id), idx]));

  const slides = [...deckSlides].sort((a, b) => {
    const ai = orderIndex.has(String(a.slideId)) ? orderIndex.get(String(a.slideId)) : Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.has(String(b.slideId)) ? orderIndex.get(String(b.slideId)) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });

  return res.json({ ok: true, deckId, count: slides.length, slides });
});

app.get('/api/presentation-studio/decks/:deckId/slides/:slideId', requireRole('architect','editor','observer'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  const slideId = String(req.params.slideId || '').trim();
  if (!deckId || !slideId) return res.status(400).json({ error: 'deckId and slideId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const deckSlides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];
  const slide = deckSlides.find((s) => String(s.slideId) === slideId);
  if (!slide) return res.status(404).json({ error: 'slide not found' });

  return res.json({ ok: true, deckId, slide });
});

app.post('/api/presentation-studio/decks/:deckId/slides', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'deckId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const deckSlides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];
  const existingIds = new Set(deckSlides.map((s) => String(s.slideId)));

  const providedSlideId = String(req.body.slideId || '').trim();
  let slideId = providedSlideId;
  if (slideId) {
    if (existingIds.has(slideId)) return res.status(409).json({ error: 'slide already exists' });
  } else {
    let n = deckSlides.length + 1;
    while (existingIds.has(`slide-${String(n).padStart(3, '0')}`)) n += 1;
    slideId = `slide-${String(n).padStart(3, '0')}`;
  }

  const layout = String(req.body.layout || 'section').trim();
  const templateResolution = resolveTemplateIdFromLegacyLayout(layout);
  const title = String(req.body.title || '').trim();
  const bullets = Array.isArray(req.body.bullets) ? req.body.bullets.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const imagePrompt = String(req.body.imagePrompt || req.body.image_prompt || '').trim();
  const now = nowIso();

  const slide = {
    slideId,
    templateId: String(req.body.templateId || req.body.template_id || templateResolution.templateId),
    slots: req.body.slots && typeof req.body.slots === 'object' && !Array.isArray(req.body.slots)
      ? req.body.slots
      : legacyFieldsToSlotsContract({ title, bullets, imagePrompt }),
    constraints: req.body.constraints && typeof req.body.constraints === 'object' && !Array.isArray(req.body.constraints)
      ? req.body.constraints
      : {},
    imagePlans: Array.isArray(req.body.imagePlans) ? req.body.imagePlans : [],
    qa: req.body.qa && typeof req.body.qa === 'object' && !Array.isArray(req.body.qa)
      ? req.body.qa
      : { status: 'pending', score: null, flags: [] },
    pipeline: req.body.pipeline && typeof req.body.pipeline === 'object' && !Array.isArray(req.body.pipeline)
      ? req.body.pipeline
      : { status: 'idle', stage: null },
    legacy: {
      layout,
      title,
      bullets,
      imagePrompt,
    },
    createdAt: now,
    updatedAt: now,
  };

  const insertAfterSlideId = String(req.body.insertAfterSlideId || '').trim();
  const position = Number.isFinite(Number(req.body.position)) ? Number(req.body.position) : null;
  const nextSlides = [...deckSlides];

  if (insertAfterSlideId) {
    const idx = nextSlides.findIndex((s) => String(s.slideId) === insertAfterSlideId);
    if (idx < 0) return res.status(400).json({ error: 'insertAfterSlideId not found' });
    nextSlides.splice(idx + 1, 0, slide);
  } else if (position != null) {
    const clamped = Math.max(0, Math.min(nextSlides.length, Math.trunc(position)));
    nextSlides.splice(clamped, 0, slide);
  } else {
    nextSlides.push(slide);
  }

  slideStore.slidesByDeck = slideStore.slidesByDeck || {};
  slideStore.slidesByDeck[deckId] = nextSlides;

  deck.slideOrder = nextSlides.map((s) => String(s.slideId));
  deck.updatedAt = now;

  await writeSlideSpecStore(slideStore);
  await writeDeckSpecStore(deckStore);

  await appendAuditEvent({
    ts: now,
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'presentation.slide.create',
    entity_type: 'presentation_slide',
    entity_id: `${deckId}:${slideId}`,
    meta: { deckId, slideId }
  });

  return res.status(201).json({ ok: true, deckId, slide, count: nextSlides.length });
});

app.patch('/api/presentation-studio/decks/:deckId/slides/:slideId', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  const slideId = String(req.params.slideId || '').trim();
  if (!deckId || !slideId) return res.status(400).json({ error: 'deckId and slideId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const deckSlides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];
  const idx = deckSlides.findIndex((s) => String(s.slideId) === slideId);
  if (idx < 0) return res.status(404).json({ error: 'slide not found' });

  const current = deckSlides[idx];
  const next = { ...current };

  if (req.body.templateId != null || req.body.template_id != null) next.templateId = String(req.body.templateId || req.body.template_id || '').trim();
  if (req.body.slots && typeof req.body.slots === 'object' && !Array.isArray(req.body.slots)) next.slots = req.body.slots;
  if (req.body.constraints && typeof req.body.constraints === 'object' && !Array.isArray(req.body.constraints)) next.constraints = req.body.constraints;
  if (Array.isArray(req.body.imagePlans)) next.imagePlans = req.body.imagePlans;
  if (req.body.qa && typeof req.body.qa === 'object' && !Array.isArray(req.body.qa)) next.qa = req.body.qa;
  if (req.body.pipeline && typeof req.body.pipeline === 'object' && !Array.isArray(req.body.pipeline)) next.pipeline = req.body.pipeline;

  const hasLegacyPatch = req.body.layout != null || req.body.title != null || req.body.bullets != null || req.body.imagePrompt != null || req.body.image_prompt != null;
  if (hasLegacyPatch) {
    const prevLegacy = current.legacy && typeof current.legacy === 'object' ? current.legacy : {};
    const layout = req.body.layout != null ? String(req.body.layout || '').trim() : String(prevLegacy.layout || 'section');
    const title = req.body.title != null ? String(req.body.title || '').trim() : String(prevLegacy.title || '');
    const bullets = req.body.bullets != null
      ? (Array.isArray(req.body.bullets) ? req.body.bullets.map((x) => String(x || '').trim()).filter(Boolean) : [])
      : (Array.isArray(prevLegacy.bullets) ? prevLegacy.bullets : []);
    const imagePrompt = req.body.imagePrompt != null || req.body.image_prompt != null
      ? String(req.body.imagePrompt || req.body.image_prompt || '').trim()
      : String(prevLegacy.imagePrompt || '');

    next.legacy = { layout, title, bullets, imagePrompt };

    if (req.body.slots == null) {
      next.slots = legacyFieldsToSlotsContract({ title, bullets, imagePrompt });
    }

    if (req.body.templateId == null && req.body.template_id == null) {
      next.templateId = resolveTemplateIdFromLegacyLayout(layout).templateId;
    }
  }

  next.updatedAt = nowIso();
  deckSlides[idx] = next;
  slideStore.slidesByDeck[deckId] = deckSlides;
  deck.updatedAt = next.updatedAt;

  await writeSlideSpecStore(slideStore);
  await writeDeckSpecStore(deckStore);

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'presentation.slide.update',
    entity_type: 'presentation_slide',
    entity_id: `${deckId}:${slideId}`,
    meta: { deckId, slideId }
  });

  return res.json({ ok: true, deckId, slide: next });
});

app.delete('/api/presentation-studio/decks/:deckId/slides/:slideId', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  const slideId = String(req.params.slideId || '').trim();
  if (!deckId || !slideId) return res.status(400).json({ error: 'deckId and slideId required' });

  const deckStore = await readDeckSpecStore();
  const deck = deckStore.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck not found' });

  const slideStore = await readSlideSpecStore();
  const deckSlides = Array.isArray(slideStore.slidesByDeck?.[deckId]) ? slideStore.slidesByDeck[deckId] : [];
  const nextSlides = deckSlides.filter((s) => String(s.slideId) !== slideId);
  if (nextSlides.length === deckSlides.length) return res.status(404).json({ error: 'slide not found' });

  slideStore.slidesByDeck[deckId] = nextSlides;
  deck.slideOrder = nextSlides.map((s) => String(s.slideId));
  deck.updatedAt = nowIso();

  await writeSlideSpecStore(slideStore);
  await writeDeckSpecStore(deckStore);

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'presentation.slide.delete',
    entity_type: 'presentation_slide',
    entity_id: `${deckId}:${slideId}`,
    meta: { deckId, slideId, remaining: nextSlides.length }
  });

  return res.json({ ok: true, deckId, deleted: slideId, count: nextSlides.length });
});

app.post('/api/presentation-studio/decks/:deckId/pipeline/run', requireRole('architect','editor'), async (req, res) => {
  const deckId = String(req.params.deckId || '').trim();
  if (!deckId) return res.status(400).json({ error: 'invalid_payload' });

  const store = await readDeckSpecStore();
  const deck = store.decks.find((d) => String(d.deckId) === deckId);
  if (!deck) return res.status(404).json({ error: 'deck_not_found' });

  const parsed = normalizePipelineRunPayload(req.body);
  if (parsed.error) return res.status(parsed.status || 400).json({ error: parsed.error });

  const run = await createPipelineRunRecord({
    deckId,
    scope: parsed.scope,
    slideId: parsed.slideId,
    stages: parsed.stages,
  });

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'pipeline.run.created',
    entity_type: 'pipeline_run',
    entity_id: run.runId,
    meta: {
      deckId,
      scope: run.scope,
      slideId: run.slideId,
      stages: run.stages,
      status: run.status
    }
  });

  return res.status(201).json({ ok: true, run });
});

app.get('/api/presentation-studio/pipeline/runs/:runId', requireRole('architect','editor'), async (req, res) => {
  const runId = String(req.params.runId || '').trim();
  if (!runId) return res.status(400).json({ error: 'invalid_run_id' });
  const store = await readPipelineRunStore();
  const run = store.runs.find((r) => String(r.runId) === runId);
  if (!run) return res.status(404).json({ error: 'run_not_found' });
  return res.json({ ok: true, run });
});

app.patch('/api/presentation-studio/pipeline/runs/:runId/stages/:stage', requireRole('architect','editor'), async (req, res) => {
  const runId = String(req.params.runId || '').trim();
  const stage = String(req.params.stage || '').trim().toLowerCase();
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();
  const error = req.body?.error == null ? null : String(req.body.error);

  const updated = await updatePipelineRunStage({ runId, stage, nextStatus, error });
  if (updated.error) return res.status(updated.status || 400).json({ error: updated.error });

  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'editor',
    event_type: 'pipeline.run.stage.updated',
    entity_type: 'pipeline_run',
    entity_id: runId,
    meta: {
      stage,
      status: nextStatus,
      runStatus: updated.run.status
    }
  });

  return res.json({ ok: true, run: updated.run });
});

app.get('/api/board', requireAnyAuth, async (_req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  res.json(board);
});

app.post('/api/auth/invite', requireRole('architect'), async (req, res) => {
  const role = normalizedRole(String(req.body.role || 'observer'));
  if (!['architect', 'editor', 'observer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const token = crypto.randomBytes(20).toString('hex');
  const invite = { token, role, createdAt: nowIso(), createdBy: getUserLabel(req), expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() };
  data.invites.push(invite);
  await writeJson(TEAM_USERS_FILE, data);
  const inviteUrl = `https://claw.hiethel.ai/auth/invite/${token}`;
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'admin.invite.create', entity_type: 'user', entity_id: role, meta: { inviteUrl } });
  res.json({ inviteUrl, role, expiresAt: invite.expiresAt });
});

app.post('/api/tasks', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const body = sanitizeTaskPatch(req.body || {});
  if (!body.title) return res.status(400).json({ error: 'title required' });
  const task = {
    id: crypto.randomUUID(),
    title: body.title,
    status: 'Backlog',
    owner: body.owner || null,
    due_date: body.due_date || null,
    priority: BOARD_PRIORITIES.includes(body.priority) ? body.priority : 'P2',
    tags: body.tags || [],
    linked_refs: body.linked_refs || [],
    description: body.description || '',
    comments: [],
    request_approval: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: getUserLabel(req),
    updated_by: getUserLabel(req),
  };
  board.tasks.push(task);
  await writeBoard(board, getUserLabel(req), 'task.create', task.id, null, task, effectiveRole(req) || 'editor');
  res.json(task);
});

app.patch('/api/tasks/:id', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const before = structuredClone(task);
  const patch = sanitizeTaskPatch(req.body || {});
  if (patch.priority && !BOARD_PRIORITIES.includes(patch.priority)) return res.status(400).json({ error: 'invalid priority' });
  Object.assign(task, patch);
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task.update', id, before, task, effectiveRole(req) || 'editor');
  res.json(task);
});

async function handleTaskMove(req, res, statusInput) {
  try {
    const role = effectiveRole(req);
    if (!role || !['architect', 'editor'].includes(role)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const board = await readJson(BOARD_FILE, defaultBoard());
    const id = String(req.params.id);
    const status = String(statusInput || '');
    if (!BOARD_COLUMNS.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const task = board.tasks.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: 'not found' });

    if (status === 'Done' && !(task.request_approval && task.request_approval.approved)) {
      return res.status(400).json({ error: 'task cannot move to Done without approved RP' });
    }

    const before = { status: task.status, review_packet_id: task.review_packet_id || null };
    task.status = status;

    if (status === 'Ready for Review' && !task.review_packet_id) {
      const rp = await createReviewPacketStub({
        title: `${task.title} Review Packet`,
        linkedTaskId: task.id,
        createdBy: getUserLabel(req),
        status: 'Draft',
        recommendedAction: 'Approve',
      });
      task.review_packet_id = rp.rpId;
      task.request_approval = {
        requested_at: nowIso(),
        requested_by: getUserLabel(req),
        review_packet_stub: rp.path,
        approved: false,
        approved_by: null,
        approved_at: null,
      };
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: task.id, path: rp.path } });
    }

    if (status === 'Ready for Review' && task.review_packet_id) {
      await updateRpFrontmatter(task.review_packet_id, { status: 'Ready for Review' });
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.ready_for_review', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
    }

    task.updated_at = nowIso();
    task.updated_by = getUserLabel(req);

    try {
      await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, review_packet_id: task.review_packet_id || null }, effectiveRole(req) || 'editor');
    } catch (persistErr) {
      console.error('task.move writeBoard failed, falling back to direct board write', persistErr);
      await writeJson(BOARD_FILE, board);
      await appendAuditEvent({
        ts: nowIso(),
        actor: getUserLabel(req),
        role: effectiveRole(req) || 'editor',
        event_type: 'task.move.fallback',
        entity_type: 'task',
        entity_id: id,
        meta: { before, after: { status: task.status, review_packet_id: task.review_packet_id || null }, error: String(persistErr?.message || persistErr) }
      });
    }
    return res.json(task);
  } catch (err) {
    console.error('task.move failed', err);
    return res.status(500).json({ error: 'move failed', detail: String(err?.message || err) });
  }
}

app.post('/api/tasks/:id/move', requireAnyAuth, async (req, res) => {
  return handleTaskMove(req, res, req.body.status);
});

app.get('/board/move/:id/:status', requireAnyAuth, async (req, res) => {
  return handleTaskMove(req, res, req.params.status);
});

app.post('/api/tasks/:id/comment', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'comment text required' });
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const comment = { id: crypto.randomUUID(), author: getUserLabel(req), text, created_at: nowIso() };
  task.comments.push(comment);
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);
  await writeBoard(board, getUserLabel(req), 'task.comment', id, null, { comment }, effectiveRole(req) || 'editor');
  res.json(comment);
});

app.post('/api/tasks/:id/request-approval', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.created_by !== getUserLabel(req) && !isArchitect(req)) {
    return res.status(403).json({ error: 'only creator can move Draft to Ready for Review' });
  }

  let rpPath = null;
  if (!task.review_packet_id) {
    const rp = await createReviewPacketStub({
      title: String(req.body.review_packet_title || task.title || 'Review Packet'),
      linkedTaskId: task.id,
      createdBy: getUserLabel(req),
      status: 'Draft',
      recommendedAction: 'Approve',
    });
    task.review_packet_id = rp.rpId;
    rpPath = rp.path;
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: task.id, path: rp.path } });
  }

  if (task.review_packet_id) {
    const updated = await updateRpFrontmatter(task.review_packet_id, { status: 'Ready for Review' });
    rpPath = rpPath || updated.path;
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.ready_for_review', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  }

  const before = { status: task.status, request_approval: task.request_approval || null, review_packet_id: task.review_packet_id || null };
  task.status = 'Ready for Review';
  task.request_approval = {
    requested_at: nowIso(),
    requested_by: getUserLabel(req),
    review_packet_stub: rpPath,
    approved: false,
    approved_by: null,
    approved_at: null,
  };
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, request_approval: task.request_approval, review_packet_id: task.review_packet_id || null }, effectiveRole(req) || 'editor');
  res.json(task);
});

app.post('/api/tasks/:id/approve', requireAnyAuth, async (req, res) => {
  try {
    const role = effectiveRole(req);
    const canApprove = isArchitect(req) || role === 'architect' || role === 'editor';
    if (!canApprove) return res.status(403).json({ error: 'forbidden' });

    const board = await readJson(BOARD_FILE, defaultBoard());
    const id = String(req.params.id);
    const task = board.tasks.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: 'not found' });

    if (!task.review_packet_id) return res.status(400).json({ error: 'task has no review packet' });

    const before = { request_approval: task.request_approval || null, status: task.status };
    task.request_approval = {
      ...(task.request_approval || {}),
      approved: true,
      approved_by: getUserLabel(req),
      approved_at: nowIso(),
    };
    task.status = 'Done';
    task.updated_at = nowIso();
    task.updated_by = getUserLabel(req);

    await updateRpFrontmatter(task.review_packet_id, {
      status: 'Approved',
      architect_decision: 'Approve',
      architect_notes: String(req.body.architect_notes || 'Approved'),
    });
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.approve', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });

    await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, request_approval: task.request_approval }, effectiveRole(req) || 'architect');
    return res.json(task);
  } catch (err) {
    console.error('task.approve failed', err);
    return res.status(500).json({ error: 'approve failed', detail: String(err?.message || err) });
  }
});

app.post('/api/tasks/:id/reject', requireRole('architect'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (!task.review_packet_id) return res.status(400).json({ error: 'task has no review packet' });

  task.status = 'Blocked';
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);
  await updateRpFrontmatter(task.review_packet_id, {
    status: 'Rejected',
    architect_decision: 'Reject',
    architect_notes: String(req.body.architect_notes || 'Rejected'),
  });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.reject', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  await writeBoard(board, getUserLabel(req), 'task.move', id, null, { status: task.status }, effectiveRole(req) || 'architect');
  res.json(task);
});

app.post('/api/tasks/:id/archive-rp', requireRole('architect'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task || !task.review_packet_id) return res.status(404).json({ error: 'not found' });
  await updateRpFrontmatter(task.review_packet_id, { status: 'Archived' });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.archive', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  await refreshBoardStateIntegration(board);
  await createSnapshot('rp.archive');
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const idx = board.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const before = board.tasks[idx];
  board.tasks.splice(idx, 1);
  await writeBoard(board, getUserLabel(req), 'task.delete', id, before, null, effectiveRole(req) || 'editor');
  res.json({ ok: true });
});

app.post('/api/review/:rpId/approve', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });

  const updated = await updateRpFrontmatter(rpId, {
    status: 'Approved',
    architect_decision: 'Approve',
    architect_notes: String(req.body.architect_notes || 'Approved'),
  });

  const board = await readJson(BOARD_FILE, defaultBoard());
  const t = board.tasks.find((x) => x.review_packet_id === rpId || x.id === rp.front.linked_task);
  if (t) {
    t.status = 'Done';
    t.request_approval = { ...(t.request_approval || {}), approved: true, approved_by: getUserLabel(req), approved_at: nowIso() };
    t.updated_at = nowIso();
    t.updated_by = getUserLabel(req);
    await writeJson(BOARD_FILE, board);
    await refreshBoardStateIntegration(board);
  }

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.approve', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.approve');
  res.json({ ok: true, rp_id: rpId, path: updated.path });
});

app.post('/api/review/:rpId/reject', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });
  const updated = await updateRpFrontmatter(rpId, {
    status: 'Rejected',
    architect_decision: 'Reject',
    architect_notes: String(req.body.architect_notes || 'Rejected'),
  });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.reject', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.reject');
  res.json({ ok: true });
});

app.post('/api/review/:rpId/archive', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });
  const updated = await updateRpFrontmatter(rpId, { status: 'Archived' });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.archive', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.archive');
  res.json({ ok: true });
});

async function copyDirContents(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDirContents(s, d);
    else await fs.copyFile(s, d);
  }
}

app.post('/api/events', requireRole('architect'), async (req, res) => {
  const event_type = String(req.body.event_type || '').trim();
  const allowed = ['workflow.run', 'workflow.fail', 'workflow.complete', 'cron.trigger', 'rp.ready_for_review', 'rp.approve', 'rp.reject', 'rp.archive', 'uos.upload', 'uos.publish', 'uos.archive', 'doctrine.change'];
  if (!allowed.includes(event_type)) return res.status(400).json({ error: 'unsupported event_type' });
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'architect',
    event_type,
    entity_type: String(req.body.entity_type || 'system'),
    entity_id: req.body.entity_id || null,
    meta: req.body.meta || {},
  });
  if (['rp.approve', 'uos.publish', 'doctrine.change', 'workflow.complete', 'workflow.fail'].includes(event_type)) {
    await createSnapshot(`event.${event_type}`);
  }
  res.json({ ok: true });
});

app.post('/api/email/send', requireRole('architect','editor'), async (req, res) => {
  const transport = getMailTransport();
  if (!transport) {
    return res.status(503).json({ error: 'mail sender not configured', required: ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','MAIL_FROM'] });
  }

  const toRaw = String(req.body.to || '').trim();
  const subject = String(req.body.subject || '').trim();
  const text = String(req.body.text || '').trim();
  const html = String(req.body.html || '').trim();

  if (!toRaw || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'to, subject, and text|html are required' });
  }

  const to = toRaw.split(',').map((v) => v.trim()).filter(Boolean);
  try {
    const info = await transport.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    });
    await appendAuditEvent({
      ts: nowIso(),
      actor: getUserLabel(req),
      role: effectiveRole(req) || 'architect',
      event_type: 'email.send',
      entity_type: 'email',
      entity_id: info.messageId || null,
      meta: { to, subject }
    });
    res.json({ ok: true, messageId: info.messageId, accepted: info.accepted || [] });
  } catch (err) {
    res.status(500).json({ error: 'send failed', detail: String(err?.message || err) });
  }
});

app.post('/api/uos/publish/:batch/:rpId', requireRole('architect'), async (req, res) => {
  const batch = String(req.params.batch || '');
  const rpId = String(req.params.rpId || '');
  const pendingDir = path.join(UOS_PENDING_ROOT, batch);
  if (!fssync.existsSync(pendingDir)) return res.status(404).json({ error: 'pending batch not found' });

  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'review packet not found' });
  if ((rp.front.status || '') !== 'Approved') return res.status(400).json({ error: 'review packet must be Approved before publish' });

  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const target = path.join(CURRENT_ROOT, key);
    await fs.rm(target, { recursive: true, force: true });
    const src = path.join(pendingDir, key);
    if (fssync.existsSync(src)) await copyDirContents(src, target);
  }

  // Build pseudo-updates from current
  const updates = [];
  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (!fssync.existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      updates.push({ key, originalName: f, currentPath: rel(path.join(dir, f)), inboxPath: null, archiveOriginalPath: null, archiveNormalizedPath: null });
    }
  }
  await rebuildUosIndex(updates, batch);

  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  state.latestUosPublish = nowIso();
  state.latestUosPublishedBatch = batch;
  await writeJson(DASHBOARD_STATE_FILE, state);

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.publish', entity_type: 'uos_batch', entity_id: `UOS-${batch}`, meta: { batch, rp_id: rpId } });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'doctrine.change', entity_type: 'uos', entity_id: rpId, meta: { batch } });
  await createSnapshot('uos.publish');
  res.json({ ok: true, batch, rp_id: rpId });
});

function fieldNameToCanonical(field) {
  if (field === 'executionEngine') return 'execution-engine';
  if (field === 'canon') return 'canon';
  if (field === 'revenueOS') return 'revenue-os';
  return field;
}

async function normalizeToMarkdown(fieldPrefix, originalName, buffer) {
  const extension = ext(originalName);
  const ts = nowIso();
  const header = `# ${titleFromPrefix(fieldPrefix)}\n\n- Source file: ${originalName}\n- Normalized at: ${ts}\n\n---\n\n`;

  if (extension === '.md') {
    return header + buffer.toString('utf8');
  }

  if (extension === '.txt') {
    return header + '```text\n' + buffer.toString('utf8') + '\n```\n';
  }

  if (extension === '.pdf') {
    const parsed = await pdfParse(buffer);
    const body = parsed.text?.trim() || '(No extractable text)';
    return `${header}## Extracted from PDF\n\n${body}\n`;
  }

  if (extension === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    const body = (parsed.value || '').trim() || '(No extractable text)';
    return `${header}## Extracted from DOCX\n\n${body}\n`;
  }

  throw new Error(`Unsupported extension ${extension}`);
}

function titleFromPrefix(prefix) {
  if (prefix === 'execution-engine') return 'Execution Engine';
  if (prefix === 'canon') return 'Canon';
  if (prefix === 'revenue-os') return 'Revenue OS';
  return prefix;
}

async function rebuildUosIndex(updates, stamp) {
  const grouped = groupByCategory(updates);
  const lines = [];
  lines.push('# UOS Index');
  lines.push('');
  lines.push(`Last updated: ${nowIso()}`);
  lines.push(`Archive batch: \`${rel(path.join(ARCHIVE_ROOT, stamp))}\``);
  lines.push('');
  lines.push('## Current Documents');
  lines.push('');

  for (const [key, items] of Object.entries(grouped)) {
    lines.push(`### ${titleFromPrefix(key)}`);
    lines.push(`- Current folder: \`${rel(path.join(CURRENT_ROOT, key))}\``);
    lines.push(`- Files updated: ${items.length}`);
    for (const u of items) {
      lines.push(`  - Uploaded file: ${u.originalName}`);
      lines.push(`    - Current: \`${u.currentPath || u.pendingPath || 'N/A'}\``);
      lines.push(`    - Inbox copy: \`${u.inboxPath}\``);
      lines.push(`    - Archive original: \`${u.archiveOriginalPath}\``);
      lines.push(`    - Archive normalized: \`${u.archiveNormalizedPath}\``);
    }
    lines.push('');
  }

  await fs.writeFile(UOS_INDEX, lines.join('\n'), 'utf8');
}

async function rebuildDashboardState(updates, stamp) {
  const grouped = groupByCategory(updates);
  const state = {
    schemaVersion: 1,
    lastUpdated: nowIso(),
    updatedDocs: Object.keys(grouped).map((k) => titleFromPrefix(k)),
    uosCurrent: Object.fromEntries(
      Object.entries(grouped).map(([key, items]) => [key, {
        title: titleFromPrefix(key),
        currentDir: rel(path.join(CURRENT_ROOT, key)),
        fileCount: items.length,
        files: items.map((u) => ({
          currentPath: u.currentPath || u.pendingPath || null,
          sourceUpload: u.originalName,
          archiveOriginalPath: u.archiveOriginalPath,
          archiveNormalizedPath: u.archiveNormalizedPath,
        })),
      }])
    ),
    latestArchiveBatch: rel(path.join(ARCHIVE_ROOT, stamp)),
  };

  await fs.writeFile(DASHBOARD_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  const snapshotPath = path.join(DASHBOARD_SNAPSHOTS, `${stamp}.json`);
  await fs.writeFile(snapshotPath, JSON.stringify(state, null, 2), 'utf8');

  const change = [
    `## ${state.lastUpdated}`,
    `- Rebuilt state from admin upload`,
    `- Updated docs: ${state.updatedDocs.join(', ')}`,
    `- Snapshot: \`${rel(snapshotPath)}\``,
    ''
  ].join('\n');

  if (!fssync.existsSync(DASHBOARD_CHANGELOG)) {
    await fs.writeFile(DASHBOARD_CHANGELOG, '# Dashboard State Changelog\n\n', 'utf8');
  }
  await fs.appendFile(DASHBOARD_CHANGELOG, change, 'utf8');
}

function groupByCategory(updates) {
  const out = {};
  for (const u of updates) {
    if (!out[u.key]) out[u.key] = [];
    out[u.key].push(u);
  }
  return out;
}

async function appendAdminLog(message) {
  const d = dateOnly();
  const logPath = path.join(ADMIN_LOG_ROOT, `${d}.md`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const line = `- ${nowIso()} ${message}\n`;
  if (!fssync.existsSync(logPath)) {
    await fs.writeFile(logPath, `# Admin Actions — ${d}\n\n`, 'utf8');
  }
  await fs.appendFile(logPath, line, 'utf8');
}

function rel(p) {
  return path.relative(ROOT, p) || '.';
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderSimpleMarkdown(md) {
  if (!md) return '<p class="text-muted">No content.</p>';

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inUl = false;

  const inline = (txt) => {
    let t = escapeHtml(txt || '');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return t;
  };

  for (const raw of lines) {
    const line = raw || '';
    if (!line.trim()) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      const lvl = Math.min(6, h[1].length);
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }

    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li) {
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    out.push(`<p>${inline(line)}</p>`);
  }

  if (inUl) out.push('</ul>');
  return out.join('\n');
}

await ensureDirs();
await ensureTeamAndBoardFiles();
await ensureRevealStorage();

app.listen(ADMIN_PORT, ADMIN_HOST, () => {
  console.log(`UOS admin server listening on http://${ADMIN_HOST}:${ADMIN_PORT}`);
});
