import Vendor from "./Vendor.model.js";
import Purchase from "../Purchase/Purchase.model.js";
import VendorPayment from "../VendorPayment/VendorPayment.model.js";
// Get all vendors
export async function getAllVendors(req, res) {
  try {
    const result = await Vendor.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get vendors by branch
export async function getVendorByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Vendor.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
export async function getVendorLedger(req, res) {
  try {
    const { vendorId } = req.params;
    let { fromDate, toDate } = req.query; // Use 'let' to allow modification

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // --- MODIFICATION: Default to current month if no dates are provided ---
    if (!fromDate && !toDate) {
      const now = new Date();
      // First day of the current month
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      // Last day of the current month
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    // --- END MODIFICATION ---

    // --- Date Filtering Setup ---
    const dateQuery = {};
    if (fromDate) dateQuery.$gte = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateQuery.$lte = endDate;
    }

    // --- Opening Balance Calculation (now always uses fromDate) ---
    const openingDateQuery = fromDate ? { $lt: new Date(fromDate) } : null;
    let openingBalance = 0;

    if (openingDateQuery) {
      const pastPurchases = await Purchase.aggregate([
        { $match: { vendor: vendor._id, purchaseDate: openingDateQuery } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]);
      const pastPayments = await VendorPayment.aggregate([
        { $match: { vendor: vendor._id, paymentDate: openingDateQuery } },
        { $group: { _id: null, total: { $sum: "$amountPaid" } } },
      ]);
      openingBalance = (pastPurchases[0]?.total || 0) - (pastPayments[0]?.total || 0);
    } else {
        // If no fromDate, calculate total historical balance as opening balance
        const allPurchases = await Purchase.aggregate([
             { $match: { vendor: vendor._id } },
             { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]);
        const allPayments = await VendorPayment.aggregate([
             { $match: { vendor: vendor._id } },
             { $group: { _id: null, total: { $sum: "$amountPaid" } } },
        ]);
        openingBalance = (allPurchases[0]?.total || 0) - (allPayments[0]?.total || 0);
    }


    // --- Fetch, Format, and Sort Transactions (No changes needed here) ---
    const purchaseQuery = { vendor: vendor._id };
    if (fromDate || toDate) purchaseQuery.purchaseDate = dateQuery;

    const paymentQuery = { vendor: vendor._id };
    if (fromDate || toDate) paymentQuery.paymentDate = dateQuery;

    const purchases = await Purchase.find(purchaseQuery);
    const payments = await VendorPayment.find(paymentQuery);

    const transactions = [];
    purchases.forEach(p => transactions.push({ sourceId: p._id, date: p.purchaseDate, type: 'Debit', details: `Purchase - Inv #${p.invoiceNumber}`, debit: p.grandTotal, credit: 0, }));
    payments.forEach(p => transactions.push({ sourceId: p._id, date: p.paymentDate, type: 'Credit', details: `Payment Received`, debit: 0, credit: p.amountPaid, }));
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let currentBalance = openingBalance;
    const ledgerEntries = transactions.map(tx => {
      currentBalance += tx.debit - tx.credit;
      return { ...tx, balance: currentBalance };
    });

    res.status(200).json({
      vendor,
      openingBalance,
      closingBalance: currentBalance,
      ledger: ledgerEntries,
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vendor ledger.", error: error.message });
  }
}
// Get vendor by ID
export async function getVendorById(req, res) {
  const id = req.params.id;
  try {
    const result = await Vendor.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new vendor
export async function createVendor(req, res) {
  try {
    const vendorData = req.body;
    const result = await Vendor.create(vendorData);
    res.status(201).json(result);
  } catch (err) {
    // Handle duplicate vendorID error
    if (err.code === 11000) {
      return res.status(409).send({ error: "Vendor ID already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}

// Remove a vendor by ID
export const removeVendor = async (req, res) => {
    const { id } = req.params;

    try {
        // Step 1: Check if any purchases are linked to this vendor
        const purchaseCount = await Purchase.countDocuments({ vendor: id });

        // Step 2: If purchases exist, block the deletion and send an informative error
        if (purchaseCount > 0) {
            return res.status(403).json({
                message: `This vendor cannot be deleted because they are associated with ${purchaseCount} purchase(s).`
            });
        }

        // Step 3: If no purchases exist, proceed with deletion
        const result = await Vendor.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ message: "Vendor not found." });
        }

        res.status(200).json({ message: "Vendor has been deleted successfully." });

    } catch (error) {
        res.status(500).json({ message: "Server error while deleting vendor.", error: error.message });
    }
};

// Get active vendors by branch
export async function getActiveVendorsByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Vendor.find({ branch, status: "Active" });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a vendor by ID
export async function updateVendor(req, res) {
  const id = req.params.id;
  const vendorData = req.body;
  try {
    const result = await Vendor.findByIdAndUpdate(id, vendorData, {
      new: true,
      runValidators: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (err) {
    // Handle duplicate vendorID error on update
    if (err.code === 11000) {
      return res.status(409).send({ error: "Vendor ID already exists." });
    }
    res.status(500).send({ error: err.message });
  }
}