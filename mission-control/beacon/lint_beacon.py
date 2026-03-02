#!/usr/bin/env python3
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RULES = json.loads((ROOT / 'lint-rules.json').read_text())


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def lint(text: str):
    t = norm(text)
    violations = []
    for rule_id, rule in RULES.items():
        for phrase in rule.get('bannedPhrases', []):
            if phrase in t:
                violations.append({
                    'rule': rule_id,
                    'phrase': phrase,
                    'description': rule.get('description', '')
                })
    return violations


def main():
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text() if Path(sys.argv[1]).exists() else " ".join(sys.argv[1:])
    else:
        text = sys.stdin.read()

    violations = lint(text)
    out = {
        'status': 'PASS' if not violations else 'REJECT',
        'violationCount': len(violations),
        'violations': violations
    }
    print(json.dumps(out, indent=2))
    sys.exit(0 if not violations else 2)


if __name__ == '__main__':
    main()
