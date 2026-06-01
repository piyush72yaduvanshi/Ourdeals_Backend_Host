import { User } from '../models/User.model.js';
import { Booking } from '../models/Booking.model.js';
import { RealTimeBooking } from '../models/RealTimeBooking.model.js';
import { Medicine } from '../models/Medicine.model.js';
import { Ambulance } from '../models/Ambulance.model.js';
import { BloodBank } from '../models/BloodBank.model.js';
import { Pathology } from '../models/Pathology.model.js';
import { UserStatus } from '../types/index.js';
import { s3Service } from '../services/s3.service.js';
import {
  successResponse,
  errorResponse,
} from '../utils/response.util.js';


const getDashboard = async (req, res) => {
  try {
    console.log('Fetching dashboard data...');
    
    const [
      totalUsers,
      activeBookings,
      activeRealTimeBookings,
      emergencyCount,
      pendingApprovals,
      todayBookings,
      completedToday,
      revenueStats,
    ] = await Promise.all([
      User.countDocuments(),
      Booking.countDocuments({
        status: {
          $in: [
            'requested',
            'accepted',
            'on_the_way',
            'in_progress',
          ],
        },
      }),
      RealTimeBooking.countDocuments({
        status: {
          $in: ['pending', 'accepted', 'on_the_way', 'in_progress'],
        },
      }),
      RealTimeBooking.countDocuments({
        isEmergency: true,
        status: { $ne: 'completed' },
      }),
      User.countDocuments({ status: UserStatus.PENDING }),
      RealTimeBooking.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      RealTimeBooking.countDocuments({
        status: 'completed',
        updatedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      RealTimeBooking.aggregate([
        {
          $match: {
            status: 'completed',
            price: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' },
            avgBookingValue: { $avg: '$price' },
          },
        },
      ]),
    ]);

    // Debug log
    console.log('Dashboard stats:', {
      totalUsers,
      activeBookings: activeBookings + activeRealTimeBookings,
      emergencyCount,
      pendingApprovals,
      todayBookings,
      completedToday
    });

    return res.json(
      successResponse('Dashboard data fetched', {
        totalUsers,
        activeBookings: activeBookings + activeRealTimeBookings,
        emergencyCount,
        pendingApprovals,
        todayBookings,
        completedToday,
        revenue: revenueStats[0] || { totalRevenue: 0, avgBookingValue: 0 },
      })
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to fetch dashboard'
      )
    );
  }
};


const getPendingApprovals = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      status: UserStatus.PENDING,
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Generate signed URLs for documents if using S3
    const usersWithSignedUrls = await Promise.all(
      pendingUsers.map(async (user) => {
        const userObj = user.toObject();
        
        // Generate signed URL for profile picture
        if (userObj.profilePicture) {
          userObj.profilePictureUrl = await s3Service.getSignedUrl(userObj.profilePicture);
        }
        
        // Generate signed URLs for documents
        if (userObj.documents) {
          userObj.documentUrls = {};
          for (const [key, value] of Object.entries(userObj.documents)) {
            if (value) {
              userObj.documentUrls[key] = await s3Service.getSignedUrl(value);
            }
          }
        }
        
        return userObj;
      })
    );

    return res.json(
      successResponse(
        'Pending approvals fetched',
        usersWithSignedUrls
      )
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to fetch approvals'
      )
    );
  }
};

const approveProvider = async (req, res) => {
  try {
    const { id } = req.params;


    const user = await User.findById(id).select('-password');

    if (!user) {
      return res
        .status(404)
        .json(errorResponse('User not found'));
    }

 
    if (user.role === 'admin') {
      return res
        .status(403)
        .json(errorResponse('Cannot approve admin users'));
    }


    user.status = UserStatus.APPROVED;
    await user.save();

    return res.json(
      successResponse('Provider approved', user)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to approve provider'
      )
    );
  }
};


const rejectProvider = async (req, res) => {
  try {
    const { id } = req.params;


    const user = await User.findById(id).select('-password');

    if (!user) {
      return res
        .status(404)
        .json(errorResponse('User not found'));
    }


    if (user.role === 'admin') {
      return res
        .status(403)
        .json(errorResponse('Cannot reject admin users'));
    }


    user.status = UserStatus.REJECTED;
    await user.save();

    return res.json(
      successResponse('Provider rejected', user)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to reject provider'
      )
    );
  }
};


const blockUser = async (req, res) => {
  try {
    const { id } = req.params;


    const user = await User.findById(id).select('-password');

    if (!user) {
      return res
        .status(404)
        .json(errorResponse('User not found'));
    }


    if (user.role === 'admin') {
      return res
        .status(403)
        .json(errorResponse('Cannot block admin users'));
    }


    user.status = UserStatus.BLOCKED;
    await user.save();

    return res.json(
      successResponse('User blocked', user)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to block user'
      )
    );
  }
};


const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;


    const user = await User.findById(id).select('-password');

    if (!user) {
      return res
        .status(404)
        .json(errorResponse('User not found'));
    }

    if (user.role === 'admin') {
      return res
        .status(403)
        .json(errorResponse('Cannot unblock admin users'));
    }


    user.status = UserStatus.ACTIVE;
    await user.save();

    return res.json(
      successResponse('User unblocked', user)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to unblock user'
      )
    );
  }
};


const getAllUsers = async (req, res) => {
  try {
    const {
      role,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const skip =
      (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    return res.json(
      successResponse('Users fetched', {
        users,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(
        error.message || 'Failed to fetch users'
      )
    );
  }
};

const createMedicine = async (req, res) => {
  try {
    const medicineData = {
      ...req.body,
      // Don't assign pharmacist - will be assigned when order is accepted
    };

    // Handle multiple images (1-5) using S3
    if (req.files && req.files.length > 0) {
      try {
        // Upload all images to S3
        const imageUrls = await s3Service.uploadMultipleFiles(
          req.files, 
          'medicine-images', 
          'temp-' + Date.now()
        );
        
        medicineData.images = imageUrls;
        // Set first image as main imageUrl for backward compatibility
        medicineData.imageUrl = imageUrls[0];
      } catch (uploadError) {
        logger.error('Medicine image upload failed', { error: uploadError.message });
        return res.status(400).json(
          errorResponse('Image upload failed: ' + uploadError.message)
        );
      }
    }

    const medicine = await Medicine.create(medicineData);

    // Update image paths with actual medicine ID
    if (medicineData.images && medicineData.images.length > 0) {
      const updatedImages = [];
      for (const imageUrl of medicineData.images) {
        if (imageUrl.includes('temp-')) {
          // For S3 URLs, we need to re-upload with correct path
          // For local files, just update the path
          const newImageUrl = imageUrl.replace('temp-', medicine._id + '-');
          updatedImages.push(newImageUrl);
        } else {
          updatedImages.push(imageUrl);
        }
      }
      
      medicine.images = updatedImages;
      medicine.imageUrl = updatedImages[0];
      await medicine.save();
    }

    return res.status(201).json(
      successResponse('Medicine created successfully', medicine)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to create medicine')
    );
  }
};

const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = { ...req.body };
    
    // Handle multiple images (1-5) using S3
    if (req.files && req.files.length > 0) {
      try {
        const newImages = await s3Service.uploadMultipleFiles(
          req.files, 
          'medicine-images', 
          id
        );
        
        // If existingImages are provided, merge them with new images
        if (updateData.existingImages) {
          const existingImages = Array.isArray(updateData.existingImages) 
            ? updateData.existingImages 
            : [updateData.existingImages];
          updateData.images = [...existingImages, ...newImages];
          delete updateData.existingImages; // Remove from update data
        } else {
          // Replace all images with new ones
          updateData.images = newImages;
        }
        
        // Set first image as main imageUrl for backward compatibility
        updateData.imageUrl = updateData.images[0];
      } catch (uploadError) {
        logger.error('Medicine image upload failed', { error: uploadError.message });
        return res.status(400).json(
          errorResponse('Image upload failed: ' + uploadError.message)
        );
      }
    } else if (updateData.existingImages) {
      // Only existing images, no new uploads
      updateData.images = Array.isArray(updateData.existingImages) 
        ? updateData.existingImages 
        : [updateData.existingImages];
      updateData.imageUrl = updateData.images[0];
      delete updateData.existingImages;
    }

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    return res.json(
      successResponse('Medicine updated successfully', medicine)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to update medicine')
    );
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findByIdAndDelete(id);

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    return res.json(
      successResponse('Medicine deleted successfully', medicine)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to delete medicine')
    );
  }
};

const getAllMedicines = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      pharmacist,
    } = req.query;

    const query = {};
    if (search) {
      query.$text = { $search: search };
    }
    if (category) query.category = category;
    if (pharmacist) query.pharmacist = pharmacist;

    const skip = (Number(page) - 1) * Number(limit);

    const [medicines, total] = await Promise.all([
      Medicine.find(query)
        .populate('pharmacist', 'firstName lastName pharmacyName')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Medicine.countDocuments(query),
    ]);

    // Generate signed URLs for medicine images
    const medicinesWithSignedUrls = await Promise.all(
      medicines.map(async (medicine) => {
        const medicineObj = medicine.toObject();
        
        // Generate signed URL for main image
        if (medicineObj.imageUrl) {
          medicineObj.imageUrlSigned = await s3Service.getSignedUrl(medicineObj.imageUrl);
        }
        
        // Generate signed URLs for all images
        if (medicineObj.images && medicineObj.images.length > 0) {
          medicineObj.imagesSigned = await Promise.all(
            medicineObj.images.map(imageUrl => s3Service.getSignedUrl(imageUrl))
          );
        }
        
        return medicineObj;
      })
    );

    return res.json(
      successResponse('Medicines fetched successfully', {
        medicines: medicinesWithSignedUrls,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch medicines')
    );
  }
};

const createAmbulance = async (req, res) => {
  try {
    const ambulanceData = {
      ...req.body,
      role: 'ambulance',
    };

    const ambulance = await Ambulance.create(ambulanceData);

    return res.status(201).json(
      successResponse('Ambulance created successfully', ambulance)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to create ambulance')
    );
  }
};

const updateAmbulance = async (req, res) => {
  try {
    const { id } = req.params;

    const ambulance = await Ambulance.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!ambulance) {
      return res.status(404).json(errorResponse('Ambulance not found'));
    }

    return res.json(
      successResponse('Ambulance updated successfully', ambulance)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to update ambulance')
    );
  }
};

const deleteAmbulance = async (req, res) => {
  try {
    const { id } = req.params;

    const ambulance = await Ambulance.findByIdAndDelete(id);

    if (!ambulance) {
      return res.status(404).json(errorResponse('Ambulance not found'));
    }

    return res.json(
      successResponse('Ambulance deleted successfully', ambulance)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to delete ambulance')
    );
  }
};

const getAllAmbulances = async (req, res) => {
  try {
    const { page = 1, limit = 20, isAvailable } = req.query;

    const query = {};
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [ambulances, total] = await Promise.all([
      Ambulance.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Ambulance.countDocuments(query),
    ]);

    return res.json(
      successResponse('Ambulances fetched successfully', {
        ambulances,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch ambulances')
    );
  }
};

const updateBloodStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { bloodStock } = req.body;

    const bloodBank = await BloodBank.findById(id);

    if (!bloodBank) {
      return res.status(404).json(errorResponse('Blood bank not found'));
    }

    bloodBank.bloodStock = bloodStock;
    await bloodBank.save();

    return res.json(
      successResponse('Blood stock updated successfully', bloodBank)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to update blood stock')
    );
  }
};

const getAllBloodBanks = async (req, res) => {
  try {
    const { page = 1, limit = 20, bloodGroup } = req.query;

    const query = {};
    if (bloodGroup) {
      query['bloodStock.bloodGroup'] = bloodGroup;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bloodBanks, total] = await Promise.all([
      BloodBank.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      BloodBank.countDocuments(query),
    ]);

    return res.json(
      successResponse('Blood banks fetched successfully', {
        bloodBanks,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch blood banks')
    );
  }
};

const updatePathologyTests = async (req, res) => {
  try {
    const { id } = req.params;
    const { testsOffered } = req.body;

    const pathology = await Pathology.findById(id);

    if (!pathology) {
      return res.status(404).json(errorResponse('Pathology lab not found'));
    }

    pathology.testsOffered = testsOffered;
    await pathology.save();

    return res.json(
      successResponse('Pathology tests updated successfully', pathology)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to update pathology tests')
    );
  }
};

const getAllPathologyLabs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [pathologyLabs, total] = await Promise.all([
      Pathology.find()
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Pathology.countDocuments(),
    ]);

    return res.json(
      successResponse('Pathology labs fetched successfully', {
        pathologyLabs,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch pathology labs')
    );
  }
};

const getServiceStats = async (req, res) => {
  try {
    const [
      totalMedicines,
      totalAmbulances,
      totalBloodBanks,
      totalPathologyLabs,
      availableAmbulances,
      lowStockMedicines,
    ] = await Promise.all([
      Medicine.countDocuments({ isActive: true }),
      Ambulance.countDocuments(),
      BloodBank.countDocuments(),
      Pathology.countDocuments(),
      Ambulance.countDocuments({ isAvailable: true }),
      Medicine.countDocuments({ stock: { $lt: 10 }, isActive: true }),
    ]);

    return res.json(
      successResponse('Service statistics fetched', {
        medicines: {
          total: totalMedicines,
          lowStock: lowStockMedicines,
        },
        ambulances: {
          total: totalAmbulances,
          available: availableAmbulances,
        },
        bloodBanks: totalBloodBanks,
        pathologyLabs: totalPathologyLabs,
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch service stats')
    );
  }
};

const getAllBookings = async (req, res) => {
  try {
    const { status, serviceType, isEmergency, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (isEmergency !== undefined) query.isEmergency = isEmergency === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate('patient', 'firstName lastName phone email')
        .populate('acceptedProvider', 'firstName lastName phone email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

    return res.json(
      successResponse('All bookings fetched', {
        bookings,
        total,
        page: Number(page),
        limit: Number(limit),
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch bookings')
    );
  }
};

const getBookingAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [
      statusBreakdown,
      serviceTypeBreakdown,
      hourlyDistribution,
      avgResponseTime,
    ] = await Promise.all([
      RealTimeBooking.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      RealTimeBooking.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      ]),
      RealTimeBooking.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      RealTimeBooking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $ne: 'pending' },
            acceptedAt: { $exists: true },
          },
        },
        {
          $project: {
            responseTime: {
              $subtract: ['$acceptedAt', '$createdAt'],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
          },
        },
      ]),
    ]);

    return res.json(
      successResponse('Booking analytics fetched', {
        statusBreakdown,
        serviceTypeBreakdown,
        hourlyDistribution,
        avgResponseTimeMs: avgResponseTime[0]?.avgResponseTime || 0,
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch analytics')
    );
  }
};

const getUserDocuments = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('profilePicture documents firstName lastName email role');
    
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Generate signed URLs for all documents
    const result = {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      profilePicture: null,
      documents: {},
    };

    // Generate signed URL for profile picture
    if (user.profilePicture) {
      result.profilePicture = await s3Service.getSignedUrl(user.profilePicture);
    }

    // Generate signed URLs for documents
    if (user.documents) {
      for (const [key, value] of Object.entries(user.documents)) {
        if (value) {
          result.documents[key] = await s3Service.getSignedUrl(value);
        }
      }
    }

    return res.json(successResponse('User documents fetched', result));
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch user documents')
    );
  }
};

export {
  getDashboard,
  getPendingApprovals,
  approveProvider,
  rejectProvider,
  blockUser,
  unblockUser,
  getAllUsers,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getAllMedicines,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
  getAllAmbulances,
  updateBloodStock,
  getAllBloodBanks,
  updatePathologyTests,
  getAllPathologyLabs,
  getServiceStats,
  getAllBookings,
  getBookingAnalytics,
  getUserDocuments,
};
