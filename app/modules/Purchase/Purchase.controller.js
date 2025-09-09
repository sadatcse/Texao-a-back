import Purchase from "./Purchase.model.js";
import Stock from "../Stock/Stock.model.js";
import Ingredient from "../Ingredient/Ingredient.model.js";
import Vendor from "../Vendor/Vendor.model.js";
import Expense from "../Expense/Expense.model.js";
import mongoose from "mongoose";

/**
 * Creates a new purchase, updates stock, and creates a corresponding expense record
 * all within a single database transaction.
 */
export async function createPurchase(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchaseData = req.body;

    // Create the purchase document
    const newPurchase = new Purchase(purchaseData);
    await newPurchase.save({ session });

    // Loop through each item in the purchase to update stock
    for (const item of purchaseData.items) {
      const ingredientDetails = await Ingredient.findById(item.ingredient).session(
        session
      );
      if (!ingredientDetails) {
        throw new Error(`Ingredient with ID ${item.ingredient} not found.`);
      }

      // Find the stock for this ingredient and branch, or create it if it doesn't exist
      await Stock.findOneAndUpdate(
        { ingredient: item.ingredient, branch: purchaseData.branch },
        {
          $inc: { quantityInStock: item.quantity },
          $set: { unit: ingredientDetails.unit },
        },
        { upsert: true, new: true, session: session }
      );
    }

    // Automatically create a corresponding expense record
    const vendorDetails = await Vendor.findById(purchaseData.vendor).session(session);
    if (!vendorDetails) {
      throw new Error(`Vendor with ID ${purchaseData.vendor} not found.`);
    }

    const expenseData = {
      title: `Purchase from ${vendorDetails.vendorName}`,
      category: "Vendor",
      vendorName: vendorDetails.vendorName,
      totalAmount: purchaseData.grandTotal,
      paidAmount: purchaseData.paidAmount,
      paymentStatus: purchaseData.paymentStatus,
      paymentMethod: "Other", 
      date: purchaseData.purchaseDate,
      note: `Auto-generated from purchase invoice #${purchaseData.invoiceNumber || 'N/A'}.`,
      branch: purchaseData.branch,
      purchaseId: newPurchase._id // Linking the expense to the purchase
    };

    const newExpense = new Expense(expenseData);
    await newExpense.save({ session }); 

    // If all goes well, commit the transaction
    await session.commitTransaction();
    res.status(201).json({
        message: "Purchase and corresponding expense created successfully!",
        purchase: newPurchase,
        expense: newExpense
    });

  } catch (err) {
    // If anything fails, abort the transaction
    await session.abortTransaction();
    res.status(500).send({ error: err.message });
  } finally {
    // End the session
    session.endSession();
  }
}

/**
 * Retrieves all purchases for a specific branch, populating related data.
 */
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

export async function getPurchaseAnalysis(req, res) {
  const { branch } = req.params;
  const { year, month, page = 1, limit = 10 } = req.query; // add page & limit

  // --- Input Validation ---
  if (!year || !month) {
    return res.status(400).json({ error: "Year and month query parameters are required." });
  }
  const currentYear = parseInt(year);
  const currentMonth = parseInt(month);
  const pageNumber = parseInt(page);
  const pageSize = parseInt(limit);

  if (isNaN(currentYear) || isNaN(currentMonth) || currentMonth < 1 || currentMonth > 12) {
    return res.status(400).json({ error: "Invalid year or month provided." });
  }
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(pageSize) || pageSize < 1) {
    return res.status(400).json({ error: "Invalid pagination parameters." });
  }

  // --- Date Range Calculation ---
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 1);

  const prevMonthDate = new Date(startDate);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevStartDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
  const prevEndDate = startDate;

  try {
    const getMonthlyData = async (branch, start, end) => {
      return Purchase.aggregate([
        {
          $match: {
            branch: branch,
            purchaseDate: { $gte: start, $lt: end },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.ingredient",
            totalQuantity: { $sum: "$items.quantity" },
            averageUnitPrice: { $avg: "$items.unitPrice" },
            totalAmount: { $sum: "$items.totalPrice" },
          },
        },
        {
          $lookup: {
            from: "ingredients",
            localField: "_id",
            foreignField: "_id",
            as: "ingredientInfo",
          },
        },
        { $unwind: "$ingredientInfo" },
        {
          $project: {
            _id: 0,
            ingredientId: "$_id",
            ingredientName: "$ingredientInfo.name",
            unit: "$ingredientInfo.unit",
            totalQuantity: 1,
            averageUnitPrice: { $round: ["$averageUnitPrice", 2] },
            totalAmount: 1,
          },
        },
      ]);
    };

    const currentMonthData = await getMonthlyData(branch, startDate, endDate);
    const previousMonthData = await getMonthlyData(branch, prevStartDate, prevEndDate);

    const previousMonthMap = new Map(
      previousMonthData.map(item => [item.ingredientId.toString(), item])
    );

    const analysis = currentMonthData.map(currentItem => {
      const previousItem = previousMonthMap.get(currentItem.ingredientId.toString());
      if (previousItem) previousMonthMap.delete(currentItem.ingredientId.toString());

      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return 100;
        return ((current - previous) / previous) * 100;
      };

      return {
        ...currentItem,
        comparison: {
          previousMonth: {
            totalQuantity: previousItem?.totalQuantity || 0,
            averageUnitPrice: previousItem?.averageUnitPrice || 0,
            totalAmount: previousItem?.totalAmount || 0,
          },
          change: {
            quantityChangePercent: calculateChange(currentItem.totalQuantity, previousItem?.totalQuantity),
            unitPriceChangePercent: calculateChange(currentItem.averageUnitPrice, previousItem?.averageUnitPrice),
            totalAmountChangePercent: calculateChange(currentItem.totalAmount, previousItem?.totalAmount),
          },
        },
      };
    });

    for (const leftoverItem of previousMonthMap.values()) {
      analysis.push({
        ingredientId: leftoverItem.ingredientId,
        ingredientName: leftoverItem.ingredientName,
        unit: leftoverItem.unit,
        totalQuantity: 0,
        averageUnitPrice: 0,
        totalAmount: 0,
        comparison: {
          previousMonth: {
            totalQuantity: leftoverItem.totalQuantity,
            averageUnitPrice: leftoverItem.averageUnitPrice,
            totalAmount: leftoverItem.totalAmount,
          },
          change: {
            quantityChangePercent: -100,
            unitPriceChangePercent: -100,
            totalAmountChangePercent: -100,
          },
        },
      });
    }

    // --- Pagination Logic ---
const totalItems = analysis.length;
const totalPages = Math.ceil(totalItems / pageSize);
const currentPage = Math.min(pageNumber, totalPages || 1); 

const startIndex = (currentPage - 1) * pageSize;
const endIndex = startIndex + pageSize;
const paginatedData = analysis.slice(startIndex, endIndex);

    res.status(200).json({
      period: {
        year: currentYear,
        month: currentMonth,
        startDate,
        endDate,
      },
      previousPeriod: {
        year: prevStartDate.getFullYear(),
        month: prevStartDate.getMonth() + 1,
        startDate: prevStartDate,
        endDate: prevEndDate,
      },
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize,
      },
      analysis: paginatedData,
    });

  } catch (err) {
    res.status(500).send({ error: "Failed to generate purchase analysis.", details: err.message });
  }
}

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

/**
 * Updates a purchase and correctly adjusts the associated stock levels and expense record.
 * This function uses a transaction to ensure all-or-nothing atomicity.
 */
export async function updatePurchase(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  const id = req.params.id;
  const updateData = req.body;

  try {
    // 1. Find the original purchase document to see the old values.
    const originalPurchase = await Purchase.findById(id).session(session);
    if (!originalPurchase) {
      throw new Error("Purchase not found.");
    }

    // --- STOCK RECONCILIATION ---
    // 2. Reverse the stock quantities from the original purchase.
    for (const item of originalPurchase.items) {
      await Stock.findOneAndUpdate(
        { ingredient: item.ingredient, branch: originalPurchase.branch },
        { $inc: { quantityInStock: -item.quantity } },
        { session }
      );
    }

    // 3. Add the new stock quantities from the update data.
    for (const item of updateData.items) {
      const ingredientDetails = await Ingredient.findById(item.ingredient).session(session);
      if (!ingredientDetails) throw new Error(`Ingredient ${item.ingredient} not found`);

      await Stock.findOneAndUpdate(
        { ingredient: item.ingredient, branch: updateData.branch },
        { 
          $inc: { quantityInStock: item.quantity },
          $set: { unit: ingredientDetails.unit } 
        },
        { upsert: true, session }
      );
    }

    // --- EXPENSE RECONCILIATION ---
    // 4. Find and update the associated expense record.
    const vendorDetails = await Vendor.findById(updateData.vendor).session(session);
    if (!vendorDetails) throw new Error(`Vendor ${updateData.vendor} not found`);

    const updatedExpenseData = {
      title: `Purchase from ${vendorDetails.vendorName}`,
      totalAmount: updateData.grandTotal,
      paidAmount: updateData.paidAmount,
      paymentStatus: updateData.paymentStatus,
      date: updateData.purchaseDate,
      branch: updateData.branch,
    };
    
    await Expense.findOneAndUpdate(
        { purchaseId: id }, 
        { $set: updatedExpenseData }, 
        { session }
    );

    // 5. Finally, update the purchase document itself.
    const updatedPurchase = await Purchase.findByIdAndUpdate(id, updateData, { new: true, session });
    
    // 6. If all operations succeed, commit the transaction.
    await session.commitTransaction();
    res.status(200).json({
        message: "Purchase updated successfully. Stock and expense records have been adjusted.",
        purchase: updatedPurchase
    });

  } catch (err) {
    // If any operation fails, abort the entire transaction.
    await session.abortTransaction();
    res.status(500).send({ error: "Failed to update purchase.", details: err.message });
  } finally {
    session.endSession();
  }
}

export async function removePurchase(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  const id = req.params.id;

  try {

    const purchaseToDelete = await Purchase.findById(id).session(session);
    if (!purchaseToDelete) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Purchase not found" });
    }


    for (const item of purchaseToDelete.items) {
      await Stock.findOneAndUpdate(
        { ingredient: item.ingredient, branch: purchaseToDelete.branch },
        { $inc: { quantityInStock: -item.quantity } },
        { session: session }
      );
    }

    const expenseDeletionResult = await Expense.findOneAndDelete({ purchaseId: id }).session(session);
    

    if (!expenseDeletionResult) {
      // If the expense is not found, throw an error.
      // This immediately stops the 'try' block and jumps to the 'catch' block.
      throw new Error("Associated expense record not found. Deletion cancelled to protect data integrity.");
    }

    // 4. This line will ONLY run if the expense was found and deleted successfully.
    await Purchase.findByIdAndDelete(id).session(session);

    // 5. Commit the transaction if everything succeeded.
    await session.commitTransaction();
    res.status(200).json({ message: "Purchase deleted successfully. Stock and expense records were reversed." });

  } catch (err) {
    // The transaction is aborted here if any error occurs (including the missing expense).
    await session.abortTransaction();
    // Send back the alert/error message.
    res.status(500).send({ error: "Failed to delete purchase.", details: err.message });
  } finally {
    // Always end the session.
    session.endSession();
  }
}


export async function getNextInvoiceNumber(req, res) {
  try {
    const { branch } = req.params;
    const prefix = "INV-";

    const lastPurchase = await Purchase.findOne({ branch, invoiceNumber: { $regex: `^${prefix}` } })
                                      .sort({ createdAt: -1 });

    let nextNumber = 1001; // Default starting number

    if (lastPurchase && lastPurchase.invoiceNumber) {
      const lastNumber = parseInt(lastPurchase.invoiceNumber.split(prefix)[1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const nextInvoiceNumber = `${prefix}${nextNumber}`;
    res.status(200).json({ nextInvoiceNumber });

  } catch (err) {
    res.status(500).send({ error: "Failed to generate next invoice number.", details: err.message });
  }
}