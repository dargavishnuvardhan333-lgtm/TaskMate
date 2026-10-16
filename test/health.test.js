const test = require("node:test");
const assert = require("node:assert/strict");
const { getDatabaseHealth } = require("../src/app");

test("health reports disconnected when the MongoDB connection is not ready", async () => {
  assert.deepEqual(await getDatabaseHealth({ readyState: 0, db: null }), {
    statusCode: 503,
    body: { status: "unavailable", database: "disconnected" }
  });
});

test("health reports connected only after MongoDB ping succeeds", async () => {
  const connection = {
    readyState: 1,
    db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) }
  };

  assert.deepEqual(await getDatabaseHealth(connection), {
    statusCode: 200,
    body: { status: "ok", database: "connected" }
  });
});

test("health reports disconnected when MongoDB ping fails", async () => {
  const connection = {
    readyState: 1,
    db: { admin: () => ({ ping: async () => { throw new Error("unavailable"); } }) }
  };

  assert.deepEqual(await getDatabaseHealth(connection), {
    statusCode: 503,
    body: { status: "unavailable", database: "disconnected" }
  });
});
