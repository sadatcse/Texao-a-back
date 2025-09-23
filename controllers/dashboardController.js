import Company from "../app/modules/Company/Companys.model.js";
import Product from "../app/modules/Product/Product.model.js";
import User from "../app/modules/User/Users.model.js";
import Customer from "../app/modules/Customer/Customers.model.js";
import Vendor from "../app/modules/Vendor/Vendor.model.js";
import Ingredient from "../app/modules/Ingredient/Ingredient.model.js";
import Recipe from "../app/modules/Recipe/Recipe.model.js";
import Invoice from "../app/modules/Invoice/Invoices.model.js";
import Expense from "../app/modules/Expense/Expense.model.js";
import Purchase from "../app/modules/Purchase/Purchase.model.js";
import UserLog from "../app/modules/UserLog/UserLog.model.js";
import Review from "../app/modules/Review/Review.model.js";
import TableReservation from "../app/modules/TableReservation/TableReservation.model.js";
import TransactionLog from "../app/modules/TransactionLog/TransactionLog.model.js";
import Stock from "../app/modules/Stock/Stock.model.js";
import moment from "moment";

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    // Use Promise.all to run queries concurrently for speed
    const [
      // --- Global Counts ---
      totalBranches,
      totalUsers,
      totalCustomers,
      totalVendors,
      totalProducts,
      totalIngredients,
      totalRecipes,
      
      // --- Today's Financials ---
      todaysSalesData,
      todaysExpensesData,
      todaysPurchasesData,

      // --- Today's Activity ---
      todaysLogins,
      newCustomersToday,
      newReviewsToday,
      pendingReservations,

      // --- System Health ---
      failedTransactionsToday,
      pendingOrders,
      lowStockAlerts,
    ] = await Promise.all([
      // Global Counts
      Company.countDocuments(),
      User.countDocuments(),
      Customer.countDocuments(),
      Vendor.countDocuments(),
      Product.countDocuments(),
      Ingredient.countDocuments(),
      Recipe.countDocuments(),

      // Today's Financials (using aggregate for sums)
      Invoice.aggregate([
        { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: "$totalSale" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Purchase.aggregate([
        { $match: { purchaseDate: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),

      // Today's Activity Counts
      UserLog.countDocuments({ loginTime: { $gte: startOfDay, $lte: endOfDay } }),
      Customer.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Review.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      TableReservation.countDocuments({ status: "Pending", startTime: { $gte: startOfDay } }),

      // System Health Counts
      TransactionLog.countDocuments({ status: "failed", transactionTime: { $gte: startOfDay, $lte: endOfDay } }),
      Invoice.countDocuments({ orderStatus: "pending" }),
      Stock.aggregate([
        {
            $lookup: { // Join Stock with Ingredient to get stockAlert level
                from: 'ingredients',
                localField: 'ingredient',
                foreignField: '_id',
                as: 'ingredientInfo'
            }
        },
        { $unwind: '$ingredientInfo' },
        {
            $match: { // Filter where current stock is below alert level
                $expr: { $lt: ['$quantityInStock', '$ingredientInfo.stockAlert'] }
            }
        },
        { $count: 'count' }
      ]),
    ]);

    // Process aggregated results
    const todaysSales = todaysSalesData[0]?.total || 0;
    const todaysTransactions = todaysSalesData[0]?.count || 0;
    const todaysExpenses = todaysExpensesData[0]?.total || 0;
    const todaysPurchases = todaysPurchasesData[0]?.total || 0;
    const todaysNetPosition = todaysSales - (todaysExpenses + todaysPurchases);
    
    res.status(200).json({
      // Global
      totalBranches,
      totalUsers,
      totalCustomers,
      totalVendors,
      // Inventory & Menu
      totalProducts,
      totalIngredients,
      totalRecipes,
      // Today's Financials
      todaysSales,
      todaysTransactions,
      todaysExpenses,
      todaysPurchases,
      todaysNetPosition,
      // Today's Activity
      todaysLogins,
      newCustomersToday,
      newReviewsToday,
      pendingReservations,
      // System Health
      failedTransactionsToday,
      pendingOrders,
      lowStockAlerts: lowStockAlerts[0]?.count || 0,
    });

  } catch (error) {
    console.error("Error fetching super admin dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};