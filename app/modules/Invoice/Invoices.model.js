import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Function to generate invoice serial number (unchanged)
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
  // **NEW**: VAT for the individual product
  vat: {
    type: Number,
    default: 0,
  },
  // **NEW**: Supplementary Duty (SD) for the individual product
  sd: {
    type: Number,
    default: 0,
  },
  cookStatus: {
    type: String,
    enum: ['PENDING', 'COOKING', 'SERVED'],
    default: 'PENDING',
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
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
    // This now represents the sum of VAT from all products
    vat: {
      type: Number,
      default: 0
    },
    // **NEW**: Total SD, summed from all products
    sd: {
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
    tableName: {
      type: String,
      required: [
        function () {
          return this.orderType === "dine-in";
        },
        "Table name is required for dine-in orders.",
      ],
    },
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
paymentMethod: {
    type: String,
    enum: [
        'Cash',
        'Visa Card',
        'Master Card',
        'Amex Card',
        'Bkash',
        'Nagad',
        'Rocket',
        'Bank'
    ],
    default: 'Cash'
}
  },
  { timestamps: true }
);

// **UPDATED**: pre-save hook to calculate totals
InvoiceSchema.pre('save', function(next) {
    // Calculate total quantity (includes complimentary items)
    this.totalQty = this.products.reduce((acc, product) => acc + (product.qty || 0), 0);

    // Filter out complimentary products for financial calculations
    const nonComplimentaryProducts = this.products.filter(product => !product.isComplimentary);

    // Calculate totals from non-complimentary items only
    const subtotal = nonComplimentaryProducts.reduce((acc, product) => acc + (product.subtotal || 0), 0);
    const totalVat = nonComplimentaryProducts.reduce((acc, product) => acc + (product.vat || 0), 0);
    const totalSd = nonComplimentaryProducts.reduce((acc, product) => acc + (product.sd || 0), 0);

    // Assign calculated aggregate taxes to the invoice document
    this.vat = totalVat;
    this.sd = totalSd;

    // totalSale is the amount before discount but including all taxes
    this.totalSale = subtotal + this.vat + this.sd;

    // totalAmount is the final payable amount after discount
    const discountAmount = this.discount || 0;
    this.totalAmount = this.totalSale - discountAmount;
    
    next();
});

const Invoice = model("Invoice", InvoiceSchema);

export default Invoice;