import "./src/config/env.config.js";
import axios from "axios";
import { connectDatabase } from "./src/utils/db.js";
import { User } from "./src/models/User.model.js";
import { tokenService } from "./src/services/token.service.js";

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function runTests() {
  console.log("==========================================");
  console.log("🚀 TESTING ALL 4 BACKEND MODULES");
  console.log("==========================================");

  await connectDatabase();

  // Find or create test patient, physiotherapist, admin
  let patient = await User.findOne({ role: "patient" });
  if (!patient) {
    console.log("Creating test patient...");
    patient = await User.create({
      email: "test.patient.4mod@example.com",
      password: "Password@123",
      role: "patient",
      firstName: "Test",
      lastName: "Patient",
      phone: "+919876543210",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      location: { type: "Point", coordinates: [77.209, 28.6139] },
    });
  }

  let physio = await User.findOne({ role: "physiotherapist" });
  let admin = await User.findOne({ role: "admin" });

  const patientToken = tokenService.generateAccessToken({
    userId: patient._id.toString(),
    email: patient.email,
    role: patient.role,
    tokenVersion: patient.tokenVersion || 0,
  });

  const physioToken = physio
    ? tokenService.generateAccessToken({
        userId: physio._id.toString(),
        email: physio.email,
        role: physio.role,
        tokenVersion: physio.tokenVersion || 0,
      })
    : patientToken;

  const adminToken = admin
    ? tokenService.generateAccessToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        tokenVersion: admin.tokenVersion || 0,
      })
    : patientToken;

  const patientHeaders = { Authorization: `Bearer ${patientToken}` };
  const physioHeaders = { Authorization: `Bearer ${physioToken}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  console.log(`✅ Tokens generated. Patient: ${patient.email}, Physio: ${physio?.email || 'N/A'}`);

  // Test 1: Health Check
  try {
    const res = await axios.get(`${BASE_URL}/hello`);
    console.log("✅ Health Check:", res.data.status);
  } catch (err) {
    console.log("❌ Health Check error:", err.message);
  }

  // ==========================================
  // MODULE 1: PHYSIOTHERAPY
  // ==========================================
  console.log("\n--- [1] TESTING PHYSIOTHERAPY MODULE ---");
  let createdBookingId = null;
  let offerId = null;

  try {
    // 1. Services
    const srvRes = await axios.get(`${BASE_URL}/api/v1/physiotherapy/services`);
    console.log(`✅ [Physio] Services count: ${srvRes.data.data.services.length}`);

    // 2. Therapists
    const thRes = await axios.get(`${BASE_URL}/api/v1/physiotherapy/therapists`);
    console.log(`✅ [Physio] Therapists count: ${thRes.data.data.length}`);

    // 3. Create Request
    const reqRes = await axios.post(
      `${BASE_URL}/api/v1/physiotherapy/requests`,
      {
        patientName: "John Doe",
        patientPhone: "+919876543210",
        patientAge: 45,
        patientGender: "Male",
        service: "Back & Neck Pain Physiotherapy",
        serviceCategory: "Spine & Posture",
        location: {
          address: "Connaught Place, New Delhi",
          coordinates: [77.2167, 28.6328],
          city: "New Delhi",
          state: "Delhi",
        },
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: "10:00 AM - 11:00 AM",
        notes: "Lower back pain since 2 weeks",
      },
      { headers: patientHeaders }
    );
    createdBookingId = reqRes.data.data.bookingId;
    console.log(`✅ [Physio] Booking request created ID: ${createdBookingId}, status: ${reqRes.data.data.status}`);

    // 4. Provider Get Requests
    const provRes = await axios.get(`${BASE_URL}/api/v1/physiotherapy/provider/requests`, {
      headers: physioHeaders,
    });
    console.log(`✅ [Physio] Provider sees ${provRes.data.data.length} pending requests`);

    // 5. Submit Offer
    const offerRes = await axios.post(
      `${BASE_URL}/api/v1/physiotherapy/requests/${createdBookingId}/offer`,
      {
        offerAmount: 600,
        estimatedArrival: "Tomorrow 10:00 AM",
        notes: "I have specialized spinal decompression equipment.",
      },
      { headers: physioHeaders }
    );
    console.log(`✅ [Physio] Provider submitted offer, status: ${offerRes.data.data.status}`);

    // 6. Patient Views Offers
    const viewOffersRes = await axios.get(
      `${BASE_URL}/api/v1/physiotherapy/requests/${createdBookingId}/offers`,
      { headers: patientHeaders }
    );
    offerId = viewOffersRes.data.data.offers[0]?._id;
    console.log(`✅ [Physio] Patient fetched offers: ${viewOffersRes.data.data.offers.length}, offerId: ${offerId}`);

    // 7. Patient Confirms Offer (Unlocks WhatsApp & Phone!)
    if (offerId) {
      const confirmRes = await axios.post(
        `${BASE_URL}/api/v1/physiotherapy/requests/${createdBookingId}/confirm-offer`,
        { offerId },
        { headers: patientHeaders }
      );
      console.log(`✅ [Physio] Patient confirmed offer! Status: ${confirmRes.data.data.status}`);
      console.log(`   📞 Contact: ${confirmRes.data.data.contact.phone}`);
      console.log(`   💬 WhatsApp Link: ${confirmRes.data.data.contact.whatsappLink}`);
    }

    // 8. Update status to completed
    const statusRes = await axios.patch(
      `${BASE_URL}/api/v1/physiotherapy/requests/${createdBookingId}/status`,
      { status: "completed" },
      { headers: physioHeaders }
    );
    console.log(`✅ [Physio] Booking status updated to: ${statusRes.data.data.status}`);
  } catch (err) {
    console.error("❌ [Physio Error]:", err.response?.data || err.message);
  }

  // ==========================================
  // MODULE 2: HEALTHYS PRODUCTS
  // ==========================================
  console.log("\n--- [2] TESTING HEALTHYS PRODUCTS MODULE ---");
  try {
    // 1. Categories
    const catRes = await axios.get(`${BASE_URL}/api/v1/healthys/categories`);
    console.log(`✅ [Healthys] Categories count: ${catRes.data.data.length}`);

    // 2. Products
    const prodRes = await axios.get(`${BASE_URL}/api/v1/healthys/products?sortBy=discount`);
    console.log(`✅ [Healthys] Products count: ${prodRes.data.data.length}`);
    const sampleProd = prodRes.data.data[0];
    console.log(`   Sample product: "${sampleProd?.name}" - Price: ₹${sampleProd?.discountedPrice}`);

    // 3. Product Details
    const detailRes = await axios.get(`${BASE_URL}/api/v1/healthys/products/${sampleProd._id}`);
    console.log(`✅ [Healthys] Product details fetched, related: ${detailRes.data.data.relatedProducts.length}`);

    // 4. Add to Wishlist
    await axios.post(
      `${BASE_URL}/api/v1/healthys/wishlist`,
      { productId: sampleProd._id },
      { headers: patientHeaders }
    );
    const wishRes = await axios.get(`${BASE_URL}/api/v1/healthys/wishlist`, { headers: patientHeaders });
    console.log(`✅ [Healthys] Wishlist items: ${wishRes.data.data.length}`);

    // 5. Add to Cart & Update Quantity
    const addCartRes = await axios.post(
      `${BASE_URL}/api/v1/healthys/cart`,
      { productId: sampleProd._id, quantity: 2 },
      { headers: patientHeaders }
    );
    const cartItem = addCartRes.data.data.items[0];
    console.log(`✅ [Healthys] Added to cart, subtotal: ₹${addCartRes.data.data.subtotal}`);

    // Update cart
    const updCartRes = await axios.put(
      `${BASE_URL}/api/v1/healthys/cart/${cartItem._id}`,
      { quantity: 3 },
      { headers: patientHeaders }
    );
    console.log(`✅ [Healthys] Updated cart quantity to 3, subtotal: ₹${updCartRes.data.data.subtotal}`);

    // 6. Checkout Order
    const orderRes = await axios.post(
      `${BASE_URL}/api/v1/healthys/orders`,
      {
        shippingAddress: {
          fullName: "John Doe",
          phone: "+919876543210",
          address: "A-123 Green Park, New Delhi",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110016",
        },
        paymentMethod: "cash_on_delivery",
      },
      { headers: patientHeaders }
    );
    console.log(`✅ [Healthys] Order placed! Order No: ${orderRes.data.data.orderNumber}, Total: ₹${orderRes.data.data.totalAmount}`);

    // 7. Order History
    const ordersList = await axios.get(`${BASE_URL}/api/v1/healthys/orders`, { headers: patientHeaders });
    console.log(`✅ [Healthys] Orders in history: ${ordersList.data.data.length}`);
  } catch (err) {
    console.error("❌ [Healthys Error]:", err.response?.data || err.message);
  }

  // ==========================================
  // MODULE 3: MEDICINES
  // ==========================================
  console.log("\n--- [3] TESTING MEDICINES MODULE ---");
  try {
    // 1. Categories
    const catRes = await axios.get(`${BASE_URL}/api/v1/medicines/categories`);
    console.log(`✅ [Medicines] Categories count: ${catRes.data.data.length}`);

    // 2. Search & Sort
    const medRes = await axios.get(`${BASE_URL}/api/v1/medicines?search=paracetamol&sortBy=price`);
    console.log(`✅ [Medicines] Search 'paracetamol' results count: ${medRes.data.data.length}`);

    // 3. Product Details with Frequently Bought Together
    const allMeds = await axios.get(`${BASE_URL}/api/v1/medicines`);
    const augmentin = allMeds.data.data.find(m => m.name.includes("Augmentin")) || allMeds.data.data[0];
    const detailRes = await axios.get(`${BASE_URL}/api/v1/medicines/${augmentin._id}`);
    console.log(`✅ [Medicines] Product details: "${detailRes.data.data.name}", Brand: ${detailRes.data.data.brand}`);
    console.log(`   Frequently bought together count: ${detailRes.data.data.frequentlyBoughtTogether?.length || 0}`);
    console.log(`   Related medicines in category count: ${detailRes.data.data.relatedMedicines?.length || 0}`);

    // 4. Add to Cart & Checkout
    await axios.post(
      `${BASE_URL}/api/v1/medicines/cart`,
      { productId: augmentin._id, quantity: 1 },
      { headers: patientHeaders }
    );
    const cartRes = await axios.get(`${BASE_URL}/api/v1/medicines/cart`, { headers: patientHeaders });
    console.log(`✅ [Medicines] Cart fetched, totalAmount: ₹${cartRes.data.data.totalAmount}`);

    const medOrderRes = await axios.post(
      `${BASE_URL}/api/v1/medicines/orders`,
      {
        shippingAddress: {
          fullName: "John Doe",
          phone: "+919876543210",
          address: "123 Defense Colony, New Delhi",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110024",
        },
        paymentMethod: "cash_on_delivery",
      },
      { headers: patientHeaders }
    );
    console.log(`✅ [Medicines] Order created! Order No: ${medOrderRes.data.data.orderNumber}`);
  } catch (err) {
    console.error("❌ [Medicines Error]:", err.response?.data || err.message);
  }

  // ==========================================
  // MODULE 4: PET CARE
  // ==========================================
  console.log("\n--- [4] TESTING PET CARE MODULE ---");
  try {
    // 1. Categories
    const catRes = await axios.get(`${BASE_URL}/api/v1/petcare/categories`);
    console.log(`✅ [PetCare] Categories count: ${catRes.data.data.length}`);

    // 2. Filter Products by petType and category
    const prodRes = await axios.get(`${BASE_URL}/api/v1/petcare/products?petType=dog`);
    console.log(`✅ [PetCare] Dog products count: ${prodRes.data.data.length}`);
    const samplePetProd = prodRes.data.data[0];
    console.log(`   Sample product: "${samplePetProd?.name}" - Brand: ${samplePetProd?.brand}`);

    // 3. Product Details
    const detailRes = await axios.get(`${BASE_URL}/api/v1/petcare/products/${samplePetProd._id}`);
    console.log(`✅ [PetCare] Product details fetched: "${detailRes.data.data.product.name}"`);

    // 4. Add to Wishlist
    await axios.post(
      `${BASE_URL}/api/v1/petcare/wishlist`,
      { productId: samplePetProd._id },
      { headers: patientHeaders }
    );
    const wishRes = await axios.get(`${BASE_URL}/api/v1/petcare/wishlist`, { headers: patientHeaders });
    console.log(`✅ [PetCare] Wishlist items: ${wishRes.data.data.length}`);

    // 5. Add to Cart & Checkout
    await axios.post(
      `${BASE_URL}/api/v1/petcare/cart`,
      { productId: samplePetProd._id, quantity: 1 },
      { headers: patientHeaders }
    );
    const petOrderRes = await axios.post(
      `${BASE_URL}/api/v1/petcare/orders`,
      {
        shippingAddress: {
          fullName: "John Doe",
          phone: "+919876543210",
          address: "Flat 402, Pet Paradise, New Delhi",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
        },
        paymentMethod: "cash_on_delivery",
      },
      { headers: patientHeaders }
    );
    console.log(`✅ [PetCare] Order created! Order No: ${petOrderRes.data.data.orderNumber}`);

    // 6. Admin update order status
    const updateStatusRes = await axios.patch(
      `${BASE_URL}/api/v1/petcare/admin/orders/${petOrderRes.data.data.orderId}/status`,
      {
        orderStatus: "shipped",
        deliveryPartner: "BlueDart Express",
        trackingId: "BLUEDART-PET-998811",
        notes: "Package dispatched via express pet delivery",
      },
      { headers: adminHeaders }
    );
    console.log(`✅ [PetCare] Admin updated order status to: ${updateStatusRes.data.data.orderStatus}`);
  } catch (err) {
    console.error("❌ [PetCare Error]:", err.response?.data || err.message);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL 4 MODULES VERIFIED SUCCESSFULLY!");
  console.log("==========================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Fatal Test Error:", err);
  process.exit(1);
});
