import { Router } from "express";
import {
  createIngredientCategory,
  getAllIngredientCategories,
  getIngredientCategoryByBranch,
  getIngredientCategoryById,
  removeIngredientCategory,
  updateIngredientCategory,
  getPaginatedCategoriesByBranch,
  getActiveIngredientCategoriesByBranch,
} from "./IngredientCategory.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const IngredientCategoryRoutes = Router();
IngredientCategoryRoutes.get("/:branch/pagination", authenticateToken, getPaginatedCategoriesByBranch);

// Protect all routes with authentication middleware
IngredientCategoryRoutes.get("/", authenticateToken, getAllIngredientCategories);
IngredientCategoryRoutes.get(
  "/:branch/get-all",

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