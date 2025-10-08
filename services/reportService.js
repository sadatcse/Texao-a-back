import moment from 'moment';
import Invoice from '../app/modules/Invoice/Invoices.model.js';
import Company from '../app/modules/Company/Companys.model.js';

// Reusable function to get sales data for any period
const getSalesDataForPeriod = async (branch, startDate, endDate) => {
    const data = await Invoice.aggregate([
        { $match: { branch: branch, dateTime: { $gte: startDate, $lte: endDate } } },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: '$totalAmount' },
                            totalOrders: { $sum: 1 },
                            totalQuantity: { $sum: '$totalQty' }
                        }
                    }
                ],
                topProducts: [
                    { $unwind: '$products' },
                    {
                        $group: {
                            _id: '$products.productName',
                            quantity: { $sum: '$products.qty' },
                            revenue: { $sum: '$products.subtotal' }
                        }
                    },
                    { $sort: { revenue: -1 } },
                    { $limit: 10 },
                    { $project: { _id: 0, name: '$_id', quantity: 1, revenue: 1 } }
                ],
                orderTypeBreakdown: [
                    { $group: { _id: '$orderType', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
                    { $project: { _id: 0, name: '$_id', orders: 1, revenue: 1 } }
                ],
                paymentMethodBreakdown: [
                    {
                        $group: {
                            _id: {
                                $switch: {
                                    branches: [
                                        { case: { $in: ["$paymentMethod", ["Visa Card", "Master Card", "Amex Card", "Card"]] }, then: "Card" },
                                        { case: { $in: ["$paymentMethod", ["Bkash", "Nagad", "Rocket", "Mobile"]] }, then: "Mobile Banking" },
                                    ],
                                    default: "$paymentMethod"
                                }
                            },
                            orders: { $sum: 1 },
                            revenue: { $sum: '$totalAmount' }
                        }
                    },
                    { $project: { _id: 0, name: '$_id', orders: 1, revenue: 1 } }
                ],
                deliveryProviderBreakdown: [
                    { $match: { orderType: 'delivery', deliveryProvider: { $exists: true } } },
                    { $group: { _id: '$deliveryProvider', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
                    { $project: { _id: 0, name: '$_id', orders: 1, revenue: 1 } }
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

// --- MAIN FUNCTION TO GENERATE COMPLETE REPORT DATA ---
const generateSummaryReportData = async (branch, period) => {
    let currentStartDate, currentEndDate, previousStartDate, previousEndDate, reportTitle;

    // Define date ranges based on the period
    if (period === 'weekly') {
        // Week ends on Friday. Starts on the preceding Saturday.
        currentEndDate = moment().day("Friday").endOf('day').toDate();
        currentStartDate = moment().day("Friday").subtract(6, 'days').startOf('day').toDate();
        previousEndDate = moment(currentEndDate).subtract(1, 'week').endOf('day').toDate();
        previousStartDate = moment(currentStartDate).subtract(1, 'week').startOf('day').toDate();
        reportTitle = "Weekly Sales Summary";
    } else if (period === 'monthly') {
        // Report for the *previous* full month
        currentEndDate = moment().subtract(1, 'month').endOf('month').toDate();
        currentStartDate = moment().subtract(1, 'month').startOf('month').toDate();
        previousEndDate = moment().subtract(2, 'months').endOf('month').toDate();
        previousStartDate = moment().subtract(2, 'months').startOf('month').toDate();
        reportTitle = "Monthly Sales Summary";
    } else { // Daily
        currentEndDate = moment().subtract(1, 'day').endOf('day').toDate();
        currentStartDate = moment().subtract(1, 'day').startOf('day').toDate();
        previousEndDate = moment().subtract(2, 'days').endOf('day').toDate();
        previousStartDate = moment().subtract(2, 'days').startOf('day').toDate();
        reportTitle = "Daily Sales Summary";
    }

    const [companyDetails, currentData, previousData] = await Promise.all([
        Company.findOne({ branch }).lean(),
        getSalesDataForPeriod(branch, currentStartDate, currentEndDate),
        getSalesDataForPeriod(branch, previousStartDate, previousEndDate)
    ]);

    if (!currentData) return null; // No sales in the current period.

    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) return { value: current, growth: "N/A" };
        const growth = (((current - previous) / previous) * 100);
        return { value: current, growth: growth.toFixed(2) };
    };
    
    const growth = {
        totalSales: calculateGrowth(currentData.summary.totalSales, previousData?.summary?.totalSales || 0),
        totalOrders: calculateGrowth(currentData.summary.totalOrders, previousData?.summary?.totalOrders || 0),
        totalQuantity: calculateGrowth(currentData.summary.totalQuantity, previousData?.summary?.totalQuantity || 0)
    };

    return {
        reportTitle,
        companyDetails,
        branchName: branch,
        reportDateRange: `${moment(currentStartDate).format('MMMM Do')} - ${moment(currentEndDate).format('MMMM Do, YYYY')}`,
        summary: currentData.summary,
        topProducts: currentData.topProducts,
        orderTypeBreakdown: currentData.orderTypeBreakdown,
        paymentMethodBreakdown: currentData.paymentMethodBreakdown,
        deliveryProviderBreakdown: currentData.deliveryProviderBreakdown,
        growth
    };
};

// Export specific functions for the scheduler to call
export const generateDailyReport = (branch) => generateSummaryReportData(branch, 'daily');
export const generateWeeklyReport = (branch) => generateSummaryReportData(branch, 'weekly');
export const generateMonthlyReport = (branch) => generateSummaryReportData(branch, 'monthly');