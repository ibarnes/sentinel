#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const OUT_FILE = path.join(ROOT, 'dashboard/data/calendar_events.json');

function unfoldIcsLines(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (!line) {
      out.push('');
      continue;
    }
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseProp(line) {
  const i = line.indexOf(':');
  if (i === -1) return null;
  const left = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...paramBits] = left.split(';');
  const params = {};
  for (const bit of paramBits) {
    const eq = bit.indexOf('=');
    if (eq === -1) continue;
    const k = bit.slice(0, eq).toUpperCase();
    const v = bit.slice(eq + 1);
    params[k] = v;
  }
  return { name: name.toUpperCase(), params, value };
}

function parseIcsDate(value, params = {}) {
  const v = String(value || '').trim();
  if (!v) return null;

  // Date only: YYYYMMDD
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const yyyy = Number(v.slice(0, 4));
    const mm = Number(v.slice(4, 6));
    const dd = Number(v.slice(6, 8));
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // UTC datetime: YYYYMMDDTHHmmssZ
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    const yyyy = Number(v.slice(0, 4));
    const mm = Number(v.slice(4, 6));
    const dd = Number(v.slice(6, 8));
    const HH = Number(v.slice(9, 11));
    const MM = Number(v.slice(11, 13));
    const SS = Number(v.slice(13, 15));
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM, SS));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Local datetime: YYYYMMDDTHHmmss (treated as local runtime time)
  if (/^\d{8}T\d{6}$/.test(v)) {
    const yyyy = Number(v.slice(0, 4));
    const mm = Number(v.slice(4, 6));
    const dd = Number(v.slice(6, 8));
    const HH = Number(v.slice(9, 11));
    const MM = Number(v.slice(11, 13));
    const SS = Number(v.slice(13, 15));
    const d = new Date(yyyy, mm - 1, dd, HH, MM, SS);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Last fallback: Date parse
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseEvents(rawIcs) {
  const lines = unfoldIcsLines(rawIcs);
  const events = [];

  let inEvent = false;
  let cur = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      cur = { raw: {} };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const start = cur.dtstart ? parseIcsDate(cur.dtstart.value, cur.dtstart.params) : null;
        const end = cur.dtend ? parseIcsDate(cur.dtend.value, cur.dtend.params) : null;
        events.push({
          uid: cur.uid || null,
          summary: cur.summary || '(No title)',
          description: cur.description || '',
          location: cur.location || '',
          status: cur.status || '',
          organizer: cur.organizer || '',
          start: start ? start.toISOString() : null,
          end: end ? end.toISOString() : null,
          all_day: Boolean(cur.dtstart?.params?.VALUE === 'DATE' || /^\d{8}$/.test(String(cur.dtstart?.value || ''))),
        });
      }
      inEvent = false;
      cur = null;
      continue;
    }
    if (!inEvent || !cur) continue;

    const prop = parseProp(line);
    if (!prop) continue;

    cur.raw[prop.name] = prop.value;
    switch (prop.name) {
      case 'UID':
        cur.uid = prop.value;
        break;
      case 'SUMMARY':
        cur.summary = prop.value;
        break;
      case 'DESCRIPTION':
        cur.description = prop.value;
        break;
      case 'LOCATION':
        cur.location = prop.value;
        break;
      case 'STATUS':
        cur.status = prop.value;
        break;
      case 'ORGANIZER':
        cur.organizer = prop.value;
        break;
      case 'DTSTART':
        cur.dtstart = { value: prop.value, params: prop.params };
        break;
      case 'DTEND':
        cur.dtend = { value: prop.value, params: prop.params };
        break;
      default:
        break;
    }
  }

  return events;
}


async function loadEnvFromFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch (_) {
    // file missing is fine
  }
}

async function main() {
  await loadEnvFromFile(path.join(ROOT, 'admin-server/.env'));
  await loadEnvFromFile(path.join(ROOT, '.env'));
  const url = process.argv[2] || process.env.GCAL_ICS_URL || process.env.CALENDAR_ICS_URL;
  const windowDays = Number(process.argv[3] || process.env.CALENDAR_WINDOW_DAYS || '21');

  if (!url) {
    console.error('Missing ICS URL. Provide arg1 or env GCAL_ICS_URL/CALENDAR_ICS_URL.');
    process.exit(1);
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`ICS fetch failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const raw = await res.text();
  const allEvents = parseEvents(raw);

  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const upcoming = allEvents
    .filter((e) => {
      const start = e.start ? new Date(e.start) : null;
      const end = e.end ? new Date(e.end) : start;
      if (!start || !Number.isFinite(start.getTime())) return false;
      if (end && Number.isFinite(end.getTime()) && end < now) return false;
      return start <= horizon;
    })
    .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

  const payload = {
    generated_at: new Date().toISOString(),
    source: 'google_calendar_ics',
    window_days: windowDays,
    total_events_parsed: allEvents.length,
    upcoming_count: upcoming.length,
    events: upcoming,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${upcoming.length} upcoming events to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
