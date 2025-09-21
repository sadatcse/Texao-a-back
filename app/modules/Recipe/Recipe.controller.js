import Recipe from "./Recipe.model.js";
import Product from "../Product/Product.model.js"; 
import Purchase from "../Purchase/Purchase.model.js";
import mongoose from "mongoose";
import Invoice from "../Invoice/Invoices.model.js";

export const getIngredientUsageReport = async (req, res) => {
    try {
        // 1. Get and Validate Query & Pagination Parameters
        const { branch, fromDate, toDate, categoryId } = req.query;
        if (!branch || !fromDate || !toDate) {
            return res.status(400).json({
                success: false,
                message: "Please provide 'branch', 'fromDate', and 'toDate' parameters.",
            });
        }
        
        // Pagination parameters with default values
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        // --- Steps 2 through 6 remain exactly the same as the previous correct code ---
        // 2. Aggregate sold products
        const aggregatedSales = await Invoice.aggregate([
            { $match: { branch, dateTime: { $gte: startDate, $lte: endDate } } },
            { $unwind: "$products" },
            { $group: { _id: "$products.productName", totalQuantitySold: { $sum: "$products.qty" } } },
        ]);
        
        if (aggregatedSales.length === 0) {
             return res.status(200).json({ /* ... no sales response ... */ });
        }
        
        // 3. Consolidate sales data to find product IDs
        const consolidatedSales = new Map();
        const unresolvedProducts = [];
        for (const sale of aggregatedSales) {
            const product = await Product.findOne({ productName: sale._id, branch }, '_id').lean();
            if (product) {
                const productIdStr = product._id.toString();
                if (consolidatedSales.has(productIdStr)) {
                    consolidatedSales.get(productIdStr).totalQuantitySold += sale.totalQuantitySold;
                } else {
                    consolidatedSales.set(productIdStr, { productName: sale._id, totalQuantitySold: sale.totalQuantitySold });
                }
            } else {
                unresolvedProducts.push(sale._id);
            }
        }
        const soldProducts = Array.from(consolidatedSales, ([id, data]) => ({ _id: new mongoose.Types.ObjectId(id), ...data }));
        
        // 4. Fetch and Filter Recipes using a Targeted Aggregation Pipeline
        const soldProductIds = soldProducts.map(p => p._id);
        let recipes = [];
        if (soldProductIds.length > 0) {
            const recipePipeline = [
                { $match: { productId: { $in: soldProductIds } } },
                { $unwind: "$ingredients" },
                { $lookup: { from: "ingredients", localField: "ingredients.ingredientId", foreignField: "_id", as: "ingredientDoc" } },
                { $unwind: "$ingredientDoc" },
                ...(categoryId ? [{ $match: { "ingredientDoc.category": new mongoose.Types.ObjectId(categoryId) } }] : []),
                { $group: { _id: "$_id", productId: { $first: "$productId" }, ingredients: { $push: "$ingredients" } } }
            ];
            recipes = await Recipe.aggregate(recipePipeline);
        }

        // 5. Create a Map for quick recipe lookups
        const recipeMap = new Map();
        recipes.forEach(recipe => recipeMap.set(recipe.productId.toString(), recipe));
        
        // 6. Calculate total ingredient usage
        const ingredientUsage = {};
        const productsWithoutRecipe = [...unresolvedProducts];
        for (const soldProduct of soldProducts) {
            const recipe = recipeMap.get(soldProduct._id.toString());
            if (recipe) {
                for (const ingredient of recipe.ingredients) {
                    const totalUsed = ingredient.quantity * soldProduct.totalQuantitySold;
                    const ingredientIdStr = ingredient.ingredientId.toString();
                    if (ingredientUsage[ingredientIdStr]) {
                        ingredientUsage[ingredientIdStr].totalQuantity += totalUsed;
                    } else {
                        ingredientUsage[ingredientIdStr] = { ingredientName: ingredient.ingredientName, totalQuantity: totalUsed, unit: ingredient.unit };
                    }
                }
            } else {
                productsWithoutRecipe.push(soldProduct.productName);
            }
        }
        
        // 7. Format the final list
        const formattedIngredientUsage = Object.values(ingredientUsage)
            .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

        // 8. **NEW**: Paginate the final result
        const totalItems = formattedIngredientUsage.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedUsage = formattedIngredientUsage.slice(skip, skip + limit);

        let alertMessage = "Report generated successfully.";
        if (productsWithoutRecipe.length > 0) {
            alertMessage = `Alert: Could not calculate ingredient usage for ${productsWithoutRecipe.length} product(s) due to missing recipes or product records.`;
        }

        // 9. Send the paginated response
        res.status(200).json({
            success: true,
            reportDetails: { branch, fromDate, toDate, ...(categoryId && { categoryId }) },
            alert: alertMessage,
            // The main data is now the paginated list
            ingredientUsage: paginatedUsage,
            // Pagination metadata for the frontend
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                itemsPerPage: limit,
            },
            productsWithoutRecipe: [...new Set(productsWithoutRecipe)].sort(),
        });

    } catch (error) {
        console.error("Error generating ingredient usage report:", error);
        res.status(500).json({
            success: false,
            message: "Server error while generating the report.",
            error: error.message,
        });
    }
};

export const getDynamicPrice = async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate the incoming MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid Product ID format" });
    }

    // --- Step 1: Get the recipe for the product ---
    const recipe = await Recipe.findOne({ productId }).populate("productId");

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found for this product." });
    }
    
    // --- Step 2: Define the date range for the current month ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); 
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); 

    let totalIngredientCost = 0;
    const ingredientCosts = [];

    // --- Step 3: Calculate the average cost for each ingredient ---
    for (const item of recipe.ingredients) {
      const ingredientId = item.ingredientId;

      const avgPriceResult = await Purchase.aggregate([
        { $match: { purchaseDate: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $unwind: "$items" },
        { $match: { "items.ingredient": ingredientId } },
        {
          $group: {
            _id: "$items.ingredient",
            averagePrice: { $avg: "$items.unitPrice" },
          },
        },
      ]);
      
      let ingredientCost = 0;
      if (avgPriceResult.length > 0 && avgPriceResult[0].averagePrice) {
        const averagePrice = avgPriceResult[0].averagePrice;
        ingredientCost = averagePrice * item.quantity;
        totalIngredientCost += ingredientCost;

        ingredientCosts.push({
            name: item.ingredientName,
            id: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            avgUnitCost: parseFloat(averagePrice.toFixed(2)),
            totalCost: parseFloat(ingredientCost.toFixed(2))
        });

      } else {
        console.warn(`No purchase history found for ingredient ${item.ingredientName} this month.`);
        ingredientCosts.push({
            name: item.ingredientName,
            id: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            avgUnitCost: 0,
            totalCost: 0,
            note: "No purchase history found for this ingredient in the current month."
        });
      }
    }

    // --- Step 4: Calculate final suggested menu price ---
    const PROFIT_MARGIN = 0.60; // 60% profit margin
    const suggestedBasePrice = totalIngredientCost > 0 ? totalIngredientCost / (1 - PROFIT_MARGIN) : 0;
    
    const vatAmount = suggestedBasePrice * (recipe.productId.vat / 100);
    const sdAmount = suggestedBasePrice * (recipe.productId.sd / 100);
    const finalPrice = suggestedBasePrice + vatAmount + sdAmount;

    // --- Step 5: Send the response ---
    res.status(200).json({
      success: true,
      productName: recipe.productName,
      originalPrice: recipe.productId.price,
      calculationDetails: {
        totalIngredientCost: parseFloat(totalIngredientCost.toFixed(2)),
        profitMargin: `${PROFIT_MARGIN * 100}%`,
        suggestedBasePrice: parseFloat(suggestedBasePrice.toFixed(2)),
        vatApplied: `${recipe.productId.vat}%`,
        sdApplied: `${recipe.productId.sd}%`,
        finalSuggestedPrice: parseFloat(finalPrice.toFixed(2)),
      },
      ingredientBreakdown: ingredientCosts,
    });

  } catch (error) {
    console.error("Error calculating dynamic price:", error);
    res.status(500).json({ success: false, message: "Server error while calculating price.", error: error.message });
  }
};


export async function createRecipe(req, res) {
  try {
    const recipeData = req.body;
    const result = await Recipe.create(recipeData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getAllRecipes(req, res) {
  try {
    const result = await Recipe.find()
      .populate("productId")
      .populate("ingredients.ingredientId");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getRecipeByProductId(req, res) {
  const { productId } = req.params;
  try {
    const result = await Recipe.findOne({ productId })
      .populate("productId")
      .populate("ingredients.ingredientId");
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Recipe not found for this product" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getRecipesByBranch(req, res) {
  const { branch } = req.params;
  try {
    const result = await Recipe.find({ branch })
      .populate("productId")
      .populate("ingredients.ingredientId");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function updateRecipe(req, res) {
  const { productId } = req.params;
  const recipeData = req.body;
  try {
    const result = await Recipe.findOneAndUpdate({ productId }, recipeData, {
      new: true,
      runValidators: true,
    })
      .populate("productId")
      .populate("ingredients.ingredientId");
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Recipe not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function removeRecipe(req, res) {
  const { productId } = req.params;
  try {
    const result = await Recipe.findOneAndDelete({ productId });
    if (result) {
      res.status(200).json({ message: "Recipe deleted successfully" });
    } else {
      res.status(404).json({ message: "Recipe not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getRecipeStatusByProductId(req, res) {
  const { productId } = req.params;
  try {
    const recipe = await Recipe.findOne({ productId });
    if (recipe) {
      res.status(200).json({ found: true, recipe });
    } else {
      res.status(200).json({ found: false, message: "No recipe found for this product." });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getProductsWithRecipeStatus(req, res) {
  const { branch } = req.params;

  // 1. Extract parameters from the query string
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const recipeStatus = req.query.recipeStatus; // 'exists' or 'no_recipe'
  const skip = (page - 1) * limit;

  try {
    // 2. Build the initial filter query for products
    const productFilter = { branch };
    if (category && category !== 'all') {
      productFilter.category = category;
    }

    // 3. Handle the recipeStatus filter if it's provided
    if (recipeStatus && recipeStatus !== 'all') {
      // Find all product IDs that have a recipe in the specified branch
      const recipes = await Recipe.find({ branch }).select('productId');
      const productIdsWithRecipes = recipes.map(r => r.productId);

      if (recipeStatus === 'exists') {
        // Find products whose IDs are IN the list of products with recipes
        productFilter._id = { $in: productIdsWithRecipes };
      } else if (recipeStatus === 'no_recipe') {
        // Find products whose IDs are NOT IN the list of products with recipes
        productFilter._id = { $nin: productIdsWithRecipes };
      }
    }

    // 4. Count total documents that match the final filter for pagination
    const totalProducts = await Product.countDocuments(productFilter);

    // 5. Find products with the final filter and pagination
    const products = await Product.find(productFilter)
      .sort({ productName: 1 }) // Optional: sort alphabetically
      .skip(skip)
      .limit(limit);
    
    // Note: If no products match the filter, we should return an empty array, not a 404.
    // The old 404 check has been removed to support empty filter results gracefully.

    // 6. Map and populate recipes for the paginated products
    const productsWithRecipes = await Promise.all(
      products.map(async (product) => {
        const recipe = await Recipe.findOne({ productId: product._id }).populate("ingredients.ingredientId");

        return {
          productDetails: product,
          hasRecipe: !!recipe,
          recipe: recipe,
        };
      })
    );

    // 7. Respond with paginated data and metadata
    res.status(200).json({
      data: productsWithRecipes,
      meta: {
        totalProducts,
        page,
        limit,
        totalPages: Math.ceil(totalProducts / limit),
      },
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}