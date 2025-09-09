import Customer from "./Customers.model";

// Get all customers (unchanged)
export async function getAllCustomers(req, res) {
    try {
        const result = await Customer.find().populate({
            path: 'invoices',
            select: 'totalAmount -_id'
        });
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// Search customer by mobile (unchanged)
export async function getCustomerByMobile(req, res) {
    const { branch } = req.params;
    const { mobile } = req.query;
    try {
        const customer = await Customer.find({ branch, mobile });
        console.log(customer);
        res.status(200).json(customer);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// Get customer by ID with full details
export async function getCustomerById(req, res) {
    const id = req.params.id;
    try {
        const result = await Customer.findById(id)
            .populate('invoices')
            .populate('redeemHistory.invoiceId'); // No longer populating 'user'
        if (result) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: "Customer not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// Get customers by branch with pagination (unchanged)
export const getCustomersByBranch = async (req, res) => {
    const { branch } = req.params;
    const { pageNumber = 1, itemsPerPage = 10 } = req.query;

    const page = parseInt(pageNumber, 10);
    const limit = parseInt(itemsPerPage, 10);
    const skip = (page - 1) * limit;

    try {
        const data = await Customer.find({ branch })
            .skip(skip)
            .limit(limit);

        const totalData = await Customer.countDocuments({ branch });

        res.status(200).json({
            data,
            totalData,
            totalPages: Math.ceil(totalData / limit),
            currentPage: page,
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch customers", error: err.message });
    }
};

// Create a new customer (unchanged)
export async function createCustomer(req, res) {
    try {
        const { email, mobile } = req.body;

        const customerData = req.body;
        const result = await Customer.create(customerData);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// Update a customer by ID (unchanged)
export async function updateCustomer(req, res) {
    const id = req.params.id;
    const customerData = req.body;
    try {
        const result = await Customer.findByIdAndUpdate(id, customerData, {
            new: true,
        });
        if (result) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: "Customer not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// Remove a customer by ID (unchanged)
export async function removeCustomer(req, res) {
    const id = req.params.id;
    try {
        const result = await Customer.findByIdAndDelete(id);
        if (result) {
            res.status(200).json({ message: "Customer deleted successfully" });
        } else {
            res.status(404).json({ message: "Customer not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

// --- NEW FUNCTION TO REDEEM POINTS ---
export async function redeemPoints(req, res) {
    const id = req.params.id;
    const { redeemedPoints, userName, userEmail } = req.body; // Expect user name and email from the frontend

    if (!redeemedPoints || redeemedPoints <= 0) {
        return res.status(400).json({ message: "Invalid points value." });
    }

    try {
        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ message: "Customer not found." });
        }

        if (customer.currentPoints < redeemedPoints) {
            return res.status(400).json({ message: "Insufficient points." });
        }

        customer.currentPoints -= redeemedPoints;
        customer.redeemHistory.push({
            redeemedPoints,
            redeemedDate: new Date(),
            user: { name: userName, email: userEmail }
        });

        await customer.save();

        res.status(200).json({ message: "Points redeemed successfully.", updatedCustomer: customer });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}