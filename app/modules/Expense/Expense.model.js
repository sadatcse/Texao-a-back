import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ExpenseSchema = Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide a title"],
    },
    category: {
      type: String,
      required: [true, "Please provide a category"],
      enum: [
        "Utility",
        "Maintenance",
        "Rent",
        "Salary",
        "Groceries",
        "Marketing",
        "Cleaning",
        "Vendor",
        "Other",
      ],
    },
    vendorName: {
      type: String,
    },
    totalAmount: {
      type: Number,
      required: [true, "Please provide a total amount"],
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      required: [true, "Please provide a payment status"],
      enum: ["Paid", "Unpaid", "Partial"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Please provide a payment method"],
      enum: ["Cash", "Card", "Mobile", "Other"],
    },
    date: {
      type: Date,
      required: [true, "Please provide a date"],
      default: Date.now,
    },
    note: {
      type: String,
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
  },
  { timestamps: true }
);

const Expense = model("Expense", ExpenseSchema);

export default Expense;