import Purchase from "./Purchase.model.js";
import Stock from "../Stock/Stock.model.js";
import Ingredient from "../Ingredient/Ingredient.model.js";
import mongoose from "mongoose";

// Create a new purchase and update stock accordingly
export async function createPurchase(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchaseData = req.body;

    // 1. Create the purchase document
    const newPurchase = new Purchase(purchaseData);
    await newPurchase.save({ session });

    // 2. Loop through each item in the purchase to update stock
    for (const item of purchaseData.items) {
      const ingredientDetails = await Ingredient.findById(item.ingredient).session(session);
      if (!ingredientDetails) {
          throw new Error(`Ingredient with ID ${item.ingredient} not found.`);
      }

      // Find the stock for this ingredient and branch, or create it if it doesn't exist
      await Stock.findOneAndUpdate(
        { ingredient: item.ingredient, branch: purchaseData.branch },
        { 
          $inc: { quantityInStock: item.quantity },
          $set: { unit: ingredientDetails.unit } // Ensure unit is set/updated
        },
        { upsert: true, new: true, session: session } // upsert: if not found, create it
      );
    }

    // 3. If all goes well, commit the transaction
    await session.commitTransaction();
    res.status(201).json(newPurchase);

  } catch (err) {
    // 4. If anything fails, abort the transaction
    await session.abortTransaction();
    res.status(500).send({ error: err.message });
  } finally {
    // 5. End the session
    session.endSession();
  }
}

// Get all purchases for a branch
export async function getPurchasesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const purchases = await Purchase.find({ branch })
      .populate("vendor")
      .populate("items.ingredient");
    res.status(200).json(purchases);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get a single purchase by its ID
export async function getPurchaseById(req, res) {
  const id = req.params.id;
  try {
    const purchase = await Purchase.findById(id)
      .populate("vendor")
      .populate("items.ingredient");
    if (purchase) {
      res.status(200).json(purchase);
    } else {
      res.status(404).json({ message: "Purchase not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Note: Deleting or updating a purchase would require complex logic to reverse
// stock transactions, which is beyond a simple implementation.
// These functions are provided for basic record-keeping.
export async function updatePurchase(req, res) {
    const id = req.params.id;
    try {
        const updatedPurchase = await Purchase.findByIdAndUpdate(id, req.body, { new: true });
        if(updatedPurchase) {
            res.status(200).json(updatedPurchase);
        } else {
            res.status(404).json({ message: "Purchase not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

export async function removePurchase(req, res) {
    const id = req.params.id;
    try {
        const result = await Purchase.findByIdAndDelete(id);
        if (result) {
            res.status(200).json({ message: "Purchase record deleted successfully. Note: Stock was not automatically adjusted." });
        } else {
            res.status(404).json({ message: "Purchase not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}