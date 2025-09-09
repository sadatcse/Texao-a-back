import { Router } from "express";
import {
  createRecipe,
  getAllRecipes,
  getRecipeByProductId,
  getRecipesByBranch,
  updateRecipe,
  removeRecipe,
  getRecipeStatusByProductId,
  getProductsWithRecipeStatus,
  getDynamicPrice,
  getIngredientUsageReport,
} from "./Recipe.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const RecipeRoutes = Router();

// RecipeRoutes.use(authenticateToken);

const branchRouter = Router({ mergeParams: true });

branchRouter.get("/", getRecipesByBranch);
branchRouter.get("/product/:productId", getRecipeByProductId);
branchRouter.get("/status/:productId", getRecipeStatusByProductId);
branchRouter.put("/update/:productId", updateRecipe);
branchRouter.delete("/delete/:productId", removeRecipe);
branchRouter.post("/post", createRecipe);
RecipeRoutes.get("/reports/ingredient-usage", getIngredientUsageReport);
RecipeRoutes.use("/branch/:branch", branchRouter);
branchRouter.put("/update/:productId", updateRecipe);
branchRouter.delete("/delete/:productId", removeRecipe);
branchRouter.post("/post", createRecipe);
RecipeRoutes.get("/branch/:branch/products-with-status", getProductsWithRecipeStatus);
RecipeRoutes.get("/", getAllRecipes);
RecipeRoutes.get('/dynamic/:productId', getDynamicPrice);
export default RecipeRoutes;


// http://localhost:8000/api/recipes/branch/teaxo/products-with-status?page=2&limit=10