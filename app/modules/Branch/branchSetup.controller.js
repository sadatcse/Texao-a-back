import Company from "../Company/Companys.model.js";
import Category from "../Catagorie/Catagories.model.js";
import Product from "../Product/Product.model.js";
import Table from "../Table/Tables.model.js";
import User from "../User/Users.model.js";

/**
 * Handles the creation of a new branch and all its initial data from the setup wizard.
 */
export const branchSetupWizard = async (req, res) => {
    const { company, categories, products, tables, users } = req.body;

    // Basic validation
    if (!company || !company.branch) {
        return res.status(400).json({ message: "Company and branch name are required." });
    }

    const branchName = company.branch;

    try {
        // --- Step 1: Create the Company/Branch ---
        // Ensure branch name is unique before proceeding
        const existingBranch = await Company.findOne({ branch: branchName });
        if (existingBranch) {
            return res.status(409).json({ message: `Branch '${branchName}' already exists.` });
        }
        await Company.create(company);

        // --- Step 2: Bulk Create Categories (if any) ---
        if (categories && categories.length > 0) {
            const categoriesWithBranch = categories.map(cat => ({ ...cat, branch: branchName }));
            await Category.insertMany(categoriesWithBranch);
        }

        // --- Step 3: Bulk Create Products (if any) ---
        if (products && products.length > 0) {
            const productsWithBranch = products.map(prod => ({ ...prod, branch: branchName }));
            await Product.insertMany(productsWithBranch);
        }
        
        // --- Step 4: Bulk Create Tables (if any) ---
        if (tables && tables.length > 0) {
            const tablesWithBranch = tables.map(table => ({ ...table, branch: branchName }));
            await Table.insertMany(tablesWithBranch);
        }

        // --- Step 5: Bulk Create Users (if any) ---
        if (users && users.length > 0) {
            // Note: insertMany does not trigger 'pre-save' hooks for password hashing.
            // We must hash passwords manually before insertion.
            const usersWithBranch = await Promise.all(users.map(async (user) => {
                const userInstance = new User({ ...user, branch: branchName });
                // The hashing is handled by the pre-save hook in the User model,
                // so creating a new instance and saving it will work.
                // For bulk, we'll just prepare them.
                return userInstance.save(); 
            }));
        }

        res.status(201).json({ message: `Branch '${branchName}' and all associated data created successfully!` });

    } catch (error) {
        console.error("Branch setup wizard failed:", error);
        // Basic cleanup: if branch creation fails mid-way, attempt to delete the company profile
        await Company.deleteOne({ branch: branchName });
        res.status(500).json({ message: "An error occurred during branch setup.", error: error.message });
    }
};