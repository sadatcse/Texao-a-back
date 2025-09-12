import Review from './Review.model.js';
import Customer from '../Customer/Customers.model.js';
import Invoice from '../Invoice/Invoices.model.js';
import Table from '../Table/Tables.model.js';
import Company from './../Company/Companys.model.js';

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

// MODIFIED: Prepare review page using only tableId
export const prepareReviewPage = async (req, res) => {
    const { tableId } = req.params;
    try {
        // 1. Find the table using the provided tableId
        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({ message: "Table not found." });
        }

        // 2. Extract the branch name from the table document
        const branchName = table.branch;

        // 3. Find the company/branch details using the branch name
        const branchDetails = await Company.findOne({ branch: branchName });
        if (!branchDetails) {
            return res.status(404).json({ message: `Details for branch '${branchName}' could not be found.` });
        }

        // 4. Find the latest invoice for that table and branch within the current day
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const latestInvoice = await Invoice.findOne({
            tableName: table.tableName,
            branch: branchName, // Use the branch name found from the table
            orderType: 'dine-in',
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        }).sort({ createdAt: -1 });

        if (!latestInvoice) {
            return res.status(404).json({ message: "No recent order found for this table today." });
        }

        // 5. Prepare the response object containing order and branch details
        const responseData = {
            orderDetails: {
                tableName: table.tableName,
                invoiceSerial: latestInvoice.invoiceSerial,
                totalAmount: latestInvoice.totalAmount,
                products: latestInvoice.products.map(p => ({
                    productId: p.productId,
                    productName: p.productName,
                    quantity: p.quantity,
                })),
            },
            branchDetails: branchDetails, // Send all branch details
        };

        res.status(200).json(responseData);

    } catch (err) {
        console.error("Error preparing review page:", err);
        res.status(500).send({ error: "An internal server error occurred.", details: err.message });
    }
};

// ADDED: Prepare review page using only invoiceId
export const prepareReviewPageByInvoice = async (req, res) => {
    const { invoiceId } = req.params;
    try {
        // 1. Find the invoice using the provided invoiceId
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found." });
        }

        // 2. Check if a review has already been submitted for this invoice
        const existingReview = await Review.findOne({ invoiceId: invoice._id });
        if (existingReview) {
            return res.status(409).json({ message: "A review for this order has already been submitted." });
        }

        // 3. Extract the branch name from the invoice document
        const branchName = invoice.branch;

        // 4. Find the company/branch details using the branch name
        const branchDetails = await Company.findOne({ branch: branchName });
        if (!branchDetails) {
            return res.status(404).json({ message: `Details for branch '${branchName}' could not be found.` });
        }

        // 5. Prepare the response object containing order and branch details
        const responseData = {
            orderDetails: {
                tableName: invoice.tableName,
                invoiceSerial: invoice.invoiceSerial,
                totalAmount: invoice.totalAmount,
                products: invoice.products.map(p => ({
                    productId: p.productId,
                    productName: p.productName,
                    quantity: p.quantity,
                })),
            },
            branchDetails: branchDetails, // Send all branch details
        };

        res.status(200).json(responseData);

    } catch (err) {
        console.error("Error preparing review page by invoice:", err);
        res.status(500).send({ error: "An internal server error occurred.", details: err.message });
    }
};

// Submit a new review
export const submitReview = async (req, res) => {
    const { mobile, name, email, rating, comment, tableId, branch, bestFoodName } = req.body;

    try {
        const table = await Table.findById(tableId);
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

        // Check if a customer exists with the given mobile number.
        let customer = await Customer.findOne({ mobile });
        
        // If the customer does not exist, create a new one.
        if (!customer) {
            customer = await Customer.create({
                name,
                mobile,
                email,
                branch
            });
        }

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
        console.error("Error submitting review:", err);
        res.status(500).send({ error: "An internal server error occurred.", details: err.message });
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

export const getReviewsByBranch = async (req, res) => {
    const { branch } = req.params;
    const {
        // Pagination options
        page = 1,
        limit = 10,
        
        // Search term
        search,
        
        // Filter options
        rating,
        startDate,
        endDate,

        // Sorting options
        sortBy = 'createdAt', // Field to sort by
        sortOrder = 'desc'    // 'asc' or 'desc'
    } = req.query;

    try {
        // 1. Build the base query object
        const query = { branch };

        // 2. Add search functionality
        // This searches across multiple fields for the given term
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
            query.$or = [
                { customerName: searchRegex },
                { customerMobile: searchRegex },
                { comment: searchRegex },
                { bestFoodName: searchRegex },
            ];
        }

        // 3. Add filtering logic
        // Filter by a specific rating
        if (rating) {
            query.rating = Number(rating);
        }

        // Filter by a date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                // Set to the end of the day to include all reviews from that day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endOfDay;
            }
        }

        // 4. Prepare pagination values
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        
        // 5. Prepare sorting options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // 6. Execute queries to get data and total count
        const [reviews, totalReviews] = await Promise.all([
            Review.find(query)
                .populate('customerId', 'name email')
                .populate('invoiceId', 'invoiceSerial totalAmount')
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum),
            Review.countDocuments(query)
        ]);

        // 7. Send structured response with data and pagination info
        res.status(200).json({
            data: reviews,
            pagination: {
                totalReviews,
                totalPages: Math.ceil(totalReviews / limitNum),
                currentPage: pageNum,
                limit: limitNum,
            },
        });

    } catch (err) {
        console.error("Error fetching reviews by branch:", err);
        res.status(500).send({ error: "An internal server error occurred.", details: err.message });
    }
};

