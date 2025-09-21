import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Sub-schema for individual items within a purchase
const PurchaseItemSchema = Schema({
  ingredient: {
    type: Schema.Types.ObjectId,
    ref: "Ingredient",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, "Quantity cannot be negative"],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, "Unit price cannot be negative"],
  },
  totalPrice: {
    type: Number,
    required: true,
  },
});

const PurchaseSchema = Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    invoiceNumber: {
      type: String,
    },
    items: [PurchaseItemSchema],
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["Paid", "Unpaid", "Partial"],
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      required: [true, "Please provide a payment method"],
      enum: ["Cash", "Card", "Mobile", "Other"],
      default: "Cash",
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

const Purchase = model("Purchase", PurchaseSchema);

export default Purchase;