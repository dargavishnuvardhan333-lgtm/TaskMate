import React, { useEffect, useMemo, useState } from "react";

const TASKS_KEY = "taskmate.tasks.v1";
const PREFERENCES_KEY = "taskmate.demoUserPreferences.v1";

function readTasks() {
  try {
    const stored = window.localStorage.getItem(TASKS_KEY);
    if (stored === null) return { data: [], warning: "" };

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Task data must be an array.");

    const tasks = parsed.filter(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.description === "string" &&
        typeof task.completed === "boolean",
    );

    return {
      data: tasks,
      warning:
        tasks.length === parsed.length
          ? ""
          : "Some saved tasks were invalid and were skipped.",
    };
  } catch {
    return {
      data: [],
      warning: "Saved task data could not be read. A fresh task list is ready.",
    };
  }
}

function readPreferences() {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (stored === null) return { data: { displayName: "Alex" }, warning: "" };

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed.displayName !== "string") {
      throw new Error("User preferences are invalid.");
    }
    return { data: { displayName: parsed.displayName }, warning: "" };
  } catch {
    return {
      data: { displayName: "Alex" },
      warning: "Demo preferences could not be read; using the default name.",
    };
  }
}

function App() {
  const [initialData] = useState(() => ({
    tasks: readTasks(),
    preferences: readPreferences(),
  }));
  const [tasks, setTasks] = useState(initialData.tasks.data);
  const [preferences, setPreferences] = useState(initialData.preferences.data);
  const [storageWarning, setStorageWarning] = useState(
    [initialData.tasks.warning, initialData.preferences.warning]
      .filter(Boolean)
      .join(" "),
  );
  const [storageErrors, setStorageErrors] = useState({ tasks: "", preferences: "" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      setStorageErrors((current) => ({ ...current, tasks: "" }));
    } catch {
      setStorageErrors((current) => ({
        ...current,
        tasks: "Tasks could not be saved in this browser.",
      }));
    }
  }, [tasks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      setStorageErrors((current) => ({ ...current, preferences: "" }));
    } catch {
      setStorageErrors((current) => ({
        ...current,
        preferences: "Demo preferences could not be saved in this browser.",
      }));
    }
  }, [preferences]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && !task.completed) ||
        (filter === "completed" && task.completed);
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tasks]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const remainingCount = tasks.length - completedCount;
  const storageError = Object.values(storageErrors).filter(Boolean).join(" ");

  function addTask(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setTasks((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: cleanTitle,
        description: description.trim(),
        completed: false,
        createdAt: Date.now(),
      },
      ...current,
    ]);
    setTitle("");
    setDescription("");
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description);
  }

  function saveEdit(event, id) {
    event.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, title: cleanTitle, description: editDescription.trim() }
          : task,
      ),
    );
    setEditingId(null);
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
    if (editingId === id) setEditingId(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="TaskMate home">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>taskmate</span>
        </a>
        <label className="profile">
          <span className="avatar" aria-hidden="true">
            {preferences.displayName.trim().charAt(0).toUpperCase() || "A"}
          </span>
          <span className="profile-name">Demo workspace</span>
          <input
            aria-label="Demo display name"
            className="name-input"
            maxLength={32}
            value={preferences.displayName}
            onChange={(event) =>
              setPreferences({ ...preferences, displayName: event.target.value })
            }
            title="Change demo display name"
          />
        </label>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
          <h1>Make room for<br /><span>what matters.</span></h1>
          <p className="intro">A little progress each day adds up to big results.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="sun"></span>
          <span className="art-card art-card-one">Today <b>✓</b></span>
          <span className="art-card art-card-two">One thing at a time</span>
          <span className="art-sparkle">✳</span>
        </div>
      </section>

      {(storageWarning || storageError) && (
        <div className={storageError ? "storage-message error" : "storage-message"} role="status">
          {storageError || storageWarning}
        </div>
      )}

      <section className="workspace" aria-label="Task management">
        <div className="task-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR LIST</p>
              <h2>Tasks <span className="count-badge">{tasks.length}</span></h2>
            </div>
            <div className="task-summary">
              <span><b>{remainingCount}</b> to do</span>
              <span className="summary-divider"></span>
              <span><b>{completedCount}</b> done</span>
            </div>
          </div>

          <form className="add-form" onSubmit={addTask}>
            <div className="add-title-row">
              <span className="plus-mark" aria-hidden="true">+</span>
              <input
                aria-label="Task title"
                placeholder="What needs your attention?"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
              />
              <button className="add-button" type="submit">Add task</button>
            </div>
            <input
              aria-label="Task details"
              className="description-input"
              placeholder="Add a note (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </form>

          <div className="list-toolbar">
            <div className="filters" role="group" aria-label="Filter tasks">
              {[
                ["all", "All"],
                ["active", "To do"],
                ["completed", "Completed"],
              ].map(([value, label]) => (
                <button
                  className={filter === value ? "filter-button selected" : "filter-button"}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>
              )}
            </label>
          </div>

          <div className="task-list">
            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">✳</span>
                <h3>{search ? "No tasks found" : "Nothing on your list yet"}</h3>
                <p>{search ? "Try another search or clear your filters." : "Add a task above and get your day moving."}</p>
              </div>
            ) : (
              visibleTasks.map((task) => (
                <article className={task.completed ? "task-card completed" : "task-card"} key={task.id}>
                  {editingId === task.id ? (
                    <form className="edit-form" onSubmit={(event) => saveEdit(event, task.id)}>
                      <input
                        aria-label="Edit task title"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        maxLength={120}
                        required
                        autoFocus
                      />
                      <textarea
                        aria-label="Edit task details"
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        maxLength={500}
                        rows={2}
                      />
                      <div className="edit-actions">
                        <button className="text-button" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="small-primary" type="submit">Save changes</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        aria-label={task.completed ? `Mark ${task.title} as to do` : `Complete ${task.title}`}
                        aria-pressed={task.completed}
                        className="check-button"
                        onClick={() => toggleTask(task.id)}
                        type="button"
                      >
                        {task.completed ? "✓" : ""}
                      </button>
                      <div className="task-copy">
                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}
                      </div>
                      <div className="task-actions">
                        <button className="icon-button" type="button" onClick={() => startEditing(task)} aria-label={`Edit ${task.title}`} title="Edit task">
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.8 3.7 16.3 6.2M4 16l3.4-.7 8.5-8.5a1.8 1.8 0 0 0-2.5-2.5l-8.5 8.5L4 16Z" /></svg>
                        </button>
                        <button className="icon-button delete-button" type="button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`} title="Delete task">
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11m-9.5 0 .6 10h6.8l.6-10M8 6V4h4v2m-3 3v4m2-4v4" /></svg>
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))
            )}
          </div>

          <p className="local-note"><span aria-hidden="true">⌑</span> Saved on this device automatically</p>
        </div>

        <aside className="side-column">
          <div className="focus-card">
            <span className="focus-icon" aria-hidden="true">✳</span>
            <p className="eyebrow">A GENTLE REMINDER</p>
            <h3>Small steps<br />still move you<br />forward.</h3>
            <p>Focus on progress, not perfection. You’ve got this.</p>
            <div className="progress-track" aria-label={`${completedCount} of ${tasks.length} tasks completed`}>
              <span style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }}></span>
            </div>
            <small>{tasks.length ? `${completedCount} of ${tasks.length} completed` : "Your progress starts here"}</small>
          </div>
          <div className="tip-card">
            <span className="tip-symbol" aria-hidden="true">✦</span>
            <div>
              <b>Make it manageable</b>
              <p>Break a big goal into a few small tasks. Every checkmark counts.</p>
            </div>
          </div>
        </aside>
      </section>
      <footer>Made for your everyday momentum <span aria-hidden="true">·</span> TaskMate</footer>
    </main>
  );
}

export default App;
