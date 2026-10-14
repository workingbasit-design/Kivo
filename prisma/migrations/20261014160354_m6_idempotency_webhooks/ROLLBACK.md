# Rollback: M6 idempotency + webhooks

Reverse SQL:
```sql
DROP TABLE "IdempotencyKey";
DROP TABLE "WebhookEvent";
```
Then `prisma migrate resolve --rolled-back 20261014160354_m6_idempotency_webhooks`
and redeploy the previous release (Stripe webhook reverts to `StripeEvent`;
`StripeEvent` rows were never deleted — the backfill copied them). Data
note: in-flight idempotency keys are lost (clients retry with new keys);
webhook events recorded after M6 are lost — `StripeEvent` remains the
pre-M6 source of truth.
