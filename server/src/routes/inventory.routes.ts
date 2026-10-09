import { Router } from 'express';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  recordMovements,
  recordCount,
  listMovements,
} from '../controllers/inventory.controller';
import { staffOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(...staffOnly);

router.get('/items', listItems);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);
router.get('/movements', listMovements);
router.post('/movements', recordMovements);
router.post('/counts', recordCount);

export default router;
