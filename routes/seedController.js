import moment from 'moment-timezone';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import your models
import Product from '../app/modules/Product/Product.model.js'; 
import Table from '../app/modules/Table/Tables.model.js';
import Customer from '../app/modules/Customer/Customers.model.js'; 
import Invoice from '../app/modules/Invoice/Invoices.model.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1",
    // Adjust path if needed
    calendarFilePath: path.join(__dirname, "../app/Json/365_day_ml_calendar_2025_only_event_days.json"),
};

// --- HELPER: Target Logic ---
const getTargetForDate = (dateMoment) => {
    const dateStr = dateMoment.format("YYYY-MM-DD");
    const dayOfWeek = dateMoment.day(); // 0=Sun, 6=Sat

    let baseTarget = Math.floor(Math.random() * (8000 - 6000 + 1)) + 6000;
    let isHighTrafficDay = false;
    let occasionName = null;

    if (dayOfWeek === 5 || dayOfWeek === 6) {
        baseTarget += 3000;
        isHighTrafficDay = true;
    }

    try {
        if (fs.existsSync(CONFIG.calendarFilePath)) {
            const fileData = fs.readFileSync(CONFIG.calendarFilePath, 'utf8');
            const jsonData = JSON.parse(fileData);
            const eventData = jsonData.calendar ? jsonData.calendar.find(d => d.date === dateStr) : null;

            if (eventData && (eventData.food_event || eventData.holiday_name)) {
                baseTarget += 4500;
                isHighTrafficDay = true;
                occasionName = eventData.food_event || eventData.holiday_name;
            }
        }
    } catch (err) { }

    return { target: baseTarget, isHighTrafficDay, occasionName };
};

// --- HELPER: Time Interval Logic ---
const calculateNextIntervalMinutes = (currentTotal, target, currentTimeMoment, isHighTraffic) => {
    const closeTime = moment(currentTimeMoment).set({ hour: 23, minute: 0, second: 0 });
    const minutesUntilClose = moment.duration(closeTime.diff(currentTimeMoment)).asMinutes();

    if (minutesUntilClose <= 0) return -1;
    const remainingAmount = target - currentTotal;
    if (remainingAmount <= 0) return -1;

    const estimatedOrdersNeeded = Math.ceil(remainingAmount / 500);
    let gapMinutes = minutesUntilClose / (estimatedOrdersNeeded || 1);
    
    const variance = (Math.random() * 0.6) + 0.7;
    gapMinutes = gapMinutes * variance;

    if (isHighTraffic) gapMinutes = gapMinutes * 0.7;

    if (gapMinutes < 3) gapMinutes = 3;
    if (gapMinutes > 50) gapMinutes = 50;

    return Math.floor(gapMinutes);
};

// --- HELPER: Order Generator ---
const generateOrderForTime = async (dateMoment, occasionName) => {
    const maxItems = 4;
    
    // 1. Fetch Random Products
    const randomProducts = await Product.aggregate([
        { $match: { status: 'available', branch: CONFIG.branch } },
        { $sample: { size: Math.floor(Math.random() * maxItems) + 1 } }
    ]);

    if (!randomProducts.length) return null;

    // 2. Fetch Random Table & Customer
    // We check if tables exist to determine if it's Dine-in or Takeaway
    const randomTable = await Table.aggregate([{ $match: { branch: CONFIG.branch } }, { $sample: { size: 1 } }]);
    const randomCustomer = Math.random() > 0.3 ? (await Customer.aggregate([{ $match: { branch: CONFIG.branch } }, { $sample: { size: 1 } }]))[0] : null;

    // 3. Calculate Products Subtotal
    let calculatedSubtotal = 0;
    const invoiceProducts = randomProducts.map(prod => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const lineTotal = prod.price * qty;
        calculatedSubtotal += lineTotal;
        return {
            productId: prod._id, 
            productName: prod.productName,
            qty, 
            rate: prod.price, 
            subtotal: lineTotal,
            vat: 0, 
            sd: 0, 
            cookStatus: 'SERVED' // Changed from PENDING to SERVED since it's history
        };
    });

    // 4. Construct Invoice Object
    return {
        invoiceSerial: dateMoment.format("YYMMDDHHmmss"),
        dateTime: dateMoment.toDate(),
        branch: CONFIG.branch,
        loginUserEmail: CONFIG.loginUserEmail,
        loginUserName: CONFIG.loginUserName,
        counter: CONFIG.counter,
        products: invoiceProducts,
        
        // Totals (Your pre-save hook will recalculate these, but good to provide base)
        subtotal: calculatedSubtotal,
        totalSale: calculatedSubtotal,
        totalAmount: calculatedSubtotal,
        
        // FIX 1: Use 'completed' instead of 'paid'
        orderStatus: "completed", 
        
        // FIX 2: Explicitly provide orderType
        orderType: randomTable.length > 0 ? 'dine-in' : 'takeaway',
        
        // FIX 3: Provide tableName only if dine-in
        tableName: randomTable.length > 0 ? randomTable[0].tableName : undefined,
        
        paymentMethod: "Cash",
        customerId: randomCustomer ? randomCustomer._id : undefined,
        customerName: randomCustomer ? randomCustomer.name : "Guest",
        remarks: occasionName ? `Auto [${occasionName}]` : "Auto-Backfill Jan2026",
    };
};

// --- MAIN CONTROLLER FUNCTION ---
export const runJanuarySeeder = async (req, res) => {
    try {
        console.log("🚀 Starting January Seeding Process...");

        // Prevent duplicates
        const existingData = await Invoice.findOne({ 
            dateTime: { 
                $gte: new Date("2026-01-01"), 
                $lte: new Date("2026-01-31") 
            },
            remarks: { $regex: "Auto" }
        });

        if (existingData && !req.query.force) {
            return res.status(400).json({ 
                message: "Data for Jan 2026 exists! Use ?force=true to overwrite." 
            });
        }

        const startDate = moment("2026-01-01").tz("Asia/Dhaka").startOf('day');
        const endDate = moment("2026-01-31").tz("Asia/Dhaka").endOf('day');
        let currentDate = startDate.clone();
        let count = 0;

        // Loop through Days
        while (currentDate.isBefore(endDate)) {
            const { target, isHighTrafficDay, occasionName } = getTargetForDate(currentDate);
            let dailyTotal = 0;
            
            let simulationClock = currentDate.clone().set({ hour: 11, minute: 0, second: 0 });
            const closeTime = currentDate.clone().set({ hour: 23, minute: 0, second: 0 });

            console.log(`Processing ${currentDate.format("DD-MMM")}...`);

            // Loop through Time
            while (dailyTotal < target && simulationClock.isBefore(closeTime)) {
                const orderData = await generateOrderForTime(simulationClock, occasionName);
                
                if (orderData) {
                    await Invoice.create(orderData);
                    dailyTotal += orderData.totalAmount;
                    count++;
                }

                const minutesToJump = calculateNextIntervalMinutes(dailyTotal, target, simulationClock, isHighTrafficDay);
                if (minutesToJump === -1) break;

                simulationClock.add(minutesToJump, 'minutes');
            }
            currentDate.add(1, 'day');
        }

        console.log(`✅ Seeding Complete. ${count} orders created.`);
        return res.status(200).json({ success: true, message: `Created ${count} orders for January 2026` });

    } catch (error) {
        console.error("❌ Seeding Error:", error);
        return res.status(500).json({ error: error.message });
    }
};