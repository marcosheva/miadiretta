const axios = require('axios');
const mongoose = require('mongoose');
const Match = require('./models/Match');
require('dotenv').config();

const TOKEN = process.env.BETSAPI_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

async function syncMatches() {
  if (!TOKEN) {
    console.error('BETSAPI_TOKEN not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for syncing');

    const allEvents = [];
    const liveEventIds = new Set();

    // 1. Fetch In-Play Matches (Generic Endpoint for better Metadata)
    console.log('Fetching live matches (Generic)...');
    try {
      const inplayRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
      const liveItems = inplayRes.data.results || [];
      allEvents.push(...liveItems);
      liveItems.forEach(ev => liveEventIds.add(ev.id));
      console.log(`Found ${liveItems.length} live matches`);
    } catch (e) { console.error('Error fetching live matches:', e.message); }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 2. Fetch Upcoming Matches (Generic Endpoint - Deep Sync)
    console.log('Fetching upcoming matches (Deep synchronization)...');
    const MAX_PAGES = 60; 
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        await wait(1000); // Wait 1s between pages
        const upcomingRes = await axios.get(`https://api.b365api.com/v1/events/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const results = upcomingRes.data.results || [];
        
        if (results.length === 0) {
          console.log(`Page ${page}: No more results.`);
          break;
        }

        allEvents.push(...results);
        console.log(`Page ${page}: Added ${results.length} matches (Total events so far: ${allEvents.length})`);
      } catch (e) {
        console.error(`Error fetching upcoming page ${page}:`, e.message);
        await wait(5000); // Wait longer on error
      }
    }

    // 3. Fetch Ended Matches: oggi + 6 giorni fa, fino a 100 pagine/giorno (Serie A ecc. in pagine alte)
    console.log('Fetching ended matches (last 7 days, up to 100 pages/day)...');
    const ENDED_DAYS_BACK = 7;
    const ENDED_MAX_PAGES_PER_DAY = 100;
    for (let daysAgo = 0; daysAgo < ENDED_DAYS_BACK; daysAgo++) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dayNum = String(d.getDate()).padStart(2, '0');
      const day = `${y}${m}${dayNum}`;
      let dayTotal = 0;
      for (let page = 1; page <= ENDED_MAX_PAGES_PER_DAY; page++) {
        try {
          await wait(300);
          const endedRes = await axios.get(`https://api.b365api.com/v1/events/ended?sport_id=1&token=${TOKEN}&day=${day}&page=${page}`);
          const endedItems = endedRes.data.results || [];
          allEvents.push(...endedItems);
          dayTotal += endedItems.length;
          if (endedItems.length < 50) break;
        } catch (e) {
          console.error('Error fetching ended matches:', e.message);
          break;
        }
      }
      if (dayTotal > 0) console.log(`Ended (${daysAgo === 0 ? 'today' : daysAgo + ' day(s) ago'}): ${dayTotal} matches`);
    }

    // 4. Handle status transitions: Find matches in DB that are LIVE but no longer in liveEventIds
    console.log('Checking for matches that should be marked as finished...');
    const dbLiveMatches = await Match.find({ status: 'LIVE' });
    for (const dbMatch of dbLiveMatches) {
      if (dbMatch.eventId && !liveEventIds.has(dbMatch.eventId)) {
        console.log(`Match ${dbMatch.homeTeam.name} vs ${dbMatch.awayTeam.name} is no longer live. Marking as FINISHED.`);
        dbMatch.status = 'FINISHED';
        await dbMatch.save();
      }
    }

    console.log(`Processing total ${allEvents.length} events...`);

    for (const ev of allEvents) {
      if (!ev.time) continue;

      let homeScore = 0;
      let awayScore = 0;
      if (ev.ss) {
        const scores = ev.ss.split('-');
        homeScore = parseInt(scores[0]) || 0;
        awayScore = parseInt(scores[1]) || 0;
      }

      // Metadata mapping
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

    console.log('Sync completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Sync error:', err.message);
    process.exit(1);
  }
}

syncMatches();
