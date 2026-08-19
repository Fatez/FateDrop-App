# Production-readiness checklist

## Required before public launch

- Replace flat JSON persistence with a hosted transactional database and migrations.
- Add user and retailer authentication, role-based tenant isolation and protected verification administration.
- Move monitoring to hosted scheduled workers with retry policy, observability and alerting.
- Configure EAS project identifiers, development builds, push receipt processing and expired-token cleanup.
- Put the API behind HTTPS, rate limiting, request logging, backups and a secrets manager.
- Add production geocoding/map provider only if needed; keep list/postcode fallback.
- Add retailer shipping, locations, opening hours and verified matching metadata.
- Add production analytics consent/retention controls and remove or rotate anonymous data according to policy.
- Conduct accessibility testing, device testing, dependency/security review and legal/privacy review.
- Add authenticated CSV import commit/rollback, retailer ownership checks and audit records.
- Resolve the Expo SDK dependency audit during a planned supported SDK migration. The current mobile production audit reports 23 moderate/high transitive advisories and proposes incompatible Expo 57 or React Native version changes; do not apply `npm audit fix --force` to SDK 54. Root monitoring and Express server production dependency audits currently report zero vulnerabilities.

## Current foundations only

FateFind background monitoring, reservation approval, CSV commit, external catalogue credentials, full retailer analytics, FateScore performance evidence and Passport rewards do not have production infrastructure. The app labels or hides these states rather than claiming they are live.
