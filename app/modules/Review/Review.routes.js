import { Router } from "express";
import {
    submitReview,
    getAllReviews,
    checkCustomerByMobile,
    prepareReviewPage,
    prepareReviewPageByInvoice,
    deleteReview,
    getReviewsByBranch
} from "./Review.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; 

const ReviewRoutes = Router();


ReviewRoutes.get("/prepare/table/:tableId", prepareReviewPage); //public

ReviewRoutes.get("/prepare/invoice/:invoiceId", prepareReviewPageByInvoice); //public

ReviewRoutes.get("/customer/check/:mobile", checkCustomerByMobile);


ReviewRoutes.post("/submit", submitReview);


ReviewRoutes.get("/", authenticateToken, getAllReviews);


ReviewRoutes.get("/branch/:branch", getReviewsByBranch);

ReviewRoutes.delete("/:id", authenticateToken, deleteReview);
export default ReviewRoutes;

