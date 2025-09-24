import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserByBranch,
  getUserById,
  removeUser,
  updateUser,
  loginUser,
  updateUserProfile,
  logoutUser,
  getSuperAdminUsers,
  updateUserSimple,
  getRolesByBranch,
  changePassword,
} from "./Users.controller.js";
import jwt from "jsonwebtoken";
import passport from 'passport';
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 




const UserRoutes = Router();

// Public routes (no authentication required)
UserRoutes.post("/login", loginUser); // Login does not require a token
UserRoutes.post("/post", createUser); // If creating a user should also be public

// Protected routes (require authentication)
UserRoutes.get("/", authenticateToken, getAllUsers);
UserRoutes.get("/:branch/get-all", authenticateToken, getUserByBranch);
UserRoutes.get("/get-id/:id", authenticateToken, getUserById);
UserRoutes.post("/logout", authenticateToken, logoutUser);
UserRoutes.delete("/delete/:id", authenticateToken, removeUser);
UserRoutes.put("/update/:id", authenticateToken, updateUser);

UserRoutes.put("/updateuser/:id", authenticateToken, updateUserProfile);

UserRoutes.put("/updatea/:id", authenticateToken, updateUserSimple);


UserRoutes.get("/superadmin/all", authenticateToken, /* adminOnly, */ getSuperAdminUsers);

UserRoutes.put("/change-password", authenticateToken, changePassword);

UserRoutes.get("/roles/:branch", authenticateToken, getRolesByBranch); 

export default UserRoutes;
