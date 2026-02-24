import mongoose from 'mongoose';
import moment from 'moment-timezone';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- IMPORTS (Adjust paths if necessary) ---
// Assuming these are in the same relative structure you provided
import Product from '../app/modules/Product/Product.model.js'; 
import Table from '../app/modules/Table/Tables.model.js';
import Customer from '../app/modules/Customer/Customers.model.js'; 
import Invoice from '../app/modules/Invoice/Invoices.model.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1",
    // We will skip the real weather API for seeding and use a "Winter in Dhaka" simulation
    calendarFilePath: path.join(__dirname, "../app/Json/365_day_ml_calendar_2025_only_event_days.json"),
    mongoURI: "mongodb://localhost:27017/your_database_name" // <--- UPDATE THIS
};

// --- 1. CONNECT TO DB ---
const connectDB = async () => {
    try {
        await mongoose.connect(CONFIG.mongoURI);
        console.log("✅ MongoDB Connected for Seeding...");
    } catch (err) {
        console.error("❌ DB Connection Error:", err);
        process.exit(1);
    }
};

// --- 2. TARGET LOGIC (ADAPTED FOR SPECIFIC DATES) ---
const getTargetForDate = (dateMoment) => {
    const dateStr = dateMoment.format("YYYY-MM-DD");
    const dayOfWeek = dateMoment.day(); // 0=Sun, 6=Sat

    // Base Target Randomization (6000 - 8000)
    let baseTarget = Math.floor(Math.random() * (8000 - 6000 + 1)) + 6000;
    let isHighTrafficDay = false;
    let occasionName = null;

    // Weekend Bonus (Friday=5, Saturday=6 in Dhaka context usually high traffic)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        baseTarget += 3000;
        isHighTrafficDay = true;
    }

    // JSON Calendar Check
    try {
        if (fs.existsSync(CONFIG.calendarFilePath)) {
            const fileData = fs.readFileSync(CONFIG.calendarFilePath, 'utf8');
            const jsonData = JSON.parse(fileData);
            // Check if the JSON has data for 2026, otherwise this might return null (handled gracefully)
            const eventData = jsonData.calendar ? jsonData.calendar.find(d => d.date === dateStr) : null;

            if (eventData && (eventData.food_event || eventData.holiday_name)) {
                baseTarget += 4500;
                isHighTrafficDay = true;
                occasionName = eventData.food_event || eventData.holiday_name;
            }
        }
    } catch (err) {
        // Ignore file errors during seeding
    }

    return { target: baseTarget, isHighTrafficDay, occasionName };
};

// --- 3. INTERVAL CALCULATION (ADAPTED) ---
const calculateNextIntervalMinutes = (currentTotal, target, currentTimeMoment, isHighTraffic) => {
    // 1. Operating Hours Check (Close at 11 PM)
    const closeTime = moment(currentTimeMoment).set({ hour: 23, minute: 0, second: 0 });
    const minutesUntilClose = moment.duration(closeTime.diff(currentTimeMoment)).asMinutes();

    if (minutesUntilClose <= 0) return -1; // Shop closed

    // 2. Remaining Money
    const remainingAmount = target - currentTotal;
    if (remainingAmount <= 0) return -1; // Target met

    // 3. Estimate
    const avgOrderSize = 500; 
    const estimatedOrdersNeeded = Math.ceil(remainingAmount / avgOrderSize);

    // 4. Base Gap
    let gapMinutes = minutesUntilClose / (estimatedOrdersNeeded || 1); // Avoid divide by zero

    // 5. Variance
    const variance = (Math.random() * 0.6) + 0.7; 
    gapMinutes = gapMinutes * variance;

    // 6. Simulate Weather (January is usually good, occasional fog)
    // 10% chance of "Bad Weather" (Fog/Cold) slowing things down
    const isBadWeather = Math.random() < 0.1;
    if (isBadWeather) gapMinutes = gapMinutes * 1.5;

    // 7. Traffic adjustment
    if (isHighTraffic) gapMinutes = gapMinutes * 0.7;

    // 8. Hard Limits
    if (gapMinutes < 3) gapMinutes = 3;
    if (gapMinutes > 50) gapMinutes = 50;

    return Math.floor(gapMinutes);
};

// --- 4. ORDER GENERATOR ---
const generateOrderForTime = async (dateMoment, occasionName) => {
    // Fetch Products (Assuming DB is populated)
    // Optimization: In a real script, fetch these ONCE outside the loop to save DB calls, 
    // but here we keep it inside to match your logic's randomness.
    
    // Determine number of items
    const maxItems = 4;
    const randomProducts = await Product.aggregate([
        { $match: { status: 'available', branch: CONFIG.branch } },
        { $sample: { size: Math.floor(Math.random() * maxItems) + 1 } }
    ]);

    if (!randomProducts.length) return null;

    // Random Table/Customer
    const randomTable = await Table.aggregate([{ $match: { branch: CONFIG.branch } }, { $sample: { size: 1 } }]);
    const randomCustomer = Math.random() > 0.3 ? (await Customer.aggregate([{ $match: { branch: CONFIG.branch } }, { $sample: { size: 1 } }]))[0] : null;

    let calculatedSubtotal = 0;
    const invoiceProducts = randomProducts.map(prod => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const lineTotal = prod.price * qty;
        calculatedSubtotal += lineTotal;
        return {
            productId: prod._id, productName: prod.productName,
            qty, rate: prod.price, subtotal: lineTotal,
            vat: 0, sd: 0, cookStatus: 'PENDING'
        };
    });

    // Final Object
    return {
        invoiceSerial: dateMoment.format("YYMMDDHHmmss"), // Unique based on time
        dateTime: dateMoment.toDate(), // <--- THE IMPORTANT PART: HISTORICAL DATE
        branch: CONFIG.branch,
        loginUserEmail: CONFIG.loginUserEmail,
        loginUserName: CONFIG.loginUserName,
        counter: CONFIG.counter,
        products: invoiceProducts,
        subtotal: calculatedSubtotal,
        totalSale: calculatedSubtotal,
        totalAmount: calculatedSubtotal,
        orderStatus: "paid", // Assume past orders are paid
        orderType: randomTable.length ? 'dine-in' : 'takeaway',
        tableName: randomTable.length ? randomTable[0].tableName : undefined,
        paymentMethod: "Cash",
        customerId: randomCustomer ? randomCustomer._id : undefined,
        customerName: randomCustomer ? randomCustomer.name : "Guest",
        remarks: occasionName ? `Auto-Backfill [${occasionName}]` : "Auto-Backfill Jan2026",
    };
};

// --- 5. MAIN SIMULATION LOOP ---
const runJanuarySimulation = async () => {
    await connectDB();

    console.log("\n🚀 Starting January 2026 Simulation...\n");

    const startDate = moment("2026-01-01").tz("Asia/Dhaka").startOf('day');
    const endDate = moment("2026-01-31").tz("Asia/Dhaka").endOf('day');

    let currentDate = startDate.clone();
    let totalMonthSales = 0;
    let totalOrdersCreated = 0;

    // Loop through every day of the month
    while (currentDate.isBefore(endDate)) {
        
        // 1. Setup Day
        const { target, isHighTrafficDay, occasionName } = getTargetForDate(currentDate);
        let dailyTotal = 0;
        
        // Set "Clock" to 11:00 AM
        let simulationClock = currentDate.clone().set({ hour: 11, minute: 0, second: 0 });
        const closeTime = currentDate.clone().set({ hour: 23, minute: 0, second: 0 });

        console.log(`📅 Processing: ${currentDate.format("DD-MMM-YYYY")} | Target: ${target} BDT ${occasionName ? `(${occasionName})` : ''}`);

        // 2. Loop within the day (Time Travel)
        while (dailyTotal < target && simulationClock.isBefore(closeTime)) {
            
            // Generate Order
            const orderData = await generateOrderForTime(simulationClock, occasionName);
            
            if (orderData) {
                // SAVE TO DB
                await Invoice.create(orderData);
                
                dailyTotal += orderData.totalAmount;
                totalMonthSales += orderData.totalAmount;
                totalOrdersCreated++;
            }

            // Calculate next jump
            const minutesToJump = calculateNextIntervalMinutes(dailyTotal, target, simulationClock, isHighTrafficDay);
            
            if (minutesToJump === -1) break; // Stop if target met or closed

            // Move the clock forward
            simulationClock.add(minutesToJump, 'minutes');
        }

        console.log(`   ✅ Finished Day. Total: ${dailyTotal} BDT. Last Order: ${simulationClock.format("hh:mm A")}`);
        
        // Move to next day
        currentDate.add(1, 'day');
    }

    console.log("\n==========================================");
    console.log(`🎉 JANUARY 2026 COMPLETED`);
    console.log(`💰 Total Revenue: ${totalMonthSales} BDT`);
    console.log(`🧾 Total Orders:  ${totalOrdersCreated}`);
    console.log("==========================================");

    process.exit(0);
};

// Run it
runJanuarySimulation();