const { priorities, categories, statuses } = require("./models/Task");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && emailPattern.test(value.trim());
}

function validateTaskFields(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide task details." };
  }

  const fields = {};
  const allowed = ["title", "description", "priority", "category", "dueDate", "status"];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) return { error: "Task contains unsupported fields." };

  if (!partial || Object.hasOwn(input, "title")) {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) {
      return { error: "Title is required and must be no longer than 200 characters." };
    }
    fields.title = input.title.trim();
  }

  if (!partial || Object.hasOwn(input, "description")) {
    if (input.description !== undefined && typeof input.description !== "string") {
      return { error: "Description must be text." };
    }
    const description = (input.description || "").trim();
    if (description.length > 2000) return { error: "Description must be no longer than 2000 characters." };
    fields.description = description;
  }

  for (const [field, choices] of [["priority", priorities], ["category", categories], ["status", statuses]]) {
    if (!partial || Object.hasOwn(input, field)) {
      const value = input[field] ?? (field === "priority" ? "Medium" : field === "category" ? "Personal" : "pending");
      if (!choices.includes(value)) return { error: `Choose a valid ${field}.` };
      fields[field] = value;
    }
  }

  if (!partial || Object.hasOwn(input, "dueDate")) {
    const dueDate = input.dueDate ?? "";
    if (typeof dueDate !== "string" || (dueDate !== "" && !isValidDateOnly(dueDate))) {
      return { error: "Due date must be a valid date in YYYY-MM-DD format." };
    }
    fields.dueDate = dueDate;
  }

  return { fields };
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

module.exports = { isValidEmail, isValidDateOnly, validateTaskFields };
