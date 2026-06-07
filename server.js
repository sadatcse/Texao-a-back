import express from "express";
import environment from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import fileUpload from "express-fileupload";
import helmet from "helmet";
import passport from "passport";

import connectDB from "./config/db.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import routes from "./routes/routes.js";

import { initScheduledJobs } from "./services/scheduler.js";
import { startAutoOrderPosting } from "./services/autoPoster.js";
import { runJanuarySeeder } from "./routes/seedController.js";

// Load env
environment.config();

const app = express();
const port = process.env.PORT || 5000;

// Database connection
connectDB();


const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://teaxo-pos-client.vercel.app",
  "http://teaxo-pos-client.vercel.app",
  "https://pos.chefsspecial.restaurant",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true,
};



const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket connection
io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  socket.on("join-branch", (branchName) => {
    socket.join(branchName);

    console.log(`Socket ${socket.id} joined ${branchName}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket Disconnected:", socket.id);
  });
});



app.use(
  helmet({
    hidePoweredBy: true,
  })
);

app.use(passport.initialize());

// Apply same CORS everywhere
app.use(cors(corsOptions));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload
app.use(
  fileUpload({
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  })
);

app.use(express.static("public"));


app.use("/api", routes);

app.get("/api/admin/seed-january", runJanuarySeeder);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Server is running.",
  });
});



app.use(errorHandler);



server.listen(port, () => {
  console.log(`Server started at ${new Date()}`);
  console.log(`Listening on port ${port}`);

  initScheduledJobs();
  startAutoOrderPosting();
});