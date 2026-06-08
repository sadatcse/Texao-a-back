import mongoose from 'mongoose';
import dotenv from 'dotenv';
import moment from 'moment';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://sadatcse:WBe8UTZXFpEgajkp@bill.5f5rm.mongodb.net/Teaxo?retryWrites=true&w=majority&appName=Bill";

const InvoiceSchema = new mongoose.Schema({
  branch: String,
  dateTime: Date,
  totalAmount: Number,
  paymentMethod: String,
  orderType: String,
  products: Array
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB!");

    const branch = "teaxo"; // Change to "chef" or "demo" to check other branches
    const invoices = await Invoice.find({ branch });
    console.log(`Found ${invoices.length} invoices for branch ${branch}`);

    if (invoices.length === 0) return;

    // Last 6 months calculation
    const last6MonthsSales = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = moment().subtract(i, 'months').startOf('month');
      const monthEnd = moment().subtract(i, 'months').endOf('month');
      const monthName = monthStart.format('MMM YYYY');
      
      let totalSale = 0;
      let orderCount = 0;
      
      invoices.forEach(invoice => {
        const invoiceDate = moment(invoice.dateTime);
        if (invoiceDate.isBetween(monthStart, monthEnd, null, '[]')) {
          totalSale += invoice.totalAmount;
          orderCount += 1;
        }
      });
      
      last6MonthsSales.push({
        month: monthName,
        totalSale,
        orderCount
      });
    }

    console.log("Last 6 Months Sales:", last6MonthsSales);

    // This month's custom statistics
    const thisMonthStart = moment().startOf('month');
    const thisMonthEnd = moment().endOf('month');
    
    let cashSale = 0, cashCount = 0;
    let cardSale = 0, cardCount = 0;
    let mobileSale = 0, mobileCount = 0;
    let bankSale = 0, bankCount = 0;

    let dineInSale = 0, dineInCount = 0;
    let takeawaySale = 0, takeawayCount = 0;
    let deliverySale = 0, deliveryCount = 0;

    const productSalesMap = {};

    invoices.forEach(invoice => {
      const invoiceDate = moment(invoice.dateTime);
      if (invoiceDate.isBetween(thisMonthStart, thisMonthEnd, null, '[]')) {
        // Payment methods
        const method = invoice.paymentMethod;
        if (method === 'Cash') {
          cashSale += invoice.totalAmount;
          cashCount++;
        } else if (method === 'Bank') {
          bankSale += invoice.totalAmount;
          bankCount++;
        } else if (['Card', 'Visa Card', 'Master Card', 'Amex Card'].includes(method)) {
          cardSale += invoice.totalAmount;
          cardCount++;
        } else if (['Mobile', 'Bkash', 'Nagad', 'Rocket'].includes(method)) {
          mobileSale += invoice.totalAmount;
          mobileCount++;
        }

        // Order types
        const type = invoice.orderType;
        if (type === 'dine-in') {
          dineInSale += invoice.totalAmount;
          dineInCount++;
        } else if (type === 'takeaway') {
          takeawaySale += invoice.totalAmount;
          takeawayCount++;
        } else if (type === 'delivery') {
          deliverySale += invoice.totalAmount;
          deliveryCount++;
        }

        // Products
        invoice.products.forEach(p => {
          if (!productSalesMap[p.productName]) {
            productSalesMap[p.productName] = { name: p.productName, qty: 0, sale: 0 };
          }
          productSalesMap[p.productName].qty += p.qty;
          productSalesMap[p.productName].sale += p.subtotal;
        });
      }
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    console.log("This month stats:");
    console.log("- cashSale:", cashSale);
    console.log("- cardSale:", cardSale);
    console.log("- dineInSale:", dineInSale);
    console.log("- topProducts length:", topProducts.length);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
