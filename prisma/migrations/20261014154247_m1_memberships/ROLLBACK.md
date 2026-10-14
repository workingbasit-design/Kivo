# Rollback: M1 memberships

Reverse SQL:
```sql
DROP TABLE "Membership";
```
Then `prisma migrate resolve --rolled-back 20261014154247_m1_memberships`
and redeploy the previous release (code that reads `User.role` /
`User.businessId` still works — those columns were never dropped).
Data note: Membership rows are derived from User rows; no data loss.
