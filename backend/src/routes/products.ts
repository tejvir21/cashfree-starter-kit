// @ts-nocheck
import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { productQuerySchema, productCreateSchema, productUpdateSchema, productParamsSchema, } from '../validators/product.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateQuery, validateBody, validateParams } from '../middleware/validation.js';
const router = Router();
// Public catalog
router.get('/', validateQuery(productQuerySchema), productController.listProducts);
router.get('/:id', validateParams(productParamsSchema), productController.getProduct);
// Admin only - protected
router.post('/', authenticate, requireRole('ADMIN'), csrfProtection, validateBody(productCreateSchema), productController.createProduct);
router.patch('/:id', authenticate, requireRole('ADMIN'), csrfProtection, validateParams(productParamsSchema), validateBody(productUpdateSchema), productController.updateProduct);
router.post('/:id/deactivate', authenticate, requireRole('ADMIN'), csrfProtection, validateParams(productParamsSchema), productController.deactivateProduct);
router.post('/:id/activate', authenticate, requireRole('ADMIN'), csrfProtection, validateParams(productParamsSchema), productController.activateProduct);
export default router;

