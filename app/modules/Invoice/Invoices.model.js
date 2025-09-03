import mongoose from "mongoose";
const { Schema, model } = mongoose;


// --- Invoice Schema ---
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

const ProductSchema = Schema({
  productName: { type: String, required: true },
  qty: { type: Number, required: true },
  rate: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  vat: { type: Number, default: 0 },
  sd: { type: Number, default: 0 },
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
    loginUserEmail: { type: String, required: [true, "Please provide the email of the logged-in user"] },
    loginUserName: { type: String, required: [true, "Please provide the name of the logged-in user"] },
    products: {
      type: [ProductSchema],
      required: true,
      validate: [v => Array.isArray(v) && v.length > 0, 'Please add at least one product']
    },
    totalQty: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    vat: { type: Number, default: 0 },
    sd: { type: Number, default: 0 },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      required: true,
    },
    counter: { type: String, required: [true, "Please provide a counter"] },
    branch: { type: String, required: [true, "Please provide a branch"] },
    totalSale: { type: Number, required: true, default: 0 },
    orderStatus: {
      type: String,
      enum: ["pending", "completed", "cancelled", "cooking", "served"],
      default: "pending",
    },
    tableName: {
      type: String,
      required: [
        function () { return this.orderType === "dine-in"; },
        "Table name is required for dine-in orders.",
      ],
    },
    deliveryProvider: {
        type: String,
        enum: ['Pathao', 'Foodi', 'Foodpanda', 'DeliveryBoy'],
        required: [
            function() { return this.orderType === 'delivery'; },
            'Delivery provider is required for delivery orders.'
        ]
    },
    customerName: { type: String },
    customerMobile: { type: String },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Visa Card', 'Master Card', 'Amex Card', 'Bkash', 'Nagad', 'Rocket', 'Bank'],
      default: 'Cash'
    },
    // New fields for customer linking and points
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Purchaser",
      required: false,
    },
    earnedPoints: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

InvoiceSchema.pre('save', async function(next) {
    if (!this.isModified('totalAmount')) { // Prevent recalculation on every save
        const nonComplimentaryProducts = this.products.filter(p => !p.isComplimentary);
        const subtotal = nonComplimentaryProducts.reduce((acc, p) => acc + (p.subtotal || 0), 0);
        const totalVat = nonComplimentaryProducts.reduce((acc, p) => acc + (p.vat || 0), 0);
        const totalSd = nonComplimentaryProducts.reduce((acc, p) => acc + (p.sd || 0), 0);
        this.totalQty = this.products.reduce((acc, p) => acc + (p.qty || 0), 0);
        this.vat = totalVat;
        this.sd = totalSd;
        this.totalSale = subtotal + this.vat + this.sd;
        const discountAmount = this.discount || 0;
        this.totalAmount = this.totalSale - discountAmount;
    }

    if (this.isNew && this.customerId) {
        const CustomerModel = mongoose.model("Purchaser"); 
        const customer = await CustomerModel.findById(this.customerId);

        if (customer) {
            const pointsToAdd = Math.floor(this.totalAmount / 100);
            this.earnedPoints = pointsToAdd;

            customer.totalAmountSpent += this.totalAmount;
            customer.currentPoints += pointsToAdd;
            customer.numberOfOrders += 1;
            customer.invoices.push(this._id);

            await customer.save();
        }
    }
    
    next();
});

const Invoice = model("Invoice", InvoiceSchema);

export default Invoice;