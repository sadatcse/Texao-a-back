import Product from "./Product.model.js";

// Get all products
export async function getAllProducts(req, res) {
  try {
    const result = await Product.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}



export async function searchProductsByBranch(req, res) {
    const { branch, query } = req.query; // Use req.query for search parameters
    try {
        const filter = { branch };
        if (query) {
            // Case-insensitive search on productName
            filter.productName = { $regex: query, $options: 'i' };
        }
        const result = await Product.find(filter);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

export async function searchActiveProducts(req, res) {
    const { branch, query } = req.query;

    if (!branch) {
        return res.status(400).json({ message: "Branch is required" });
    }

    try {
        const filter = {
            branch: branch,
            status: "available", // STRICTLY active products only
        };

        if (query) {
            filter.productName = { $regex: query, $options: 'i' };
        }

        const result = await Product.find(filter);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}
// Get products by category
export async function getProductsByCategory(req, res) {
  const category = req.params.category;
  try {
    const result = await Product.find({ category });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getProductsByCategoryAndBranch(req, res) {
  const { category, branch } = req.params;

  try {
 
    const filter = { branch };
    if (category !== "all") {
      filter.category = category;
    }

    const result = await Product.find(filter);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}


export async function getProductsByBranch(req, res) {
  const { branch } = req.params;
  try {
    const result = await Product.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Get product by ID
export async function getProductById(req, res) {
  const id = req.params.id;
  try {
    const result = await Product.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
export async function bulkCreateProduct(req, res) {
    try {
        const { branch, products } = req.body; 
        // We removed 'category' from the root requirement since it can be per-row now

        if (!branch) {
            return res.status(400).json({ message: "Branch is required." });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "Please provide a list of products." });
        }

        const documentsToInsert = products
            .filter(p => p.name && p.name.trim() !== "")
            .map((p) => {
                const price = parseFloat(p.price) || 0;
                let vatValue = parseFloat(p.vat) || 0;
                let sdValue = parseFloat(p.sd) || 0;

                // Handle Type Logic per row or default to 'amount'
                // Assuming frontend sends the final calculated amount OR we handle calc here
                // For this style, let's assume the frontend sends the raw number and type
                
                const pVatType = p.vatType || "amount";
                const pSdType = p.sdType || "amount";

                if (pVatType === "percentage") {
                    vatValue = (vatValue / 100) * price;
                }

                if (pSdType === "percentage") {
                    sdValue = (sdValue / 100) * price;
                }

                return {
                    productName: p.name.trim(),
                    price: price,
                    // Use row-specific category
                    category: p.category, 
                    branch: branch,
                    status: "available",
                    vat: vatValue, 
                    sd: sdValue,
                    vatType: "amount", // We store the result as amount
                    sdType: "amount",
                    flavour: false,
                    cFlavor: false,
                    addOns: false
                };
            });

        if (documentsToInsert.length === 0) {
            return res.status(400).json({ message: "No valid products found to insert." });
        }

        const result = await Product.insertMany(documentsToInsert);
        
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

export async function getProductCategoriesByBranch(req, res) {
  try {
    const { branch } = req.params;
    if (!branch) {
      return res.status(400).json({ message: "A branch name is required." });
    }
    // Find all unique 'category' values within documents that match the branch
    const categories = await Product.distinct('category', { branch });
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).send({ error: "Server error fetching product categories." });
  }
}
// Create a new product
export async function createProduct(req, res) {
  try {
    const productData = req.body;
    const result = await Product.create(productData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getSuperAdminProducts(req, res) {
  try {
    const { 
        page = 1, 
        limit = 10, 
        branch = '', 
        category = '',
        status = '',
        search = ''
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // --- Build Filter Query ---
    const query = {};

    if (branch) query.branch = branch;
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // --- Execute Queries Concurrently ---
    const [products, totalProducts, categories] = await Promise.all([
        Product.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Product.countDocuments(query),
        Product.distinct('category', query.branch ? { branch: query.branch } : {}) // Get categories relevant to the selected branch
    ]);
      
    res.status(200).json({
      data: products,
      categories, // Send available categories for filtering
      pagination: {
        totalDocuments: totalProducts,
        totalPages: Math.ceil(totalProducts / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });

  } catch (err) {
    res.status(500).send({ error: "Server error fetching products: " + err.message });
  }
}
// Remove a product by ID
export async function removeProduct(req, res) {
  const id = req.params.id;
  try {
    const result = await Product.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Product deleted successfully" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update a product by ID
export async function updateProduct(req, res) {
  const id = req.params.id;
  const productData = req.body;
  try {
    const result = await Product.findByIdAndUpdate(id, productData, {
      new: true,
    });
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}
