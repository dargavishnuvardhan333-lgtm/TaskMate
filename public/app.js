const legacyStorageKey = "taskMateTasks";
const authPanel = document.querySelector("#auth-panel");
const application = document.querySelector("#application");
const pageLoading = document.querySelector("#page-loading");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const authNotice = document.querySelector("#auth-notice");
const authHeading = document.querySelector("#auth-heading");
const appNotice = document.querySelector("#app-notice");
const appError = document.querySelector("#app-error");
const userGreeting = document.querySelector("#user-greeting");
const logoutButton = document.querySelector("#logout-button");
const taskForm = document.querySelector("#task-form");
const taskList = document.querySelector("#task-list");
const loadingState = document.querySelector("#loading-state");
const progressCount = document.querySelector("#progress-count");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const statsRow = document.querySelector("#stats-row");
const clearButton = document.querySelector("#clear-button");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const filterStatus = document.querySelector("#filter-status");
const filterPriority = document.querySelector("#filter-priority");
const filterCategory = document.querySelector("#filter-category");

let tasks = [];
let stats = { total: 0, completed: 0, pending: 0, completionPercent: 0 };
let editedTaskId = null;
let loadSequence = 0;
const isDashboardPage = window.location.pathname === "/dashboard";

authPanel.hidden = isDashboardPage;
application.hidden = true;
pageLoading.hidden = !isDashboardPage;

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new Error("Could not reach TaskMate. Check that the server is running and try again.");
  }

  if (response.status === 204) return null;
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.hidden = !message;
}

function switchAuthMode(mode) {
  const registering = mode === "register";
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  loginTab.setAttribute("aria-selected", String(!registering));
  registerTab.setAttribute("aria-selected", String(registering));
  authHeading.textContent = registering ? "Create your account" : "Welcome to TaskMate";
  setMessage(authNotice, "");
}

async function establishSession(user) {
  userGreeting.textContent = `Signed in as ${user.name}`;
  authPanel.hidden = true;
  application.hidden = false;
  pageLoading.hidden = true;
  setMessage(authNotice, "");
  setMessage(appError, "");
  setMessage(appNotice, "");
  if (!isDashboardPage) {
    window.location.assign("/dashboard");
    return;
  }
  await loadTasks({ importLegacy: true });
}

async function loadTasks({ importLegacy = false } = {}) {
  const sequence = ++loadSequence;
  loadingState.hidden = false;
  taskList.hidden = true;
  setMessage(appError, "");

  try {
    let result = await api(buildTaskUrl());
    if (sequence !== loadSequence) return;

    if (importLegacy && result.stats.total === 0) {
      const legacyTasks = readLegacyTasks();
      if (legacyTasks && legacyTasks.length > 0) {
        const imported = await api("/api/tasks/import-local", {
          method: "POST",
          body: { tasks: legacyTasks }
        });
        localStorage.removeItem(legacyStorageKey);
        setMessage(
          appNotice,
          `Imported ${imported.imported} saved task${imported.imported === 1 ? "" : "s"} into your account.`
        );
        result = await api(buildTaskUrl());
      }
    }

    if (sequence !== loadSequence) return;
    tasks = result.tasks;
    stats = result.stats;
    renderTasks();
  } catch (error) {
    if (sequence === loadSequence) setMessage(appError, error.message, true);
  } finally {
    if (sequence === loadSequence) {
      loadingState.hidden = true;
      taskList.hidden = false;
    }
  }
}

function readLegacyTasks() {
  try {
    const saved = localStorage.getItem(legacyStorageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("The saved local task list is not valid.");
    return parsed;
  } catch (error) {
    setMessage(appError, `Existing local tasks could not be imported: ${error.message}`, true);
    return null;
  }
}

function buildTaskUrl() {
  const query = new URLSearchParams();
  if (filterStatus.value) query.set("status", filterStatus.value);
  if (filterPriority.value) query.set("priority", filterPriority.value);
  if (filterCategory.value) query.set("category", filterCategory.value);
  const search = query.toString();
  return search ? `/api/tasks?${search}` : "/api/tasks";
}

function createTag(text, className = "task-tag") {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-card${task.status === "completed" ? " is-complete" : ""}`;

  const details = document.createElement("div");
  details.className = "task-details";
  const name = document.createElement("p");
  name.className = "task-name";
  name.textContent = task.title;
  details.append(name);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    details.append(description);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(
    createTag(`${task.priority} priority`, `task-tag priority-${task.priority.toLowerCase()}`),
    createTag(task.category),
    createTag(task.status === "in-progress" ? "In progress" : task.status[0].toUpperCase() + task.status.slice(1))
  );
  if (task.dueDate) meta.append(createTag(`Due ${formatDueDate(task.dueDate)}`, "task-tag task-date"));
  details.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const completionButton = document.createElement("button");
  completionButton.type = "button";
  completionButton.textContent = task.status === "completed" ? "Undo" : "Complete";
  completionButton.setAttribute(
    "aria-label",
    `${task.status === "completed" ? "Undo completion of" : "Complete"} ${task.title}`
  );
  completionButton.addEventListener("click", () => updateCompletion(task));

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary-button";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${task.title}`);
  editButton.addEventListener("click", () => openEditDialog(task));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
  deleteButton.addEventListener("click", () => deleteTask(task));

  actions.append(completionButton, editButton, deleteButton);
  item.append(details, actions);
  return item;
}

function renderTasks() {
  taskList.replaceChildren();
  if (tasks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = stats.total === 0
      ? "No tasks yet. Add one above to get started!"
      : "No tasks match these filters.";
    taskList.append(emptyState);
  } else {
    tasks.forEach((task) => taskList.append(createTaskElement(task)));
  }

  const percent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
  progressCount.textContent = `${stats.completed} of ${stats.total} tasks · ${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuemax", String(stats.total));
  progressTrack.setAttribute("aria-valuenow", String(stats.completed));
  statsRow.textContent = `Total: ${stats.total} · Completed: ${stats.completed} · Pending: ${stats.pending}`;
  clearButton.disabled = stats.total === 0;
}

async function refreshAfterChange(message) {
  setMessage(appNotice, message);
  await loadTasks();
}

async function updateCompletion(task) {
  setMessage(appNotice, "");
  try {
    if (task.status === "completed") {
      await api(`/api/tasks/${encodeURIComponent(task.id)}/undo`, { method: "POST", body: {} });
      await refreshAfterChange("Task completion undone.");
    } else {
      await api(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: { status: "completed" }
      });
      await refreshAfterChange("Task completed.");
    }
  } catch (error) {
    setMessage(appError, error.message, true);
  }
}

function openEditDialog(task) {
  editedTaskId = task.id;
  editForm.elements.title.value = task.title;
  editForm.elements.description.value = task.description;
  editForm.elements.priority.value = task.priority;
  editForm.elements.category.value = task.category;
  editForm.elements.dueDate.value = task.dueDate;
  editForm.elements.status.value = task.status;
  editDialog.showModal();
  editForm.elements.title.focus();
}

async function deleteTask(task) {
  setMessage(appNotice, "");
  try {
    await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
    await refreshAfterChange("Task deleted.");
  } catch (error) {
    setMessage(appError, error.message, true);
  }
}

loginTab.addEventListener("click", () => switchAuthMode("login"));
registerTab.addEventListener("click", () => switchAuthMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(authNotice, "");
  try {
    const formData = new FormData(loginForm);
    const result = await api("/api/auth/login", {
      method: "POST",
      body: Object.fromEntries(formData)
    });
    await establishSession(result.user);
  } catch (error) {
    setMessage(authNotice, error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(authNotice, "");
  try {
    const formData = new FormData(registerForm);
    const result = await api("/api/auth/register", {
      method: "POST",
      body: Object.fromEntries(formData)
    });
    await establishSession(result.user);
  } catch (error) {
    setMessage(authNotice, error.message, true);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
    window.location.assign("/");
  } catch (error) {
    setMessage(appError, error.message, true);
  }
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(appNotice, "");
  setMessage(appError, "");
  const formData = new FormData(taskForm);
  try {
    await api("/api/tasks", {
      method: "POST",
      body: {
        title: formData.get("title"),
        description: formData.get("description"),
        priority: formData.get("priority"),
        category: formData.get("category"),
        dueDate: formData.get("dueDate"),
        status: formData.get("status")
      }
    });
    taskForm.reset();
    await refreshAfterChange("Task added.");
    taskForm.elements.title.focus();
  } catch (error) {
    setMessage(appError, error.message, true);
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editedTaskId) return;
  const formData = new FormData(editForm);
  try {
    await api(`/api/tasks/${encodeURIComponent(editedTaskId)}`, {
      method: "PATCH",
      body: {
        title: formData.get("title"),
        description: formData.get("description"),
        priority: formData.get("priority"),
        category: formData.get("category"),
        dueDate: formData.get("dueDate"),
        status: formData.get("status")
      }
    });
    editDialog.close();
    editedTaskId = null;
    await refreshAfterChange("Task updated.");
  } catch (error) {
    setMessage(appError, error.message, true);
  }
});

document.querySelector("#cancel-edit-button").addEventListener("click", () => editDialog.close());
editDialog.addEventListener("close", () => {
  editedTaskId = null;
});

clearButton.addEventListener("click", async () => {
  if (stats.total === 0) return;
  const confirmed = window.confirm(`Clear all ${stats.total} tasks for this account? This cannot be undone.`);
  if (!confirmed) return;
  try {
    const result = await api("/api/tasks", { method: "DELETE" });
    await refreshAfterChange(`Cleared ${result.deleted} task${result.deleted === 1 ? "" : "s"}.`);
  } catch (error) {
    setMessage(appError, error.message, true);
  }
});

for (const filter of [filterStatus, filterPriority, filterCategory]) {
  filter.addEventListener("change", () => loadTasks());
}

async function restoreSession() {
  try {
    const result = await api("/api/auth/me");
    if (result.user) {
      if (isDashboardPage) {
        await establishSession(result.user);
      } else {
        window.location.replace("/dashboard");
      }
    } else if (isDashboardPage) {
      window.location.replace("/");
    }
  } catch (error) {
    if (isDashboardPage) {
      pageLoading.hidden = false;
      setMessage(pageLoading, error.message, true);
    } else {
      setMessage(authNotice, error.message, true);
    }
  }
}

restoreSession();
