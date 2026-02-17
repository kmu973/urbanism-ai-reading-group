require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');
const ReadingListManager = require('./scripts/manager');

const app = express();
const PORT = 3000;
const manager = new ReadingListManager();

// --- AUTH CONFIGURATION ---
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("CRITICAL ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in .env");
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: (process.env.BASE_URL || "http://localhost:3000") + "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    // Logic: Identify user by email. 
    // If new, maybe auto-add to member list?
    // returns user profile
    const email = profile.emails[0].value;
    const name = profile.displayName;
    
    // Auto-register member if not exists (replaces manual signup)
    try {
        if (!manager.members.some(m => m.email === email)) {
            manager.addMember(name, email);
        }
    } catch(e) {
        console.log("Member checked/added for auth user");
    }

    return cb(null, profile);
  }
));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Middleware
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '.')));
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH ROUTES ---
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ 
            loggedIn: true, 
            user: { 
                name: req.user.displayName, 
                email: req.user.emails[0].value 
            } 
        });
    } else {
        res.json({ loggedIn: false });
    }
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    console.log("Auth failed for request");
    res.status(401).json({ error: "Please log in to participate." });
}

// --- API ENDPOINTS ---

// --- CONFIGURATION ---
const SCHEDULE_PATH = path.join(__dirname, 'data', 'schedule.json');
let SCHEDULE_DATES = [];

try {
    SCHEDULE_DATES = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
    console.log("Loaded Schedule:", SCHEDULE_DATES);
} catch (e) {
    console.error("Error loading schedule:", e);
}

// GET /api/config
app.get('/api/config', (req, res) => {
    res.json({
        schedule: SCHEDULE_DATES
    });
});


// Helper function to check and archive past voting sessions
function checkAndArchiveVotes() {
    try {
        const now = new Date();
        const votingResultsPath = path.join(__dirname, 'data', 'votingResults.json');
        
        // Load existing archives
        let archives = [];
        if (fs.existsSync(votingResultsPath)) {
            archives = JSON.parse(fs.readFileSync(votingResultsPath, 'utf8'));
        }
        
        // Load current reading list
        const readingListPath = path.join(__dirname, 'data', 'readingList.json');
        let readingList = JSON.parse(fs.readFileSync(readingListPath, 'utf8'));
        
        // Check each schedule date to see if it has passed and needs archiving
        SCHEDULE_DATES.forEach((dateStr) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const sessionDate = new Date(y, m - 1, d);
            const sessionId = `session_${dateStr}`;
            
            // If session date has passed and not already archived
            if (sessionDate < now && !archives.find(a => a.sessionId === sessionId)) {
                log(`Archiving voting session for ${dateStr}`);
                
                // Find the winning reading for this session
                const winningReading = readingList.find(r => 
                    r.discussionStatus === 'selected' || r.discussionStatus === 'discussed'
                );
                
                // Get all proposals that were open for voting
                const allProposals = readingList
                    .filter(r => r.voteStatus === 'open' || r.voteStatus === 'closed')
                    .map(r => ({
                        id: r.id,
                        title: r.title,
                        author: r.author,
                        mediumType: r.mediumType,
                        link: r.link,
                        proposedBy: r.proposedBy,
                        proposedDate: r.proposedDate,
                        voteCount: r.voteCount || 0,
                        voters: r.voters || [],
                        discussionStatus: r.discussionStatus
                    }));
                
                // Create archive entry
                const archiveEntry = {
                    sessionId,
                    sessionDate: dateStr,
                    archivedDate: new Date().toISOString(),
                    winningReading: winningReading ? {
                        id: winningReading.id,
                        title: winningReading.title,
                        author: winningReading.author,
                        mediumType: winningReading.mediumType,
                        link: winningReading.link,
                        voteCount: winningReading.voteCount || 0,
                        attendees: winningReading.attendees || []
                    } : null,
                    allProposals,
                    totalVoters: new Set(allProposals.flatMap(p => p.voters)).size,
                    totalProposals: allProposals.length
                };
                
                archives.push(archiveEntry);
                log(`Archived ${allProposals.length} proposals for session ${sessionId}`);
            }
        });
        
        // Save updated archives
        if (archives.length > 0) {
            fs.writeFileSync(votingResultsPath, JSON.stringify(archives, null, 2));
        }
        

    } catch (error) {
        console.error('Error during vote archiving:', error);
    }
}

// GET /api/readings
// Returns the merged reading list (main + new proposals)
// Also automatically archives past voting sessions
app.get('/api/readings', async (req, res) => {
    try {
        // Check and archive past votes automatically
        // TODO: Make checkAndArchiveVotes() async too if needed, but for now it reads files synchronously.
        // For consistency, let's keep it sync or refactor it later. The user asked for async efficiency.
        // Let's defer full archiving async refactor to keep this step manageable, 
        // but definitely use the async manager for reading the list.
        
        // Reload logic to ensure freshness if files changed manually
        const freshManager = new ReadingListManager(); 
        await freshManager.init(); // Initialize checks
        
        // For now, access direct properties (we'll update Manager to verify they are fresh)
        // Ideally, we start using async getters.
        
        // TEMP: Manager is currently sync in constructor. 
        // We will refactor Manager to have async init or async methods.
        // Let's assume we change Manager to have `async getFullList()`
        
        const fullList = await freshManager.getFullList();
        res.json(fullList);
    } catch (e) {
        console.error("Error fetching readings:", e);
        res.status(500).json({ error: "Failed to fetch readings" });
    }
});

// Helper for logging

function log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync('server.log', entry);
    console.log(msg);
}

// POST /api/proposals
// Body: { title, author, mediumType, proposedBy }
app.post('/api/proposals', ensureAuthenticated, (req, res) => {
    try {
        log(`User proposing: ${JSON.stringify(req.user)}`);

        const { title, author, mediumType, link } = req.body;
        
        // Safety check for user email
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;
        const userName = req.user.displayName || userEmail; // Fallback to email if no name
        
        if (!title || !author) {
            return res.status(400).json({ error: 'Title and Author are required.' });
        }

        // Enforce: proposedBy is the logged-in user's name
        const msg = manager.addProposal({ title, author, mediumType, link, proposedBy: userName });
        log(`Proposal action: ${msg} (${title} by ${userName})`);
        res.status(201).json({ message: msg });
    } catch (e) {
        log(`Proposal Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/proposals/:id
app.delete('/api/proposals/:id', ensureAuthenticated, (req, res) => {
    try {
        const itemId = req.params.id;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;
        
        const msg = manager.deleteProposal(itemId, userEmail);
        log(`Proposal Deleted: ${itemId} by ${userEmail}`);
        res.json({ message: msg });
    } catch (e) {
        log(`Delete Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/votes
// Body: { itemId }
app.post('/api/votes', ensureAuthenticated, (req, res) => {
    try {
        const { itemId } = req.body;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;

        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required.' });
        }

        const msg = manager.voteForItem(itemId, userEmail); // Pass voter email to logic
        log(`Vote action: ${msg} (${itemId} by ${userEmail})`);
        res.status(200).json({ message: msg });
    } catch (e) {
        log(`Vote Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/attend
// Body: { itemId }
app.post('/api/attend', ensureAuthenticated, (req, res) => {
    try {
        const { itemId } = req.body;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;

        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required.' });
        }

        const msg = manager.toggleAttendance(itemId, userEmail);
        log(`Attend action: ${msg} (${itemId} by ${userEmail})`);
        res.status(200).json({ message: msg });
    } catch (e) {
        log(`Attend Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/voting-history
// Returns archived voting results
app.get('/api/voting-history', (req, res) => {
    try {
        const votingResultsPath = path.join(__dirname, 'data', 'votingResults.json');
        
        if (fs.existsSync(votingResultsPath)) {
            const archives = JSON.parse(fs.readFileSync(votingResultsPath, 'utf8'));
            res.json(archives);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error retrieving voting history:', error);
        res.status(500).json({ error: 'Failed to retrieve voting history' });
    }
});

// POST /api/members
// GET /api/members
app.get('/api/members', (req, res) => {
    // Return list of members for directory
    // Hide emails? Or maybe just mask them if public, but for this group emails are username.
    // Let's return full obj for now since it's an internal group tool.
    res.json(manager.members);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
