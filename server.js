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

// GET /api/voting-rules
app.get('/api/voting-rules', (req, res) => {
    try {
        const rulesPath = path.join(__dirname, 'data', 'votingclosetime.json');
        if (fs.existsSync(rulesPath)) {
            const rules = fs.readFileSync(rulesPath, 'utf8');
            res.json(JSON.parse(rules));
        } else {
            console.error("votingclosetime.json not found");
            res.status(404).json({ error: "Voting rules not found" });
        }
    } catch (err) {
        console.error('Error reading voting rules:', err);
        res.status(500).json({ error: 'Failed to load voting rules' });
    }
});

// GET /api/next-session-schedule
app.get('/api/next-session-schedule', (req, res) => {
    try {
        const schedulePath = path.join(__dirname, 'data', 'nextsessionschedule.json');
        if (fs.existsSync(schedulePath)) {
            const data = fs.readFileSync(schedulePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ error: "Next session schedule not found" });
        }
    } catch (err) {
        console.error('Error reading next session schedule:', err);
        res.status(500).json({ error: 'Failed to load schedule' });
    }
});


// Helper function to check and archive past voting sessions
function checkAndArchiveVotes() {
    try {
        const now = new Date();
        const votingResultsPath = path.join(__dirname, 'data', 'votingResults.json');
        const votingRulesPath = path.join(__dirname, 'data', 'votingclosetime.json');
        
        // Load rules
        if (!fs.existsSync(votingRulesPath)) {
            console.error("Cannot archive: votingclosetime.json missing");
            return;
        }
        const votingRules = JSON.parse(fs.readFileSync(votingRulesPath, 'utf8'));

        // Load existing archives
        let archives = [];
        if (fs.existsSync(votingResultsPath)) {
            try {
                archives = JSON.parse(fs.readFileSync(votingResultsPath, 'utf8'));
            } catch (e) {
                console.error("Error reading votingResults.json, starting fresh", e);
                archives = [];
            }
        }
        
        // Load current reading list
        const readingListPath = path.join(__dirname, 'data', 'readingList.json');
        if (!fs.existsSync(readingListPath)) return;
        let readingList = JSON.parse(fs.readFileSync(readingListPath, 'utf8'));
        
        // Check each rule
        votingRules.forEach((rule) => {
            const votingCloseDate = new Date(rule.votingClose); // ISO String from JSON
            const sessionId = `session_${rule.sessionDate}`; // Format: session_YYYY-MM-DD
            
            // If voting has closed AND we haven't archived it yet
            if (now > votingCloseDate && !archives.find(a => a.sessionId === sessionId)) {
                log(`Archiving voting session for ${rule.sessionDate} (Closed ${rule.votingClose})`);
                
                // --- WINNER SELECTION LOGIC ---
                // 1. Filter proposals that were "open" (or candidates)
                // In this simple app, ALL proposals in readingList are candidates unless already 'discussed'.
                // Ideally, we should filter by 'proposedDate' vs 'votingOpen' to be precise, 
                // but usually all 'proposed' items are up for vote.
                
                const candidates = readingList.filter(r => r.discussionStatus === 'proposed');
                
                if (candidates.length === 0) {
                    log(`No candidates for session ${sessionId}`);
                    return; // Skip if no candidates
                }

                // 2. Sort by Votes (Descending)
                candidates.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
                
                // 3. Pick Winner (Top 1)
                const winner = candidates[0];
                
                // And maybe mark others as 'archived_proposal' or keep them 'proposed' for next round?
                // Usually, losers carry over. Winner becomes 'selected'.
                
                // --- UPDATE PAST SELECTED TO DISCUSSED ---
                // Before marking the new winner, any reading that was currently marked as 'selected'
                // has now officially passed its meeting time (since we are archiving the NEXT session).
                // Let's transition those to 'discussed' and ensure vote status is closed to display properly.
                readingList.forEach(r => {
                    if (r.discussionStatus === 'selected') {
                        r.discussionStatus = 'discussed';
                        r.voteStatus = 'closed';
                    }
                });

                // We update readingList.json
                const winnerIndex = readingList.findIndex(r => r.id === winner.id);
                if (winnerIndex !== -1) {
                    readingList[winnerIndex].discussionStatus = 'selected'; // Marks it for "Next Session"
                    // Also set the "sessionDate" it is selected FOR
                    readingList[winnerIndex].selectedForSession = rule.sessionDate;
                    readingList[winnerIndex].voteStatus = 'closed'; // Stop voting for it
                }
                
                // --- RESET ALL OPEN VOTES ---
                // Reset vote count and voters for the next session
                readingList.forEach(r => {
                     if (r.discussionStatus === 'proposed' || r.discussionStatus === 'selected') {
                         r.voteCount = 0;
                         r.voters = [];
                     }
                });
                
                // 5. Create Archive Entry
                const allProposalsSnapshot = candidates.map(r => ({
                        id: r.id,
                        title: r.title,
                        author: r.author,
                        mediumType: r.mediumType,
                        link: r.link,
                        proposedBy: r.proposedBy,
                        proposedDate: r.proposedDate,
                        voteCount: r.voteCount || 0,
                        voters: r.voters || [],
                        discussionStatus: r.id === winner.id ? 'selected' : 'proposed'
                }));

                const archiveEntry = {
                    sessionId,
                    sessionDate: rule.sessionDate,
                    archivedDate: new Date().toISOString(),
                    winningReading: {
                        id: winner.id,
                        title: winner.title,
                        author: winner.author,
                        mediumType: winner.mediumType,
                        link: winner.link,
                        voteCount: winner.voteCount || 0,
                        attendees: [] // Reset attendees for the new event
                    },
                    allProposals: allProposalsSnapshot,
                    totalVoters: new Set(allProposalsSnapshot.flatMap(p => p.voters)).size,
                    totalProposals: allProposalsSnapshot.length
                };
                
                archives.push(archiveEntry);
                log(`Archived session ${sessionId}. Winner: ${winner.title} (${winner.voteCount} votes)`);
                
                // SAVE FILES
                fs.writeFileSync(votingResultsPath, JSON.stringify(archives, null, 2));
                fs.writeFileSync(readingListPath, JSON.stringify(readingList, null, 2));
            }
        });

    } catch (error) {
        console.error('Error during vote archiving:', error);
    }
}

// Global reference for active timeout (so we can clear it if rules reload)
let activeAlarmTimeout = null;

function scheduleVotingAlarms() {
    try {
        const votingRulesPath = path.join(__dirname, 'data', 'votingclosetime.json');
        if (!fs.existsSync(votingRulesPath)) return;
        
        const votingRules = JSON.parse(fs.readFileSync(votingRulesPath, 'utf8'));
        const now = new Date();
        
        // --- Catch-up Check ---
        // Instantly run the archive check on startup/reload to catch any
        // deadlines that passed while the server was offline or before this code existed.
        checkAndArchiveVotes();

        // Clear any existing alarm to avoid duplicates
        if (activeAlarmTimeout) {
            clearTimeout(activeAlarmTimeout);
            activeAlarmTimeout = null;
        }

        // Find the strictly next upcoming deadline
        let nextDeadline = null;
        for (const rule of votingRules) {
            const closingTime = new Date(rule.votingClose);
            if (closingTime > now) {
                // If this deadline is in the future, check if it's the *nearest* future
                if (!nextDeadline || closingTime < new Date(nextDeadline.votingClose)) {
                    nextDeadline = rule;
                }
            }
        }

        if (nextDeadline) {
            const targetTime = new Date(nextDeadline.votingClose);
            const msUntilDeadline = targetTime.getTime() - now.getTime();
            
            // Just to be safe with max timeout size (~24.8 days)
            const MAX_TIMEOUT = 2147483647; 
            if (msUntilDeadline <= MAX_TIMEOUT) {
                log(`[Auto-Archive] Scheduled alarm for Next Deadline: ${targetTime.toISOString()} (${Math.round(msUntilDeadline/60000)} minutes away)`);
                activeAlarmTimeout = setTimeout(() => {
                    log(`[Auto-Archive] Alarm triggered for deadline: ${targetTime.toISOString()}`);
                    checkAndArchiveVotes();
                    // Schedule the next one after this fires
                    setTimeout(scheduleVotingAlarms, 1000); 
                }, msUntilDeadline);
            } else {
                // If it's more than 24 days away, check back in a week
                log(`[Auto-Archive] Next deadline is more than 24 days away. Scheduling a check for later.`);
                activeAlarmTimeout = setTimeout(scheduleVotingAlarms, 7 * 24 * 60 * 60 * 1000);
            }
        } else {
            log("[Auto-Archive] No upcoming voting deadlines found.");
        }
    } catch(err) {
        console.error("Error setting voting alarms:", err);
    }
}

// Initial alarm scheduling on startup
scheduleVotingAlarms();

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
app.post('/api/proposals', ensureAuthenticated, async (req, res) => {
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
        const msg = await manager.addProposal({ title, author, mediumType, link, proposedBy: userName });
        log(`Proposal action: ${msg} (${title} by ${userName})`);
        res.status(201).json({ message: msg });
    } catch (e) {
        log(`Proposal Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/proposals/:id
app.delete('/api/proposals/:id', ensureAuthenticated, async (req, res) => {
    try {
        const itemId = req.params.id;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;
        
        const msg = await manager.deleteProposal(itemId, userEmail);
        log(`Proposal Deleted: ${itemId} by ${userEmail}`);
        res.json({ message: msg });
    } catch (e) {
        log(`Delete Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/votes
// Body: { itemId }
app.post('/api/votes', ensureAuthenticated, async (req, res) => {
    try {
        const { itemId } = req.body;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;

        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required.' });
        }

        const msg = await manager.voteForItem(itemId, userEmail); // Pass voter email to logic
        log(`Vote action: ${msg} (${itemId} by ${userEmail})`);
        res.status(200).json({ message: msg });
    } catch (e) {
        log(`Vote Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/attend
// Body: { itemId }
app.post('/api/attend', ensureAuthenticated, async (req, res) => {
    try {
        const { itemId } = req.body;
        
        if (!req.user || !req.user.emails || !req.user.emails.length) {
            throw new Error("Could not identify user email from login.");
        }
        const userEmail = req.user.emails[0].value;

        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required.' });
        }

        const msg = await manager.toggleAttendance(itemId, userEmail);
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
