import mongoose from "mongoose";
import colors from "colors";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    console.log("Using existing MongoDB connection".underline.green);
    return;
  }

  try {
    // Configure Mongoose to handle `strictQuery` setting explicitly
    mongoose.set('strictQuery', false); // Use false if you want to allow non-schema fields

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,      // Recommended for parsing MongoDB connection string
      useUnifiedTopology: true,  // Recommended for handling MongoDB's new connection management engine
      maxPoolSize: 10,            // Maintain up to 10 socket connections (optimizes MongoDB Atlas free/paid tiers)
      minPoolSize: 0,             // Scale connections down to 0 when idle in serverless environments
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.underline.green);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`.red.bold);
    throw error; // Throw instead of process.exit(1) in serverless environments
  }
};

export default connectDB;
