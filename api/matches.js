const connectDB = require('./_lib/db');
const Match = require('./_lib/Match');

module.exports = async (req, res) => {
  // Enable CORS
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
    
    const { league, country, date } = req.query;
    const query = {};
    
    if (league) query.league = league;
    if (country) query.country = country.toUpperCase();
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    }
    
    const matches = await Match.find(query).sort({ startTime: 1 });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error in /api/matches:', err);
    res.status(500).json({ message: err.message });
  }
};
