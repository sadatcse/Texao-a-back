import Invoice from "../modules/Invoice/Invoice.model.js";
import Transaction from "../modules/Transaction/Transaction.model.js";
import currentMonthlyDate from "./currentMonthlyDate.js";

export async function GetCumulativeBalance() {
  const currentStartEndDate = currentMonthlyDate();
  try {
    const transactionMonthlyIncome = await Transaction.aggregate([
      {
        $match: {
          transaction_date: {
            $gte: currentStartEndDate.startDate,
            $lte: currentStartEndDate.endDate,
          },
          branch: branch,
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [
                { $eq: ["$transaction_type", "income_service"] },
                { $toDouble: "$amount" }, // Convert amount to double (float)
                0,
              ],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [
                { $ne: ["$transaction_type", "income_service"] },
                { $toDouble: "$amount" }, // Convert amount to double (float)
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          total: { $subtract: ["$totalIncome", "$totalExpense"] },
          income: "$totalIncome",
          expense: "$totalExpense",
        },
      },
    ]);

    const invoiceMonthlyBalance = await Invoice.aggregate([
      {
        $match: {
          transaction: {
            $gte: currentStartEndDate.startDate,
            $lte: currentStartEndDate.endDate,
          },
          branch: branch,
        },
      },
      {
        $group: {
          _id: null, // Grouping by email
          totalPackageFees: {
            $sum: { $toDouble: "$packageFee" }, // Summing package fees
          },
          totalAdmissionFees: {
            $sum: { $toDouble: "$admissionFee" }, // Summing admission fees
          },
          totalDiscount: {
            $sum: { $toDouble: "$discount" }, // Summing admission fees
          },
        },
      },

      {
        $project: {
          _id: 0,
          totalAdmissionFees: "$totalAdmissionFees",
          totalPackageFees: "$totalPackageFees",
          totalDiscount: "$totalDiscount",
          total: {
            $subtract: [
              { $add: ["$totalAdmissionFees", "$totalPackageFees"] },
              "$totalDiscount",
            ],
          },
        },
      },
    ]);

    if (
      transactionMonthlyIncome.length > 0 &&
      invoiceMonthlyBalance.length > 0
    ) {
      const cumulativeBalance =
        transactionMonthlyIncome[0]?.total + invoiceMonthlyBalance[0]?.total;
 
      return { cumulativeBalance };
    } else {
      return { cumulativeBalance: 0 };
    }
  } catch (error) {
    console.log(error, "error");
  }
}
