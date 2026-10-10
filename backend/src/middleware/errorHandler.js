function notFoundHandler(request, response, next) {
  next(new Error("Route not found.", { cause: { statusCode: 404 } }));
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || error.status || error.cause?.statusCode || 500;
  const message = error.expose
    ? error.message
    : statusCode >= 500
      ? "An unexpected server error occurred."
      : "Invalid request.";

  if (statusCode >= 500) {
    console.error("StudyTrack API request failed.", error);
  }

  response.status(statusCode).json({ error: message });
}

module.exports = { errorHandler, notFoundHandler };
