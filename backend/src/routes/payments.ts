// @ts-nocheck
import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
const router = Router();
router.post('/create-order', paymentController.createOrder);
router.get('/verify/:orderId', paymentController.verifyOrder);
export default router;

