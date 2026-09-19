import { PhysiotherapyBooking } from "../models/PhysiotherapyBooking.model.js";
import { Physiotherapist } from "../models/Physiotherapist.model.js";
import { User } from "../models/User.model.js";
import { Notification } from "../models/Notification.model.js";
import { logger } from "../utils/logger.util.js";

class PhysiotherapyService {
  /**
   * Find nearby physiotherapists within radius (default 50km = 50000m)
   */
  async findNearbyPhysiotherapists(coordinates, maxDistance = 50000, city = null) {
    let query = {
      role: "physiotherapist",
      status: { $in: ["approved", "active"] },
    };

    if (coordinates && coordinates.length === 2 && (coordinates[0] !== 0 || coordinates[1] !== 0)) {
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(coordinates[0]), Number(coordinates[1])],
          },
          $maxDistance: maxDistance,
        },
      };
    } else if (city) {
      query.city = { $regex: new RegExp(`^${city}$`, "i") };
    }

    try {
      const providers = await Physiotherapist.find(query)
        .select("firstName lastName phone email city state profilePicture specializations experience sessionFee rating")
        .limit(20)
        .lean();

      if (providers.length === 0) {
        // Fallback: return active physiotherapists if geospatial returns empty
        return await Physiotherapist.find({
          role: "physiotherapist",
          status: { $in: ["approved", "active"] },
        })
          .select("firstName lastName phone email city state profilePicture specializations experience sessionFee rating")
          .limit(20)
          .lean();
      }

      return providers;
    } catch (err) {
      logger.warn("Geospatial query error, falling back to role search", { error: err.message });
      return await Physiotherapist.find({
        role: "physiotherapist",
        status: { $in: ["approved", "active"] },
      })
        .select("firstName lastName phone email city state profilePicture specializations experience sessionFee rating")
        .limit(20)
        .lean();
    }
  }

  /**
   * Create Booking Request and notify nearby physiotherapists
   */
  async createRequest(patientId, bookingData) {
    const booking = new PhysiotherapyBooking({
      ...bookingData,
      patient: patientId,
      status: "requested",
    });

    await booking.save();

    // Find nearby physiotherapists
    const nearbyPhysios = await this.findNearbyPhysiotherapists(
      bookingData.location?.coordinates,
      50000,
      bookingData.location?.city
    );

    if (nearbyPhysios.length > 0) {
      booking.notifiedPhysiotherapists = nearbyPhysios.map((p) => ({
        physiotherapist: p._id,
        notifiedAt: new Date(),
        viewed: false,
      }));
      await booking.save();

      // Create in-app notifications
      try {
        const notifications = nearbyPhysios.map((p) => ({
          user: p._id,
          title: "New Physiotherapy Request Available",
          message: `New request for ${booking.service} in ${booking.location.city || booking.location.address}`,
          type: "booking_confirmation",
          data: { bookingId: booking._id },
        }));
        await Notification.insertMany(notifications);
      } catch (notifErr) {
        logger.warn("Failed to create notifications for physiotherapists", { error: notifErr.message });
      }
    }

    return booking;
  }

  /**
   * Submit price offer from a physiotherapist
   */
  async submitOffer(bookingId, physiotherapistId, { offerAmount, estimatedArrival, notes }) {
    const booking = await PhysiotherapyBooking.findById(bookingId);
    if (!booking) {
      throw new Error("Physiotherapy booking request not found");
    }

    if (booking.status !== "requested" && booking.status !== "offers_received") {
      throw new Error(`Cannot submit offer for booking with status: ${booking.status}`);
    }

    // Check if already submitted
    const existingOfferIndex = booking.offers.findIndex(
      (o) => o.physiotherapist.toString() === physiotherapistId.toString()
    );

    if (existingOfferIndex >= 0) {
      booking.offers[existingOfferIndex].offerAmount = offerAmount;
      booking.offers[existingOfferIndex].estimatedArrival = estimatedArrival || booking.offers[existingOfferIndex].estimatedArrival;
      booking.offers[existingOfferIndex].notes = notes || booking.offers[existingOfferIndex].notes;
      booking.offers[existingOfferIndex].createdAt = new Date();
    } else {
      booking.offers.push({
        physiotherapist: physiotherapistId,
        offerAmount: Number(offerAmount),
        estimatedArrival,
        notes,
        status: "pending",
        createdAt: new Date(),
      });
    }

    booking.status = "offers_received";
    await booking.save();

    // Notify patient
    try {
      await Notification.create({
        user: booking.patient,
        title: "New Offer for Physiotherapy Service",
        message: `A physiotherapist has sent an offer of ₹${offerAmount} for your request.`,
        type: "booking_accepted",
        data: { bookingId: booking._id },
      });
    } catch (e) {
      logger.warn("Notification error", { error: e.message });
    }

    return booking;
  }

  /**
   * Patient confirms/accepts one offer from the received offers
   */
  async confirmOffer(bookingId, patientId, offerId) {
    const booking = await PhysiotherapyBooking.findOne({
      _id: bookingId,
      patient: patientId,
    });

    if (!booking) {
      throw new Error("Booking request not found or unauthorized");
    }

    const selectedOffer = booking.offers.id(offerId);
    if (!selectedOffer) {
      throw new Error("Selected offer not found");
    }

    // Mark selected offer accepted, other offers rejected
    booking.offers.forEach((o) => {
      if (o._id.toString() === offerId.toString()) {
        o.status = "accepted";
      } else {
        o.status = "rejected";
      }
    });

    booking.assignedPhysiotherapist = selectedOffer.physiotherapist;
    booking.confirmedOffer = {
      physiotherapist: selectedOffer.physiotherapist,
      offerAmount: selectedOffer.offerAmount,
      confirmedAt: new Date(),
      notes: selectedOffer.notes,
    };
    booking.status = "confirmed";

    await booking.save();

    // Fetch physiotherapist details to construct WhatsApp & contact info
    const physio = await User.findById(selectedOffer.physiotherapist)
      .select("firstName lastName phone email profilePicture")
      .lean();

    // Construct direct WhatsApp URL
    let cleanPhone = (physio?.phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const whatsappText = encodeURIComponent(
      `Hello Dr. ${physio?.firstName || "Physiotherapist"}, I have confirmed your offer for ${booking.service} on OurDeals app. Booking ID: ${booking._id}`
    );
    const whatsappLink = `https://wa.me/${cleanPhone}?text=${whatsappText}`;

    return {
      booking,
      contact: {
        physiotherapistName: `${physio?.firstName} ${physio?.lastName}`,
        phone: physio?.phone,
        whatsappLink,
        message: "You can now directly call or chat on WhatsApp with your physiotherapist.",
      },
    };
  }

  /**
   * Physiotherapist rejects request
   */
  async rejectRequest(bookingId, physiotherapistId, reason) {
    const booking = await PhysiotherapyBooking.findById(bookingId);
    if (!booking) {
      throw new Error("Booking request not found");
    }

    booking.rejectedByPhysiotherapists.push({
      physiotherapist: physiotherapistId,
      rejectedAt: new Date(),
      reason: reason || "Unavailable",
    });

    await booking.save();
    return { success: true, message: "Request rejected" };
  }

  /**
   * Update booking status
   */
  async updateStatus(bookingId, userId, newStatus, cancellationReason = null) {
    const booking = await PhysiotherapyBooking.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (newStatus === "cancelled") {
      booking.status = "cancelled";
      booking.cancelledBy = userId;
      booking.cancellationReason = cancellationReason || "Cancelled by user";
    } else {
      booking.status = newStatus;
    }

    await booking.save();
    return booking;
  }
}

export const physiotherapyService = new PhysiotherapyService();
