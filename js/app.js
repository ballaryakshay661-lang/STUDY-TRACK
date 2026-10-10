"use strict";

const STORAGE_KEY = "studytrack.assignments";
const FOCUS_SESSIONS_KEY = "studytrack.focusSessions";
const LEGACY_STORAGE_OWNER_KEY = "studytrack.legacyStorageOwner";
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
const subjectFilter = document.querySelector("#subject-filter");
const priorityFilter = document.querySelector("#priority-filter");
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
const dueTodayCount = document.querySelector("#due-today-count");
const focusMinutesCount = document.querySelector("#focus-minutes-count");
const focusSessionCount = document.querySelector("#focus-session-count");
const completionPercentage = document.querySelector("#completion-percentage");
const completionProgress = document.querySelector("#completion-progress");
const completionChartCanvas = document.querySelector("#completion-chart");
const subjectChartCanvas = document.querySelector("#subject-chart");
const weeklyChartCanvas = document.querySelector("#weekly-chart");
const completionChartDescription = document.querySelector("#completion-chart-description");
const subjectChartDescription = document.querySelector("#subject-chart-description");
const weeklyChartDescription = document.querySelector("#weekly-chart-description");
const weeklyChartNote = document.querySelector("#weekly-chart-note");
const progressChartCards = document.querySelectorAll(".progress-chart-card");
const recommendationList = document.querySelector("#recommendation-list");
const planEmptyState = document.querySelector("#plan-empty-state");
const timerDisplay = document.querySelector("#timer-display");
const timerTaskLabel = document.querySelector("#timer-task-label");
const timerStatus = document.querySelector("#timer-status");
const timerStartButton = document.querySelector("#timer-start");
const timerPauseButton = document.querySelector("#timer-pause");
const timerResumeButton = document.querySelector("#timer-resume");
const timerResetButton = document.querySelector("#timer-reset");
const customFocusMinutesInput = document.querySelector("#custom-focus-minutes");
const applyCustomDurationButton = document.querySelector("#apply-custom-duration");
const timerModeButtons = document.querySelectorAll("[data-timer-mode]");

let assignments = [];
let focusSessions = [];
let activeUserId = null;
let activeFilter = "all";
let editingId = null;
let selectedFocusAssignmentId = null;
let focusSessionAssignmentId = null;
let timerMode = "focus";
let timerDurationSeconds = 25 * 60;
let timerRemainingSeconds = timerDurationSeconds;
let timerInterval = null;
let timerDeadline = null;
let timerState = "idle";
let completedSessionRecorded = false;
let completionChart = null;
let subjectChart = null;
let weeklyChart = null;
const today = new Date();

const TIMER_DURATIONS = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

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

subjectFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);
taskList.addEventListener("change", handleTaskChange);
taskList.addEventListener("click", handleTaskAction);
recommendationList.addEventListener("click", handleRecommendationAction);
timerModeButtons.forEach((button) => {
  button.addEventListener("click", () => setTimerMode(button.dataset.timerMode));
});
timerStartButton.addEventListener("click", startTimer);
timerPauseButton.addEventListener("click", pauseTimer);
timerResumeButton.addEventListener("click", resumeTimer);
timerResetButton.addEventListener("click", resetTimer);
applyCustomDurationButton.addEventListener("click", applyCustomFocusDuration);

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

  assignments = assignments.map((item) => {
    if (item.id !== checkbox.dataset.complete) {
      return item;
    }
    return {
      ...item,
      completed: checkbox.checked,
      completedAt: checkbox.checked ? new Date().toISOString() : null,
    };
  });
  if (checkbox.dataset.complete === selectedFocusAssignmentId && checkbox.checked) {
    selectedFocusAssignmentId = null;
    updateTimerTaskLabel();
  }
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

function handleRecommendationAction(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const assignmentId = button.dataset.planEdit || button.dataset.focusTask;
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) {
    return;
  }

  if (button.matches("[data-plan-edit]")) {
    startEditing(assignment.id);
  } else if (button.matches("[data-focus-task]")) {
    if (timerState === "running" || timerState === "paused") {
      timerStatus.textContent = "Reset the current session before switching its assignment.";
      return;
    }
    selectedFocusAssignmentId = assignment.id;
    updateTimerTaskLabel();
    timerStatus.textContent = `Ready to focus on “${assignment.title}”. Start when you're ready.`;
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
    const storedValue = localStorage.getItem(getUserStorageKey(STORAGE_KEY));
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved assignments must be a list.");
    }
    const seenIds = new Set();
    return parsed.filter((item) => {
      if (!isValidAssignment(item) || seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    });
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

function loadFocusSessions() {
  try {
    const storedValue = localStorage.getItem(getUserStorageKey(FOCUS_SESSIONS_KEY));
    if (!storedValue) {
      return [];
    }
    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved focus sessions must be a list.");
    }
    return parsed.filter(
      (session) =>
        session &&
        typeof session.id === "string" &&
        typeof session.completedAt === "string" &&
        Number.isFinite(session.durationMinutes) &&
        session.durationMinutes > 0 &&
        (session.assignmentId === null || typeof session.assignmentId === "string")
    );
  } catch (error) {
    console.error("StudyTrack could not load focus sessions.", error);
    return [];
  }
}

function saveFocusSessions() {
  if (!activeUserId) {
    return;
  }
  try {
    localStorage.setItem(
      getUserStorageKey(FOCUS_SESSIONS_KEY),
      JSON.stringify(focusSessions)
    );
  } catch (error) {
    console.error("StudyTrack could not save focus sessions.", error);
    timerStatus.textContent = "The focus session finished, but its history could not be saved in this browser.";
  }
}

function saveAndRender() {
  if (!activeUserId) {
    formMessage.textContent = "Sign in again before saving planner changes.";
    return;
  }
  try {
    localStorage.setItem(getUserStorageKey(STORAGE_KEY), JSON.stringify(assignments));
    formMessage.textContent = "";
  } catch (error) {
    console.error("StudyTrack could not save assignments.", error);
    formMessage.textContent = "Changes are shown for now, but could not be saved in this browser.";
  }
  render();
}

function getUserStorageKey(key, userId = activeUserId) {
  if (!userId) {
    throw new Error("A signed-in user is required to access planner storage.");
  }
  return `${key}:${encodeURIComponent(userId)}`;
}

function migrateLegacyStorage(userId) {
  const owner = localStorage.getItem(LEGACY_STORAGE_OWNER_KEY);
  if (owner && owner !== userId) {
    return;
  }

  const hasLegacyAssignments = localStorage.getItem(STORAGE_KEY) !== null;
  const hasLegacyFocusSessions = localStorage.getItem(FOCUS_SESSIONS_KEY) !== null;
  if (!owner) {
    if (!hasLegacyAssignments && !hasLegacyFocusSessions) {
      return;
    }
    localStorage.setItem(LEGACY_STORAGE_OWNER_KEY, userId);
  }

  const assignmentKey = getUserStorageKey(STORAGE_KEY, userId);
  const focusSessionsKey = getUserStorageKey(FOCUS_SESSIONS_KEY, userId);
  if (hasLegacyAssignments && localStorage.getItem(assignmentKey) === null) {
    localStorage.setItem(assignmentKey, localStorage.getItem(STORAGE_KEY));
  }
  if (hasLegacyFocusSessions && localStorage.getItem(focusSessionsKey) === null) {
    localStorage.setItem(
      focusSessionsKey,
      localStorage.getItem(FOCUS_SESSIONS_KEY)
    );
  }

  if (hasLegacyAssignments) {
    localStorage.removeItem(STORAGE_KEY);
  }
  if (hasLegacyFocusSessions) {
    localStorage.removeItem(FOCUS_SESSIONS_KEY);
  }
}

function initializePlanner(user) {
  if (!user || typeof user.id !== "string" || activeUserId === user.id) {
    return;
  }

  activeUserId = user.id;
  try {
    migrateLegacyStorage(user.id);
  } catch (error) {
    console.error("StudyTrack could not isolate legacy planner data.", error);
    formMessage.textContent =
      "Previous planner data could not be safely assigned to this account. Your new changes will be kept separately.";
  }
  assignments = loadAssignments();
  focusSessions = loadFocusSessions();
  activeFilter = "all";
  editingId = null;
  selectedFocusAssignmentId = null;
  focusSessionAssignmentId = null;
  resetTimer();
  resetForm();
  render();
}

function clearPlannerSession() {
  activeUserId = null;
  assignments = [];
  focusSessions = [];
  editingId = null;
  selectedFocusAssignmentId = null;
  focusSessionAssignmentId = null;
  activeFilter = "all";
  resetTimer();
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

function getPlanRecommendations() {
  const todayString = getTodayString();
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return assignments
    .filter((item) => !item.completed)
    .map((item, index) => ({ ...item, originalIndex: index }))
    .sort((first, second) => {
      const firstOverdue = first.dueDate < todayString;
      const secondOverdue = second.dueDate < todayString;
      if (firstOverdue !== secondOverdue) {
        return firstOverdue ? -1 : 1;
      }
      if (first.dueDate !== second.dueDate) {
        return first.dueDate.localeCompare(second.dueDate);
      }
      if (priorityOrder[first.priority] !== priorityOrder[second.priority]) {
        return priorityOrder[first.priority] - priorityOrder[second.priority];
      }
      const titleOrder = first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
      return titleOrder || first.originalIndex - second.originalIndex;
    });
}

function getRecommendationReason(assignment) {
  const todayString = getTodayString();
  if (assignment.dueDate < todayString) {
    return "Overdue — this task needs attention first.";
  }
  if (assignment.dueDate === todayString) {
    return "Due today — make time for this one.";
  }
  if (assignment.priority === "high") {
    return "High priority — tackle it before lower-priority work.";
  }
  return `Due ${formatDueDate(assignment.dueDate)} — keep it moving.`;
}

function createRecommendationElement(assignment) {
  const item = document.createElement("li");
  item.className = "recommendation-card";

  const details = document.createElement("div");
  details.className = "recommendation-details";
  const title = document.createElement("h3");
  title.textContent = assignment.title;
  const metadata = document.createElement("p");
  metadata.className = "recommendation-meta";
  metadata.textContent = `${assignment.course} · Due ${formatDueDate(assignment.dueDate)} · ${capitalize(assignment.priority)} priority`;
  const reason = document.createElement("p");
  reason.className = "recommendation-reason";
  reason.textContent = getRecommendationReason(assignment);
  details.append(title, metadata, reason);

  const actions = document.createElement("div");
  actions.className = "recommendation-actions";
  const editButton = document.createElement("button");
  editButton.className = "task-action-button";
  editButton.type = "button";
  editButton.dataset.planEdit = assignment.id;
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${assignment.title}`);
  const focusButton = document.createElement("button");
  focusButton.className = "focus-task-button";
  focusButton.type = "button";
  focusButton.dataset.focusTask = assignment.id;
  focusButton.textContent = "Focus on this task";
  actions.append(editButton, focusButton);

  item.append(details, actions);
  return item;
}

function renderRecommendations() {
  const recommendations = getPlanRecommendations();
  recommendationList.replaceChildren(...recommendations.map(createRecommendationElement));
  planEmptyState.hidden = recommendations.length > 0;
}

function setTimerMode(mode) {
  if (!(mode in TIMER_DURATIONS) || timerState === "running" || timerState === "paused") {
    return;
  }

  timerMode = mode;
  timerDurationSeconds = TIMER_DURATIONS[mode];
  timerRemainingSeconds = timerDurationSeconds;
  timerDeadline = null;
  focusSessionAssignmentId = null;
  completedSessionRecorded = false;
  timerModeButtons.forEach((button) => {
    const isActive = button.dataset.timerMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  timerModeButtons[0].textContent = `Focus · ${TIMER_DURATIONS.focus / 60} min`;
  customFocusMinutesInput.value = "25";
  timerState = "idle";
  timerStatus.textContent =
    mode === "focus"
      ? "Choose a task or start a focus session when you're ready."
      : "Take a break when you're ready.";
  updateTimerDisplay();
  updateTimerControls();
}

function startTimer() {
  if (timerState !== "idle" && timerState !== "completed") {
    return;
  }
  if (timerState === "completed") {
    timerRemainingSeconds = timerDurationSeconds;
    completedSessionRecorded = false;
  }
  timerState = "running";
  focusSessionAssignmentId = timerMode === "focus" ? selectedFocusAssignmentId : null;
  timerDeadline = Date.now() + timerRemainingSeconds * 1000;
  timerStatus.textContent = timerMode === "focus" ? "Focus session in progress." : "Break in progress.";
  timerInterval = window.setInterval(tickTimer, 1000);
  updateTimerControls();
}

function pauseTimer() {
  if (timerState !== "running") {
    return;
  }
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerRemainingSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
  timerDeadline = null;
  updateTimerDisplay();
  if (timerRemainingSeconds === 0) {
    finishTimer();
    return;
  }
  timerState = "paused";
  timerStatus.textContent = "Timer paused. Resume whenever you're ready.";
  updateTimerControls();
}

function resumeTimer() {
  if (timerState !== "paused") {
    return;
  }
  timerState = "running";
  timerDeadline = Date.now() + timerRemainingSeconds * 1000;
  timerStatus.textContent = timerMode === "focus" ? "Focus session in progress." : "Break in progress.";
  timerInterval = window.setInterval(tickTimer, 1000);
  updateTimerControls();
}

function resetTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerDeadline = null;
  focusSessionAssignmentId = null;
  timerState = "idle";
  timerRemainingSeconds = timerDurationSeconds;
  completedSessionRecorded = false;
  timerStatus.textContent = "Timer reset. Start whenever you're ready.";
  updateTimerDisplay();
  updateTimerControls();
}

function applyCustomFocusDuration() {
  const minutes = Number(customFocusMinutesInput.value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    timerStatus.textContent = "Choose a focus length between 1 and 180 minutes.";
    customFocusMinutesInput.focus();
    return;
  }
  if (timerState === "running" || timerState === "paused") {
    return;
  }

  timerMode = "focus";
  timerDurationSeconds = minutes * 60;
  timerRemainingSeconds = timerDurationSeconds;
  timerDeadline = null;
  focusSessionAssignmentId = null;
  timerState = "idle";
  completedSessionRecorded = false;
  timerModeButtons.forEach((button) => {
    const isActive = button.dataset.timerMode === "focus";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  timerModeButtons[0].textContent = `Focus · ${minutes} min`;
  timerStatus.textContent = `Custom ${minutes}-minute focus session ready.`;
  updateTimerDisplay();
  updateTimerControls();
}

function tickTimer() {
  if (timerState !== "running") {
    return;
  }
  timerRemainingSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
  updateTimerDisplay();
  if (timerRemainingSeconds === 0) {
    finishTimer();
  }
}

function finishTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerDeadline = null;
  timerState = "completed";

  if (timerMode === "focus" && !completedSessionRecorded) {
    completedSessionRecorded = true;
    focusSessions.push({
      id: createId(),
      completedAt: new Date().toISOString(),
      durationMinutes: timerDurationSeconds / 60,
      assignmentId: focusSessionAssignmentId,
    });
    focusSessionAssignmentId = null;
    saveFocusSessions();
    renderFocusStatistics();
    timerStatus.textContent = "Focus session complete! Your session was recorded.";
  } else {
    timerStatus.textContent =
      timerMode === "focus" ? "Focus session complete!" : "Break complete!";
  }
  updateTimerControls();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemainingSeconds / 60);
  const seconds = timerRemainingSeconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerDisplay.textContent = display;
  timerDisplay.setAttribute("aria-label", `${minutes} minutes ${seconds} seconds remaining`);
}

function updateTimerTaskLabel() {
  const assignment = assignments.find((item) => item.id === selectedFocusAssignmentId);
  timerTaskLabel.textContent = assignment
    ? `Selected task: ${assignment.title} · ${assignment.course}`
    : "No assignment selected";
}

function updateTimerControls() {
  timerStartButton.disabled = timerState === "running" || timerState === "paused";
  timerPauseButton.disabled = timerState !== "running";
  timerResumeButton.disabled = timerState !== "paused";
  timerResetButton.disabled = timerState === "idle";
  timerModeButtons.forEach((button) => {
    button.disabled = timerState === "running" || timerState === "paused";
  });
  applyCustomDurationButton.disabled = timerState === "running" || timerState === "paused";
  customFocusMinutesInput.disabled = timerState === "running" || timerState === "paused";
}

function renderFocusStatistics() {
  const totalMinutes = focusSessions.reduce((total, session) => total + session.durationMinutes, 0);
  focusMinutesCount.textContent = String(totalMinutes);
  focusSessionCount.textContent = String(focusSessions.length);
}

function normalizeSubject(subject) {
  return subject.trim().toLowerCase();
}

function updateSubjectOptions() {
  const selectedSubject = subjectFilter.value;
  const subjects = new Map();

  assignments.forEach((item) => {
    const subject = item.course.trim();
    const key = normalizeSubject(subject);
    if (!subjects.has(key)) {
      subjects.set(key, subject);
    }
  });

  const options = [...subjects.entries()]
    .sort((first, second) => first[1].localeCompare(second[1], undefined, { sensitivity: "base" }))
    .map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    });
  const allSubjectsOption = document.createElement("option");
  allSubjectsOption.value = "";
  allSubjectsOption.textContent = "All subjects";

  subjectFilter.replaceChildren(
    allSubjectsOption,
    ...options
  );
  subjectFilter.value = subjects.has(selectedSubject) ? selectedSubject : "";
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeeklyActivity() {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() - (6 - index));
    return date;
  });
  const countsByDate = new Map(dates.map((date) => [getLocalDateKey(date), 0]));
  let completedWithoutDate = 0;

  assignments.forEach((item) => {
    if (!item.completed) {
      return;
    }
    const completedDate = typeof item.completedAt === "string" ? new Date(item.completedAt) : null;
    if (!completedDate || !Number.isFinite(completedDate.getTime())) {
      completedWithoutDate += 1;
      return;
    }
    const dateKey = getLocalDateKey(completedDate);
    if (countsByDate.has(dateKey)) {
      countsByDate.set(dateKey, countsByDate.get(dateKey) + 1);
    }
  });

  return {
    dates,
    counts: dates.map((date) => countsByDate.get(getLocalDateKey(date))),
    completedWithoutDate,
  };
}

function setProgressChartVisibility(card, chartAvailable, isEmpty) {
  const canvasWrap = card.querySelector(".chart-canvas-wrap");
  const unavailableMessage = card.querySelector(".chart-unavailable");
  const emptyMessage = card.querySelector(".chart-empty");

  canvasWrap.hidden = !chartAvailable || isEmpty;
  unavailableMessage.hidden = chartAvailable || isEmpty;
  if (emptyMessage) {
    emptyMessage.hidden = !isEmpty;
  }
}

function renderProgressCharts(completed, pending) {
  const chartAvailable = typeof window.Chart === "function";
  const hasAssignments = assignments.length > 0;
  const subjects = new Map();

  assignments.forEach((item) => {
    const key = normalizeSubject(item.course);
    if (!subjects.has(key)) {
      subjects.set(key, { label: item.course.trim(), completed: 0, pending: 0 });
    }
    const subject = subjects.get(key);
    subject[item.completed ? "completed" : "pending"] += 1;
  });

  const sortedSubjects = [...subjects.values()].sort((first, second) =>
    first.label.localeCompare(second.label, undefined, { sensitivity: "base" })
  );
  const subjectSummary = sortedSubjects
    .map((subject) => `${subject.label}: ${subject.completed} completed, ${subject.pending} pending`)
    .join("; ");
  const weeklyActivity = getWeeklyActivity();
  const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  const weeklyLabels = weeklyActivity.dates.map((date) => dateFormatter.format(date));

  completionChartDescription.textContent = hasAssignments
    ? `${completed.length} completed and ${pending.length} pending assignments.`
    : "No assignments are available.";
  subjectChartDescription.textContent = subjectSummary || "No subject data is available.";
  weeklyChartDescription.textContent = weeklyLabels
    .map((label, index) => `${label}: ${weeklyActivity.counts[index]} completed`)
    .join("; ");
  weeklyChartNote.textContent = weeklyActivity.completedWithoutDate
    ? `${weeklyActivity.completedWithoutDate} previously completed ${
        weeklyActivity.completedWithoutDate === 1 ? "assignment has" : "assignments have"
      } no recorded completion date and ${weeklyActivity.completedWithoutDate === 1 ? "is" : "are"} not included in weekly activity.`
    : "Only assignments completed after date tracking was added appear in this chart.";

  setProgressChartVisibility(progressChartCards[0], chartAvailable, !hasAssignments);
  setProgressChartVisibility(progressChartCards[1], chartAvailable, !hasAssignments);
  setProgressChartVisibility(progressChartCards[2], chartAvailable, false);
  if (!chartAvailable) {
    return;
  }

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#394357", padding: 16, usePointStyle: true },
      },
    },
  };

  if (!completionChart) {
    completionChart = new window.Chart(completionChartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Completed", "Pending"],
        datasets: [{
          data: [completed.length, pending.length],
          backgroundColor: ["#287a5e", "#6154c8"],
          borderColor: "#ffffff",
          borderWidth: 3,
        }],
      },
      options: {
        ...chartDefaults,
        cutout: "62%",
        plugins: {
          ...chartDefaults.plugins,
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.raw}`,
            },
          },
        },
      },
    });
  } else {
    completionChart.data.datasets[0].data = [completed.length, pending.length];
    completionChart.update();
  }

  if (!subjectChart) {
    subjectChart = new window.Chart(subjectChartCanvas, {
      type: "bar",
      data: {
        labels: sortedSubjects.map((subject) => subject.label),
        datasets: [
          {
            label: "Completed",
            data: sortedSubjects.map((subject) => subject.completed),
            backgroundColor: "#287a5e",
            borderRadius: 5,
          },
          {
            label: "Pending",
            data: sortedSubjects.map((subject) => subject.pending),
            backgroundColor: "#6154c8",
            borderRadius: 5,
          },
        ],
      },
      options: {
        ...chartDefaults,
        scales: {
          x: {
            ticks: { color: "#667085", maxRotation: 45, minRotation: 0, autoSkip: false },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#667085", precision: 0, stepSize: 1 },
            grid: { color: "#e5e9f0" },
          },
        },
      },
    });
  } else {
    subjectChart.data.labels = sortedSubjects.map((subject) => subject.label);
    subjectChart.data.datasets[0].data = sortedSubjects.map((subject) => subject.completed);
    subjectChart.data.datasets[1].data = sortedSubjects.map((subject) => subject.pending);
    subjectChart.update();
  }

  if (!weeklyChart) {
    weeklyChart = new window.Chart(weeklyChartCanvas, {
      type: "bar",
      data: {
        labels: weeklyLabels,
        datasets: [{
          label: "Completed assignments",
          data: weeklyActivity.counts,
          backgroundColor: "#287a5e",
          borderRadius: 5,
          maxBarThickness: 48,
        }],
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: "#667085", maxRotation: 0, autoSkip: false },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#667085", precision: 0, stepSize: 1 },
            grid: { color: "#e5e9f0" },
          },
        },
      },
    });
  } else {
    weeklyChart.data.labels = weeklyLabels;
    weeklyChart.data.datasets[0].data = weeklyActivity.counts;
    weeklyChart.update();
  }
}

function renderProgressDashboard(completed, pending) {
  const percentage = assignments.length
    ? Math.round((completed.length / assignments.length) * 100)
    : 0;
  completionPercentage.textContent = `${percentage}%`;
  completionProgress.value = percentage;
  completionProgress.setAttribute("aria-valuetext", `${percentage}% complete`);
  renderProgressCharts(completed, pending);
}

function render() {
  updateSubjectOptions();

  const pending = assignments.filter((item) => !item.completed);
  const completed = assignments.filter((item) => item.completed);
  const overdue = pending.filter((item) => item.dueDate < getTodayString());
  const dueToday = pending.filter((item) => item.dueDate === getTodayString());
  if (
    selectedFocusAssignmentId &&
    !pending.some((item) => item.id === selectedFocusAssignmentId)
  ) {
    selectedFocusAssignmentId = null;
  }
  updateTimerTaskLabel();
  renderRecommendations();
  renderFocusStatistics();
  const selectedSubject = subjectFilter.value;
  const selectedPriority = priorityFilter.value;
  const visibleAssignments = assignments.filter((item) => {
    const matchesStatus =
      activeFilter === "all" ||
      (activeFilter === "pending" && !item.completed) ||
      (activeFilter === "completed" && item.completed);
    const matchesSubject =
      !selectedSubject || normalizeSubject(item.course) === selectedSubject;
    const matchesPriority = !selectedPriority || item.priority === selectedPriority;

    return matchesStatus && matchesSubject && matchesPriority;
  });

  totalCount.textContent = String(assignments.length);
  pendingCount.textContent = String(pending.length);
  completedCount.textContent = String(completed.length);
  overdueCount.textContent = String(overdue.length);
  dueTodayCount.textContent = String(dueToday.length);
  renderProgressDashboard(completed, pending);
  allFilterCount.textContent = String(assignments.length);
  pendingFilterCount.textContent = String(pending.length);
  completedFilterCount.textContent = String(completed.length);
  listCount.textContent = `${visibleAssignments.length} ${visibleAssignments.length === 1 ? "task" : "tasks"}`;
  taskList.replaceChildren(...visibleAssignments.map(createTaskElement));
  emptyState.hidden = visibleAssignments.length > 0;

  if (assignments.length === 0) {
    emptyHeading.textContent = "Your list is a blank page.";
    emptyCopy.textContent = "Add your first assignment to start building a plan.";
  } else if (visibleAssignments.length === 0 && (selectedSubject || selectedPriority)) {
    emptyHeading.textContent = "No assignments match these filters.";
    emptyCopy.textContent = "Try changing or clearing one or more filters.";
  } else if (activeFilter === "pending") {
    emptyHeading.textContent = "Nothing pending. Nice work!";
    emptyCopy.textContent = "You’re all caught up on your assignments.";
  } else if (activeFilter === "completed") {
    emptyHeading.textContent = "No completed assignments yet.";
    emptyCopy.textContent = "Finished something? Mark it complete to see it here.";
  }
}

updateTimerDisplay();
updateTimerControls();
window.addEventListener("studytrack:authenticated", (event) => {
  initializePlanner(event.detail?.user);
});
window.addEventListener("studytrack:signed-out", clearPlannerSession);
if (window.studyTrackUser) {
  initializePlanner(window.studyTrackUser);
}