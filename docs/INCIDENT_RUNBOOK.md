# INCIDENT_RUNBOOK.md — Confidentiality incident response (Quebec Law 25)

Time targets: **contain within 24h** of discovery, **register entry within 72h**.

## 1. Detect

Signals: `ConfidentialityIncident` filed by staff, anomaly alerts (bulk export,
impossible logins), customer reports, vendor breach notices. Anyone who
suspects an incident files a report immediately — no triage by the reporter.

## 2. Contain (≤ 24h)

- Revoke the affected credentials/tokens/sessions (`Session`,
  `CustomerSession`, `CustomerAgentKey` — rotate, don't just delete).
- If a business account is compromised: force re-login for all its memberships.
- If a vendor is the vector: suspend the integration (Resend/WhatsApp/Stripe
  keys) and switch to the documented fallback.
- Preserve evidence: snapshot `AuditEvent`/`PiaAuditLog` rows for the window;
  do NOT delete attacker-created rows until recorded.

## 3. Assess

- What data types? (`dataTypes` JSON array on the incident: names, emails,
  financial, etc.)
- How many affected? (`affectedCount`, nullable until known.)
- Is there a **risk of serious harm** (identity theft, financial fraud,
  humiliation)? This decides notification duties.

## 4. Notify

- **CAQ (Commission d'accès à l'information):** notify when the incident
  presents a risk of serious harm. File via the CAQ breach register process.
- **Affected persons:** notify directly when there is a risk of serious harm —
  describe what happened, what data, what you're doing, what they can do.
- **Internal:** the business owner is notified for any incident scoped to
  their `businessId`; platform-level incidents (`businessId` null) go to the
  platform operator.

## 5. Record

Create/update the `ConfidentialityIncident` row:

| Field | Meaning |
|---|---|
| `businessId` | Scope; null = platform-level |
| `occurredAt` / `discoveredAt` | When it happened / when found |
| `summary` | Plain-language description |
| `dataTypes` | JSON array of data kinds involved |
| `affectedCount` | People affected (nullable until known) |
| `notifiedCommission` / `notifiedAffected` | Booleans — the Law 25 proof |
| `measuresTaken` | What was done |
| `status` | `OPEN` → `CONTAINED` → `CLOSED` (CHECK constraint) |
| `createdBy` | Who filed it |

This table IS the Law 25 confidentiality-incident register. Keep 6 years.

## 6. Review

- Post-incident review within 14 days of `CLOSED`: root cause, what detected
  it, what would detect it faster.
- Feed the review into the quarterly backup/restore + access-review cadence.
- If the incident involved a vendor, re-assess that vendor's row in
  `docs/DATA_MAP.md`.
