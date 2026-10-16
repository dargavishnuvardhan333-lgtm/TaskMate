# TaskMate

TaskMate is a responsive task manager with an Express API, MongoDB persistence, and server-side session authentication. Sign in with the same account on different devices to access the same tasks.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB 6 or newer, running locally or available through MongoDB Atlas

## Configure MongoDB and run

1. Create a MongoDB database locally or in MongoDB Atlas. For Atlas, create a cluster, create a database user, and add your current IP address under **Network Access**.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` in `.env`. For Atlas, copy the connection string from the cluster's **Connect → Drivers** dialog, replace its username, password, and database placeholders, and URL-encode any special characters in the username or password. Never share or commit this URI.
4. Replace `SESSION_SECRET` with a unique random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. In the project folder, run `npm install`, then `npm start` (or `npm run dev` for Node's watch mode).
6. Open `http://localhost:3000` to register or sign in. After authentication, TaskMate opens the separate task dashboard at `http://localhost:3000/dashboard`. Sign in with the same account on other devices.
7. Run `npm test` to execute the built-in tests.

The frontend and backend are served by the same Express server. Do not open `public/index.html` as a `file://` URL; its API requests require the server origin.

If startup fails, check that `MONGODB_URI` is a complete MongoDB URI, that the Atlas database user credentials are correct, and that your IP is allowed in Atlas **Network Access**. Startup errors identify the failure type without printing your URI or password.

The server listens on all network interfaces so a phone or tablet on the same Wi-Fi can connect using `http://<computer-local-IP>:3000`. Keep the computer and server running. Windows Firewall may ask permission for Node.js on your private network. Do not expose the development HTTP server directly to the public internet; use HTTPS and a properly secured deployment for remote access outside your local network.

## Deploy to Render

This repository includes a `render.yaml` Blueprint for deploying the Express server, API, and static frontend as one Render web service. In Render, create a new **Blueprint** and connect this GitHub repository. Use the repository root as the service root directory, `npm ci` as the build command, `npm start` as the start command, and `/api/health` as the health-check path. There is no separate frontend build step: Express serves the files in `public/`.

Set `MONGODB_URI` in the Render service's **Environment** settings using the Atlas connection string; never commit it or send it in chat. The Blueprint sets `NODE_ENV=production`, enables trusted-proxy handling, and generates a unique `SESSION_SECRET`; Render supplies `PORT`. If `MONGODB_URI` is missing, the build can succeed but the service will exit during startup.

In MongoDB Atlas, create a database user with only the privileges TaskMate needs (normally `readWrite` on the TaskMate database). Under **Network Access**, allow only the current outbound ranges shown in this Render service's **Connect → Outbound** panel. Render ranges vary by region and service configuration, so do not rely on ranges copied from old notes. These ranges are shared by Render services; use Atlas private networking or a dedicated Render IP if your plan supports it and tighter network isolation is required. Avoid `0.0.0.0/0`.

After deployment, open the Render service URL. The login/register page is at `/` and the task dashboard is at `/dashboard`. Render's free web services may sleep when idle and take time to wake.

## GitHub Pages preview

GitHub Pages can publish the static frontend as a visual preview at `https://dargavishnuvardhan333-lgtm.github.io/TaskMate/`; it cannot run this Node.js server or connect directly to MongoDB. The preview explicitly disables login and task actions. To enable publication, open the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source, and push the Pages workflow to `main`. This does not replace the Render deployment.

## Data and security

- Tasks and sessions are stored in MongoDB. Each account can access only its own tasks.
- Passwords are hashed with bcrypt. Sessions use HTTP-only, same-site cookies stored in MongoDB.
- Legacy tasks saved under the `taskMateTasks` localStorage key are imported into the first signed-in account that has no server-side tasks, and removed from localStorage only after a successful import.
- If using MongoDB Atlas, create a database user and allow the computer running TaskMate to connect in Atlas Network Access. Do not share your database password or commit `.env`.
- Set `NODE_ENV=production` when deploying over HTTPS. If HTTPS is terminated by a trusted reverse proxy, set `TRUST_PROXY=true`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string for tasks and sessions |
| `SESSION_SECRET` | Yes | Unique random secret used to sign session cookies; at least 32 characters |
| `PORT` | No | HTTP port; defaults to `3000` |
| `NODE_ENV` | No | Set to `production` to enable secure cookies |
| `TRUST_PROXY` | No | Set to `true` only behind a trusted HTTPS reverse proxy |

## Task features

- Create, edit, complete, undo, and delete tasks
- Set priority, category, due date, and status
- Filter by status, priority, and category
- Track completion progress and clear all tasks
