import { Router } from "express";
import {
  createIngredientCategory,
  getAllIngredientCategories,
  getIngredientCategoryByBranch,
  getIngredientCategoryById,
  removeIngredientCategory,
  updateIngredientCategory,
  getActiveIngredientCategoriesByBranch,
} from "./IngredientCategory.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const IngredientCategoryRoutes = Router();

// Protect all routes with authentication middleware
IngredientCategoryRoutes.get("/", authenticateToken, getAllIngredientCategories);
IngredientCategoryRoutes.get(
  "/:branch/get-all",
  authenticateToken,
  getIngredientCategoryByBranch
);
IngredientCategoryRoutes.get(
  "/get-id/:id",
  authenticateToken,
  getIngredientCategoryById
);
IngredientCategoryRoutes.post(
  "/post",
  authenticateToken,
  createIngredientCategory
);
IngredientCategoryRoutes.delete(
  "/delete/:id",
  authenticateToken,
  removeIngredientCategory
);
IngredientCategoryRoutes.put(
  "/update/:id",
  authenticateToken,
  updateIngredientCategory
);
IngredientCategoryRoutes.get(
  "/:branch/active",
  authenticateToken,
  getActiveIngredientCategoriesByBranch
);

export default IngredientCategoryRoutes;