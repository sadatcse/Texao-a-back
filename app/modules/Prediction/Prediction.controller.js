import Invoice from "../Invoice/Invoices.model.js";
import Review from "../Review/Review.model.js";
import moment from 'moment-timezone';
import { generateText } from "../../../config/utils/geminiService.js";
import Recipe from "../Recipe/Recipe.model.js";
import Stock from "../Stock/Stock.model.js";
/**
 * Statistical Prediction based on historical day-of-week data.
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

export async function getAiInsights(req, res) {
    const { branch } = req.params;
    const { prompt } = req.body; // The question from the user

    if (!prompt) {
        return res.status(400).json({ error: "A prompt (question) is required." });
    }

    try {
        // 1. Fetch relevant data from your database.
        // For example, let's get the last 7 days of sales data.
        const startDate = moment().subtract(7, 'days').startOf('day').toDate();
        const endDate = moment().endOf('day').toDate();

        const recentInvoices = await Invoice.find({
            branch,
            dateTime: { $gte: startDate, $lte: endDate },
        }).select('products totalAmount dateTime orderType -_id').lean();

        if (recentInvoices.length === 0) {
            return res.status(200).json({ insight: "There is no sales data from the last 7 days to analyze." });
        }

        // 2. Format the data and construct a detailed prompt for Gemini.
        const dataForAi = JSON.stringify(recentInvoices, null, 2);
        const fullPrompt = `
            You are an expert restaurant business analyst. Based on the following JSON data of sales invoices from the last 7 days, please answer the user's question.
            
            USER'S QUESTION: "${prompt}"

            SALES DATA:
            ${dataForAi}

            Provide a concise, insightful answer based *only* on the data provided.
        `;

        // 3. Call the Gemini service
        const insight = await generateText(fullPrompt);

        // 4. Send the AI-generated insight back to the client
        res.status(200).json({ insight });

    } catch (error) {
        console.error("Error getting AI insight:", error);
        res.status(500).json({ error: "An error occurred while generating the AI insight." });
    }
}
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
            { $sort: { totalQty: -1 } }
        ]);

        if (lastFourWeeksInvoices.length === 0) {
            return res.status(200).json({ forecast: `No sales data found for the last four ${dayName}s to make a prediction.` });
        }

        const dataForAi = JSON.stringify(lastFourWeeksInvoices);
        const fullPrompt = `
            You are a restaurant sales forecasting AI. Today is ${dayName}.
            Based on the following JSON data, which shows the total quantity of each item sold over the last four ${dayName}s, predict the top 5 items that are most likely to sell well today.

            For each of the 5 items, provide a predicted sales quantity (a realistic number, not just the total) and a very brief, one-sentence reason for your prediction.

            SALES DATA: ${dataForAi}

            Format your response as a valid JSON array of objects only. Each object must have three keys: "productName", "predictedQty", and "reason". Do not include any text, markdown formatting, or explanations outside of the JSON array.
        `;

        const forecastText = await generateText(fullPrompt);
        // Clean the response from Gemini to ensure it's valid JSON
        const cleanedJson = forecastText.replace(/```json/g, '').replace(/```/g, '').trim();
        res.status(200).json({ forecast: JSON.parse(cleanedJson) });

    } catch (error) {
        console.error("Error generating AI sales forecast:", error);
        res.status(500).json({ error: "Failed to generate AI forecast." });
    }
}

/**
 * AI-Powered Menu & Combo Suggestions using Gemini
 */
export async function getAiMenuSuggestion(req, res) {
    const { branch } = req.params;
    
    try {
        const startDate = moment().subtract(30, 'days').toDate();

        const productSales = await Invoice.aggregate([
            { $match: { branch: branch, dateTime: { $gte: startDate } } },
            { $unwind: "$products" },
            { $group: {
                _id: "$products.productName",
                totalQty: { $sum: "$products.qty" },
            }},
            { $sort: { totalQty: 1 } } 
        ]);

        if (productSales.length < 5) {
            return res.status(200).json({ suggestion: "Not enough sales data to generate a menu suggestion." });
        }

        const top5 = productSales.slice(-5).reverse();
        const bottom5 = productSales.slice(0, 5);

        // Rename the '_id' field to 'productName' for a cleaner prompt
        const formatForAI = (arr) => arr.map(item => ({ productName: item._id, totalQty: item.totalQty }));

        const dataForAi = JSON.stringify({ topSellers: formatForAI(top5), worstSellers: formatForAI(bottom5) });
        
        // --- IMPROVED PROMPT ---
        const fullPrompt = `
            You are a creative restaurant menu consultant. Here is a list of our top 5 and bottom 5 selling items over the last 30 days.

            DATA: ${dataForAi}

            Based on this data, please provide:
            1. One creative combo deal. The combo must have a "name" (string), an "items" key which is an array of objects (each object with a "productName" key), a suggested "price" (number), and a "reason" (string).
            2. One suggestion for an underperforming item. This must have a "name" for the item (string) and a "suggestion" (string).

            Provide the response as a valid JSON object only with two keys: "comboSuggestion" and "itemImprovement". Do not include any text, markdown formatting, or explanations outside of the JSON object.
        `;
        // --- END OF IMPROVEMENT ---

        const suggestionText = await generateText(fullPrompt);
        const cleanedJson = suggestionText.replace(/```json/g, '').replace(/```/g, '').trim();
        res.status(200).json({ suggestion: JSON.parse(cleanedJson) });

    } catch (error) {
        console.error("Error generating menu suggestion:", error);
        res.status(500).json({ error: "Failed to generate menu suggestion." });
    }
}

/**
 * AI-Powered Customer Review Summary using Gemini
 */

export async function getAiPurchaseSuggestion(req, res) {
    const { branch } = req.params;
    const analysisDays = 30; // Analyze the last 30 days of sales

    try {
        // Step 1: Calculate total ingredient usage based on sales in the last 30 days
        const ingredientUsage = await Invoice.aggregate([
            // Match recent invoices
            { $match: { branch, dateTime: { $gte: new Date(Date.now() - analysisDays * 24 * 60 * 60 * 1000) } } },
            { $unwind: "$products" },
            // Group to sum up total quantity sold for each product
            { $group: { _id: "$products.productId", totalSold: { $sum: "$products.qty" } } },
            // Find the recipe for each sold product
            { $lookup: { from: "recipes", localField: "_id", foreignField: "productId", as: "recipe" } },
            { $unwind: "$recipe" },
            // Unwind the ingredients from the recipe
            { $unwind: "$recipe.ingredients" },
            // Group by ingredient to calculate total consumption
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
            return res.status(200).json({ suggestions: [], message: "Not enough sales data to generate purchase suggestions." });
        }

        // Step 2: Get current stock levels for all ingredients
        const currentStockLevels = await Stock.find({ branch });
        const stockMap = new Map(currentStockLevels.map(item => [item.ingredient.toString(), item.quantityInStock]));

        // Step 3: Calculate days of stock remaining for each consumed ingredient
        const urgentItems = ingredientUsage.map(item => {
            const currentStock = stockMap.get(item._id.toString()) || 0;
            const averageDailyUsage = item.totalConsumed / analysisDays;
            const daysRemaining = averageDailyUsage > 0 ? currentStock / averageDailyUsage : Infinity;
            return {
                name: item.name,
                unit: item.unit,
                currentStock: parseFloat(currentStock.toFixed(2)),
                averageDailyUsage: parseFloat(averageDailyUsage.toFixed(2)),
                daysRemaining: parseFloat(daysRemaining.toFixed(1))
            };
        })
        .filter(item => item.daysRemaining < 7) // Filter for items that will run out in the next week
        .sort((a, b) => a.daysRemaining - b.daysRemaining); // Sort by most urgent

        if (urgentItems.length === 0) {
            return res.status(200).json({ suggestions: [], message: "Inventory levels look healthy! No urgent purchases needed." });
        }
        
        // Step 4: Send the most urgent items to Gemini for a smart suggestion
        const dataForAi = JSON.stringify(urgentItems.slice(0, 7)); // Send top 7 most urgent items
        const fullPrompt = `
            You are an expert inventory manager for a restaurant. Based on the following data, which shows ingredients that are predicted to run out in less than 7 days, please provide a purchase suggestion list.

            DATA: ${dataForAi}

            For each ingredient, provide a "suggestedPurchaseQty" (a sensible restock amount for a restaurant, considering its daily usage) and a brief "justification" for that amount.

            Format the response as a valid JSON array of objects only. Each object must have keys: "name", "currentStock", "unit", "daysRemaining", "suggestedPurchaseQty", and "justification". Do not include any text, markdown, or explanations outside of the JSON array.
        `;

        const suggestionText = await generateText(fullPrompt);
        const cleanedJson = suggestionText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.status(200).json({ suggestions: JSON.parse(cleanedJson) });

    } catch (error) {
        console.error("Error generating AI purchase suggestion:", error);
        res.status(500).json({ error: "Failed to generate AI purchase suggestion." });
    }
}
export async function getAiReviewSummary(req, res) {
    const { branch } = req.params;

    try {
        const recentReviews = await Review.find({ branch }).sort({ createdAt: -1 }).limit(20).select('text rating -_id').lean();

        if (recentReviews.length === 0) {
            return res.status(200).json({ summary: "No customer reviews found to analyze." });
        }

        const dataForAi = JSON.stringify(recentReviews);
        const fullPrompt = `
            You are a customer experience manager for a restaurant. Analyze the following customer reviews.

            REVIEWS: ${dataForAi}

            Provide a concise summary that includes:
            1. The overall sentiment (e.g., "Generally Positive", "Mixed", "Needs Improvement").
            2. The top 3 most common positive points or compliments mentioned.
            3. The top 3 most common negative points, complaints, or areas for improvement.

            Provide the response as a valid JSON object only with three keys: "overallSentiment", "topPositives", and "topNegatives". "topPositives" and "topNegatives" must be arrays of strings. Do not include any text, markdown formatting, or explanations outside of the JSON object.
        `;

        const summaryText = await generateText(fullPrompt);
        const cleanedJson = summaryText.replace(/```json/g, '').replace(/```/g, '').trim();
        res.status(200).json({ summary: JSON.parse(cleanedJson) });

    } catch (error) {
        console.error("Error generating review summary:", error);
        res.status(500).json({ error: "Failed to generate review summary." });
    }
}