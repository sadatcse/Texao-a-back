import axios from 'axios';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone'; // npm install moment-timezone

// Import your models
import Product from '../app/modules/Product/Product.model.js'; 
import Table from '../app/modules/Table/Tables.model.js';
import Customer from '../app/modules/Customer/Customers.model.js'; 

// --- CONFIGURATION ---
const FIXED_CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1",
    weatherApiKey: "e3fa7c29a5a49fa43b76bce84daffc2e", 
    calendarFilePath: path.resolve('./../app/Json/365_day_ml_calendar_2025_only_event_days.json')
};


// --- HELPERS ---

// 1. Generate Serial
const generateInvoiceSerial = () => {
    // We use Dhaka time for the serial to make it readable locally
    const now = moment().tz("Asia/Dhaka");
    return now.format("YYMMDDHHmmss");
};

// 2. Get Weather Factor (Returns 1.0 for good weather, 0.5 for bad)
const getWeatherFactor = async () => {
    try {
        if (!FIXED_CONFIG.weatherApiKey || FIXED_CONFIG.weatherApiKey === "YOUR_OPENWEATHER_API_KEY") {
            return 1.0; // Default to perfect weather if no API key
        }
        
        // Fetch Dhaka Weather
        const url = `https://api.openweathermap.org/data/2.5/weather?q=Dhaka,BD&appid=${FIXED_CONFIG.weatherApiKey}`;
        const { data } = await axios.get(url);
        
        const condition = data.weather[0].main.toLowerCase(); // rain, clear, clouds, etc.
        
        // Logic: If raining or thunderstorm, reduce sales probability
        if (condition.includes('rain') || condition.includes('storm')) {
            console.log(`🌧️ Weather is ${condition}. Reducing sales intensity.`);
            return 0.4; // 40% intensity
        } else if (condition.includes('clear') || condition.includes('sun')) {
            return 1.2; // Sunny days might boost sales slightly
        }
        return 1.0; // Cloudy/Normal
    } catch (error) {
        console.warn("⚠️ Could not fetch weather, assuming normal conditions.");
        return 1.0;
    }
};

// 3. Get Day Target & Characteristics
const getDailyTargetInfo = () => {
    const dhakaTime = moment().tz("Asia/Dhaka");
    const todayDateStr = dhakaTime.format("YYYY-MM-DD");
    const dayOfWeek = dhakaTime.day(); // 5 = Friday, 6 = Saturday

    let baseTarget = Math.floor(Math.random() * (8000 - 6000 + 1)) + 6000; // 6k-8k
    let isHighTrafficDay = false;
    let occasionName = null;

    // A. Check Weekend (Friday/Saturday)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        const bonus = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
        baseTarget += bonus;
        isHighTrafficDay = true;
        console.log(`📅 Weekend Bonus Applied (+${bonus})`);
    }

    // B. Check Calendar JSON for Occasions
    try {
        if (fs.existsSync(FIXED_CONFIG.calendarFilePath)) {
            const fileData = fs.readFileSync(FIXED_CONFIG.calendarFilePath);
            const jsonData = JSON.parse(fileData);
            
            // Find today in the calendar array
            const todayData = jsonData.calendar.find(d => d.date === todayDateStr);

            if (todayData) {
                // Check for Occasions
                if (todayData.food_event || todayData.holiday_name) {
                    const occasionBonus = Math.floor(Math.random() * (5000 - 4000 + 1)) + 4000;
                    baseTarget += occasionBonus;
                    isHighTrafficDay = true;
                    occasionName = todayData.food_event || todayData.holiday_name;
                    console.log(`🎉 Occasion Found: ${occasionName} (+${occasionBonus})`);
                }
            }
        }
    } catch (err) {
        console.error("⚠️ Error reading calendar JSON:", err.message);
    }

    return { target: baseTarget, isHighTrafficDay, occasionName };
};


// --- MAIN AUTOMATION FUNCTION ---

export const postAutomaticOrder = async () => {
    try {
        // ---------------------------------------------------------
        // 0. PRE-FLIGHT CHECKS (Time & Weather)
        // ---------------------------------------------------------
        
        const dhakaTime = moment().tz("Asia/Dhaka");
        const currentHour = dhakaTime.hour();

        // STRICT TIME WINDOW: 11 AM (11) to 11 PM (23)
        if (currentHour < 11 || currentHour >= 23) {
            console.log(`⏳ Shop Closed. Current Dhaka Time: ${dhakaTime.format('HH:mm')}. Operating hours: 11am-11pm.`);
            return { message: "Shop Closed", status: "skipped" };
        }

        const { target, isHighTrafficDay, occasionName } = getDailyTargetInfo();
        const weatherFactor = await getWeatherFactor();

        // "Intensity" determines how big this specific order should be to help hit the target
        // If target is high (13,000) vs low (6,000), we increase item count per order.
        let maxItems = 4;
        let maxQty = 2;

        if (target > 10000) { maxItems = 6; maxQty = 4; } // Big orders for big days
        
        // Random "Skip" Logic: 
        // If weather is bad (factor 0.4), we have a 60% chance to SKIP this execution completely to simulate slow traffic.
        if (Math.random() > weatherFactor) {
             console.log("🌧️ Skipping order generation due to bad weather.");
             return { message: "Skipped due to weather", status: "skipped" };
        }

        console.log(`🎯 Today's Target: ${target} BDT | Occasion: ${occasionName || 'None'} | Weather Factor: ${weatherFactor}`);

        // ---------------------------------------------------------
        // 1. FETCH DATA
        // ---------------------------------------------------------

        // Get random "available" products
        const randomProducts = await Product.aggregate([
            { 
                $match: { 
                    status: 'available', 
                    branch: FIXED_CONFIG.branch 
                } 
            },
            { $sample: { size: Math.floor(Math.random() * maxItems) + 1 } }
        ]);

        if (!randomProducts.length) {
            throw new Error(`No available products found for branch: ${FIXED_CONFIG.branch}`);
        }

        // Get Table
        const randomTable = await Table.aggregate([
            { $match: { branch: FIXED_CONFIG.branch } },
            { $sample: { size: 1 } }
        ]);
        
        // Get Customer (Higher chance of customer data on Occasions/Holidays)
        let randomCustomer = null;
        const customerChance = isHighTrafficDay ? 0.8 : 0.5; 
        
        if (Math.random() < customerChance) {
            const customers = await Customer.aggregate([
                { $match: { branch: FIXED_CONFIG.branch } },
                { $sample: { size: 1 } }
            ]);
            randomCustomer = customers[0] || null;
        }

        // ---------------------------------------------------------
        // 2. CONSTRUCT PRODUCTS & CALC
        // ---------------------------------------------------------
        let calculatedSubtotal = 0;
        let calculatedTotalVat = 0;
        let calculatedTotalSd = 0;
        let totalQty = 0;

        const invoiceProducts = randomProducts.map(prod => {
            // Logic: If occasionName matches category (e.g., "spicy"), maybe boost qty? (Simplified here)
            const qty = Math.floor(Math.random() * maxQty) + 1;
            
            const lineSubtotal = prod.price * qty;
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

        // ---------------------------------------------------------
        // 3. ORDER TYPE & TIME
        // ---------------------------------------------------------
        let selectedOrderType = 'takeaway';
        let selectedTableName = undefined;

        if (randomTable.length > 0) {
            selectedOrderType = 'dine-in';
            selectedTableName = randomTable[0].tableName;
        }

        // Ensure the saved Date Time is UTC, but accurate to the current moment
        const orderDateTime = new Date(); 

        // ---------------------------------------------------------
        // 4. PAYLOAD
        // ---------------------------------------------------------
        const orderPayload = {
            invoiceSerial: generateInvoiceSerial(),
            dateTime: orderDateTime,
            branch: FIXED_CONFIG.branch,
            loginUserEmail: FIXED_CONFIG.loginUserEmail,
            loginUserName: FIXED_CONFIG.loginUserName,
            counter: FIXED_CONFIG.counter,
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
            customerId: randomCustomer ? randomCustomer._id : undefined,
            customerName: randomCustomer ? randomCustomer.name : "Guest",
            customerMobile: randomCustomer ? randomCustomer.mobile : "n/a",
            earnedPoints: randomCustomer ? Math.floor(finalTotal / 100) : 0,
            
            // Helpful metadata for your analysis later
            remarks: occasionName ? `Auto-Gen: ${occasionName}` : "Auto-Gen",
        };

        // ---------------------------------------------------------
        // 5. EXECUTION
        // ---------------------------------------------------------
        const apiUrl = `http://localhost:${process.env.PORT || 8000}/api/invoice/post`; 
        console.log(`🤖 [${FIXED_CONFIG.branch}] Order: ${orderPayload.invoiceSerial} | Total: ${finalTotal} | TargetDay: ${isHighTrafficDay}`);
        
        const response = await axios.post(apiUrl, orderPayload);
        return response.data;

    } catch (error) {
        console.error("❌ Automation Error:", error.message);
        throw error; 
    }
};