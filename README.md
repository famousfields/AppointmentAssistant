# Appointment Assistant

Appointment Assistant is a two-tier toolkit for capturing service jobs, tracking clients, and reviewing payment history. It combines a Node/Express + MySQL backend with a React + Vite frontend to give field teams a polished workspace with login, job capture, job/client dashboards, and a calendar view.

## Architecture overview
- **Backend (`Backend/`)** - Express server with MySQL connectivity, user management, job/comment APIs, signed access tokens, and cookie-based refresh token rotation.
- **Frontend (`Frontend/`)** - React 19 + Vite SPA that renders the app shell, job form, jobs/clients tables, and a monthly calendar.
- **Shared schemas** - `Schema.json` documents the `users`, `clients`, and `jobs` contracts so the UI and API stay aligned.

## Backend highlights
- Uses `mysql2` to talk to the `Jobs` database configured in `Backend/db.js`.
- Runs `Backend/migrations` before the server starts so the required tables exist with the expected columns.
- Routes include:
  - `POST /users` - creates an account with a hashed password.
  - `POST /auth/login` - validates credentials, returns an access token, and sets an `HttpOnly` refresh-token cookie.
  - `POST /auth/refresh` - rotates the refresh-token cookie and returns a new access token.
  - `POST /auth/logout` - revokes the stored refresh token and clears the cookie.
  - `POST /jobs` - validates client info, upserts the client, and inserts a job record.
  - `GET /jobs` - lists jobs joined with client details, filtered by the authenticated user.
  - `PATCH /jobs/:id/comments` - saves comments.
  - `PUT /jobs/:id` - updates status and/or payment.

## Frontend highlights
- `App.jsx` handles routing (`/`, `/jobs`, `/jobs/new`, `/clients`, `/calendar`), sidebar navigation, access-token refresh, and session persistence using `sessionStorage`.
- `LoginPage.jsx` signs users in against `/auth/login` and relies on the backend-managed refresh cookie for session continuation.
- `JobForm.jsx` validates input, caches drafts locally, supports payments, and posts to `/jobs`.
- `jobs.jsx` renders the jobs table with inline status/payment editors, a comments modal, and totals.
- `clients.jsx` groups jobs by client, adds search, and shows job histories.
- `CalendarPage.jsx` renders a month grid, highlights today, and shows job details on click.
- `ApiContext` centralizes authenticated requests, sends cookies with API calls, retries after hitting `/auth/refresh`, and keeps the UI aligned with the latest access token.

## Setup and running

1. **Backend**
   ```bash
   cd Backend
   cp .env.example .env
   npm install
   npm run migrate
   npm run start
   ```
   Ensure MySQL is running and `.env` includes valid DB credentials plus `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`.

2. **Frontend**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```
   The frontend expects the backend at `http://localhost:5000`. If Vite starts on `5174` instead of `5173`, include that origin in `CORS_ORIGINS`.

## Workflow checklist
1. Create an account or sign in on `/`.
2. Capture a job on `/jobs/new`, including optional payment and comments.
3. Review appointments on `/jobs`, then update status, payment, and notes.
4. Browse `/clients` to search customer records and compare payment totals.
5. Visit `/calendar` to view jobs by date and open quick detail modals.

## Current quality gates
- Backend: `npm run check`, `npm test`
- Frontend: `npm run lint`, `npm test`

## Next steps
1. Add CI to run backend checks/tests plus frontend lint/tests on every pull request.
2. Add integration coverage for login, refresh, logout, and job CRUD flows.
3. Add deployment-side safeguards such as HTTPS, backups, monitoring, and restore drills before public launch.
