const test = require("node:test");
const assert = require("node:assert/strict");
const { readConfig } = require("../server");

const validEnvironment = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/taskmate",
  SESSION_SECRET: "a".repeat(64)
};

test("loads MongoDB, session, port, and deployment settings from the environment", () => {
  assert.deepEqual(readConfig({
    ...validEnvironment,
    PORT: "3030",
    NODE_ENV: "production",
    TRUST_PROXY: "true"
  }), {
    mongoUrl: validEnvironment.MONGODB_URI,
    sessionSecret: validEnvironment.SESSION_SECRET,
    port: 3030,
    secureCookies: true,
    trustProxy: true
  });
});

test("rejects missing or placeholder MongoDB connection strings", () => {
  assert.throws(
    () => readConfig({ ...validEnvironment, MONGODB_URI: "" }),
    (error) => error.message.includes("MONGODB_URI") && !error.message.includes(".env file")
  );
  assert.throws(
    () => readConfig({ ...validEnvironment, MONGODB_URI: "mongodb+srv://<username>:<password>@<cluster-host>" }),
    /placeholders replaced/
  );
});

test("rejects missing, weak, or example session secrets", () => {
  assert.throws(() => readConfig({ ...validEnvironment, SESSION_SECRET: "" }), /SESSION_SECRET/);
  assert.throws(() => readConfig({ ...validEnvironment, SESSION_SECRET: "too-short" }), /SESSION_SECRET/);
  assert.throws(
    () => readConfig({ ...validEnvironment, SESSION_SECRET: "replace-with-" + "a".repeat(40) }),
    /SESSION_SECRET/
  );
});

test("rejects invalid port values", () => {
  assert.throws(() => readConfig({ ...validEnvironment, PORT: "not-a-port" }), /PORT/);
  assert.throws(() => readConfig({ ...validEnvironment, PORT: "65536" }), /PORT/);
});
