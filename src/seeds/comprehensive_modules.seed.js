import "../config/env.config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../utils/db.js";
import { User } from "../models/User.model.js";
import { Physiotherapist } from "../models/Physiotherapist.model.js";
import { PhysiotherapyBooking } from "../models/PhysiotherapyBooking.model.js";
import { HealthyCategory } from "../models/HealthyCategory.model.js";
import { HealthyProduct } from "../models/HealthyProduct.model.js";
import { MedicineCategory } from "../models/MedicineCategory.model.js";
import { Medicine } from "../models/Medicine.model.js";
import { PetCategory } from "../models/PetCategory.model.js";
import { PetProduct } from "../models/PetProduct.model.js";
import { logger } from "../utils/logger.util.js";

export const seedComprehensiveModules = async () => {
  try {
    console.log("🌱 Starting Comprehensive 4-Module Seeding...");

    // ==========================================
    // 1. SEED PHYSIOTHERAPISTS
    // ==========================================
    console.log("👉 Seeding Physiotherapists...");
    const hashedPassword = await bcrypt.hash("Password@123", 10);

    const physiosData = [
      {
        email: "dr.arun.sharma@ourdeals.com",
        password: hashedPassword,
        role: "physiotherapist",
        firstName: "Dr. Arun",
        lastName: "Sharma",
        age: 36,
        gender: "Male",
        phone: "+919811001122",
        status: "active",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        address: "Connaught Place, Central Delhi",
        location: {
          type: "Point",
          coordinates: [77.2167, 28.6328],
        },
        profilePicture: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80",
        specializations: [
          "Orthopedic Physiotherapy",
          "Spine & Back Pain Relief",
          "Post-Surgical Rehabilitation",
        ],
        qualifications: ["BPT", "MPT (Orthopedics)"],
        experience: 9,
        sessionFee: 650,
        homeVisitAvailable: true,
        clinicAddress: "Apex Rehab Clinic, Block B, Connaught Place, New Delhi",
        licenseNumber: "DMR-PT-2015-8841",
        about: "Senior Orthopedic Physiotherapist with 9+ years experience specializing in chronic back pain, cervical spondylosis, and post-knee replacement rehabilitation.",
        rating: 4.9,
        totalPatientsTreated: 850,
        isAvailable: true,
      },
      {
        email: "dr.priya.nair@ourdeals.com",
        password: hashedPassword,
        role: "physiotherapist",
        firstName: "Dr. Priya",
        lastName: "Nair",
        age: 32,
        gender: "Female",
        phone: "+919822002233",
        status: "active",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110016",
        address: "Hauz Khas, South Delhi",
        location: {
          type: "Point",
          coordinates: [77.2066, 28.5494],
        },
        profilePicture: "https://images.unsplash.com/photo-1594824813583-149811804f32?w=400&auto=format&fit=crop&q=80",
        specializations: [
          "Sports Injury Rehabilitation",
          "Knee & Joint Pain Therapy",
          "Postural Ergonomics",
        ],
        qualifications: ["BPT", "MPT (Sports Rehab)", "Certified Dry Needling Practitioner"],
        experience: 7,
        sessionFee: 700,
        homeVisitAvailable: true,
        clinicAddress: "ProActive Sports Physio, Hauz Khas Enclave, New Delhi",
        licenseNumber: "DMR-PT-2017-9432",
        about: "Sports rehabilitation specialist working with active athletes and runners. Expert in ligament recovery, rotator cuff tears, and kinesio-taping.",
        rating: 4.8,
        totalPatientsTreated: 620,
        isAvailable: true,
      },
      {
        email: "dr.rajesh.verma@ourdeals.com",
        password: hashedPassword,
        role: "physiotherapist",
        firstName: "Dr. Rajesh",
        lastName: "Verma",
        age: 41,
        gender: "Male",
        phone: "+919833003344",
        status: "active",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110085",
        address: "Rohini Sector 9, North West Delhi",
        location: {
          type: "Point",
          coordinates: [77.1197, 28.7159],
        },
        profilePicture: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80",
        specializations: [
          "Neurological Rehabilitation",
          "Geriatric Care & Mobility",
          "Stroke Recovery",
        ],
        qualifications: ["BPT", "MPT (Neurology)", "NDT Certified"],
        experience: 14,
        sessionFee: 600,
        homeVisitAvailable: true,
        clinicAddress: "NeuroHeal Therapy Centre, Sector 9 Rohini, Delhi",
        licenseNumber: "DMR-PT-2010-4109",
        about: "Neurophysiotherapy consultant with 14 years dedicated to stroke paralysis recovery, Parkinson's mobility maintenance, and elderly fall prevention.",
        rating: 4.9,
        totalPatientsTreated: 1200,
        isAvailable: true,
      },
      {
        email: "dr.sneha.kulkarni@ourdeals.com",
        password: hashedPassword,
        role: "physiotherapist",
        firstName: "Dr. Sneha",
        lastName: "Kulkarni",
        age: 29,
        gender: "Female",
        phone: "+919844004455",
        status: "active",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110092",
        address: "Laxmi Nagar, East Delhi",
        location: {
          type: "Point",
          coordinates: [77.2773, 28.6304],
        },
        profilePicture: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80",
        specializations: [
          "Women's Health & Prenatal Physio",
          "Post-Surgical Rehabilitation",
          "Spine & Back Pain Relief",
        ],
        qualifications: ["BPT", "Certified Pelvic Floor Specialist"],
        experience: 5,
        sessionFee: 500,
        homeVisitAvailable: true,
        clinicAddress: "Grace WellCare Clinic, Vikas Marg, Laxmi Nagar, Delhi",
        licenseNumber: "DMR-PT-2019-1123",
        about: "Compassionate physiotherapist helping women manage pregnancy back pain, postpartum diastasis recti, and desk workers with cervical issues.",
        rating: 4.7,
        totalPatientsTreated: 410,
        isAvailable: true,
      },
    ];

    for (const physio of physiosData) {
      const existing = await User.findOne({ email: physio.email });
      if (!existing) {
        await Physiotherapist.create(physio);
      } else {
        await Physiotherapist.updateOne({ email: physio.email }, { $set: physio });
      }
    }
    console.log("✅ 4 Physiotherapists seeded successfully");

    // ==========================================
    // 2. SEED HEALTHYS CATEGORIES & PRODUCTS
    // ==========================================
    console.log("👉 Seeding Healthys Categories & Products...");
    const healthyCategoriesData = [
      {
        name: "Nutritional Supplements",
        description: "Essential daily nutrition, superfoods, and multivitamins for active lifestyles.",
        image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
        displayOrder: 1,
      },
      {
        name: "Ayurvedic & Herbal",
        description: "100% natural herbs, traditional Kadhas, and Ayurvedic rejuvenators.",
        image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&auto=format&fit=crop&q=80",
        displayOrder: 2,
      },
      {
        name: "Fitness & Proteins",
        description: "Whey proteins, plant-based proteins, and pre/post-workout nutrition.",
        image: "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=400&auto=format&fit=crop&q=80",
        displayOrder: 3,
      },
      {
        name: "Daily Immunity Boosters",
        description: "Vitamin C, Zinc, Chyawanprash, and immunity shields for all ages.",
        image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80",
        displayOrder: 4,
      },
      {
        name: "Vitamins & Minerals",
        description: "High potency Vitamin D3, Vitamin B12, Iron, and Calcium supplements.",
        image: "https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=400&auto=format&fit=crop&q=80",
        displayOrder: 5,
      },
      {
        name: "Healthy Snacks & Drinks",
        description: "Herbal green teas, organic apple cider vinegar, and cold-pressed juices.",
        image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&auto=format&fit=crop&q=80",
        displayOrder: 6,
      },
    ];

    for (const cat of healthyCategoriesData) {
      await HealthyCategory.findOneAndUpdate({ name: cat.name }, cat, { upsert: true });
    }

    const healthyProductsData = [
      {
        name: "Organic Ashwagandha Extract 500mg (60 Veg Capsules)",
        category: "Ayurvedic & Herbal",
        brand: "Healthys Natural",
        description: "Pure KSM-66 Ashwagandha standardized extract. Clinically proven to reduce stress, improve sleep quality, and enhance stamina.",
        price: 699,
        discountedPrice: 499,
        stock: 150,
        packSize: "60 Veg Capsules",
        rating: 4.8,
        benefits: ["Reduces cortisol & stress", "Improves vitality & energy", "Supports deep sleep"],
        ingredients: ["Pure Ashwagandha Root Extract 500mg", "Piperine 5mg"],
        howToUse: "Take 1 capsule twice daily after meals with warm water or milk.",
        images: [
          "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Plant-Based Protein Isolate Chocolate 1kg",
        category: "Fitness & Proteins",
        brand: "Healthys Pro",
        description: "Clean organic pea and brown rice protein with 25g protein per scoop, zero added sugar, and added digestive enzymes for easy digestion.",
        price: 2499,
        discountedPrice: 1899,
        stock: 80,
        packSize: "1 kg Tub (30 Servings)",
        rating: 4.7,
        benefits: ["25g clean protein per scoop", "Zero bloated feeling with DigeZyme", "Naturally sweetened with Stevia"],
        ingredients: ["Organic Pea Protein Isolate", "Brown Rice Protein", "Cocoa Powder", "DigeZyme"],
        howToUse: "Mix 1 scoop (33g) in 250ml cold water or almond milk. Shake well.",
        images: [
          "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Triple Strength Omega-3 Fish Oil 1000mg (60 Softgels)",
        category: "Nutritional Supplements",
        brand: "Healthys Vital",
        description: "High potency EPA (550mg) & DHA (350mg) molecularly distilled for ultra purity. Supports heart, joint flexibility, and brain health.",
        price: 1199,
        discountedPrice: 799,
        stock: 200,
        packSize: "60 Softgels",
        rating: 4.9,
        benefits: ["High EPA & DHA concentration", "Zero fishy burps - lemon coated", "Certified heavy metal free"],
        ingredients: ["Deep Sea Wild Fish Oil", "Gelatin (Bovine)", "Glycerin", "Natural Vitamin E"],
        howToUse: "Take 1 softgel daily with a main meal.",
        images: [
          "https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Special Chyawanprash Immunity Booster 1kg",
        category: "Daily Immunity Boosters",
        brand: "Healthys Heritage",
        description: "Traditional Ayurvedic rasayana prepared with fresh Amla and 45 authentic botanical herbs. Boosts respiratory defence and immunity.",
        price: 550,
        discountedPrice: 420,
        stock: 120,
        packSize: "1 kg Jar",
        rating: 4.6,
        benefits: ["Natural source of Vitamin C", "Strengthens respiratory system", "Enhances memory and vitality"],
        ingredients: ["Fresh Indian Gooseberry (Amla)", "Saffron", "Honey", "Brahmi", "Tulsi"],
        howToUse: "Adults: 1 tablespoon twice daily. Children: 1 teaspoon daily.",
        images: [
          "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Vitamin D3 60000 IU Fast Dissolving Chewable (4 Tablets)",
        category: "Vitamins & Minerals",
        brand: "Healthys Forte",
        description: "Weekly high-strength Vitamin D3 (Cholecalciferol) to correct deficiency, boost bone density, and strengthen immunity.",
        price: 180,
        discountedPrice: 140,
        stock: 300,
        packSize: "Pack of 4 Tablets",
        rating: 4.9,
        benefits: ["Weekly convenient dosage", "Fast absorbing chewable", "Supports calcium absorption"],
        ingredients: ["Cholecalciferol (Vitamin D3) 60000 IU"],
        howToUse: "Chew 1 tablet once a week after lunch, or as directed by physician.",
        images: [
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Raw Organic Apple Cider Vinegar with Mother 500ml",
        category: "Healthy Snacks & Drinks",
        brand: "Healthys Organics",
        description: "Raw, unfiltered, unpasteurized ACV crafted from Himalayan apples with active beneficial strands of 'The Mother'.",
        price: 499,
        discountedPrice: 349,
        stock: 180,
        packSize: "500 ml Glass Bottle",
        rating: 4.7,
        benefits: ["Aids weight management", "Supports gut microbiome", "Helps balance blood glucose"],
        ingredients: ["Pure Himalayan Apple Juice fermented to 5% acidity"],
        howToUse: "Dilute 10ml in a glass of warm water on an empty stomach.",
        images: [
          "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Turmeric Curcumin 95% with BioPerine (60 Veg Capsules)",
        category: "Ayurvedic & Herbal",
        brand: "Healthys Natural",
        description: "Standardized 95% curcuminoids enhanced with piperine for 2000% higher bioavailability. Powerful natural antioxidant and joint relief.",
        price: 850,
        discountedPrice: 599,
        stock: 110,
        packSize: "60 Capsules",
        rating: 4.8,
        benefits: ["Relieves joint inflammation", "High antioxidant shield", "Promotes glowing skin"],
        ingredients: ["Curcuma Longa Extract 500mg", "BioPerine Black Pepper Extract 5mg"],
        howToUse: "1 capsule twice daily with meals.",
        images: [
          "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Biotin 10000mcg with Keratin & Bamboo Extract (60 Tablets)",
        category: "Nutritional Supplements",
        brand: "Healthys Beauty",
        description: "Maximum strength Biotin enriched with Zinc, Vitamin C, and Keratin for thick hair growth, glowing skin, and strong nails.",
        price: 799,
        discountedPrice: 499,
        stock: 140,
        packSize: "60 Tablets",
        rating: 4.7,
        benefits: ["Controls hair fall & breakage", "Promotes nail keratinization", "Enhances skin radiance"],
        ingredients: ["Biotin (Vitamin B7) 10000 mcg", "Hydrolyzed Keratin 50mg", "Bamboo Silica 20mg"],
        howToUse: "Take 1 tablet daily after breakfast.",
        images: [
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
        ],
      },
    ];

    for (const prod of healthyProductsData) {
      await HealthyProduct.findOneAndUpdate({ name: prod.name }, prod, { upsert: true });
    }
    console.log("✅ 8 Healthys Products seeded");

    // ==========================================
    // 3. SEED MEDICINES CATEGORIES & PRODUCTS
    // ==========================================
    console.log("👉 Seeding Medicine Categories & Enhanced Medicines...");
    const medCategoriesData = [
      {
        name: "Pain Relief & Fever",
        description: "Tablets, balms, and syrups for headache, body pain, and fever reduction.",
        image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
        displayOrder: 1,
      },
      {
        name: "Cold & Cough",
        description: "Decongestants, cough syrups, lozenges, and anti-allergic formulations.",
        image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=400&auto=format&fit=crop&q=80",
        displayOrder: 2,
      },
      {
        name: "Antibiotics & Anti-infectives",
        description: "Prescription antibiotics for bacterial, viral, and fungal infections.",
        image: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&auto=format&fit=crop&q=80",
        displayOrder: 3,
      },
      {
        name: "Digestive & Gastro",
        description: "Antacids, proton-pump inhibitors, enzymes, and laxatives.",
        image: "https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=400&auto=format&fit=crop&q=80",
        displayOrder: 4,
      },
      {
        name: "Cardiovascular & BP",
        description: "Blood pressure regulators, statins, and heart health medications.",
        image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&auto=format&fit=crop&q=80",
        displayOrder: 5,
      },
      {
        name: "Diabetes Care",
        description: "Oral anti-diabetic tablets, insulin, and glucose monitors.",
        image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&auto=format&fit=crop&q=80",
        displayOrder: 6,
      },
      {
        name: "Skin & Dermatology",
        description: "Topical antifungal creams, antiseptic ointments, and acne solutions.",
        image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80",
        displayOrder: 7,
      },
      {
        name: "Vitamins & Tonics",
        description: "Multivitamin syrups, B-complex capsules, and iron supplements.",
        image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80",
        displayOrder: 8,
      },
    ];

    for (const cat of medCategoriesData) {
      await MedicineCategory.findOneAndUpdate({ name: cat.name }, cat, { upsert: true });
    }

    const medicinesData = [
      {
        name: "Dolo 650mg Tablet",
        genericName: "Paracetamol",
        manufacturer: "Micro Labs Ltd",
        brand: "Micro Labs",
        description: "Fast-acting analgesic and antipyretic for relieving fever and mild to moderate bodily pain.",
        category: "Pain Relief & Fever",
        dosageForm: "Tablet",
        strength: "650mg",
        packaging: "Strip of 15 tablets",
        packSize: "Strip of 15 tablets",
        price: 34,
        mrp: 34,
        discountedPrice: 29,
        sellingPrice: 29,
        stock: 600,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Crocin Advance 500mg",
        genericName: "Paracetamol",
        manufacturer: "GlaxoSmithKline (GSK)",
        brand: "GSK",
        description: "Fast release technology paracetamol that starts releasing within 5 minutes for rapid fever relief.",
        category: "Pain Relief & Fever",
        dosageForm: "Tablet",
        strength: "500mg",
        packaging: "Strip of 20 tablets",
        packSize: "Strip of 20 tablets",
        price: 45,
        mrp: 45,
        discountedPrice: 38,
        sellingPrice: 38,
        stock: 500,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Augmentin 625 Duo Tablet",
        genericName: "Amoxicillin and Potassium Clavulanate",
        manufacturer: "GSK",
        brand: "GSK",
        description: "Broad-spectrum penicillin antibiotic used to treat bacterial infections of ears, chest, skin, and urinary tract.",
        category: "Antibiotics & Anti-infectives",
        dosageForm: "Tablet",
        strength: "625mg",
        packaging: "Strip of 10 tablets",
        packSize: "Strip of 10 tablets",
        price: 223,
        mrp: 223,
        discountedPrice: 189,
        sellingPrice: 189,
        stock: 250,
        requiresPrescription: true,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Pan 40 Tablet",
        genericName: "Pantoprazole Gastro-resistant",
        manufacturer: "Alkem Laboratories",
        brand: "Alkem",
        description: "Proton pump inhibitor (PPI) that reduces acid production in the stomach, treating GERD and acidity.",
        category: "Digestive & Gastro",
        dosageForm: "Tablet",
        strength: "40mg",
        packaging: "Strip of 15 tablets",
        packSize: "Strip of 15 tablets",
        price: 155,
        mrp: 155,
        discountedPrice: 130,
        sellingPrice: 130,
        stock: 400,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Allegra 120mg Tablet",
        genericName: "Fexofenadine Hydrochloride",
        manufacturer: "Sanofi India",
        brand: "Sanofi",
        description: "Non-drowsy anti-allergic medication for relief from allergic rhinitis, sneezing, runny nose, and hives.",
        category: "Cold & Cough",
        dosageForm: "Tablet",
        strength: "120mg",
        packaging: "Strip of 10 tablets",
        packSize: "Strip of 10 tablets",
        price: 218,
        mrp: 218,
        discountedPrice: 185,
        sellingPrice: 185,
        stock: 320,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Azithral 500mg Tablet",
        genericName: "Azithromycin",
        manufacturer: "Alembic Pharmaceuticals",
        brand: "Alembic",
        description: "Macrolide antibiotic used for respiratory tract infections, tonsillitis, and skin infections.",
        category: "Antibiotics & Anti-infectives",
        dosageForm: "Tablet",
        strength: "500mg",
        packaging: "Strip of 5 tablets",
        packSize: "Strip of 5 tablets",
        price: 132,
        mrp: 132,
        discountedPrice: 112,
        sellingPrice: 112,
        stock: 350,
        requiresPrescription: true,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Becosules Z Capsules",
        genericName: "B-Complex Forte with Vitamin C and Zinc",
        manufacturer: "Pfizer Ltd",
        brand: "Pfizer",
        description: "Essential multi-vitamin capsules to replenish vitamin deficiency, cure mouth ulcers, and boost energy.",
        category: "Vitamins & Tonics",
        dosageForm: "Capsule",
        strength: "Multi-nutrient",
        packaging: "Strip of 20 capsules",
        packSize: "Strip of 20 capsules",
        price: 52,
        mrp: 52,
        discountedPrice: 44,
        sellingPrice: 44,
        stock: 500,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Gelusil MPS Antacid Liquid 200ml (Mint Flavour)",
        genericName: "Aluminium Hydroxide, Magnesium Hydroxide, Dimethicone",
        manufacturer: "Pfizer Ltd",
        brand: "Pfizer",
        description: "Fast liquid relief from acidity, heartburn, gas, and stomach upset with refreshing mint flavour.",
        category: "Digestive & Gastro",
        dosageForm: "Syrup",
        strength: "200ml",
        packaging: "Bottle of 200ml",
        packSize: "200 ml Bottle",
        price: 138,
        mrp: 138,
        discountedPrice: 118,
        sellingPrice: 118,
        stock: 220,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Betadine 10% Ointment 20g",
        genericName: "Povidone Iodine",
        manufacturer: "Win-Medicare",
        brand: "Win-Medicare",
        description: "Broad spectrum topical antiseptic ointment for minor cuts, wounds, burns, and surgical abrasion healing.",
        category: "Skin & Dermatology",
        dosageForm: "Ointment",
        strength: "10% w/w",
        packaging: "Tube of 20g",
        packSize: "20 g Tube",
        price: 125,
        mrp: 125,
        discountedPrice: 105,
        sellingPrice: 105,
        stock: 300,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Benadryl Cough Syrup 100ml",
        genericName: "Diphenhydramine, Ammonium Chloride, Sodium Citrate",
        manufacturer: "Johnson & Johnson",
        brand: "Johnson & Johnson",
        description: "Clinically proven cough formula that soothes irritated throat and provides relief from dry, hacking cough.",
        category: "Cold & Cough",
        dosageForm: "Syrup",
        strength: "100ml",
        packaging: "Bottle of 100ml",
        packSize: "100 ml Bottle",
        price: 120,
        mrp: 120,
        discountedPrice: 102,
        sellingPrice: 102,
        stock: 280,
        requiresPrescription: false,
        isActive: true,
        images: [
          "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80",
        ],
      },
    ];

    const createdMedicines = [];
    for (const med of medicinesData) {
      const doc = await Medicine.findOneAndUpdate({ name: med.name }, med, {
        upsert: true,
        new: true,
      });
      createdMedicines.push(doc);
    }

    // Link frequentlyBoughtTogether
    const dolo = createdMedicines.find((m) => m.name.includes("Dolo"));
    const becosules = createdMedicines.find((m) => m.name.includes("Becosules"));
    const pan40 = createdMedicines.find((m) => m.name.includes("Pan 40"));
    const augmentin = createdMedicines.find((m) => m.name.includes("Augmentin"));

    if (augmentin && pan40 && becosules) {
      await Medicine.updateOne(
        { _id: augmentin._id },
        { $set: { frequentlyBoughtTogether: [pan40._id, becosules._id] } }
      );
    }
    if (dolo && pan40) {
      await Medicine.updateOne(
        { _id: dolo._id },
        { $set: { frequentlyBoughtTogether: [pan40._id] } }
      );
    }
    console.log("✅ 10 Medicines seeded with frequently-bought-together links");

    // ==========================================
    // 4. SEED PET CARE CATEGORIES & PRODUCTS
    // ==========================================
    console.log("👉 Seeding Pet Care Categories & Products...");
    const petCategoriesData = [
      {
        name: "Pet Supplements",
        description: "Vitamins, calcium, joint support, and coat revitalizers for dogs and cats.",
        image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog", "cat", "all"],
        displayOrder: 1,
      },
      {
        name: "Prescription Diet",
        description: "Veterinary clinical diets for renal care, gastrointestinal, and urinary health.",
        image: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog", "cat", "all"],
        displayOrder: 2,
      },
      {
        name: "Dog Food",
        description: "Dry kibble and gravy meals formulated for puppy, adult, and senior dogs.",
        image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog"],
        displayOrder: 3,
      },
      {
        name: "Cat Food",
        description: "High-protein wet and dry cat food packed with taurine and omega fatty acids.",
        image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&auto=format&fit=crop&q=80",
        targetPets: ["cat"],
        displayOrder: 4,
      },
      {
        name: "Dog Treats",
        description: "Dental chews, training treats, raw-hide bones, and natural jerkies.",
        image: "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog"],
        displayOrder: 5,
      },
      {
        name: "Pet Grooming",
        description: "Anti-tick shampoos, detangling sprays, nail clippers, and deodorizers.",
        image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog", "cat", "all"],
        displayOrder: 6,
      },
      {
        name: "Pet Healthcare",
        description: "Flea & tick pipettes, dewormers, ear drops, and wound healing sprays.",
        image: "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog", "cat", "all"],
        displayOrder: 7,
      },
      {
        name: "Pet Accessories",
        description: "Leashes, comfortable collars, water dispensers, and chew toys.",
        image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&auto=format&fit=crop&q=80",
        targetPets: ["dog", "cat", "all"],
        displayOrder: 8,
      },
    ];

    for (const cat of petCategoriesData) {
      await PetCategory.findOneAndUpdate({ name: cat.name }, cat, { upsert: true });
    }

    const petProductsData = [
      {
        name: "Royal Canin Maxi Adult Dry Dog Food 4kg",
        category: "Dog Food",
        petType: "dog",
        brand: "Royal Canin",
        description: "Tailor-made nutrition for large breed adult dogs (26-44 kg). Supports optimal digestive health and joint maintenance.",
        price: 3100,
        discountedPrice: 2650,
        stock: 50,
        packSize: "4 kg Bag",
        lifeStage: "Adult",
        rating: 4.9,
        keyBenefits: ["Supports bone & joint health", "High digestibility with selected proteins", "Omega 3 (EPA/DHA) for glossy coat"],
        ingredients: "Dehydrated poultry protein, maize, wheat, animal fats, beet pulp, fish oil.",
        images: [
          "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Pedigree Pro Expert Nutrition Puppy Large Breed 3kg",
        category: "Dog Food",
        petType: "dog",
        brand: "Pedigree",
        description: "Professional puppy food containing colostrum, prebiotics, and essential minerals for healthy growth and immunity.",
        price: 1450,
        discountedPrice: 1240,
        stock: 80,
        packSize: "3 kg Bag",
        lifeStage: "Puppy",
        rating: 4.7,
        keyBenefits: ["Colostrum strengthens infant immune system", "Prebiotics support gentle digestion", "Optimal Calcium:Phosphorus ratio"],
        ingredients: "Cereals, meat meal, poultry meal, soybean meal, fish oil, vitamins & minerals.",
        images: [
          "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Whiskas Adult Ocean Fish Wet Cat Food Pouch (Pack of 12 x 85g)",
        category: "Cat Food",
        petType: "cat",
        brand: "Whiskas",
        description: "Delicious wet cat food gravy made with real ocean fish, high moisture content, and essential taurine for feline eyesight.",
        price: 600,
        discountedPrice: 499,
        stock: 120,
        packSize: "Pack of 12 (85g each)",
        lifeStage: "Adult",
        rating: 4.8,
        keyBenefits: ["Taurine protects feline heart & eyesight", "Hydrating gravy supports urinary tract", "Omega 6 and Zinc for shiny coat"],
        ingredients: "Real Ocean Fish, Chicken, Gelling agents, Vitamins & Minerals.",
        images: [
          "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Drools Absolute Calcium Dog Bone Treats (300g)",
        category: "Dog Treats",
        petType: "dog",
        brand: "Drools",
        description: "Enriched bone-shaped treats with calcium and phosphorus to promote strong teeth and joint flexibility in all breeds.",
        price: 299,
        discountedPrice: 225,
        stock: 150,
        packSize: "300 g Jar",
        lifeStage: "All Lifestages",
        rating: 4.6,
        keyBenefits: ["Satisfies natural chewing instincts", "Reduces tartar and cleans teeth", "Fortified with Vitamin D3"],
        ingredients: "Milk powder, calcium carbonate, poultry liver hydrolysate, wheat flour.",
        images: [
          "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Himalaya Erina-EP Anti-Tick & Flea Pet Shampoo 200ml",
        category: "Pet Grooming",
        petType: "all",
        brand: "Himalaya",
        description: "Ayurvedic antimicrobial shampoo with Neem and Eucalyptus to eradicate ticks, fleas, and lice while keeping coat silky soft.",
        price: 260,
        discountedPrice: 215,
        stock: 200,
        packSize: "200 ml Bottle",
        lifeStage: "All Lifestages",
        rating: 4.7,
        keyBenefits: ["Eradicates ticks, lice, and fleas naturally", "Soothes skin itching & prevents dandruff", "Zero harsh chemicals or parabens"],
        ingredients: "Neem (Nimba), Eucalyptus (Tailaparna), Base Q.S.",
        images: [
          "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Beaphar Bone Builder Calcium & Vitamin Supplement 500g",
        category: "Pet Supplements",
        petType: "all",
        brand: "Beaphar",
        description: "High-grade calcium, phosphorus, and vitamin D3 nutritional powder to support healthy bone growth in puppies and pregnant females.",
        price: 750,
        discountedPrice: 599,
        stock: 90,
        packSize: "500 g Tub",
        lifeStage: "All Lifestages",
        rating: 4.8,
        keyBenefits: ["Strengthens developing skeleton", "Prevents rickets & calcium deficiency", "Easy to mix with wet or dry food"],
        ingredients: "Dicalcium phosphate, calcium carbonate, magnesium oxide, brewer's yeast.",
        images: [
          "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Farmina N&D Pumpkin Lamb & Blueberry Grain-Free Cat Food 1.5kg",
        category: "Prescription Diet",
        petType: "cat",
        brand: "Farmina N&D",
        description: "Ultra-premium grain-free formula with 96% animal protein, pumpkin for digestive wellness, and blueberries rich in antioxidants.",
        price: 2190,
        discountedPrice: 1850,
        stock: 45,
        packSize: "1.5 kg Bag",
        lifeStage: "Adult",
        rating: 4.9,
        keyBenefits: ["Grain-free with low glycemic index", "Rich in natural antioxidants", "Pure grass-fed lamb protein"],
        ingredients: "Boneless lamb, dehydrated lamb protein, pumpkin, dried blueberries, herring oil.",
        images: [
          "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=80",
        ],
      },
      {
        name: "Bio-Groom Silky Cat & Kitten Conditioning Shampoo 355ml",
        category: "Pet Grooming",
        petType: "cat",
        brand: "Bio-Groom",
        description: "Mild tearless shampoo infused with Chamomile to gently clean, condition, and deodorize sensitive cat fur.",
        price: 850,
        discountedPrice: 699,
        stock: 60,
        packSize: "355 ml Bottle",
        lifeStage: "All Lifestages",
        rating: 4.8,
        keyBenefits: ["Tearless and pH balanced for cats", "Leaves fur glossy and tangle-free", "Biodegradable natural formula"],
        ingredients: "Purified water, coconut cleanser, Chamomile extract, natural silk proteins.",
        images: [
          "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=500&auto=format&fit=crop&q=80",
        ],
      },
    ];

    for (const prod of petProductsData) {
      await PetProduct.findOneAndUpdate({ name: prod.name }, prod, { upsert: true });
    }
    console.log("✅ 8 Pet Care Products seeded");

    console.log("🎉 ALL 4 MODULES HAVE BEEN SUCCESSFULLY SEEDED WITH PRODUCTION DATA!");
    return { success: true, message: "Comprehensive 4 modules seeded successfully" };
  } catch (error) {
    console.error("❌ Seed comprehensive modules error:", error);
    throw error;
  }
};

// Standalone execution support
if (process.argv[1]?.endsWith("comprehensive_modules.seed.js")) {
  connectDatabase()
    .then(async () => {
      await seedComprehensiveModules();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
