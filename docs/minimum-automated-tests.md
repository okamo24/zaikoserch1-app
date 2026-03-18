# Minimum Automated Tests

## Release blockers

- [x] Google OAuth callback rejects non-allowlisted users and signs them out
- [x] Deleted users are blocked after Google callback login
- [x] Pending users are blocked after Google callback login
- [x] Search API rejects unexpected input with a guide response
- [x] Search API returns `not_found`, `single`, `multiple`, and `too_many` correctly
- [x] `user` role cannot access admin-only APIs such as CSV import
- [x] Member API prevents self-demotion from admin
- [x] Member API prevents self-deletion
- [x] Member API prevents deleting the last active admin
- [x] CSV import failure rolls back inserted inventory rows and marks import log as failed
- [x] CSV import success writes audit logs and revalidates affected pages
- [x] Protected pages redirect unauthenticated users to `/login`
- [x] Deleted users and pending users are blocked from protected pages after session recovery
- [x] Non-admin users are redirected away from `/admin`
- [x] Item detail page writes an access log and renders core inventory fields

## Should add next

## Nice to have

- [x] Mobile UI smoke test for chat, search result cards, and menu
- [ ] End-to-end login flow with a staging Google account
- [x] Regression test for audit log redaction and retention behavior
