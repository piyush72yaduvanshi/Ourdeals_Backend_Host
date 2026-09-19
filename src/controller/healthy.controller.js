import { HealthyCategory } from "../models/HealthyCategory.model.js";
import { HealthyProduct } from "../models/HealthyProduct.model.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";
import { s3Service } from "../services/s3.service.js";

// ==========================================
// CATEGORIES
// ==========================================

export const getHealthyCategories = async (req, res) => {
  try {
    const categories = await HealthyCategory.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Get count of products for each category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await HealthyProduct.countDocuments({
          category: cat.name,
          isActive: true,
        });
        return { ...cat, productCount: count };
      })
    );

    res.json(successResponse("Healthys categories fetched", withCounts));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const adminCreateHealthyCategory = async (req, res) => {
  try {
    const { name, description, image, displayOrder } = req.body;
    if (!name) {
      return res.status(400).json(errorResponse("Category name is required"));
    }

    const category = new HealthyCategory({
      name,
      description,
      image,
      displayOrder: displayOrder || 0,
    });

    await category.save();
    res.status(201).json(successResponse("Category created successfully", category));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminUpdateHealthyCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await HealthyCategory.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json(errorResponse("Category not found"));
    }
    res.json(successResponse("Category updated successfully", category));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminDeleteHealthyCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await HealthyCategory.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!category) {
      return res.status(404).json(errorResponse("Category not found"));
    }
    res.json(successResponse("Category deactivated successfully"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==========================================
// PRODUCTS
// ==========================================

export const getAllHealthyProducts = async (req, res) => {
  try {
    const {
      category,
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
      HealthyProduct.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      HealthyProduct.countDocuments(query),
    ]);

    res.json(paginatedResponse("Healthys products fetched", products, Number(page), Number(limit), total));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const getHealthyProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await HealthyProduct.findOne({ _id: id, isActive: true }).lean();

    if (!product) {
      return res.status(404).json(errorResponse("Product not found"));
    }

    // Related products in same category
    const relatedProducts = await HealthyProduct.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
    })
      .limit(4)
      .lean();

    res.json(
      successResponse("Product details fetched", {
        product,
        relatedProducts,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const adminCreateHealthyProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (productData.price) productData.price = Number(productData.price);
    if (productData.discountedPrice) productData.discountedPrice = Number(productData.discountedPrice);
    if (productData.stock) productData.stock = Number(productData.stock);

    // Handle image uploads if any
    if (req.files && req.files.length > 0) {
      const urls = await s3Service.uploadMultipleFiles(req.files, "healthys-products", req.user?.userId || "admin");
      productData.images = urls.map((u) => (typeof u === "string" ? u : u.fileUrl || u.url));
      productData.imageUrl = productData.images[0];
    }

    const product = new HealthyProduct(productData);
    await product.save();

    res.status(201).json(successResponse("Product created successfully", product));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminUpdateHealthyProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.price) updates.price = Number(updates.price);
    if (updates.discountedPrice) updates.discountedPrice = Number(updates.discountedPrice);
    if (updates.stock) updates.stock = Number(updates.stock);

    if (req.files && req.files.length > 0) {
      const urls = await s3Service.uploadMultipleFiles(req.files, "healthys-products", req.user?.userId || "admin");
      const newImages = urls.map((u) => (typeof u === "string" ? u : u.fileUrl || u.url));
      updates.images = newImages;
      updates.imageUrl = newImages[0];
    }

    const product = await HealthyProduct.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json(errorResponse("Product not found"));
    }

    res.json(successResponse("Product updated successfully", product));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

export const adminDeleteHealthyProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await HealthyProduct.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) {
      return res.status(404).json(errorResponse("Product not found"));
    }
    res.json(successResponse("Product deleted successfully"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};
