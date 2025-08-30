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
  getFilteredSearchInvoices,
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

// Function to handle the update and emit a Socket.IO event
const handleUpdateAndEmit = async (req, res, next) => {
  try {
    const updatedInvoice = await updateInvoice(req, res, next);
    if (updatedInvoice && updatedInvoice.branch) {
      // Get the socket.io instance from the request
      const io = req.io;
      // Emit an event to all clients in the specific branch room
      io.to(updatedInvoice.branch).emit('kitchen-update');
    }
  } catch (error) {
    next(error); // Pass the error to the Express error handler
  }
};

const handleFinalizeAndEmit = async (req, res, next) => {
  try {
    const finalizedInvoice = await finalizeInvoice(req, res, next);
    if (finalizedInvoice && finalizedInvoice.branch) {
      const io = req.io;
      io.to(finalizedInvoice.branch).emit('kitchen-update');
    }
  } catch (error) {
    next(error);
  }
};


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
InvoiceRoutes.get("/:branch/filtered-search", getFilteredSearchInvoices);

InvoiceRoutes.put("/finalize/:id", handleFinalizeAndEmit);
InvoiceRoutes.put("/update/:id", handleUpdateAndEmit);
InvoiceRoutes.post("/post", createInvoice);

InvoiceRoutes.get("/:branch/filter", getFilteredInvoices);
InvoiceRoutes.delete("/delete/:id", removeInvoice);

InvoiceRoutes.get("/:branch/weekly-sales", getWeeklySalesByMonth);

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
