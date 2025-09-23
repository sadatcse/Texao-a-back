import { Router } from "express";
import {
  createPurchase,
  getPurchasesByBranch,
  getPurchaseById,
  updatePurchase,
  removePurchase,
  getNextInvoiceNumber,
  getPurchaseAnalysis,
   getVendorLedger,         
  getVendorsWithBalances 
} from "./Purchase.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const PurchaseRoutes = Router();

PurchaseRoutes.post("/post", authenticateToken, createPurchase);
PurchaseRoutes.get("/:branch/get-all", authenticateToken, getPurchasesByBranch);
PurchaseRoutes.get("/get-id/:id", authenticateToken, getPurchaseById);
PurchaseRoutes.get("/next-invoice/:branch", authenticateToken, getNextInvoiceNumber);
PurchaseRoutes.get("/analysis/:branch",  getPurchaseAnalysis);
PurchaseRoutes.put("/update/:id", authenticateToken, updatePurchase);
PurchaseRoutes.delete("/delete/:id", authenticateToken, removePurchase);
PurchaseRoutes.get("/vendor-ledger/:vendorId", authenticateToken, getVendorLedger);
PurchaseRoutes.get("/vendor-balances/:branch", authenticateToken, getVendorsWithBalances);
export default PurchaseRoutes;