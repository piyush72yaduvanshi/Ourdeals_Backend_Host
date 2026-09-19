import fs from "fs";
import path from "path";

const collection = {
  info: {
    _postman_id: "a1b2c3d4-e5f6-4789-9012-ourdeals4mods",
    name: "OurDeals - 4 Complete Backend Modules API",
    description: "Complete working API collection for 4 backend modules: 1. Physiotherapy, 2. Healthys Products, 3. Medicines, 4. Pet Care.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5001", type: "string" },
    { key: "patientToken", value: "", type: "string" },
    { key: "physioToken", value: "", type: "string" },
    { key: "adminToken", value: "", type: "string" },
    { key: "bookingId", value: "", type: "string" },
    { key: "offerId", value: "", type: "string" },
    { key: "healthyProductId", value: "", type: "string" },
    { key: "medicineId", value: "", type: "string" },
    { key: "petProductId", value: "", type: "string" },
    { key: "orderId", value: "", type: "string" },
    { key: "cartItemId", value: "", type: "string" }
  ],
  item: [
    // 0. Authentication
    {
      name: "0. Authentication & Tokens",
      item: [
        {
          name: "Login Patient",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "patient@example.com", password: "Password@123" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/auth/login", host: ["{{baseUrl}}"], path: ["api", "v1", "auth", "login"] }
          }
        },
        {
          name: "Login Physiotherapist",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "dr.arun.sharma@ourdeals.com", password: "Password@123" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/auth/login", host: ["{{baseUrl}}"], path: ["api", "v1", "auth", "login"] }
          }
        },
        {
          name: "Login Admin",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "admin@ourdeals.in", password: "Password@123" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/auth/login", host: ["{{baseUrl}}"], path: ["api", "v1", "auth", "login"] }
          }
        }
      ]
    },

    // 1. Physiotherapy
    {
      name: "1. Physiotherapy Module",
      item: [
        {
          name: "Get Available Physiotherapy Services",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/services", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "services"] }
          }
        },
        {
          name: "Browse All Physiotherapists",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/v1/physiotherapy/therapists?city=New Delhi",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "physiotherapy", "therapists"],
              query: [{ key: "city", value: "New Delhi" }]
            }
          }
        },
        {
          name: "Patient - Create Booking Request",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                patientName: "Aarav Sharma",
                patientPhone: "+919876543210",
                patientAge: 42,
                patientGender: "Male",
                service: "Back & Neck Pain Physiotherapy",
                serviceCategory: "Spine & Posture",
                location: {
                  address: "Flat 204, Green Park, South Delhi",
                  coordinates: [77.2066, 28.5494],
                  city: "New Delhi",
                  state: "Delhi",
                  pincode: "110016"
                },
                scheduledDate: "2026-09-25T10:00:00.000Z",
                scheduledTimeSlot: "10:00 AM - 11:00 AM",
                notes: "Severe lower back pain after workout"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests"] }
          }
        },
        {
          name: "Physiotherapist - Get Nearby Available Requests",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{physioToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/provider/requests", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "provider", "requests"] }
          }
        },
        {
          name: "Physiotherapist - Submit Custom Price Offer",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{physioToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                offerAmount: 650,
                estimatedArrival: "Tomorrow 10:00 AM",
                notes: "I have 9+ years experience with spine rehab and will bring ultrasonic therapy machine."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}/offer", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}", "offer"] }
          }
        },
        {
          name: "Physiotherapist - Reject Request",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{physioToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ reason: "Slot already booked with another patient" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}/reject", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}", "reject"] }
          }
        },
        {
          name: "Patient - View Received Offers",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}/offers", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}", "offers"] }
          }
        },
        {
          name: "Patient - Confirm Offer (Unlocks WhatsApp & Phone Contact)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ offerId: "{{offerId}}" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}/confirm-offer", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}", "confirm-offer"] }
          }
        },
        {
          name: "Update Booking Status (in_progress / completed / cancelled)",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{physioToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ status: "in_progress" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}/status", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}", "status"] }
          }
        },
        {
          name: "Patient - Get My Physiotherapy Bookings",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/patient/bookings", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "patient", "bookings"] }
          }
        },
        {
          name: "Physiotherapist - Get My Assigned Bookings",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{physioToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/provider/bookings", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "provider", "bookings"] }
          }
        },
        {
          name: "Get Single Booking By ID",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/physiotherapy/requests/{{bookingId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "physiotherapy", "requests", "{{bookingId}}"] }
          }
        }
      ]
    },

    // 2. Healthys Products
    {
      name: "2. Healthys Products Module",
      item: [
        {
          name: "Get Healthys Categories",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/healthys/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "categories"] }
          }
        },
        {
          name: "List Products (Filter, Search & Sort)",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/v1/healthys/products?category=Ayurvedic%20%26%20Herbal&sortBy=discount&inStockOnly=true",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "healthys", "products"],
              query: [
                { key: "category", value: "Ayurvedic & Herbal" },
                { key: "sortBy", value: "discount" },
                { key: "inStockOnly", value: "true" }
              ]
            }
          }
        },
        {
          name: "Get Product Details",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/healthys/products/{{healthyProductId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "products", "{{healthyProductId}}"] }
          }
        },
        {
          name: "Get Wishlist",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/wishlist", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "wishlist"] }
          }
        },
        {
          name: "Add to Wishlist",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ productId: "{{healthyProductId}}" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/wishlist", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "wishlist"] }
          }
        },
        {
          name: "Remove from Wishlist",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/wishlist/{{healthyProductId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "wishlist", "{{healthyProductId}}"] }
          }
        },
        {
          name: "Get Cart",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "cart"] }
          }
        },
        {
          name: "Add to Cart",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ productId: "{{healthyProductId}}", quantity: 2 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "cart"] }
          }
        },
        {
          name: "Update Cart Item Quantity",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ quantity: 3 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Remove Item from Cart",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Checkout / Create Order",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                shippingAddress: {
                  fullName: "Aarav Sharma",
                  phone: "+919876543210",
                  address: "House 14, Ring Road, Lajpat Nagar",
                  city: "New Delhi",
                  state: "Delhi",
                  pincode: "110024"
                },
                paymentMethod: "cash_on_delivery"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "orders"] }
          }
        },
        {
          name: "Get My Healthys Orders",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "orders"] }
          }
        },
        {
          name: "Get Single Order Details",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/healthys/orders/{{orderId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "orders", "{{orderId}}"] }
          }
        },
        {
          name: "Cancel Order",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ cancellationReason: "Ordered by mistake" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/orders/{{orderId}}/cancel", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "orders", "{{orderId}}", "cancel"] }
          }
        },
        {
          name: "Admin - Create Category",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Herbal Teas & Infusions",
                description: "Calming chamomile, green tea, and digestive herbal brews.",
                image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400",
                displayOrder: 7
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/admin/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "admin", "categories"] }
          }
        },
        {
          name: "Admin - Update Order Status",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                orderStatus: "shipped",
                deliveryPartner: "Delhivery",
                trackingId: "DLVRY-HLT-998811",
                notes: "Shipped from central wellness hub"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/healthys/admin/orders/{{orderId}}/status", host: ["{{baseUrl}}"], path: ["api", "v1", "healthys", "admin", "orders", "{{orderId}}", "status"] }
          }
        }
      ]
    },

    // 3. Medicines
    {
      name: "3. Medicines Module",
      item: [
        {
          name: "Get Medicine Categories",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/medicines/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "categories"] }
          }
        },
        {
          name: "Search, Filter & Sort Medicines",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/v1/medicines?search=paracetamol&sortBy=price&sortOrder=asc",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "medicines"],
              query: [
                { key: "search", value: "paracetamol" },
                { key: "sortBy", value: "price" },
                { key: "sortOrder", value: "asc" }
              ]
            }
          }
        },
        {
          name: "Get Medicine Details + Frequently Bought Together",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/medicines/{{medicineId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "{{medicineId}}"] }
          }
        },
        {
          name: "Add to Medicines Cart",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ productId: "{{medicineId}}", quantity: 2 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "cart"] }
          }
        },
        {
          name: "Get Medicines Cart",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/medicines/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "cart"] }
          }
        },
        {
          name: "Update Medicine Cart Quantity",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ quantity: 3 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Remove Medicine from Cart",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/medicines/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Checkout / Place Medicine Order",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                shippingAddress: {
                  fullName: "Pooja Verma",
                  phone: "+919876543210",
                  address: "Flat 102, Shivalik Enclave, Malviya Nagar",
                  city: "New Delhi",
                  state: "Delhi",
                  pincode: "110017"
                },
                paymentMethod: "cash_on_delivery"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "orders"] }
          }
        },
        {
          name: "Get Medicine Orders History",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/medicines/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "orders"] }
          }
        },
        {
          name: "Admin - Update Medicine Stock",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ stock: 50, operation: "add" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/{{medicineId}}/stock", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "{{medicineId}}", "stock"] }
          }
        },
        {
          name: "Admin - Create Medicine Category",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Eye & Ear Drops",
                description: "Lubricating tears, antibiotic ear drops, and eye solutions.",
                image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
                displayOrder: 9
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/admin/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "admin", "categories"] }
          }
        },
        {
          name: "Admin - Update Medicine Order Delivery Status",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                orderStatus: "out_for_delivery",
                deliveryPartner: "Shadowfax Express",
                trackingId: "SFX-MED-889922",
                notes: "Out for rapid delivery within 2 hours"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/medicines/admin/orders/{{orderId}}/status", host: ["{{baseUrl}}"], path: ["api", "v1", "medicines", "admin", "orders", "{{orderId}}", "status"] }
          }
        }
      ]
    },

    // 4. Pet Care
    {
      name: "4. Pet Care Module",
      item: [
        {
          name: "Get Pet Care Categories",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/petcare/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "categories"] }
          }
        },
        {
          name: "List Pet Products (Filter by Pet Type & Category)",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/v1/petcare/products?petType=dog&category=Dog%20Food&sortBy=rating",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "petcare", "products"],
              query: [
                { key: "petType", value: "dog" },
                { key: "category", value: "Dog Food" },
                { key: "sortBy", value: "rating" }
              ]
            }
          }
        },
        {
          name: "Get Pet Product Details",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/v1/petcare/products/{{petProductId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "products", "{{petProductId}}"] }
          }
        },
        {
          name: "Wishlist - View",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/petcare/wishlist", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "wishlist"] }
          }
        },
        {
          name: "Wishlist - Add Product",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ productId: "{{petProductId}}" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/wishlist", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "wishlist"] }
          }
        },
        {
          name: "Cart - View",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/petcare/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "cart"] }
          }
        },
        {
          name: "Cart - Add Pet Product",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ productId: "{{petProductId}}", quantity: 1 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/cart", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "cart"] }
          }
        },
        {
          name: "Cart - Update Quantity",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ quantity: 2 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Cart - Remove Item",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/petcare/cart/{{cartItemId}}", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "cart", "{{cartItemId}}"] }
          }
        },
        {
          name: "Checkout / Place Pet Care Order",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{patientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                shippingAddress: {
                  fullName: "Rohit Malhotra",
                  phone: "+919876543210",
                  address: "Villa 22, Green Meadows, Vasant Kunj",
                  city: "New Delhi",
                  state: "Delhi",
                  pincode: "110070"
                },
                paymentMethod: "cash_on_delivery"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "orders"] }
          }
        },
        {
          name: "Get Pet Care Orders History",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{patientToken}}" }],
            url: { raw: "{{baseUrl}}/api/v1/petcare/orders", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "orders"] }
          }
        },
        {
          name: "Admin - Create Pet Category",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Bird Nutrition & Toys",
                description: "Seeds, fruit treats, and interactive cage toys for parrots and budgies.",
                image: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400",
                targetPets: ["birds"],
                displayOrder: 9
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/admin/categories", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "admin", "categories"] }
          }
        },
        {
          name: "Admin - Update Pet Order Status",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                orderStatus: "delivered",
                notes: "Delivered to customer doorstep"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/petcare/admin/orders/{{orderId}}/status", host: ["{{baseUrl}}"], path: ["api", "v1", "petcare", "admin", "orders", "{{orderId}}", "status"] }
          }
        }
      ]
    }
  ]
};

const dirPath = path.join(process.cwd(), "postman");
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const targetPath = path.join(dirPath, "OurDeals_4_Modules_API_Collection.postman_collection.json");
fs.writeFileSync(targetPath, JSON.stringify(collection, null, 2), "utf8");
console.log(`✅ Postman collection successfully written to: ${targetPath}`);
