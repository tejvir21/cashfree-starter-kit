// @ts-nocheck
import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { orderQuerySchema, orderCreateSchema, orderParamsSchema, orderCancelSchema, orderTimelineQuerySchema, } from '../validators/order';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { validateQuery, validateBody, validateParams } from '../middleware/validation';
const router = Router();
// Create order (authenticated or guest)
router.post('/', optionalAuthenticate, csrfProtection, validateBody(orderCreateSchema), orderController.createOrder);
// List orders (customer sees own; admin sees all)
router.get('/', authenticate, validateQuery(orderQuerySchema), orderController.listOrders);
// Get order by order number (authenticated owner, admin, or guest token)
router.get('/:orderId', optionalAuthenticate, validateParams(orderParamsSchema), orderController.getOrder);
// Cancel order (owner or admin)
router.post('/:orderId/cancel', authenticate, csrfProtection, validateParams(orderParamsSchema), validateBody(orderCancelSchema), orderController.cancelOrder);
// Order timeline
router.get('/:orderId/timeline', authenticate, validateParams(orderParamsSchema), validateQuery(orderTimelineQuerySchema), orderController.getOrderTimeline);
export default router;

