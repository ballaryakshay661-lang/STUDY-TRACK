const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");
const { createHttpError } = require("../utils/httpError");
const {
  createAccessToken,
  getAccessTokenExpiresAt,
  getJwtConfiguration,
} = require("../utils/jwt");
const { clearAuthCookie, setAuthCookie } = require("../utils/authCookie");

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("studytrack-invalid-user", BCRYPT_ROUNDS);

function getCredentials(request, isRegistration = false) {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError(400, "A JSON object is required.");
  }

  const allowedKeys = isRegistration
    ? ["name", "email", "password"]
    : ["email", "password"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw createHttpError(400, "The request contains an unsupported field.");
  }

  const name =
    typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (isRegistration && (name.length < 1 || name.length > 80)) {
    throw createHttpError(400, "Name must be between 1 and 80 characters.");
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw createHttpError(400, "Enter a valid email address.");
  }
  if (
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    throw createHttpError(
      400,
      "Password must be at least 8 characters and no more than 72 bytes."
    );
  }

  return { name, email, password };
}

function requireDatabase() {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, "Authentication is temporarily unavailable.");
  }
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function register(request, response) {
  const { name, email, password } = getCredentials(request, true);
  getJwtConfiguration();
  requireDatabase();

  try {
    const existingUser = await User.exists({ email });
    if (existingUser) {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });

    const token = createAccessToken(user.id);
    setAuthCookie(response, token);
    response.status(201).json({
      user: toPublicUser(user),
      expiresAt: getAccessTokenExpiresAt(token),
    });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }
}

async function login(request, response) {
  const { email, password } = getCredentials(request);
  getJwtConfiguration();
  requireDatabase();
  const user = await User.findOne({ email }).select("+passwordHash");
  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = createAccessToken(user.id);
  setAuthCookie(response, token);
  response.status(200).json({
    user: toPublicUser(user),
    expiresAt: getAccessTokenExpiresAt(token),
  });
}

async function getCurrentUser(request, response) {
  requireDatabase();
  const user = await User.findById(request.userId);
  if (!user) {
    response.status(401).json({ error: "The account for this token no longer exists." });
    return;
  }
  response.status(200).json({
    user: toPublicUser(user),
    expiresAt: request.authExpiresAt,
  });
}

function logout(request, response) {
  clearAuthCookie(response);
  response.status(204).end();
}

module.exports = { getCurrentUser, login, logout, register };
