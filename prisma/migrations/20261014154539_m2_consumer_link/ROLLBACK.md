# Rollback: M2 CustomerLink

Reverse SQL:
```sql
DROP TABLE "CustomerLink";
```
Then `prisma migrate resolve --rolled-back 20261014154539_m2_consumer_link`
and redeploy the previous release. No backfill ran, so no data loss.
Any links created after M6 would be lost — export them first if needed.
