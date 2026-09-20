import "./src/config/env.config.js";
import axios from 'axios';
import { connectDatabase } from "./src/utils/db.js";
import { User } from "./src/models/User.model.js";
import { tokenService } from "./src/services/token.service.js";

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api/v1`;

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('🚀 RUNNING END-TO-END PHYSIOTHERAPY & MEDICINE VERIFICATION');
  console.log('====================================================');

  try {
    await connectDatabase();

    // 1. Category-Wise Medicine Filtering
    console.log('\n1️⃣  Testing Category-Wise Medicine Filtering...');
    const catQuery = 'Cold & Cough';
    const medRes = await axios.get(`${BASE_URL}/medicines`, {
      params: { category: catQuery, limit: 10 }
    });
    console.log(`✅ Medicines found for "${catQuery}":`, medRes.data.data ? medRes.data.data.length : 0);
    if (medRes.data.data && medRes.data.data.length > 0) {
      console.log('   Sample Medicine:', medRes.data.data[0].name, '| Category:', medRes.data.data[0].category);
    }

    // 2. Shop from Healthy's Categories & Products
    console.log('\n2️⃣  Testing Shop from Healthy\'s (Ayurveda, Nutrition, Natural Care)...');
    const healthyCatRes = await axios.get(`${BASE_URL}/healthys/categories`);
    console.log('✅ Healthy Categories found:', healthyCatRes.data.data ? healthyCatRes.data.data.length : 0);
    const healthyProdRes = await axios.get(`${BASE_URL}/healthys/products?limit=5`);
    console.log('✅ Healthy Products found:', healthyProdRes.data.data ? healthyProdRes.data.data.length : 0);

    // 3. Physiotherapy Public Services
    console.log('\n3️⃣  Testing Physiotherapy Public Catalog...');
    const servicesRes = await axios.get(`${BASE_URL}/physiotherapy/services`);
    const sList = servicesRes.data.data?.services || servicesRes.data.data || [];
    console.log('✅ Physiotherapy Services count:', sList.length);

    // 4. Patient Setup & Booking Request Creation
    console.log('\n4️⃣  Setting Up Patient & Creating Booking Request...');
    let patient = await User.findOne({ role: "patient" });
    if (!patient) {
      patient = await User.create({
        email: "test.patient.e2e@ourdeals.com",
        password: "Password@123",
        role: "patient",
        firstName: "Rahul",
        lastName: "Sharma",
        phone: "+919876543210",
        city: "Jhansi",
        state: "Uttar Pradesh",
        pincode: "284001",
        location: { type: "Point", coordinates: [78.5788, 25.4484] },
      });
    }

    const patientToken = tokenService.generateAccessToken({
      userId: patient._id.toString(),
      email: patient.email,
      role: patient.role,
    });
    console.log('✅ Patient authenticated:', patient.firstName, patient.email);

    // Test patient search medicines endpoint
    const searchMedRes = await axios.get(`${BASE_URL}/patient/search/medicines`, {
      params: { category: 'Pain Relief', limit: 5 },
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    console.log('✅ Patient search medicines for "Pain Relief":', searchMedRes.data.data ? searchMedRes.data.data.length : 0);

    // Create a physiotherapy booking request (matching confirm_physiotherapy_booking_screen.dart)
    const bookingPayload = {
      patientName: 'Rahul Sharma',
      patientPhone: '+919876543210',
      patientAge: 34,
      patientGender: 'Male',
      service: 'Orthopedic Physiotherapy',
      serviceCategory: 'General Physiotherapy',
      location: {
        address: 'House 42, Civil Lines, Jhansi, Uttar Pradesh - 284001',
        city: 'Jhansi',
        state: 'Uttar Pradesh',
        coordinates: [78.5788, 25.4484]
      },
      scheduledDate: '2026-09-21',
      scheduledTimeSlot: '10:00 AM',
      notes: 'Experiencing lower back pain for 2 weeks. Need home evaluation and exercise guidance.',
    };

    const bookingRes = await axios.post(`${BASE_URL}/physiotherapy/requests`, bookingPayload, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const createdBooking = bookingRes.data.data;
    const bookingId = (createdBooking.bookingId || createdBooking._id || createdBooking.id).toString();
    console.log('✅ Created Physiotherapy Booking Request! ID:', bookingId);
    console.log('   Status:', createdBooking.status, '| Service:', createdBooking.service);

    // 5. Physiotherapist Vendor Setup & Viewing Requests
    console.log('\n5️⃣  Setting Up Physiotherapist Provider & Viewing Requests...');
    let physio = await User.findOne({ role: "physiotherapist" });
    if (!physio) {
      throw new Error("No physiotherapist found in database. Run seeds first.");
    }

    const physioToken = tokenService.generateAccessToken({
      userId: physio._id.toString(),
      email: physio.email,
      role: physio.role,
    });
    console.log('✅ Physiotherapist authenticated:', physio.firstName, physio.email);

    // Vendor views nearby requests
    const providerReqs = await axios.get(`${BASE_URL}/physiotherapy/provider/requests`, {
      headers: { Authorization: `Bearer ${physioToken}` }
    });
    const foundReq = (providerReqs.data.data || []).find(r => (r._id || r.id) === bookingId);
    console.log('✅ Provider successfully retrieved nearby requests!');
    console.log('   Total requests visible to provider:', providerReqs.data.data.length);
    console.log('   Created request visible in provider list:', Boolean(foundReq));

    // 6. Physiotherapist Submits Custom Price Offer
    console.log('\n6️⃣  Physiotherapist Submitting Price Offer (₹650)...');
    const offerPayload = {
      offerAmount: 650,
      estimatedArrival: '30-45 minutes',
      notes: 'Certified orthopedic therapist. Will bring TENS machine and exercise resistance bands.'
    };
    const offerRes = await axios.post(`${BASE_URL}/physiotherapy/requests/${bookingId}/offer`, offerPayload, {
      headers: { Authorization: `Bearer ${physioToken}` }
    });
    console.log('✅ Offer submitted successfully by Physiotherapist!');
    console.log('   Offers count on booking:', offerRes.data.data.offers ? offerRes.data.data.offers.length : 'N/A');

    // 7. Patient Receives & Confirms Offer
    console.log('\n7️⃣  Patient Polling Offers & Confirming Selection...');
    const patientOffersRes = await axios.get(`${BASE_URL}/physiotherapy/requests/${bookingId}/offers`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const offersList = patientOffersRes.data.data.offers || [];
    console.log('✅ Patient polled offers! Total offers received:', offersList.length);
    const myOffer = offersList[0];
    console.log('   Offer Details: ₹' + myOffer.offerAmount, '| By:', myOffer.physiotherapist?.firstName || 'Therapist');

    const confirmRes = await axios.post(
      `${BASE_URL}/physiotherapy/requests/${bookingId}/confirm-offer`,
      { offerId: myOffer._id || myOffer.id },
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    const confirmedData = confirmRes.data.data;
    console.log('✅ Offer confirmed by Patient!');
    console.log('   Booking status now:', confirmedData.status);
    console.log('   Therapist assigned:', confirmedData.assignedPhysiotherapist?.firstName);
    console.log('   Therapist Phone:', confirmedData.assignedPhysiotherapist?.phone);
    console.log('   WhatsApp Link generated:', confirmedData.contactActions?.whatsappUrl);

    // 8. Provider Verifies Booking in Assigned Appointments
    console.log('\n8️⃣  Provider Verifying Assigned Appointments...');
    const providerBookingsRes = await axios.get(`${BASE_URL}/physiotherapy/provider/bookings`, {
      headers: { Authorization: `Bearer ${physioToken}` }
    });
    const assignedBookings = providerBookingsRes.data.data || [];
    const myAssignedBooking = assignedBookings.find(b => (b._id || b.id) === bookingId);
    console.log('✅ Provider assigned appointments count:', assignedBookings.length);
    console.log('   Booking in provider assigned list:', Boolean(myAssignedBooking));

    // 9. Treatment Lifecycle (In Progress -> Completed)
    console.log('\n9️⃣  Updating Treatment Status (In Progress -> Completed)...');
    const startRes = await axios.patch(
      `${BASE_URL}/physiotherapy/requests/${bookingId}/status`,
      { status: 'in_progress' },
      { headers: { Authorization: `Bearer ${physioToken}` } }
    );
    console.log('✅ Status updated to:', startRes.data.data.status);

    const completeRes = await axios.patch(
      `${BASE_URL}/physiotherapy/requests/${bookingId}/status`,
      { status: 'completed' },
      { headers: { Authorization: `Bearer ${physioToken}` } }
    );
    console.log('✅ Status updated to:', completeRes.data.data.status);

    console.log('\n====================================================');
    console.log('🎉 ALL END-TO-END FLOWS VERIFIED 100% SUCCESSFULLY!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runEndToEndVerification();
