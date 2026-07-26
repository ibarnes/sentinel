# Dashboard Data MCP

This MCP server exposes the file-backed dashboard dataset as read-only tools over stdio.

## What it reads

The server reads directly from:

- `dashboard/data/buyers.json`
- `dashboard/data/initiatives.json`
- `dashboard/data/signals.json`
- `dashboard/data/meeting_minutes.json`
- `dashboard/data/action_items.json`
- `dashboard/data/contact_paths.json`
- `dashboard/data/decision_architecture.json`

It does not write back to any dashboard files.

## Run

From `admin-server/`:

```bash
npm run mcp:dashboard
```

## Remote HTTP mode

This repo now also includes a remote Streamable HTTP wrapper for the same tool surface.

Set a bearer token first:

```bash
export DASHBOARD_MCP_AUTH_TOKEN="replace-with-a-long-random-token"
```

Then start the remote server:

```bash
npm run mcp:dashboard:http
```

Defaults:

- host: `0.0.0.0`
- port: `4191`
- MCP path: `/mcp/dashboard`
- health check: `/healthz`

Optional overrides:

```bash
export DASHBOARD_MCP_HOST="0.0.0.0"
export DASHBOARD_MCP_PORT="4191"
export DASHBOARD_MCP_PATH="/mcp/dashboard"
export DASHBOARD_MCP_ALLOWED_HOSTS="dashboard.hiethel.ai,127.0.0.1,localhost"
```

## Tools

- `get_dashboard_summary`
- `list_buyers`
- `get_buyer`
- `list_initiatives`
- `get_initiative`
- `list_signals`
- `search_meeting_minutes`
- `list_action_items`
- `list_contact_paths`
- `list_decision_architecture`
- `uos_get_config`
- `uos_get_health`
- `uos_list_opportunities`
- `uos_get_opportunity`
- `uos_list_activities`
- `uos_get_capacity`
- `uos_get_review_queue`
- `uos_get_constraints`
- `uos_get_gate_definitions`
- `uos_create_change_request`
- `uos_get_change_request`
- `uos_get_overview`

## UOS Core integration

This installation can now operate as a non-authoritative intelligence and proposal layer over UOS Core.

Server-side env vars:

```bash
UOS_CORE_API_BASE_URL="https://uos.unifiedstategroup.com/api/public/v1"
UOS_CORE_TOKEN="uos_live_..."
```

Rules enforced by the integration:

- UOS Core remains authoritative.
- OpenClaw may read records and submit change requests.
- OpenClaw does not directly advance gates, approve decisions, alter authority, or apply proposals.
- Capacity and authority are treated separately.
- Correlation IDs are preserved in responses for audit and troubleshooting.
- The raw bearer token never leaves the server-side secret store.

## Root override

By default the server reads from:

```bash
/home/ec2-user/.openclaw/workspace
```

You can override that with:

```bash
OPENCLAW_DASHBOARD_ROOT=/path/to/workspace npm run mcp:dashboard
```

## Example MCP config

```json
{
  "mcpServers": {
    "dashboard-data": {
      "command": "npm",
      "args": ["run", "mcp:dashboard"],
      "cwd": "/home/ec2-user/.openclaw/workspace/admin-server"
    }
  }
}
```

## Example remote Codex config

For a laptop-side ChatGPT desktop or Codex client talking to the EC2 host, use a Streamable HTTP server entry instead of stdio:

```toml
[mcp_servers.dashboard_remote]
url = "http://YOUR_EC2_HOSTNAME_OR_IP:4191/mcp/dashboard"
bearer_token_env_var = "DASHBOARD_MCP_AUTH_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 60
```

Then set the same token in the client environment before launching ChatGPT desktop/Codex.

If you put the remote server behind HTTPS and a reverse proxy, use the public HTTPS URL here instead.

For this EC2 host after nginx wiring, the public endpoint is:

```text
https://dashboard.hiethel.ai/mcp/dashboard
```

## ChatGPT web install

This remote MCP endpoint is already in the right shape for a private ChatGPT app install.
You do not need a separate transport or a different server binary for that.

What ChatGPT calls this has changed over time:

- `connector` was the older name
- `app` is the current ChatGPT term
- `plugin` is the directory/distribution layer that can optionally include one or more apps

For a private install into your own ChatGPT workspace, the MCP app is the important part.

### What works today

- Private custom app install in ChatGPT web using the existing HTTPS MCP endpoint
- ChatGPT Desktop / Codex remote MCP usage using the same endpoint
- Read-only tool access backed by the dashboard flat files

### What is not required

- No separate plugin package is required just to use this privately in ChatGPT web
- No stdio config is used by `chatgpt.com`
- No extra reverse proxy work is needed beyond the existing HTTPS endpoint

### Install in ChatGPT web

Requirements:

- A ChatGPT plan/workspace that supports custom MCP apps
- Workspace admin/owner access if your workspace requires it
- At least one active dashboard team login in `mission-control/auth/users.json`
- `ADMIN_SESSION_SECRET` or `DASHBOARD_MCP_OAUTH_SESSION_SECRET` set on the server

Install flow:

1. Open ChatGPT web.
2. Go to workspace/app settings and enable developer mode or custom MCP apps if your plan requires it.
3. Create a new custom app.
4. Use this MCP server URL:

```text
https://dashboard.hiethel.ai/mcp/dashboard
```

5. When prompted for auth, choose `OAuth`.
6. Save the app and refresh metadata if ChatGPT offers that action.
7. ChatGPT should redirect to the dashboard OAuth login page at:

```text
https://dashboard.hiethel.ai/oauth/login
```

8. Sign in with your existing dashboard team username and password.
9. Open a new chat, add the app/tool, and try:

```text
Use get_dashboard_summary
```

### Auth split

- `ChatGPT web`: use `OAuth`
- `ChatGPT Desktop` / `Codex` remote MCP config: keep using the static bearer token in `DASHBOARD_MCP_AUTH_TOKEN`

Both auth modes are supported by the same `/mcp/dashboard` endpoint.

### Private app vs plugin listing

There are two different outcomes:

- Private app install: available in your ChatGPT workspace after you add the MCP server in ChatGPT
- Plugin listing: a separate publish/review/distribution step if you want it to appear as a formal installable plugin in a Plugins Directory

This repo currently supports the first outcome directly.
If you want the second outcome, the remaining work is mainly OpenAI-side workspace/plugin publishing workflow, not another transport rewrite here.

## Notes

- This is the right first step for ChatGPT/Codex access because your system of record is still flat files.
- Keep this read-only until you decide on write governance, validation, and audit logging.
- Local stdio only works when the client and MCP process run on the same machine.
- Remote Streamable HTTP is the right option when the MCP runs on EC2 and the ChatGPT/Codex client runs elsewhere.
