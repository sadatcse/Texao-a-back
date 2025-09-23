import mongoose from "mongoose";
import VendorPayment from "./VendorPayment.model.js";
import Purchase from "../Purchase/Purchase.model.js";
import Vendor from "../Vendor/Vendor.model.js";
import Expense from "../Expense/Expense.model.js";



export const getPaymentById = async (req, res) => {
    try {
        const payment = await VendorPayment.findById(req.params.id)
            .populate('vendor', 'vendorName')
            .populate('createdBy', 'name')
            .populate({
                path: 'appliedToPurchases.purchase',
                select: 'invoiceNumber grandTotal'
            });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch payment details.', error: error.message });
    }
};


export const createVendorPayment = async (req, res) => {

  
  // MODIFICATION 1: Destructure paymentDate from the request body
  const { vendorId, branch, amountPaid, paymentMethod, notes, paymentDate,userId } = req.body;
  
  if (!vendorId || !amountPaid || !userId) {
    return res.status(400).json({ message: "Missing required fields or user not authenticated." });
  }

  try {
    let remainingAmountToSettle = parseFloat(amountPaid);
    const appliedPurchases = [];

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new Error("Vendor not found.");

    const outstandingPurchases = await Purchase.find({
      vendor: vendorId,
      branch: branch,
      paymentStatus: { $in: ["Unpaid", "Partial"] },
    }).sort({ purchaseDate: 1 });

    if (outstandingPurchases.length === 0) {
        throw new Error("No outstanding amount to pay for this vendor.");
    }

    for (const purchase of outstandingPurchases) {
        if (remainingAmountToSettle <= 0) break;

        const dueAmount = purchase.grandTotal - purchase.paidAmount;
        const amountToApply = Math.min(remainingAmountToSettle, dueAmount);

        if (amountToApply > 0) {
            purchase.paidAmount += amountToApply;
            purchase.paymentStatus = (purchase.paidAmount >= purchase.grandTotal) ? "Paid" : "Partial";
            await purchase.save();
            
            await Expense.findOneAndUpdate(
                { purchaseId: purchase._id },
                { $set: { paidAmount: purchase.paidAmount, paymentStatus: purchase.paymentStatus } }
            );

            appliedPurchases.push({
                purchase: purchase._id,
                amountApplied: amountToApply,
            });

            remainingAmountToSettle -= amountToApply;
        }
    }

    if (appliedPurchases.length === 0) {
        throw new Error("Payment could not be applied to any outstanding purchase.");
    }
    
    // Create the vendor payment record
    const newPayment = new VendorPayment({
      vendor: vendorId,
      branch,
      // MODIFICATION 2: Use the provided date, or default to now() if it's missing
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amountPaid,
      paymentMethod,
      notes,
      createdBy: userId,
      appliedToPurchases: appliedPurchases,
    });
    await newPayment.save();
    
    // Create a corresponding expense record for this cash outflow
    await Expense.create({
        title: `Payment to ${vendor.vendorName}`,
        category: "Vendor",
        vendorName: vendor.vendorName,
        totalAmount: amountPaid,
        paidAmount: amountPaid,
        paymentStatus: "Paid",
        paymentMethod: paymentMethod,
        // MODIFICATION 3: Use the same date for the expense record
        date: paymentDate ? new Date(paymentDate) : new Date(),
        note: `Payment recorded with reference ID: ${newPayment._id}. ${notes || ''}`.trim(),
        branch: branch,
    });

    res.status(201).json({ message: "Vendor payment recorded successfully!", payment: newPayment });

  } catch (error) {
    res.status(500).json({ message: "Failed to record vendor payment.", error: error.message });
  }
};