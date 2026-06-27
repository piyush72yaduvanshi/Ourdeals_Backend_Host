import bcrypt from "bcryptjs";

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

const validatePassword = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }

  // Minimal validation - only check minimum length of 6 characters
  if (password.length < 6) {
    return {
      valid: false,
      message: "Password must be at least 6 characters long",
    };
  }

  return { valid: true };
};

export { hashPassword, comparePassword, validatePassword };
