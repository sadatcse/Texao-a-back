import { Router } from "express";
import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { createVendorPayment,getPaymentById } from "./VendorPayment.controller.js";

const VendorPaymentRoutes = Router();

// Route to make a payment to a vendor
VendorPaymentRoutes.post("/pay", authenticateToken, createVendorPayment);
VendorPaymentRoutes.get("/get-id/:id", authenticateToken, getPaymentById);

export default VendorPaymentRoutes;