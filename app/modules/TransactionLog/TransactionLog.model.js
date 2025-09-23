// In your TransactionLog.model.js file

import mongoose from "mongoose";
import { nanoid } from "nanoid"; // A great library for unique, short IDs

const { Schema, model } = mongoose;

const TransactionLogSchema = new Schema(
  {
    logId: {
      type: String,
      default: () => nanoid(10), // Generates a unique 10-character ID like 'x1a2b3c4d5'
      unique: true, // This is a PROPER unique ID for the log entry
    },
    transactionType: {
      type: String,
      required: [true, "Transaction type is required"],
    },
    // REMOVED THE UNIQUE CONSTRAINT HERE
    transactionCode: {
      type: String, // e.g., "500", "404", "200"
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      required: true,
    },
    amount: {
      type: Number,
      default: 0, // It's better to have a default for logs that aren't financial
    },
    ipAddress: {
      type: String,
      required: true,
    },
    details: {
      type: String,
    },
    message: { // Renamed from "Message" to follow JS naming conventions
      type: String,
      default: null,
    },
    stackTrace: {
      type: String,
      default: null,
    },
    transactionTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure no incorrect index is accidentally created on transactionCode
TransactionLogSchema.index({ transactionCode: 1 }, { unique: false });


const TransactionLog = model("TransactionLog", TransactionLogSchema);

export default TransactionLog;