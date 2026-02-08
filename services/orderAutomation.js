import axios from 'axios';
import mongoose from 'mongoose';

// Import your models
import Product from '../app/modules/Product/Product.model.js'; 
import Table from '../app/modules/Table/Tables.model.js';
import Customer from '../app/modules/Customer/Customers.model.js'; 

// Helper to generate serial (YearMonthDateHourMinuteSecond)
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

// Fixed configuration for this bot
const FIXED_CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1"
};

export const postAutomaticOrder = async () => {
  try {
    // 1. FETCH DATA FILTERED BY BRANCH: "demo"
    // ---------------------------------------------------------
    
    // Get 1 to 4 random "available" products ONLY from 'demo' branch
    const randomProducts = await Product.aggregate([
      { 
        $match: { 
            status: 'available', 
            branch: FIXED_CONFIG.branch 
        } 
      },
      { $sample: { size: Math.floor(Math.random() * 4) + 1 } }
    ]);

    if (!randomProducts.length) {
        throw new Error(`No available products found for branch: ${FIXED_CONFIG.branch}`);
    }

    // Get a random Table ONLY from 'demo' branch
    const randomTable = await Table.aggregate([
        { $match: { branch: FIXED_CONFIG.branch } },
        { $sample: { size: 1 } }
    ]);
    
    // Get a random Customer ONLY from 'demo' branch (50% chance)
    let randomCustomer = null;
    if (Math.random() > 0.5) {
        const customers = await Customer.aggregate([
            { $match: { branch: FIXED_CONFIG.branch } },
            { $sample: { size: 1 } }
        ]);
        randomCustomer = customers[0] || null;
    }

    // 2. CONSTRUCT PRODUCTS ARRAY & CALCULATE TOTALS
    // ---------------------------------------------------------
    let calculatedSubtotal = 0;
    let calculatedTotalVat = 0;
    let calculatedTotalSd = 0;
    let totalQty = 0;

    const invoiceProducts = randomProducts.map(prod => {
      const qty = Math.floor(Math.random() * 2) + 1; // Random Qty 1-3
      
      const lineSubtotal = prod.price * qty;
      
      // Calculate tax amounts based on percentages in Product schema
      const unitVatAmount = (prod.price * (prod.vat || 0)) / 100;
      const unitSdAmount = (prod.price * (prod.sd || 0)) / 100;

      calculatedSubtotal += lineSubtotal;
      calculatedTotalVat += (unitVatAmount * qty);
      calculatedTotalSd += (unitSdAmount * qty);
      totalQty += qty;

      return {
        productId: prod._id,
        productName: prod.productName,
        qty: qty,
        rate: prod.price,
        subtotal: lineSubtotal,
        vat: unitVatAmount, 
        sd: unitSdAmount,
        cookStatus: 'PENDING',
        isComplimentary: false
      };
    });

    const finalTotal = calculatedSubtotal + calculatedTotalVat + calculatedTotalSd;

    // 3. DETERMINE ORDER TYPE
    // ---------------------------------------------------------
    let selectedOrderType = 'takeaway';
    let selectedTableName = undefined;

    if (randomTable.length > 0) {
        selectedOrderType = 'dine-in';
        selectedTableName = randomTable[0].tableName;
    }

    // 4. CONSTRUCT FINAL PAYLOAD
    // ---------------------------------------------------------
    const orderPayload = {
      invoiceSerial: generateInvoiceSerial(),
      dateTime: new Date(),
      
      // --- FIXED FIELDS ---
      branch: FIXED_CONFIG.branch,
      loginUserEmail: FIXED_CONFIG.loginUserEmail,
      loginUserName: FIXED_CONFIG.loginUserName,
      counter: FIXED_CONFIG.counter,
      // --------------------

      products: invoiceProducts,
      
      subtotal: calculatedSubtotal,
      vat: calculatedTotalVat,
      sd: calculatedTotalSd,
      totalQty: totalQty,
      discount: 0,
      totalSale: finalTotal,
      totalAmount: finalTotal, 
      
      orderStatus: "pending",
      orderType: selectedOrderType,
      tableName: selectedTableName,
      paymentMethod: "Cash",

      // Customer Linking
      customerId: randomCustomer ? randomCustomer._id : undefined,
      customerName: randomCustomer ? randomCustomer.name : "Guest",
      customerMobile: randomCustomer ? randomCustomer.mobile : "n/a",
      earnedPoints: randomCustomer ? Math.floor(finalTotal / 100) : 0,
    };

    // 5. POST TO API
    // ---------------------------------------------------------
    
    // ✅ FIX 1: Removed the extra quote " at the end of the URL
    const apiUrl = `http://localhost:${process.env.PORT || 8000}/api/invoice/post`; 
    
    console.log(`🤖 [${FIXED_CONFIG.branch}] Order: ${orderPayload.invoiceSerial} | ${selectedOrderType} | Total: ${finalTotal}`);
    
    const response = await axios.post(apiUrl, orderPayload);
    return response.data;

  } catch (error) {
    console.error("❌ Automation Error:", error.message);
    if(error.response) console.error("API Response Data:", error.response.data);
    
    // ✅ FIX 2: Re-throw the error so the calling script knows it failed 
    // and doesn't try to read 'id' from undefined
    throw error; 
  }
};