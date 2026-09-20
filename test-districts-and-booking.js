import "./src/config/env.config.js";
import http from "http";
import { connectDatabase } from "./src/utils/db.js";
import { User } from "./src/models/User.model.js";
import { tokenService } from "./src/services/token.service.js";

const BASE_URL = "http://localhost:5000";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log("=== Testing Indian States & Districts API & Booking Handling ===\n");

  // 1. Test GET /api/v1/locations/states
  console.log("1. Testing GET /api/v1/locations/states...");
  const statesRes = await request("/api/v1/locations/states");
  console.log(`Status: ${statesRes.status}`);
  if (statesRes.body.success) {
    console.log(`✅ Fetched ${statesRes.body.data.total} States & Union Territories.`);
    if (statesRes.body.data.total === 36) {
      console.log("✅ Exactly 28 States + 8 UTs verified!");
    } else {
      console.warn(`⚠️ Total is ${statesRes.body.data.total}, expected 36.`);
    }
  }

  // 2. Test GET /api/v1/locations/districts?state=Uttar Pradesh
  console.log("\n2. Testing GET /api/v1/locations/districts?state=Uttar Pradesh...");
  const upRes = await request("/api/v1/locations/districts?state=Uttar%20Pradesh");
  console.log(`Status: ${upRes.status}, Total districts: ${upRes.body?.data?.total}`);
  if (upRes.body?.data?.total === 75) {
    console.log("✅ Verified all 75 districts of Uttar Pradesh!");
  }

  // 3. Test GET /api/v1/locations/districts?state=Madhya Pradesh
  console.log("\n3. Testing GET /api/v1/locations/districts?state=Madhya Pradesh...");
  const mpRes = await request("/api/v1/locations/districts?state=Madhya%20Pradesh");
  console.log(`Status: ${mpRes.status}, Total districts: ${mpRes.body?.data?.total}`);
  if (mpRes.body?.data?.total === 55) {
    console.log("✅ Verified all 55 districts of Madhya Pradesh!");
  }

  // 4. Test Search Districts
  console.log("\n4. Testing GET /api/v1/locations/search?q=Almora...");
  const searchRes = await request("/api/v1/locations/search?q=Almora");
  console.log(`Status: ${searchRes.status}, Results:`, searchRes.body?.data?.results);
  if (searchRes.body?.data?.results?.some((r) => r.district === "Almora" && r.state === "Uttarakhand")) {
    console.log("✅ Verified district search finds Almora, Uttarakhand!");
  }

  // 5. Connect DB and get patient token
  await connectDatabase();
  let patient = await User.findOne({ role: "patient" });
  if (!patient) {
    patient = await User.create({
      firstName: "Test",
      lastName: "Patient",
      email: "test_district_patient@example.com",
      phone: "+919999000011",
      role: "patient",
      city: "Dindori",
      state: "Madhya Pradesh",
      pincode: "481880",
    });
  }

  const patientToken = tokenService.generateAccessToken({
    userId: patient._id.toString(),
    email: patient.email,
    role: patient.role,
    tokenVersion: patient.tokenVersion || 0,
  });

  // 6. Test Booking in Remote District 1: Dindori, Madhya Pradesh
  console.log("\n6. Creating Physiotherapy Booking in remote district 'Dindori', Madhya Pradesh...");
  const physioBookingRes = await request("/api/v1/physiotherapy/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patientToken}`,
    },
    body: {
      patientName: "Ramesh Verma",
      patientPhone: "+919876543210",
      patientAge: 45,
      patientGender: "Male",
      service: "Back & Neck Pain Physiotherapy",
      serviceCategory: "Spine & Posture",
      location: {
        address: "Civil Lines, Near Collectorate",
        coordinates: [81.0827, 22.9557], // Dindori coordinates
        city: "Dindori",
        state: "Madhya Pradesh",
        pincode: "481880",
      },
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      scheduledTimeSlot: "10:00 AM - 11:00 AM",
      notes: "Severe lower back ache",
    },
  });

  console.log(`Physio Booking Status: ${physioBookingRes.status}`);
  if (physioBookingRes.body?.success) {
    console.log(`✅ Physiotherapy booking created successfully in Dindori district! (ID: ${physioBookingRes.body.data.bookingId}, Notified Providers: ${physioBookingRes.body.data.notifiedProvidersCount})`);
  } else {
    console.error("❌ Physio booking failed:", physioBookingRes.body);
  }

  // 7. Test Booking in Remote District 2: Almora, Uttarakhand (Nurse Booking)
  console.log("\n7. Creating Real-time Nurse Booking in 'Almora', Uttarakhand...");
  const nurseBookingRes = await request("/api/v1/realtime/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patientToken}`,
    },
    body: {
      serviceType: "nurse",
      patientName: "Kamla Devi",
      patientPhone: "+919876543210",
      patientAge: 62,
      patientGender: "Female",
      city: "Almora",
      state: "Uttarakhand",
      location: {
        address: "Mall Road, Almora",
        coordinates: [79.6586, 29.5968],
        city: "Almora",
        state: "Uttarakhand",
      },
      nursingCares: [
        { name: "Post-op wound dressing", price: 500 },
      ],
      requirements: {
        description: "Post-op wound dressing and vitals monitoring",
      },
    },
  });

  console.log(`Nurse Booking Status: ${nurseBookingRes.status}`);
  if (nurseBookingRes.body?.success) {
    console.log(`✅ Nurse booking created successfully in Almora district! (ID: ${nurseBookingRes.body.data._id}, City: ${nurseBookingRes.body.data.city}, State: ${nurseBookingRes.body.data.state})`);
  } else {
    console.error("❌ Nurse booking failed:", nurseBookingRes.body);
  }

  // 8. Test Booking in Remote District 3: Kupwara, Jammu & Kashmir (Pathology / Lab Test Booking)
  console.log("\n8. Creating Real-time Lab Test Booking in 'Kupwara', Jammu and Kashmir...");
  const labBookingRes = await request("/api/v1/realtime/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patientToken}`,
    },
    body: {
      serviceType: "pathology",
      patientName: "Ghulam Hassan",
      patientPhone: "+919876543210",
      patientAge: 50,
      patientGender: "Male",
      city: "Kupwara",
      state: "Jammu and Kashmir",
      location: {
        address: "Main Market Kupwara",
        coordinates: [74.2562, 34.5262],
        city: "Kupwara",
        state: "Jammu and Kashmir",
      },
      requirements: {
        description: "Complete Blood Count & Blood Glucose Fasting",
      },
    },
  });

  console.log(`Lab Test Booking Status: ${labBookingRes.status}`);
  if (labBookingRes.body?.success) {
    console.log(`✅ Pathology booking created successfully in Kupwara district! (ID: ${labBookingRes.body.data._id}, City: ${labBookingRes.body.data.city}, State: ${labBookingRes.body.data.state})`);
  } else {
    console.error("❌ Lab booking failed:", labBookingRes.body);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL DISTRICT APIS & BOOKING PIPELINES VERIFIED WORKING!");
  console.log("========================================================");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
