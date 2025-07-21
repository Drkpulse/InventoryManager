const bcrypt = require('bcryptjs');

async function generateHash(password) {
  try {
    // Generate salt with 10 rounds
    const salt = await bcrypt.genSalt(10);

    // Hash the password
    const hash = await bcrypt.hash(password, salt);

    console.log('Password:', password);
    console.log('Hashed Password:', hash);

    // Test verification
    const isMatch = await bcrypt.compare(password, hash);
    console.log('Verification (should be true):', isMatch);

  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

// Generate hash for "admin123"
generateHash('admin123');
