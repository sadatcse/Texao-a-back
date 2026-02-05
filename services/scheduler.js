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
    cron.schedule('58 23 * * *', () => {
        processAndSendReports(generateDailyReport, 'summaryReport.ejs', 'DATA IT RESTAURANT POS Daily Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });

    // 2. Weekly Report: Runs every Friday at 2:00 AM
    cron.schedule('0 2 * * 5', () => {
        processAndSendReports(generateWeeklyReport, 'summaryReport.ejs', 'DATA IT RESTAURANT POS Weekly Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });
    
    // 3. Monthly Report: Runs on the 1st day of every month at 3:00 AM
    cron.schedule('0 3 1 * *', () => {
        processAndSendReports(generateMonthlyReport, 'summaryReport.ejs', 'DATA IT RESTAURANT POS Monthly Summary');
    }, { scheduled: true, timezone: "Asia/Dhaka" });

  
};
