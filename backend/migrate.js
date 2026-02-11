const mongoose = require('mongoose');
const Match = require('./models/Match');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Migrating data...');
    const result = await Match.deleteMany({ eventId: { $exists: false } });
    console.log(`Deleted ${result.deletedCount} orphaned matches without eventId.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
