import { Router } from "express";
import {
  createVendor,
  getAllVendors,
  getVendorByBranch,
  getVendorById,
  removeVendor,
  updateVendor,
  getVendorLedger,
  getActiveVendorsByBranch,
} from "./Vendor.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const VendorRoutes = Router();

// Protect all routes with authentication middleware
VendorRoutes.get("/", authenticateToken, getAllVendors);
VendorRoutes.get("/:branch/get-all", authenticateToken, getVendorByBranch);
VendorRoutes.get("/get-id/:id", authenticateToken, getVendorById);
VendorRoutes.post("/post", authenticateToken, createVendor);
VendorRoutes.delete("/delete/:id", authenticateToken, removeVendor);
VendorRoutes.put("/update/:id", authenticateToken, updateVendor);
VendorRoutes.get("/:branch/active", authenticateToken, getActiveVendorsByBranch);
VendorRoutes.get("/ledger/:vendorId", authenticateToken, getVendorLedger);

export default VendorRoutes;