function parseAuthCookie(request, response, next) {
  const cookieHeader = request.get("cookie") || "";
  const authCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("studytrack_auth="));

  if (authCookie) {
    request.cookies = {
      studytrack_auth: authCookie.slice("studytrack_auth=".length),
    };
  }
  next();
}

module.exports = { parseAuthCookie };
