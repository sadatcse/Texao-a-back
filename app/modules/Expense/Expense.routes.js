import { Router } from "express";
import {
  createExpense,
  getAllExpenses,
  getExpenseByBranch,
  getExpenseById,
  removeExpense,
  updateExpense,
} from "./Expense.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const ExpenseRoutes = Router();

// Protect all routes with authentication middleware
ExpenseRoutes.get("/", authenticateToken, getAllExpenses);
ExpenseRoutes.get("/:branch/get-all", authenticateToken, getExpenseByBranch);
ExpenseRoutes.get("/get-id/:id", authenticateToken, getExpenseById);
ExpenseRoutes.post("/post", authenticateToken, createExpense);
ExpenseRoutes.delete("/delete/:id", authenticateToken, removeExpense);
ExpenseRoutes.put("/update/:id", authenticateToken, updateExpense);

export default ExpenseRoutes;