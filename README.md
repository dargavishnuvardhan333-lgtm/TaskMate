# TaskMate

TaskMate is a React task manager that stores tasks and demo preferences in this browser's LocalStorage. It has no backend or database.

## Run locally

```sh
npm install
npm run dev
```

## LocalStorage data

- `taskmate.tasks.v1` stores tasks as JSON.
- `taskmate.demoUserPreferences.v1` stores the demo display name as JSON.

To inspect the values in Chrome or Edge, open DevTools, select **Application → Local Storage**, then choose the TaskMate page's origin. The task list and demo preferences appear under their separate keys. LocalStorage is scoped to the browser and origin; clearing site data or using a different browser/device removes or does not share these values.

## Deploy on Render

The repository includes a `render.yaml` Blueprint for a static Render site. In Render, create a new **Blueprint** and connect the `feature/localstorage-app` branch of this repository. Render will run `npm ci && npm run build` and publish `dist/`. This app is frontend-only and does not require MongoDB or other backend services. After deployment, LocalStorage data stays in each visitor's browser and is not shared across devices.
