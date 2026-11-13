# Security Specification — FloodGuard AI

## 1. Data Invariants
1. **Strict Ownership & Identity Integrity**: Every created document across `/users`, `/users/{userId}/private`, `/sensor_readings`, `/forecasts`, `/warnings`, `/sos_requests`, and `/shelters` must have `ownerId == request.auth.uid` and require `request.auth.token.email_verified == true`.
2. **PII Isolation (Split Collection)**: User PII (`email`, `phone`) is strictly isolated inside `/users/{userId}/private/{docId}` where access is restricted exclusively to the document owner (`request.auth.uid == userId` or `existing().ownerId == request.auth.uid`) or verified `isAdmin()`.
3. **Zero Blanket List Queries**: All `allow list` rules explicitly enforce `resource.data.ownerId == request.auth.uid` without any `get()` or `exists()` calls inside `list`.
4. **Immutable & Server-Timestamped Fields**: `ownerId` and `createdAt` are immutable on all updates (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`). Creation enforces `incoming().createdAt == request.time`, and updates enforce `incoming().updatedAt == request.time`.
5. **Terminal State Locking**:
   - `sos_requests` in terminal status `'Completed'` cannot be updated unless `isAdmin()`.
   - `warnings` in terminal status `'Cancelled'` cannot be updated unless `isAdmin()`.
   - `forecasts` in terminal status `'Rejected'` cannot be updated unless `isAdmin()`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: Creating a `forecasts` document with an extra ghost key `isSuperAdmin: true` -> Rejected by `.keys().hasOnly(...)`.
2. **Identity Spoofing on Create**: Creating a `warnings` document where `ownerId` is set to another user's UID -> Rejected by `incoming().ownerId == request.auth.uid`.
3. **Unverified Email Spoof**: Attempting a write when `request.auth.token.email == 'sohelrana587129@gmail.com'` but `email_verified == false` -> Rejected by `isVerified()`.
4. **PII Lateral Read**: Authenticated user `user_B` attempting `get` on `/users/user_A/private/info` -> Rejected by `isOwner(userId) || isAdmin()`.
5. **Blanket Query Scraping**: Client executing an unfiltered `list` query on `/sos_requests` across all users -> Rejected by `existing().ownerId == request.auth.uid`.
6. **ID Poisoning**: Creating a document with a 1.5KB junk ID or special characters `/forecasts/bad$id!` -> Rejected by `isValidId(forecastId)`.
7. **Denial-of-Wallet Oversized String**: Sending a 10,000-character `aiSummary` on `/forecasts/{id}` -> Rejected by `data.aiSummary.size() <= 500`.
8. **Immutable Field Mutation**: Updating `createdAt` or `ownerId` on `/shelters/{id}` -> Rejected by immutability gates.
9. **Client Timestamp Forgery**: Creating or updating a record with a past or future `createdAt` / `updatedAt` timestamp -> Rejected by `request.time` equality check.
10. **Terminal State Bypass**: Updating a `sos_requests` document whose `existing().status == 'Completed'` back to `'Pending'` as a non-admin -> Rejected by Terminal State Lock.
11. **Value Poisoning on Update**: Updating `status` on `/forecasts/{id}` to `'HACKED'` (not in allowlist enum) -> Rejected by `isValidForecast(incoming())` wrapping the update block.
12. **Privilege Escalation on Admin Collection**: Non-admin user attempting to create or modify `/admins/{uid}` -> Rejected by `allow write: if false;`.
