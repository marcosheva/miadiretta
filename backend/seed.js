const mongoose = require('mongoose');
const Match = require('./models/Match');

const MONGODB_URI = "mongodb+srv://bet365odds:Aurora86@cluster0.svytet0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const sampleMatches = [
  {
    sport: 'Football',
    league: 'Serie A',
    country: 'Italy',
    countryFlag: '🇮🇹',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    status: 'LIVE',
    minute: '65\'',
    homeTeam: { name: 'Inter', score: 2 },
    awayTeam: { name: 'Milan', score: 1 },
    odds: { home: 1.85, draw: 3.40, away: 4.20 }
  },
  {
    sport: 'Football',
    league: 'Premier League',
    country: 'England',
    countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    startTime: new Date(Date.now() + 7200000), // 2 hours from now
    status: 'SCHEDULED',
    homeTeam: { name: 'Arsenal', score: 0 },
    awayTeam: { name: 'Liverpool', score: 0 },
    odds: { home: 2.10, draw: 3.50, away: 3.20 }
  },
  {
    sport: 'Football',
    league: 'LaLiga',
    country: 'Spain',
    countryFlag: '🇪🇸',
    startTime: new Date(Date.now() - 10800000), // 3 hours ago
    status: 'FINISHED',
    homeTeam: { name: 'Real Madrid', score: 3 },
    awayTeam: { name: 'Barcelona', score: 1 },
    odds: { home: 2.05, draw: 3.60, away: 3.40 }
  },
  {
    sport: 'Football',
    league: 'Serie A',
    country: 'Italy',
    countryFlag: '🇮🇹',
    startTime: new Date(Date.now() - 1800000), // 30 min ago
    status: 'LIVE',
    minute: '32\'',
    homeTeam: { name: 'Juventus', score: 0 },
    awayTeam: { name: 'Napoli', score: 0 },
    odds: { home: 2.40, draw: 3.10, away: 3.20 }
  },
  {
    sport: 'Tennis',
    league: 'ATP - Montpellier',
    country: 'France',
    countryFlag: '🇫🇷',
    startTime: new Date(Date.now() + 3600000), // 1 hour from now
    status: 'SCHEDULED',
    homeTeam: { name: 'Sinner J.', score: 0 },
    awayTeam: { name: 'Alcaraz C.', score: 0 },
    odds: { home: 1.70, away: 2.15 }
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding');
    
    await Match.deleteMany({});
    console.log('Cleared existing matches');
    
    await Match.insertMany(sampleMatches);
    console.log('Successfully seeded database');
    
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
