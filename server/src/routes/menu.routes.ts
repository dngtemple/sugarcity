import { Router } from 'express';
import { getMenu, getAllMenu, createMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menu.controller';
import { staffOnly } from '../middleware/auth.middleware';
import { menuUpload } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getMenu);
router.get('/all', ...staffOnly, getAllMenu);
router.post('/', ...staffOnly, menuUpload.single('image'), createMenuItem);
router.put('/:id', ...staffOnly, menuUpload.single('image'), updateMenuItem);
router.delete('/:id', ...staffOnly, deleteMenuItem);

export default router;
