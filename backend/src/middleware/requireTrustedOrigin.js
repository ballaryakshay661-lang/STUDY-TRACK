const { getAllowedOrigins } = require("../config/origins");
const { createHttpError } = require("../utils/httpError");

function requireTrustedOrigin(request, response, next) {
  const origin = request.get("origin");
  if (!origin || !getAllowedOrigins().includes(origin)) {
    next(createHttpError(403, "This origin is not allowed."));
    return;
  }
  next();
}

module.exports = { requireTrustedOrigin };
