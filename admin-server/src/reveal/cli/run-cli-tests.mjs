import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const pexec = promisify(execFile);
const CLI = '/home/ec2-user/.openclaw/workspace/admin-server/src/reveal/cli/reveal-cli.js';
const OUT = '/home/ec2-user/.openclaw/workspace/reveal/exports';

async function run(args, expectCode = 0) {
  try {
    const { stdout, stderr } = await pexec('node', [CLI, ...args]);
    if (expectCode !== 0) throw new Error(`expected non-zero ${expectCode}`);
    return { code: 0, stdout, stderr };
  } catch (e) {
    const code = e.code ?? 0;
    if (code !== expectCode) throw new Error(`command failed code=${code} expected=${expectCode} args=${args.join(' ')}\n${e.stdout || ''}\n${e.stderr || ''}`);
    return { code, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

const flowId = 'fixture_cli_flow';
const snapFlowFile = `/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-flows/${flowId}.json`;
await fs.mkdir(path.dirname(snapFlowFile), { recursive: true });
await fs.writeFile(snapFlowFile, JSON.stringify({ id: flowId, name: 'CLI Flow', reviewVersion: 1, steps: [{ id: 'c1', index: 1, title: 'S', action: 'click', target: { elementType: 'button', text: 'X' }, page: { url: 'https://app.test' }, screenshots: {}, annotations: [] }] }, null, 2));

// unsigned fallback
const oldPriv = process.env.REVEAL_SIGNING_PRIVATE_KEY;
const oldPub = process.env.REVEAL_SIGNING_PUBLIC_KEY;
delete process.env.REVEAL_SIGNING_PRIVATE_KEY;
delete process.env.REVEAL_SIGNING_PUBLIC_KEY;

await run(['snapshot', 'create', flowId, '--json']);
const list = await run(['snapshot', 'list', flowId, '--json']);
const listJson = JSON.parse(list.stdout);
const sid = listJson.snapshots[listJson.snapshots.length - 1].snapshotId;

await run(['export', 'flow', flowId, '--format', 'json', '--output', `${OUT}/cli-flow.json`, '--json']);
await run(['package', 'flow', flowId, '--output', `${OUT}/cli-flow.revealpkg.zip`, '--json']);
await run(['verify', 'package', `${OUT}/cli-flow.revealpkg.zip`, '--json']);
await run(['verify', 'snapshot', flowId, sid, '--json']);
await run(['keyset', 'show', '--json']);
await run(['keyset', 'verify', '--json']);

// signature mismatch detection
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
process.env.REVEAL_SIGNING_PRIVATE_KEY = privateKey;
process.env.REVEAL_SIGNING_PUBLIC_KEY = publicKey;
await run(['package', 'flow', flowId, '--output', `${OUT}/cli-flow-signed.revealpkg.zip`, '--json']);

// tamper by replacing manifest packageContentHash inside zip (extract/rezip)
const tmp = '/tmp/cli-pkg-tamper';
await fs.rm(tmp, { recursive: true, force: true });
await fs.mkdir(tmp, { recursive: true });
await pexec('unzip', ['-o', `${OUT}/cli-flow-signed.revealpkg.zip`, '-d', tmp]);
const manPath = `${tmp}/manifest.json`;
const man = JSON.parse(await fs.readFile(manPath, 'utf8'));
man.packageContentHash = 'tampered';
await fs.writeFile(manPath, JSON.stringify(man, null, 2));
await pexec('bash', ['-lc', `cd ${tmp} && zip -X -r ${OUT}/cli-flow-tampered.revealpkg.zip .`]);

await run(['verify', 'package', `${OUT}/cli-flow-tampered.revealpkg.zip`, '--json'], 1);

// JSON output stability shape
const summary = await run(['verify', 'package', `${OUT}/cli-flow-signed.revealpkg.zip`, '--summary', '--json']);
const parsed = JSON.parse(summary.stdout);
if (!Object.prototype.hasOwnProperty.call(parsed, 'verificationStatus')) throw new Error('missing verificationStatus in summary json');

if (oldPriv) process.env.REVEAL_SIGNING_PRIVATE_KEY = oldPriv; else delete process.env.REVEAL_SIGNING_PRIVATE_KEY;
if (oldPub) process.env.REVEAL_SIGNING_PUBLIC_KEY = oldPub; else delete process.env.REVEAL_SIGNING_PUBLIC_KEY;

console.log('OK cli tests');
