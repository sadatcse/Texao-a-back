import mongoose from "mongoose";
const { Schema, model } = mongoose;

const TableSchema = Schema(
  {
    tableName: {
      type: String,
          required: true, // It's better to require it.
      default: function () {
        return `Table-${Math.floor(1000 + Math.random() * 9000)}`;
      },
    },
    branch: {
      type: String,
      required: [true, "Please provide the branch"],
    },
  },
  { timestamps: true }
);

// Indexes for production performance optimization
TableSchema.index({ branch: 1 });

const Table = model("Table", TableSchema);
export default Table;