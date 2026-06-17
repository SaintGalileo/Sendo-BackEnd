export const getPaginationOptions = (query: any) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const offset = (page - 1) * limit;

    return {
        page,
        limit,
        offset,
    };
};

export const formatPaginatedResponse = (data: any[], totalCount: number, page: number, limit: number) => {
    return {
        items: data,
        meta: {
            totalItems: totalCount,
            itemCount: data.length,
            itemsPerPage: limit,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
        },
    };
};
