// src/api/Stock/Stock.routes.js

import { Router } from "express";
import {
    getStockByBranch,
    adjustStock,
    getStockMovements,
    updateStockAlert
} from "./Stock.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; // Adjust path as needed

const StockRoutes = Router();

// Get all stock items for a branch with filtering and pagination
StockRoutes.get("/:branch/get-all", getStockByBranch);

// Adjust a specific stock item's quantity
StockRoutes.put("/adjust", authenticateToken, adjustStock);

// Get movement history for a single stock item
StockRoutes.get("/:stockId/movements", authenticateToken, getStockMovements);

// Update the stock alert level for an ingredient
StockRoutes.put("/ingredient/:ingredientId/alert", authenticateToken, updateStockAlert);

export default StockRoutes;