import { Router } from "express";
import { getTableStatusByBranch } from "./tableStatusController.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const TableCombineRoutes = Router();

// Protected route to get table status by branch
TableCombineRoutes.get("/tables/status/:branch", getTableStatusByBranch);

export default TableCombineRoutes;