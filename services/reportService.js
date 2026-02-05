import moment from 'moment-timezone';
import Invoice from '../app/modules/Invoice/Invoices.model.js';
import Company from '../app/modules/Company/Companys.model.js';

const getSalesDataForPeriod = async (branch, startDate, endDate) => {

    const data = await Invoice.aggregate([
        {
            $match: {
                branch: branch,
                dateTime: {
                    $gte: moment(startDate).tz("Asia/Dhaka").utc().toDate(),
                    $lte: moment(endDate).tz("Asia/Dhaka").utc().toDate()
                }
            }
        },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: "$totalAmount" },
                            totalOrders: { $sum: 1 },
                            totalQuantity: { $sum: "$totalQty" }
                        }
                    }
                ],
                topProducts: [
                    { $unwind: "$products" },
                    {
                        $group: {
                            _id: "$products.productName",
                            quantity: { $sum: "$products.qty" },
                            revenue: { $sum: "$products.subtotal" }
                        }
                    },
                    { $sort: { revenue: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            _id: 0,
                            name: "$_id",
                            quantity: 1,
                            revenue: 1
                        }
                    }
                ],
                orderTypeBreakdown: [
                    {
                        $group: {
                            _id: "$orderType",
                            orders: { $sum: 1 },
                            revenue: { $sum: "$totalAmount" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            name: "$_id",
                            orders: 1,
                            revenue: 1
                        }
                    }
                ],
                paymentMethodBreakdown: [
                    {
                        $group: {
                            _id: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $in: [
                                                    "$paymentMethod",
                                                    ["Visa Card", "Master Card", "Amex Card", "Card"]
                                                ]
                                            },
                                            then: "Card"
                                        },
                                        {
                                            case: {
                                                $in: [
                                                    "$paymentMethod",
                                                    ["Bkash", "Nagad", "Rocket", "Mobile"]
                                                ]
                                            },
                                            then: "Mobile Banking"
                                        }
                                    ],
                                    default: "$paymentMethod"
                                }
                            },
                            orders: { $sum: 1 },
                            revenue: { $sum: "$totalAmount" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            name: "$_id",
                            orders: 1,
                            revenue: 1
                        }
                    }
                ],
                deliveryProviderBreakdown: [
                    {
                        $match: {
                            orderType: "delivery",
                            deliveryProvider: { $exists: true }
                        }
                    },
                    {
                        $group: {
                            _id: "$deliveryProvider",
                            orders: { $sum: 1 },
                            revenue: { $sum: "$totalAmount" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            name: "$_id",
                            orders: 1,
                            revenue: 1
                        }
                    }
                ]
            }
        }
    ]);

    if (!data[0] || !data[0].summary[0]) {
        return null;
    }

    return {
        summary: data[0].summary[0],
        topProducts: data[0].topProducts,
        orderTypeBreakdown: data[0].orderTypeBreakdown,
        paymentMethodBreakdown: data[0].paymentMethodBreakdown,
        deliveryProviderBreakdown: data[0].deliveryProviderBreakdown,
    };
};


const generateSummaryReportData = async (branch, period) => {

    const now = moment().tz("Asia/Dhaka");

    let currentStartDate, currentEndDate;
    let previousStartDate, previousEndDate;
    let reportTitle;

    // --- FIX START: Logic updated for running at 10 PM ---
    if (period === "daily") {

        // Set range to TODAY (Starts at 00:00 today, ends at 23:59 today)
        currentStartDate = now.clone().startOf("day").toDate();
        currentEndDate = now.clone().endOf("day").toDate();

        // Compare with YESTERDAY
        previousStartDate = now.clone().subtract(1, "day").startOf("day").toDate();
        previousEndDate = now.clone().subtract(1, "day").endOf("day").toDate();

        reportTitle = "Daily Sales Summary";

    } 
    // --- FIX END ---
    else if (period === "weekly") {

        currentEndDate = now.clone().day("Friday").endOf("day").toDate();
        currentStartDate = now.clone().day("Friday").subtract(6, "days").startOf("day").toDate();

        previousEndDate = moment(currentEndDate).subtract(1, "week").endOf("day").toDate();
        previousStartDate = moment(currentStartDate).subtract(1, "week").startOf("day").toDate();

        reportTitle = "Weekly Sales Summary";

    } else if (period === "monthly") {

        currentEndDate = now.clone().subtract(1, "month").endOf("month").toDate();
        currentStartDate = now.clone().subtract(1, "month").startOf("month").toDate();

        previousEndDate = now.clone().subtract(2, "months").endOf("month").toDate();
        previousStartDate = now.clone().subtract(2, "months").startOf("month").toDate();

        reportTitle = "Monthly Sales Summary";
    }

    const [companyDetails, currentData, previousData] = await Promise.all([
        Company.findOne({ branch }).lean(),
        getSalesDataForPeriod(branch, currentStartDate, currentEndDate),
        getSalesDataForPeriod(branch, previousStartDate, previousEndDate)
    ]);

    if (!currentData) return null;

    const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) {
            return { value: current, growth: "N/A" };
        }
        const growth = ((current - previous) / previous) * 100;
        return { value: current, growth: growth.toFixed(2) };
    };

    const growth = {
        totalSales: calculateGrowth(
            currentData.summary.totalSales,
            previousData?.summary?.totalSales || 0
        ),
        totalOrders: calculateGrowth(
            currentData.summary.totalOrders,
            previousData?.summary?.totalOrders || 0
        ),
        totalQuantity: calculateGrowth(
            currentData.summary.totalQuantity,
            previousData?.summary?.totalQuantity || 0
        )
    };

    return {
        reportTitle,
        companyDetails,
        branchName: branch,
        reportDateRange: `${moment(currentStartDate).format("MMMM Do")} - ${moment(
            currentEndDate
        ).format("MMMM Do, YYYY")}`,
        summary: currentData.summary,
        topProducts: currentData.topProducts,
        orderTypeBreakdown: currentData.orderTypeBreakdown,
        paymentMethodBreakdown: currentData.paymentMethodBreakdown,
        deliveryProviderBreakdown: currentData.deliveryProviderBreakdown,
        growth
    };
};

export const generateDailyReport = (branch) =>
    generateSummaryReportData(branch, "daily");

export const generateWeeklyReport = (branch) =>
    generateSummaryReportData(branch, "weekly");

export const generateMonthlyReport = (branch) =>
    generateSummaryReportData(branch, "monthly");