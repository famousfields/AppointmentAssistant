# Appointment Assistant (Frontend)

This frontend is a React + Vite SPA that pairs with the backend API to track appointments, clients, comments, and payments. It is designed for quick job capture and fast day-to-day scheduling work.

## App flow overview

The frontend is built around one continuous workflow:

1. A user lands on `/` and either creates an account or logs in.
2. After login, the app stores a short-lived access token in `sessionStorage` and relies on a backend-managed `HttpOnly` refresh cookie to keep the session alive.
3. The user is routed into the authenticated shell and lands on `/calendar`.
4. From the sidebar, the user can move between scheduling, job creation, jobs, clients, and billing without leaving the main app shell.
5. All protected requests run through the shared authenticated fetch flow, which retries once after calling `/auth/refresh` if an access token expires.
6. Billing lives inside the same app flow, so plan limits, upgrade actions, and Stripe redirects all happen from `/billing`.

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
- `src/BillingPage.jsx` - plan usage, upgrades, and Stripe handoff.
- `src/api.js` - API base URL plus access-token payload/expiry helpers.
- `src/apiContext.js` - shared authenticated fetch wrapper for the app.

## Getting started

```bash
cd Frontend
npm install
npm run dev
```

The Vite dev server usually runs on `http://localhost:5173`, but it may fall back to `5174` if that port is busy. Make sure the backend CORS configuration allows whichever frontend origin you are using.

For Netlify deployments, set `VITE_API_BASE` to your Railway backend URL, for example:

```bash
VITE_API_BASE=https://appointmentassistant-production.up.railway.app
```

The backend should allow the Netlify site origin in `CORS_ORIGINS`, and Railway should set `APP_BASE_URL` to the Netlify app URL so Stripe Checkout and the billing portal can return users to `/billing`.

## Available scripts

```bash
npm run dev
npm run build
npm run lint
npm test
```

## Route map

- `/` - login and account creation screen.
- `/calendar` - default authenticated landing page with day, week, month, and year calendar views.
- `/jobs/new` - new appointment capture flow.
- `/jobs` - jobs dashboard for status, payment, notes, and edits.
- `/clients` - client search, client history, and per-job editing.
- `/billing` - plan usage, upgrade path, and Stripe portal/checkout redirects.

## Full user flow

### 1. Authentication

- A new user creates an account from the create-account tab on `/`.
- An existing user logs in with email or username plus password.
- Successful login returns an access token and user payload, while the backend also sets a refresh cookie.
- The frontend stores the access token in `sessionStorage` and navigates the user to `/calendar`.
- If the page reloads, the stored session is restored and the app can refresh the token with `/auth/refresh` before expiry.
- Logging out clears the local session and calls `/auth/logout` to revoke the refresh token on the backend.

### 2. Authenticated shell

- After login, the app switches from the public auth page to the main sidebar layout.
- The sidebar gives direct navigation to Calendar, New Job, View Jobs, Clients, and Billing.
- `ApiContext` provides the authenticated fetch wrapper, subscription state, and billing actions to the rest of the app.
- If an API call returns `401`, the app attempts one refresh cycle and retries the request automatically.

### 3. New job creation

- The user opens `/jobs/new` to create an appointment.
- The form validates name, phone, address, job type, date, start time, optional payment, and comments before submission.
- Draft content is saved in `localStorage` per user, so refreshes or accidental navigation do not wipe unfinished work.
- Existing jobs are loaded to power client suggestions, making repeat-customer entry faster.
- Job types are loaded through the job-type manager, with custom job-type management unlocked on paid plans.
- On success, the app clears the draft, refreshes subscription/job-type state, shows success feedback, and redirects to `/jobs`.

### 4. Jobs dashboard

- `/jobs` loads the authenticated job list from the backend.
- Users can change job status inline without leaving the page.
- Payment values can be edited inline and saved directly from the dashboard.
- Comments open in a modal so notes can be reviewed and updated without losing table context.
- Full job edits and deletions are handled from the job editor modal.
- Dashboard totals are derived from the loaded job list, so the screen acts as both an operational board and a lightweight revenue snapshot.

### 5. Clients workflow

- `/clients` groups the job history into client-centered records.
- Users can search clients by name, phone, or address.
- Selecting a client reveals their related jobs and total recorded payments.
- Jobs can still be edited or deleted from this screen, so the client page doubles as a relationship/history view and a maintenance surface.

### 6. Calendar workflow

- `/calendar` is the main scheduling surface after login.
- The page supports day, week, month, and year views.
- Jobs are placed into time-aware layouts and styled from the job-type palette.
- Clicking into jobs opens more detail and editing actions without requiring the user to hunt through the jobs list.
- This makes the calendar the fastest place to understand workload and timing at a glance.

### 7. Billing and subscriptions

- `/billing` shows the current plan, monthly usage, reset date, and available plan catalog.
- Free-plan limits are surfaced in the UI so the user understands when creation limits are close or already reached.
- If Stripe is fully configured, choosing a paid plan redirects to Stripe Checkout.
- If a paid customer needs to manage an existing subscription, the app can redirect them to the Stripe customer portal.
- If Stripe is not fully configured, the UI falls back to the manual preview mode exposed by the backend.

## Data and state flow

- `sessionStorage` holds the short-lived access token and user metadata for the current browser session.
- The refresh token stays in a backend-managed `HttpOnly` cookie and is never directly read by frontend code.
- `localStorage` stores the in-progress job draft per user.
- Subscription data is loaded once the user is authenticated and reused across pages so plan limits and entitlements stay consistent.
- Job types are fetched as app data, not hardcoded UI state, which lets the backend enforce plan-based entitlements.

## Main flows to verify
1. Create an account and sign in on `/`.
2. Refresh the page and confirm the session restores correctly.
3. Create a new job on `/jobs/new` and verify the draft clears after success.
4. Update status, payment, comments, and full job details on `/jobs`.
5. Search for a client and inspect related job history on `/clients`.
6. Open the scheduler on `/calendar` and switch between day, week, month, and year views.
7. Visit `/billing` and confirm plan usage, upgrade actions, and Stripe redirects behave correctly for the current environment.
