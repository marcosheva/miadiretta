const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.BETSAPI_TOKEN;
if (!TOKEN) {
  console.error('BETSAPI_TOKEN mancante in .env');
  process.exit(1);
}
const BASE_URL = 'https://api.b365api.com/v1/bet365';

async function diagnose() {
  try {
    console.log('--- GENERIC INPLAY ---');
    const inplayGeneric = await axios.get(`https://api.b365api.com/v1/events/inplay?token=${TOKEN}&sport_id=1`);
    console.log('Total Results:', inplayGeneric.data.results?.length);
    if (inplayGeneric.data.results?.length > 0) {
      console.log('Sample Keys:', Object.keys(inplayGeneric.data.results[0]));
      console.log('Sample cc:', inplayGeneric.data.results[0].cc);
      console.log('Sample league:', JSON.stringify(inplayGeneric.data.results[0].league, null, 2));
    }

    console.log('\n--- BET365 INPLAY ---');
    const inplayB365 = await axios.get(`https://api.b365api.com/v1/bet365/inplay?token=${TOKEN}&sport_id=1`);
    console.log('Total Results:', inplayB365.data.results?.length);

    console.log('\n--- UPCOMING ---');
    const upcoming = await axios.get(`${BASE_URL}/upcoming?token=${TOKEN}&sport_id=1`);
    console.log('Total Results:', upcoming.data.results?.length);
    if (upcoming.data.results?.length > 0) {
      const match = upcoming.data.results[0];
       console.log('Match Sample:', JSON.stringify({
        id: match.id,
        league: match.league,
        cc: match.cc
      }, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

diagnose();
