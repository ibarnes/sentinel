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
    hard_term_hits = []

    for rule_id, rule in RULES.items():
        for phrase in rule.get('bannedPhrases', []):
            if phrase in t:
                violations.append({
                    'rule': rule_id,
                    'phrase': phrase,
                    'description': rule.get('description', '')
                })

    req = RULES.get('ruleL2_requiredHardTerms', {})
    required = req.get('requiredPhrases', [])
    min_required = int(req.get('minRequiredMatches', 0))
    for phrase in required:
        if phrase in t:
            hard_term_hits.append(phrase)
    if len(hard_term_hits) < min_required:
        violations.append({
            'rule': 'ruleL2_requiredHardTerms',
            'phrase': ', '.join(required),
            'description': f"requires at least {min_required} hard-term matches; found {len(hard_term_hits)}"
        })

    return violations, hard_term_hits


def main():
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text() if Path(sys.argv[1]).exists() else " ".join(sys.argv[1:])
    else:
        text = sys.stdin.read()

    violations, hard_term_hits = lint(text)
    out = {
        'status': 'PASS' if not violations else 'REJECT',
        'violationCount': len(violations),
        'hardTermHits': hard_term_hits,
        'violations': violations
    }
    print(json.dumps(out, indent=2))
    sys.exit(0 if not violations else 2)


if __name__ == '__main__':
    main()
