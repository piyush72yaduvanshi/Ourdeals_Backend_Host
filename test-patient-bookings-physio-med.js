import "./src/config/env.config.js";
import axios from 'axios';
import { connectDatabase } from "./src/utils/db.js";
import { User } from "./src/models/User.model.js";
import { tokenService } from "./src/services/token.service.js";

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api/v1`;

async function testPatientBookings() {
  console.log('Testing unified patient bookings endpoint...');
  await connectDatabase();

  let patient = await User.findOne({ role: "patient" });
  if (!patient) {
    patient = await User.create({
      email: "test.patient.verify@ourdeals.com",
      password: "Password@123",
      role: "patient",
      firstName: "Test",
      lastName: "Patient",
      phone: "+919999988888",
      city: "Jhansi",
      state: "Uttar Pradesh",
      pincode: "284001",
      location: { type: "Point", coordinates: [78.5788, 25.4484] },
    });
  }

  const token = tokenService.generateAccessToken({
    userId: patient._id.toString(),
    email: patient.email,
    role: patient.role,
  });

  // 1. Create a Physiotherapy Booking Request
  const physioPayload = {
    patientName: 'Test Patient',
    patientPhone: '+919999988888',
    patientAge: 30,
    patientGender: 'Male',
    service: 'Back & Neck Pain Physiotherapy',
    serviceCategory: 'Spine & Posture',
    location: {
      address: 'Test Address, Jhansi',
      city: 'Jhansi',
      state: 'Uttar Pradesh',
      coordinates: [78.5788, 25.4484]
    },
    scheduledDate: new Date().toISOString(),
    scheduledTimeSlot: '11:00 AM',
    notes: 'Test physio note',
  };

  const physioRes = await axios.post(`${BASE_URL}/physiotherapy/requests`, physioPayload, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Created Physio Booking Request:', physioRes.data.data?.bookingId || physioRes.data.data?._id);

  // 2. Fetch all bookings for patient via /patient/bookings
  const bookingsRes = await axios.get(`${BASE_URL}/patient/bookings`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const bookings = bookingsRes.data.data || [];
  console.log(`✅ Total bookings returned by /patient/bookings: ${bookings.length}`);

  const hasPhysio = bookings.some(b => b.serviceType === 'physiotherapy' || b.service?.includes('Physiotherapy'));
  console.log(`✅ Contains Physiotherapy Booking: ${hasPhysio}`);

  if (bookings.length > 0) {
    console.log('Sample booking found:');
    console.log(' - ID:', bookings[0]._id || bookings[0].id);
    console.log(' - ServiceType:', bookings[0].serviceType);
    console.log(' - Title:', bookings[0].title);
    console.log(' - Status:', bookings[0].status);
  }

  // 3. Fetch active bookings via /patient/bookings/active
  const activeRes = await axios.get(`${BASE_URL}/patient/bookings/active`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const activeBookings = activeRes.data.data || [];
  console.log(`✅ Total active bookings returned by /patient/bookings/active: ${activeBookings.length}`);

  process.exit(0);
}

testPatientBookings().catch(err => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
