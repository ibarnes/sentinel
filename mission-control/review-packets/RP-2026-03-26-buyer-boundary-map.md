# RP — Buyer Boundary Map (Path Precision Layer)

Date: 2026-03-26T03:14:36.899Z

## New Internal Access Rule
- Boundary Coupling Rule: **no progress without conversion-node path**.
- External access (lane count) is necessary but insufficient; internal coupling to conversion node is mandatory.

## Boundary Map Snapshot
| Initiative | Primary Buyer | Conversion Node Role | Node Status | Path Precision | Boundary Loss Risk | Current Route |
|---|---|---|---|---:|---|---|
| INIT-001 | PIF | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-653305 | PIF | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-AI-OPT-A | FMF-NG | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-AI-OPT-B | DFC | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-AI-OPT-C | PIF | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-AI-OPT-D | AFC | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-NG-FIN-ENERGY-SPINE | FMF-NG | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-AP-AI-FACTORY-001 | GIC | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-2026-03-05-COMMODITY-CORRIDOR | TAFF | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-GRAVITY-001 | ADQ | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-653306 | AFC | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-2026-03-GLOBAL-AUTOMATED-LABOR-INFRASTRUCTURE | ADQ | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-2026-03-USVI-RECOVERY-CAPITAL-DEPLOYMENT | USVI-RECOVERY-AUTHORITY | Capital Deployment + Risk Acceptance Authority | unconfirmed | 75 | medium | entry_to_translation |
| INIT-2026-03-ANGOLA-AI-CORRIDOR | AWS | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |
| INIT-2026-03-ECOWAS-DIGITAL-SAFETY-INFRASTRUCTURE | TAFF | Capital Deployment + Risk Acceptance Authority (Digital Infrastructure) | unconfirmed | 75 | medium | entry_to_translation |

## Required Next Moves (24h)
1. Confirm named conversion node person (not just role) for each HIGH boundary-loss initiative.
2. Rewrite first-touch artifacts to explicitly require conversion-node participation.
3. Mark any initiative as blocked if route remains `entry_to_translation` after first engagement cycle.

## Schema Applied
- `conversion_node_role`
- `internal_path_map`
- `path_precision_score`
- `boundary_loss_risk`
- `internal_access_critical`
- `boundary_coupling_rule`
- `translation_load_test`
