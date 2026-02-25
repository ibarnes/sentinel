#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path('/home/ec2-user/.openclaw/workspace')
GEN = ROOT / 'scripts' / 'generate_deck.js'


def run(cmd):
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit((p.stderr or p.stdout or 'command failed').strip())
    return p.stdout.strip()


def main():
    ap = argparse.ArgumentParser(description='Generate presentation deck via Sentinel engine')
    ap.add_argument('--initiative-id', required=True)
    ap.add_argument('--buyer-id', default='')
    ap.add_argument('--deck-type', choices=['utc-internal', 'buyer-mandate-mirror'], default='utc-internal')
    ap.add_argument('--template-id', choices=['sovereign-memo', 'clean-minimal', 'blueprint'], default='sovereign-memo')
    ap.add_argument('--image-provider', choices=['placeholder', 'openai', 'gemini', 'grok'], default='placeholder')
    ap.add_argument('--copy-provider', choices=['local', 'claude'], default='local')
    ap.add_argument('--prompt', default='')
    ap.add_argument('--auto-generate', action='store_true')
    args = ap.parse_args()

    cmd = [
        'node', str(GEN),
        '--initiative_id', args.initiative_id,
        '--deck_type', args.deck_type,
        '--template_id', args.template_id,
        '--image_provider', args.image_provider,
        '--copy_provider', args.copy_provider,
        '--prompt', args.prompt,
        '--auto_generate', 'true' if args.auto_generate else 'false',
    ]
    if args.buyer_id:
        cmd.extend(['--buyer_id', args.buyer_id])

    out = run(cmd)
    data = json.loads(out)

    deck_rel = data.get('deck')
    if not deck_rel:
        raise SystemExit('generator returned no deck path')

    deck_abs = ROOT / deck_rel
    required = [
        deck_abs / 'deck.json',
        deck_abs / 'index.html',
        deck_abs / 'slides',
        deck_abs / 'assets',
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise SystemExit('missing outputs: ' + ', '.join(missing))

    print(json.dumps({
        'ok': True,
        'deck': deck_rel,
        'images': data.get('images', 'unknown')
    }, indent=2))


if __name__ == '__main__':
    main()
