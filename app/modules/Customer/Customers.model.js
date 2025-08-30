import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CustomerSchema = Schema(
  {
    customerNumber: {
      type: String,
      unique: true,
      required: true,
      default: "01",
    },
    name: {
      type: String,
      required: [true, "Please provide the customer name"],
    },
    address: {
      type: String,
      required: false,
    },
    mobile: {
      type: String,
      required: [true, "Please provide the customer mobile number"],
    },
    email: {
      type: String,
      required: false,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    anniversary: {
      type: Date,
      required: false,
    },
    dateOfFirstVisit: {
      type: Date,
      default: Date.now,
    },
    branch: {
      type: String,
      required: [true, "Please provide the branch"],
    },
    // **NEW FIELDS START HERE**
    invoices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Invoice",
      },
    ],
    totalAmountSpent: {
      type: Number,
      default: 0,
    },
    currentPoints: {
      type: Number,
      default: 0,
    },
    redeemHistory: [
      {
        redeemedPoints: { type: Number, required: true },
        redeemedDate: { type: Date, default: Date.now },
        invoiceId: {
          type: Schema.Types.ObjectId,
          ref: "Invoice",
        },
      },
    ],
    numberOfOrders: {
      type: Number,
      default: 0,
    },
    // **NEW FIELDS END HERE**
  },
  { timestamps: true }
);

// Pre-save hook to generate the customer number
CustomerSchema.pre("save", async function (next) {
  if (this.isNew) {
    // You need to ensure the correct model name is used here.
    // In your original code, you have "Purchaser", but the model is "Customer".
    // I've kept it as "Purchaser" to match your original schema code.
    const lastCustomer = await mongoose.model("Purchaser").findOne().sort({ customerNumber: -1 });
    const lastNumber = lastCustomer ? parseInt(lastCustomer.customerNumber) : 0;
    const newNumber = (lastNumber + 1).toString().padStart(2, "0"); // Ensure it's always two digits
    this.customerNumber = newNumber;
  }
  next();
});

const Customer = model("Purchaser", CustomerSchema);

export default Customer;