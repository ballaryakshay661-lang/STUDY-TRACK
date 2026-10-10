require("dotenv").config();

const app = require("./app");
const { connectDB } = require("./config/db");

const port = Number(process.env.PORT) || 5000;

async function startServer() {
  if (process.env.MONGODB_URI) {
    await connectDB();
  } else {
    console.warn("MONGODB_URI is not set; starting without a database connection.");
  }

  app.listen(port, () => {
    console.log(`StudyTrack API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("StudyTrack API could not start.", error);
  process.exitCode = 1;
});
