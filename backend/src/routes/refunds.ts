// @ts-nocheck
import { Router } from 'express';
import * as refundController from '../controllers/refund.controller';
import { refundCreateSchema, refundParamsSchema, } from '../validators/payment';
import { orderParamsSchema } from '../validators/order';
import { authenticate, requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { validateParams, validateBody } from '../middleware/validation';
const router = Router();
// Create a refund for an order (admin)
router.post('/orders/:orderId/refunds', authenticate, requireRole('ADMIN'), validateParams(orderParamsSchema), validateBody(refundCreateSchema), csrfProtection, refundController.createRefund);
// List refunds for an order
router.get('/orders/:orderId/refunds', authenticate, validateParams(orderParamsSchema), refundController.listRefundsForOrder);
// Admin: list all refunds
router.get('/', authenticate, requireRole('ADMIN'), refundController.listRefunds);
// Refund detail
router.get('/:refundId', authenticate, validateParams(refundParamsSchema), refundController.getRefundDetail);
// Admin: reconcile a refund
router.post('/:refundId/reconcile', authenticate, requireRole('ADMIN'), validateParams(refundParamsSchema), csrfProtection, refundController.reconcileRefundController);
export default router;

