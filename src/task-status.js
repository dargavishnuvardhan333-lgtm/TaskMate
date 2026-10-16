function setTaskStatus(task, nextStatus) {
  if (task.status !== "completed" && nextStatus === "completed") {
    task.statusBeforeCompletion = task.status;
  } else if (nextStatus !== "completed") {
    task.statusBeforeCompletion = null;
  } else {
    task.statusBeforeCompletion ||= "pending";
  }
  task.status = nextStatus;
}

function undoTaskCompletion(task) {
  if (task.status === "completed") {
    task.status = task.statusBeforeCompletion || "pending";
    task.statusBeforeCompletion = null;
  }
}

module.exports = { setTaskStatus, undoTaskCompletion };
