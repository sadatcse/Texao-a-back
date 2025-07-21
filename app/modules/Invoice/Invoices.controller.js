import Invoice from "./Invoices.model.js";
import moment from 'moment';
import Product from "../Product/Product.model.js";
// Get all invoices
export async function getAllInvoices(req, res) {
  try {
    const result = await Invoice.find();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

export async function getSalesByDateRange(req, res) {
  const { branch } = req.params;
  const { category, product, startDate, endDate } = req.query;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    let invoices;

    if (startDate === endDate) {
      // Fetch all branch orders for the specific day
      const branchOrders = await Invoice.find({ branch });
      const todaysDate = startDate;

      invoices = branchOrders.filter(invoice =>
        moment(invoice.dateTime).format("YYYY-MM-DD") === todaysDate
      );
    } else {
      // Fetch invoices within the date range
      invoices = await Invoice.find({
        branch,
        dateTime: {
          $gte: startDate,
          $lte: endDate,
        },
      });
    }

    // If no invoices are found, return an empty array
    if (!invoices || invoices.length === 0) {
      return res.status(200).json([]);
    }

    // Process invoices to filter and calculate product data
    let filteredProducts = [];

    invoices.forEach(invoice => {
      invoice.products.forEach(prod => {
        if (product === "All" || prod.productName === product) {
          const existingProduct = filteredProducts.find(p => p.productName === prod.productName);

          if (existingProduct) {
            existingProduct.qty += prod.qty;
            existingProduct.rate = prod.rate; // Update rate (assuming rates may change)
          } else {
            filteredProducts.push({
              productName: prod.productName,
              qty: prod.qty,
              rate: prod.rate,
            });
          }
        }
      });
    });

    if (category !== "All") {
      // Fetch products under the specified category
      const productsInCategory = await Product.find({ category });
      const productNamesInCategory = productsInCategory.map(p => p.productName);

      filteredProducts = filteredProducts.filter(prod =>
        productNamesInCategory.includes(prod.productName)
      );
    }

    const responseData = filteredProducts;

    res.status(200).json(responseData);
  } catch (err) {
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

    let invoices;

    if (startDate === endDate) {
      // Fetch all branch orders
      const branchOrders = await Invoice.find({ branch });
      const todaysDate = moment(startDate).format("YYYY-MM-DD");

      invoices = branchOrders.filter(invoice =>
        moment(invoice.dateTime).format("YYYY-MM-DD") === todaysDate
      );
    } else {
      // Fetch invoices within the date range
      invoices = await Invoice.find({
        branch,
        dateTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
    }

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
        };
      }

      // Safely calculate the values, defaulting to 0 if null or undefined
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
    // Fetch all invoices for the branch
    const branchOrders = await Invoice.find({ branch });

    // Filter invoices by the given date
    const todaysDate = date; // Assuming `date` is in 'YYYY-MM-DD' format
    const todaysInvoices = branchOrders.filter(invoice =>
      moment(invoice.dateTime).format('YYYY-MM-DD') === todaysDate
    );

    // If no orders found, return totals as 0
    if (todaysInvoices.length === 0) {
      return res.status(200).json({
        orders: [],
        totalOrders: 0,
        totalQty: 0,
        totalAmount: 0,
      });
    }

    // Calculate total quantities and amounts
    const totalQty = todaysInvoices.reduce((sum, order) => {
      return sum + order.products.reduce((qtySum, product) => qtySum + product.qty, 0);
    }, 0);

    const totalAmount = todaysInvoices.reduce((sum, order) => sum + order.totalAmount, 0);

    // Send the response
    res.status(200).json({
      orders: todaysInvoices,
      totalOrders: todaysInvoices.length,
      totalQty,
      totalAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred while processing your request.", error: err.message });
  }
}


export async function getPendingByBranch(req, res) {
  const { branch, status } = req.params; 

  try {
   
    const invoices = await Invoice.find({ branch });

  
    const todaysDate = moment().format('YYYY-MM-DD');
    const todaysInvoices = invoices.filter(invoice =>
      moment(invoice.dateTime).format('YYYY-MM-DD') === todaysDate
    );

 
    const filteredInvoices = todaysInvoices.filter(invoice => invoice.orderStatus === status);

    res.status(200).json(filteredInvoices);
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



// Get invoice by ID
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

// Create a new invoice
export async function createInvoice(req, res) {
  try {
    const invoiceData = req.body;
    const result = await Invoice.create(invoiceData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Remove an invoice by ID
export async function removeInvoice(req, res) {
  const id = req.params.id;
  try {
    const result = await Invoice.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: "Invoice deleted successfully" });
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Update an invoice by ID
export async function updateInvoice(req, res) {
  const id = req.params.id;
  const invoiceData = req.body;
  try {
    const result = await Invoice.findByIdAndUpdate(id, invoiceData, {
      new: true,
    });
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