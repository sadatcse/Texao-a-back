import { Router } from "express";
import {
    createProduct,
    getAllProducts,
    getProductsByCategory,
    getProductById,
    removeProduct,
    getProductsByCategoryAndBranch,
    updateProduct,
    getProductsByBranch,
    searchProductsByBranch // Import the new controller function
} from "./Product.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const ProductRoutes = Router();

// Protect all routes with authentication middleware
ProductRoutes.get("/", authenticateToken, getAllProducts);
ProductRoutes.get("/:category/get-all", authenticateToken, getProductsByCategory);
ProductRoutes.get("/branch/:branch/get-all", authenticateToken, getProductsByBranch);
ProductRoutes.get("/branch/:branch/category/:category/get-all", authenticateToken, getProductsByCategoryAndBranch);
ProductRoutes.get("/get-id/:id", authenticateToken, getProductById);
ProductRoutes.post("/post", authenticateToken, createProduct);
ProductRoutes.delete("/delete/:id", authenticateToken, removeProduct);
ProductRoutes.put("/update/:id", authenticateToken, updateProduct);

// New route for searching products by branch
ProductRoutes.get("/search", authenticateToken, searchProductsByBranch);

export default ProductRoutes;