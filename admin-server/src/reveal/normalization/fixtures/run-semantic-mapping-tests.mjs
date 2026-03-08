import fs from 'fs/promises';
import path from 'path';
import {
  classifyDiffNode,
  SUPPORTED_SEMANTIC_REASONS,
  SUPPORTED_SEMANTIC_SUBREASONS,
  SEMANTIC_SUBREASON_TAXONOMY,
  semanticMappingSelfCheck
} from '../../services/semanticDiffReasonService.js';

const matrixPath = path.resolve('/home/ec2-user/.openclaw/workspace/admin-server/src/reveal/normalization/fixtures/semantic-mapping-matrix.json');
const cases = JSON.parse(await fs.readFile(matrixPath, 'utf8'));

const selfCheck = semanticMappingSelfCheck();
if (!selfCheck.ok) fail(`semantic mapping self-check failed: ${JSON.stringify(selfCheck)}`);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const ids = new Set();
for (const c of cases) {
  if (!c.id) fail('missing id');
  if (ids.has(c.id)) fail(`duplicate id: ${c.id}`);
  ids.add(c.id);
  if (!c.expectedSemanticReason) fail(`missing expectedSemanticReason: ${c.id}`);
  if (c.expectedSemanticReason !== 'unclassified_change' && !SUPPORTED_SEMANTIC_REASONS.includes(c.expectedSemanticReason)) {
    fail(`unknown expectedSemanticReason for ${c.id}: ${c.expectedSemanticReason}`);
  }
  if (c.expectedSemanticSubReason != null && !SUPPORTED_SEMANTIC_SUBREASONS.includes(c.expectedSemanticSubReason)) {
    fail(`unknown expectedSemanticSubReason for ${c.id}: ${c.expectedSemanticSubReason}`);
  }
  if (c.expectedSemanticSubReason && c.expectedSemanticReason in SEMANTIC_SUBREASON_TAXONOMY) {
    const allowed = SEMANTIC_SUBREASON_TAXONOMY[c.expectedSemanticReason];
    if (!allowed.includes(c.expectedSemanticSubReason)) {
      fail(`orphan sub-reason in ${c.id}: ${c.expectedSemanticSubReason} not in ${c.expectedSemanticReason}`);
    }
  }
}

let pass = 0;
let failCount = 0;
const byReason = {};
const bySub = {};

for (const c of cases) {
  const actual = classifyDiffNode(c);
  const okReason = actual.semanticReason === c.expectedSemanticReason;
  const okSub = actual.semanticSubReason === c.expectedSemanticSubReason;
  byReason[actual.semanticReason] = (byReason[actual.semanticReason] || 0) + 1;
  if (actual.semanticSubReason) bySub[actual.semanticSubReason] = (bySub[actual.semanticSubReason] || 0) + 1;

  if (okReason && okSub) {
    pass += 1;
  } else {
    failCount += 1;
    console.error(`\n[FAIL] ${c.id}`);
    console.error(`  input: path=${c.path} stage=${c.stage} field=${c.field} reason=${c.reason}`);
    console.error(`  expected: semantic=${c.expectedSemanticReason} sub=${c.expectedSemanticSubReason}`);
    console.error(`  actual:   semantic=${actual.semanticReason} sub=${actual.semanticSubReason}`);
    console.error(`  notes:    reasonNotes=${JSON.stringify(actual.semanticReasonMappingNotes)} subNotes=${JSON.stringify(actual.semanticSubReasonMappingNotes)}`);
  }
}

const expectedReasonCoverage = {};
for (const k of SUPPORTED_SEMANTIC_REASONS) expectedReasonCoverage[k] = 0;
const expectedSubCoverage = {};
for (const k of SUPPORTED_SEMANTIC_SUBREASONS) expectedSubCoverage[k] = 0;
for (const c of cases) {
  if (expectedReasonCoverage[c.expectedSemanticReason] !== undefined) expectedReasonCoverage[c.expectedSemanticReason] += 1;
  if (c.expectedSemanticSubReason && expectedSubCoverage[c.expectedSemanticSubReason] !== undefined) expectedSubCoverage[c.expectedSemanticSubReason] += 1;
}

const uncoveredReasons = Object.entries(expectedReasonCoverage).filter(([, n]) => n === 0).map(([k]) => k);
const uncoveredSubs = Object.entries(expectedSubCoverage).filter(([, n]) => n === 0).map(([k]) => k);

console.log('\n=== Semantic Mapping Test Matrix ===');
console.log(`cases=${cases.length} pass=${pass} fail=${failCount}`);
console.log(`supported semantic reasons=${SUPPORTED_SEMANTIC_REASONS.length}`);
console.log(`supported semantic sub-reasons=${SUPPORTED_SEMANTIC_SUBREASONS.length}`);
console.log(`test cases by semantic reason=${JSON.stringify(expectedReasonCoverage)}`);
console.log(`uncovered semantic reasons=${JSON.stringify(uncoveredReasons)}`);
console.log(`uncovered semantic sub-reasons=${JSON.stringify(uncoveredSubs)}`);

if (failCount > 0) process.exit(1);
if (uncoveredReasons.length > 0 || uncoveredSubs.length > 0) process.exit(1);
