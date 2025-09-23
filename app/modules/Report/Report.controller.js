import Purchase from "../Purchase/Purchase.model.js";
import Invoice from "../Invoice/Invoices.model.js";
import Expense from "../Expense/Expense.model.js";
import Stock from "../Stock/Stock.model.js";
import StockMovement from "../Stock/StockMovement.model.js";
import Ingredient from "../Ingredient/Ingredient.model.js";
/**
 * Calculates the weighted average purchase price for each ingredient, grouped by month and year.
 * The weighted average is calculated as Sum(unitPrice * quantity) / Sum(quantity).
 * This can be filtered by branch using a query parameter (e.g., /average-ingredient-price?branch=main-branch)
 */
export async function getIngredientAveragePriceByMonth(req, res) {
  try {
    const { branch } = req.query;

    const initialMatchStage = branch ? [{ $match: { branch: branch } }] : [];

    const pipeline = [
      // Optional: Filter by branch if provided
      ...initialMatchStage,

      // Deconstruct the items array to process each item individually
      { $unwind: "$items" },

      // Group by ingredient, year, and month
      {
        $group: {
          _id: {
            ingredient: "$items.ingredient",
            year: { $year: "$purchaseDate" },
            month: { $month: "$purchaseDate" },
          },
          // Calculate the total cost for the ingredient in that month
          totalCost: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
          // Calculate the total quantity purchased in that month
          totalQuantity: { $sum: "$items.quantity" },
        },
      },

      // Calculate the weighted average price
      {
        $addFields: {
          averagePrice: {
            $cond: [
              { $eq: ["$totalQuantity", 0] }, // Avoid division by zero
              0,
              { $divide: ["$totalCost", "$totalQuantity"] },
            ],
          },
        },
      },
      
      // Join with the Ingredients collection to get the ingredient's name
      {
        $lookup: {
          from: "ingredients", // The actual name of the collection in MongoDB
          localField: "_id.ingredient",
          foreignField: "_id",
          as: "ingredientDetails",
        },
      },
      
      // Deconstruct the ingredientDetails array
      {
        $unwind: {
          path: "$ingredientDetails",
          preserveNullAndEmptyArrays: true, // Keep results even if ingredient was deleted
        },
      },

      // Shape the final output
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          ingredientId: "$_id.ingredient",
          ingredientName: "$ingredientDetails.name",
          sku: "$ingredientDetails.sku",
          averagePrice: { $round: ["$averagePrice", 2] }, // Round to 2 decimal places
          totalQuantityPurchased: "$totalQuantity",
          unit: "$ingredientDetails.unit",
        },
      },

      // Sort the results for readability
      {
        $sort: {
          year: -1,
          month: -1,
          ingredientName: 1,
        },
      },
    ];

    const result = await Purchase.aggregate(pipeline);
    res.status(200).json(result);
    
  } catch (err) {
    res.status(500).send({ error: "Failed to generate report: " + err.message });
  }
}

export const getStockSalesComparison = async (req, res) => {
    try {
        const { branch } = req.params;
        // Destructure categoryId from the query
        let { fromDate, toDate, categoryId, page = 1, limit = 10 } = req.query;

        // Default to the current month if no dates are provided
        if (!fromDate || !toDate) {
            const now = new Date();
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            fromDate = new Date(fromDate);
            toDate = new Date(toDate);
        }
        toDate.setHours(23, 59, 59, 999);

        // --- MODIFICATION: Filter stock items by category before processing ---
        const stockMatchQuery = { branch };
        if (categoryId) {
            // Find all ingredients that belong to the selected category
            const ingredientsInCategory = await Ingredient.find({ category: categoryId }).select('_id');
            const ingredientIds = ingredientsInCategory.map(ing => ing._id);
            // Add a filter to only include stock items for those ingredients
            stockMatchQuery.ingredient = { $in: ingredientIds };
        }
        
        // This query now filters by branch and optionally by category
        const allStockItems = await Stock.find(stockMatchQuery).populate('ingredient', 'name unit').lean();

        if (allStockItems.length === 0) {
            return res.status(200).json({ data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1 } });
        }
        
        const reportPromises = allStockItems.map(async (stockItem) => {
            if (!stockItem.ingredient) {
                return null; // Skip orphaned stock records
            }
            const ingredientId = stockItem.ingredient._id;
            
            // The rest of the calculations run on the pre-filtered items
            const [lastMovementBeforePeriod, purchases, salesUsage] = await Promise.all([
                StockMovement.findOne({ stock: stockItem._id, createdAt: { $lt: fromDate } }).sort({ createdAt: -1 }),
                Purchase.aggregate([
                    { $match: { branch, purchaseDate: { $gte: fromDate, $lte: toDate } } },
                    { $unwind: "$items" },
                    { $match: { "items.ingredient": ingredientId } },
                    { $group: { _id: null, total: { $sum: "$items.quantity" } } }
                ]),
                Invoice.aggregate([
                    { $match: { branch, dateTime: { $gte: fromDate, $lte: toDate } } },
                    { $unwind: "$products" },
                    { $lookup: { from: "recipes", localField: "products.productId", foreignField: "productId", as: "recipe" } },
                    { $unwind: "$recipe" },
                    { $unwind: "$recipe.ingredients" },
                    { $match: { "recipe.ingredients.ingredientId": ingredientId } },
                    { $group: { _id: null, total: { $sum: { $multiply: ["$products.qty", "$recipe.ingredients.quantity"] } } } }
                ])
            ]);
            
            const openingStock = lastMovementBeforePeriod ? lastMovementBeforePeriod.afterQuantity : 0;
            const stockIn = purchases[0]?.total || 0;
            const stockOut = salesUsage[0]?.total || 0;
            const systemClosingStock = openingStock + stockIn - stockOut;
            const physicalStock = stockItem.quantityInStock;
            const variance = physicalStock - systemClosingStock;

            return { ingredientId, name: stockItem.ingredient.name, unit: stockItem.ingredient.unit, openingStock, stockIn, stockOut, systemClosingStock, physicalStock, variance };
        });

        const fullReport = (await Promise.all(reportPromises)).filter(Boolean); // Filter out nulls
        
        // Paginate the final result
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const totalItems = fullReport.length;
        const totalPages = Math.ceil(totalItems / limitNumber);
        const skip = (pageNumber - 1) * limitNumber;
        const paginatedData = fullReport.slice(skip, skip + limitNumber);

        res.status(200).json({
            data: paginatedData,
            pagination: { totalItems, totalPages, currentPage: pageNumber, limit: limitNumber }
        });

    } catch (error) {
        console.error("Error in getStockSalesComparison:", error);
        res.status(500).json({ message: "Failed to generate Stock & Sales Report.", error: error.message });
    }
};
export const getProfitAndLoss = async (req, res) => {
    try {
        const { branch } = req.params;
        let { fromDate, toDate } = req.query;

        // Default to the current month if no dates are provided
        if (!fromDate || !toDate) {
            const now = new Date();
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            fromDate = new Date(fromDate);
            toDate = new Date(toDate);
        }
        toDate.setHours(23, 59, 59, 999);

        // --- Perform all calculations in parallel for efficiency ---
        const [revenueData, cogsData, expenseData] = await Promise.all([
            // 1. Calculate Total Revenue from Invoices
            Invoice.aggregate([
                { $match: { branch, dateTime: { $gte: fromDate, $lte: toDate } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]),
            // 2. Calculate Cost of Goods Sold (COGS) from Purchases
            Purchase.aggregate([
                { $match: { branch, purchaseDate: { $gte: fromDate, $lte: toDate } } },
                { $group: { _id: null, total: { $sum: "$grandTotal" } } }
            ]),
            // 3. Calculate Operating Expenses (all expenses except vendor/purchase costs)
            Expense.aggregate([
                { $match: { branch, date: { $gte: fromDate, $lte: toDate } } },
                { $group: { _id: "$category", total: { $sum: "$totalAmount" } } },
                { $project: { _id: 0, category: "$_id", total: 1 } }
            ])
        ]);

        const totalRevenue = revenueData[0]?.total || 0;
        const cogs = cogsData[0]?.total || 0;
        
        // Separate operating expenses from COGS (Vendor expenses)
        const operatingExpensesList = expenseData.filter(exp => exp.category !== "Vendor");
        const totalOperatingExpenses = operatingExpensesList.reduce((acc, curr) => acc + curr.total, 0);

        // --- Final P&L Calculations ---
        const grossProfit = totalRevenue - cogs;
        const netProfit = grossProfit - totalOperatingExpenses;

        res.status(200).json({
            totalRevenue,
            cogs,
            grossProfit,
            operatingExpenses: {
                breakdown: operatingExpensesList,
                total: totalOperatingExpenses,
            },
            netProfit
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to generate P&L Report.", error: error.message });
    }
};

export async function getIngredientPriceAnalysis(req, res) {
  try {
    const { branch } = req.query;

    const initialMatchStage = branch ? [{ $match: { branch: branch } }] : [];

    const pipeline = [
      // Optional: Filter by branch if provided
      ...initialMatchStage,
      
      // Stage 1: Deconstruct the items array
      { $unwind: "$items" },

      // Stage 2: Group by month to get monthly average prices
      {
        $group: {
          _id: {
            ingredient: "$items.ingredient",
            year: { $year: "$purchaseDate" },
            month: { $month: "$purchaseDate" },
          },
          totalCost: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
      {
        $addFields: {
          averagePrice: {
            $cond: [{ $eq: ["$totalQuantity", 0] }, 0, { $divide: ["$totalCost", "$totalQuantity"] }],
          },
        },
      },
      
      // Stage 3: Use window functions to get the previous month's price
      {
        $setWindowFields: {
          partitionBy: "$_id.ingredient",
          sortBy: { "_id.year": 1, "_id.month": 1 },
          output: {
            lastMonthAvgPrice: {
              $shift: { output: "$averagePrice", by: -1, default: null },
            },
          },
        },
      },
      
      // Stage 4: Calculate the percentage change
      {
        $addFields: {
          priceChangePercentage: {
            $cond: {
              if: { $and: [ { $ne: ["$lastMonthAvgPrice", null] }, { $ne: ["$lastMonthAvgPrice", 0] } ] },
              then: {
                $multiply: [
                  { $divide: [{ $subtract: ["$averagePrice", "$lastMonthAvgPrice"] }, "$lastMonthAvgPrice"] },
                  100,
                ],
              },
              else: null,
            },
          },
        },
      },
      
      // Stage 5: Join with ingredients collection to get names and details
      {
        $lookup: {
          from: "ingredients",
          localField: "_id.ingredient",
          foreignField: "_id",
          as: "ingredientDetails",
        },
      },
      { $unwind: { path: "$ingredientDetails", preserveNullAndEmptyArrays: true } },
      
      // Stage 6: Shape the data for the final output
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          ingredientId: "$_id.ingredient",
          ingredientName: "$ingredientDetails.name",
          unit: "$ingredientDetails.unit",
          currentMonthAveragePrice: { $round: ["$averagePrice", 2] },
          lastMonthAveragePrice: { $round: ["$lastMonthAvgPrice", 2] },
          priceChangePercentage: { $round: ["$priceChangePercentage", 2] },
        },
      },
      
      // Stage 7: Use $facet to create multiple report views from one query
      {
        $facet: {
          allMonthlyAverages: [
            { $sort: { year: -1, month: -1, ingredientName: 1 } }
          ],
          top10Increased: [
            { $match: { priceChangePercentage: { $gt: 0 } } },
            { $sort: { priceChangePercentage: -1 } },
            { $limit: 10 },
          ],
          top10Decreased: [
            { $match: { priceChangePercentage: { $lt: 0 } } },
            { $sort: { priceChangePercentage: 1 } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const result = await Purchase.aggregate(pipeline);
    
    // The result of a facet is an array with one object, so we return the first element.
    res.status(200).json(result[0]);

  } catch (err) {
    res.status(500).send({ error: "Failed to generate analysis: " + err.message });
  }
}