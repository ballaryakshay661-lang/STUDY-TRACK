function getAllowedOrigins() {
  return (process.env.FRONTEND_ORIGIN ||
    "http://127.0.0.1:5500,http://localhost:5500")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

module.exports = { getAllowedOrigins };
