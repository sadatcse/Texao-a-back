import { Router } from "express";
import {
    submitReview,
    getAllReviews,
    checkCustomerByMobile,
    prepareReviewPage,
    getReviewsByBranch
} from "./Review.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js"; // Assuming middleware path

const ReviewRoutes = Router();

// Public route for customers to prepare the review page with order data
ReviewRoutes.get("/prepare/:branch/:tableName", prepareReviewPage);

// Public route to check if a customer exists by mobile
ReviewRoutes.get("/customer/check/:mobile", checkCustomerByMobile);

// Public route for customers to submit reviews
ReviewRoutes.post("/submit", submitReview);

// Protected route for management to see all reviews (can also filter by ?branch=xyz)
ReviewRoutes.get("/", authenticateToken, getAllReviews);

// Protected route for management to get reviews for a specific branch
ReviewRoutes.get("/branch/:branch", authenticateToken, getReviewsByBranch);


export default ReviewRoutes;

