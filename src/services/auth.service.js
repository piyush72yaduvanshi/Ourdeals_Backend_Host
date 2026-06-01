import { User } from "../models/User.model.js";
import { Doctor } from "../models/Doctor.model.js";
import { Nurse } from "../models/Nurse.model.js";
import { Ambulance } from "../models/Ambulance.model.js";
import { Pharmacist } from "../models/Pharmacist.model.js";
import { BloodBank } from "../models/BloodBank.model.js";
import { Pathology } from "../models/Pathology.model.js";
import { tokenService } from "./token.service.js";
import { logger } from "../utils/logger.util.js";
import { UserRole, UserStatus } from "../types/index.js";
import { validatePassword } from "../utils/password.util.js";

const register = async (userData) => {
  try {
    const { email, password, role, ...otherData } = userData;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Enforce password complexity validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Set status based on role - non-patients need admin approval
    const status = (role === UserRole.PATIENT || role === UserRole.ADMIN) 
      ? UserStatus.ACTIVE 
      : UserStatus.PENDING;

    const baseData = {
      email,
      password,
      role,
      status,
      ...otherData,
      tokenVersion: 0,
      refreshTokens: [],
    };

    let user;

    switch (role) {
      case UserRole.DOCTOR:
        user = await Doctor.create(baseData);
        break;
      case UserRole.NURSE:
        // Nurses always have in-person consultation type
        baseData.consultationTypes = ['in-person'];
        user = await Nurse.create(baseData);
        break;
      case UserRole.AMBULANCE:
        user = await Ambulance.create(baseData);
        break;
      case UserRole.PHARMACIST:
        user = await Pharmacist.create(baseData);
        break;
      case UserRole.BLOOD_BANK:
        user = await BloodBank.create(baseData);
        break;
      case UserRole.PATHOLOGY:
        user = await Pathology.create(baseData);
        break;
      default:
        user = await User.create(baseData);
    }

    const { accessToken, refreshToken } = tokenService.generateTokenPair(user);

    user.refreshTokens.push(refreshToken);
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshTokens;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;

    logger.info("User registered", { userId: user._id, email, role });

    return { user: userObj, accessToken, refreshToken };
  } catch (error) {
    logger.error("Registration failed", { error: error.message });
    throw error;
  }
};

const login = async (phone, password, platform = "web") => {
  try {
    // Trim and validate phone input
    const trimmedPhone = phone?.trim();
    if (!trimmedPhone) {
      throw new Error("Phone number is required");
    }

    if (!password) {
      throw new Error("Password is required");
    }

    const user = await User.findOne({ phone: trimmedPhone }).select(
      "+password +refreshTokens",
    );

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Don't trim password - bcrypt needs exact match
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      throw new Error("Invalid credentials");
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new Error("Account is blocked. Contact support.");
    }

    // Check if non-patient/admin users are approved
    // if (user.role !== UserRole.PATIENT && user.role !== UserRole.ADMIN && user.status !== UserStatus.APPROVED) {
    //   throw new Error("Account pending approval from admin");
    // }

    const { accessToken, refreshToken } = tokenService.generateTokenPair(user);

    user.refreshTokens.push(refreshToken);

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshTokens;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;

    logger.info("User logged in", {
      userId: user._id,
      phone,
      platform,
      activeTokens: user.refreshTokens.length,
    });

    return { user: userObj, accessToken, refreshToken, platform };
  } catch (error) {
    logger.error("Login failed", { error: error.message });
    throw error;
  }
};

const refreshTokens = async (oldRefreshToken, platform = "web") => {
  try {
    const decoded = tokenService.verifyRefreshToken(oldRefreshToken);

    const user = await User.findById(decoded.userId).select("+refreshTokens");

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new Error("Account is blocked");
    }

    if (
      !tokenService.validateTokenVersion(
        decoded.tokenVersion,
        user.tokenVersion,
      )
    ) {
      tokenService.clearAllRefreshTokens(user);
      await user.save();
      throw new Error("Token version mismatch. Please login again.");
    }

    if (!tokenService.isRefreshTokenValid(user, oldRefreshToken)) {
      throw new Error("Invalid refresh token. Please login again.");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      tokenService.generateTokenPair(user);

    tokenService.rotateRefreshToken(user, oldRefreshToken, newRefreshToken);
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshTokens;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;

    logger.info("Tokens refreshed", {
      userId: user._id,
      platform,
      activeTokens: user.refreshTokens.length,
    });

    return {
      user: userObj,
      accessToken,
      refreshToken: newRefreshToken,
      platform,
    };
  } catch (error) {
    logger.error("Token refresh failed", { error: error.message });
    throw error;
  }
};

const logout = async (userId, refreshToken) => {
  try {
    const user = await User.findById(userId).select("+refreshTokens");

    if (!user) {
      throw new Error("User not found");
    }

    if (refreshToken) {
      tokenService.removeRefreshToken(user, refreshToken);
      await user.save();
    }

    logger.info("User logged out", {
      userId,
      activeTokens: user.refreshTokens.length,
    });

    return { success: true };
  } catch (error) {
    logger.error("Logout failed", { error: error.message });
    throw error;
  }
};

const logoutAllDevices = async (userId) => {
  try {
    const user = await User.findById(userId).select("+refreshTokens");

    if (!user) {
      throw new Error("User not found");
    }

    tokenService.clearAllRefreshTokens(user);

    user.deviceTokens = [];

    tokenService.incrementTokenVersion(user);

    await user.save();

    logger.info("User logged out from all devices", {
      userId,
      newTokenVersion: user.tokenVersion,
    });

    return { success: true };
  } catch (error) {
    logger.error("Logout all devices failed", { error: error.message });
    throw error;
  }
};

const forgotPassword = async (email) => {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("If email exists, reset link will be sent");
    }

    const resetToken = tokenService.generateResetToken({
      userId: user._id,
      email: user.email,
    });

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    logger.info("Password reset requested", { userId: user._id, email });
    return { resetToken, email };
  } catch (error) {
    logger.error("Forgot password failed", { error: error.message });
    throw error;
  }
};

const resetPassword = async (resetToken, newPassword) => {
  try {
    const decoded = tokenService.verifyResetToken(resetToken);

    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpire +refreshTokens");

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    // Enforce password complexity validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    user.password = newPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    tokenService.clearAllRefreshTokens(user);

    tokenService.incrementTokenVersion(user);

    await user.save();

    logger.info("Password reset successful", {
      userId: user._id,
      newTokenVersion: user.tokenVersion,
    });

    return { success: true };
  } catch (error) {
    logger.error("Password reset failed", { error: error.message });
    throw error;
  }
};

const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    const user = await User.findById(userId).select("+password +refreshTokens");

    if (!user) {
      throw new Error("User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      throw new Error("Current password is incorrect");
    }

    // Enforce password complexity validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    user.password = newPassword;

    tokenService.clearAllRefreshTokens(user);
    tokenService.incrementTokenVersion(user);

    await user.save();

    logger.info("Password changed", {
      userId,
      newTokenVersion: user.tokenVersion,
    });

    return { success: true };
  } catch (error) {
    logger.error("Change password failed", { error: error.message });
    throw error;
  }
};

export const authService = {
  register,
  login,
  refreshTokens,
  logout,
  logoutAllDevices,
  forgotPassword,
  resetPassword,
  changePassword,
};
