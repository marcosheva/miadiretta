const connectDB = require('./_lib/db');
const Match = require('./_lib/Match');
const axios = require('axios');

async function syncFromAPI() {
  const TOKEN = process.env.BETSAPI_TOKEN;
  if (!TOKEN) {
    console.log('Skipping API sync: No BetsAPI Token provided');
    return { success: false, message: 'No API token' };
  }

  try {
    const allEvents = [];
    const liveEventIds = new Set();
    
    // 1. Live Matches
    try {
      const inplayRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
      const liveItems = inplayRes.data.results || [];
      allEvents.push(...liveItems);
      liveItems.forEach(ev => liveEventIds.add(ev.id));
    } catch (e) { console.error('Error fetching live:', e.message); }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // 2. Upcoming (Deep Sync - up to 50 pages)
    for (let page = 1; page <= 50; page++) {
      try {
        await wait(500);
        const res = await axios.get(`https://api.b365api.com/v1/events/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const results = res.data.results || [];
        if (results.length === 0) break;
        allEvents.push(...results);
        if (results.length < 50) break; 
      } catch (e) { break; }
    }

    // 3. Ended (Today)
    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const endedRes = await axios.get(`https://api.b365api.com/v1/events/ended?sport_id=1&token=${TOKEN}&day=${today}`);
      allEvents.push(...(endedRes.data.results || []));
    } catch (e) { }

    // 4. Transition Logic
    const dbLiveMatches = await Match.find({ status: 'LIVE' });
    for (const dbMatch of dbLiveMatches) {
      if (dbMatch.eventId && !liveEventIds.has(dbMatch.eventId)) {
        dbMatch.status = 'FINISHED';
        await dbMatch.save();
      }
    }

    console.log(`Auto-sync: Processing ${allEvents.length} events`);

    for (const ev of allEvents) {
      if (!ev.time) continue;

      let homeScore = 0;
      let awayScore = 0;
      if (ev.ss) {
        const scores = ev.ss.split('-');
        homeScore = parseInt(scores[0]) || 0;
        awayScore = parseInt(scores[1]) || 0;
      }

      const matchData = {
        eventId: ev.id,
        sport: 'Football',
        league: ev.league?.name || 'Unknown League',
        leagueId: ev.league?.id,
        country: ev.cc?.toUpperCase() || (ev.league?.name?.split(' ')[0]?.toUpperCase() || 'UN'),
        startTime: new Date(parseInt(ev.time) * 1000),
        status: ev.timer ? 'LIVE' : (ev.ss && ev.ss.includes('-') && !ev.timer ? 'FINISHED' : 'SCHEDULED'), 
        minute: ev.timer?.tm ? `${ev.timer.tm}'` : '',
        homeTeam: {
          name: ev.home?.name || 'Home',
          logo: ev.home?.image_id ? `https://assets.b365api.com/images/team/m/${ev.home.image_id}.png` : '',
          score: homeScore
        },
        awayTeam: {
          name: ev.away?.name || 'Away',
          logo: ev.away?.image_id ? `https://assets.b365api.com/images/team/m/${ev.away.image_id}.png` : '',
          score: awayScore
        }
      };

      await Match.findOneAndUpdate(
        { eventId: matchData.eventId },
        matchData,
        { upsert: true }
      );
    }
    
    return { success: true, count: allEvents.length };
  } catch (err) {
    console.error('Auto-sync error:', err.message);
    return { success: false, error: err.message };
  }
}

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
    console.log('Manual/Cron sync triggered');
    const result = await syncFromAPI();
    
    if (result.success) {
      res.status(200).json({ message: 'Sync started', count: result.count });
    } else {
      res.status(500).json({ message: 'Sync failed', error: result.error || result.message });
    }
  } catch (err) {
    console.error('Error in /api/sync:', err);
    res.status(500).json({ message: err.message });
  }
};
