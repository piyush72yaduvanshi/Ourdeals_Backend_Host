import { PetCategory } from "../models/PetCategory.model.js";
import { PetProduct } from "../models/PetProduct.model.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";
import { s3Service } from "../services/s3.service.js";

// ==========================================
// CATEGORIES
// ==========================================

export const getPetCategories = async (req, res) => {
  try {
    const { petType } = req.query;
    const query = { isActive: true };

    if (petType) {
      query.targetPets = { $in: [petType.toLowerCase(), "all"] };
    }

    const categories = await PetCategory.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const prodQuery = { category: cat.name, isActive: true };
        if (petType) {
          prodQuery.$or = [{ petType }, { petType: "all" }];
        }
        const count = await PetProduct.countDocuments(prodQuery);
        return { ...cat, productCount: count };
      })
    );

    res.json(successResponse("Pet care categories fetched", withCounts));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const adminCreatePetCategory = async (req, res) => {
  try {
    const { name, description, image, targetPets, displayOrder } = req.body;
    if (!name) {
      return res.status(400).json(errorResponse("Category name is required"));
    }

    const category = new PetCategory({
      name,
      description,
      image,
      targetPets: targetPets || ["all"],
      displayOrder: displayOrder || 0,
    });

    await category.save();
    res.status(201).json(successResponse("Pet category created successfully", category));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminUpdatePetCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await PetCategory.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json(errorResponse("Pet category not found"));
    }
    res.json(successResponse("Pet category updated successfully", category));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminDeletePetCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await PetCategory.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!category) {
      return res.status(404).json(errorResponse("Pet category not found"));
    }
    res.json(successResponse("Pet category deactivated successfully"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==========================================
// PRODUCTS
// ==========================================

export const getAllPetProducts = async (req, res) => {
  try {
    const {
      category,
      petType,
      brand,
      lifeStage,
      search,
      minPrice,
      maxPrice,
      sortBy = "newest", // 'price_asc', 'price_desc', 'rating', 'discount', 'newest'
      page = 1,
      limit = 20,
      inStockOnly,
    } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (petType) {
      query.$or = [{ petType: petType.toLowerCase() }, { petType: "all" }];
    }

    if (brand) {
      query.brand = { $regex: new RegExp(`^${brand}$`, "i") };
    }

    if (lifeStage) {
      query.lifeStage = lifeStage;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (inStockOnly === "true") {
      query.stock = { $gt: 0 };
    }

    const sortOptions = {};
    if (sortBy === "price_asc") {
      sortOptions.discountedPrice = 1;
    } else if (sortBy === "price_desc") {
      sortOptions.discountedPrice = -1;
    } else if (sortBy === "rating") {
      sortOptions.rating = -1;
    } else if (sortBy === "discount") {
      sortOptions.discountPercentage = -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      PetProduct.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PetProduct.countDocuments(query),
    ]);

    res.json(paginatedResponse("Pet care products fetched", products, Number(page), Number(limit), total));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const getPetProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await PetProduct.findOne({ _id: id, isActive: true }).lean();

    if (!product) {
      return res.status(404).json(errorResponse("Pet product not found"));
    }

    // Related products in same category or target pet
    const relatedProducts = await PetProduct.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
    })
      .limit(4)
      .lean();

    res.json(
      successResponse("Pet product details fetched", {
        product,
        relatedProducts,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const adminCreatePetProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (productData.price) productData.price = Number(productData.price);
    if (productData.discountedPrice) productData.discountedPrice = Number(productData.discountedPrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    if (req.files && req.files.length > 0) {
      const urls = await s3Service.uploadMultipleFiles(req.files, "petcare-products", req.user?.userId || "admin");
      productData.images = urls.map((u) => (typeof u === "string" ? u : u.fileUrl || u.url));
      productData.imageUrl = productData.images[0];
    }

    const product = new PetProduct(productData);
    await product.save();

    res.status(201).json(successResponse("Pet product created successfully", product));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminUpdatePetProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.price) updates.price = Number(updates.price);
    if (updates.discountedPrice) updates.discountedPrice = Number(updates.discountedPrice);
    if (updates.stock) updates.stock = Number(updates.stock);

    if (req.files && req.files.length > 0) {
      const urls = await s3Service.uploadMultipleFiles(req.files, "petcare-products", req.user?.userId || "admin");
      const newImages = urls.map((u) => (typeof u === "string" ? u : u.fileUrl || u.url));
      updates.images = newImages;
      updates.imageUrl = newImages[0];
    }

    const product = await PetProduct.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json(errorResponse("Pet product not found"));
    }

    res.json(successResponse("Pet product updated successfully", product));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminDeletePetProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await PetProduct.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) {
      return res.status(404).json(errorResponse("Pet product not found"));
    }
    res.json(successResponse("Pet product deleted successfully"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};
