import { Router } from "express";
import {
  createIngredient,
  getAllIngredients,
  getIngredientByBranch,
  getIngredientById,
  removeIngredient,
  updateIngredient,
  getActiveIngredientsByBranch,
} from "./Ingredient.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const IngredientRoutes = Router();

// Protect all routes with authentication middleware
IngredientRoutes.get("/", authenticateToken, getAllIngredients);
IngredientRoutes.get(
  "/:branch/get-all",
  authenticateToken,
  getIngredientByBranch
);
IngredientRoutes.get("/get-id/:id", authenticateToken, getIngredientById);
IngredientRoutes.post("/post", authenticateToken, createIngredient);
IngredientRoutes.delete("/delete/:id", authenticateToken, removeIngredient);
IngredientRoutes.put("/update/:id", authenticateToken, updateIngredient);
IngredientRoutes.get(
  "/:branch/active",
  authenticateToken,
  getActiveIngredientsByBranch
);

export default IngredientRoutes;