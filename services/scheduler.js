import cron from 'node-cron';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import Company from '../app/modules/Company/Companys.model.js';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport } from './reportService.js';
import { sendEmail } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generic function to process and send reports
const processAndSendReports = async (reportGenerator, templateName, subjectPrefix) => {
    console.log(`[Scheduler] Kicking off ${subjectPrefix} job...`);
    try {
        const companies = await Company.find({ ownerEmail: { $exists: true, $ne: "" } }).select('branch ownerEmail').lean();
        if (companies.length === 0) {
            console.log('[Scheduler] No companies with owner emails found. Skipping job.');
            return;
        }

        for (const company of companies) {
            try {
                const { branch, ownerEmail } = company;
                console.log(`[Scheduler] - Generating ${subjectPrefix} for: ${branch}`);
                const reportData = await reportGenerator(branch);

                if (reportData) {
                    const templatePath = path.join(__dirname, '..', 'app', 'modules', 'Emails', 'templates', templateName);
                    const htmlContent = await ejs.renderFile(templatePath, reportData);
                    const recipients = ownerEmail.split(',').map(email => email.trim());

                    for (const recipient of recipients) {
                        await sendEmail({
                            to: recipient,
                            subject: `${subjectPrefix} for ${branch} - ${reportData.reportDateRange}`,
                            html: htmlContent,
                        });
                    }
                    console.log(`[Scheduler]  ✅ Report for ${branch} sent to ${recipients.join(', ')}.`);
                } else {
                    console.log(`[Scheduler]  - No sales data for ${branch}. Skipping email.`);
                }
            } catch (error) {
                console.error(`[Scheduler] ❌ Failed to process report for ${company.branch}:`, error);
            }
        }
    } catch (error) {
        console.error(`[Scheduler] ❌ Critical error in ${subjectPrefix} job:`, error);
    }
    console.log(`[Scheduler] ${subjectPrefix} job finished.`);
};


export const initScheduledJobs = () => {
    // 1. Daily Report: Runs every day at 1:00 AM
    cron.schedule('0 1 * * *', () => {
        processAndSendReports(generateDailyReport, 'summaryReport.ejs', 'Teaxo POS Daily Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });

    // 2. Weekly Report: Runs every Friday at 2:00 AM
    cron.schedule('0 2 * * 5', () => {
        processAndSendReports(generateWeeklyReport, 'summaryReport.ejs', 'Teaxo POS Weekly Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });
    
    // 3. Monthly Report: Runs on the 1st day of every month at 3:00 AM
    cron.schedule('0 3 1 * *', () => {
        processAndSendReports(generateMonthlyReport, 'summaryReport.ejs', 'Teaxo POS Monthly Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });

  
};

// export const initScheduledJobs = () => {
//     // --- TESTING SCHEDULES ---
//     // These are set to specific times for a one-time test today.
//     // Remember to change them back to the original schedules for production!

//     console.log('✅ Initializing jobs for a one-time TEST run...');
//     console.log('🕒 Daily report will run at 8:30 PM');
//     console.log('🕒 Weekly report will run at 8:31 PM');
//     console.log('🕒 Monthly report will run at 8:32 PM');
    
//     // 1. Test Daily Report: Runs today at 8:30 PM (20:30)
//     // Cron format: <minute> <hour> <day_of_month> <month> <day_of_week>
//     cron.schedule('17 20 6 10 *', () => {
//         processAndSendReports(generateDailyReport, 'summaryReport.ejs', '[TEST] Teaxo POS Daily Summary');
//     }, { scheduled: true, timezone: "Asia/Dhaka" });

//     // 2. Test Weekly Report: Runs today at 8:31 PM (20:31)
//     cron.schedule('18 20 6 10 *', () => {
//         processAndSendReports(generateWeeklyReport, 'summaryReport.ejs', '[TEST] Teaxo POS Weekly Summary');
//     }, { scheduled: true, timezone: "Asia/Dhaka" });
    
//     // 3. Test Monthly Report: Runs today at 8:32 PM (20:32)
//     cron.schedule('19 20 6 10 *', () => {
//         processAndSendReports(generateMonthlyReport, 'summaryReport.ejs', '[TEST] Teaxo POS Monthly Summary');
//     }, { scheduled: true, timezone: "Asia/Dhaka" });

//     console.log('❗ IMPORTANT: Revert to original cron schedules after testing!');
// };