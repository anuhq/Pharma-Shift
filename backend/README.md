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

All four tabs support creation and reading. Assignments also support progress updates. General record editing and deletion are not included.

## Staff progress updates

In Task Assignments, click **Update Progress**, choose `Assigned`, `In Progress` or `Completed`, and optionally enter a progress/completion note (up to 255 characters). Save Progress updates MySQL and the row in the table. Refreshing the page retains the saved status and note. Cancel leaves the record unchanged.

`PATCH /api/tasks/:id/progress` accepts `{ "status": "In Progress", "completion_note": "Started checking shelves" }` and returns `{ task: {...} }`. It changes only status and completion note. Blank or omitted notes are stored as NULL. Invalid values return 400; missing tasks return 404. Repeating the same update succeeds.

The module uses the application's existing shared interface. Staff login, per-user permissions and an update history are not implemented.

## Five-day module checklist

| Day | Implemented work |
| --- | --- |
| 1 | Local frontend/backend setup and MySQL connection |
| 2 | Interfaces and popup forms for all four sections |
| 3 | Templates/checklists save to and load from MySQL; templates can link to checklists |
| 4 | Employee/shift assignments plus saved status and progress/completion notes |
| 5 | Basic handover creation and reading with employee, next shift, date, notes and priority |

## Templates, checklists and handovers

Each section has GET (list), GET `/:id` (detail) and POST (create) endpoints:

| Section | API path | Form fields |
| --- | --- | --- |
| Task Templates | `/api/tasks/templates` | `template_name`, optional `description` and `checklist_id`, `priority` |
| Checklists | `/api/tasks/checklists` | `checklist_name`, `shift_type_id`, `frequency` |
| Shift Handovers | `/api/tasks/handovers` | `employee_id`, `to_shift_type_id`, `handover_date`, `notes`, `priority` |

Lists return `{ records: [...] }`; detail and creation return `{ record: {...} }`. IDs must be positive integers referring to active records. Templates and checklists start as `Active`; handovers start as `Open`. Handover dates use `YYYY-MM-DD`.

Create a checklist first, then select it when creating a template to group that task under the checklist. Templates immediately become available in Add Task. Creating a checklist or template does not automatically assign work. Handovers record notes for the next shift.

## Checks

Run `npm test` in `backend` for validation and API tests using an isolated in-memory model stub. Run `npm run lint` and `npm run build` in `frontend`.

For an optional real MySQL section API check in PowerShell, run `$env:TASK_DB_TEST='1'; node --test test/taskSections.test.js; Remove-Item Env:TASK_DB_TEST` from `backend`. This requires the configured database with an active employee and shift. It creates temporary records and removes only those records afterward.
