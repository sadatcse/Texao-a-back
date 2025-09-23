import { Router } from "express";
import { getIngredientAveragePriceByMonth ,getStockSalesComparison,getProfitAndLoss ,getIngredientPriceAnalysis } from "./Report.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const ReportRoutes = Router();

// Route to get the monthly average price of ingredients
// Can be filtered by branch: /reports/average-ingredient-price?branch=main
ReportRoutes.get( "/average-ingredient-price", authenticateToken, getIngredientAveragePriceByMonth );
ReportRoutes.get("/ingredient-price-analysis", authenticateToken, getIngredientPriceAnalysis);
ReportRoutes.get("/profit-loss/:branch", authenticateToken, getProfitAndLoss);
ReportRoutes.get("/stock-sales-comparison/:branch", authenticateToken, getStockSalesComparison);

export default ReportRoutes;