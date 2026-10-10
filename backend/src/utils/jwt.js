const jwt = require("jsonwebtoken");
const { createHttpError } = require("./httpError");

function getJwtConfiguration() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw createHttpError(
      503,
      "Authentication is unavailable until a secure JWT_SECRET is configured."
    );
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
  if (!/^[1-9]\d*[smhd]$/.test(expiresIn)) {
    throw new Error("JWT_EXPIRES_IN must be a positive duration such as 15m, 1h, or 7d.");
  }

  const duration = Number.parseInt(expiresIn, 10);
  const unit = expiresIn.at(-1);
  const unitInSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  const maxAge = duration * unitInSeconds * 1000;
  if (!Number.isSafeInteger(maxAge) || maxAge > 24 * 60 * 60 * 1000) {
    throw new Error("JWT_EXPIRES_IN must not exceed 24 hours.");
  }

  return { secret, expiresIn, maxAge };
}

function createAccessToken(userId) {
  const { secret, expiresIn } = getJwtConfiguration();
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: userId,
    issuer: "studytrack-api",
    audience: "studytrack",
    expiresIn,
  });
}

function getAccessTokenExpiresAt(token) {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === "string" || typeof payload.exp !== "number") {
    throw new Error("The generated access token is missing an expiration.");
  }
  return payload.exp * 1000;
}

module.exports = {
  createAccessToken,
  getAccessTokenExpiresAt,
  getJwtConfiguration,
};
