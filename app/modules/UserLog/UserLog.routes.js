import { Router } from "express";
import {
  createUserLog,
  getAllUserLogs,
  getUserLogById,
  updateUserLog,
  removeUserLog,
  getPaginatedUserLogs,
  getUserLogsByBranch,
} from "./UserLog.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const UserLogRoutes = Router();

// Get all user logs (Protected)
UserLogRoutes.get("/", authenticateToken, getAllUserLogs);

// Get user logs by branch (Protected)
UserLogRoutes.get("/:branch/get-all", authenticateToken, getUserLogsByBranch);

// Get user log by ID (Protected)
UserLogRoutes.get("/get-id/:id", authenticateToken, getUserLogById);

// Delete a user log by ID (Protected)
UserLogRoutes.delete("/delete/:id", authenticateToken, removeUserLog);

// Get paginated user logs (Protected)
UserLogRoutes.get("/paginated", authenticateToken, getPaginatedUserLogs);

export default UserLogRoutes;
