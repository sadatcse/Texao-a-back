// services/autoPoster.js
import cron from "node-cron";
import { postAutomaticOrder } from './orderAutomation.js';

export const startAutoOrderPosting = () => {
    console.log("--- Automatic Order Posting Script Scheduled (BD Time) ---");

    // Runs once every day at 11:00 AM (Bangladesh Time)
    cron.schedule("20 15 * * *", async () => {
        try {
            const result = await postAutomaticOrder();
            console.log(`[${new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}] Order Posted Successfully:`, result.id || "Success");
        } catch (err) {
            console.error(`[${new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}] Auto-Post Failed:`, err.message);
        }
    }, {
        timezone: "Asia/Dhaka"
    });
};


//e3fa7c29a5a49fa43b76bce84daffc2e