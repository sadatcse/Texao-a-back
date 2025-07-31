import { Router } from "express";
import {
  createTable,
  getAllTables,
  getTableById,
  updateTable,
  removeTable,
  getTablesByBranch,
} from "./Tables.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const TableRoutes = Router();

// Protect all routes with authentication middleware
TableRoutes.get("/", getAllTables);
TableRoutes.get("/get-id/:id", authenticateToken, getTableById);
TableRoutes.post("/post", authenticateToken, createTable);
TableRoutes.put("/update/:id", authenticateToken, updateTable);
TableRoutes.delete("/delete/:id", authenticateToken, removeTable);
TableRoutes.get("/branch/:branch", getTablesByBranch);

export default TableRoutes;
