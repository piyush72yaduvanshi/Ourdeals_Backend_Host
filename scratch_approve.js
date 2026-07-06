import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully!");

    // Query users collection directly using mongoose connection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // 1. Find the vendor users by phone
    const phones = ["+919999999992", "9999999992", "+919999999996", "9999999996"];
    console.log("Searching for vendors with phones:", phones);
    
    const vendors = await usersCollection.find({ 
      phone: { $in: phones } 
    }).toArray();

    console.log(`Found ${vendors.length} vendors in database:`);
    vendors.forEach(v => {
      console.log(`- Name: ${v.firstName} ${v.lastName}, ID: ${v._id}, Role: ${v.role}, Status: ${v.status}, Phone: ${v.phone}`);
    });

    // 2. Find any admin user in the system to see if one exists
    const admins = await usersCollection.find({ role: 'admin' }).toArray();
    console.log(`Found ${admins.length} admin users:`);
    admins.forEach(a => {
      console.log(`- Admin Email: ${a.email}, Phone: ${a.phone}, ID: ${a._id}`);
    });

    // 3. Update the vendors to status: "approved"
    if (vendors.length > 0) {
      console.log("Approving vendors in DB...");
      const result = await usersCollection.updateMany(
        { phone: { $in: phones } },
        { $set: { status: 'approved', isActive: true, isVerified: true } }
      );
      console.log("Updated count:", result.modifiedCount);
    }

    // Verify after update
    const updatedVendors = await usersCollection.find({ 
      phone: { $in: phones } 
    }).toArray();
    console.log("Updated vendors status:");
    updatedVendors.forEach(v => {
      console.log(`- Phone: ${v.phone}, New Status: ${v.status}, isVerified: ${v.isVerified}`);
    });

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
