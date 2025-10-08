// app/modules/Emails/Email.routes.js
import { Router } from 'express';
import { sendManualReport } from './Email.controller.js';

const emailRoutes = Router();

emailRoutes.post('/send-sales-report', sendManualReport);

export default emailRoutes;