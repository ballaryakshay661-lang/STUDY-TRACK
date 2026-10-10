const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { getAllowedOrigins } = require("./config/origins");
const { parseAuthCookie } = require("./middleware/parseAuthCookie");
const apiRoutes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { createHttpError } = require("./utils/httpError");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (origin && getAllowedOrigins().includes(origin)) {
        callback(null, true);
        return;
      }
      if (!origin) {
        callback(null, false);
        return;
      }
      callback(createHttpError(403, "This origin is not allowed."));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(parseAuthCookie);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.use("/api", apiLimiter, apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
