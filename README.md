# Appointment Assistant

Appointment Assistant is a two‑tier toolkit for capturing service jobs, tracking clients, and reviewing payment history. It combines a Node/Express + MySQL backend with a React + Vite frontend to give field teams a polished workspace with login, job capture, job / client dashboards, and a calendar view.

## Architecture overview
- **Backend (`Backend/`)** – Express server with MySQL connector, user management, job & comment APIs, and sprinted payment support.
- **Frontend (`Frontend/`)** – React 19 + Vite SPA that renders the app shell, job form, jobs & clients tables, and a monthly calendar. Data is fetched from `http://localhost:5000/jobs`.
- **Shared schemas** – `Schema.json` documents the `users`, `clients`, and `jobs` contracts so the UI and API stay aligned.

## Backend highlights
- Uses `mysql2` to talk to the `Jobs` database defined in `Backend/db.js` (host `localhost`, user `root`). Tables include `users`, `Clients`, and `Jobs`.
- Routes include:
  - `POST /users` – creates an account with hashed password.
  - `POST /auth/login` – validates credentials and returns `user`.
  - `POST /jobs` – validates client info, upserts the client, and inserts a job record.
  - `GET /jobs` – lists jobs joined with client details, filtered by `userId`.
  - `PATCH /jobs/:id/comments` – saves comments.
  - `PUT /jobs/:id` – updates status and/or payment (validates enums/numbers).
- Adds `payment` column automatically via `ensurePaymentsColumn` helper before listening.

## Frontend highlights
- `App.jsx` handles routing (`/`, `/jobs`, `/jobs/new`, `/clients`, `/calendar`), sidebar navigation, and persistent `currentUser` using `localStorage`.
- `JobForm.jsx` validates input, caches drafts, supports payments, and posts to `/jobs`.
- `jobs.jsx` renders the jobs table with inline status/payment editors, comments modal, and totals.
- `clients.jsx` groups jobs by client, adds search, and shows job histories.
- `CalendarPage.jsx` renders a month grid, highlights today, and shows job details on click.
- Styling lives in `App.css`, which defines the dark shell, cards, tables, and calendar grid.

## Setup & running

1. **Backend**
   ```bash
   cd Backend
   npm install
   npm run start
   ```
   The server starts on `http://localhost:5000`. Ensure MySQL is running and credentials in `db.js` match.

2. **Frontend**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```
   Visit `http://localhost:5173` and log in before accessing `/jobs`, `/clients`, or `/calendar`.

Run both servers side-by-side so the React app can talk to the API.

## Workflow checklist
1. Log in or create a user on `/`.
2. Capture a job via `/jobs/new`; future and past dates are accepted, and the form auto-saves drafts.
3. Manage appointments at `/jobs`, including submitting payments (Enter or blur saves) and editing comments.
4. Inspect clients on `/clients`, filtering via name/phone/address and checking total payments per client.
5. Navigate the `/calendar` view to see jobs plotted by date and tap a job for details.

## Next steps
1. Add token-based auth + refresh logic so sessions survive server restarts.
2. Seed fixtures or migrations for the MySQL schema instead of relying on ad-hoc tables.
3. Expand test coverage (backend integration tests + frontend view tests) before production.

## Public launch checklist (recommended before hosting)
1. **Secure auth/session model**
   - Replace client-only session persistence (`localStorage`) with signed access/refresh tokens.
   - Add protected middleware on every data route and derive `userId` from the auth token (not request body/query).
2. **Tighten API security**
   - Restrict CORS to your frontend domain(s) only.
   - Add API rate limiting, helmet headers, and request logging with redaction.
3. **Production-ready data management**
   - Move schema changes from runtime (`ALTER TABLE`) to versioned migrations.
   - Add daily DB backups + restore drills and clear retention rules.
4. **Reliability and observability**
   - Add health/readiness endpoints and centralized structured logs.
   - Add error monitoring/alerting (e.g., Sentry or equivalent) for both frontend and backend.
5. **Quality gates**
   - Add CI checks (lint + unit/integration tests) that run on pull requests.
   - Add smoke tests for login, create job, edit status/payment, and calendar rendering.
6. **User-facing polish**
   - Improve empty states, loading/error states, and mobile responsiveness.
   - Add a password reset flow and basic account settings before inviting public users.
