import { authService } from '../services/auth.service.js';
import { s3Service } from '../services/s3.service.js';
import { User } from '../models/User.model.js';
import { validatePassword } from '../utils/password.util.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';

const getPlatform = (req) => {
  const platform = req.headers['x-platform'];
  return platform === 'mobile' ? 'mobile' : 'web';
};
const setRefreshToken = (res, refreshToken, platform) => {
  if (platform === 'web') {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};

const getRefreshToken = (req, platform) => {
  if (platform === 'web') {
    return req.cookies?.refreshToken;
  }
  return req.body.refreshToken;
};

const clearRefreshToken = (res) => {
  res.clearCookie('refreshToken');
};

const register = async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const platform = getPlatform(req);

    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json(errorResponse(validation.message));
    }

    // Handle file uploads
    let profilePicture = '';
    let documents = {};

    try {
      // Handle profile picture
      if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
        profilePicture = await s3Service.uploadFile(
          req.files.profilePicture[0], 
          'profile-pictures', 
          'temp-' + Date.now()
        );
      }

      // Handle documents (for vendors/providers)
      if (req.files) {
        const documentFiles = { ...req.files };
        delete documentFiles.profilePicture; // Remove profile picture from documents
        
        if (Object.keys(documentFiles).length > 0) {
          documents = await s3Service.uploadDocuments(documentFiles, 'temp-' + Date.now());
        }
      }
    } catch (uploadError) {
      logger.error('File upload failed during registration', { error: uploadError.message });
      return res.status(400).json(errorResponse('File upload failed: ' + uploadError.message));
    }

    const { user, accessToken, refreshToken } = await authService.register({
      ...userData,
      password,
      profilePicture,
      documents,
    });

    // The files are already safely stored in S3/locally under unique temporary folders.
    // No need to rename them to user._id as it breaks S3 URLs and causes broken links.

    setRefreshToken(res, refreshToken, platform);

    const response = {
      user,
      accessToken,
    };

    if (platform === 'mobile') {
      response.refreshToken = refreshToken;
    }

    return res.status(201).json(
      successResponse('Registration successful', response)
    );
  } catch (error) {
    logger.error('Register endpoint failed', { error: error.message });

    if (error.code === 11000) {
      return res.status(409).json(errorResponse('Email or phone already exists'));
    }

    return res.status(400).json(errorResponse(error.message));
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const platform = getPlatform(req);

    if (!phone || !password) {
      return res.status(400).json(errorResponse('Phone and password required'));
    }


    const { user, accessToken, refreshToken } = await authService.login(
      phone,
      password,
      platform
    );

    setRefreshToken(res, refreshToken, platform);

   
    const response = {
      user,
      accessToken,
    };


    if (platform === 'mobile') {
      response.refreshToken = refreshToken;
    }

    return res.json(successResponse('Login successful', response));
  } catch (error) {
    logger.error('Login endpoint failed', { error: error.message });
    return res.status(401).json(errorResponse(error.message));
  }
};

const refreshToken = async (req, res) => {
  try {
    const platform = getPlatform(req);
    const oldRefreshToken = getRefreshToken(req, platform);

    if (!oldRefreshToken) {
      return res.status(401).json(errorResponse('Refresh token required'));
    }


    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refreshTokens(oldRefreshToken, platform);


    setRefreshToken(res, newRefreshToken, platform);

    const response = {
      user,
      accessToken,
    };

    if (platform === 'mobile') {
      response.refreshToken = newRefreshToken;
    }

    return res.json(successResponse('Tokens refreshed', response));
  } catch (error) {
    logger.error('Refresh token endpoint failed', { error: error.message });

    clearRefreshToken(res);

    return res.status(401).json(errorResponse(error.message));
  }
};
const logout = async (req, res) => {
  try {
    const platform = getPlatform(req);
    const userId = req.user?.userId;
    const refreshToken = getRefreshToken(req, platform);

    if (userId) {
    
      await authService.logout(userId, refreshToken);

      const { deviceToken } = req.body;
      if (deviceToken) {
        const user = await User.findById(userId);
        if (user && user.deviceTokens) {
          user.deviceTokens = user.deviceTokens.filter(
            (token) => token !== deviceToken
          );
          await user.save();
        }
      }
    }

    clearRefreshToken(res);

    return res.json(
      successResponse('Logged out successfully', {
        message: 'Please remove tokens from client',
      })
    );
  } catch (error) {
    logger.error('Logout endpoint failed', { error: error.message });

  
    clearRefreshToken(res);

    return res.json(successResponse('Logged out'));
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.userId;


    await authService.logoutAllDevices(userId);

    clearRefreshToken(res);

    return res.json(
      successResponse('Logged out from all devices', {
        message: 'All sessions invalidated',
      })
    );
  } catch (error) {
    logger.error('Logout all devices endpoint failed', { error: error.message });
    return res.status(500).json(errorResponse(error.message));
  }
};


const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire -tokenVersion -deviceTokens -razorpayContactId -razorpayFundAccountId');
    
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Generate signed URL for profile picture
    const userObj = user.toObject();
    if (userObj.profilePicture) {
      userObj.profilePictureUrl = await s3Service.getSignedUrl(userObj.profilePicture);
    }

    return res.json(successResponse('User fetched', userObj));
  } catch (error) {
    logger.error('Get current user failed', { error: error.message });
    return res.status(500).json(errorResponse('Failed to fetch user'));
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!oldPassword || !newPassword) {
      return res.status(400).json(
        errorResponse('Old password and new password required')
      );
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json(errorResponse(validation.message));
    }

    await authService.changePassword(userId, oldPassword, newPassword);

  
    clearRefreshToken(res);

    return res.json(
      successResponse('Password changed successfully', {
        message: 'Please login again with new password',
      })
    );
  } catch (error) {
    logger.error('Change password endpoint failed', { error: error.message });
    return res.status(400).json(errorResponse(error.message));
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(errorResponse('Email required'));
    }


    const { resetToken } = await authService.forgotPassword(email);



    return res.json(
      successResponse('Password reset email sent', {
        message: 'Check your email for reset instructions',
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
      })
    );
  } catch (error) {
    logger.error('Forgot password endpoint failed', { error: error.message });

    return res.json(
      successResponse('If email exists, reset link will be sent')
    );
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json(
        errorResponse('Reset token and new password required')
      );
    }


    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json(errorResponse(validation.message));
    }

    await authService.resetPassword(resetToken, newPassword);

    return res.json(
      successResponse('Password reset successful', {
        message: 'Please login with new password',
      })
    );
  } catch (error) {
    logger.error('Reset password endpoint failed', { error: error.message });
    return res.status(400).json(errorResponse(error.message));
  }
};


const updateDeviceToken = async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.json(
        successResponse('No device token provided (web client)')
      );
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    if (!user.deviceTokens.includes(deviceToken)) {
      user.deviceTokens.push(deviceToken);
      await user.save();
    }

    return res.json(successResponse('Device token updated'));
  } catch (error) {
    logger.error('Update device token failed', { error: error.message });
    return res.status(500).json(errorResponse('Failed to update device token'));
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = { ...req.body };

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if exists
      const user = await User.findById(userId);
      if (user.profilePicture) {
        await s3Service.deleteFile(user.profilePicture);
      }
      
      // Upload new profile picture to S3
      updateData.profilePicture = await s3Service.uploadFile(
        req.file, 
        'profile-pictures', 
        userId
      );
    }

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.email;
    delete updateData.role;
    delete updateData.refreshTokens;
    delete updateData.tokenVersion;
    delete updateData.resetPasswordToken;
    delete updateData.resetPasswordExpire;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire -tokenVersion -deviceTokens -razorpayContactId -razorpayFundAccountId');

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Generate signed URL for response
    const userObj = user.toObject();
    if (userObj.profilePicture) {
      userObj.profilePictureUrl = await s3Service.getSignedUrl(userObj.profilePicture);
    }

    return res.json(successResponse('Profile updated successfully', userObj));
  } catch (error) {
    logger.error('Update profile failed', { error: error.message });
    return res.status(500).json(errorResponse('Failed to update profile'));
  }
};

const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Delete from S3/local storage
    if (user.profilePicture) {
      await s3Service.deleteFile(user.profilePicture);
    }

    // Update database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: '' },
      { new: true }
    ).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire -tokenVersion -deviceTokens -razorpayContactId -razorpayFundAccountId');

    return res.json(successResponse('Profile picture deleted successfully', updatedUser));
  } catch (error) {
    logger.error('Delete profile picture failed', { error: error.message });
    return res.status(500).json(errorResponse('Failed to delete profile picture'));
  }
};

export const authController = {
  register,
  login,
  refreshToken,
  logout,
  logoutAllDevices,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
  updateDeviceToken,
  updateProfile,
  deleteProfilePicture,
};
