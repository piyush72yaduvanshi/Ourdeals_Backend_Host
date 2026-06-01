class ApiResponse {
  constructor(success, message, data = null, errors = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.errors = errors;
  }

  static success(message, data) {
    return new ApiResponse(true, message, data);
  }

  static error(message, errors) {
    return new ApiResponse(false, message, null, errors);
  }
}

const successResponse = (message, data = null) => {
  return {
    success: true,
    message,
    data,
  };
};

const errorResponse = (message, errors = null) => {
  return {
    success: false,
    message,
    errors,
  };
};

const paginatedResponse = (message, data, page, limit, total) => {
  return {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

export { ApiResponse, successResponse, errorResponse, paginatedResponse };
