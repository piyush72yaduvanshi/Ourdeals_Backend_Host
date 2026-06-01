import { logger } from "../utils/logger.util.js";
import { errorResponse } from "../utils/response.util.js";

class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (error, req, res, next) => {

  if (error instanceof ApiError) {
    logger.error(`API Error: ${error.message}`, {
      statusCode: error.statusCode,
      errors: error.errors,
      path: req.path,
    });

    return res
      .status(error.statusCode)
      .json(errorResponse(error.message, error.errors));
  }

  if (error.name === "ValidationError") {
    logger.error(`Validation Error: ${error.message}`);

    return res
      .status(400)
      .json(errorResponse("Validation error", error.message));
  }


  if (error.name === "MongoServerError" && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];

    logger.error(`Duplicate key error`, {
      field,
      path: req.path,
    });

    return res.status(409).json(errorResponse(`${field} already exists`));
  }

  if (error.name === "JsonWebTokenError") {
    logger.error("JWT Error: Invalid token");

    return res.status(401).json(errorResponse("Invalid token"));
  }


  if (error.name === "TokenExpiredError") {
    logger.error("JWT Error: Token expired");

    return res.status(401).json(errorResponse("Token expired"));
  }

  logger.error("Unhandled Error", {
    message: error.message,
    stack: error.stack,
    path: req.path,
  });

  return res.status(500).json(errorResponse("Internal server error"));
};

const notFoundHandler = (req, res) => {
  return res
    .status(404)
    .json(errorResponse(`Route ${req.originalUrl} not found`));
};

export { ApiError, errorHandler, notFoundHandler };
