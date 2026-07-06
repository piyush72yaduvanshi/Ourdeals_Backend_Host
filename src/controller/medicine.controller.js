import { Medicine } from '../models/Medicine.model.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { s3Service } from '../services/s3.service.js';

// Public API - Get all medicines (for users to browse)
const getAllMedicines = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      page = 1, 
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      minPrice,
      maxPrice,
      requiresPrescription
    } = req.query;

    const query = {
      isActive: true,
      stock: { $gt: 0 }, // Only show medicines in stock
    };

    // Search by name or generic name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Filter by prescription requirement
    if (requiresPrescription !== undefined) {
      query.requiresPrescription = requiresPrescription === 'true';
    }

    // Sorting
    const sortOptions = {};
    if (sortBy === 'price') {
      sortOptions.price = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'discount') {
      sortOptions.discountedPrice = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // Default: newest first
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [medicines, total] = await Promise.all([
      Medicine.find(query)
        .select('-__v')
        .skip(skip)
        .limit(Number(limit))
        .sort(sortOptions)
        .lean(),
      Medicine.countDocuments(query),
    ]);

    // Calculate discount percentage for each medicine and generate signed URLs
    const medicinesWithDiscount = await Promise.all(medicines.map(async (medicine) => {
      const formattedMedicine = {
        ...medicine,
        discountPercentage: medicine.discountedPrice 
          ? Math.round(((medicine.price - medicine.discountedPrice) / medicine.price) * 100)
          : 0,
        finalPrice: medicine.discountedPrice || medicine.price,
      };

      if (formattedMedicine.imageUrl) {
        formattedMedicine.imageUrl = await s3Service.getSignedUrl(formattedMedicine.imageUrl);
      }
      
      if (formattedMedicine.images && formattedMedicine.images.length > 0) {
        formattedMedicine.images = await Promise.all(
          formattedMedicine.images.map(url => s3Service.getSignedUrl(url))
        );
      }

      return formattedMedicine;
    }));

    res.json(
      paginatedResponse(
        'Medicines fetched successfully',
        medicinesWithDiscount,
        Number(page),
        Number(limit),
        total
      )
    );
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch medicines'));
  }
};

// Public API - Get medicine by ID
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findOne({
      _id: id,
      isActive: true,
    }).lean();

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    // Calculate discount percentage
    const medicineWithDiscount = {
      ...medicine,
      discountPercentage: medicine.discountedPrice 
        ? Math.round(((medicine.price - medicine.discountedPrice) / medicine.price) * 100)
        : 0,
      finalPrice: medicine.discountedPrice || medicine.price,
    };

    res.json(successResponse('Medicine details fetched', medicineWithDiscount));
  } catch (error) {
    console.error('Get medicine by ID error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch medicine'));
  }
};

// Public API - Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Medicine.distinct('category', { 
      isActive: true,
      stock: { $gt: 0 }
    });

    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Medicine.countDocuments({
          category,
          isActive: true,
          stock: { $gt: 0 },
        });
        return { name: category, count };
      })
    );

    res.json(successResponse('Categories fetched', categoriesWithCount));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch categories'));
  }
};

// Public API - Check medicine availability and stock
const checkAvailability = async (req, res) => {
  try {
    const { medicines } = req.body; // Array of { medicineId, quantity }

    if (!medicines || !Array.isArray(medicines)) {
      return res.status(400).json(errorResponse('Medicines array is required'));
    }

    const availability = await Promise.all(
      medicines.map(async (item) => {
        const medicine = await Medicine.findById(item.medicineId).lean();
        
        if (!medicine) {
          return {
            medicineId: item.medicineId,
            available: false,
            reason: 'Medicine not found',
          };
        }

        if (!medicine.isActive) {
          return {
            medicineId: item.medicineId,
            available: false,
            reason: 'Medicine is not active',
          };
        }

        if (medicine.stock < item.quantity) {
          return {
            medicineId: item.medicineId,
            available: false,
            reason: `Insufficient stock. Available: ${medicine.stock}`,
            availableStock: medicine.stock,
          };
        }

        return {
          medicineId: item.medicineId,
          available: true,
          name: medicine.name,
          price: medicine.discountedPrice || medicine.price,
          availableStock: medicine.stock,
        };
      })
    );

    const allAvailable = availability.every(item => item.available);

    res.json(
      successResponse('Availability checked', {
        allAvailable,
        medicines: availability,
      })
    );
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to check availability'));
  }
};

// Admin/Pharmacist - Add medicine
const addMedicine = async (req, res) => {
  try {
    // Parse request body and remove any invalid fields
    const medicineData = {
      ...req.body,
      pharmacist: req.user.userId, // Optional - can be null for general medicines
    };

    // Remove imageUrl and images from request body if they exist as objects
    // These will be set from uploaded files
    if (typeof medicineData.imageUrl === 'object') {
      delete medicineData.imageUrl;
    }
    if (medicineData.images && typeof medicineData.images === 'object' && !Array.isArray(medicineData.images)) {
      delete medicineData.images;
    }
    
    // Parse numeric fields that might come as strings from form-data
    if (medicineData.price) medicineData.price = Number(medicineData.price);
    if (medicineData.discountedPrice) medicineData.discountedPrice = Number(medicineData.discountedPrice);
    if (medicineData.stock) medicineData.stock = Number(medicineData.stock);
    
    // Parse boolean fields
    if (medicineData.requiresPrescription !== undefined) {
      medicineData.requiresPrescription = medicineData.requiresPrescription === 'true' || medicineData.requiresPrescription === true;
    }
    if (medicineData.isActive !== undefined) {
      medicineData.isActive = medicineData.isActive === 'true' || medicineData.isActive === true;
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      try {
        const { s3Service } = await import('../services/s3.service.js');
        const imageUrls = await s3Service.uploadMultipleFiles(
          req.files, 
          'medicine-images', 
          req.user.userId
        );
        
        // Extract file URLs from upload results - handle multiple formats
        medicineData.images = imageUrls.map(img => {
          // Handle if img is already a string
          if (typeof img === 'string') return img;
          // Handle object with fileUrl property
          if (img && img.fileUrl) return img.fileUrl;
          // Handle object with url property
          if (img && img.url) return img.url;
          // Fallback
          return String(img);
        });
        
        // Set first image as main imageUrl for backward compatibility
        if (medicineData.images.length > 0) {
          medicineData.imageUrl = medicineData.images[0];
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json(errorResponse('Failed to upload medicine images: ' + uploadError.message));
      }
    }

    const medicine = await Medicine.create(medicineData);

    res.status(201).json(successResponse('Medicine added successfully', medicine));
  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to add medicine'));
  }
};

// Admin/Pharmacist - Update medicine
const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Remove imageUrl and images from request body if they exist as objects
    // These will be set from uploaded files
    if (typeof updates.imageUrl === 'object') {
      delete updates.imageUrl;
    }
    if (updates.images && typeof updates.images === 'object' && !Array.isArray(updates.images)) {
      delete updates.images;
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      try {
        const { s3Service } = await import('../services/s3.service.js');
        const newImages = await s3Service.uploadMultipleFiles(
          req.files, 
          'medicine-images', 
          req.user.userId
        );
        
        // Get existing medicine to preserve old images if needed
        const existingMedicine = await Medicine.findById(id);
        if (!existingMedicine) {
          return res.status(404).json(errorResponse('Medicine not found'));
        }
        
        // Extract URLs from upload results - handle multiple formats
        const newImageUrls = newImages.map(img => {
          if (typeof img === 'string') return img;
          if (img && img.fileUrl) return img.fileUrl;
          if (img && img.url) return img.url;
          return String(img);
        });
        
        // Merge with existing images or replace based on replaceImages flag
        const replaceImages = req.body.replaceImages === 'true';
        if (replaceImages) {
          updates.images = newImageUrls;
        } else {
          // Append new images to existing ones (max 5 total)
          const existingImages = existingMedicine.images || [];
          const allImages = [...existingImages, ...newImageUrls];
          updates.images = allImages.slice(0, 5); // Keep max 5 images
        }
        
        // Update main imageUrl to first image
        if (updates.images && updates.images.length > 0) {
          updates.imageUrl = updates.images[0];
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json(errorResponse('Failed to upload medicine images: ' + uploadError.message));
      }
    }

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    res.json(successResponse('Medicine updated successfully', medicine));
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update medicine'));
  }
};

// Admin/Pharmacist - Delete medicine
const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    res.json(successResponse('Medicine deleted successfully'));
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to delete medicine'));
  }
};

// Admin/Pharmacist - Update stock
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    const medicine = await Medicine.findById(id);

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    if (operation === 'set') {
      medicine.stock = stock;
    } else if (operation === 'add') {
      medicine.stock += stock;
    } else if (operation === 'subtract') {
      medicine.stock = Math.max(0, medicine.stock - stock);
    }

    await medicine.save();

    res.json(successResponse('Stock updated successfully', medicine));
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update stock'));
  }
};

export {
  getAllMedicines,
  getMedicineById,
  getCategories,
  checkAvailability,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
};
