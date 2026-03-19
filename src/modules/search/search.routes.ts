import { Router } from 'express';
import { SearchController } from './search.controller';

const router = Router();
const searchController = new SearchController();

// Discovery search (Public or Authized)
router.get('/', searchController.unifiedSearch);

export default router;
