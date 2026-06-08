import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { seedCurrentMonthSales } from './demoSeeder.js';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
    try {
        await connectDB();
        await seedCurrentMonthSales(true);
        console.log("Seeding process completed successfully.");
    } catch (error) {
        console.error("Error during seeding process:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
