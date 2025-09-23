import mongoose from "mongoose";
const { Schema, model } = mongoose;

const VendorPaymentSchema = Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be greater than zero"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Please provide a payment method"],
      enum: ["Cash", "Card", "Mobile", "Other"],
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming you have a User model
      required: true,
    },
    // This array tracks which purchase invoices this payment was applied to.
    appliedToPurchases: [
      {
        purchase: {
          type: Schema.Types.ObjectId,
          ref: "Purchase",
        },
        amountApplied: {
          type: Number,
        },
      },
    ],
  },
  { timestamps: true }
);

const VendorPayment = model("VendorPayment", VendorPaymentSchema);

export default VendorPayment;