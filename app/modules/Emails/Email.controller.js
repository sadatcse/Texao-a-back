import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import Company from '../Company/Companys.model.js';
import { sendEmail } from '../../../services/emailService.js';
// Updated to import the new report functions
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport
} from '../../../services/reportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sendManualReport = async (req, res) => {
  try {
    const { branch, period } = req.body; // 'period' can be 'daily', 'weekly', or 'monthly'

    if (!branch || !period) {
      return res.status(400).json({ message: "Both 'branch' and 'period' are required." });
    }

    const company = await Company.findOne({ branch });
    if (!company || !company.ownerEmail) {
      return res.status(404).json({ message: `No company or owner email for branch: ${branch}` });
    }

    let reportData;
    let reportGenerator;

    // Choose the correct report function based on the 'period'
    switch (period.toLowerCase()) {
      case 'daily':
        reportGenerator = generateDailyReport;
        break;
      case 'weekly':
        reportGenerator = generateWeeklyReport;
        break;
      case 'monthly':
        reportGenerator = generateMonthlyReport;
        break;
      default:
        return res.status(400).json({ message: "Invalid period. Use 'daily', 'weekly', or 'monthly'." });
    }
    
    console.log(`[Manual Send] Generating ${period} report for ${branch}...`);
    reportData = await reportGenerator(branch);

    if (!reportData) {
      return res.status(200).json({ message: `No sales data for this period for ${branch}. Email not sent.` });
    }

    // Use the new, more detailed template
    const templatePath = path.join(__dirname, 'templates', 'summaryReport.ejs');
    const htmlContent = await ejs.renderFile(templatePath, reportData);
    const recipients = company.ownerEmail.split(',').map(email => email.trim());

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient,
        // The subject is now dynamic
        subject: `[Manual] ${reportData.reportTitle} for ${branch}`,
        html: htmlContent,
      });
    }
    res.status(200).json({ message: `Manual ${period} report for ${branch} sent to: ${recipients.join(', ')}` });

  } catch (error) {
    console.error("❌ Failed to send manual sales report:", error);
    res.status(500).json({ message: "Failed to send manual report.", error: error.message });
  }
};