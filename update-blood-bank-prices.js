import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const bloodBankSchema = new mongoose.Schema({
  bloodStock: [{
    bloodGroup: String,
    unitsAvailable: Number,
    pricePerUnit: Number,
    lastUpdated: Date
  }]
}, { strict: false });

const BloodBank = mongoose.model('User', bloodBankSchema);

async function updateBloodBankPrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update all blood banks to add pricePerUnit if missing
    const bloodBanks = await BloodBank.find({ role: 'bloodbank' });
    
    console.log(`Found ${bloodBanks.length} blood banks`);

    for (const bloodBank of bloodBanks) {
      let updated = false;
      
      if (bloodBank.bloodStock && bloodBank.bloodStock.length > 0) {
        bloodBank.bloodStock.forEach(stock => {
          if (!stock.pricePerUnit || stock.pricePerUnit === 0) {
            // Set default prices based on blood group
            const prices = {
              'A+': 500,
              'A-': 550,
              'B+': 500,
              'B-': 550,
              'AB+': 600,
              'AB-': 650,
              'O+': 500,
              'O-': 600
            };
            stock.pricePerUnit = prices[stock.bloodGroup] || 500;
            updated = true;
          }
        });

        if (updated) {
          await bloodBank.save();
          console.log(`Updated prices for blood bank: ${bloodBank.bankName || bloodBank.firstName}`);
        }
      }
    }

    console.log('All blood banks updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateBloodBankPrices();
