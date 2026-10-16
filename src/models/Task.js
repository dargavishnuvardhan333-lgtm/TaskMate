const mongoose = require("mongoose");

const priorities = ["Low", "Medium", "High"];
const categories = ["Work", "Personal", "Study", "Other"];
const statuses = ["pending", "in-progress", "completed"];

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000
    },
    priority: {
      type: String,
      enum: priorities,
      default: "Medium"
    },
    category: {
      type: String,
      enum: categories,
      default: "Personal"
    },
    dueDate: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: statuses,
      default: "pending"
    },
    statusBeforeCompletion: {
      type: String,
      enum: [...statuses.filter((status) => status !== "completed"), null],
      default: null
    }
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = {
  Task: mongoose.models.Task || mongoose.model("Task", taskSchema),
  priorities,
  categories,
  statuses
};
