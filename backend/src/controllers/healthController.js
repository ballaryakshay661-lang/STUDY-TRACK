const mongoose = require("mongoose");

function getHealth(request, response) {
  const databaseConnected = mongoose.connection.readyState === 1;
  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "unavailable",
    service: "studytrack-api",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
