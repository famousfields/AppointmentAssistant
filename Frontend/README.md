# Appointment Assistant (Frontend)

This frontend is a React + Vite SPA that pairs with the backend API to track appointments, clients, and payments. The workspace is optimized for teams that need a quick way to log jobs, revisit client history, and glance at a calendar of scheduled work.

## Key Features
- **Job capture form** with live validation, draft caching, payment support, and status tracking.
- **Jobs dashboard** that lists every appointment, allows inline status/payment edits, and keeps a running total of payments.
- **Client explorer** with searchable client cards and per-client job histories plus total spend.
- **Calendar view** that plots jobs on a month grid, highlights today, and shows details in a read-only modal.
- **Persistent sign-in** using `localStorage`, so the workspace stays logged in across refreshes.

## Stack overview
- **React 19 + Vite** – Fast dev loop with HMR, JSX, and modern hooks.
- **React Router v7** – Drives navigation between `/jobs`, `/jobs/new`, `/clients`, and `/calendar` inside the `app-shell`.
- **Vanilla CSS with design tokens** – Shared gradients, border-radius, and spacers live in `App.css`.
- **Browser storage helpers** – Job drafts and the current user are stored via `localStorage` helpers inside `JobForm.jsx` and `App.jsx` respectively.

## Directory highlights
- `src/App.jsx` – App shell, sidebar navigation, workspace overview header, and route definitions.
- `src/JobForm.jsx` – Job creation form with validation, `localStorage` draft syncing, and payment handling.
- `src/jobs.jsx`, `src/clients.jsx`, `src/CalendarPage.jsx` – Main workspace views with data fetching from `http://localhost:5000/jobs`.
- `src/App.css` – Shared styles for the shell, cards, tables, calendar grid, and buttons.

## Getting started

```bash
cd Frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default. The frontend expects the backend API on `http://localhost:5000`, so start the server in parallel and log in before navigating to protected pages.

## Testing the main flows
1. Create or log in to a user via the `/` login page.
2. Capture a new job under `/jobs/new`, including payment and comments; refresh to confirm the draft persists.
3. Review the jobs table; update status, edit payments (Enter or blur saves), and open the comments modal.
4. Browse `/clients` to search clients and compare payment totals per customer.
5. Visit `/calendar`, page through months, and tap a job to open the detail modal.

## Next steps
1. Wire real auth tokens so the app can talk to a hosted API securely.
2. Add unit/integration tests for core views and form validation.
3. Build mobile navigation tweaks and responsive calendar cell spacing if the workspace is used on phones.
