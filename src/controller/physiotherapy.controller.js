import { PhysiotherapyBooking } from "../models/PhysiotherapyBooking.model.js";
import { Physiotherapist } from "../models/Physiotherapist.model.js";
import { User } from "../models/User.model.js";
import { physiotherapyService } from "../services/physiotherapy.service.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";

// Standard dynamic physiotherapy service catalog
const DEFAULT_SERVICES = [
  {
    id: "back-pain-relief",
    title: "Back & Neck Pain Physiotherapy",
    category: "Spine & Posture",
    description: "Specialized therapy for chronic lower back pain, cervical spondylosis, and postural corrections.",
    recommendedSessions: 5,
    estimatedPriceRange: "₹500 - ₹800 / session",
    icon: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "post-surgery-rehab",
    title: "Post-Surgical Rehabilitation",
    category: "Rehabilitation",
    description: "Safe recovery exercises after joint replacement, fracture fixation, or spine surgery.",
    recommendedSessions: 10,
    estimatedPriceRange: "₹600 - ₹1000 / session",
    icon: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "knee-joint-pain",
    title: "Knee & Joint Pain Therapy",
    category: "Orthopedic",
    description: "Therapy for osteoarthritis, ligament strains, meniscus injuries, and mobility restoration.",
    recommendedSessions: 6,
    estimatedPriceRange: "₹500 - ₹750 / session",
    icon: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "sports-injury",
    title: "Sports Injury & Fitness Rehab",
    category: "Sports Medicine",
    description: "Targeted rehab for sprains, muscle tears, runner's knee, and tennis elbow.",
    recommendedSessions: 4,
    estimatedPriceRange: "₹600 - ₹900 / session",
    icon: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "stroke-neuro-rehab",
    title: "Neuro & Paralysis Rehabilitation",
    category: "Neurological",
    description: "Motor recovery and gait training for stroke, Parkinson's, and nerve injuries.",
    recommendedSessions: 15,
    estimatedPriceRange: "₹700 - ₹1200 / session",
    icon: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "elderly-mobility",
    title: "Geriatric & Elderly Mobility Care",
    category: "Elderly Care",
    description: "Gentle balance training, fall prevention, and mobility enhancement for seniors at home.",
    recommendedSessions: 8,
    estimatedPriceRange: "₹500 - ₹700 / session",
    icon: "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200&auto=format&fit=crop&q=80",
  },
];

/**
 * 1. Get available physiotherapy services catalog
 */
export const getPhysiotherapyServices = async (req, res) => {
  try {
    res.json(
      successResponse("Physiotherapy services fetched successfully", {
        services: DEFAULT_SERVICES,
        paymentPolicy: "No in-app payment required. Pay on visit directly to the therapist.",
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 2. Get list of all physiotherapists (public browse with filters)
 */
export const getAllPhysiotherapists = async (req, res) => {
  try {
    const { specialization, city, minExp, maxFee, search } = req.query;
    const query = {
      role: "physiotherapist",
      status: { $in: ["approved", "active"] },
    };

    if (city) {
      query.city = { $regex: new RegExp(`^${city}$`, "i") };
    }
    if (specialization) {
      query.specializations = { $in: [new RegExp(specialization, "i")] };
    }
    if (minExp) {
      query.experience = { $gte: Number(minExp) };
    }
    if (maxFee) {
      query.sessionFee = { $lte: Number(maxFee) };
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { specializations: { $regex: search, $options: "i" } },
      ];
    }

    const physiotherapists = await Physiotherapist.find(query)
      .select("firstName lastName email phone profilePicture city state address specializations qualifications experience sessionFee homeVisitAvailable clinicAddress about rating totalPatientsTreated isAvailable")
      .lean();

    res.json(successResponse("Physiotherapists fetched successfully", physiotherapists));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 3. Patient creates booking request
 */
export const createBookingRequest = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const {
      patientName,
      patientPhone,
      patientAge,
      patientGender,
      service,
      serviceCategory,
      location,
      scheduledDate,
      scheduledTimeSlot,
      notes,
    } = req.body;

    if (!patientName || !patientPhone || !service || !scheduledDate || !scheduledTimeSlot) {
      return res.status(400).json(
        errorResponse("Patient name, phone, service, date, and time slot are required")
      );
    }

    if (!location || !location.address) {
      return res.status(400).json(errorResponse("Location address is required"));
    }

    // Default coordinates if not sent
    const coordinates = location.coordinates && location.coordinates.length === 2
      ? location.coordinates
      : [77.209, 28.6139]; // Default Delhi coordinates

    const bookingData = {
      patientName,
      patientPhone,
      patientAge: patientAge ? Number(patientAge) : undefined,
      patientGender,
      service,
      serviceCategory: serviceCategory || service || "Physiotherapy",
      location: {
        address: location.address,
        coordinates,
        city: location.city || req.user.city || "",
        state: location.state || req.user.state || "",
        pincode: location.pincode || "",
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTimeSlot,
      notes: notes || "",
    };

    const booking = await physiotherapyService.createRequest(patientId, bookingData);

    res.status(201).json(
      successResponse("Physiotherapy request created and broadcasted to nearby physiotherapists", {
        bookingId: booking._id,
        _id: booking._id,
        status: booking.status,
        service: booking.service,
        serviceCategory: booking.serviceCategory,
        patientName: booking.patientName,
        patientPhone: booking.patientPhone,
        patientAge: booking.patientAge,
        patientGender: booking.patientGender,
        location: booking.location,
        scheduledDate: booking.scheduledDate,
        scheduledTimeSlot: booking.scheduledTimeSlot,
        notes: booking.notes,
        createdAt: booking.createdAt,
        notifiedProvidersCount: booking.notifiedPhysiotherapists?.length || 0,
        paymentPolicy: "No in-app payment required. Pay on visit.",
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 4. Physiotherapist: Get nearby / pending requests
 */
export const getNearbyRequests = async (req, res) => {
  try {
    const physioId = req.user.userId;
    const physio = await User.findById(physioId).lean();

    // Logic: First approve from admin, then got request
    if (physio?.status !== "approved" && physio?.status !== "active") {
      return res.json(
        successResponse(
          "Your profile is pending admin approval. You will receive booking requests once approved by admin.",
          []
        )
      );
    }

    const query = {
      status: { $in: ["requested", "offers_received", "pending"] },
      "rejectedByPhysiotherapists.physiotherapist": { $ne: physioId },
    };

    // If city or state is set on physiotherapist profile, match city, state, or notified requests
    if (physio?.city || physio?.state) {
      const orConditions = [
        { "notifiedPhysiotherapists.physiotherapist": physioId },
      ];
      if (physio?.city) {
        orConditions.push({ "location.city": { $regex: new RegExp(`^${physio.city}$`, "i") } });
      }
      if (physio?.state) {
        orConditions.push({ "location.state": { $regex: new RegExp(`^${physio.state}$`, "i") } });
      }
      query.$or = orConditions;
    }

    let requests = await PhysiotherapyBooking.find(query)
      .populate("patient", "firstName lastName phone profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: If no location-filtered requests found, return open unassigned requests
    if (!requests || requests.length === 0) {
      const openQuery = {
        status: { $in: ["requested", "offers_received", "pending"] },
        "rejectedByPhysiotherapists.physiotherapist": { $ne: physioId },
      };
      requests = await PhysiotherapyBooking.find(openQuery)
        .populate("patient", "firstName lastName phone profilePicture")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Map whether current physiotherapist already sent an offer
    const formatted = requests.map((reqItem) => {
      const myOffer = reqItem.offers.find(
        (o) => o.physiotherapist.toString() === physioId.toString()
      );
      const isOfferActive = myOffer && myOffer.status !== "rejected";
      return {
        ...reqItem,
        serviceType: "physiotherapy",
        title: reqItem.service || "Physiotherapy",
        alreadyOffered: isOfferActive,
        hasOffered: isOfferActive,
        myOffer: isOfferActive ? myOffer : null,
        myOfferStatus: myOffer ? myOffer.status : null,
        totalOffersCount: reqItem.offers.length,
      };
    });

    res.json(successResponse("Nearby physiotherapy requests fetched", formatted));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 5. Physiotherapist: Submit price offer
 */
export const submitOffer = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const physiotherapistId = req.user.userId;
    const { offerAmount, estimatedArrival, notes } = req.body;

    if (!offerAmount || Number(offerAmount) <= 0) {
      return res.status(400).json(errorResponse("Valid offer amount is required"));
    }

    const updatedBooking = await physiotherapyService.submitOffer(
      bookingId,
      physiotherapistId,
      { offerAmount, estimatedArrival, notes }
    );

    res.json(
      successResponse("Offer submitted successfully", {
        bookingId: updatedBooking._id,
        status: updatedBooking.status,
        offersCount: updatedBooking.offers.length,
      })
    );
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * 6. Physiotherapist: Reject request
 */
export const rejectRequest = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const physiotherapistId = req.user.userId;
    const { reason } = req.body;

    const result = await physiotherapyService.rejectRequest(
      bookingId,
      physiotherapistId,
      reason
    );
    res.json(successResponse("Request rejected", result));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * 7. Patient: View received offers for their booking request
 */
export const getBookingOffers = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await PhysiotherapyBooking.findById(bookingId)
      .populate("offers.physiotherapist", "firstName lastName phone email profilePicture specializations experience sessionFee rating")
      .lean();

    if (!booking) {
      return res.status(404).json(errorResponse("Booking not found"));
    }

    if (booking.patient.toString() !== req.user.userId.toString() && req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Unauthorized to view this booking's offers"));
    }

    res.json(
      successResponse("Booking offers fetched", {
        bookingId: booking._id,
        _id: booking._id,
        service: booking.service,
        serviceCategory: booking.serviceCategory,
        patientName: booking.patientName,
        patientPhone: booking.patientPhone,
        patientAge: booking.patientAge,
        patientGender: booking.patientGender,
        location: booking.location,
        scheduledDate: booking.scheduledDate,
        scheduledTimeSlot: booking.scheduledTimeSlot,
        notes: booking.notes,
        createdAt: booking.createdAt,
        status: booking.status,
        offers: booking.offers,
        confirmedOffer: booking.confirmedOffer,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 8. Patient: Confirm/Select one physiotherapist offer -> Unlocks Phone & WhatsApp!
 */
export const confirmOffer = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { offerId } = req.body;
    const patientId = req.user.userId;

    if (!offerId) {
      return res.status(400).json(errorResponse("offerId is required"));
    }

    const result = await physiotherapyService.confirmOffer(bookingId, patientId, offerId);

    res.json(
      successResponse("Offer confirmed successfully! Contact details unlocked.", {
        bookingId: result.booking._id,
        _id: result.booking._id,
        status: result.booking.status,
        serviceType: "physiotherapy",
        service: result.booking.service,
        title: result.booking.service || "Physiotherapy",
        serviceCategory: result.booking.serviceCategory,
        patientName: result.booking.patientName,
        patientPhone: result.booking.patientPhone,
        patientAge: result.booking.patientAge,
        patientGender: result.booking.patientGender,
        location: result.booking.location,
        address: result.booking.location?.address || "",
        scheduledDate: result.booking.scheduledDate,
        scheduledTimeSlot: result.booking.scheduledTimeSlot,
        scheduledTime: result.booking.scheduledDate || result.booking.createdAt,
        notes: result.booking.notes,
        createdAt: result.booking.createdAt,
        confirmedOffer: result.booking.confirmedOffer,
        offerAmount: result.booking.confirmedOffer?.offerAmount,
        totalAmount: result.booking.confirmedOffer?.offerAmount,
        fees: result.booking.confirmedOffer?.offerAmount,
        contact: result.contact,
        contactInfo: result.contact,
        acceptedProvider: result.contact,
        provider: result.contact,
      })
    );
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * 8b. Patient rejects an offer
 */
export const rejectOffer = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { offerId } = req.body;
    const patientId = req.user.userId;

    if (!offerId) {
      return res.status(400).json(errorResponse("offerId is required"));
    }

    const booking = await physiotherapyService.rejectOffer(bookingId, patientId, offerId);
    res.json(successResponse("Offer rejected successfully", booking));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * 9. Update booking status (in_progress, completed, cancelled)
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, cancellationReason } = req.body;

    const allowedStatuses = ["in_progress", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json(
        errorResponse(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`)
      );
    }

    const updated = await physiotherapyService.updateStatus(
      bookingId,
      req.user.userId,
      status,
      cancellationReason
    );

    res.json(successResponse(`Booking status updated to ${status}`, updated));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * 10. Patient: Get all my bookings
 */
export const getPatientBookings = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const bookings = await PhysiotherapyBooking.find({ patient: patientId })
      .populate("assignedPhysiotherapist", "firstName lastName phone email profilePicture specializations")
      .sort({ createdAt: -1 })
      .lean();

    // Attach direct contact details for confirmed bookings
    const formatted = bookings.map((b) => {
      let contactInfo = null;
      if (b.status === "confirmed" || b.status === "in_progress" || b.status === "completed") {
        if (b.assignedPhysiotherapist) {
          let cleanPhone = (b.assignedPhysiotherapist.phone || "").replace(/[^0-9]/g, "");
          if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
          contactInfo = {
            name: `${b.assignedPhysiotherapist.firstName} ${b.assignedPhysiotherapist.lastName}`,
            phone: b.assignedPhysiotherapist.phone,
            whatsappLink: `https://wa.me/${cleanPhone}?text=Hello%20Dr.%20I%20am%20calling%20regarding%20my%20physiotherapy%20session.`,
          };
        }
      }
      return {
        ...b,
        contactInfo,
      };
    });

    res.json(successResponse("Patient physiotherapy bookings fetched", formatted));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 11. Physiotherapist: Get all bookings assigned or offered
 */
export const getPhysiotherapistBookings = async (req, res) => {
  try {
    const physioId = req.user.userId;
    const bookings = await PhysiotherapyBooking.find({
      $or: [
        { assignedPhysiotherapist: physioId },
        { "offers.physiotherapist": physioId },
      ],
    })
      .populate("patient", "firstName lastName phone profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    // Attach patient contact info for confirmed bookings
    const formatted = bookings.map((b) => {
      let patientContact = null;
      if (b.assignedPhysiotherapist?.toString() === physioId.toString()) {
        let cleanPhone = (b.patientPhone || b.patient?.phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
        patientContact = {
          name: b.patientName,
          phone: b.patientPhone,
          whatsappLink: `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(b.patientName)},%20I%20am%20your%20physiotherapist%20from%20OurDeals.`,
        };
      }
      const myOffer = b.offers?.find(
        (o) => (o.physiotherapist?._id || o.physiotherapist)?.toString() === physioId.toString()
      );
      const isOfferActive = myOffer && myOffer.status !== "rejected";
      return {
        ...b,
        serviceType: "physiotherapy",
        title: b.service || "Physiotherapy",
        patientContact,
        alreadyOffered: isOfferActive,
        hasOffered: isOfferActive,
        myOffer: isOfferActive ? myOffer : null,
        myOfferStatus: myOffer ? myOffer.status : null,
      };
    });

    res.json(successResponse("Physiotherapist bookings fetched", formatted));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 12. Get single booking details
 */
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await PhysiotherapyBooking.findById(bookingId)
      .populate("patient", "firstName lastName phone profilePicture age gender")
      .populate("assignedPhysiotherapist", "firstName lastName phone email profilePicture specializations experience rating clinicAddress address")
      .populate("offers.physiotherapist", "firstName lastName phone email profilePicture specializations experience rating clinicAddress address")
      .lean();

    if (!booking) {
      return res.status(404).json(errorResponse("Booking not found"));
    }

    const offerAmount =
      booking.confirmedOffer?.offerAmount ||
      booking.offers?.find(
        (o) =>
          o.status === "accepted" ||
          (req.user?._id &&
            (o.physiotherapist?._id || o.physiotherapist)?.toString() ===
              req.user._id.toString())
      )?.offerAmount ||
      booking.offers?.[0]?.offerAmount ||
      null;

    // Attach WhatsApp and phone contact if confirmed
    let contactInfo = null;
    if (booking.assignedPhysiotherapist) {
      let cleanPhone = (booking.assignedPhysiotherapist.phone || "").replace(/[^0-9]/g, "");
      if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
      contactInfo = {
        name: `${booking.assignedPhysiotherapist.firstName} ${booking.assignedPhysiotherapist.lastName}`,
        fullName: `${booking.assignedPhysiotherapist.firstName} ${booking.assignedPhysiotherapist.lastName}`,
        physiotherapistName: `${booking.assignedPhysiotherapist.firstName} ${booking.assignedPhysiotherapist.lastName}`,
        phone: booking.assignedPhysiotherapist.phone,
        email: booking.assignedPhysiotherapist.email,
        profilePicture: booking.assignedPhysiotherapist.profilePicture,
        specialization: booking.assignedPhysiotherapist.specializations
          ? (Array.isArray(booking.assignedPhysiotherapist.specializations)
              ? booking.assignedPhysiotherapist.specializations.join(", ")
              : booking.assignedPhysiotherapist.specializations.toString())
          : "",
        experience: booking.assignedPhysiotherapist.experience?.toString() || "",
        clinicAddress: booking.assignedPhysiotherapist.clinicAddress || booking.assignedPhysiotherapist.address || "",
        whatsappLink: `https://wa.me/${cleanPhone}`,
      };
    }

    const provider = booking.assignedPhysiotherapist || booking.confirmedOffer?.physiotherapist;

    res.json(
      successResponse("Booking details fetched", {
        ...booking,
        serviceType: "physiotherapy",
        title: booking.service || "Physiotherapy",
        service: booking.service,
        serviceCategory: booking.serviceCategory,
        scheduledTime: booking.scheduledDate || booking.createdAt,
        provider: provider,
        acceptedProvider: provider,
        address: booking.location?.address || "",
        offerAmount,
        totalAmount: offerAmount,
        finalAmount: offerAmount,
        fees: offerAmount,
        contactInfo,
        contact: contactInfo,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};
