import { Router } from "express";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByBranch,
  removeInvoice,
  updateInvoice,
  getDashboardByBranch,
  getItemByBranch,
  getInvoicesByCounterDate,
  getPendingByBranch,
  getInvoicesByDateRange,
  getTrendingProducts,
  getdatesByBranch,
  finalizeInvoice,
  getMonthlyOrderTimings,
  getWeeklySalesByMonth,
  getFavoriteProductsByDay,
  getFilteredInvoices,
  getKitchenOrdersByBranch,
  getSalesGroupedByDayName,
  getSalesByDateRange,
  gettop5InvoicesByBranch,
} from "./Invoices.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 
const InvoiceRoutes = Router();
// InvoiceRoutes.use(authenticateToken);

// Get all invoices
InvoiceRoutes.get("/", getAllInvoices);

InvoiceRoutes.get("/:branch/dashboard", getDashboardByBranch);

InvoiceRoutes.get("/:branch/item", getItemByBranch);
// Get invoices by branch
InvoiceRoutes.get("/:branch/get-all", getInvoicesByBranch);

InvoiceRoutes.get("/:branch/top5", gettop5InvoicesByBranch);

InvoiceRoutes.get("/:branch/date/:date", getdatesByBranch);

InvoiceRoutes.get("/:branch/status/:status", getPendingByBranch);
// Get invoice by ID
InvoiceRoutes.get("/get-id/:id", getInvoiceById);

InvoiceRoutes.put("/finalize/:id", finalizeInvoice);
// Create a new invoice
InvoiceRoutes.post("/post", createInvoice);

InvoiceRoutes.get("/:branch/filter", getFilteredInvoices);
InvoiceRoutes.delete("/delete/:id", removeInvoice);

InvoiceRoutes.get("/:branch/weekly-sales", getWeeklySalesByMonth);

InvoiceRoutes.put("/update/:id", updateInvoice);
InvoiceRoutes.get("/:branch/monthly-item-sales", getSalesGroupedByDayName);

InvoiceRoutes.get("/:branch/date-range", getInvoicesByDateRange);
// InvoiceRoutes.get("/:branch/performance", getProductPerformance);
InvoiceRoutes.get("/:branch/:counter/date-range", getInvoicesByCounterDate);
InvoiceRoutes.get("/:branch/favorite-products", getFavoriteProductsByDay);
InvoiceRoutes.get("/:branch/trending-orders", getTrendingProducts);
InvoiceRoutes.get("/:branch/order-timings", getMonthlyOrderTimings);
InvoiceRoutes.get("/:branch/sales", getSalesByDateRange);
InvoiceRoutes.get("/:branch/kitchen", getKitchenOrdersByBranch);
export default InvoiceRoutes;
