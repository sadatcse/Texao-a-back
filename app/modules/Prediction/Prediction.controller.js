import { Router } from "express";
import Invoice from "../Invoice/Invoices.model.js";
import Review from "../Review/Review.model.js";
import Recipe from "../Recipe/Recipe.model.js";
import Stock from "../Stock/Stock.model.js";
import moment from 'moment-timezone';
import { generateText } from "../../../config/utils/geminiService.js";

// --- Helper Function to Clean & Parse AI JSON Response ---
const safeJsonParse = (text) => {
    try {
        // Remove markdown code blocks (```json ... ```)
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("JSON Parse Error. Raw text from AI:", text);
        return null; // Return null instead of crashing
    }
};

/**
 * Statistical Prediction (Non-AI)
 */
export async function getSalesPrediction(req, res) {
    const { branch } = req.params;
    const timezone = "Asia/Dhaka";

    try {
        const todayDayOfWeek = moment().tz(timezone).day() + 1;
        const historyEndDate = moment().tz(timezone).startOf('day').toDate();
        const historyStartDate = moment().tz(timezone).subtract(90, 'days').startOf('day').toDate();

        const prediction = await Invoice.aggregate([
            {
                $match: {
                    branch: branch,
                    dateTime: { $gte: historyStartDate, $lt: historyEndDate },
                    $expr: { $eq: [{ $dayOfWeek: { date: "$dateTime", timezone: timezone } }, todayDayOfWeek] }
                }
            },
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.productName",
                    totalQtySold: { $sum: "$products.qty" },
                    distinctSaleDays: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$dateTime", timezone: timezone } } }
                }
            },
            {
                $project: {
                    productName: "$_id",
                    averageQty: {
                        $cond: [{ $eq: [{ $size: "$distinctSaleDays" }, 0] }, 0, { $divide: ["$totalQtySold", { $size: "$distinctSaleDays" }] }]
                    }
                }
            },
            { $sort: { averageQty: -1 } },
            { $limit: 5 },
            {
                $project: {
                    _id: 0,
                    productName: "$productName",
                    predictedQty: { $round: ["$averageQty", 0] }
                }
            }
        ]);

        res.status(200).json(prediction);
    } catch (err) {
        console.error("Error generating sales prediction:", err);
        res.status(500).json({ error: "Failed to generate sales prediction: " + err.message });
    }
}

/**
 * AI Sales Forecast
 */
export async function getAiSalesForecast(req, res) {
    const { branch } = req.params;
    const timezone = "Asia/Dhaka";

    try {
        const todayDayOfWeek = moment().tz(timezone).day() + 1;
        const dayName = moment().tz(timezone).format('dddd');
        const startDate = moment().tz(timezone).subtract(30, 'days').toDate();

        const lastFourWeeksInvoices = await Invoice.aggregate([
            {
                $match: {
                    branch: branch,
                    dateTime: { $gte: startDate },
                    $expr: { $eq: [{ $dayOfWeek: { date: "$dateTime", timezone: timezone } }, todayDayOfWeek] }
                }
            },
            { $unwind: "$products" },
            { $group: { _id: "$products.productName", totalQty: { $sum: "$products.qty" } } },
            { $sort: { totalQty: -1 } },
            { $limit: 20 } // Limit data sent to AI to save tokens
        ]);

        if (lastFourWeeksInvoices.length === 0) {
            return res.status(200).json({ forecast: [] });
        }

        const dataForAi = JSON.stringify(lastFourWeeksInvoices);
        const fullPrompt = `
            You are a restaurant sales forecasting AI. Today is ${dayName}.
            Based on the following JSON data (total qty sold over last 4 ${dayName}s), predict the top 5 items for today.
            DATA: ${dataForAi}
            
            Return a valid JSON Array. Each object must have: "productName", "predictedQty" (number), "reason" (short string).
            No markdown, no plain text.
        `;

        const forecastText = await generateText(fullPrompt);
        const parsedData = safeJsonParse(forecastText);

        if (!parsedData) {
            return res.status(500).json({ error: "Failed to parse AI response" });
        }

        res.status(200).json({ forecast: parsedData });

    } catch (error) {
        console.error("Error generating AI sales forecast:", error);
        res.status(500).json({ error: "Failed to generate AI forecast." });
    }
}

/**
 * AI Insights (Q&A)
 */
export async function getAiInsights(req, res) {
    const { branch } = req.params;
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt is required." });

    try {
        const startDate = moment().subtract(7, 'days').startOf('day').toDate();
        const endDate = moment().endOf('day').toDate();

        const recentInvoices = await Invoice.find({
            branch,
            dateTime: { $gte: startDate, $lte: endDate },
        }).select('products totalAmount dateTime orderType -_id').lean().limit(50); // Limit to prevent token overflow

        if (!recentInvoices.length) {
            return res.status(200).json({ insight: "No data available for the last 7 days." });
        }

        const fullPrompt = `
            Context: Restaurant Sales Data (Last 7 Days).
            Data: ${JSON.stringify(recentInvoices)}
            User Question: "${prompt}"
            Answer concisely based on the data.
        `;

        const insight = await generateText(fullPrompt);
        res.status(200).json({ insight });

    } catch (error) {
        console.error("Error getting AI insight:", error);
        res.status(500).json({ error: "Error generating insight." });
    }
}

/**
 * AI Menu Suggestions
 */
export async function getAiMenuSuggestion(req, res) {
    const { branch } = req.params;
    
    try {
        const startDate = moment().subtract(30, 'days').toDate();

        const productSales = await Invoice.aggregate([
            { $match: { branch: branch, dateTime: { $gte: startDate } } },
            { $unwind: "$products" },
            { $group: { _id: "$products.productName", totalQty: { $sum: "$products.qty" } } },
            { $sort: { totalQty: 1 } } 
        ]);

        if (productSales.length < 5) {
            return res.status(200).json({ suggestion: null });
        }

        const top5 = productSales.slice(-5).reverse();
        const bottom5 = productSales.slice(0, 5);
        
        const dataForAi = JSON.stringify({ 
            top: top5.map(i => ({ name: i._id, qty: i.totalQty })), 
            bottom: bottom5.map(i => ({ name: i._id, qty: i.totalQty })) 
        });

        const fullPrompt = `
            Restaurant Menu Analysis.
            Data: ${dataForAi}
            
            Task:
            1. Create 1 Combo Deal (name, items, price, reason).
            2. Suggestion for 1 underperforming item (name, suggestion).
            
            Return valid JSON object: { "comboSuggestion": {...}, "itemImprovement": {...} }
        `;

        const suggestionText = await generateText(fullPrompt);
        const parsedData = safeJsonParse(suggestionText);
        
        res.status(200).json({ suggestion: parsedData });

    } catch (error) {
        console.error("Error generating menu suggestion:", error);
        res.status(500).json({ error: "Failed to generate menu suggestion." });
    }
}

/**
 * AI Purchase Suggestion
 */
export async function getAiPurchaseSuggestion(req, res) {
    const { branch } = req.params;
    const analysisDays = 30;

    try {
        // [Complex Aggregation to find usage]
        const ingredientUsage = await Invoice.aggregate([
            { $match: { branch, dateTime: { $gte: new Date(Date.now() - analysisDays * 24 * 60 * 60 * 1000) } } },
            { $unwind: "$products" },
            { $group: { _id: "$products.productId", totalSold: { $sum: "$products.qty" } } },
            { $lookup: { from: "recipes", localField: "_id", foreignField: "productId", as: "recipe" } },
            { $unwind: "$recipe" },
            { $unwind: "$recipe.ingredients" },
            {
                $group: {
                    _id: "$recipe.ingredients.ingredientId",
                    name: { $first: "$recipe.ingredients.ingredientName" },
                    unit: { $first: "$recipe.ingredients.unit" },
                    totalConsumed: { $sum: { $multiply: ["$totalSold", "$recipe.ingredients.quantity"] } }
                }
            }
        ]);

        if (ingredientUsage.length === 0) {
            return res.status(200).json({ suggestions: [], message: "No usage data found." });
        }

        const currentStockLevels = await Stock.find({ branch });
        const stockMap = new Map(currentStockLevels.map(item => [item.ingredient.toString(), item.quantityInStock]));

        const urgentItems = ingredientUsage.map(item => {
            const currentStock = stockMap.get(item._id.toString()) || 0;
            const avgDaily = item.totalConsumed / analysisDays;
            const daysLeft = avgDaily > 0 ? currentStock / avgDaily : 999;
            
            return {
                name: item.name,
                unit: item.unit,
                currentStock: currentStock.toFixed(2),
                daysRemaining: daysLeft.toFixed(1)
            };
        }).filter(i => i.daysRemaining < 7).sort((a, b) => a.daysRemaining - b.daysRemaining);

        if (urgentItems.length === 0) {
            return res.status(200).json({ suggestions: [], message: "Stock is healthy." });
        }

        const fullPrompt = `
            Restaurant Inventory Advisor.
            Urgent Items running out soon: ${JSON.stringify(urgentItems.slice(0, 7))}
            
            Task: Suggest purchase quantity for these items.
            Return JSON Array: [{ "name", "currentStock", "unit", "daysRemaining", "suggestedPurchaseQty", "justification" }]
        `;

        const suggestionText = await generateText(fullPrompt);
        const parsedData = safeJsonParse(suggestionText);

        res.status(200).json({ suggestions: parsedData || [] });

    } catch (error) {
        console.error("Error generating purchase suggestion:", error);
        res.status(500).json({ error: "Failed to generate suggestions." });
    }
}

/**
 * AI Review Summary
 */
export async function getAiReviewSummary(req, res) {
    const { branch } = req.params;

    try {
        const recentReviews = await Review.find({ branch })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('text rating -_id')
            .lean();

        if (!recentReviews.length) {
            return res.status(200).json({ summary: null });
        }

        const fullPrompt = `
            Analyze these restaurant reviews: ${JSON.stringify(recentReviews)}
            
            Return JSON object: 
            { 
                "overallSentiment": "string", 
                "topPositives": ["string", "string", "string"], 
                "topNegatives": ["string", "string", "string"] 
            }
        `;

        const summaryText = await generateText(fullPrompt);
        const parsedData = safeJsonParse(summaryText);

        res.status(200).json({ summary: parsedData });

    } catch (error) {
        console.error("Error generating review summary:", error);
        res.status(500).json({ error: "Failed to generate summary." });
    }
}