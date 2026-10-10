const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");

const origin = "http://127.0.0.1:5500";
const password = "correct-horse-42";
const usersByEmail = new Map();
const originalReadyState = mongoose.connection.readyState;
const originalEnvironment = {
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
};
const originalMethods = {
  create: User.create,
  exists: User.exists,
  findById: User.findById,
  findOne: User.findOne,
};
let server;
let baseUrl;
let loggedInCookie;

function makeUser(data) {
  return {
    id: new mongoose.Types.ObjectId().toString(),
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    createdAt: new Date(),
    comparePassword: User.schema.methods.comparePassword,
  };
}

async function send(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

describe("authentication endpoints", { concurrency: false }, () => {
  before(async () => {
    process.env.JWT_SECRET = "test-only-secret-with-at-least-32-bytes";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.FRONTEND_ORIGIN = origin;
    process.env.NODE_ENV = "test";
    mongoose.connection.readyState = 1;

    User.exists = async ({ email }) => usersByEmail.has(email);
    User.create = async (data) => {
      if (usersByEmail.has(data.email)) {
        const error = new Error("duplicate");
        error.code = 11000;
        throw error;
      }
      const user = makeUser(data);
      usersByEmail.set(user.email, user);
      return user;
    };
    User.findOne = ({ email }) => ({
      select: async () => usersByEmail.get(email) || null,
    });
    User.findById = async (id) =>
      [...usersByEmail.values()].find((user) => user.id === id) || null;

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    User.create = originalMethods.create;
    User.exists = originalMethods.exists;
    User.findById = originalMethods.findById;
    User.findOne = originalMethods.findOne;
    mongoose.connection.readyState = originalReadyState;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it("registers a normalized user and sets an HttpOnly cookie", async () => {
    const response = await send("/api/auth/register", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        name: "  Alex Student  ",
        email: "  ALEX@Example.com ",
        password,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.user.name, "Alex Student");
    assert.equal(body.user.email, "alex@example.com");
    assert.ok(body.expiresAt > Date.now());
    assert.match(
      usersByEmail.get("alex@example.com").passwordHash,
      /^\$2[aby]\$12\$/
    );
    assert.equal("passwordHash" in body.user, false);
    assert.equal("accessToken" in body, false);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  });

  it("rejects duplicate normalized email addresses", async () => {
    const response = await send("/api/auth/register", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        name: "Another Name",
        email: "ALEX@example.com",
        password,
      }),
    });

    assert.equal(response.status, 409);
  });

  it("validates registration input and rejects untrusted origins", async () => {
    const invalidInput = await send("/api/auth/register", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        name: "",
        email: "not-an-email",
        password: "short",
      }),
    });
    const untrustedOrigin = await send("/api/auth/register", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
      body: JSON.stringify({
        name: "Alex",
        email: "alex@example.com",
        password,
      }),
    });

    assert.equal(invalidInput.status, 400);
    assert.equal(untrustedOrigin.status, 403);
  });

  it("logs in and uses the same generic error for invalid credentials", async () => {
    process.env.NODE_ENV = "production";
    const loginResponse = await send("/api/auth/login", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({ email: "alex@example.com", password }),
    });
    assert.equal(loginResponse.status, 200);
    assert.ok((await loginResponse.clone().json()).expiresAt > Date.now());
    const loginCookie = loginResponse.headers.get("set-cookie");
    assert.match(loginCookie, /Secure/i);
    loggedInCookie = loginCookie.split(";")[0];
    process.env.NODE_ENV = "test";

    const invalidPassword = await send("/api/auth/login", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        email: "alex@example.com",
        password: "wrong-pass-123",
      }),
    });
    const unknownEmail = await send("/api/auth/login", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        email: "unknown@example.com",
        password,
      }),
    });

    assert.equal(invalidPassword.status, 401);
    assert.deepEqual(await invalidPassword.json(), await unknownEmail.json());
  });

  it("requires authentication to read the current user", async () => {
    const response = await send("/api/auth/me", {
      headers: { Cookie: loggedInCookie },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.email, "alex@example.com");
    assert.ok(body.expiresAt > Date.now());
    assert.equal("passwordHash" in body.user, false);

    const unauthenticated = await send("/api/auth/me");
    assert.equal(unauthenticated.status, 401);
  });

  it("logs out by clearing the cookie", async () => {
    const response = await send("/api/auth/logout", {
      method: "POST",
      headers: { Origin: origin },
    });

    assert.equal(response.status, 204);
    assert.match(
      response.headers.get("set-cookie"),
      /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i
    );
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  });
});
