import { Request, Response } from 'express';
import { SearchService } from './search.service';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions } from '../../common/utils/pagination';

const searchService = new SearchService();

export class SearchController {
    async unifiedSearch(req: Request, res: Response) {
        try {
            const { q } = req.query;
            if (!q) {
                return sendResponse(res, 400, false, 'Search query (q) is required');
            }

            const pagination = getPaginationOptions(req.query);
            const results = await searchService.search(q as string, pagination);

            return sendResponse(res, 200, true, 'Search results fetched', results);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
