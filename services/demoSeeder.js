import mongoose from 'mongoose';
import moment from 'moment-timezone';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import Company from '../app/modules/Company/Companys.model.js';
import Category from '../app/modules/Catagorie/Catagories.model.js';
import Product from '../app/modules/Product/Product.model.js';
import Table from '../app/modules/Table/Tables.model.js';
import Counter from '../app/modules/Counter/Counters.model.js';
import Customer from '../app/modules/Customer/Customers.model.js';
import User from '../app/modules/User/Users.model.js';
import Invoice from '../app/modules/Invoice/Invoices.model.js';
import IngredientCategory from '../app/modules/IngredientCategory/IngredientCategory.model.js';
import Ingredient from '../app/modules/Ingredient/Ingredient.model.js';
import Recipe from '../app/modules/Recipe/Recipe.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXED_CONFIG = {
    branch: "demo",
    loginUserEmail: "demo@sadatkhan.com",
    loginUserName: "Demo Power",
    counter: "Counter 1",
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
        if (fs.existsSync(FIXED_CONFIG.calendarFilePath)) {
            const fileData = fs.readFileSync(FIXED_CONFIG.calendarFilePath, 'utf8');
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
    
    const randomProducts = await Product.aggregate([
        { $match: { status: 'available', branch: FIXED_CONFIG.branch } },
        { $sample: { size: Math.floor(Math.random() * maxItems) + 1 } }
    ]);

    if (!randomProducts.length) return null;

    const randomTable = await Table.aggregate([{ $match: { branch: FIXED_CONFIG.branch } }, { $sample: { size: 1 } }]);
    const randomCustomer = Math.random() > 0.3 ? (await Customer.aggregate([{ $match: { branch: FIXED_CONFIG.branch } }, { $sample: { size: 1 } }]))[0] : null;

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
            cookStatus: 'SERVED'
        };
    });

    return {
        invoiceSerial: dateMoment.format("YYMMDDHHmmss"),
        dateTime: dateMoment.toDate(),
        branch: FIXED_CONFIG.branch,
        loginUserEmail: FIXED_CONFIG.loginUserEmail,
        loginUserName: FIXED_CONFIG.loginUserName,
        counter: FIXED_CONFIG.counter,
        products: invoiceProducts,
        subtotal: calculatedSubtotal,
        totalSale: calculatedSubtotal,
        totalAmount: calculatedSubtotal,
        orderStatus: "completed", 
        orderType: randomTable.length > 0 ? 'dine-in' : 'takeaway',
        tableName: randomTable.length > 0 ? randomTable[0].tableName : undefined,
        paymentMethod: "Cash",
        customerId: randomCustomer ? randomCustomer._id : undefined,
        customerName: randomCustomer ? randomCustomer.name : "Guest",
        remarks: occasionName ? `Auto [${occasionName}]` : "Auto-Gen",
    };
};

export const ensureDemoBranchData = async () => {
    console.log("Checking and seeding base 'demo' branch details...");

    // 1. Company
    let demoCompany = await Company.findOne({ branch: FIXED_CONFIG.branch });
    if (!demoCompany) {
        demoCompany = await Company.create({
            name: "Chef's Special Demo Restaurant",
            phone: "+8801700000000",
            email: FIXED_CONFIG.loginUserEmail,
            ownerEmail: "owner@sadatkhan.com",
            address: "Gulshan-2, Dhaka, Bangladesh",
            branch: FIXED_CONFIG.branch
        });
        console.log("Created demo Company");
    }

    // 2. Categories
    const categoriesToSeed = ["Burgers", "Pizza", "Pasta", "Drinks", "Desserts"];
    for (let i = 0; i < categoriesToSeed.length; i++) {
        const catName = categoriesToSeed[i];
        const existingCat = await Category.findOne({ categoryName: catName, branch: FIXED_CONFIG.branch });
        if (!existingCat) {
            await Category.create({
                categoryName: catName,
                serial: i + 1,
                branch: FIXED_CONFIG.branch,
                isActive: true
            });
        }
    }

    // 3. Products
    const productsToSeed = [
        { productName: "Cheesy Beef Burger", category: "Burgers", price: 290 },
        { productName: "Double Chicken Burger", category: "Burgers", price: 340 },
        { productName: "Pepperoni Pizza (M)", category: "Pizza", price: 650 },
        { productName: "Margherita Pizza (M)", category: "Pizza", price: 550 },
        { productName: "Fettuccine Carbonara", category: "Pasta", price: 420 },
        { productName: "Spaghetti Bolognese", category: "Pasta", price: 380 },
        { productName: "Coca-Cola Can", category: "Drinks", price: 50 },
        { productName: "Fresh Lime Soda", category: "Drinks", price: 90 },
        { productName: "Chocolate Lava Cake", category: "Desserts", price: 180 },
        { productName: "Vanilla Ice Cream", category: "Desserts", price: 120 }
    ];
    for (const prod of productsToSeed) {
        const existingProd = await Product.findOne({ productName: prod.productName, branch: FIXED_CONFIG.branch });
        if (!existingProd) {
            await Product.create({
                ...prod,
                branch: FIXED_CONFIG.branch,
                status: "available"
            });
        }
    }

    // 4. Tables
    const tablesToSeed = ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"];
    for (const tableName of tablesToSeed) {
        const existingTable = await Table.findOne({ tableName, branch: FIXED_CONFIG.branch });
        if (!existingTable) {
            await Table.create({
                tableName,
                branch: FIXED_CONFIG.branch
            });
        }
    }

    // 5. Counter
    const existingCounter = await Counter.findOne({ counterName: FIXED_CONFIG.counter, branch: FIXED_CONFIG.branch });
    if (!existingCounter) {
        // Find maximum counterSerial to keep unique key
        const maxCounter = await Counter.findOne().sort({ counterSerial: -1 });
        const nextSerial = maxCounter ? maxCounter.counterSerial + 1 : 1;
        await Counter.create({
            counterName: FIXED_CONFIG.counter,
            counterSerial: nextSerial,
            branch: FIXED_CONFIG.branch
        });
    }

    // 6. Customers
    const customersToSeed = [
        { name: "Sajid Khan", mobile: "01711122233", email: "sajid@demo.com" },
        { name: "Anika Rahman", mobile: "01822233344", email: "anika@demo.com" },
        { name: "Tanvir Ahmed", mobile: "01933344455", email: "tanvir@demo.com" }
    ];
    for (const cust of customersToSeed) {
        const existingCust = await Customer.findOne({ mobile: cust.mobile, branch: FIXED_CONFIG.branch });
        if (!existingCust) {
            await Customer.create({
                ...cust,
                branch: FIXED_CONFIG.branch
            });
        }
    }

    // 7. User (Demo login account)
    const existingUser = await User.findOne({ email: FIXED_CONFIG.loginUserEmail });
    if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123456789", salt);
        await User.create({
            name: FIXED_CONFIG.loginUserName,
            email: FIXED_CONFIG.loginUserEmail,
            password: hashedPassword,
            role: "admin",
            branch: FIXED_CONFIG.branch,
            status: "active"
        });
        console.log("Created demo login user account");
    }

    // Invoke Ingredients & Recipes Seeding
    await seedIngredientsAndRecipes();
};

export const seedIngredientsAndRecipes = async () => {
    try {
        console.log("Seeding ingredients and recipe data for 'demo' branch...");

        // 1. Seed Ingredient Categories
        const categories = [
            { categoryName: "Meats", branch: FIXED_CONFIG.branch },
            { categoryName: "Dairy", branch: FIXED_CONFIG.branch },
            { categoryName: "Grains", branch: FIXED_CONFIG.branch },
            { categoryName: "Vegetables", branch: FIXED_CONFIG.branch },
            { categoryName: "Beverages & Liquids", branch: FIXED_CONFIG.branch },
            { categoryName: "Pantry & Baking", branch: FIXED_CONFIG.branch }
        ];

        const catMap = {};
        for (const cat of categories) {
            let dbCat = await IngredientCategory.findOne({ categoryName: cat.categoryName, branch: FIXED_CONFIG.branch });
            if (!dbCat) {
                dbCat = await IngredientCategory.create(cat);
            }
            catMap[cat.categoryName] = dbCat._id;
        }

        // 2. Seed Ingredients
        const ingredients = [
            { name: "Beef Patty", categoryName: "Meats", unit: "pcs", sku: "DEMO_ING_BEEF_PATTY", stockAlert: 50 },
            { name: "Chicken Patty", categoryName: "Meats", unit: "pcs", sku: "DEMO_ING_CHICKEN_PATTY", stockAlert: 50 },
            { name: "Chicken Strips", categoryName: "Meats", unit: "g", sku: "DEMO_ING_CHICKEN_STRIPS", stockAlert: 1000 },
            { name: "Beef Mince", categoryName: "Meats", unit: "g", sku: "DEMO_ING_BEEF_MINCE", stockAlert: 1000 },
            { name: "Pepperoni Slices", categoryName: "Meats", unit: "pcs", sku: "DEMO_ING_PEPPERONI", stockAlert: 200 },
            
            { name: "Cheese Slices", categoryName: "Dairy", unit: "pcs", sku: "DEMO_ING_CHEESE_SLICES", stockAlert: 100 },
            { name: "Mozzarella Cheese", categoryName: "Dairy", unit: "g", sku: "DEMO_ING_MOZZARELLA", stockAlert: 2000 },
            { name: "Cooking Cream", categoryName: "Dairy", unit: "ml", sku: "DEMO_ING_CREAM", stockAlert: 1000 },
            { name: "Butter", categoryName: "Dairy", unit: "g", sku: "DEMO_ING_BUTTER", stockAlert: 500 },
            
            { name: "Burger Bun", categoryName: "Grains", unit: "pcs", sku: "DEMO_ING_BURGER_BUN", stockAlert: 100 },
            { name: "Pizza Dough", categoryName: "Grains", unit: "pcs", sku: "DEMO_ING_PIZZA_DOUGH", stockAlert: 50 },
            { name: "Pasta Noodles", categoryName: "Grains", unit: "g", sku: "DEMO_ING_PASTA_NOODLES", stockAlert: 2000 },
            
            { name: "Lettuce", categoryName: "Vegetables", unit: "g", sku: "DEMO_ING_LETTUCE", stockAlert: 500 },
            { name: "Tomato", categoryName: "Vegetables", unit: "g", sku: "DEMO_ING_TOMATO", stockAlert: 500 },
            { name: "Basil Leaves", categoryName: "Vegetables", unit: "g", sku: "DEMO_ING_BASIL", stockAlert: 100 },
            { name: "Mushroom", categoryName: "Vegetables", unit: "g", sku: "DEMO_ING_MUSHROOM", stockAlert: 500 },
            { name: "Lime", categoryName: "Vegetables", unit: "pcs", sku: "DEMO_ING_LIME", stockAlert: 20 },
            
            { name: "Coca-Cola Can Product", categoryName: "Beverages & Liquids", unit: "pcs", sku: "DEMO_ING_COCACOLA", stockAlert: 48 },
            { name: "Soda Water", categoryName: "Beverages & Liquids", unit: "ml", sku: "DEMO_ING_SODA", stockAlert: 5000 },
            { name: "Sugar Syrup", categoryName: "Beverages & Liquids", unit: "ml", sku: "DEMO_ING_SUGAR", stockAlert: 2000 },
            
            { name: "Pizza Sauce", categoryName: "Pantry & Baking", unit: "g", sku: "DEMO_ING_PIZZA_SAUCE", stockAlert: 1000 },
            { name: "Tomato Sauce", categoryName: "Pantry & Baking", unit: "g", sku: "DEMO_ING_TOMATO_SAUCE", stockAlert: 1000 },
            { name: "Flour", categoryName: "Pantry & Baking", unit: "g", sku: "DEMO_ING_FLOUR", stockAlert: 5000 },
            { name: "Chocolate", categoryName: "Pantry & Baking", unit: "g", sku: "DEMO_ING_CHOCOLATE", stockAlert: 1000 },
            { name: "Egg", categoryName: "Pantry & Baking", unit: "pcs", sku: "DEMO_ING_EGG", stockAlert: 30 },
            { name: "Vanilla Ice Cream Mix", categoryName: "Pantry & Baking", unit: "g", sku: "DEMO_ING_ICE_CREAM_MIX", stockAlert: 2000 }
        ];

        const ingMap = {};
        for (const ing of ingredients) {
            let dbIng = await Ingredient.findOne({ sku: ing.sku });
            if (!dbIng) {
                dbIng = await Ingredient.create({
                    name: ing.name,
                    category: catMap[ing.categoryName],
                    unit: ing.unit,
                    sku: ing.sku,
                    stockAlert: ing.stockAlert,
                    branch: FIXED_CONFIG.branch,
                    isActive: true
                });
            }
            ingMap[ing.name] = { id: dbIng._id, name: dbIng.name, unit: dbIng.unit };
        }

        // 3. Define Recipe Matrix
        const recipeMatrix = {
            "Cheesy Beef Burger": [
                { name: "Beef Patty", quantity: 1 },
                { name: "Cheese Slices", quantity: 1 },
                { name: "Burger Bun", quantity: 1 },
                { name: "Lettuce", quantity: 15 },
                { name: "Tomato", quantity: 10 }
            ],
            "Double Chicken Burger": [
                { name: "Chicken Patty", quantity: 2 },
                { name: "Burger Bun", quantity: 1 },
                { name: "Cheese Slices", quantity: 1 },
                { name: "Lettuce", quantity: 15 }
            ],
            "Pepperoni Pizza (M)": [
                { name: "Pizza Dough", quantity: 1 },
                { name: "Mozzarella Cheese", quantity: 200 },
                { name: "Pepperoni Slices", quantity: 12 },
                { name: "Pizza Sauce", quantity: 80 }
            ],
            "Margherita Pizza (M)": [
                { name: "Pizza Dough", quantity: 1 },
                { name: "Mozzarella Cheese", quantity: 150 },
                { name: "Basil Leaves", quantity: 5 },
                { name: "Pizza Sauce", quantity: 80 }
            ],
            "Fettuccine Carbonara": [
                { name: "Pasta Noodles", quantity: 150 },
                { name: "Cooking Cream", quantity: 100 },
                { name: "Chicken Strips", quantity: 50 },
                { name: "Mushroom", quantity: 30 }
            ],
            "Spaghetti Bolognese": [
                { name: "Pasta Noodles", quantity: 150 },
                { name: "Beef Mince", quantity: 100 },
                { name: "Tomato Sauce", quantity: 120 }
            ],
            "Coca-Cola Can": [
                { name: "Coca-Cola Can Product", quantity: 1 }
            ],
            "Fresh Lime Soda": [
                { name: "Lime", quantity: 1 },
                { name: "Soda Water", quantity: 250 },
                { name: "Sugar Syrup", quantity: 30 }
            ],
            "Chocolate Lava Cake": [
                { name: "Flour", quantity: 50 },
                { name: "Chocolate", quantity: 60 },
                { name: "Butter", quantity: 40 },
                { name: "Egg", quantity: 1 }
            ],
            "Vanilla Ice Cream": [
                { name: "Vanilla Ice Cream Mix", quantity: 100 }
            ]
        };

        // 4. Seeding Recipes
        const products = await Product.find({ branch: FIXED_CONFIG.branch });
        for (const prod of products) {
            const matrixItems = recipeMatrix[prod.productName];
            if (!matrixItems) continue;

            const existingRecipe = await Recipe.findOne({ productId: prod._id });
            if (!existingRecipe) {
                const recipeIngredients = matrixItems.map(item => {
                    const ingDetail = ingMap[item.name];
                    return {
                        ingredientId: ingDetail.id,
                        ingredientName: ingDetail.name,
                        quantity: item.quantity,
                        unit: ingDetail.unit
                    };
                });

                await Recipe.create({
                    productId: prod._id,
                    productName: prod.productName,
                    branch: FIXED_CONFIG.branch,
                    ingredients: recipeIngredients
                });
                console.log(`Seeded recipe for: ${prod.productName}`);
            }
        }

        console.log("Ingredients & Recipe Management successfully seeded!");
    } catch (err) {
        console.error("Error seeding ingredients/recipes:", err);
    }
};

export const seedCurrentMonthSales = async () => {
    try {
        await ensureDemoBranchData();

        const startOfSeeding = moment().tz("Asia/Dhaka").startOf('year'); // January 1st of current year
        const now = moment().tz("Asia/Dhaka");

        // Clear existing demo invoices to ensure a fresh, full backfill
        await Invoice.deleteMany({ branch: FIXED_CONFIG.branch });
        console.log("Cleared existing demo invoices.");

        console.log(`Seeding demo sales data from ${startOfSeeding.format("YYYY-MM-DD")} to today...`);

        let currentDate = startOfSeeding.clone();
        let totalOrders = 0;

        while (currentDate.isBefore(now, 'day') || currentDate.isSame(now, 'day')) {
            const { target, isHighTrafficDay, occasionName } = getTargetForDate(currentDate);
            let dailyTotal = 0;

            let simulationClock = currentDate.clone().set({ hour: 11, minute: 0, second: 0 });
            // For today, only seed up to the current hour so it aligns with reality
            const closeTime = currentDate.isSame(now, 'day') 
                ? now.clone()
                : currentDate.clone().set({ hour: 23, minute: 0, second: 0 });

            while (dailyTotal < target && simulationClock.isBefore(closeTime)) {
                const orderData = await generateOrderForTime(simulationClock, occasionName);
                if (orderData) {
                    await Invoice.create(orderData);
                    dailyTotal += orderData.totalAmount;
                    totalOrders++;
                }

                const minutesToJump = calculateNextIntervalMinutes(dailyTotal, target, simulationClock, isHighTrafficDay);
                if (minutesToJump === -1) break;

                simulationClock.add(minutesToJump, 'minutes');
            }

            currentDate.add(1, 'day');
        }

        console.log(`Successfully backfilled demo sales from January to today. Created ${totalOrders} orders.`);
    } catch (err) {
        console.error("Error seeding historical demo sales:", err);
    }
};
