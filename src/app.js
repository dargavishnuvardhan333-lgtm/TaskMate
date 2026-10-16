const path = require("node:path");
const bcrypt = require("bcryptjs");
const MongoStore = require("connect-mongo");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const session = require("express-session");
const helmet = require("helmet");
const mongoose = require("mongoose");
const User = require("./models/User");
const { Task, priorities, categories, statuses } = require("./models/Task");
const { setTaskStatus, undoTaskCompletion } = require("./task-status");
const { isValidEmail, validateTaskFields } = require("./validation");

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const legacyPriorities = new Set(priorities);
const legacyCategories = new Set(categories);

function sendError(response, status, message) {
  return response.status(status).json({ error: message });
}

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

function publicTask(task) {
  return {
    id: String(task._id),
    title: task.title,
    description: task.description,
    priority: task.priority,
    category: task.category,
    dueDate: task.dueDate,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function createApp({ mongoUrl, sessionSecret, secureCookies = false, trustProxy = false }) {
  const app = express();
  if (trustProxy) app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));
  app.use(express.json({ limit: "2mb", type: "application/json" }));
  app.use(
    session({
      name: "taskmate.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl,
        collectionName: "sessions",
        ttl: SESSION_MAX_AGE / 1000,
        autoRemove: "native"
      }),
      cookie: {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE
      }
    })
  );

  app.use((request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.get("origin");
    if (!origin) return sendError(response, 403, "A same-origin request is required.");

    try {
      const requestOrigin = new URL(origin).origin;
      const expectedOrigin = `${request.protocol}://${request.get("host")}`;
      if (requestOrigin !== expectedOrigin) {
        return sendError(response, 403, "Cross-origin requests are not allowed.");
      }
    } catch {
      return sendError(response, 403, "A valid request origin is required.");
    }
    return next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Try again later." }
  });

  app.get("/api/health", (request, response) => {
    const connected = mongoose.connection.readyState === 1;
    response.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "unavailable",
      database: connected ? "connected" : "disconnected"
    });
  });

  app.post("/api/auth/register", authLimiter, async (request, response, next) => {
    try {
      const { name, email, password } = request.body || {};
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
        return sendError(response, 400, "Name must be between 2 and 80 characters.");
      }
      if (!isValidEmail(email)) return sendError(response, 400, "Enter a valid email address.");
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        return sendError(response, 400, "Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.exists({ email: normalizedEmail });
      if (existingUser) return sendError(response, 409, "An account with that email already exists.");

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });
      await regenerateSession(request);
      request.session.userId = String(user._id);
      return response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return sendError(response, 409, "An account with that email already exists.");
      return next(error);
    }
  });

  app.post("/api/auth/login", authLimiter, async (request, response, next) => {
    try {
      const { email, password } = request.body || {};
      if (
        !isValidEmail(email) ||
        typeof password !== "string" ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        return sendError(response, 400, "Enter a valid email and password.");
      }

      const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
      const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) return sendError(response, 401, "Email or password is incorrect.");

      await regenerateSession(request);
      request.session.userId = String(user._id);
      return response.json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/auth/me", async (request, response, next) => {
    try {
      if (!request.session.userId) return response.json({ user: null });
      const user = await User.findById(request.session.userId);
      if (!user) {
        request.session.destroy(() => {});
        return response.json({ user: null });
      }
      return response.json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie("taskmate.sid", {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "strict"
      });
      return response.status(204).end();
    });
  });

  function requireAuthentication(request, response, next) {
    if (!request.session.userId || !mongoose.isValidObjectId(request.session.userId)) {
      return sendError(response, 401, "Please log in to continue.");
    }
    return next();
  }

  app.use("/api/tasks", requireAuthentication);

  app.get("/api/tasks", async (request, response, next) => {
    try {
      const filter = { userId: request.session.userId };
      const { status, priority, category } = request.query;
      if (status !== undefined) {
        if (!statuses.includes(status)) return sendError(response, 400, "Choose a valid status filter.");
        filter.status = status;
      }
      if (priority !== undefined) {
        if (!priorities.includes(priority)) return sendError(response, 400, "Choose a valid priority filter.");
        filter.priority = priority;
      }
      if (category !== undefined) {
        if (!categories.includes(category)) return sendError(response, 400, "Choose a valid category filter.");
        filter.category = category;
      }

      const userId = request.session.userId;
      const [tasks, total, completed, pending] = await Promise.all([
        Task.find(filter).sort({ createdAt: -1 }),
        Task.countDocuments({ userId }),
        Task.countDocuments({ userId, status: "completed" }),
        Task.countDocuments({ userId, status: { $ne: "completed" } })
      ]);
      return response.json({
        tasks: tasks.map(publicTask),
        stats: {
          total,
          completed,
          pending,
          completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100)
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/tasks", async (request, response, next) => {
    try {
      const result = validateTaskFields(request.body);
      if (result.error) return sendError(response, 400, result.error);
      const fields = result.fields;
      const task = await Task.create({
        ...fields,
        userId: request.session.userId,
        statusBeforeCompletion: fields.status === "completed" ? "pending" : null
      });
      return response.status(201).json({ task: publicTask(task) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/tasks/import-local", async (request, response, next) => {
    try {
      const importedTasks = request.body?.tasks;
      if (!Array.isArray(importedTasks) || importedTasks.length > 500) {
        return sendError(response, 400, "Legacy task import must contain no more than 500 tasks.");
      }

      const documents = [];
      for (const legacyTask of importedTasks) {
        const title = legacyTask?.title ?? legacyTask?.name;
        const completed = legacyTask?.completed === true || legacyTask?.status === "completed";
        const input = {
          title,
          description: typeof legacyTask?.description === "string" ? legacyTask.description : "",
          priority: legacyPriorities.has(legacyTask?.priority) ? legacyTask.priority : "Medium",
          category: legacyCategories.has(legacyTask?.category) ? legacyTask.category : "Personal",
          dueDate: typeof legacyTask?.dueDate === "string" ? legacyTask.dueDate : "",
          status: completed ? "completed" : statuses.includes(legacyTask?.status) ? legacyTask.status : "pending"
        };
        const result = validateTaskFields(input);
        if (result.error) return sendError(response, 400, `Legacy task import failed: ${result.error}`);
        documents.push({
          ...result.fields,
          userId: request.session.userId,
          statusBeforeCompletion: result.fields.status === "completed" ? "pending" : null
        });
      }

      if (documents.length > 0) await Task.insertMany(documents);
      return response.status(201).json({ imported: documents.length });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/tasks/:id", async (request, response, next) => {
    try {
      if (!mongoose.isValidObjectId(request.params.id)) return sendError(response, 400, "Invalid task ID.");
      const result = validateTaskFields(request.body, { partial: true });
      if (result.error) return sendError(response, 400, result.error);

      const task = await Task.findOne({ _id: request.params.id, userId: request.session.userId });
      if (!task) return sendError(response, 404, "Task not found.");

      const { status, ...taskFields } = result.fields;
      Object.assign(task, taskFields);
      if (status !== undefined) setTaskStatus(task, status);
      await task.save();
      return response.json({ task: publicTask(task) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/tasks/:id/undo", async (request, response, next) => {
    try {
      if (!mongoose.isValidObjectId(request.params.id)) return sendError(response, 400, "Invalid task ID.");
      const task = await Task.findOne({ _id: request.params.id, userId: request.session.userId });
      if (!task) return sendError(response, 404, "Task not found.");
      const wasCompleted = task.status === "completed";
      undoTaskCompletion(task);
      if (wasCompleted) await task.save();
      return response.json({ task: publicTask(task) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/tasks/:id", async (request, response, next) => {
    try {
      if (!mongoose.isValidObjectId(request.params.id)) return sendError(response, 400, "Invalid task ID.");
      const result = await Task.deleteOne({ _id: request.params.id, userId: request.session.userId });
      if (result.deletedCount === 0) return sendError(response, 404, "Task not found.");
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/tasks", async (request, response, next) => {
    try {
      const result = await Task.deleteMany({ userId: request.session.userId });
      return response.json({ deleted: result.deletedCount });
    } catch (error) {
      return next(error);
    }
  });

  const publicDirectory = path.join(__dirname, "..", "public");
  app.get("/dashboard", (request, response, next) => {
    response.sendFile(path.join(publicDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
  app.use(express.static(publicDirectory, { index: "index.html" }));
  app.use((request, response) => sendError(response, 404, "Not found."));
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      return sendError(response, 400, "Request body must be valid JSON.");
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      return sendError(response, 400, "The submitted data is invalid.");
    }
    console.error("Request failed.", error);
    if (mongoose.connection.readyState !== 1) {
      return sendError(response, 503, "TaskMate is temporarily unavailable because its database is disconnected.");
    }
    return sendError(response, 500, "An unexpected server error occurred.");
  });

  return app;
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

module.exports = { createApp };
