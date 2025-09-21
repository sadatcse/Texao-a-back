// src/api/Stock/Stock.controller.js

import mongoose from "mongoose";
import Stock from "./Stock.model.js";
import Ingredient from "../Ingredient/Ingredient.model.js"; // Adjust path as needed
import StockMovement from "./StockMovement.model.js"; // Adjust path as needed

/**
 * @desc Get stock items for a branch with filtering, searching, and pagination
 */
export async function getStockByBranch(req, res) {
  const { branch } = req.params;
  const { category, search, lowStock, page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    let ingredientQuery = {};

    if (category) {
      ingredientQuery.category = category;
    }

    if (search) {
      ingredientQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } }
      ];
    }

    const matchingIngredients = await Ingredient.find(ingredientQuery).select('_id');
    const ingredientIds = matchingIngredients.map(ing => ing._id);

    let stockQuery = {
      branch,
      ingredient: { $in: ingredientIds }
    };
    
    let pipeline = [
        { $match: stockQuery },
        {
            $lookup: {
                from: 'ingredients', // The actual collection name for Ingredients
                localField: 'ingredient',
                foreignField: '_id',
                as: 'ingredient'
            }
        },
        { $unwind: '$ingredient' },
        {
             $lookup: {
                 from: 'ingredientcategories', // The actual collection name for IngredientCategory
                 localField: 'ingredient.category',
                 foreignField: '_id',
                 as: 'ingredient.category'
             }
        },
        { $unwind: '$ingredient.category' }
    ];

    if (lowStock === 'true') {
        pipeline.push({
            $match: {
                $expr: { $lt: ['$quantityInStock', '$ingredient.stockAlert'] }
            }
        });
    }

    // Clone pipeline for counting total documents
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'totalDocuments' });
    const countResult = await Stock.aggregate(countPipeline);
    const totalDocuments = countResult.length > 0 ? countResult[0].totalDocuments : 0;
    
    // Add sorting, skipping, and limiting to the main pipeline for data fetching
    pipeline.push(
        { $sort: { updatedAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
    );
    
    const stock = await Stock.aggregate(pipeline);

    res.status(200).json({
      data: stock,
      pagination: {
        totalDocuments,
        totalPages: Math.ceil(totalDocuments / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

/**
 * @desc Get movement history for a single stock item
 */
export async function getStockMovements(req, res) {
  const { stockId } = req.params;
  try {
    const movements = await StockMovement.find({ stock: stockId })
      .populate('createdBy', 'name') // Populate user's name from User model
      .sort({ createdAt: -1 });
    res.status(200).json(movements);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

/**
 * @desc Update the stock alert level on an ingredient
 */
export async function updateStockAlert(req, res) {
  const { ingredientId } = req.params;
  const { newStockAlert } = req.body;

  if (newStockAlert == null || newStockAlert < 0) {
    return res.status(400).send({ error: "A valid stock alert value is required." });
  }

  try {
    const updatedIngredient = await Ingredient.findByIdAndUpdate(
      ingredientId,
      { $set: { stockAlert: newStockAlert } },
      { new: true, runValidators: true }
    );

    if (!updatedIngredient) {
      return res.status(404).send({ error: "Ingredient not found." });
    }
    res.status(200).json({ message: "Stock alert updated successfully.", ingredient: updatedIngredient });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

/**
 * @desc Manually adjust the quantity of a stock item and log the movement
 */
export async function adjustStock(req, res) {
  const { stockId, newQuantity, note } = req.body;
  const userId = req.user._id; // Assumes user ID is available from auth middleware

  if (newQuantity == null || newQuantity < 0) {
    return res.status(400).send({ error: "A valid new quantity is required." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const stock = await Stock.findById(stockId).session(session);
    if (!stock) {
      throw new Error("Stock item not found.");
    }

    const beforeQuantity = stock.quantityInStock;

    // 1. Update the stock item's quantity
    stock.quantityInStock = newQuantity;
    await stock.save({ session });

    // 2. Create a stock movement record to log the change
    await StockMovement.create([{
      stock: stock._id,
      branch: stock.branch,
      type: 'manual_adjustment',
      beforeQuantity: beforeQuantity,
      afterQuantity: newQuantity,
      adjustment: newQuantity - beforeQuantity,
      note: note || 'No note provided.',
      createdBy: userId,
    }], { session });

    // If both operations succeed, commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Stock adjusted successfully.", stock });

  } catch (err) {
    // If any operation fails, abort the transaction
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ error: err.message });
  }
}