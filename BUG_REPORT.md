# Bug Report

> Context: no starter code was provided, so these defects were found in the first version of the implementation I wrote from the specification. They were caught by the test suite I wrote for it, not in a pre-existing codebase.

## Bug 1 — Lenient `dueDate` parsing accepts non-ISO and impossible dates

### Expected Behavior

`dueDate` must be `null` or a valid ISO date. `"1"`, `"2026"`, `"Oct 1"` should be rejected with 400; `"2026-02-31T00:00:00Z"` (not a real day) should also be rejected.

### Actual Behavior

The first version validated with `!isNaN(new Date(value).getTime())`. V8's `Date` parser is very permissive, so `"1"`, `"2026"` and `"Oct 1"` returned 201 and were silently stored as some unrelated date (e.g. `"1"` becomes 2001-01-01). `"2026-02-31T00:00:00Z"` rolled over to March. That corrupts the data and skews the overdue statistic.

### How It Was Discovered

The integration test `rejects non-ISO dueDate` (inputs `'1'`, `'2026'`, `'Oct 1'`) failed with `Expected: 400, Received: 201` on the first `npm test` run. A follow-up regression test for `2026-02-31T00:00:00Z` failed after the first fix, showing that a format check alone is not enough.

### Fix

`src/utils/validation.js`: `isValidIsoDate()` now requires a strict ISO 8601 regex match and verifies the calendar day round-trips (no Feb 31 rollover) before accepting. Valid values are normalized with `toISOString()`. Regression tests: `tests/taskService.test.js` ("regression: lenient parsing") and `tests/tasks.integration.test.js` ("rejects non-ISO dueDate").

## Bug 2 — Lenient `page` / `limit` parsing (same root cause: permissive parsing)

### Expected Behavior

`page=1abc` and `limit=5.5` are not valid integers and should return 400.

### Actual Behavior

`parseInt("1abc", 10)` is `1` and `parseInt("5.5", 10)` is `5`, so both requests returned 200 and silently used a truncated value.

### How It Was Discovered

Failing tests on the first run: `invalid page: page=1abc` and `invalid limit: limit=5.5` (`Expected: 400, Received: 200`), plus matching unit tests.

### Fix

Query values must match `/^\d+$/` before being converted; `page >= 1` and `1 <= limit <= 100` are still enforced.

## Note

Both were found and fixed in this pass. Bug 1 is the primary, higher-impact one (it corrupts stored data); Bug 2 shares the same root cause and was fixed alongside it because its tests were failing too.
