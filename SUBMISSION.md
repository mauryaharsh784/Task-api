# Submission Notes

The project was created from scratch from the assignment specification; no starter code existed.

## What I Would Test Next

- Concurrency: simultaneous updates/deletes on the same task (the Map is safe in a single Node process, but a real DB needs locking or optimistic concurrency).
- Load testing: pagination and stats over tens of thousands of tasks (stats and filtering are O(n) per request).
- Malformed requests: wrong Content-Type, oversized bodies, deeply nested JSON, unusual Unicode in titles.
- Security: injection-style payloads, header abuse, and body size limits.
- Authentication/authorization once users exist.
- Database integration: behavior parity with a real store.
- Timezone edge cases: date-only `dueDate` values are treated as UTC midnight, and "overdue" at day boundaries.

## What Surprised Me

- `new Date()` accepts a lot of junk: `"1"` parses as a valid date, and `2026-02-31` silently rolls into March. A bare `!isNaN(Date)` check is not date validation.
- `parseInt("1abc")` returns `1`, so query params need an explicit format check.
- Express 5 handles errors thrown synchronously in route handlers without extra wrappers, which kept the routes very small.

## Questions Before Production

- Authentication: how are callers identified?
- Authorization and task ownership: who may edit, delete or reassign a task? Can anyone be an assignee, or only known users?
- Persistence: which database, and what are the retention and migration needs?
- Pagination limits: is a max of 100 right? Would cursor pagination be better? What sort order is expected (currently insertion order)?
- Timezones: should date-only due dates be interpreted in the user's timezone rather than UTC?
- API rate limiting and abuse protection.
- Logging/monitoring: structured logs, request IDs, metrics and alerting.

## Bug Found

The first implementation validated `dueDate` with `!isNaN(new Date(x))` and parsed `page`/`limit` with `parseInt`. Non-ISO strings such as `"1"`, `"2026"`, `"Oct 1"` were accepted as due dates, and `page=1abc` / `limit=5.5` were silently truncated. Details are in `BUG_REPORT.md`. It was found via failing tests I wrote, not in provided code.

## Bug Fixed

Strict ISO 8601 regex plus a calendar round-trip check (catches Feb 31) for `dueDate`, and a `/^\d+$/` check for `page` and `limit`. Regression tests were added in both the unit and integration suites. I fixed both defects (the assignment asked for one meaningful fix) because they share a root cause and the tests for both were failing.

## New Feature

`PATCH /tasks/:id/assign` with body `{ "assignee": "Harsh" }`. The assignee is trimmed and stored on the task and the updated task is returned. Missing, empty, whitespace-only or non-string assignee -> 400; unknown task -> 404. Reassignment is allowed (Rahul -> Harsh replaces the value). This is a deliberate decision, documented in the README.
