// services/autoPoster.js
import { postAutomaticOrder } from './orderAutomation.js';

export const startAutoOrderPosting = () => {
    console.log("--- Automatic Order Posting Script Started ---");

    setInterval(async () => {
        try {
            const result = await postAutomaticOrder();
            console.log(`[${new Date().toLocaleTimeString()}] Order Posted Successfully:`, result.id || "Success");
        } catch (err) {
            console.error(`[${new Date().toLocaleTimeString()}] Auto-Post Failed:`, err.message);
        }
    }, 30000); // 30000ms = 30 seconds
};