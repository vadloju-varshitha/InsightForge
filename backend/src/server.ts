import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { cleanupStuckReports } from './services/report.worker';

// Load environment variables
dotenv.config();

// Import controllers
import { signup, login, getMe, getCompanyMembers, addCompanyMember } from './controllers/auth.controller';
import {
  getCities,
  getLocalities,
  searchLocalities,
  getDemographicDetails,
  createDemographic,
  updateDemographic,
  deleteDemographic,
} from './controllers/demographics.controller';
import {
  getNearbyCompetitors,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from './controllers/competitors.controller';
import {
  createReport,
  getReports,
  getReportDetails,
  compareLocations,
  getSavedLocations,
  saveLocation,
  unsaveLocation,
  checkLocationAlerts,
} from './controllers/reports.controller';
import {
  createPaymentOrder,
  verifyPayment,
  getTransactionHistory,
} from './controllers/credits.controller';
import {
  getUsers,
  suspendUser,
  manageCredits,
  getAuditLogs,
  getNotificationLogs,
  getAdminAnalytics,
} from './controllers/admin.controller';

// Import middlewares
import { authenticateToken, requireAdmin } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON Parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static uploads
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- API ROUTES ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'InsightForge Backend' });
});

// Authentication Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getMe);
app.get('/api/auth/company/members', authenticateToken, getCompanyMembers);
app.post('/api/auth/company/invite', authenticateToken, addCompanyMember);

// Demographics Routes
app.get('/api/demographics/cities', getCities);
app.get('/api/demographics/localities', getLocalities);
app.get('/api/demographics/search', searchLocalities);
app.get('/api/demographics/details', getDemographicDetails);
app.post('/api/demographics', authenticateToken, requireAdmin, createDemographic);
app.put('/api/demographics/:id', authenticateToken, requireAdmin, updateDemographic);
app.delete('/api/demographics/:id', authenticateToken, requireAdmin, deleteDemographic);

// Competitors Routes
app.get('/api/competitors/nearby', getNearbyCompetitors);
app.post('/api/competitors', authenticateToken, requireAdmin, createCompetitor);
app.put('/api/competitors/:id', authenticateToken, requireAdmin, updateCompetitor);
app.delete('/api/competitors/:id', authenticateToken, requireAdmin, deleteCompetitor);

// Reports Routes
app.post('/api/reports', authenticateToken, createReport);
app.get('/api/reports', authenticateToken, getReports);
app.get('/api/reports/saved', authenticateToken, getSavedLocations);
app.post('/api/reports/saved', authenticateToken, saveLocation);
app.delete('/api/reports/saved/:id', authenticateToken, unsaveLocation);
app.get('/api/reports/alerts/check', authenticateToken, checkLocationAlerts);
app.post('/api/reports/compare', authenticateToken, compareLocations);
app.get('/api/reports/:id', authenticateToken, getReportDetails);

// Credits / Payments Routes
app.post('/api/credits/order', authenticateToken, createPaymentOrder);
app.post('/api/credits/verify', authenticateToken, verifyPayment);
app.get('/api/credits/history', authenticateToken, getTransactionHistory);

// Admin Routes
app.get('/api/admin/users', authenticateToken, requireAdmin, getUsers);
app.post('/api/admin/users/:id/suspend', authenticateToken, requireAdmin, suspendUser);
app.post('/api/admin/credits/adjust', authenticateToken, requireAdmin, manageCredits);
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, getAuditLogs);
app.get('/api/admin/notification-logs', authenticateToken, requireAdmin, getNotificationLogs);
app.get('/api/admin/analytics', authenticateToken, requireAdmin, getAdminAnalytics);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred on the server.' });
});

// Start Server
cleanupStuckReports().then(() => {
  app.listen(PORT, () => {
    console.log(`InsightForge Backend server is listening on port ${PORT}`);
  });
});
