import { Router } from 'express';
import { listStaff, createStaff, updateStaff } from '../controllers/user.controller';
import { staffOnly } from '../middleware/auth.middleware';

const router = Router();

router.get('/', ...staffOnly, listStaff);
router.post('/', ...staffOnly, createStaff);
router.patch('/:id', ...staffOnly, updateStaff);

export default router;
