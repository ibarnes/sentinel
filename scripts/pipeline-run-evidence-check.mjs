#!/usr/bin/env node
import fs from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/pipeline-run-evidence-check.mjs <evidence-file>');
  process.exit(2);
}

const text = fs.readFileSync(file, 'utf8');
const has201 = /(HTTP\s*201|status\s*[:=]\s*201|\b201\b)/i.test(text);
const has400 = /(HTTP\s*400|status\s*[:=]\s*400|\b400\b)/i.test(text);
const hasRunId = /\brunId\b/i.test(text);
const hasStarted = /\bstarted\b/i.test(text);
const hasEvidencePath = /mission-control\/evidence\/pipeline-run\//i.test(text) || /evidence/i.test(text);

const result = {
  file,
  checks: {
    has201,
    has400,
    hasRunId,
    hasStarted,
    hasEvidencePath,
  },
  pass: has201 && has400 && hasRunId && hasStarted,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
