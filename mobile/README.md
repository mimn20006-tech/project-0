# Hand Aura Mobile (Android / iOS)

This folder wraps the existing `front/` store using Capacitor so you can build native apps for Android and iOS from the same codebase.

## 1) Install dependencies

```bash
cd mobile
npm install
```

## 2) Add native platforms (first time only)

```bash
npx cap add android
npx cap add ios
```

## 3) Sync latest web code

```bash
npx cap sync
```

## 4) Open native projects

```bash
npx cap open android
npx cap open ios
```

## Notes

- API selection is automatic in `front/main.js`:
  - local backend first when opening from localhost
  - deployed backend fallback otherwise
- PWA files are also enabled in `front/` (`manifest.webmanifest` + `sw.js`) for installable web app behavior.
