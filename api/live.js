const connectDB = require('./_lib/db');
const Match = require('./_lib/Match');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await connectDB();
    
    const matches = await Match.find({ status: 'LIVE' }).sort({ startTime: 1 });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error in /api/live:', err);
    res.status(500).json({ message: err.message });
  }
};
