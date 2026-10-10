const jwt = require("jsonwebtoken");
const { createHttpError } = require("../utils/httpError");
const { getJwtConfiguration } = require("../utils/jwt");

function requireAuth(request, response, next) {
  const token = request.cookies && request.cookies.studytrack_auth;
  if (typeof token !== "string" || token.length === 0) {
    next(createHttpError(401, "Authentication is required."));
    return;
  }

  try {
    const { secret } = getJwtConfiguration();
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "studytrack-api",
      audience: "studytrack",
    });
    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw createHttpError(401, "The authentication token is invalid.");
    }

    request.userId = payload.sub;
    request.authExpiresAt = payload.exp * 1000;
    next();
  } catch (error) {
    if (error.statusCode) {
      next(error);
      return;
    }
    next(createHttpError(401, "Authentication is invalid or has expired."));
  }
}

module.exports = { requireAuth };
