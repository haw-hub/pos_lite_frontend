# Android deployment

1. Deploy the backend first and copy its Render URL.
2. Replace both placeholder URLs in `eas.json` with the real API URL ending in
   `/api`.
3. Sign in and link the project:

   `npx eas-cli@latest login`

   `npx eas-cli@latest init`

4. Build an installable Android APK:

   `npx eas-cli@latest build --platform android --profile preview`

Never put database credentials or JWT secrets in this frontend project.
