# Task create/read API

The Add Task form saves to the existing MySQL `task_template` and `task_assignment` tables. A new task creates a reusable template and its assignment in one transaction. Selecting an existing template creates only an assignment. New assignments have `Assigned` status.

## Run locally

1. Configure `backend/.env` using `.env.example` with your MySQL connection details. Keep credentials in the backend only.
2. For a **new, empty database**, import `database/schema.sql`, followed optionally by `database/seed.sql` for demo employees, shifts and templates. Do not re-import these files into an already populated database. Existing databases matching the schema need no migration.
3. In `backend`, run `npm install` and `npm run dev`.
4. In another terminal, in `frontend`, run `npm install` and `npm run dev`.
5. Open the frontend URL and choose **Daily Task & Shift Handover → Task Assignments → Add Task**. Fill the required fields and save. Refresh the page to read the saved task from MySQL.

Vite proxies `/api` to `http://127.0.0.1:5000`. If you change the backend port, update `frontend/vite.config.js`. For a deployed frontend, configure `VITE_API_URL` with the backend API URL (including `/api`), and set backend `CLIENT_ORIGIN` to the frontend origin, or configure a same-origin `/api` reverse proxy.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/tasks` | `{ tasks: [...] }`, newest assigned date first |
| GET | `/api/tasks/:id` | `{ task: {...} }`, or 404 |
| GET | `/api/tasks/options` | Active employees, shifts and templates for dropdowns |
| POST | `/api/tasks` | Saves and returns `{ task: {...} }` with HTTP 201 |

Example POST body (replace employee ID with an existing active employee):

```json
{
  "title": "Check fridge temperature",
  "description": "Record the reading in the daily log.",
  "employee_id": 1,
  "shift_type_id": null,
  "assigned_date": "2026-09-12",
  "due_time": "09:00",
  "priority": "Medium"
}
```

Provide either an employee ID or a shift ID, not both. To reuse a template, send `template_id` instead of `title` and `description`. Due time is optional. Priority is `Low`, `Medium` or `High`. Validation errors return HTTP 400; unexpected failures return a generic HTTP 500 message.

This implementation covers task assignment creation and reading. The other section tabs retain their existing placeholders; update/delete and status changes are not included.

## Checks

Run `npm test` in `backend` for validation and API tests using an isolated in-memory model stub. Run `npm run lint` and `npm run build` in `frontend`.
