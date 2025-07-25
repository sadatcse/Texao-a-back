import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Function to generate invoice serial number
const generateInvoiceSerial = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${year}${month}${date}${hours}${minutes}${seconds}`;
};

// Product schema
const ProductSchema = Schema({
  productName: { type: String, required: true },
  qty: { type: Number, required: true },
  rate: { type: Number, required: true },
  subtotal: { type: Number, required: true },
});

// Invoice schema
const InvoiceSchema = Schema(
  {
    invoiceSerial: {
      type: String,
      required: [true, "Please provide an invoice serial"],
      unique: true,
      default: generateInvoiceSerial,
    },
    dateTime: {
      type: Date,
      required: [true, "Please provide the date and time"],
      default: Date.now,
    },
    loginUserEmail: {
      type: String,
      required: [true, "Please provide the email of the logged-in user"],
    },
    loginUserName: {
      type: String,
      required: [true, "Please provide the name of the logged-in user"],
    },
    products: {
      type: [ProductSchema],
      required: true,
      // Ensure products array is not empty
      validate: [v => Array.isArray(v) && v.length > 0, 'Please add at least one product']
    },
    totalQty: {
      type: Number,
      required: true,
      default: 0
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0
    },
    vat: {
      type: Number,
      default: 0
    },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      required: true,
    },
    counter: {
      type: String,
      required: [true, "Please provide a counter"],
    },
    branch: {
      type: String,
      required: [true, "Please provide a branch"],
    },
    totalSale: {
      type: Number,
      required: true,
      default: 0
    },
    orderStatus: {
      type: String,
      enum: ["pending", "completed", "cancelled", "cooking", "served"],
      default: "pending",
    },
    // Conditionally required field for 'dine-in'
    tableName: {
      type: String,
      required: [
        function () {
          return this.orderType === "dine-in";
        },
        "Table name is required for dine-in orders.",
      ],
    },
    // New conditionally required field for 'delivery'
    deliveryProvider: {
        type: String,
        enum: ['Pathao', 'Foodi', 'Foodpanda', 'DeliveryBoy'],
        required: [
            function() {
                return this.orderType === 'delivery';
            },
            'Delivery provider is required for delivery orders.'
        ]
    },
    customerName: {
      type: String,
    },
    customerMobile: {
      type: String,
    },
  },
  { timestamps: true }
);

// Middleware to calculate totals before saving
InvoiceSchema.pre('save', function(next) {
  // Calculate total quantity and amount from the products array
  this.totalQty = this.products.reduce((acc, product) => acc + (product.qty || 0), 0);
  this.totalAmount = this.products.reduce((acc, product) => acc + (product.subtotal || 0), 0);

  // Calculate the final total sale
  const discountAmount = this.discount || 0;
  const vatAmount = this.vat || 0; // Assuming VAT is a fixed amount, not percentage
  this.totalSale = this.totalAmount - discountAmount + vatAmount;

  next();
});


const Invoice = model("Invoice", InvoiceSchema);

export default Invoice;