import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { registerSchema, loginSchema, refreshSchema, } from '../validators/auth';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
const router = Router();
// Public registration (CUSTOMER only; ADMIN via provisioning script)
router.post('/register', validateBody(registerSchema), authController.register);
// Public login
router.post('/login', validateBody(loginSchema), authController.login);
// Logout (requires auth, clears cookies)
router.post('/logout', authenticate, authController.logout);
// Refresh access token using HttpOnly refresh cookie
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
// Current user profile
router.get('/me', authenticate, authController.me);
export default router;
