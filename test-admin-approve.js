import "./src/config/env.config.js";
import axios from 'axios';
import { connectDatabase } from "./src/utils/db.js";
import { User } from "./src/models/User.model.js";
import { Physiotherapist } from "./src/models/Physiotherapist.model.js";
import { tokenService } from "./src/services/token.service.js";

const BASE_URL = `http://localhost:${process.env.PORT || 5001}/api/v1`;

async function testAdminApprove() {
  console.log('--- Testing Admin Provider Approval Endpoint on localhost:5001 ---');
  await connectDatabase();

  // Find or create an admin user
  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.create({
      email: "admin.test@onmint.in",
      password: "Password@123",
      role: "admin",
      firstName: "Admin",
      lastName: "Master",
      phone: "+919999999999",
      status: "active",
      location: { type: "Point", coordinates: [78.57, 25.44] },
    });
  }

  const adminToken = tokenService.generateAccessToken({
    userId: admin._id.toString(),
    email: admin.email,
    role: "admin",
  });

  // Find a pending physiotherapist or create one
  let pendingPhysio = await User.findOne({ role: "physiotherapist", status: "pending" });
  if (!pendingPhysio) {
    pendingPhysio = await Physiotherapist.create({
      email: `test.physio.${Date.now()}@onmint.in`,
      password: "Password@123",
      role: "physiotherapist",
      firstName: "Dr. Test",
      lastName: "Approval",
      phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      status: "pending",
      city: "Jhansi",
      state: "Uttar Pradesh",
      specializations: ["Orthopedic Physiotherapy"],
      sessionFee: 600,
      location: { type: "Point", coordinates: [78.57, 25.44] },
    });
  }

  console.log('Testing approval for provider ID:', pendingPhysio._id.toString(), 'Role:', pendingPhysio.role, 'Current status:', pendingPhysio.status);

  // Call admin approve endpoint
  const approveRes = await axios.post(
    `${BASE_URL}/admin/providers/${pendingPhysio._id}/approve`,
    { notes: "Approved by admin test" },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  console.log('Response Status:', approveRes.status);
  console.log('Response Body:', approveRes.data);

  if (approveRes.data.success && approveRes.data.data.status === 'approved') {
    console.log('🎉 ADMIN APPROVAL PASSED 100%! Provider status is now APPROVED without any 500 error!');
  } else {
    console.error('❌ Admin approval failed unexpected format:', approveRes.data);
    process.exit(1);
  }

  process.exit(0);
}

testAdminApprove().catch((err) => {
  console.error('❌ Admin approve test error:', err.response ? err.response.data : err.message);
  process.exit(1);
});
