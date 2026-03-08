import fs from 'fs/promises';
import path from 'path';
import { cleanEvents, groupEvents } from '../pipeline.js';

const DIR = path.resolve('/home/ec2-user/.openclaw/workspace/admin-server/src/reveal/normalization/fixtures');

async function run() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.raw.json'));
  for (const f of files) {
    const raw = JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
    const cleaned = cleanEvents(raw);
    const groups = groupEvents(cleaned);
    console.log(`\n# ${f}`);
    console.log(`events=${raw.length} cleaned=${cleaned.length} groups=${groups.length}`);
    groups.forEach((g, i) => {
      const names = g.map((e) => `${e.type}:${(e.text || e.selector || '').slice(0, 24)}`).join(' | ');
      console.log(`  ${i + 1}. ${names}`);
    });
  }
}

run();
