# M13 rollback

```sql
ALTER TABLE "User" DROP COLUMN "totpBackupCodes";
ALTER TABLE "User" DROP COLUMN "totpEnabled";
ALTER TABLE "User" DROP COLUMN "totpSecret";
```

Effect: TOTP is disabled for all users (columns gone). Users who had 2FA
lose it silently - notify them to re-enroll. No other data is affected.
