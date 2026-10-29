import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { validateParams, validateQuery } from '../middleware/validation';
import { adminOrderQuerySchema, adminTransactionQuerySchema, adminRefundQuerySchema, reconcileOrderParamsSchema, } from '../validators/admin';
const router = Router();
// All admin routes require authentication + ADMIN role
router.use(authenticate, requireRole('ADMIN'));
// Dashboard
router.get('/dashboard', adminController.getDashboard);
// Order management
router.get('/orders', validateQuery(adminOrderQuerySchema), adminController.listAdminOrders);
router.post('/orders/:orderId/reconcile', validateParams(reconcileOrderParamsSchema), csrfProtection, adminController.reconcileAdminOrder);
router.post('/orders/:orderId/fulfillment', csrfProtection, adminController.updateFulfillment);
router.post('/orders/:orderId/notes', csrfProtection, adminController.addInternalNotes);
// Payment management (transactions)
router.get('/payments', validateQuery(adminTransactionQuerySchema), adminController.listAdminPayments);
// Refund management
router.get('/refunds', validateQuery(adminRefundQuerySchema), adminController.listAdminRefunds);
// Webhook events
router.get('/webhooks', adminController.listWebhookEvents);
// Audit logs
router.get('/audit-logs', adminController.listAuditLogs);
// Settings
router.get('/settings', adminController.getSettings);
router.patch('/settings', csrfProtection, adminController.updateSettings);
export default router;
