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
