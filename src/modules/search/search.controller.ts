import { Request, Response } from 'express';
import { SearchService } from './search.service';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions } from '../../common/utils/pagination';

const searchService = new SearchService();

export class SearchController {
    async unifiedSearch(req: Request, res: Response) {
        try {
            const { q, lat, lng, state, city, area, country } = req.query;
            if (!q) {
                return sendResponse(res, 400, false, 'Search query (q) is required');
            }

            const pagination = getPaginationOptions(req.query);
            const results = await searchService.search(
                q as string,
                pagination,
                lat as string | undefined,
                lng as string | undefined,
                {
                    state: state as string | undefined,
                    city: city as string | undefined,
                    area: area as string | undefined,
                    country: country as string | undefined,
                },
            );

            return sendResponse(res, 200, true, 'Search results fetched', results);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
