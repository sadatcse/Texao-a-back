import { Router } from "express";
import { getStockByBranch, adjustStock } from "./Stock.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const StockRoutes = Router();

// Get all stock items for a branch
StockRoutes.get("/:branch/get-all", authenticateToken, getStockByBranch);

// Manually adjust the quantity of a stock item
StockRoutes.put("/:branch/adjust", authenticateToken, adjustStock);

export default StockRoutes;