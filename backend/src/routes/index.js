const express = require("express");
const authRoutes = require("./authRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);

module.exports = router;
