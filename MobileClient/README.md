# Appointment Assistant Mobile

This is a new Expo-based mobile client for Appointment Assistant. It keeps the same dark visual system as the web frontend, but turns the desktop sidebar and wide tables into vertically stacked mobile cards and sections.

## Run it

```bash
cd MobileClient
npm install
set EXPO_PUBLIC_API_BASE=http://YOUR-LAN-IP:5000
npm run start
```

Use your machine's LAN IP instead of `localhost` when testing on a physical device.

## What it includes

- Login and account creation
- New job form with local draft persistence
- Jobs dashboard as stacked cards
- Clients view with search and per-client job history
- Calendar month agenda adapted for small screens
