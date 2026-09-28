# Task API

## Description

A small Task Manager REST API with an in-memory store. Data resets whenever the process restarts. The project was built from scratch from the assignment specification (no starter code was provided).

## Tech Stack

- Node.js (18+), Express 5
- Jest + Supertest (tests)
- In-memory `Map` store, UUIDs via Node's built-in `crypto.randomUUID`

## Installation

```bash
npm install
```

## Running the Application

```bash
npm start            # listens on PORT (default 3000)
```

## Running Tests

```bash
npm test
```

## Coverage

```bash
npm run coverage
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List tasks. Query: `status`, `page` (default 1), `limit` (default 10, max 100) |
| POST | `/tasks` | Create a task (201) |
| PUT | `/tasks/:id` | Partial-friendly update |
| DELETE | `/tasks/:id` | Delete; returns the deleted task |
| PATCH | `/tasks/:id/complete` | Mark done, set `completedAt` (idempotent) |
| PATCH | `/tasks/:id/assign` | Assign / reassign a task |
| GET | `/tasks/stats` | Counts by status plus `overdue` |

List response shape: `{ "tasks": [], "page": 1, "limit": 10, "total": 0, "totalPages": 0 }`.

Errors are always `{ "error": "message" }` with 400 (validation), 404 (not found) or 500 (unexpected; no stack trace exposed).

## Example Requests

macOS / Linux (curl):

```bash
curl -X POST localhost:3000/tasks -H 'Content-Type: application/json' \
  -d '{"title":"Learn Node.js","description":"Study Express","priority":"high","dueDate":"2026-10-01T10:00:00.000Z"}'

curl "localhost:3000/tasks?status=todo&page=1&limit=10"

curl -X PUT localhost:3000/tasks/<id> -H 'Content-Type: application/json' -d '{"status":"in_progress"}'

curl -X PATCH localhost:3000/tasks/<id>/complete

curl -X PATCH localhost:3000/tasks/<id>/assign -H 'Content-Type: application/json' -d '{"assignee":"Harsh"}'

curl localhost:3000/tasks/stats
```

Windows (PowerShell):

```powershell
$t = Invoke-RestMethod -Method Post -Uri http://localhost:3000/tasks -ContentType "application/json" -Body '{"title":"Learn Node.js"}'
Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/tasks/$($t.id)/assign" -ContentType "application/json" -Body '{"assignee":"Harsh"}'
Invoke-RestMethod http://localhost:3000/tasks/stats
```

## Validation

- `title`: required, non-empty string, trimmed (whitespace-only rejected)
- `description`: string (default `""`)
- `status`: `todo | in_progress | done` (default `todo`)
- `priority`: `low | medium | high` (default `medium`)
- `dueDate`: `null` or a strict ISO 8601 string (`YYYY-MM-DD` or full date-time). Loose formats like `"1"`, `"2026"`, `"Oct 1"` and impossible dates like Feb 31 are rejected. Stored normalized via `toISOString()`.
- `page`: positive integer; `limit`: integer 1-100. Values like `1abc` or `5.5` are rejected.
- Changing status to `done` sets `completedAt`; changing it away from `done` clears it. `id`, `createdAt` and `completedAt` cannot be set by clients.
- Overdue = has `dueDate` in the past and status is not `done`.

## Assignment Feature

`PATCH /tasks/:id/assign` with `{ "assignee": "Harsh" }`.

- `assignee` must be a non-empty string; surrounding whitespace is trimmed.
- Missing, empty, whitespace-only or non-string values -> 400. Unknown task -> 404.
- **Reassignment is allowed**: assigning an already-assigned task replaces the assignee (Rahul -> Harsh). Rationale: tasks change hands in practice, and rejecting with 409 would force an extra unassign step for no benefit.
- `assignee` is only present on a task once it has been assigned (it is not part of the base model).

## Project Structure

```
task-api/
├── src/
│   ├── app.js                  # Express app, error handling
│   ├── server.js               # Entry point
│   ├── routes/taskRoutes.js
│   ├── services/taskService.js # Business logic
│   ├── store/taskStore.js      # In-memory Map (with reset for tests)
│   └── utils/validation.js     # Validators and error classes
├── tests/
│   ├── taskService.test.js
│   └── tasks.integration.test.js
├── BUG_REPORT.md
├── SUBMISSION.md
└── README.md
```
