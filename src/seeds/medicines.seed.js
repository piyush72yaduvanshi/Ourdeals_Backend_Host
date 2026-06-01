import { Medicine } from '../models/Medicine.model.js';
import { logger } from '../utils/logger.util.js';

const medicines = [
  // Pain Relief & Fever
  {
    name: 'Paracetamol 500mg',
    genericName: 'Acetaminophen',
    manufacturer: 'GlaxoSmithKline',
    description: 'Effective pain relief and fever reducer',
    category: 'Pain Relief',
    dosageForm: 'Tablet',
    strength: '500mg',
    packaging: 'Strip of 10 tablets',
    price: 15,
    discountedPrice: 12,
    stock: 500,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Paracetamol+500mg'],
  },
  {
    name: 'Crocin Advance',
    genericName: 'Paracetamol',
    manufacturer: 'GSK',
    description: 'Fast acting pain and fever relief',
    category: 'Pain Relief',
    dosageForm: 'Tablet',
    strength: '500mg',
    packaging: 'Strip of 15 tablets',
    price: 25,
    discountedPrice: 20,
    stock: 300,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Crocin+Advance'],
  },
  {
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    manufacturer: 'Abbott',
    description: 'Anti-inflammatory pain reliever',
    category: 'Pain Relief',
    dosageForm: 'Tablet',
    strength: '400mg',
    packaging: 'Strip of 10 tablets',
    price: 30,
    discountedPrice: 25,
    stock: 400,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Ibuprofen+400mg'],
  },

  // Cold & Cough
  {
    name: 'Vicks Cough Syrup',
    genericName: 'Dextromethorphan',
    manufacturer: 'Procter & Gamble',
    description: 'Relief from dry cough',
    category: 'Cold & Cough',
    dosageForm: 'Syrup',
    strength: '100ml',
    packaging: 'Bottle',
    price: 85,
    discountedPrice: 75,
    stock: 200,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Vicks+Cough+Syrup'],
  },
  {
    name: 'Cetrizine 10mg',
    genericName: 'Cetirizine',
    manufacturer: 'Cipla',
    description: 'Antihistamine for allergies',
    category: 'Cold & Cough',
    dosageForm: 'Tablet',
    strength: '10mg',
    packaging: 'Strip of 10 tablets',
    price: 20,
    discountedPrice: 18,
    stock: 350,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Cetrizine+10mg'],
  },

  // Diabetes
  {
    name: 'Metformin 500mg',
    genericName: 'Metformin Hydrochloride',
    manufacturer: 'Sun Pharma',
    description: 'Type 2 diabetes management',
    category: 'Diabetes',
    dosageForm: 'Tablet',
    strength: '500mg',
    packaging: 'Strip of 15 tablets',
    price: 45,
    discountedPrice: 40,
    stock: 250,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Metformin+500mg'],
  },
  {
    name: 'Glimepiride 2mg',
    genericName: 'Glimepiride',
    manufacturer: 'Torrent',
    description: 'Blood sugar control',
    category: 'Diabetes',
    dosageForm: 'Tablet',
    strength: '2mg',
    packaging: 'Strip of 10 tablets',
    price: 55,
    discountedPrice: 50,
    stock: 180,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Glimepiride+2mg'],
  },

  // Blood Pressure
  {
    name: 'Amlodipine 5mg',
    genericName: 'Amlodipine Besylate',
    manufacturer: 'Pfizer',
    description: 'High blood pressure treatment',
    category: 'Blood Pressure',
    dosageForm: 'Tablet',
    strength: '5mg',
    packaging: 'Strip of 10 tablets',
    price: 35,
    discountedPrice: 30,
    stock: 300,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Amlodipine+5mg'],
  },
  {
    name: 'Telmisartan 40mg',
    genericName: 'Telmisartan',
    manufacturer: 'Dr. Reddy\'s',
    description: 'Hypertension management',
    category: 'Blood Pressure',
    dosageForm: 'Tablet',
    strength: '40mg',
    packaging: 'Strip of 15 tablets',
    price: 65,
    discountedPrice: 60,
    stock: 220,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Telmisartan+40mg'],
  },

  // Antibiotics
  {
    name: 'Azithromycin 500mg',
    genericName: 'Azithromycin',
    manufacturer: 'Cipla',
    description: 'Broad spectrum antibiotic',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '500mg',
    packaging: 'Strip of 3 tablets',
    price: 90,
    discountedPrice: 85,
    stock: 150,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Azithromycin+500mg'],
  },
  {
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    manufacturer: 'Ranbaxy',
    description: 'Bacterial infection treatment',
    category: 'Antibiotics',
    dosageForm: 'Capsule',
    strength: '500mg',
    packaging: 'Strip of 10 capsules',
    price: 75,
    discountedPrice: 70,
    stock: 200,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Amoxicillin+500mg'],
  },

  // Vitamins & Supplements
  {
    name: 'Vitamin D3 60000 IU',
    genericName: 'Cholecalciferol',
    manufacturer: 'Mankind',
    description: 'Bone health supplement',
    category: 'Vitamins',
    dosageForm: 'Capsule',
    strength: '60000 IU',
    packaging: 'Strip of 4 capsules',
    price: 120,
    discountedPrice: 110,
    stock: 280,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Vitamin+D3'],
  },
  {
    name: 'Multivitamin Tablets',
    genericName: 'Multivitamin',
    manufacturer: 'HealthKart',
    description: 'Daily nutritional supplement',
    category: 'Vitamins',
    dosageForm: 'Tablet',
    strength: 'Standard',
    packaging: 'Bottle of 60 tablets',
    price: 350,
    discountedPrice: 320,
    stock: 150,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Multivitamin'],
  },

  // Digestive Health
  {
    name: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    manufacturer: 'Cadila',
    description: 'Acid reflux and heartburn relief',
    category: 'Digestive',
    dosageForm: 'Capsule',
    strength: '20mg',
    packaging: 'Strip of 10 capsules',
    price: 40,
    discountedPrice: 35,
    stock: 320,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Omeprazole+20mg'],
  },
  {
    name: 'Digene Gel',
    genericName: 'Antacid',
    manufacturer: 'Abbott',
    description: 'Quick relief from acidity',
    category: 'Digestive',
    dosageForm: 'Gel',
    strength: '200ml',
    packaging: 'Bottle',
    price: 95,
    discountedPrice: 85,
    stock: 180,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Digene+Gel'],
  },

  // Skin Care
  {
    name: 'Betnovate Cream',
    genericName: 'Betamethasone',
    manufacturer: 'GSK',
    description: 'Skin inflammation treatment',
    category: 'Skin Care',
    dosageForm: 'Cream',
    strength: '20g',
    packaging: 'Tube',
    price: 110,
    discountedPrice: 100,
    stock: 140,
    requiresPrescription: true,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Betnovate+Cream'],
  },

  // First Aid
  {
    name: 'Dettol Antiseptic Liquid',
    genericName: 'Chloroxylenol',
    manufacturer: 'Reckitt Benckiser',
    description: 'Antiseptic disinfectant',
    category: 'First Aid',
    dosageForm: 'Liquid',
    strength: '500ml',
    packaging: 'Bottle',
    price: 145,
    discountedPrice: 135,
    stock: 250,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Dettol+Antiseptic'],
  },
  {
    name: 'Band-Aid Strips',
    genericName: 'Adhesive Bandage',
    manufacturer: 'Johnson & Johnson',
    description: 'Wound protection strips',
    category: 'First Aid',
    dosageForm: 'Strip',
    strength: 'Standard',
    packaging: 'Box of 20 strips',
    price: 65,
    discountedPrice: 60,
    stock: 400,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Band-Aid+Strips'],
  },

  // Baby Care
  {
    name: 'Gripe Water',
    genericName: 'Herbal Digestive',
    manufacturer: 'Woodward\'s',
    description: 'Relief from colic and gas in babies',
    category: 'Baby Care',
    dosageForm: 'Liquid',
    strength: '130ml',
    packaging: 'Bottle',
    price: 85,
    discountedPrice: 80,
    stock: 160,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Gripe+Water'],
  },

  // Women's Health
  {
    name: 'Folic Acid 5mg',
    genericName: 'Folic Acid',
    manufacturer: 'Sun Pharma',
    description: 'Prenatal vitamin supplement',
    category: 'Women\'s Health',
    dosageForm: 'Tablet',
    strength: '5mg',
    packaging: 'Strip of 10 tablets',
    price: 25,
    discountedPrice: 22,
    stock: 300,
    requiresPrescription: false,
    isActive: true,
    images: ['https://via.placeholder.com/300x300.png?text=Folic+Acid+5mg'],
  },
];

export const seedMedicines = async () => {
  try {
    // Check if medicines already exist
    const count = await Medicine.countDocuments();
    
    if (count > 0) {
      logger.info(`Medicines already seeded (${count} medicines found)`);
      return;
    }

    // Insert medicines
    await Medicine.insertMany(medicines);
    logger.info(`✅ Successfully seeded ${medicines.length} medicines`);
  } catch (error) {
    logger.error('Failed to seed medicines', { error: error.message });
    throw error;
  }
};

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import('../config/database.js').then(async ({ connectDB }) => {
    await connectDB();
    await seedMedicines();
    process.exit(0);
  });
}
