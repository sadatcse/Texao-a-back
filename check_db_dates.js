import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://sadatcse:WBe8UTZXFpEgajkp@bill.5f5rm.mongodb.net/Teaxo?retryWrites=true&w=majority&appName=Bill";

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to database successfully!");

    const invoices = await mongoose.connection.db.collection('invoices').find({}).toArray();
    console.log(`Found total invoices: ${invoices.length}`);

    const branchStats = {};
    invoices.forEach(inv => {
      const branch = inv.branch || 'unknown';
      const d = inv.dateTime ? new Date(inv.dateTime).toISOString().slice(0, 7) : 'undefined';
      
      if (!branchStats[branch]) {
        branchStats[branch] = {};
      }
      branchStats[branch][d] = (branchStats[branch][d] || 0) + 1;
    });

    console.log("Invoices grouped by branch and month:");
    console.log(JSON.stringify(branchStats, null, 2));

  } catch (err) {
    console.error("Error connecting or querying:", err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
