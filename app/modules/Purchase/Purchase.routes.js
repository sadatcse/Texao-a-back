import { Router } from "express";
import {
  createPurchase,
  getPurchasesByBranch,
  getPurchaseById,
  updatePurchase,
  removePurchase,
  getNextInvoiceNumber
} from "./Purchase.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const PurchaseRoutes = Router();

PurchaseRoutes.post("/post", authenticateToken, createPurchase);
PurchaseRoutes.get("/:branch/get-all", authenticateToken, getPurchasesByBranch);
PurchaseRoutes.get("/get-id/:id", authenticateToken, getPurchaseById);
PurchaseRoutes.get("/next-invoice/:branch", authenticateToken, getNextInvoiceNumber);

// Basic update/delete routes. Note: These do not adjust stock.
PurchaseRoutes.put("/update/:id", authenticateToken, updatePurchase);
PurchaseRoutes.delete("/delete/:id", authenticateToken, removePurchase);

export default PurchaseRoutes;