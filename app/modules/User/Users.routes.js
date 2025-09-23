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

UserRoutes.get("/superadmin/all", authenticateToken, /* adminOnly, */ getSuperAdminUsers);

UserRoutes.put("/change-password", authenticateToken, changePassword);

UserRoutes.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google callback route
UserRoutes.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful login, send the JWT token
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, 'secretKey', { expiresIn: '24h' });
    res.status(200).json({ message: 'Google login successful', user: req.user, token });
  }
);

// Facebook login route
UserRoutes.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

// Facebook callback route
UserRoutes.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful login, send the JWT token
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, 'secretKey', { expiresIn: '24h' });
    res.status(200).json({ message: 'Facebook login successful', user: req.user, token });
  }
);

export default UserRoutes;
