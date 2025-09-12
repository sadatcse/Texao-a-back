import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ReviewSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Purchaser",
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    tableId: {
        type: Schema.Types.ObjectId,
        ref: "Table",
        required: true,
    },
    tableName: {
        type: String,
        required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerMobile: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Please provide a rating"],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: false,
    },
    bestFoodName: {
      type: String,
      required: false,
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
  },
  { timestamps: true }
);

const Review = model("Review", ReviewSchema);

export default Review;

