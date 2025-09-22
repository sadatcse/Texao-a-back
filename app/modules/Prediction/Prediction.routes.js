import { Router } from "express";
import { 
    getSalesPrediction, 
    getAiInsights, 
    getAiSalesForecast,
    getAiMenuSuggestion,
    getAiReviewSummary
} from "./Prediction.controller.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const PredictionRoutes = Router();


PredictionRoutes.get("/:branch/sales", authenticateToken, getSalesPrediction);

PredictionRoutes.post("/:branch/insights", authenticateToken, getAiInsights);


PredictionRoutes.get("/:branch/sales-forecast", authenticateToken, getAiSalesForecast);


PredictionRoutes.get("/:branch/menu-suggestion", authenticateToken, getAiMenuSuggestion);

PredictionRoutes.get("/:branch/review-summary", authenticateToken, getAiReviewSummary);


export default PredictionRoutes;