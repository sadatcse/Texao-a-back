import axios from 'axios';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Models
import Product from '../app/modules/Product/Product.model.js'; 
import Table from '../app/modules/Table/Tables.model.js';
import Customer from '../app/modules/Customer/Customers.model.js'; 
// ASSUMED: You need the Invoice model to check today's total sales
import Invoice from '../app/modules/Invoice/Invoices.model.js'; 

// --- CONFIGURATION ---
const FIXED_CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1",
    calendarFilePath: path.join(__dirname, "../app/Json/365_day_ml_calendar_2025_only_event_days.json"),
    weatherApiKey: "e3fa7c29a5a49fa43b76bce84daffc2e" 
};

// --- HELPER: Get Today's Total Sales ---
const getTodaySalesTotal = async () => {
    const startOfDay = moment().tz("Asia/Dhaka").startOf('day').toDate();
    const endOfDay = moment().tz("Asia/Dhaka").endOf('day').toDate();

    const result = await Invoice.aggregate([
        { 
            $match: { 
                branch: FIXED_CONFIG.branch,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            } 
        },
        { 
            $group: { 
                _id: null, 
                totalAmount: { $sum: "$totalAmount" } 
            } 
        }
    ]);

    return result.length > 0 ? result[0].totalAmount : 0;
};

// --- HELPER: Weather & Targets ---
const getWeatherFactor = async () => {
    try {
        if (!FIXED_CONFIG.weatherApiKey) return 1.0;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=Dhaka,BD&appid=${FIXED_CONFIG.weatherApiKey}`;
        const { data } = await axios.get(url);
        const condition = data.weather[0].main.toLowerCase();
        
        if (condition.includes('rain') || condition.includes('storm')) return 0.4;
        return 1.0;
    } catch (error) {
        return 1.0;
    }
};

export const getDailyTargetInfo = () => {
    const dhakaTime = moment().tz("Asia/Dhaka");
    const todayDateStr = dhakaTime.format("YYYY-MM-DD");
    const dayOfWeek = dhakaTime.day(); 

    // Base Target
    let baseTarget = Math.floor(Math.random() * (8000 - 6000 + 1)) + 6000;
    let isHighTrafficDay = false;
    let occasionName = null;

    // Weekend Bonus
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        baseTarget += 3000;
        isHighTrafficDay = true;
    }

    // JSON Calendar Bonus
    try {
        if (fs.existsSync(FIXED_CONFIG.calendarFilePath)) {
            const fileData = fs.readFileSync(FIXED_CONFIG.calendarFilePath, 'utf8');
            const jsonData = JSON.parse(fileData);
            const todayData = jsonData.calendar ? jsonData.calendar.find(d => d.date === todayDateStr) : null;

            if (todayData && (todayData.food_event || todayData.holiday_name)) {
                baseTarget += 4500;
                isHighTrafficDay = true;
                occasionName = todayData.food_event || todayData.holiday_name;
            }
        }
    } catch (err) {
        console.error("JSON Read Error:", err.message);
    }

    return { target: baseTarget, isHighTrafficDay, occasionName };
};

// --- CORE FUNCTION: Post Order ---
export const postAutomaticOrder = async () => {
    // 1. Calculate Status
    const currentTotalSales = await getTodaySalesTotal();
    const { target, isHighTrafficDay, occasionName } = getDailyTargetInfo();
    const weatherFactor = await getWeatherFactor();

    // 2. STOP Condition: Have we met the target?
    if (currentTotalSales >= target) {
        return { 
            status: "STOP", 
            message: `Target Met! (${currentTotalSales}/${target})`,
            currentTotal: currentTotalSales,
            target: target
        };
    }

    // 3. Generate Order Data
    let maxItems = target > 10000 ? 6 : 4;
    
    // Fetch Random Products
    const randomProducts = await Product.aggregate([
        { $match: { status: 'available', branch: FIXED_CONFIG.branch } },
        { $sample: { size: Math.floor(Math.random() * maxItems) + 1 } }
    ]);
    if (!randomProducts.length) throw new Error("No products found");

    // Fetch Table/Customer (Optional)
    const randomTable = await Table.aggregate([{ $match: { branch: FIXED_CONFIG.branch } }, { $sample: { size: 1 } }]);
    const randomCustomer = Math.random() > 0.3 ? (await Customer.aggregate([{ $match: { branch: FIXED_CONFIG.branch } }, { $sample: { size: 1 } }]))[0] : null;

    // Calculations
    let calculatedSubtotal = 0, calculatedTotalVat = 0, totalQty = 0;
    
    const invoiceProducts = randomProducts.map(prod => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const lineTotal = prod.price * qty;
        calculatedSubtotal += lineTotal;
        totalQty += qty;
        return {
            productId: prod._id, productName: prod.productName,
            qty, rate: prod.price, subtotal: lineTotal,
            vat: 0, sd: 0, cookStatus: 'PENDING' 
        };
    });

    const finalTotal = calculatedSubtotal; // Simplified for demo
    
    // Construct Payload
    const orderPayload = {
        invoiceSerial: moment().format("YYMMDDHHmmss"),
        dateTime: new Date(),
        branch: FIXED_CONFIG.branch,
        loginUserEmail: FIXED_CONFIG.loginUserEmail,
        loginUserName: FIXED_CONFIG.loginUserName,
        counter: FIXED_CONFIG.counter,
        products: invoiceProducts,
        subtotal: calculatedSubtotal,
        totalSale: finalTotal,
        totalAmount: finalTotal,
        orderStatus: "pending",
        orderType: randomTable.length ? 'dine-in' : 'takeaway',
        tableName: randomTable.length ? randomTable[0].tableName : undefined,
        paymentMethod: "Cash",
        customerId: randomCustomer ? randomCustomer._id : undefined,
        customerName: randomCustomer ? randomCustomer.name : "Guest",
        remarks: occasionName ? `Auto [${occasionName}]` : "Auto-Gen",
    };

    // 4. SAVE TO DB
    // const newInvoice = await Invoice.create(orderPayload); // UNCOMMENT FOR REAL DB
    console.log(`[Mock DB] Created Order: ${finalTotal} BDT`);

    return { 
        status: "SUCCESS", 
        orderAmount: finalTotal,
        currentTotal: currentTotalSales + finalTotal,
        target: target,
        weatherFactor,
        isHighTrafficDay
    };
};