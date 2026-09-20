import Joi from "joi";
import { errorResponse } from "../utils/response.util.js";

const unflattenObject = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result = {};
  for (const [rawKey, value] of Object.entries(obj)) {
    if (rawKey.includes("[") && rawKey.includes("]")) {
      const parts = rawKey
        .replace(/\]/g, "")
        .split("[")
        .filter(Boolean);
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextIndex = /^\d+$/.test(nextPart);
        if (!current[part]) {
          current[part] = isNextIndex ? [] : {};
        }
        current = current[part];
      }
      const lastPart = parts[parts.length - 1];
      if (Array.isArray(current)) {
        current[parseInt(lastPart, 10)] = value;
      } else {
        current[lastPart] = value;
      }
    } else {
      result[rawKey] = value;
    }
  }

  const cleanArrays = (target) => {
    if (Array.isArray(target)) {
      return target.filter((x) => x !== undefined).map(cleanArrays);
    }
    if (target && typeof target === "object") {
      for (const k of Object.keys(target)) {
        target[k] = cleanArrays(target[k]);
      }
    }
    return target;
  };

  return cleanArrays(result);
};

const validate = (schema) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = unflattenObject(req.body);
    }
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
