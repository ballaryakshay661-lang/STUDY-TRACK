const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  getCurrentUser,
  login,
  logout,
  register,
} = require("../controllers/authController");
const { requireTrustedOrigin } = require("../middleware/requireTrustedOrigin");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

router.use((request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
router.use(authLimiter);
router.post("/register", requireTrustedOrigin, register);
router.post("/login", requireTrustedOrigin, login);
router.get("/me", requireAuth, getCurrentUser);
router.post("/logout", requireTrustedOrigin, logout);

module.exports = router;
