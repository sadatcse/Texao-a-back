import cron from "node-cron";
import moment from "moment-timezone";
import { postAutomaticOrder } from './orderAutomation.js';

let timerId = null; // Store timeout ID to clear if needed

const calculateNextInterval = (currentTotal, target, weatherFactor, isHighTraffic) => {
    const dhakaTime = moment().tz("Asia/Dhaka");
    
    // 1. Operating Hours Check (Close at 11 PM)
    const closeTime = moment().tz("Asia/Dhaka").set({ hour: 23, minute: 0, second: 0 });
    const minutesUntilClose = moment.duration(closeTime.diff(dhakaTime)).asMinutes();

    if (minutesUntilClose <= 0) return -1; // Shop is closed

    // 2. Remaining Money to Earn
    const remainingAmount = target - currentTotal;
    if (remainingAmount <= 0) return -1; // Target met

    // 3. Estimate Average Order Size (e.g., 500 BDT)
    const avgOrderSize = 500; 
    const estimatedOrdersNeeded = Math.ceil(remainingAmount / avgOrderSize);

    // 4. Calculate Base Gap (Time Left / Orders Needed)
    let gapMinutes = minutesUntilClose / estimatedOrdersNeeded;

    // 5. Apply "Human" Variance (±30%) & Weather
    const variance = (Math.random() * 0.6) + 0.7; // 0.7 to 1.3
    gapMinutes = gapMinutes * variance;

    // If weather is bad, slow down (increase gap)
    if (weatherFactor < 0.8) gapMinutes = gapMinutes * 1.5;
    
    // If high traffic, speed up (decrease gap)
    if (isHighTraffic) gapMinutes = gapMinutes * 0.7;

    // 6. Hard Limits (Don't run faster than 3 mins, or slower than 50 mins)
    if (gapMinutes < 3) gapMinutes = 3;
    if (gapMinutes > 50) gapMinutes = 50;

    return Math.floor(gapMinutes * 60 * 1000); // Return milliseconds
};

const runBotLoop = async () => {
    console.log("\n--- 🤖 Auto-Poster Loop Check ---");
    const dhakaTime = moment().tz("Asia/Dhaka");
    const currentHour = dhakaTime.hour();

    // 1. Check Shop Hours (11 AM to 11 PM)
    if (currentHour < 11 || currentHour >= 23) {
        console.log("😴 Shop Closed. Sleeping until 11:00 AM.");
        return; // The Cron job will wake this up tomorrow morning
    }

    try {
        // 2. Attempt to Post Order
        const result = await postAutomaticOrder();

        if (result.status === "STOP") {
            console.log(`✅ ${result.message}. Bot resting for today.`);
            return;
        }

        // 3. Calculate Next Run Time
        const delayMs = calculateNextInterval(
            result.currentTotal, 
            result.target, 
            result.weatherFactor, 
            result.isHighTrafficDay
        );

        if (delayMs === -1) {
             console.log("🏁 Day finished or Target met. Stopping.");
             return;
        }

        const nextRunTime = moment().add(delayMs, 'ms');
        const minutes = Math.round(delayMs / 1000 / 60);

        console.log(`📊 Progress: ${result.currentTotal}/${result.target} BDT`);
        console.log(`⏳ Next Order in: ${minutes} mins (${nextRunTime.format("hh:mm:ss A")})`);

        // 4. RECURSIVE CALL: Schedule the next run
        timerId = setTimeout(runBotLoop, delayMs);

    } catch (err) {
        console.error("❌ Bot Error:", err.message);
        // Retry in 5 minutes if error
        setTimeout(runBotLoop, 5 * 60 * 1000);
    }
};

export const startAutoOrderPosting = () => {
    console.log("--- Automatic Order Posting System Initialized ---");

    // 1. The Trigger: Runs everyday at 11:00 AM to KICKSTART the loop
    cron.schedule("20 17 * * *", () => {
        console.log("🌅 Morning Trigger: Starting Daily Loop");
        runBotLoop();
    }, { timezone: "Asia/Dhaka" });

    // 2. Immediate Check (In case server restarts mid-day)
    // If it's currently between 11 AM and 11 PM, start immediately
    const currentHour = moment().tz("Asia/Dhaka").hour();
    if (currentHour >= 11 && currentHour < 23) {
        console.log("⚡ Server Restarted during op hours. Resuming Loop...");
        runBotLoop();
    }
};