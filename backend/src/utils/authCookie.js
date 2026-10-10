const COOKIE_NAME = "studytrack_auth";
const COOKIE_PATH = "/api/auth";

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
  };
}

function getCookieOptions() {
  const { maxAge } = require("./jwt").getJwtConfiguration();
  return { ...getBaseCookieOptions(), maxAge };
}

function setAuthCookie(response, token) {
  response.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(response) {
  response.clearCookie(COOKIE_NAME, getBaseCookieOptions());
}

module.exports = { clearAuthCookie, setAuthCookie };
