import Purchase from "./Purchase.model.js";
import Stock from "../Stock/Stock.model.js";
import Ingredient from "../Ingredient/Ingredient.model.js";
import Vendor from "../Vendor/Vendor.model.js";
import Expense from "../Expense/Expense.model.js";
import mongoose from "mongoose";
import StockMovement from "./../Stock/StockMovement.model.js";

export async function createPurchase(req, res) {
    try {
        const purchaseData = req.body;
        const { userId } = purchaseData;

        if (!userId) {
            throw new Error("User ID is missing from the request payload.");
        }

        const newPurchase = new Purchase(purchaseData);
        await newPurchase.save();

        for (const item of purchaseData.items) {
            const ingredientDetails = await Ingredient.findById(item.ingredient);
            if (!ingredientDetails) throw new Error(`Ingredient with ID ${item.ingredient} not found.`);
            
            const originalStock = await Stock.findOne({ ingredient: item.ingredient, branch: purchaseData.branch });
            const beforeQuantity = originalStock ? originalStock.quantityInStock : 0;
            const afterQuantity = beforeQuantity + item.quantity;

            const updatedStock = await Stock.findOneAndUpdate(
                { ingredient: item.ingredient, branch: purchaseData.branch },
                { $set: { quantityInStock: afterQuantity, unit: ingredientDetails.unit } },
                { upsert: true, new: true }
            );

            await StockMovement.create({
                stock: updatedStock._id,
                branch: purchaseData.branch,
                type: 'purchase',
                beforeQuantity: beforeQuantity,
                afterQuantity: afterQuantity,
                adjustment: item.quantity,
                note: `From purchase #${newPurchase.invoiceNumber || 'N/A'}.`,
                createdBy: userId,
            });
        }

        const vendorDetails = await Vendor.findById(purchaseData.vendor);
        if (!vendorDetails) throw new Error(`Vendor not found.`);

        const expenseData = {
            title: `Purchase from ${vendorDetails.vendorName}`,
            category: "Vendor",
            vendorName: vendorDetails.vendorName,
            totalAmount: purchaseData.grandTotal,
            paidAmount: purchaseData.paidAmount,
            paymentStatus: purchaseData.paymentStatus,
            paymentMethod: purchaseData.paymentMethod, 
            date: purchaseData.purchaseDate,
            note: `Auto-generated from purchase #${newPurchase.invoiceNumber || 'N/A'}.`,
            branch: purchaseData.branch,
            purchaseId: newPurchase._id
        };
        await Expense.create(expenseData);

        res.status(201).json({ message: "Purchase created successfully!" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

export async function updatePurchase(req, res) {
    const id = req.params.id;
    const updateData = req.body;

    try {
        const { userId } = updateData;
        if (!userId) {
            throw new Error("User ID is missing from the request payload.");
        }
        
        const originalPurchase = await Purchase.findById(id);
        if (!originalPurchase) throw new Error("Purchase not found.");

        const originalItemsMap = new Map(originalPurchase.items.map(item => [item.ingredient.toString(), item]));
        const newItemsMap = new Map(updateData.items.map(item => [item.ingredient.toString(), item]));
        const allIngredientIds = new Set([...originalItemsMap.keys(), ...newItemsMap.keys()]);

        for (const ingredientId of allIngredientIds) {
            const oldItem = originalItemsMap.get(ingredientId);
            const newItem = newItemsMap.get(ingredientId);
            const oldQty = oldItem ? oldItem.quantity : 0;
            const newQty = newItem ? newItem.quantity : 0;
            const adjustment = newQty - oldQty;

            if (adjustment !== 0) {
                const stockItem = await Stock.findOne({ 
                    ingredient: ingredientId, 
                    branch: originalPurchase.branch 
                });
                
                if (!stockItem && adjustment < 0) {
                    throw new Error(`Cannot deduct stock for ingredient ${ingredientId} as it does not exist.`);
                }
                const beforeQuantity = stockItem ? stockItem.quantityInStock : 0;
                const afterQuantity = beforeQuantity + adjustment;

                const updatedStock = await Stock.findOneAndUpdate(
                    { ingredient: ingredientId, branch: originalPurchase.branch },
                    { $inc: { quantityInStock: adjustment } },
                    { new: true }
                );

                await StockMovement.create({
                    stock: updatedStock._id,
                    branch: originalPurchase.branch,
                    type: 'purchase',
                    beforeQuantity: beforeQuantity,
                    afterQuantity: afterQuantity,
                    adjustment: adjustment,
                    note: `Adjustment from updating purchase #${originalPurchase.invoiceNumber}.`,
                    createdBy: userId,
                });
            }
        }
        
        const vendorDetails = await Vendor.findById(updateData.vendor);
        if (!vendorDetails) throw new Error(`Vendor ${updateData.vendor} not found`);

        const updatedExpenseData = {
            title: `Purchase from ${vendorDetails.vendorName}`,
            totalAmount: updateData.grandTotal,
            paidAmount: updateData.paidAmount,
            paymentStatus: updateData.paymentStatus,
            paymentMethod: updateData.paymentMethod,
            date: updateData.purchaseDate,
            branch: updateData.branch,
        };
        
        await Expense.findOneAndUpdate({ purchaseId: id }, { $set: updatedExpenseData });
        
        const updatedPurchase = await Purchase.findByIdAndUpdate(id, updateData, { new: true });
        
        res.status(200).json({ message: "Purchase updated successfully.", purchase: updatedPurchase });
    } catch (err) {
        res.status(500).send({ error: "Failed to update purchase.", details: err.message });
    }
}

export async function removePurchase(req, res) {
    const id = req.params.id;
    try {
        const { userId } = req.body;
        if (!userId) {
            throw new Error("User ID is missing from the request payload for deletion.");
        }

        const purchaseToDelete = await Purchase.findById(id);
        if (!purchaseToDelete) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        for (const item of purchaseToDelete.items) {
            const stockItem = await Stock.findOne({
                ingredient: item.ingredient,
                branch: purchaseToDelete.branch
            });

            if (stockItem) {
                const beforeQuantity = stockItem.quantityInStock;
                const adjustment = -item.quantity;
                const afterQuantity = beforeQuantity + adjustment;

                const updatedStock = await Stock.findOneAndUpdate(
                    { _id: stockItem._id },
                    { $inc: { quantityInStock: adjustment } },
                    { new: true }
                );

                await StockMovement.create({
                    stock: updatedStock._id,
                    branch: purchaseToDelete.branch,
                    type: 'purchase',
                    beforeQuantity: beforeQuantity,
                    afterQuantity: afterQuantity,
                    adjustment: adjustment,
                    note: `Reversal from deleting purchase #${purchaseToDelete.invoiceNumber}.`,
                    createdBy: userId,
                });
            }
        }

        await Expense.findOneAndDelete({ purchaseId: id });
        await Purchase.findByIdAndDelete(id);

        res.status(200).json({ message: "Purchase deleted successfully." });
    } catch (err) {
        res.status(500).send({ error: "Failed to delete purchase.", details: err.message });
    }
}

export async function getPurchasesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const purchases = await Purchase.find({ branch })
      .populate({
        path: 'items.ingredient',
        populate: {
            path: 'category',
            model: 'IngredientCategory'
        }
      })
      .populate("vendor");
    res.status(200).json(purchases);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getPurchaseAnalysis(req, res) {
    const { branch } = req.params;
    const { year, month, category, page = 1, limit = 10 } = req.query;

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

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 1);
    const prevMonthDate = new Date(startDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevStartDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const prevEndDate = startDate;

    try {
        const getMonthlyData = async (branch, start, end, categoryFilter) => {
            const pipeline = [
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
            ];

            if (categoryFilter) {
                pipeline.push({
                    $match: { "ingredientInfo.category": new mongoose.Types.ObjectId(categoryFilter) }
                });
            }

            pipeline.push({
                $project: {
                    _id: 0,
                    ingredientId: "$_id",
                    ingredientName: "$ingredientInfo.name",
                    unit: "$ingredientInfo.unit",
                    totalQuantity: 1,
                    averageUnitPrice: { $round: ["$averageUnitPrice", 2] },
                    totalAmount: 1,
                },
            });
            
            return Purchase.aggregate(pipeline);
        };

        const currentMonthData = await getMonthlyData(branch, startDate, endDate, category);
        const previousMonthData = await getMonthlyData(branch, prevStartDate, prevEndDate, category);

        const previousMonthMap = new Map(
            previousMonthData.map(item => [item.ingredientId.toString(), item])
        );

        let analysis = currentMonthData.map(currentItem => {
            const previousItem = previousMonthMap.get(currentItem.ingredientId.toString());
            if (previousItem) previousMonthMap.delete(currentItem.ingredientId.toString());

            const calculateChange = (current, previous) => {
                if (!previous || previous === 0) return 100;
                if (current === 0) return -100;
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
                        unitPriceChangePercent: calculateChange(currentItem.averageUnitPrice, previousItem?.averageUnitPrice),
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
                        unitPriceChangePercent: -100,
                    },
                },
            });
        }

        analysis.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
        
        const totalItems = analysis.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const startIndex = (pageNumber - 1) * pageSize;
        const paginatedData = analysis.slice(startIndex, startIndex + pageSize);

        res.status(200).json({
            period: { year: currentYear, month: currentMonth, startDate, endDate },
            previousPeriod: {
                year: prevStartDate.getFullYear(),
                month: prevStartDate.getMonth() + 1,
                startDate: prevStartDate, endDate: prevEndDate,
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

export async function getNextInvoiceNumber(req, res) {
  try {
    const { branch } = req.params;
    const prefix = "INV-";

    const lastPurchase = await Purchase.findOne({ branch, invoiceNumber: { $regex: `^${prefix}` } })
                                        .sort({ createdAt: -1 });

    let nextNumber = 1001; 

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