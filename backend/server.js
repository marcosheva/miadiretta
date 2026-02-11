const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const Match = require('./models/Match');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Initial sync on start
    syncFromAPI();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Sync Function
async function syncFromAPI() {
  const TOKEN = process.env.BETSAPI_TOKEN;
  if (!TOKEN) {
    console.log('Skipping API sync: No BetsAPI Token provided');
    return;
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
        await wait(500); // 0.5s delay for background sync
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

    // 4. Transition Logic: mark matches as FINISHED if they are no longer live
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
  } catch (err) {
    console.error('Auto-sync error:', err.message);
  }
}

// Run sync every 1 minute for live results
setInterval(() => {
  console.log('--- Triggering periodic sync ---');
  syncFromAPI();
}, 60 * 1000);

// Routes
app.get('/api/matches', async (req, res) => {
  try {
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
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/leagues', async (req, res) => {
  try {
    const leagues = await Match.aggregate([
      {
        $group: {
          _id: { country: "$country", league: "$league" },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.country",
          leagues: { $push: { name: "$_id.league", count: "$count" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/matches/live', async (req, res) => {
  try {
    const matches = await Match.find({ status: 'LIVE' }).sort({ startTime: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/match/:id', async (req, res) => {
  try {
    const TOKEN = process.env.BETSAPI_TOKEN;
    const match = await Match.findOne({ eventId: req.params.id });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Fetch timeline from BetsAPI if needed
    if (TOKEN && (match.status === 'LIVE' || (match.status === 'FINISHED' && (!match.events || match.events.length === 0)))) {
      try {
        const viewRes = await axios.get(`https://api.b365api.com/v1/event/view?event_id=${match.eventId}&token=${TOKEN}`);
        const result = viewRes.data.results?.[0];
        if (result && result.events) {
          const homeName = match.homeTeam.name.toLowerCase();
          const awayName = match.awayTeam.name.toLowerCase();

          match.events = result.events.map(ev => {
            const rawText = ev.text || '';
            const timeMatch = rawText.match(/^([0-9'+]+)/);
            const time = timeMatch ? timeMatch[1].replace("'", "") : '';
            
            let type = 'unknown';
            if (rawText.toLowerCase().includes('goal')) type = 'goal';
            else if (rawText.toLowerCase().includes('card')) type = 'card';
            else if (rawText.toLowerCase().includes('substitut')) type = 'sub';
            else if (rawText.toLowerCase().includes('var')) type = 'var';
            
            // Skip non-events like "Score After..."
            if (!time && !rawText.includes('Goal')) return null;

            let side = 'home';
            if (rawText.toLowerCase().includes(awayName)) side = 'away';
            else if (rawText.toLowerCase().includes(homeName)) side = 'home';
            else {
              // Fallback: try to see if it's the 2nd team mentioned if we can't find exact names
              // but usually BetsAPI includes the team name in parentheses
            }

            // Extract score if present in text (e.g. "Score After Full Time - 5-1" or in some goal texts)
            const scoreMatch = rawText.match(/([0-9]+-[0-9]+)/);
            const score = scoreMatch ? scoreMatch[1] : '';

            return {
              time,
              type,
              main_text: rawText,
              side,
              score
            };
          }).filter(e => e !== null);
          await match.save();
        }
      } catch (e) { }
    }
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sync Endpoint for Vercel Cron
app.get('/api/sync', async (req, res) => {
  try {
    console.log('Manual/Cron sync triggered');
    await syncFromAPI();
    res.json({ message: 'Sync started' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err) => {
    console.error('Server failed to start:', err);
  });
}

module.exports = app;
