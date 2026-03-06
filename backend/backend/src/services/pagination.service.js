/**
 * Pagination service for consistent pagination across the application
 */

class PaginationService {
  constructor() {
    this.defaultLimit = parseInt(process.env.DEFAULT_PAGE_SIZE) || 20;
    this.maxLimit = parseInt(process.env.MAX_PAGE_SIZE) || 100;
  }

  // Parse pagination parameters from request
  parsePaginationParams(req) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      this.maxLimit,
      Math.max(1, parseInt(req.query.limit) || this.defaultLimit)
    );
    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
      offset: skip // Alias for skip
    };
  }

  // Parse sorting parameters
  parseSortParams(req, defaultSort = { createdAt: -1 }) {
    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    if (!sortBy) {
      return defaultSort;
    }

    // Validate sort field (basic security check)
    const allowedSortFields = [
      'createdAt', 'updatedAt', 'name', 'email', 'status', 
      'type', 'size', 'duration', 'order', 'priority'
    ];

    if (!allowedSortFields.includes(sortBy)) {
      return defaultSort;
    }

    return { [sortBy]: sortOrder };
  }

  // Parse search parameters
  parseSearchParams(req) {
    const search = req.query.search?.trim();
    const searchFields = req.query.searchFields?.split(',') || [];

    return {
      search,
      searchFields: searchFields.filter(field => field.trim())
    };
  }

  // Parse filter parameters
  parseFilterParams(req) {
    const filters = {};
    
    // Common filters
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.type) {
      filters.type = req.query.type;
    }
    
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.createdAfter) {
      filters.createdAt = { ...filters.createdAt, $gte: new Date(req.query.createdAfter) };
    }
    
    if (req.query.createdBefore) {
      filters.createdAt = { ...filters.createdAt, $lte: new Date(req.query.createdBefore) };
    }
    
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map(tag => tag.trim());
      filters.tags = { $in: tags };
    }

    return filters;
  }

  // Build MongoDB aggregation pipeline for pagination
  buildAggregationPipeline(options = {}) {
    const {
      match = {},
      lookup = [],
      project = null,
      sort = { createdAt: -1 },
      page = 1,
      limit = this.defaultLimit,
      search = null,
      searchFields = []
    } = options;

    const pipeline = [];

    // Add search stage if provided
    if (search && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
      
      pipeline.push({
        $match: {
          $and: [
            match,
            { $or: searchConditions }
          ]
        }
      });
    } else {
      pipeline.push({ $match: match });
    }

    // Add lookup stages
    lookup.forEach(lookupStage => {
      pipeline.push({ $lookup: lookupStage });
    });

    // Add project stage if provided
    if (project) {
      pipeline.push({ $project: project });
    }

    // Add sort stage
    pipeline.push({ $sort: sort });

    // Add pagination stages
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    return pipeline;
  }

  // Build count pipeline for total records
  buildCountPipeline(options = {}) {
    const {
      match = {},
      search = null,
      searchFields = []
    } = options;

    const pipeline = [];

    // Add search stage if provided
    if (search && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
      
      pipeline.push({
        $match: {
          $and: [
            match,
            { $or: searchConditions }
          ]
        }
      });
    } else {
      pipeline.push({ $match: match });
    }

    pipeline.push({ $count: 'total' });

    return pipeline;
  }

  // Execute paginated query with Prisma
  async executePaginatedQuery(model, options = {}) {
    const {
      where = {},
      include = {},
      select = null,
      orderBy = { createdAt: 'desc' },
      page = 1,
      limit = this.defaultLimit
    } = options;

    const skip = (page - 1) * limit;

    // Execute count and data queries in parallel
    const [total, data] = await Promise.all([
      model.count({ where }),
      model.findMany({
        where,
        include,
        select,
        orderBy,
        skip,
        take: limit
      })
    ]);

    return this.formatPaginatedResponse(data, total, page, limit);
  }

  // Format paginated response
  formatPaginatedResponse(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    };
  }

  // Build search query for text search
  buildSearchQuery(search, searchFields) {
    if (!search || !searchFields.length) {
      return {};
    }

    const searchConditions = searchFields.map(field => ({
      [field]: {
        contains: search,
        mode: 'insensitive'
      }
    }));

    return {
      OR: searchConditions
    };
  }

  // Build date range filter
  buildDateRangeFilter(startDate, endDate, field = 'createdAt') {
    const filter = {};
    
    if (startDate) {
      filter[field] = { ...filter[field], gte: new Date(startDate) };
    }
    
    if (endDate) {
      filter[field] = { ...filter[field], lte: new Date(endDate) };
    }
    
    return Object.keys(filter).length > 0 ? filter : {};
  }

  // Validate pagination parameters
  validatePaginationParams(page, limit) {
    const errors = [];
    
    if (page < 1) {
      errors.push('Page must be greater than 0');
    }
    
    if (limit < 1) {
      errors.push('Limit must be greater than 0');
    }
    
    if (limit > this.maxLimit) {
      errors.push(`Limit cannot exceed ${this.maxLimit}`);
    }
    
    return errors;
  }

  // Generate pagination links
  generatePaginationLinks(baseUrl, currentPage, totalPages, limit) {
    const links = {
      self: `${baseUrl}?page=${currentPage}&limit=${limit}`,
      first: `${baseUrl}?page=1&limit=${limit}`,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`
    };

    if (currentPage > 1) {
      links.prev = `${baseUrl}?page=${currentPage - 1}&limit=${limit}`;
    }

    if (currentPage < totalPages) {
      links.next = `${baseUrl}?page=${currentPage + 1}&limit=${limit}`;
    }

    return links;
  }

  // Cursor-based pagination for real-time data
  buildCursorPagination(options = {}) {
    const {
      cursor = null,
      limit = this.defaultLimit,
      cursorField = 'id',
      direction = 'forward' // 'forward' or 'backward'
    } = options;

    const query = {};
    
    if (cursor) {
      if (direction === 'forward') {
        query[cursorField] = { gt: cursor };
      } else {
        query[cursorField] = { lt: cursor };
      }
    }

    return {
      where: query,
      take: limit + 1, // Take one extra to check if there's a next page
      orderBy: { [cursorField]: direction === 'forward' ? 'asc' : 'desc' }
    };
  }

  // Format cursor-based response
  formatCursorResponse(data, limit, cursorField = 'id') {
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    
    const response = {
      data: items,
      hasMore,
      cursor: null
    };

    if (items.length > 0) {
      response.cursor = items[items.length - 1][cursorField];
    }

    return response;
  }
}

module.exports = new PaginationService();