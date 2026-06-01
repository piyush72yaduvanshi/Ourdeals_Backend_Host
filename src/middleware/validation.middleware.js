import Joi from "joi";
import { errorResponse } from "../utils/response.util.js";

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json(errorResponse("Validation failed", errors));
    }

    req.body = value;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res
        .status(400)
        .json(errorResponse("Query validation failed", errors));
    }

   
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res
        .status(400)
        .json(errorResponse("Parameter validation failed", errors));
    }

    Object.keys(req.params).forEach((key) => delete req.params[key]);
    Object.assign(req.params, value);
    next();
  };
};

export { validate, validateQuery, validateParams };
