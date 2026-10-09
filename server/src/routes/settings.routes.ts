import { Router } from 'express';
import { getStoreSettings, updateStoreSettings } from '../controllers/settings.controller';
import { staffOnly } from '../middleware/auth.middleware';

const router = Router();

router.get('/', ...staffOnly, getStoreSettings);
router.put('/', ...staffOnly, updateStoreSettings);

export default router;
