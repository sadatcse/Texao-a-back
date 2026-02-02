import Category from "./Catagories.model.js";

// Get all categories
export async function getAllCategories(req, res) {
  try {
    const result = await Category.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get categories by branch
export async function getCategoryByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Category.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get category by ID
export async function getCategoryById(req, res) {
  const id = req.params.id;
  try {
    const result = await Category.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Create a new category
export async function createCategory(req, res) {
  try {
    const categoryData = req.body;
    const { branch } = categoryData;
    
    // Find the highest serial number for the given branch
    const lastCategory = await Category.findOne({ branch }).sort({ serial: -1 }).exec();
    
    // Determine the new serial number
    const newSerial = lastCategory ? lastCategory.serial + 1 : 1;
    
    // Add the generated serial to the category data
    categoryData.serial = newSerial;
    
    const result = await Category.create(categoryData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove a category by ID
export async function removeCategory(req, res) {
  const id = req.params.id;
  try {
    const result = await Category.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Category deleted successfully" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getActiveCategoriesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Category.find({ branch, isActive: true });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getSuperAdminCategories(req, res) {
  try {
    const { 
        page = 1, 
        limit = 10, 
        branch = '', 
        isActive = '',
        search = ''
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // --- Build Filter Query ---
    const query = {};
    if (branch) query.branch = branch;
    if (search) query.categoryName = { $regex: search, $options: 'i' };
    if (isActive) query.isActive = isActive === 'true'; // Convert string 'true'/'false' to boolean

    // --- Execute Queries ---
    const [categories, totalCategories] = await Promise.all([
        Category.find(query)
            .sort({ branch: 1, serial: 1 }) // Sort by branch, then by serial
            .skip(skip)
            .limit(limitNum),
        Category.countDocuments(query)
    ]);
      
    res.status(200).json({
      data: categories,
      pagination: {
        totalDocuments: totalCategories,
        totalPages: Math.ceil(totalCategories / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });

  } catch (err) {
    res.status(500).send({ error: "Server error fetching categories: " + err.message });
  }
}
export async function bulkCreateCategory(req, res) {
  try {
    const { branch, categories } = req.body; // Expecting { branch: "...", categories: ["Name1", "Name2"] }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "Please provide a list of category names." });
    }

    // 1. Find the highest serial number for this branch currently
    const lastCategory = await Category.findOne({ branch }).sort({ serial: -1 }).exec();
    let currentSerial = lastCategory ? lastCategory.serial : 0;

    // 2. Prepare the array of documents
    const documentsToInsert = categories
      .filter(name => name && name.trim() !== "") // Remove empty lines
      .map((name) => {
        currentSerial += 1; // Increment serial for each new item
        return {
          categoryName: name.trim(),
          serial: currentSerial,
          branch: branch,
          isActive: true,
        };
      });

    if (documentsToInsert.length === 0) {
        return res.status(400).json({ message: "No valid category names found to insert." });
    }

    // 3. Bulk Insert
    const result = await Category.insertMany(documentsToInsert);
    
    res.status(201).json({ 
        message: "Bulk upload successful", 
        count: result.length, 
        data: result 
    });

  } catch (err) {
    console.error("Bulk create error:", err);
    res.status(500).send({ error: err.message });
  }
}
// Update a category by ID
export async function updateCategory(req, res) {
  const id = req.params.id;
  const categoryData = req.body;
  try {
    const result = await Category.findByIdAndUpdate(id, categoryData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}