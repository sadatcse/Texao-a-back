import Expense from "./Expense.model.js";
import VendorPayment from "../VendorPayment/VendorPayment.model.js";
import Purchase from "../Purchase/Purchase.model.js";
import Vendor from "../Vendor/Vendor.model.js"; 

export async function getAllExpenses(req, res) {
  try {
    const result = await Expense.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export const getExpenseSummary = async (req, res) => {
    try {
        const { branch } = req.params;
        let { fromDate, toDate } = req.query;

        // --- Date Calculation for Current Period ---
        let startDate, endDate;
        if (!fromDate || !toDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            startDate = new Date(fromDate);
            endDate = new Date(toDate);
        }
        endDate.setHours(23, 59, 59, 999);

        // --- NEW: Date Calculation for Previous Period Comparison ---
        const diff = endDate.getTime() - startDate.getTime();
        const prevEndDate = new Date(startDate.getTime() - 1); // The day before the current period starts
        const prevStartDate = new Date(prevEndDate.getTime() - diff);

        // --- Build Match Queries ---
        const currentPeriodMatch = { branch: branch, date: { $gte: startDate, $lte: endDate } };
        const previousPeriodMatch = { branch: branch, date: { $gte: prevStartDate, $lte: prevEndDate } };

        // --- Perform all calculations in parallel for efficiency ---
        const [summary, currentTotals, vendorDues, previousTotals] = await Promise.all([
            // 1. Get Category Breakdown (Current Period)
            Expense.aggregate([
                { $match: currentPeriodMatch },
                { $group: { _id: "$category", totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, count: { $sum: 1 } } },
                { $project: { _id: 0, category: "$_id", totalAmount: 1, paidAmount: 1, count: 1 } },
                { $sort: { totalAmount: -1 } }
            ]),
            // 2. Get Overall Totals (Current Period)
            Expense.aggregate([
                { $match: currentPeriodMatch },
                { $group: { _id: null, totalExpense: { $sum: "$totalAmount" }, totalPaid: { $sum: "$paidAmount" } } }
            ]),
            // 3. Get Vendor-specific Due Amounts (Current Period) with Vendor ID
            Expense.aggregate([
                { $match: { ...currentPeriodMatch, category: "Vendor", paymentStatus: { $in: ["Unpaid", "Partial"] } } },
                { $group: { _id: "$vendorName", totalDue: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } } } },
                // --- MODIFICATION: Look up the Vendor collection to get the ID ---
                { $lookup: {
                    from: "vendors", // The name of the vendors collection
                    let: { vendorName: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$vendorName", "$$vendorName"] }, branch: branch } },
                        { $limit: 1 }
                    ],
                    as: "vendorInfo"
                }},
                { $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true } },
                { $project: { _id: 0, vendorId: "$vendorInfo._id", vendorName: "$_id", totalDue: 1 } },
                { $sort: { totalDue: -1 } }
            ]),
            // 4. NEW: Get Overall Totals (Previous Period) for comparison
            Expense.aggregate([
                { $match: previousPeriodMatch },
                { $group: { _id: null, totalExpense: { $sum: "$totalAmount" }, totalPaid: { $sum: "$paidAmount" } } }
            ])
        ]);

        // --- NEW: Calculate Percentage Change ---
        const totalsCurrent = currentTotals[0] || { totalExpense: 0, totalPaid: 0 };
        const totalsPrevious = previousTotals[0] || { totalExpense: 0, totalPaid: 0 };

        const calculateChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0; // Avoid division by zero
            return ((current - previous) / previous) * 100;
        };

        const comparison = {
            previousPeriod: {
                totalExpense: totalsPrevious.totalExpense,
                totalPaid: totalsPrevious.totalPaid
            },
            change: {
                expensePercent: calculateChange(totalsCurrent.totalExpense, totalsPrevious.totalExpense),
                paidPercent: calculateChange(totalsCurrent.totalPaid, totalsPrevious.totalPaid)
            }
        };

        res.status(200).json({
            summary: summary,
            totals: totalsCurrent,
            vendorDues: vendorDues,
            comparison: comparison // <-- NEW DATA OBJECT
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to fetch expense summary.", error: error.message });
    }
};


export async function getExpenseByBranch(req, res) {
  try {
    const { branch } = req.params;
    // --- MODIFICATION START ---
    // Destructure fromDate and toDate from the query instead of 'date'
    const { search, fromDate, toDate, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { branch };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }
    
    // Build the date range query
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        // Set the start of the day for the 'from' date
        const startDate = new Date(fromDate);
        startDate.setUTCHours(0, 0, 0, 0);
        query.date.$gte = startDate;
      }
      if (toDate) {
        // Set the end of the day for the 'to' date to include the entire day
        const endDate = new Date(toDate);
        endDate.setUTCHours(23, 59, 59, 999);
        query.date.$lte = endDate;
      }
    }
    // --- MODIFICATION END ---

    const [results, totalDocuments] = await Promise.all([
      Expense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNumber),
      Expense.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(totalDocuments / limitNumber);

    res.status(200).json({
      data: results,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalDocuments,
        limit: limitNumber
      }
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get expense by ID
export async function getExpenseById(req, res) {
  const id = req.params.id;
  try {
    const result = await Expense.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new expense
export async function createExpense(req, res) {
  try {
    const expenseData = req.body;
    const result = await Expense.create(expenseData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function removeExpense(req, res) {
  const id = req.params.id;

  try {
    const expenseToDelete = await Expense.findById(id);

    if (!expenseToDelete) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const paymentIdRegex = /reference ID: (\w+)/;
    const match = expenseToDelete.note?.match(paymentIdRegex);

    if (match && match[1]) {
      const vendorPaymentId = match[1];
      const vendorPayment = await VendorPayment.findById(vendorPaymentId);

      if (vendorPayment) {
        for (const applied of vendorPayment.appliedToPurchases) {
          const purchaseToUpdate = await Purchase.findById(applied.purchase);
          if (purchaseToUpdate) {
     
            purchaseToUpdate.paidAmount -= applied.amountApplied;


            if (purchaseToUpdate.paidAmount <= 0) {
              purchaseToUpdate.paidAmount = 0;
              purchaseToUpdate.paymentStatus = "Unpaid";
            } else {
              purchaseToUpdate.paymentStatus = "Partial";
            }
            await purchaseToUpdate.save();

        
            await Expense.findOneAndUpdate(
              { purchaseId: purchaseToUpdate._id },
              { $set: { paidAmount: purchaseToUpdate.paidAmount, paymentStatus: purchaseToUpdate.paymentStatus } }
            );
          }
        }

        await VendorPayment.findByIdAndDelete(vendorPaymentId);
      }
    }

    if (expenseToDelete.purchaseId) {
      return res.status(403).json({ 
        message: "This expense is linked to a purchase and cannot be deleted directly. Please delete the corresponding purchase record instead." 
      });
    }

    await Expense.findByIdAndDelete(id);

    res.status(200).json({ message: "Expense deleted successfully and financial records updated." });

  } catch (err) {
    res.status(500).send({ error: "Failed to delete expense.", details: err.message });
  }
}

// Update an expense by ID
export async function updateExpense(req, res) {
    const id = req.params.id;
    const expenseData = req.body;

    try {
        const originalExpense = await Expense.findById(id);

        if (!originalExpense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        // SCENARIO 1: Is this an expense linked to a Purchase?
        // Block the edit completely. It should only be editable via the Purchase module.
        if (originalExpense.purchaseId) {
            return res.status(403).json({
                message: "This expense is linked to a purchase and cannot be edited directly."
            });
        }

        // SCENARIO 2: Is this an expense from a Vendor Payment?
        const paymentIdRegex = /reference ID: (\w+)/;
        const match = originalExpense.note?.match(paymentIdRegex);

        if (match && match[1]) {
            // It's a vendor payment. We must restrict changing the amount.
            if (Number(expenseData.totalAmount) !== originalExpense.totalAmount) {
                return res.status(403).json({
                    message: "The amount of a vendor payment cannot be edited. Please delete and recreate the payment with the correct amount."
                });
            }

            // If the amount is the same, sync other details (date, method, notes) to the VendorPayment record.
            const vendorPaymentId = match[1];
            const vendorPayment = await VendorPayment.findById(vendorPaymentId);
            if (vendorPayment) {
                vendorPayment.paymentDate = expenseData.date;
                vendorPayment.paymentMethod = expenseData.paymentMethod;
                vendorPayment.notes = expenseData.notes; // Assuming notes can be edited from the expense note.
                await vendorPayment.save();
            }
        }
        
        // SCENARIO 3: It's a regular expense OR a vendor payment with allowed changes.
        // Proceed with the update.
        const updatedExpense = await Expense.findByIdAndUpdate(id, expenseData, { new: true });
        res.status(200).json(updatedExpense);

    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}