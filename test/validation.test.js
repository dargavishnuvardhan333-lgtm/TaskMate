const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidDateOnly, isValidEmail, validateTaskFields } = require("../src/validation");
const { setTaskStatus, undoTaskCompletion } = require("../src/task-status");

test("validates email format and length", () => {
  assert.equal(isValidEmail("person@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@example.com`), false);
});

test("accepts a complete task and applies defaults", () => {
  const result = validateTaskFields({ title: "  Prepare report  " });
  assert.deepEqual(result.fields, {
    title: "Prepare report",
    description: "",
    priority: "Medium",
    category: "Personal",
    status: "pending",
    dueDate: ""
  });
});

test("rejects invalid status, unknown properties, and oversized title", () => {
  assert.match(validateTaskFields({ title: "Valid", status: "done" }).error, /status/);
  assert.match(validateTaskFields({ title: "Valid", userId: "123" }).error, /unsupported/);
  assert.match(validateTaskFields({ title: "x".repeat(201) }).error, /200 characters/);
});

test("validates real calendar dates rather than date-shaped strings only", () => {
  assert.equal(isValidDateOnly("2026-02-28"), true);
  assert.equal(isValidDateOnly("2026-02-30"), false);
  assert.equal(isValidDateOnly("28-02-2026"), false);
});

test("allows partial updates but rejects empty task titles", () => {
  assert.deepEqual(validateTaskFields({ status: "in-progress" }, { partial: true }).fields, {
    status: "in-progress"
  });
  assert.match(validateTaskFields({ title: "  " }, { partial: true }).error, /Title is required/);
});

test("undo restores the task's prior pending or in-progress status", () => {
  for (const previousStatus of ["pending", "in-progress"]) {
    const task = { status: previousStatus, statusBeforeCompletion: null };
    setTaskStatus(task, "completed");
    assert.equal(task.statusBeforeCompletion, previousStatus);
    undoTaskCompletion(task);
    assert.equal(task.status, previousStatus);
    assert.equal(task.statusBeforeCompletion, null);
  }
});

test("editing a completed task to a non-completed status resets its undo state", () => {
  const task = { status: "completed", statusBeforeCompletion: "in-progress" };
  setTaskStatus(task, "pending");
  assert.equal(task.status, "pending");
  assert.equal(task.statusBeforeCompletion, null);
});
