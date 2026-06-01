import jwt from "jsonwebtoken";
import { envConfig } from "../config/env.config.js";
import { logger } from "../utils/logger.util.js";

const {
  accessSecret: JWT_ACCESS_SECRET,
  refreshSecret: JWT_REFRESH_SECRET,
  resetSecret: JWT_RESET_SECRET,
} = envConfig.jwt;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const RESET_TOKEN_EXPIRY = "10m";

const generateAccessToken = (payload) => {
  try {
    const { userId, email, role, tokenVersion } = payload;

    return jwt.sign({ userId, email, role, tokenVersion: tokenVersion || 0 }, JWT_ACCESS_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  } catch (error) {
    logger.error("Generate access token failed", { error: error.message });
    throw new Error("Failed to generate access token");
  }
};

const generateRefreshToken = (payload) => {
  try {
    const { userId, email, role, tokenVersion } = payload;

    return jwt.sign({ userId, email, role, tokenVersion }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
  } catch (error) {
    logger.error("Generate refresh token failed", { error: error.message });
    throw new Error("Failed to generate refresh token");
  }
};

const generateResetToken = (payload) => {
  try {
    const { userId, email } = payload;

    return jwt.sign({ userId, email, type: "reset" }, JWT_RESET_SECRET, {
      expiresIn: RESET_TOKEN_EXPIRY,
    });
  } catch (error) {
    logger.error("Generate reset token failed", { error: error.message });
    throw new Error("Failed to generate reset token");
  }
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    throw error;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};

const verifyResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_RESET_SECRET);

    // Additional validation
    if (decoded.type !== "reset") {
      throw new Error("Invalid reset token type");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Reset token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid reset token");
    }
    throw error;
  }
};

const generateTokenPair = (user) => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

const rotateRefreshToken = (user, oldToken, newToken) => {
  try {
    if (oldToken) {
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token !== oldToken,
      );
    }

    if (!user.refreshTokens.includes(newToken)) {
      user.refreshTokens.push(newToken);
    }

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    logger.info("Refresh token rotated", {
      userId: user._id,
      activeTokens: user.refreshTokens.length,
    });
  } catch (error) {
    logger.error("Refresh token rotation failed", { error: error.message });
    throw new Error("Failed to rotate refresh token");
  }
};

const validateTokenVersion = (tokenVersion, userTokenVersion) => {
  return tokenVersion === userTokenVersion;
};

const isRefreshTokenValid = (user, refreshToken) => {
  return user.refreshTokens && user.refreshTokens.includes(refreshToken);
};

const removeRefreshToken = (user, refreshToken) => {
  if (refreshToken && user.refreshTokens) {
    user.refreshTokens = user.refreshTokens.filter(
      (token) => token !== refreshToken,
    );
  }
};

const clearAllRefreshTokens = (user) => {
  user.refreshTokens = [];
  logger.info("All refresh tokens cleared", { userId: user._id });
};

const incrementTokenVersion = (user) => {
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  logger.info("Token version incremented", {
    userId: user._id,
    newVersion: user.tokenVersion,
  });
};

export const tokenService = {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  generateTokenPair,

  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,

  rotateRefreshToken,
  removeRefreshToken,
  clearAllRefreshTokens,
  incrementTokenVersion,

  validateTokenVersion,
  isRefreshTokenValid,

  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  RESET_TOKEN_EXPIRY,
};
