require("dotenv").config();

const mongoose = require("mongoose");
const { createApp } = require("./src/app");

function readConfig(env = process.env) {
  const mongoUrl = env.MONGODB_URI?.trim();
  const sessionSecret = env.SESSION_SECRET;
  const port = Number(env.PORT || 3000);

  if (!mongoUrl) {
    throw new Error("Set MONGODB_URI in the environment before starting TaskMate (use .env for local development).");
  }
  if (!sessionSecret) {
    throw new Error("Set SESSION_SECRET in the environment before starting TaskMate (use .env for local development).");
  }
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/i.test(mongoUrl) || /[<>]/.test(mongoUrl)) {
    throw new Error("MONGODB_URI must be a valid MongoDB connection string with all placeholders replaced.");
  }
  if (!sessionSecret || sessionSecret.length < 32 || /^replace-with-/i.test(sessionSecret)) {
    throw new Error("SESSION_SECRET must be a unique random value of at least 32 characters.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return {
    mongoUrl,
    sessionSecret,
    port,
    secureCookies: env.NODE_ENV === "production",
    trustProxy: env.TRUST_PROXY === "true"
  };
}

async function startServer(config = readConfig()) {
  const { mongoUrl, sessionSecret, port, secureCookies, trustProxy } = config;

  try {
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });
  } catch (error) {
    const errorType = error?.name || "connection error";
    throw new Error(
      `Could not connect to MongoDB (${errorType}). Check MONGODB_URI, Atlas Network Access, and database-user credentials.`
    );
  }
  const app = createApp({
    mongoUrl,
    sessionSecret,
    secureCookies,
    trustProxy
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`TaskMate is running at http://localhost:${port}`);
      resolve(server);
    });
    server.once("error", reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("TaskMate failed to start.", error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { readConfig, startServer };
