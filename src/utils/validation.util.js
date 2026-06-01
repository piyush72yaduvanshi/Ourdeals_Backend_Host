import mongoose from "mongoose";
import { errorResponse } from "./response.util.js";

export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateObjectIdParam = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!isValidObjectId(id)) {
      return res.status(400).json(errorResponse(`Invalid ${paramName}`));
    }

    next();
  };
};

export const pick = (object, allowedFields) => {
  const result = {};

  allowedFields.forEach((field) => {
    if (object.hasOwnProperty(field)) {
      result[field] = object[field];
    }
  });

  return result;
};

export const omit = (object, omittedFields) => {
  const result = { ...object };

  omittedFields.forEach((field) => {
    delete result[field];
  });

  return result;
};

export const userUpdateAllowedFields = [
  "firstName",
  "lastName",
  "phone",
  "address",
  "city",
  "state",
  "pincode",
  "profilePicture",
];

export const userForbiddenFields = [
  "role",
  "email",
  "password",
  "status",
  "tokenVersion",
  "refreshTokens",
  "resetPasswordToken",
  "resetPasswordExpire",
];

export const sanitizeUserUpdate = (data) => {
  const hasForbiddenFields = userForbiddenFields.some((field) =>
    data.hasOwnProperty(field),
  );

  if (hasForbiddenFields) {
    throw new Error("Cannot update restricted fields");
  }

  return pick(data, userUpdateAllowedFields);
};
