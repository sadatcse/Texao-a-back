import Review from './Review.model.js';
import Customer from '../Customer/Customers.model.js';
import Invoice from '../Invoice/Invoices.model.js'; 
import Table from '../Table/Tables.model.js'; 

// Check customer existence by mobile number
export const checkCustomerByMobile = async (req, res) => {
    const { mobile } = req.params;
    try {
        const customer = await Customer.findOne({ mobile });
        if (customer) {
            res.status(200).json({ exists: true, customer });
        } else {
            res.status(200).json({ exists: false });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
};

// Prepare data for the dynamic review page
export const prepareReviewPage = async (req, res) => {
    const { tableName, branch } = req.params;
    try {
        const table = await Table.findOne({ tableName, branch });
        if (!table) {
            return res.status(404).json({ message: "Table not found." });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const latestInvoice = await Invoice.findOne({
            tableName: table.tableName,
            branch: branch,
            orderType: 'dine-in',
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        }).sort({ createdAt: -1 });

        if (!latestInvoice) {
            return res.status(404).json({ message: "No recent order found for this table today." });
        }

        const orderDetails = {
            totalAmount: latestInvoice.totalAmount,
            products: latestInvoice.products.map(p => ({ 
                productId: p.productId, 
                productName: p.productName 
            })),
        };

        res.status(200).json(orderDetails);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
};


// Submit a new review
export const submitReview = async (req, res) => {
    const { mobile, name, email, rating, comment, tableName, branch, bestFoodName } = req.body;

    try {
        // Step 1: Find the table to get its ID
        const table = await Table.findOne({ tableName, branch });
        if (!table) {
            return res.status(404).json({ message: "Table not found for the given name and branch." });
        }

        // Step 2: Find the latest 'dine-in' order for today at that table
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const latestInvoice = await Invoice.findOne({
            tableName: table.tableName,
            branch: branch,
            orderType: 'dine-in',
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        }).sort({ createdAt: -1 });

        if (!latestInvoice) {
            return res.status(404).json({ message: "No recent order found for this table today." });
        }

        // Step 3: Find or create the customer
        let customer = await Customer.findOne({ mobile });
        if (!customer) {
            customer = await Customer.create({
                name,
                mobile,
                email,
                branch
            });
        }

        // Step 4: Create and save the review
        const newReview = await Review.create({
            customerId: customer._id,
            invoiceId: latestInvoice._id,
            tableId: table._id,
            tableName: table.tableName,
            customerName: customer.name,
            customerMobile: customer.mobile,
            rating,
            comment,
            bestFoodName,
            branch
        });

        res.status(201).json({ message: "Review submitted successfully!", review: newReview });

    } catch (err) {
        res.status(500).send({ error: err.message });
    }
};

// Get all reviews, optionally filtered by branch query
export const getAllReviews = async (req, res) => {
    try {
        const { branch } = req.query;
        const filter = branch ? { branch } : {};
        const reviews = await Review.find(filter)
            .populate('customerId', 'name email')
            .populate('invoiceId', 'invoiceSerial totalAmount')
            .sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
};

// Get all reviews for a specific branch
export const getReviewsByBranch = async (req, res) => {
    const { branch } = req.params;
    try {
        const reviews = await Review.find({ branch })
            .populate('customerId', 'name email')
            .populate('invoiceId', 'invoiceSerial totalAmount')
            .sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
};

