import mongoose from "mongoose";
const { Schema, model } = mongoose;

// --- Customer Schema ---
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
        // New fields for customer tracking
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
                user: { // Store user's name and email as an object
                    name: { type: String, required: true },
                    email: { type: String, required: true }
                },
                invoiceId: { // This is the missing field
                    type: Schema.Types.ObjectId,
                    ref: "Invoice",
                    required: false // It might not always be linked to an invoice, so it can be optional
                }
            },
        ],
        numberOfOrders: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Pre-save hook to generate the customer number
CustomerSchema.pre("save", async function (next) {
    if (this.isNew) {
        const lastCustomer = await mongoose.model("Purchaser").findOne().sort({ customerNumber: -1 });
        const lastNumber = lastCustomer ? parseInt(lastCustomer.customerNumber) : 0;
        const newNumber = (lastNumber + 1).toString().padStart(2, "0");
        this.customerNumber = newNumber;
    }
    next();
});

const Customer = model("Purchaser", CustomerSchema);

export default Customer;