import express from "express";
import environment from "dotenv";
import cors from "cors";
import http from "http"; // Import the http module
import { Server } from "socket.io"; // Import Server from socket.io

import fileUpload from "express-fileupload";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import routes from "./routes/routes.js";
import path from "path";
import passport from "passport";
import { initScheduledJobs } from './services/scheduler.js';
// import { startAutoOrderPosting } from './services/autoPoster.js';
// Load environment variables
environment.config();

const app = express();
const port = process.env.PORT || 5000;

// Connect to the database
connectDB();

// --- Socket.IO Setup ---
// Create an HTTP server using the Express app
const server = http.createServer(app);
// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173','https://pos.chefsspecial.restaurant', 'http://localhost:3000', 'https://pos.teaxo.com.bd', 'http://pos.teaxo.com.bd', 'http://192.168.0.167:3000'],
    credentials: true,
  },
});

// Pass the Socket.IO instance to the request object so it's available in route handlers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.IO connection event
io.on('connection', (socket) => {

  // Listen for a "join-branch" event from the client
  socket.on('join-branch', (branchName) => {
    socket.join(branchName);

  });

  // Listen for disconnects
  socket.on('disconnect', () => {

  });
});

// --- End of Socket.IO Setup ---

// Security middleware
app.use(helmet({
  hidePoweredBy: true,
}));

app.use(passport.initialize());

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes
//   max: 10000, // Limit each IP to 100 requests
// });
// app.use(limiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://pos.teaxo.com.bd',
  'http://pos.teaxo.com.bd',
  'http://192.168.0.167:3000/'
];
app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  })
);
// Static files
app.use(express.static("public"));
// Routes
app.use("/api", routes);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({ message: "Server is running." });
});

// Error handling middleware
app.use(errorHandler);

// Start server
server.listen(port, () => {
  console.log(`Server started at ${new Date()}`);
  console.log(`Server listening on port ${port}`);
  initScheduledJobs();
  // startAutoOrderPosting();
  
});
