import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryByBranch,
  getCategoryById,
  removeCategory,
  updateCategory,
  getActiveCategoriesByBranch,
} from "./Catagories.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const CategoryRoutes = Router();

// Protect all routes with authentication middleware
CategoryRoutes.get("/", authenticateToken, getAllCategories);
CategoryRoutes.get("/:branch/get-all",  getCategoryByBranch);
CategoryRoutes.get("/get-id/:id", authenticateToken, getCategoryById);
CategoryRoutes.post("/post", authenticateToken, createCategory);
CategoryRoutes.delete("/delete/:id", authenticateToken, removeCategory);
CategoryRoutes.put("/update/:id", authenticateToken, updateCategory);
CategoryRoutes.get("/:branch/active", authenticateToken, getActiveCategoriesByBranch);

export default CategoryRoutes;
