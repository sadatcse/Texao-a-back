import Invoice from "./Invoices.model.js";
import Product from "../Product/Product.model.js";
import moment from 'moment-timezone';
import Customer from "../Customer/Customers.model.js";
import mongoose from "mongoose";
import Company from '../Company/Companys.model.js';









const findAndLinkCustomer = async (invoiceData) => {
    try {
        if (invoiceData.customerMobile) {
            const customer = await Customer.findOne({ mobile: invoiceData.customerMobile });
            
            if (customer) {
                invoiceData.customerId = customer._id;
                
                if (!invoiceData.customerName) {
                    invoiceData.customerName = customer.name;
                }
            } else {
               
            }
        }
    } catch (error) {
        console.error("Error linking customer to invoice:", error.message);
    }
    return invoiceData;
};

export async function createInvoice(req, res) {
    try {
        let invoiceData = req.body;
        
        invoiceData = await findAndLinkCustomer(invoiceData);

        const result = await Invoice.create(invoiceData);

        if (result && result.branch) {
            req.io.to(result.branch).emit('kitchen-update');
        }

        res.status(201).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

export async function updateInvoice(req, res) {
    const { id } = req.params;
    const updates = req.body;

    try {
        // 1. Find the original invoice document
        const invoice = await Invoice.findById(id);
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        // Store old values for comparison after recalculation
        const oldTotalAmount = invoice.totalAmount;
        const oldEarnedPoints = invoice.earnedPoints;

        // 2. Apply updates from the request body to the document
        Object.assign(invoice, updates);

        // 3. Save the invoice, which triggers the pre('save') hook for recalculations
        const updatedInvoice = await invoice.save();

        // 4. Handle the customer profile update after the invoice has been saved
        if (invoice.customerId) {
            const customer = await Customer.findById(invoice.customerId);
            if (customer) {
                const newTotalAmount = updatedInvoice.totalAmount;
                const newEarnedPoints = updatedInvoice.earnedPoints;

                const amountDifference = newTotalAmount - oldTotalAmount;
                const pointsDifference = newEarnedPoints - oldEarnedPoints;

                customer.totalAmountSpent += amountDifference;
                customer.currentPoints += pointsDifference;
                await customer.save();
            }
        }
        
        // 5. Emit the socket event WITH the updated invoice object as the payload
        if (req.io && updatedInvoice && updatedInvoice.branch) {
            req.io.to(updatedInvoice.branch).emit('kitchen-update', updatedInvoice);
        }

        // 6. Send the final HTTP response
        res.status(200).json(updatedInvoice);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function removeInvoice(req, res) {
    const id = req.params.id;
    try {
        const invoiceToDelete = await Invoice.findById(id);
        if (!invoiceToDelete) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        // --- Start of new logic to update customer profile on deletion ---
        if (invoiceToDelete.customerId) {
            const customer = await Customer.findById(invoiceToDelete.customerId);
            if (customer) {
                // Subtract the invoice's values from the customer's totals
                customer.totalAmountSpent -= invoiceToDelete.totalAmount;
                customer.currentPoints -= invoiceToDelete.earnedPoints;
                customer.numberOfOrders -= 1;
                // Remove the invoice ID from the customer's invoices array
                customer.invoices.pull(invoiceToDelete._id);
                await customer.save();
            }
        }
        // --- End of new logic ---

        // Now, proceed with the deletion
        const result = await Invoice.findByIdAndDelete(id);

        if (result) {
            if (result.branch) {
                req.io.to(result.branch).emit('kitchen-update');
            }
            res.status(200).json({ message: "Food Order deleted successfully" });
        } else {
            res.status(404).json({ message: "Invoice not found" });
        }
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

export const finalizeInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        let updateData = req.body;
        
        // Find the customer and add their ID to the updateData
        updateData = await findAndLinkCustomer(updateData);
        
        // The main difference: explicitly set the order status
        updateData.orderStatus = 'completed';

        // Use findByIdAndUpdate, which does not trigger the pre-save hook
        const finalizedInvoice = await Invoice.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
        
        if (!finalizedInvoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        
        if (finalizedInvoice.customerId) {
            const customer = await Customer.findById(finalizedInvoice.customerId);
            
            if (customer) {
                // Get the existing invoice to get the old points
                const oldInvoice = await Invoice.findById(id);
                const oldTotalAmount = oldInvoice.totalAmount;
                const oldEarnedPoints = oldInvoice.earnedPoints;

                // Calculate the new points and amount
                const pointsToAdd = Math.floor(finalizedInvoice.totalAmount / 100);

                // Update the customer's records
                customer.totalAmountSpent = customer.totalAmountSpent - oldTotalAmount + finalizedInvoice.totalAmount;
                customer.currentPoints = customer.currentPoints - oldEarnedPoints + pointsToAdd;
                customer.numberOfOrders += 1;
                customer.invoices.push(finalizedInvoice._id);

                await customer.save();
            }
        }
        
        if (finalizedInvoice && finalizedInvoice.branch) {
            req.io.to(finalizedInvoice.branch).emit('kitchen-update');
        }

        res.status(200).json({
            message: "Order finalized successfully!",
            invoice: finalizedInvoice
        });
    } catch (error) {
        res.status(500).json({
            message: "Error finalizing invoice",
            error: error.message
        });
    }
};


export async function getAllInvoices(req, res) {
  try {
    const result = await Invoice.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getFilteredInvoices(req, res) {
  const { branch } = req.params;
  const {
    orderType,
    paymentStatus,
    orderStatus,
    search,
    startDate,
    endDate,
    // --- PAGINATION PARAMS ---
    page = 1, // Default to page 1
    limit = 15, // Default to 10 items per page
  } = req.query;

  try {
    const query = { branch };

    // Add filters if they are provided
    if (orderType) query.orderType = orderType;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (orderStatus) query.orderStatus = orderStatus;

    // Date filtering logic (unchanged)
    if (startDate && endDate) {
      query.dateTime = {
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(endDate).endOf("day").toDate(),
      };
    } else if (startDate && !endDate) {
      query.dateTime = {
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(startDate).endOf("day").toDate(),
      };
    } else {
      query.dateTime = {
        $gte: moment().startOf("day").toDate(),
        $lte: moment().endOf("day").toDate(),
      };
    }

    // Search term filtering logic (unchanged)
    if (search) {
      const isNumeric = !isNaN(parseFloat(search)) && isFinite(search);
      query.$or = [
        { invoiceSerial: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { loginUserName: { $regex: search, $options: "i" } },
      ];
      if (isNumeric) {
        query.$or.push({ token: Number(search) });
      }
    }

    // --- PAGINATION LOGIC ---
    
    // 1. Convert page and limit to numbers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // 2. Calculate the number of documents to skip
    const skip = (pageNumber - 1) * limitNumber;

    // 3. Execute queries in parallel for efficiency
    //    - First query gets the documents for the current page
    //    - Second query gets the total count of documents matching the filter
    const [invoices, totalDocs] = await Promise.all([
      Invoice.find(query)
        .sort({ dateTime: -1 }) // Sort remains the same
        .skip(skip)             // Skip documents for previous pages
        .limit(limitNumber),    // Limit the results to the page size
      Invoice.countDocuments(query), // Get the total count
    ]);
    
    // 4. Calculate total pages
    const totalPages = Math.ceil(totalDocs / limitNumber);

    // 5. Send a structured response with data and pagination info
    res.status(200).json({
      data: invoices,
      pagination: {
        totalDocs,
        limit: limitNumber,
        totalPages,
        currentPage: pageNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });

  } catch (err) {
    console.error("Error fetching filtered invoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices: " + err.message });
  }
}

export async function getKitchenOrdersByBranch(req, res) {
  const { branch } = req.params;
  const timezone = "Asia/Dhaka"; // Timezone for your location

  try {
    // Define the start and end of the current day in the local timezone
    const startOfToday = moment().tz(timezone).startOf('day').toDate();
    const endOfToday = moment().tz(timezone).endOf('day').toDate();

    // Find invoices for the specified branch, within today's date range,
    // and with a status of "pending" or "cooking"
    const kitchenOrders = await Invoice.find({
      branch: branch,
      dateTime: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
      orderStatus: { $in: ["pending", "cooking"] }
    }).sort({ dateTime: 'asc' }); // Sort by oldest first

    res.status(200).json(kitchenOrders);
  } catch (err) {
    console.error("Error fetching kitchen orders:", err);
    res.status(500).json({ error: "Failed to fetch kitchen orders: " + err.message });
  }
}
export async function getSalesByDateRange(req, res) {
  const { branch } = req.params;
  const { category, product, startDate, endDate } = req.query;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    const startOfDay = moment(startDate).startOf("day").toDate();
    const endOfDay = moment(endDate).endOf("day").toDate();
    
    const invoices = await Invoice.find({
      branch,
      dateTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (!invoices || invoices.length === 0) {
      return res.status(200).json([]);
    }

    const productSales = {};

    invoices.forEach(invoice => {
      invoice.products.forEach(prod => {
        if (!productSales[prod.productName]) {
          productSales[prod.productName] = {
            productName: prod.productName,
            qty: 0,
            rate: prod.rate,
          };
        }
        productSales[prod.productName].qty += prod.qty;
      });
    });

    let filteredProducts = Object.values(productSales);

    // Filter by product if specified
    if (product && product !== "All") {
        filteredProducts = filteredProducts.filter(p => p.productName === product);
    }
    
    // Filter by category if specified
    if (category && category !== "All") {
        // --- THIS IS THE CORRECTED LINE ---
        // The field in the Product model is 'category', not 'categoryName'.
        const productsInCategory = await Product.find({ category: category, branch: branch }).select('productName');
        const productNamesInCategory = productsInCategory.map(p => p.productName);
        
        filteredProducts = filteredProducts.filter(prod =>
            productNamesInCategory.includes(prod.productName)
        );
    }

    res.status(200).json(filteredProducts);
  } catch (err) {
    console.error("Error fetching product sales:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function getInvoicesByCounterDate(req, res) {
  const { branch, counter } = req.params;
  const { startDate, endDate } = req.query;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    let invoices;

    if (startDate === endDate) {
      // Fetch invoices for the selected branch and counter on a single day
      const branchCounterOrders = await Invoice.find({ branch, counter });
      const todaysDate = moment(startDate).format("YYYY-MM-DD");

      invoices = branchCounterOrders.filter(invoice =>
        moment(invoice.dateTime).format("YYYY-MM-DD") === todaysDate
      );
    } else {
      // Fetch invoices for the selected branch and counter within the date range
      invoices = await Invoice.find({
        branch,
        counter,
        dateTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
    }

    if (!invoices || invoices.length === 0) {
      return res.status(200).json([]);
    }

    // Aggregate data by date
    const aggregatedData = invoices.reduce((result, invoice) => {
      const date = moment(invoice.dateTime).format("YYYY-MM-DD");

      if (!result[date]) {
        result[date] = {
          date,
          orderCount: 0,
          totalQty: 0,
          totalSubtotal: 0,
          totalDiscount: 0,
          totalAmount: 0,
          totalVat: 0,
        };
      }

      result[date].orderCount += 1;
      result[date].totalQty += invoice.products?.reduce((sum, product) => sum + (product.qty || 0), 0) || 0;
      result[date].totalSubtotal += invoice.products?.reduce((sum, product) => sum + (product.subtotal || 0), 0) || 0;
      result[date].totalDiscount += invoice.discount || 0;
      result[date].totalAmount += invoice.totalAmount || 0;
      result[date].totalVat += invoice.vat || 0;

      return result;
    }, {});

    // Convert aggregated data into an array
    const responseData = Object.values(aggregatedData);

    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWeeklySalesByMonth(req, res) {
  const { branch } = req.params;
  const { month } = req.query; // e.g., "07" or "7"

  try {
    if (!branch || !month) {
      return res.status(400).json({ message: "Branch and month are required." });
    }

    const currentYear = moment().year();
    const paddedMonth = month.toString().padStart(2, '0');
    
    const startDate = moment(`${currentYear}-${paddedMonth}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');

    const invoices = await Invoice.find({
      branch,
      dateTime: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    });

    let weeklyTotals = [0, 0, 0, 0, 0];
    let totalMonthSale = 0;

    invoices.forEach(invoice => {
      const invoiceDate = moment(invoice.dateTime);
      
      // ### FIXED LOGIC HERE ###
      // Calculate week index based on the day of the month (1-31)
      // Days 1-7 -> Week 1 (index 0)
      // Days 8-14 -> Week 2 (index 1)
      // etc.
      const dayOfMonth = invoiceDate.date();
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 4); 
      // ########################

      weeklyTotals[weekIndex] += invoice.totalAmount;
      totalMonthSale += invoice.totalAmount;
    });

    const weeklyPercentage = weeklyTotals.map((total, index) => ({
      week: `Week ${index + 1}`,
      totalSale: total,
      percentage: totalMonthSale ? parseFloat(((total / totalMonthSale) * 100).toFixed(2)) : 0,
    }));

    res.status(200).json({
      branch,
      year: currentYear,
      month: paddedMonth,
      totalMonthSale,
      weeklyPercentage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function getTrendingProducts(req, res) {
  const { branch } = req.params;

  try {
    // Automatically get the current year and month using moment
    const currentYear = moment().year();
    const currentMonth = moment().month() + 1; // .month() is 0-indexed, so add 1

    // Pad the month to ensure two digits (e.g., "07" instead of "7")
    const paddedMonth = String(currentMonth).padStart(2, '0');

    // Create start and end dates using a valid ISO 8601 format
    const startDate = moment(`${currentYear}-${paddedMonth}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');

    const trendingProducts = await Invoice.aggregate([
      // Stage 1: Filter invoices by branch and the current month
      {
        $match: {
          branch: branch,
          dateTime: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate(),
          },
        },
      },
      // Stage 2: Deconstruct the products array
      { $unwind: "$products" },
      // Stage 3: Group by productName to calculate totals
      {
        $group: {
          _id: "$products.productName",
          totalOrders: { $sum: "$products.qty" },
          totalIncome: { $sum: "$products.subtotal" },
          price: { $first: "$products.rate" },
        },
      },
      // Stage 4: Sort by total orders
      { $sort: { totalOrders: -1 } },
      // Stage 5: Limit to the top 4
      { $limit: 4 },
      // Stage 6: Join with the 'products' collection for the photo
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productName",
          as: "productDetails",
        },
      },
      // Stage 7: Deconstruct the lookup result
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Stage 8: Reshape the final output
      {
        $project: {
          _id: 0,
          name: "$_id",
          price: "$price",
          orders: "$totalOrders",
          income: "$totalIncome",
          imgSrc: { $ifNull: [ "$productDetails.photo", "https://html.com/wp-content/uploads/530x240.png" ] },
        },
      },
    ]);

    res.status(200).json(trendingProducts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trending products: " + err.message });
  }
}

// Add this new function to your Invoices.controller.js

export async function getMonthlyOrderTimings(req, res) {
  const { branch } = req.params;

  try {
    // Get the start and end of the current month in UTC to pre-filter documents
    const startDate = moment().startOf('month').toDate();
    const endDate = moment().endOf('month').toDate();
    const timezone = "Asia/Dhaka"; // IANA timezone for Bangladesh

    const orderTimings = await Invoice.aggregate([
      // Stage 1: Initial filter for the current month (improves performance)
      {
        $match: {
          branch: branch,
          dateTime: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      
      // Stage 2: Add a filter for the time of day in Bangladesh Time
      {
        $match: {
          $expr: {
            // Use $let to define the hour in the specified timezone once
            $let: {
              vars: {
                hourInDhaka: { $hour: { date: "$dateTime", timezone: timezone } }
              },
              // The condition to apply
              in: {
                $and: [
                  { $gte: ["$$hourInDhaka", 11] }, // 11 AM or later
                  { $lte: ["$$hourInDhaka", 23] }  // 11:59 PM or earlier (hour 23)
                ]
              }
            }
          }
        }
      },

      // Stage 3: Group by the hour, converting the time to Bangladesh Time first
      {
        $group: {
          _id: { $hour: { date: "$dateTime", timezone: timezone } }, // Group by the hour (0-23)
          orders: { $sum: 1 }, // Count the number of invoices in each group
        },
      },
      
      // Stage 4: Sort by hour
      { $sort: { _id: 1 } },
      
      // Stage 5: Format the output to be readable (e.g., "11pm")
      {
        $project: {
          _id: 0,
          hour: {
            $let: {
              vars: {
                hour24: "$_id"
              },
              in: {
                $let: {
                  vars: {
                    hour12: { $mod: ["$$hour24", 12] },
                    amPm: { $cond: [{ $or: [{ $eq: ["$$hour24", 12] }, { $gt: ["$$hour24", 12] }] }, "pm", "am"] }
                  },
                  in: {
                    $concat: [
                      { $toString: { $cond: [{ $eq: ["$$hour12", 0] }, 12, "$$hour12"] } },
                      "$$amPm"
                    ]
                  }
                }
              }
            }
          },
          orders: "$orders",
        },
      },
    ]);

    res.status(200).json(orderTimings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order timings: " + err.message });
  }
}

export async function getFavoriteProductsByDay(req, res) {
  const { branch } = req.params;
  const timezone = "Asia/Dhaka";

  try {
    const today = moment().tz(timezone);
    const startOfWeek = today.clone().day("Saturday").startOf('day');

    const favoriteProducts = await Invoice.aggregate([
      // Stage 1: Filter invoices for the current week
      {
        $match: {
          branch: branch,
          dateTime: { $gte: startOfWeek.toDate() },
        },
      },
      // ... Stages 2-4 are correct ...
      { $unwind: "$products" },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: { date: "$dateTime", timezone: timezone } },
            productName: "$products.productName",
          },
          qty: { $sum: "$products.qty" },
          profit: { $sum: "$products.subtotal" },
        },
      },
      { $sort: { "_id.dayOfWeek": 1, qty: -1 } },
      // ... Stages 5-6 are correct ...
      {
        $group: {
          _id: "$_id.dayOfWeek",
          products: {
            $push: {
              name: "$_id.productName",
              qty: "$qty",
              profit: "$profit",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          dayOfWeek: "$_id",
          topProducts: { $slice: ["$products", 4] },
        },
      },
      // Stage 7: Corrected final grouping
      {
        $group: {
          _id: null,
          data: {
            $push: {
              k: {
                // CORRECTED: This now matches MongoDB's output (Sun=1, Sat=7)
                $switch: {
                  branches: [
                    { case: { $eq: ["$dayOfWeek", 1] }, then: "sun" },
                    { case: { $eq: ["$dayOfWeek", 2] }, then: "mon" },
                    { case: { $eq: ["$dayOfWeek", 3] }, then: "tue" },
                    { case: { $eq: ["$dayOfWeek", 4] }, then: "wed" },
                    { case: { $eq: ["$dayOfWeek", 5] }, then: "thu" },
                    { case: { $eq: ["$dayOfWeek", 6] }, then: "fri" },
                    { case: { $eq: ["$dayOfWeek", 7] }, then: "sat" },
                  ],
                  default: "unknown",
                },
              },
              v: "$topProducts",
            },
          },
        },
      },
      // Stage 8: Correct
      {
        $replaceRoot: {
          newRoot: { $arrayToObject: "$data" },
        },
      },
    ]);

    res.status(200).json(favoriteProducts.length > 0 ? favoriteProducts[0] : {});
  } catch (err) {
    // Log the full error on the server for better debugging
    console.error("Error fetching favorite products:", err);
    res.status(500).json({ error: "Failed to fetch favorite products: " + err.message });
  }
}

export async function getInvoicesByDateRange(req, res) {
  const { branch } = req.params;
  const { startDate, endDate } = req.query;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    // Adjust the end date to include the entire day
    const adjustedEndDate = moment(endDate).endOf('day').toDate();

    // Optimized database query
    const invoices = await Invoice.find({
      branch,
      dateTime: {
        $gte: new Date(startDate),
        $lte: adjustedEndDate,
      },
    });

    // If no invoices are found, return an empty array
    if (!invoices || invoices.length === 0) {
      return res.status(200).json([]);
    }

    // Aggregate data by date
    const aggregatedData = invoices.reduce((result, invoice) => {
      const date = moment(invoice.dateTime).format("YYYY-MM-DD");

      if (!result[date]) {
        result[date] = {
          date,
          orderCount: 0,
          totalQty: 0,
          totalSubtotal: 0,
          totalDiscount: 0,
          totalAmount: 0,
          totalVat: 0,
          totalSd: 0, // Added for SD aggregation
        };
      }

      // Safely calculate the values, defaulting to 0 if null or undefined
      result[date].orderCount += 1;
      result[date].totalQty += invoice.totalQty || 0;
      result[date].totalSubtotal += invoice.subtotal || 0;
      result[date].totalDiscount += invoice.discount || 0;
      result[date].totalAmount += invoice.totalAmount || 0;
      result[date].totalVat += invoice.vat || 0;
      result[date].totalSd += invoice.sd || 0; // Accumulate SD

      return result;
    }, {});

    // Convert aggregated data into an array and sort by date
    const responseData = Object.values(aggregatedData).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get invoices by branch
export async function getInvoicesByBranch(req, res) {
  const branch = req.params.branch;
  try {
    const result = await Invoice.find({ branch });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function gettop5InvoicesByBranch(req, res) {
  const { branch } = req.params;
  try {
    const result = await Invoice.find({ branch })
      .sort({ dateTime: -1 })  // Sort by newest first
      .limit(5);               // Limit to 5 results

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function getFilteredSearchInvoices(req, res) {
  const { branch } = req.params;
  const {
    startDate,
    endDate,
    orderType,
    orderStatus,
    tableName,
    deliveryProvider,
    paymentMethod,
    loginUserName,
    searchQuery,
    fetchAll, // New flag to control pagination
  } = req.query;

  // Use page and limit from query, or set defaults for pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    // 1. Build the initial filtering stage ($match)
    const matchStage = { branch };

    if (startDate && endDate) {
      matchStage.dateTime = {
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(endDate).endOf("day").toDate(),
      };
    }

    if (orderType && orderType !== "all") matchStage.orderType = orderType;
    if (orderStatus && orderStatus !== "all") matchStage.orderStatus = orderStatus;
    if (tableName && tableName !== "all") matchStage.tableName = tableName;
    if (deliveryProvider && deliveryProvider !== "all") matchStage.deliveryProvider = deliveryProvider;
    if (paymentMethod && paymentMethod !== "all") matchStage.paymentMethod = paymentMethod;
    if (loginUserName && loginUserName !== "all") matchStage.loginUserName = loginUserName;

    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i");
      matchStage.$or = [
        { invoiceSerial: searchRegex },
        { customerName: searchRegex },
        { loginUserName: searchRegex },
        { tableName: searchRegex },
      ];
      if (!isNaN(parseFloat(searchQuery))) {
        matchStage.$or.push({ totalAmount: parseFloat(searchQuery) });
      }
    }

    // 2. Define the aggregation pipeline
    const aggregationPipeline = [
      { $match: matchStage },
      {
        // 3. Use $facet to run multiple operations on the matched data
        $facet: {
          // --- Sub-pipeline for fetching the actual invoice data (with pagination) ---
          invoices: [
            { $sort: { dateTime: -1 } },
            // Only apply pagination if `fetchAll` is not true
            ...(fetchAll
              ? []
              : [{ $skip: (page - 1) * limit }, { $limit: limit }]),
          ],
          // --- Sub-pipeline for calculating all summary data ---
          summary: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$totalAmount" },
                totalQty: { $sum: "$totalQty" },
                totalVat: { $sum: { $ifNull: ["$vat", 0] } },
                totalSd: { $sum: { $ifNull: ["$sd", 0] } },
                totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                totalTableDiscount: {
                  $sum: { $cond: [{ $eq: ["$orderType", "dine-in"] }, { $ifNull: ["$discount", 0] }, 0] },
                },
                totalDiscountedInvoices: {
                  $sum: { $cond: [{ $gt: ["$discount", 0] }, 1, 0] },
                },
                 totalTableDiscountedInvoices: {
                  $sum: { $cond: [{ $and: [{ $gt: ["$discount", 0] }, { $eq: ["$orderType", "dine-in"] }] }, 1, 0] },
                },
                
                // Payment Method Sums & Counts
                cashAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$totalAmount", 0] } },
                cashCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Cash"] }, 1, 0] } },
                bankAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Bank"] }, "$totalAmount", 0] } },
                bankCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Bank"] }, 1, 0] } },
                
                // Card Payments
                cardAmount: { $sum: { $cond: [{ $in: ["$paymentMethod", ["Visa Card", "Master Card", "Amex Card"]] }, "$totalAmount", 0] }},
                cardCount: { $sum: { $cond: [{ $in: ["$paymentMethod", ["Visa Card", "Master Card", "Amex Card"]] }, 1, 0] }},
                visaCardAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Visa Card"] }, "$totalAmount", 0] }},
                visaCardCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Visa Card"] }, 1, 0] }},
                masterCardAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Master Card"] }, "$totalAmount", 0] }},
                masterCardCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Master Card"] }, 1, 0] }},
                amexCardAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Amex Card"] }, "$totalAmount", 0] }},
                amexCardCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Amex Card"] }, 1, 0] }},
                
                // Mobile Payments
                mobileAmount: { $sum: { $cond: [{ $in: ["$paymentMethod", ["Bkash", "Nagad", "Rocket"]] }, "$totalAmount", 0] }},
                mobileCount: { $sum: { $cond: [{ $in: ["$paymentMethod", ["Bkash", "Nagad", "Rocket"]] }, 1, 0] }},
                bkashAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Bkash"] }, "$totalAmount", 0] }},
                bkashCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Bkash"] }, 1, 0] }},
                nagadAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Nagad"] }, "$totalAmount", 0] }},
                nagadCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Nagad"] }, 1, 0] }},
                rocketAmount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Rocket"] }, "$totalAmount", 0] }},
                rocketCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Rocket"] }, 1, 0] }},

                // Order Type Sums & Counts
                dineInAmount: { $sum: { $cond: [{ $eq: ["$orderType", "dine-in"] }, "$totalAmount", 0] } },
                dineInCount: { $sum: { $cond: [{ $eq: ["$orderType", "dine-in"] }, 1, 0] } },
                takeawayAmount: { $sum: { $cond: [{ $eq: ["$orderType", "takeaway"] }, "$totalAmount", 0] } },
                takeawayCount: { $sum: { $cond: [{ $eq: ["$orderType", "takeaway"] }, 1, 0] } },
                deliveryAmount: { $sum: { $cond: [{ $eq: ["$orderType", "delivery"] }, "$totalAmount", 0] } },
                deliveryCount: { $sum: { $cond: [{ $eq: ["$orderType", "delivery"] }, 1, 0] } },

                // Delivery Provider Sums & Counts
                pathaoAmount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Pathao"] }, "$totalAmount", 0] } },
                pathaoCount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Pathao"] }, 1, 0] } },
                foodiAmount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Foodi"] }, "$totalAmount", 0] } },
                foodiCount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Foodi"] }, 1, 0] } },
                foodpandaAmount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Foodpanda"] }, "$totalAmount", 0] } },
                foodpandaCount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "Foodpanda"] }, 1, 0] } },
                deliveryBoyAmount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "DeliveryBoy"] }, "$totalAmount", 0] } },
                deliveryBoyCount: { $sum: { $cond: [{ $eq: ["$deliveryProvider", "DeliveryBoy"] }, 1, 0] } },

                totalCount: { $sum: 1 },
                allProducts: { $push: "$products" },
              },
            },
             {
              $addFields: {
                flatProducts: {
                  $reduce: {
                    input: "$allProducts",
                    initialValue: [],
                    in: { $concatArrays: ["$$value", "$$this"] }
                  }
                }
              }
            },
            {
              $addFields: {
                complimentaryItems: {
                  $filter: {
                    input: "$flatProducts",
                    as: "product",
                    cond: { $eq: ["$$product.isComplimentary", true] }
                  }
                }
              }
            },
             {
              $project: {
                _id: 0,
                totalAmount: 1, totalQty: 1, totalVat: 1, totalSd: 1, totalDiscount: 1, totalTableDiscount: 1, totalDiscountedInvoices: 1, totalTableDiscountedInvoices: 1, totalCount: 1,
                
                totalComplimentaryAmount: { $sum: "$complimentaryItems.subtotal" },
                totalComplimentaryItems: { $sum: "$complimentaryItems.qty" },
                
                // Grouped data
                cashAmount: 1, cashCount: 1, bankAmount: 1, bankCount: 1, 
                cardAmount: 1, cardCount: 1, visaCardAmount: 1, visaCardCount: 1, masterCardAmount: 1, masterCardCount: 1, amexCardAmount: 1, amexCardCount: 1,
                mobileAmount: 1, mobileCount: 1, bkashAmount: 1, bkashCount: 1, nagadAmount: 1, nagadCount: 1, rocketAmount: 1, rocketCount: 1,
                dineInAmount: 1, dineInCount: 1, takeawayAmount: 1, takeawayCount: 1, deliveryAmount: 1, deliveryCount: 1,
                pathaoAmount: 1, pathaoCount: 1, foodiAmount: 1, foodiCount: 1, foodpandaAmount: 1, foodpandaCount: 1, deliveryBoyAmount: 1, deliveryBoyCount: 1,
              }
            }
          ],
        },
      },
    ];

    const results = await Invoice.aggregate(aggregationPipeline);
    const invoices = results[0].invoices;
    const summaryData = results[0].summary[0];
    
    // If no results, send a default structure
    if (!summaryData) {
         return res.status(200).json({
            invoices: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
            summary: { /* ... default zeroed summary ... */ }
        });
    }

    // 4. Format the summary into the required nested structure
    const totalInvoices = summaryData.totalCount;
    const formattedSummary = {
        totalSales: {
            totalAmount: summaryData.totalAmount,
            averageOrderValue: totalInvoices > 0 ? summaryData.totalAmount / totalInvoices : 0,
            totalQty: summaryData.totalQty,
        },
        taxesAndDiscounts: {
            totalVat: summaryData.totalVat, totalSd: summaryData.totalSd, totalDiscount: summaryData.totalDiscount, totalTableDiscount: summaryData.totalTableDiscount, totalDiscountedInvoices: summaryData.totalDiscountedInvoices, totalTableDiscountedInvoices: summaryData.totalTableDiscountedInvoices,
        },
        complimentaryItems: {
            totalComplimentaryItems: summaryData.totalComplimentaryItems,
            totalComplimentaryAmount: summaryData.totalComplimentaryAmount,
        },
        salesByOrderType: {
            dineIn: { totalAmount: summaryData.dineInAmount, invoiceCount: summaryData.dineInCount },
            takeaway: { totalAmount: summaryData.takeawayAmount, invoiceCount: summaryData.takeawayCount },
            delivery: {
                totalAmount: summaryData.deliveryAmount,
                invoiceCount: summaryData.deliveryCount,
                providers: {
                    pathao: { totalAmount: summaryData.pathaoAmount, invoiceCount: summaryData.pathaoCount },
                    foodi: { totalAmount: summaryData.foodiAmount, invoiceCount: summaryData.foodiCount },
                    foodpanda: { totalAmount: summaryData.foodpandaAmount, invoiceCount: summaryData.foodpandaCount },
                    deliveryBoy: { totalAmount: summaryData.deliveryBoyAmount, invoiceCount: summaryData.deliveryBoyCount },
                }
            }
        },
        salesByPaymentMethod: {
            cash: { totalAmount: summaryData.cashAmount, invoiceCount: summaryData.cashCount },
            bank: { totalAmount: summaryData.bankAmount, invoiceCount: summaryData.bankCount },
            card: {
                totalAmount: summaryData.cardAmount, invoiceCount: summaryData.cardCount,
                visaCard: { totalAmount: summaryData.visaCardAmount, invoiceCount: summaryData.visaCardCount },
                masterCard: { totalAmount: summaryData.masterCardAmount, invoiceCount: summaryData.masterCardCount },
                amexCard: { totalAmount: summaryData.amexCardAmount, invoiceCount: summaryData.amexCardCount },
            },
            mobile: {
                totalAmount: summaryData.mobileAmount, invoiceCount: summaryData.mobileCount,
                bkash: { totalAmount: summaryData.bkashAmount, invoiceCount: summaryData.bkashCount },
                nagad: { totalAmount: summaryData.nagadAmount, invoiceCount: summaryData.nagadCount },
                rocket: { totalAmount: summaryData.rocketAmount, invoiceCount: summaryData.rocketCount },
            }
        }
    };
    
    // 5. Send the final response
    res.status(200).json({
      invoices,
      pagination: {
        total: totalInvoices,
        page,
        limit,
        totalPages: fetchAll ? 1 : Math.ceil(totalInvoices / limit),
      },
      summary: formattedSummary,
    });
  } catch (err) {
    console.error("Error in getFilteredSearchInvoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices: " + err.message });
  }
}


export async function getdatesByBranch(req, res) {
  const { branch, date } = req.params;

  // Validate branch and date
  if (!branch) {
    return res.status(400).json({ message: "Branch is required." });
  }

  if (!date || !moment(date, 'YYYY-MM-DD', true).isValid()) {
    return res.status(400).json({ message: "A valid date (YYYY-MM-DD) is required." });
  }

  try {
    const startDate = moment(date).startOf('day').toDate();
    const endDate = moment(date).endOf('day').toDate();

    const todaysInvoices = await Invoice.find({
      branch,
      dateTime: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // If no orders found, return all totals as 0
    if (todaysInvoices.length === 0) {
      return res.status(200).json({
        orders: [],
        totalOrders: 0,
        totalQty: 0,
        totalAmount: 0,
        totalVat: 0,
        totalSd: 0, // NEW: Zeroed-out SD
        totalDiscount: 0,
        totalTableDiscount: 0,
        cashPayments: 0,
        cardPayments: 0,
        mobilePayments: 0,
        bankPayments: 0,
        orderTypeCounts: { dineIn: 0, takeaway: 0, delivery: 0 },
        deliveryProviderCounts: { pathao: 0, foodi: 0, foodpanda: 0, deliveryBoy: 0 },
        averageOrderValue: 0,
        salesByOrderType: { dineIn: 0, takeaway: 0, delivery: 0 },
        salesByDeliveryProvider: { pathao: 0, foodi: 0, foodpanda: 0, deliveryBoy: 0 },
        paymentMethodCounts: { cash: 0, card: 0, mobile: 0, bank: 0 },
        totalComplimentaryItems: 0,
        totalComplimentaryAmount: 0,
      });
    }

    // --- UPDATED: Calculate all totals and counts in a single pass ---
    const analysis = todaysInvoices.reduce((acc, order) => {
        // Accumulate standard totals
        acc.totalQty += order.totalQty;
        acc.totalAmount += order.totalAmount;
        acc.totalVat += order.vat || 0;
        acc.totalSd += order.sd || 0; // NEW: Accumulate SD
        acc.totalDiscount += order.discount || 0; // This is the overall total discount

        // Tally complimentary items
        order.products.forEach(product => {
            if (product.isComplimentary) {
                acc.totalComplimentaryItems += product.qty;
                acc.totalComplimentaryAmount += product.subtotal;
            }
        });

        // Breakdown by payment method (amount and count)
        switch (order.paymentMethod) {
            case 'Cash':
                acc.cashPayments += order.totalAmount;
                acc.paymentMethodCounts.cash += 1;
                break;
            case 'Card':
            case 'Visa Card':
            case 'Master Card':
            case 'Amex Card':
                acc.cardPayments += order.totalAmount;
                acc.paymentMethodCounts.card += 1;
                break;
            case 'Mobile':
            case 'Bkash':
            case 'Nagad':
            case 'Rocket':
                acc.mobilePayments += order.totalAmount;
                acc.paymentMethodCounts.mobile += 1;
                break;
            case 'Bank':
                acc.bankPayments += order.totalAmount;
                acc.paymentMethodCounts.bank += 1;
                break;
            default:
                break;
        }

        // Breakdown by order type (count and sales amount)
        switch (order.orderType) {
            case 'dine-in':
                acc.orderTypeCounts.dineIn += 1;
                acc.salesByOrderType.dineIn += order.totalAmount;
                acc.totalTableDiscount += order.discount || 0;
                break;
            case 'takeaway':
                acc.orderTypeCounts.takeaway += 1;
                acc.salesByOrderType.takeaway += order.totalAmount;
                break;
            case 'delivery':
                acc.orderTypeCounts.delivery += 1;
                acc.salesByOrderType.delivery += order.totalAmount;
                // Further breakdown by delivery provider (count and sales amount)
                switch (order.deliveryProvider) {
                    case 'Pathao':
                        acc.deliveryProviderCounts.pathao += 1;
                        acc.salesByDeliveryProvider.pathao += order.totalAmount;
                        break;
                    case 'Foodi':
                        acc.deliveryProviderCounts.foodi += 1;
                        acc.salesByDeliveryProvider.foodi += order.totalAmount;
                        break;
                    case 'Foodpanda':
                        acc.deliveryProviderCounts.foodpanda += 1;
                        acc.salesByDeliveryProvider.foodpanda += order.totalAmount;
                        break;
                    case 'DeliveryBoy':
                        acc.deliveryProviderCounts.deliveryBoy += 1;
                        acc.salesByDeliveryProvider.deliveryBoy += order.totalAmount;
                        break;
                    default: break;
                }
                break;
            default: break;
        }

        return acc;
    }, {
        // Initial values for all accumulators
        totalQty: 0,
        totalAmount: 0,
        totalVat: 0,
        totalSd: 0, // NEW: Initial value for SD
        totalDiscount: 0,
        totalTableDiscount: 0,
        cashPayments: 0,
        cardPayments: 0,
        mobilePayments: 0,
        bankPayments: 0,
        orderTypeCounts: { dineIn: 0, takeaway: 0, delivery: 0 },
        deliveryProviderCounts: { pathao: 0, foodi: 0, foodpanda: 0, deliveryBoy: 0 },
        salesByOrderType: { dineIn: 0, takeaway: 0, delivery: 0 },
        salesByDeliveryProvider: { pathao: 0, foodi: 0, foodpanda: 0, deliveryBoy: 0 },
        paymentMethodCounts: { cash: 0, card: 0, mobile: 0, bank: 0 },
        totalComplimentaryItems: 0,
        totalComplimentaryAmount: 0,
    });

    // Post-calculation processing
    const averageOrderValue = todaysInvoices.length > 0 ? (analysis.totalAmount / todaysInvoices.length) : 0;

    // Send the response with all calculated data
    res.status(200).json({
      orders: todaysInvoices,
      totalOrders: todaysInvoices.length,
      totalQty: analysis.totalQty,
      totalAmount: analysis.totalAmount,
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      totalVat: analysis.totalVat,
      totalSd: analysis.totalSd, // NEW: Added SD to response
      totalDiscount: analysis.totalDiscount,
      totalTableDiscount: analysis.totalTableDiscount,
      totalComplimentaryItems: analysis.totalComplimentaryItems,
      totalComplimentaryAmount: analysis.totalComplimentaryAmount,
      // Payment Totals (by amount)
      cashPayments: analysis.cashPayments,
      cardPayments: analysis.cardPayments,
      mobilePayments: analysis.mobilePayments,
      bankPayments: analysis.bankPayments,
      // Counts and Sales Breakdowns
      orderTypeCounts: analysis.orderTypeCounts,
      salesByOrderType: analysis.salesByOrderType,
      deliveryProviderCounts: analysis.deliveryProviderCounts,
      salesByDeliveryProvider: analysis.salesByDeliveryProvider,
      paymentMethodCounts: analysis.paymentMethodCounts,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred while processing your request.", error: err.message });
  }
}



export async function getPendingByBranch(req, res) {
  // Extract branch from URL parameters
  const { branch } = req.params;
  
  // Extract filter and pagination criteria from query parameters
  const { searchTerm, orderType, deliveryProvider, paymentMethod } = req.query;
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
  const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
  const skip = (page - 1) * limit;

  try {
    const startOfToday = moment().startOf('day').toDate();
    const endOfToday = moment().endOf('day').toDate();

    const query = {
      branch: branch,
      orderStatus: { $ne: 'completed' },
      dateTime: { $gte: startOfToday, $lte: endOfToday }
    };

    // --- Dynamically build the filter query (same as before) ---
    if (orderType) {
      query.orderType = orderType;
    }
    if (deliveryProvider) {
      query.deliveryProvider = deliveryProvider;
    }
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i');
      query.$or = [
        { invoiceSerial: regex },
        { customerName: regex },
        { customerMobile: regex },
        { tableName: regex },
        { loginUserName: regex }
      ];
    }

    // --- Execute two queries in parallel: one for the total count and one for the paged data ---
    const [invoices, totalCount] = await Promise.all([
        // Query 1: Find invoices for the current page
        Invoice.find(query)
            .sort({ dateTime: -1 })
            .skip(skip)
            .limit(limit),
        
        // Query 2: Get the total count of documents matching the filter
        Invoice.countDocuments(query)
    ]);
    
    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    // --- Send the paged data along with pagination metadata ---
    res.status(200).json({
        invoices,
        totalPages,
        currentPage: page,
        totalCount
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getItemByBranch(req, res) {
  const branch = req.params.branch;
  try {
    // Fetch all invoices for the branch
    const invoices = await Invoice.find({ branch });

    // Filter invoices by today's date
    const todaysDate = moment().format('YYYY-MM-DD');
    const todaysInvoices = invoices.filter(invoice => 
      moment(invoice.dateTime).format('YYYY-MM-DD') === todaysDate
    );


   

    // Aggregate product names and quantities
    const productMap = new Map();

    todaysInvoices.forEach(invoice => {
      invoice.products.forEach(product => {
        if (productMap.has(product.productName)) {
          productMap.set(product.productName, productMap.get(product.productName) + product.qty);
        } else {
          productMap.set(product.productName, product.qty);
        }
      });
    });

    // Prepare the result as an array of unique products with quantities
    const productsList = Array.from(productMap, ([productName, qty]) => ({
      productName,
      qty
    }));

    res.status(200).json(productsList);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}



export async function getDashboardByBranch(req, res) {
  const branch = req.params.branch;
  try {
    // Fetch all invoices for the branch
    const invoices = await Invoice.find({ branch });

    // Get this month's name, today's date, and yesterday's date
    const thisMonthName = moment().format('MMMM');
    const todaysDate = moment().format('YYYY-MM-DD');
    const yesterdaysDate = moment().subtract(1, 'days').format('YYYY-MM-DD');

    // Initialize data for daily sales and totals
    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('month');
    const dailySales = {};
    let currentDay = startOfMonth.clone();

    while (currentDay.isSameOrBefore(endOfMonth)) {
      const day = currentDay.format('YYYY-MM-DD');
      dailySales[day] = { totalSale: 0, totalItems: 0 };
      currentDay.add(1, 'day');
    }

    let todaysTotalSale = 0;
    let yesterdaysTotalSale = 0;
    let todaysTotalItems = 0;

    // Process invoices
    invoices.forEach(invoice => {
      const invoiceDate = moment(invoice.dateTime).format('YYYY-MM-DD');

      if (dailySales[invoiceDate]) {
        dailySales[invoiceDate].totalSale += invoice.totalAmount;
        dailySales[invoiceDate].totalItems += invoice.products.reduce((sum, product) => sum + product.qty, 0);
      }

      // Today's sales and total items
      if (invoiceDate === todaysDate) {
        todaysTotalSale += invoice.totalAmount;
        todaysTotalItems += invoice.products.reduce((sum, product) => sum + product.qty, 0);
      }

      // Yesterday's sales
      if (invoiceDate === yesterdaysDate) {
        yesterdaysTotalSale += invoice.totalAmount;
      }
    });
   
    const endOfDay = moment().endOf("day");
    // Get today's pending orders
    const todaysPendingOrders = invoices.filter(invoice => {
      const invoiceDate = moment(invoice.dateTime);
      return (
        invoice.orderStatus === "pending" &&
        invoiceDate.isBetween(todaysDate, endOfDay, null, "[]")
      );
    }).length;

    // Prepare daily sales array for response
    const dailySalesArray = Object.keys(dailySales).map(date => ({
      date,
      totalSale: dailySales[date].totalSale,
      totalItems: dailySales[date].totalItems
    }));

    // Prepare response
    const response = {
      thisMonthName,
      todaysDate,
      yesterdaysDate,
      dailySales: dailySalesArray,
      todaysTotalSale,
      yesterdaysTotalSale,
      todaysTotalItems,
      todaysPendingOrders,
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}






export async function getInvoiceById(req, res) {
  const id = req.params.id;
  try {
    const result = await Invoice.findById(id);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export const getSalesGroupedByDayName = async (req, res) => {
  try {
    const { branch } = req.params;

    const startOfThisMonth = moment().utc().startOf("month").toDate();
    const endOfThisMonth = moment().utc().endOf("month").toDate();
    const startOfLastMonth = moment().utc().subtract(1, "month").startOf("month").toDate();
    const endOfLastMonth = moment().utc().subtract(1, "month").endOf("month").toDate();

    // Aggregation for current month: top 5 products per day
    const currentMonthData = await Invoice.aggregate([
      {
        $match: {
          branch: branch,
          dateTime: {
            $gte: startOfThisMonth,
            $lte: endOfThisMonth,
          },
        },
      },
      { $unwind: "$products" },
      {
        $addFields: {
          dayName: {
            $let: {
              vars: { dow: { $dayOfWeek: "$dateTime" } },
              in: {
                $arrayElemAt: [
                  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                  { $subtract: ["$$dow", 1] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: {
            dayName: "$dayName",
            productName: "$products.productName",
          },
          totalQty: { $sum: "$products.qty" },
          totalSales: { $sum: "$products.subtotal" },
        },
      },
      {
        $sort: {
          "_id.dayName": 1,
          totalQty: -1,
        },
      },
      {
        $group: {
          _id: "$_id.dayName",
          products: {
            $push: {
              productName: "$_id.productName",
              totalQty: "$totalQty",
              totalSales: "$totalSales",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          dayName: "$_id",
          topProducts: { $slice: ["$products", 5] },
        },
      },
    ]);

    // Aggregation for previous month: all products per day (to match)
    const previousMonthData = await Invoice.aggregate([
      {
        $match: {
          branch: branch,
          dateTime: {
            $gte: startOfLastMonth,
            $lte: endOfLastMonth,
          },
        },
      },
      { $unwind: "$products" },
      {
        $addFields: {
          dayName: {
            $let: {
              vars: { dow: { $dayOfWeek: "$dateTime" } },
              in: {
                $arrayElemAt: [
                  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                  { $subtract: ["$$dow", 1] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: {
            dayName: "$dayName",
            productName: "$products.productName",
          },
          totalQty: { $sum: "$products.qty" },
          totalSales: { $sum: "$products.subtotal" },
        },
      },
    ]);

    // Create lookup map for previous month data
    const previousMap = new Map();
    previousMonthData.forEach((item) => {
      const key = `${item._id.dayName}_${item._id.productName}`;
      previousMap.set(key, {
        totalQty: item.totalQty,
        totalSales: item.totalSales,
      });
    });

    // Merge data & calculate percentage change
    const result = currentMonthData.map((day) => {
      const mergedProducts = day.topProducts.map((product) => {
        const key = `${day.dayName}_${product.productName}`;
        const prev = previousMap.get(key) || { totalQty: 0, totalSales: 0 };

        const qtyChange =
          prev.totalQty === 0
            ? product.totalQty === 0
              ? 0
              : 100
            : ((product.totalQty - prev.totalQty) / prev.totalQty) * 100;

        const salesChange =
          prev.totalSales === 0
            ? product.totalSales === 0
              ? 0
              : 100
            : ((product.totalSales - prev.totalSales) / prev.totalSales) * 100;

        return {
          productName: product.productName,
          currentMonth: {
            totalQty: product.totalQty,
            totalSales: product.totalSales,
          },
          previousMonth: {
            totalQty: prev.totalQty,
            totalSales: prev.totalSales,
          },
          percentageChange: {
            qtyChange: qtyChange.toFixed(2), // percentage change in quantity
            salesChange: salesChange.toFixed(2), // percentage change in sales
          },
        };
      });

      return {
        dayName: day.dayName,
        topProducts: mergedProducts,
      };
    });

    res.status(200).json({
      monthName: moment().utc().format("MMMM"),
      year: moment().utc().year(),
      data: result,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};