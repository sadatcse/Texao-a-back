// src/api/StockMovement/StockMovement.model.js

import mongoose from "mongoose";
const { Schema, model } = mongoose;

const StockMovementSchema = new Schema(
  {
    stock: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: true,
    },
    branch: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['manual_adjustment', 'purchase', 'sale', 'wastage'],
      default: 'manual_adjustment',
    },
    beforeQuantity: {
      type: Number,
      required: true,
    },
    afterQuantity: {
      type: Number,
      required: true,
    },
    adjustment: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assumes you have a User model
      required: true,
    },
  },
  { timestamps: true }
);

const StockMovement = model("StockMovement", StockMovementSchema);
export default StockMovement;