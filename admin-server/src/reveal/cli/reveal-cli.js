#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createSnapshot, listSnapshots, getSnapshot, verifySnapshotIntegrity, recomputeFlowSnapshotIntegrity } from '../services/snapshotService.js';
import { exportReviewedFlow, exportSnapshot } from '../services/exportService.js';
import { buildReviewedPackage, buildSnapshotPackage } from '../services/packageService.js';
import { getVerificationKeyset, verifyKeysetIntegrity, verifyVerificationMetadata } from '../services/packageSigningService.js';
import { getFlow } from '../services/retrievalService.js';

const WORKSPACE = '/home/ec2-user/.openclaw/workspace';
const EXIT = { OK: 0, VERIFY_FAIL: 1, MALFORMED_PACKAGE: 2, MISSING_INPUTS: 3, UNSUPPORTED_COMMAND: 4 };

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') flags.json = true;
    else if (a === '--summary') flags.summary = true;
    else if (a === '--output') flags.output = args[++i];
    else if (a === '--format') flags.format = args[++i];
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else pos.push(a);
  }
  return { pos, flags };
}

async function loadConfig() {
  const cfgPath = process.env.REVEAL_CONFIG || path.join(WORKSPACE, 'reveal.config.json');
  try {
    const raw = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
    return raw;
  } catch {
    return { serverBaseUrl: process.env.REVEAL_SERVER_BASE_URL || 'http://localhost:4180', defaultExportDir: path.join(WORKSPACE, 'reveal', 'exports') };
  }
}

function out(obj, jsonMode) {
  if (jsonMode) console.log(JSON.stringify(obj, null, 2));
  else if (typeof obj === 'string') console.log(obj);
  else console.log(JSON.stringify(obj, null, 2));
}

function help() {
  return `reveal CLI\n\nCommands:\n  reveal flows list [--json]\n  reveal flows show <flowId> [--json]\n  reveal snapshot create <flowId> [--json]\n  reveal snapshot list <flowId> [--json]\n  reveal snapshot show <flowId> <snapshotId> [--json]\n  reveal export flow <flowId> --format json|markdown|package [--output <path>] [--json]\n  reveal export snapshot <flowId> <snapshotId> --format json|markdown|package [--output <path>] [--json]\n  reveal package flow <flowId> [--output <path>] [--json]\n  reveal package snapshot <flowId> <snapshotId> [--output <path>] [--json]\n  reveal verify snapshot <flowId> <snapshotId> [--json]\n  reveal verify package <pathToRevealPkg> [--summary] [--json]\n  reveal keyset show [--json]\n  reveal keyset verify [--json]\n`;
}

async function listFlows() {
  const dirs = [path.join(WORKSPACE, 'reveal/storage/normalized-flows'), path.join(WORKSPACE, 'reveal/storage/reviewed-flows')];
  const map = new Map();
  for (const d of dirs) {
    try {
      const files = (await fs.readdir(d)).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const j = JSON.parse(await fs.readFile(path.join(d, f), 'utf8'));
        map.set(j.id || f.replace('.json',''), { flowId: j.id, name: j.name, reviewVersion: j.reviewVersion || j.version, steps: (j.steps || []).length });
      }
    } catch {}
  }
  return [...map.values()].sort((a,b)=>String(a.flowId).localeCompare(String(b.flowId)));
}

async function writeExport(content, filename, outputArg, cfg) {
  const outPath = outputArg || path.join(cfg.defaultExportDir, filename);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, content);
  return outPath;
}

import { execFile } from 'child_process';
import { promisify } from 'util';
const pexec = promisify(execFile);

async function readZipEntry(zipPath, entry) {
  const { stdout } = await pexec('unzip', ['-p', zipPath, entry]);
  return stdout;
}

async function verifyPackageLocal(pkgPath) {
  try {
    const manifest = JSON.parse(await readZipEntry(pkgPath, 'manifest.json'));
    const integrity = JSON.parse(await readZipEntry(pkgPath, 'integrity.json'));
    const expected = integrity?.verificationMetadata?.packageContentHash || manifest.packageContentHash;
    if (!expected) return { status: 'content_hash_mismatch', reasonCodes: ['missing_package_content_hash'], manifest };

    const calc = crypto.createHash('sha256').update(JSON.stringify({
      inventory: (manifest.artifacts || []).slice().sort(),
      packageType: manifest.packageType,
      flowId: manifest.flowId,
      snapshotId: manifest.snapshotId || null,
      contentHash: manifest.contentHash || null
    })).digest('hex');

    if (calc !== expected) return { status: 'content_hash_mismatch', reasonCodes: ['package_content_hash_mismatch'], manifest };

    const verify = await verifyVerificationMetadata({ ...manifest, integrityPackageContentHash: expected });
    return { ...verify, manifest };
  } catch (e) {
    return { status: 'malformed_verification_payload', reasonCodes: ['package_read_error'], error: String(e.message || e) };
  }
}

async function main() {
  const { pos, flags } = parseArgs(process.argv);
  const cfg = await loadConfig();
  const jsonMode = !!flags.json;

  if (pos.length === 0 || pos[0] === 'help' || pos[0] === '--help') {
    out(help(), false);
    process.exit(EXIT.OK);
  }

  const [cmd, sub, a1, a2] = pos;

  try {
    if (cmd === 'flows' && sub === 'list') {
      const flows = await listFlows();
      out(jsonMode ? { flows } : flows, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'flows' && sub === 'show') {
      if (!a1) return process.exit(EXIT.MISSING_INPUTS);
      const f = await getFlow(a1, 'preferred');
      if (!f) return process.exit(EXIT.MISSING_INPUTS);
      out(jsonMode ? f : f.flow, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'snapshot' && sub === 'create') {
      if (!a1) return process.exit(EXIT.MISSING_INPUTS);
      const r = await createSnapshot(a1, { createdBy: 'reveal-cli' });
      out(r, jsonMode);
      return process.exit(r.error ? EXIT.MISSING_INPUTS : EXIT.OK);
    }

    if (cmd === 'snapshot' && sub === 'list') {
      if (!a1) return process.exit(EXIT.MISSING_INPUTS);
      const r = await listSnapshots(a1);
      out(r, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'snapshot' && sub === 'show') {
      if (!a1 || !a2) return process.exit(EXIT.MISSING_INPUTS);
      const r = await getSnapshot(a1, a2);
      out(r, jsonMode);
      return process.exit(r.error ? EXIT.MISSING_INPUTS : EXIT.OK);
    }

    if (cmd === 'export' && sub === 'flow') {
      if (!a1 || !flags.format) return process.exit(EXIT.MISSING_INPUTS);
      if (flags.format === 'package') {
        const p = await buildReviewedPackage(a1);
        if (p.error) return process.exit(EXIT.MISSING_INPUTS);
        const outPath = await writeExport(await fs.readFile(p.archivePath), p.filename, flags.output, cfg);
        await fs.rm(p.cleanupDir, { recursive: true, force: true });
        out({ output: outPath }, jsonMode);
        return process.exit(EXIT.OK);
      }
      const e = await exportReviewedFlow(a1, flags.format);
      if (e.error) return process.exit(EXIT.MISSING_INPUTS);
      const outPath = await writeExport(e.content, e.filename, flags.output, cfg);
      out({ output: outPath }, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'export' && sub === 'snapshot') {
      if (!a1 || !a2 || !flags.format) return process.exit(EXIT.MISSING_INPUTS);
      if (flags.format === 'package') {
        const p = await buildSnapshotPackage(a1, a2);
        if (p.error) return process.exit(EXIT.MISSING_INPUTS);
        const outPath = await writeExport(await fs.readFile(p.archivePath), p.filename, flags.output, cfg);
        await fs.rm(p.cleanupDir, { recursive: true, force: true });
        out({ output: outPath }, jsonMode);
        return process.exit(EXIT.OK);
      }
      const e = await exportSnapshot(a1, a2, flags.format);
      if (e.error) return process.exit(EXIT.MISSING_INPUTS);
      const outPath = await writeExport(e.content, e.filename, flags.output, cfg);
      out({ output: outPath }, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'package' && sub === 'flow') {
      if (!a1) return process.exit(EXIT.MISSING_INPUTS);
      const p = await buildReviewedPackage(a1);
      if (p.error) return process.exit(EXIT.MISSING_INPUTS);
      const outPath = await writeExport(await fs.readFile(p.archivePath), p.filename, flags.output, cfg);
      await fs.rm(p.cleanupDir, { recursive: true, force: true });
      out({ output: outPath }, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'package' && sub === 'snapshot') {
      if (!a1 || !a2) return process.exit(EXIT.MISSING_INPUTS);
      const p = await buildSnapshotPackage(a1, a2);
      if (p.error) return process.exit(EXIT.MISSING_INPUTS);
      const outPath = await writeExport(await fs.readFile(p.archivePath), p.filename, flags.output, cfg);
      await fs.rm(p.cleanupDir, { recursive: true, force: true });
      out({ output: outPath }, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'verify' && sub === 'snapshot') {
      if (!a1 || !a2) return process.exit(EXIT.MISSING_INPUTS);
      const r = await verifySnapshotIntegrity(a1, a2);
      out(r, jsonMode);
      return process.exit(r.status === 'match' ? EXIT.OK : EXIT.VERIFY_FAIL);
    }

    if (cmd === 'verify' && sub === 'package') {
      if (!a1) return process.exit(EXIT.MISSING_INPUTS);
      const r = await verifyPackageLocal(a1);
      if (flags.summary) {
        const m = r.manifest || {};
        out({ packageType: m.packageType, snapshotChainIndex: m.snapshotChainIndex, contentHash: m.contentHash, signatureStatus: m.signatureStatus, signerFingerprint: m.signerKeyFingerprint, trustProfile: m.trustProfileName, verificationStatus: r.status }, jsonMode);
      } else {
        out(r, jsonMode);
      }
      return process.exit(['verified','verified_with_unpublished_key','verified_with_retired_key','unsigned'].includes(r.status) ? EXIT.OK : EXIT.VERIFY_FAIL);
    }

    if (cmd === 'keyset' && sub === 'show') {
      const ks = await getVerificationKeyset();
      out(ks, jsonMode);
      return process.exit(EXIT.OK);
    }

    if (cmd === 'keyset' && sub === 'verify') {
      const ks = await verifyKeysetIntegrity();
      out(ks, jsonMode);
      return process.exit(ks.status === 'verified' || ks.status === 'unsigned' ? EXIT.OK : EXIT.VERIFY_FAIL);
    }

    out({ error: 'unsupported_command', help: help() }, jsonMode);
    process.exit(EXIT.UNSUPPORTED_COMMAND);
  } catch (e) {
    out({ error: String(e.message || e) }, jsonMode);
    process.exit(EXIT.MALFORMED_PACKAGE);
  }
}

main();
