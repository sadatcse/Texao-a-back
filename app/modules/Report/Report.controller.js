import Purchase from "../Purchase/Purchase.model.js";

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