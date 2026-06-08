import mongoose from "mongoose";
const { Schema, model } = mongoose;

const StockSchema = Schema(
  {
    ingredient: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    quantityInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    // The unit is stored here for quick access, avoiding extra lookups
    unit: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
  },
  { timestamps: true }
);

// Indexes for production performance optimization
StockSchema.index({ branch: 1 });
StockSchema.index({ ingredient: 1, branch: 1 }, { unique: true });

const Stock = model("Stock", StockSchema);

export default Stock;