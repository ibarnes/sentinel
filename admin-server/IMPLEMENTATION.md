# UOS Admin Upload UI — Implementation

## What was implemented

### Admin auth + session
- `GET /admin/login` login page
- `POST /admin/login` password auth against `ADMIN_PASSWORD_HASH` (bcrypt hash)
- `POST /admin/logout`
- Session cookie settings:
  - `HttpOnly: true`
  - `Secure: true` (configurable via `ADMIN_COOKIE_SECURE`)
  - `SameSite: strict`
  - `maxAge: 8h`
- In-memory login rate limiting (per-IP)

### Admin upload
- `GET /admin/upload`
- `POST /admin/upload` accepts exactly 3 categories in one form:
  - `executionEngine` (multiple files)
  - `canon` (multiple files)
  - `revenueOS` (multiple files)
- Each category requires at least one file
- Accepted file extensions: `.md`, `.txt`, `.pdf`, `.docx`
- File size limit: 20MB per file

### Storage + versioning
On successful upload:
1. Inbox copies written to:
   - `workspace/uos/inbox/YYYY-MM-DD/`
2. Originals archived under:
   - `workspace/uos/archive/<timestamp>/`
3. Normalized markdown written to:
   - `workspace/uos/current/{execution-engine,canon,revenue-os}.md`
4. Normalized markdown also archived in same batch archive folder
5. `workspace/uos/UOS_INDEX.md` rebuilt

### Normalization
- `.md` -> stored as markdown with metadata header
- `.txt` -> wrapped in fenced block under markdown metadata header
- `.pdf` -> extracted text via `pdf-parse` and saved as markdown
- `.docx` -> extracted text via `mammoth` and saved as markdown

### State refresh
After upload:
- Rebuilds `dashboard/state/state.json`
- Writes snapshot `dashboard/snapshots/<timestamp>.json`
- Appends entry to `dashboard/state/changelog.md`

### Dashboard read-only block
- Added `dashboard/public/last-updated.js`
- Reads `/dashboard/state/state.json` and renders:
  - last update timestamp
  - updated UOS docs

### Admin action logging
- Appends to `mission-control/logs/admin-actions/YYYY-MM-DD.md`

## Config (no plaintext secrets)
Use environment variables in `admin-server/.env` (not committed):

```bash
ADMIN_PASSWORD_HASH=<bcrypt hash>
ADMIN_SESSION_SECRET=<long-random-secret>
ADMIN_COOKIE_SECURE=true
ADMIN_PORT=4180
ADMIN_HOST=127.0.0.1
```

### Generate password hash

```bash
cd /home/ec2-user/.openclaw/workspace/admin-server
node -e "import b from 'bcryptjs'; console.log(b.hashSync('YOUR_STRONG_PASSWORD', 12))"
```

## Run

```bash
cd /home/ec2-user/.openclaw/workspace/admin-server
npm install
cp .env.example .env
# edit .env
npm start
```

Server binds to `127.0.0.1:4180` by default.

## Nginx integration
See: `admin-server/deploy/nginx-admin.conf`

- Route `/admin/*` -> admin service
- Keep `/dashboard/*` read-only static

## Systemd unit (optional)
See: `admin-server/deploy/uos-admin.service`

## Test flow
1. Open `/admin/login`
2. Login with admin password
3. Open `/admin/upload`
4. Upload all 3 categories in one submit (one or many files per category)
5. Verify:
   - `workspace/uos/current/*.md` updated
   - `workspace/uos/archive/<timestamp>/` contains originals + normalized markdown
   - `workspace/uos/UOS_INDEX.md` updated
   - `dashboard/state/state.json` updated
   - `dashboard/snapshots/<timestamp>.json` exists
   - `dashboard/state/changelog.md` appended
   - `mission-control/logs/admin-actions/YYYY-MM-DD.md` appended

## Security notes
- Password hash only (bcrypt), no plaintext storage
- Cookie is HttpOnly + Secure + strict same-site
- Login attempts rate-limited in-memory
- Service intended behind nginx TLS termination
