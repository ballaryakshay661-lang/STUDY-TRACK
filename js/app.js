"use strict";

const STORAGE_KEY = "studytrack.assignments";
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
const assignmentForm = document.querySelector("#assignment-form");
const titleInput = document.querySelector("#assignment-title");
const courseInput = document.querySelector("#assignment-course");
const dueDateInput = document.querySelector("#assignment-due-date");
const priorityInput = document.querySelector("#assignment-priority");
const submitButton = assignmentForm.querySelector('[type="submit"]');
const cancelEditButton = document.querySelector("#cancel-edit");
const formHeading = document.querySelector("#form-heading");
const formMessage = document.querySelector("#form-message");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const emptyHeading = document.querySelector("#empty-heading");
const emptyCopy = document.querySelector("#empty-copy");
const filterButtons = document.querySelectorAll("[data-filter]");
const totalCount = document.querySelector("#total-count");
const pendingCount = document.querySelector("#pending-count");
const completedCount = document.querySelector("#completed-count");
const overdueCount = document.querySelector("#overdue-count");
const allFilterCount = document.querySelector("#all-filter-count");
const pendingFilterCount = document.querySelector("#pending-filter-count");
const completedFilterCount = document.querySelector("#completed-filter-count");
const listCount = document.querySelector("#list-count");
const todayDate = document.querySelector("#today-date");

let assignments = loadAssignments();
let activeFilter = "all";
let editingId = null;
const today = new Date();

todayDate.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(today);

assignmentForm.addEventListener("submit", handleFormSubmit);
assignmentForm.addEventListener("input", () => {
  formMessage.textContent = "";
});
cancelEditButton.addEventListener("click", cancelEditing);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    render();
  });
});

taskList.addEventListener("change", handleTaskChange);
taskList.addEventListener("click", handleTaskAction);

function handleFormSubmit(event) {
  event.preventDefault();
  formMessage.textContent = "";

  const title = titleInput.value.trim();
  if (!title) {
    formMessage.textContent = "Enter an assignment title.";
    return;
  }

  if (!assignmentForm.reportValidity()) {
    return;
  }
  if (!courseInput.value.trim()) {
    formMessage.textContent = "Enter a class or subject.";
    courseInput.focus();
    return;
  }
  if (!isValidDate(dueDateInput.value)) {
    formMessage.textContent = "Enter a valid due date.";
    return;
  }

  const values = {
    title,
    course: courseInput.value.trim(),
    dueDate: dueDateInput.value,
    priority: priorityInput.value,
  };

  if (!VALID_PRIORITIES.has(values.priority)) {
    return;
  }

  if (editingId) {
    assignments = assignments.map((item) =>
      item.id === editingId ? { ...item, ...values } : item
    );
  } else {
    assignments.unshift({
      id: createId(),
      ...values,
      completed: false,
    });
  }

  saveAndRender();
  resetForm();
  titleInput.focus();
}

function handleTaskChange(event) {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.matches("[data-complete]")) {
    return;
  }

  assignments = assignments.map((item) =>
    item.id === checkbox.dataset.complete ? { ...item, completed: checkbox.checked } : item
  );
  saveAndRender();
}

function handleTaskAction(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.matches("[data-delete]")) {
    assignments = assignments.filter((item) => item.id !== button.dataset.delete);
    if (editingId === button.dataset.delete) {
      resetForm();
    }
    saveAndRender();
  } else if (button.matches("[data-edit]")) {
    startEditing(button.dataset.edit);
  }
}

function startEditing(id) {
  const assignment = assignments.find((item) => item.id === id);
  if (!assignment) {
    return;
  }

  editingId = id;
  titleInput.value = assignment.title;
  courseInput.value = assignment.course;
  dueDateInput.value = assignment.dueDate;
  priorityInput.value = assignment.priority;
  formHeading.textContent = "Edit assignment";
  submitButton.textContent = "Save changes";
  cancelEditButton.hidden = false;
  formMessage.textContent = `Editing “${assignment.title}”.`;
  titleInput.focus();
}

function cancelEditing() {
  resetForm();
}

function resetForm() {
  editingId = null;
  assignmentForm.reset();
  formHeading.textContent = "Add an assignment";
  submitButton.textContent = "＋ Add assignment";
  cancelEditButton.hidden = true;
  formMessage.textContent = "";
}

function createId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function loadAssignments() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved assignments must be a list.");
    }
    return parsed.filter(isValidAssignment);
  } catch (error) {
    console.error("StudyTrack could not load saved assignments.", error);
    formMessage.textContent = "Saved assignments could not be loaded. Check browser storage and refresh.";
    return [];
  }
}

function isValidAssignment(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    typeof item.course === "string" &&
    item.course.trim().length > 0 &&
    typeof item.dueDate === "string" &&
    isValidDate(item.dueDate) &&
    VALID_PRIORITIES.has(item.priority) &&
    typeof item.completed === "boolean"
  );
}

function saveAndRender() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
    formMessage.textContent = "";
  } catch (error) {
    console.error("StudyTrack could not save assignments.", error);
    formMessage.textContent = "Changes are shown for now, but could not be saved in this browser.";
  }
  render();
}

function formatDueDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function createTaskElement(assignment) {
  const item = document.createElement("li");
  item.className = `task-item${assignment.completed ? " is-completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.className = "task-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = assignment.completed;
  checkbox.dataset.complete = assignment.id;
  checkbox.setAttribute(
    "aria-label",
    `Mark ${assignment.title} as ${assignment.completed ? "pending" : "completed"}`
  );

  const details = document.createElement("div");
  details.className = "task-details";

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = assignment.title;

  const meta = document.createElement("p");
  meta.className = "task-meta";
  const course = document.createElement("span");
  course.textContent = assignment.course;
  const dueDate = document.createElement("span");
  dueDate.className = "task-due";
  dueDate.textContent = `Due ${formatDueDate(assignment.dueDate)}`;
  if (!assignment.completed && assignment.dueDate < getTodayString()) {
    dueDate.classList.add("is-overdue");
    dueDate.textContent += " · overdue";
  }

  const priority = document.createElement("span");
  priority.className = `priority-badge priority-${assignment.priority}`;
  priority.textContent = `${capitalize(assignment.priority)} priority`;
  meta.append(course, dueDate, priority);
  details.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const editButton = document.createElement("button");
  editButton.className = "task-action-button";
  editButton.type = "button";
  editButton.dataset.edit = assignment.id;
  editButton.setAttribute("aria-label", `Edit ${assignment.title}`);
  editButton.textContent = "Edit";
  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.dataset.delete = assignment.id;
  deleteButton.setAttribute("aria-label", `Delete ${assignment.title}`);
  deleteButton.textContent = "×";
  actions.append(editButton, deleteButton);

  item.append(checkbox, details, actions);
  return item;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTodayString() {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function render() {
  const pending = assignments.filter((item) => !item.completed);
  const completed = assignments.filter((item) => item.completed);
  const overdue = pending.filter((item) => item.dueDate < getTodayString());
  const visibleAssignments = assignments.filter((item) => {
    if (activeFilter === "pending") {
      return !item.completed;
    }
    if (activeFilter === "completed") {
      return item.completed;
    }
    return true;
  });

  totalCount.textContent = String(assignments.length);
  pendingCount.textContent = String(pending.length);
  completedCount.textContent = String(completed.length);
  overdueCount.textContent = String(overdue.length);
  allFilterCount.textContent = String(assignments.length);
  pendingFilterCount.textContent = String(pending.length);
  completedFilterCount.textContent = String(completed.length);
  listCount.textContent = `${visibleAssignments.length} ${visibleAssignments.length === 1 ? "task" : "tasks"}`;
  taskList.replaceChildren(...visibleAssignments.map(createTaskElement));
  emptyState.hidden = visibleAssignments.length > 0;

  if (assignments.length === 0) {
    emptyHeading.textContent = "Your list is a blank page.";
    emptyCopy.textContent = "Add your first assignment to start building a plan.";
  } else if (activeFilter === "pending") {
    emptyHeading.textContent = "Nothing pending. Nice work!";
    emptyCopy.textContent = "You’re all caught up on your assignments.";
  } else if (activeFilter === "completed") {
    emptyHeading.textContent = "No completed assignments yet.";
    emptyCopy.textContent = "Finished something? Mark it complete to see it here.";
  }
}

render();