"use strict";

const AUTH_API_BASE_URL = document
  .querySelector('meta[name="studytrack-api-base"]')
  .content.replace(/\/+$/, "");
const authShell = document.querySelector("#auth-shell");
const authForm = document.querySelector("#auth-form");
const authNameGroup = document.querySelector("#auth-name-group");
const authNameInput = document.querySelector("#auth-name");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const authMessage = document.querySelector("#auth-message");
const authHeading = document.querySelector("#auth-heading");
const authCopy = document.querySelector("#auth-copy");
const authFooter = document.querySelector("#auth-footer");
const authSubmit = document.querySelector("#auth-submit");
const authSubmitLabel = document.querySelector("#auth-submit-label");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const accountLabel = document.querySelector("#account-label");
const logoutButton = document.querySelector("#logout-button");
const headerNote = document.querySelector(".header-note");
const protectedApp = document.querySelector("#protected-app");
const sessionNotice = document.querySelector("#session-notice");
let authMode = "login";
let sessionCheckPromise = null;
let sessionExpiryTimer = null;

function setAuthMode(mode) {
  authMode = mode;
  const isRegistration = mode === "register";
  authNameGroup.hidden = !isRegistration;
  authNameInput.required = isRegistration;
  authPasswordInput.autocomplete = isRegistration ? "new-password" : "current-password";
  authHeading.textContent = isRegistration ? "Create your account." : "Welcome back.";
  authCopy.textContent = isRegistration
    ? "A little more organized, every day."
    : "Sign in to open your StudyTrack planner.";
  authSubmitLabel.textContent = isRegistration ? "Create account" : "Log in";
  authFooter.hidden = isRegistration;
  authMessage.textContent = "";

  authModeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === mode;
    if (button.classList.contains("auth-tab")) {
      button.classList.toggle("is-active", isActive);
    }
    if (button.hasAttribute("aria-pressed")) {
      button.setAttribute("aria-pressed", String(isActive));
    }
  });
}

function setAuthBusy(isBusy, label) {
  authSubmit.disabled = isBusy;
  authModeButtons.forEach((button) => {
    button.disabled = isBusy;
  });
  authNameInput.disabled = isBusy;
  authEmailInput.disabled = isBusy;
  authPasswordInput.disabled = isBusy;
  if (label) {
    authSubmitLabel.textContent = label;
  }
}

function showSignedOut(message = "") {
  const wasAuthenticated = document.body.classList.contains("is-authenticated");
  window.clearTimeout(sessionExpiryTimer);
  sessionExpiryTimer = null;
  document.body.classList.remove("is-authenticated");
  protectedApp.inert = true;
  protectedApp.setAttribute("aria-hidden", "true");
  authShell.hidden = false;
  authNameInput.disabled = false;
  authEmailInput.disabled = false;
  authPasswordInput.disabled = false;
  authModeButtons.forEach((button) => {
    button.disabled = false;
  });
  authSubmit.disabled = false;
  authMessage.textContent = message;
  accountLabel.hidden = true;
  logoutButton.hidden = true;
  sessionNotice.hidden = true;
  sessionNotice.textContent = "";
  window.studyTrackUser = null;
  if (wasAuthenticated) {
    window.dispatchEvent(new CustomEvent("studytrack:signed-out"));
  }
}

function scheduleSessionExpiry(expiresAt) {
  window.clearTimeout(sessionExpiryTimer);
  const remaining = expiresAt - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    showSignedOut("Your session expired. Please sign in again.");
    return false;
  }

  sessionExpiryTimer = window.setTimeout(() => {
    showSignedOut("Your session expired. Please sign in again.");
  }, remaining);
  return true;
}

function showSignedIn(user, expiresAt) {
  if (!scheduleSessionExpiry(expiresAt)) {
    return;
  }
  const previousUserId = window.studyTrackUser?.id;
  if (previousUserId && previousUserId !== user.id) {
    window.dispatchEvent(new CustomEvent("studytrack:signed-out"));
  }
  window.studyTrackUser = user;
  document.body.classList.add("is-authenticated");
  protectedApp.inert = false;
  protectedApp.removeAttribute("aria-hidden");
  authShell.hidden = true;
  accountLabel.textContent = user.name || user.email;
  accountLabel.hidden = false;
  logoutButton.hidden = false;
  headerNote.textContent = "A little more organized, every day.";
  sessionNotice.hidden = true;
  sessionNotice.textContent = "";
  window.dispatchEvent(
    new CustomEvent("studytrack:authenticated", { detail: { user } })
  );
  return true;
}

async function readApiError(response) {
  try {
    const body = await response.json();
    if (typeof body.error === "string" && body.error.length <= 200) {
      return body.error;
    }
  } catch {
    // Use the status-based message below for empty or non-JSON responses.
  }
  if (response.status === 429) {
    return "Too many attempts. Please wait a little before trying again.";
  }
  return `StudyTrack could not complete that request (HTTP ${response.status}).`;
}

async function requestCurrentUser() {
  return fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
}

async function checkSession(options = {}) {
  if (sessionCheckPromise) {
    return sessionCheckPromise;
  }

  sessionCheckPromise = (async () => {
    if (!document.body.classList.contains("is-authenticated") && !options.quiet) {
      authMessage.textContent = "Checking your session…";
      setAuthBusy(true, "Checking your session…");
    }

    try {
      const response = await requestCurrentUser();
      if (response.status === 401) {
        showSignedOut(
          options.expired
            ? "Your session expired. Please sign in again."
            : options.networkRecovery
              ? "You are signed out. Log in or create an account to continue."
              : ""
        );
        return false;
      }
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = await response.json();
      if (
        !body.user ||
        typeof body.user.id !== "string" ||
        typeof body.expiresAt !== "number"
      ) {
        throw new Error("The server returned an invalid session response.");
      }
      if (!showSignedIn(body.user, body.expiresAt)) {
        return false;
      }
      authMessage.textContent = "";
      return true;
    } catch (error) {
      if (document.body.classList.contains("is-authenticated")) {
        sessionNotice.textContent =
          "Can't verify your session right now. Check your connection and try again.";
        sessionNotice.hidden = false;
      } else {
        showSignedOut(
          error instanceof TypeError
            ? "StudyTrack could not reach the API. Check that the backend is running, then try again."
            : error.message
        );
      }
      return false;
    } finally {
      setAuthBusy(false);
      authSubmitLabel.textContent = authMode === "register" ? "Create account" : "Log in";
      sessionCheckPromise = null;
    }
  })();

  return sessionCheckPromise;
}

function getFormError() {
  if (!authForm.reportValidity()) {
    return "Check the highlighted fields and try again.";
  }

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    authEmailInput.focus();
    return "Enter a valid email address.";
  }
  if (new TextEncoder().encode(password).length > 72) {
    authPasswordInput.focus();
    return "Password must be no more than 72 UTF-8 bytes.";
  }
  if (authMode === "register" && !authNameInput.value.trim()) {
    authNameInput.focus();
    return "Enter your name.";
  }
  return "";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authMessage.textContent = "";
  const validationError = getFormError();
  if (validationError) {
    authMessage.textContent = validationError;
    return;
  }

  const isRegistration = authMode === "register";
  const payload = {
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  };
  if (isRegistration) {
    payload.name = authNameInput.value.trim();
  }

  setAuthBusy(true, isRegistration ? "Creating your account…" : "Signing in…");
  try {
    const response = await fetch(
      `${AUTH_API_BASE_URL}/api/auth/${isRegistration ? "register" : "login"}`,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const body = await response.json();
    if (
      !body.user ||
      typeof body.user.id !== "string" ||
      typeof body.expiresAt !== "number"
    ) {
      throw new Error("The server returned an invalid account response.");
    }
    authForm.reset();
    showSignedIn(body.user, body.expiresAt);
  } catch (error) {
    authMessage.textContent =
      error instanceof TypeError
        ? "StudyTrack could not reach the API. Check your connection and try again."
        : error.message;
  } finally {
    setAuthBusy(false);
    authSubmitLabel.textContent = authMode === "register" ? "Create account" : "Log in";
  }
}

async function handleLogout() {
  logoutButton.disabled = true;
  logoutButton.textContent = "Logging out…";
  sessionNotice.hidden = true;
  sessionNotice.textContent = "";
  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(await readApiError(response));
    }
    authForm.reset();
    setAuthMode("login");
    showSignedOut("You have logged out.");
  } catch (error) {
    sessionNotice.textContent =
      error instanceof TypeError
        ? "Could not reach the API to log out. Check your connection and retry."
        : error.message;
    sessionNotice.hidden = false;
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = "Log out";
  }
}

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.disabled) {
      setAuthMode(button.dataset.authMode);
    }
  });
});
authForm.addEventListener("submit", handleAuthSubmit);
authForm.addEventListener("input", () => {
  authMessage.textContent = "";
});
logoutButton.addEventListener("click", handleLogout);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" &&
      document.body.classList.contains("is-authenticated")) {
    checkSession({ quiet: true, expired: true });
  }
});

window.addEventListener("focus", () => {
  if (document.body.classList.contains("is-authenticated")) {
    checkSession({ quiet: true, expired: true });
  }
});

setAuthMode("login");
checkSession({ networkRecovery: true });
