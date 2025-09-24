import { Router } from "express";
import {
  createUserRole,
  getAllUserRoles,
  getUserRoleById,
  updateUserRole,
  removeUserRole,
  getUserRolesByBranch,
} from "./UserRoles.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const UserRoleRoutes = Router();

// Public route to get all roles - adjust if authentication is needed
UserRoleRoutes.get("/", getAllUserRoles);

// Authenticated routes
UserRoleRoutes.get("/get-id/:id", authenticateToken, getUserRoleById);
UserRoleRoutes.post("/post", authenticateToken, createUserRole);
UserRoleRoutes.put("/update/:id", authenticateToken, updateUserRole);
UserRoleRoutes.delete("/delete/:id", authenticateToken, removeUserRole);

// Public route to get roles by branch - adjust if needed
UserRoleRoutes.get("/branch/:branch", getUserRolesByBranch);

export default UserRoleRoutes;
