import { Router } from "express";
import {
  createTransactionLog,
  getAllTransactionLogs,
  getTransactionLogById,
  removeTransactionLog,
  getSuperAdminTransactionLogs,
  getPaginatedTransactionLogs,
  getTransactionLogsByBranch,
} from "./TransactionLog.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const TransactionLogRoutes = Router();

// Protect all routes with authentication middleware
TransactionLogRoutes.get("/", authenticateToken, getAllTransactionLogs);
TransactionLogRoutes.get("/paginated", authenticateToken, getPaginatedTransactionLogs);
TransactionLogRoutes.get("/:branch/get-all", authenticateToken, getTransactionLogsByBranch);
TransactionLogRoutes.get("/get-id/:id", authenticateToken, getTransactionLogById);
TransactionLogRoutes.post("/create", authenticateToken, createTransactionLog);
TransactionLogRoutes.delete("/delete/:id", authenticateToken, removeTransactionLog);
TransactionLogRoutes.get("/superadmin/all", authenticateToken, /* adminOnly, */ getSuperAdminTransactionLogs);

export default TransactionLogRoutes;
