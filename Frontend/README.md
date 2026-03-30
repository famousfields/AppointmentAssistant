# Appointment Assistant (Frontend)

This frontend is a React + Vite SPA that pairs with the backend API to track appointments, clients, comments, and payments. It is designed for quick job capture and fast day-to-day scheduling work.

## Key features
- Job capture form with live validation, draft caching, payment support, and comments.
- Jobs dashboard with inline status/payment edits and note management.
- Client explorer with searchable customer cards and per-client job history.
- Calendar view with month navigation and read-only job detail modals.
- Access-token refresh through `ApiContext`, with refresh handled by a backend-managed `HttpOnly` cookie.

## Stack overview
- React 19 + Vite
- React Router v7
- Vanilla CSS in `App.css`
- `sessionStorage` for the short-lived access token and UI session metadata

## Directory highlights
- `src/App.jsx` - app shell, routing, session restore, and refresh orchestration.
- `src/LoginPage.jsx` - login/create-account flow.
- `src/JobForm.jsx` - job creation form with local draft persistence.
- `src/jobs.jsx`, `src/clients.jsx`, `src/CalendarPage.jsx` - main authenticated views.
- `src/api.js` - API base URL plus access-token payload/expiry helpers.
- `src/apiContext.js` - shared authenticated fetch wrapper for the app.

## Getting started

```bash
cd Frontend
npm install
npm run dev
```

The Vite dev server usually runs on `http://localhost:5173`, but it may fall back to `5174` if that port is busy. Make sure the backend CORS configuration allows whichever frontend origin you are using.

## Available scripts

```bash
npm run dev
npm run build
npm run lint
npm test
```

## Main flows to verify
1. Create an account or sign in on `/`.
2. Refresh the page and confirm the session restores correctly.
3. Create a new job on `/jobs/new`.
4. Update status, payment, and comments on `/jobs`.
5. Review grouped history on `/clients`.
6. Open jobs from `/calendar`.
