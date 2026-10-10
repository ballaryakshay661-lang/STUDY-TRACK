const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI must be configured before connecting to MongoDB.");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  return mongoose.connection;
}

module.exports = { connectDB };
