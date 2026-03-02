const fs = require('fs').promises; // Use fs.promises
const fsSync = require('fs'); // Keep sync for specific initial checks if absolutely needed, but try to avoid
const path = require('path');

const READING_LIST_PATH = path.join(__dirname, '../data/readingList.json');
const NEW_READING_LIST_PATH = path.join(__dirname, '../data/newReadingList.json');
const MEMBERS_PATH = path.join(__dirname, '../data/members.json');

class ReadingListManager {
    constructor() {
        this.readingList = [];
        this.newReadings = [];
        this.members = [];
    }

    // Initialize data asynchronously
    async init() {
        // Load schedule if not already loaded (for deadline checks)
        // We need schedule.json to check dates
        if (!this.scheduleDates || this.scheduleDates.length === 0) {
           const schedulePath = path.join(__dirname, '../data/schedule.json');
           try {
               const scheduleData = await fs.readFile(schedulePath, 'utf8');
               this.scheduleDates = JSON.parse(scheduleData);
           } catch(e) {
               console.error("Error loading schedule in Manager:", e);
               this.scheduleDates = [];
           }
        }

        // Only load if not already loaded or if a refresh is explicitly needed

        // For simplicity, we'll just load every time init() is called.
        // A more robust solution might check a 'loaded' flag.
        this.readingList = await this.loadJSON(READING_LIST_PATH);
        this.newReadings = await this.loadJSON(NEW_READING_LIST_PATH);
        this.members = await this.loadJSON(MEMBERS_PATH);
    }

    async loadJSON(filePath) {
        try {
            // Check existence first
            try {
                await fs.access(filePath);
            } catch {
                return []; // File doesn't exist
            }
            
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error(`Error loading JSON from ${filePath}:`, err);
            return [];
        }
    }



    // Helper: Calculate strict deadline
    getDeadline(dateStr) {
        if (!dateStr) return new Date(0); // Past date if invalid
        const [y, m, d] = dateStr.split('-').map(Number);
        
        // Strict 11:59:59 PM EST/EDT
        // Same logic as client-side
        let dt = new Date(Date.UTC(y, m - 1, d, 23 + 5, 59, 59)); // Guess UTC-5
        
        // Intl formatter for NY
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric', hour12: false
        });
        
        const parts = formatter.formatToParts(dt);
        const hourInNY = parseInt(parts.find(p => p.type === 'hour').value);
        
        // Adjust if off due to DST (EDT is UTC-4)
        if (hourInNY === 0 || hourInNY === 24) { 
            dt.setHours(dt.getHours() - 1);
        }
        return dt;
    }

    // Helper: Check if voting is open for the upcoming session
    checkVotingOpen() {
        if (!this.scheduleDates || this.scheduleDates.length === 0) return true; // Default to open if no schedule
        
        const now = new Date();
        // Logic: Find next session. Deadline is "Tuesday before" (usually).
        // Actually, logic is: Find the session we are voting FOR.
        // If we have a 'selected' item, we are voting for the session AFTER next?
        // Let's replicate the `votingTable.js` logic which is the source of truth for "active session".
        
        // Use simplified logic: 
        // 1. Find the first session in the future.
        // 2. Its deadline is usually the day before.
        // 3. BUT logic says: "Voting closes Tuesday... Session is Wednesday".
        // The schedule array contains Session Dates (Wednesdays).
        
        let nextIndex = this.scheduleDates.findIndex(d => new Date(d) >= now);
        
        if (nextIndex === -1) return false; // No more sessions? Closed.
        
        let deadlineDate = null;
        
        // If nextIndex is 0 (First session), logic is a bit custom or maybe just D-1
        if (nextIndex === 0) {
             // For the very first session, usually we vote until day before
             deadlineDate = this.getDeadline(this.scheduleDates[0]);
             deadlineDate.setDate(deadlineDate.getDate() - 1); // Day before
        } else {
            // Standard: Voting for session at nextIndex
            // Deadline is day before session at nextIndex
            // UNLESS we are in the "gap" week?
            // Let's assume strictness: Voting closes 11:59PM the day before the session.
             deadlineDate = this.getDeadline(this.scheduleDates[nextIndex]);
             deadlineDate.setDate(deadlineDate.getDate() - 1);
             // Verify: If we just finished session N-1, we are voting for Session N.
        }
        
        // Correction: The deadline date should still be set to 23:59:59 NY
        // `getDeadline` returns 23:59:59 of the input date.
        // If input was SessionDate (Wed), we subtracted 1 day -> Tuesday. 
        // The status is preserved (23:59:59).
        
        if (now > deadlineDate) {
            return false;
        }
        return true;
    }

    async saveJSON(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error(`Error saving JSON to ${filePath}:`, err);
        }
    }

    // Helper to get full list
    async getFullList() {
        await this.init(); // Ensure fresh
        return [...this.readingList, ...this.newReadings];
    }

    async addMember(name, email) {
        await this.init();
        if (!email) throw new Error("Email is required");
        
        // Check for duplicates
        if (this.members.some(m => m.email === email)) {
            // Check if name update needed? For now just return existing
             return this.members.find(m => m.email === email);
        }

        const newMember = {
            id: `member_${Date.now()}`,
            name: name || "Anonymous",
            email: email,
            joinedDate: new Date().toISOString()
        };

        this.members.push(newMember);
        await this.saveJSON(MEMBERS_PATH, this.members);
        console.log(`Added member: ${name} (${email})`);
        return newMember;
    }

    // --- CSV PARSING HELPER ---
    async parseCSV(filePath) {
        try {
            await fs.access(filePath); // Check if file exists
        } catch {
            console.error(`File not found: ${filePath}`);
            return [];
        }
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        return lines.slice(1).map(line => {
            // Basic CSV split - warning: breaks on commas inside quotes
            // Ideally use a library, but for basic Google Forms without commas in titles this works
            // or use a regex splitter: line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });
    }

    // --- ACTIONS ---

    // 0. Import Types
    async importProposals(csvPath) {
        await this.init();
        const records = await this.parseCSV(csvPath);
        console.log(`Found ${records.length} records.`);
        
        for (const r of records) {
            // Map Google Forms columns to our schema
            // Expected CSV headers: "Timestamp", "Email Address", "Title", "Author", "Type"
            const proposal = {
                title: r['Title'] || r['What is the title?'], // adjust based on actual form questions
                author: r['Author'] || r['Who is the author?'],
                mediumType: r['Type'] || r['Medium (Book, Article, Video...)'],
                proposedBy: r['Email Address'] || r['Username']
            };

            // Deduplicate?
            if (this.newReadings.find(n => n.title === proposal.title) || 
                this.readingList.find(e => e.title === proposal.title)) {
                console.log(`Skipping duplicate: ${proposal.title}`);
                continue;
            }

            await this.addProposal(proposal);
        }
    }

    async importVotes(csvPath) {
        await this.init();
        const records = await this.parseCSV(csvPath);
        console.log(`Found ${records.length} votes.`);
        
        // Reset open votes? Or add cumulative? 
        // Let's assume cumulative for now, but usually we want to clear previous votes if re-running
        // For simplicity: just iterate and vote
        
        for (const r of records) {
            // Expected CSV: timestamp, email, "Which item do you vote for?" (title or ID)
            const voteTargetTitle = r['Vote'] || r['Which reading do you vote for?']; 
            const voterEmail = r['Email Address'];

            // Find item by title (since Forms usually show text, not IDs)
            const item = this.readingList.find(i => i.title === voteTargetTitle && i.voteStatus === 'open');
            
            if (item) {
                // Ensure voters array exists
                if (!item.voters) item.voters = [];

                // Check if this user already voted for this item (to prevent double counting from CSV)
                if (!item.voters.includes(voterEmail)) {
                    item.voters.push(voterEmail);
                    item.voteCount = item.voters.length;
                    console.log(`Vote recorded for: ${item.title} by ${voterEmail}`);
                } else {
                    console.log(`Skipping duplicate vote for ${item.title} by ${voterEmail}`);
                }
            } else {
                console.log(`Vote invalid or item not open: ${voteTargetTitle}`);
            }
        }
        await this.saveJSON(READING_LIST_PATH, this.readingList);
    }

    // 1. Add Proposal with "1 Reading Per 2 Weeks" Rule
    // Logic: If user has an existing proposal in 'proposed' state, UPDATE it.
    // If they have a 'selected' or 'discussed' reading, they can propose a new one.
    async addProposal(proposal) {
        await this.init(); // Ensure we have latest data to check against

        // CHECK DEADLINE
        if (!this.checkVotingOpen()) {
            throw new Error("Proposals are closed for the upcoming session.");
        }

        // Target: Only allow 1 active proposal per user
        // Check newReadings (staging) and readingList (active) for 'proposed' items
        const existingIndexNew = this.newReadings.findIndex(i => i.proposedBy === proposal.proposedBy);
        // Note: We only check 'proposed' status. If 'open' for voting, maybe allow update? 
        // For simplicity and strictness: if it's in the list and NOT selected/discussed/archived, it's their "active" proposal.
        // Actually, 'voteStatus' === 'open' is the key for active items. 
        // 'discussionStatus' === 'proposed' is for items not yet voted on? 
        // Let's look at the schema roughly:
        // New items -> discussionStatus: 'proposed', voteStatus: 'open'
        
        const existingIndexMain = this.readingList.findIndex(i => 
            i.proposedBy === proposal.proposedBy && 
            (i.discussionStatus === 'proposed' || i.voteStatus === 'open')
        );

        // Strict 1-reading rule: Update existing valid proposal
        if (existingIndexNew !== -1) {
            // Update existing in newReadings
            const oldTitle = this.newReadings[existingIndexNew].title;
            this.newReadings[existingIndexNew] = {
                ...this.newReadings[existingIndexNew],
                ...proposal,
                proposedDate: new Date().toISOString() // Update timestamp
            };
            await this.saveJSON(NEW_READING_LIST_PATH, this.newReadings);
            console.log(`Updated proposal (Rule: 1/user): "${oldTitle}" -> "${proposal.title}" by ${proposal.proposedBy}`);
            return "Proposal updated (Limit: 1 active proposal).";
        } 
        
        if (existingIndexMain !== -1) {
             // Update existing in readingList
            const oldTitle = this.readingList[existingIndexMain].title;
            this.readingList[existingIndexMain] = {
                ...this.readingList[existingIndexMain],
                ...proposal,
                proposedDate: new Date().toISOString()
            };
            await this.saveJSON(READING_LIST_PATH, this.readingList);
            console.log(`Updated proposal (Rule: 1/user): "${oldTitle}" -> "${proposal.title}" by ${proposal.proposedBy}`);
            return "Proposal updated (Limit: 1 active proposal).";
        }

        const newEntry = {
            id: `item_${Date.now()}`,
            ...proposal,
            voteStatus: 'open',
            voteCount: 0,
            voters: [], 
            discussionStatus: 'proposed',
            proposedDate: new Date().toISOString()
        };
        
        // DIRECT SAVE to main list (bypassing staging for typical flow)
        this.readingList.push(newEntry);
        await this.saveJSON(READING_LIST_PATH, this.readingList);
        console.log(`Added proposal to main list: ${proposal.title} by ${proposal.proposedBy}`);
        return "Proposal submitted.";
    }

    // 1.5 Delete Proposal
    async deleteProposal(itemId, userEmail) {
        await this.init();
        
        // Check newReadings
        const idxNew = this.newReadings.findIndex(i => i.id === itemId);
        if (idxNew !== -1) {
            if (this.newReadings[idxNew].proposedBy !== userEmail) throw new Error("Unauthorized");
            this.newReadings.splice(idxNew, 1);
            await this.saveJSON(NEW_READING_LIST_PATH, this.newReadings);
            return "Proposal deleted.";
        }

        // Check readingList
        const idxMain = this.readingList.findIndex(i => i.id === itemId);
        if (idxMain !== -1) {
             if (this.readingList[idxMain].proposedBy !== userEmail) throw new Error("Unauthorized");
             this.readingList.splice(idxMain, 1);
             await this.saveJSON(READING_LIST_PATH, this.readingList);
             return "Proposal deleted.";
        }
        
        throw new Error("Item not found.");
    }

    // 2. Prepare Vote: Merge new readings into main list
    async mergeProposals() {
        await this.init();
        if (this.newReadings.length === 0) {
            console.log("No new proposals to merge.");
            return;
        }
        this.readingList = [...this.readingList, ...this.newReadings];
        this.newReadings = []; // Clear staging
        await this.saveJSON(READING_LIST_PATH, this.readingList);
        await this.saveJSON(NEW_READING_LIST_PATH, this.newReadings);
        console.log("Merged proposals into main list.");
    }

    // 3. Vote: Update votes for an item (Max 3 votes per person)
    async voteForItem(itemId, userEmail) {
        await this.init();
        
        // CHECK DEADLINE
        if (!this.checkVotingOpen()) {
            throw new Error("Voting is closed for the upcoming session.");
        }
        
        // Find all items user has already voted for in this cycle
        const votedItems = this.readingList.filter(i => 
            i.voteStatus === 'open' && i.voters && i.voters.includes(userEmail)
        );

        // Check if user is voting for an item they already voted for (Toggle OFF)
        const existingVote = votedItems.find(i => i.id === itemId);
        if (existingVote) {
             existingVote.voters = existingVote.voters.filter(e => e !== userEmail);
             existingVote.voteCount = existingVote.voters.length;
             await this.saveJSON(READING_LIST_PATH, this.readingList);
             console.log(`Vote removed for: ${existingVote.title} by ${userEmail}`);
             return "Vote removed.";
        }

        // Check limit (Max 3)
        if (votedItems.length >= 3) {
            throw new Error("You have reached the maximum of 3 votes.");
        }

        // Add Vote (Toggle ON)
        const item = this.readingList.find(i => i.id === itemId);
        if (item && item.voteStatus === 'open') {
            if (!item.voters) item.voters = []; // ensure array exists
            
            item.voters.push(userEmail);
            item.voteCount = item.voters.length;
            
            await this.saveJSON(READING_LIST_PATH, this.readingList);
            console.log(`Vote recorded for: ${item.title} by ${userEmail}`);
            return "Vote recorded.";
        }
        throw new Error("Item not found or voting closed.");
    }

    // 4. Attend: Toggle attendance
    async toggleAttendance(itemId, userEmail) {
        await this.init();
        
        const item = this.readingList.find(i => i.id === itemId);
        if (!item) throw new Error("Item not found.");

        if (!item.attendees) item.attendees = []; // Ensure existence

        const idx = item.attendees.indexOf(userEmail);
        let msg = "";
        
        if (idx !== -1) {
            // Remove
            item.attendees.splice(idx, 1);
            msg = "Attendance cancelled.";
        } else {
            // Add
            item.attendees.push(userEmail);
            msg = "Attendance confirmed.";
        }
        
        await this.saveJSON(READING_LIST_PATH, this.readingList);
        return msg;
    }

    // 4. Decision: Select winner logic
    async selectWinner() {
        await this.init();
        // Filter for open items
        const candidates = this.readingList.filter(i => i.voteStatus === 'open');
        
        if (candidates.length === 0) {
            console.log("No candidates open for voting.");
            return null;
        }

        // Sort by criteria
        candidates.sort((a, b) => {
            // Priority 1: High Score
            if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
            
            // Priority 2: Early Proposed Date (Ascending)
            const dateA = new Date(a.proposedDate);
            const dateB = new Date(b.proposedDate);
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;

            // Priority 3: Proposed by person less selected (Mock logic: naive count of prev selections)
            // For now, we'll skip this complex historical lookback or treat equal.
            return 0;
        });

        const winner = candidates[0];
        console.log(`WINNER: ${winner.title} (${winner.voteCount} votes)`);
        
        // Close voting for everyone in this batch? Or just mark winner? 
        // Usually we select one and keep others for next time, or reset?
        // Implemented: Mark winner as 'selected', keep others 'open'
        winner.discussionStatus = 'selected';
        winner.voteStatus = 'closed';
        
        await this.saveJSON(READING_LIST_PATH, this.readingList);
        return winner;
    }


}

// CLI Integration
if (require.main === module) {
    const args = process.argv.slice(2);
    const action = args[0];
    const manager = new ReadingListManager();

    (async () => { // Wrap CLI logic in an async IIFE
        try {
            // No need to call manager.init() here, each method calls it as needed.
            switch (action) {
                case 'import-proposals':
                    // Usage: node manager.js import-proposals path/to/forms.csv
                    await manager.importProposals(args[1]);
                    break;
                case 'import-votes':
                    // Usage: node manager.js import-votes path/to/votes.csv
                    await manager.importVotes(args[1]);
                    break;
                case 'add':
                    // Usage: node manager.js add "Title" "Author" "Type" "Proposer"
                    await manager.addProposal({
                        title: args[1],
                        author: args[2],
                        mediumType: args[3],
                        proposedBy: args[4]
                    });
                    break;
                case 'delete':
                    // Usage: node manager.js delete item_id user_email
                    await manager.deleteProposal(args[1], args[2]);
                    console.log("Proposal deleted successfully.");
                    break;
                case 'merge':
                    await manager.mergeProposals();
                    break;
                case 'vote':
                    // Usage: node manager.js vote item_id user_email
                    await manager.voteForItem(args[1], args[2]);
                    break;
                case 'attend':
                    // Usage: node manager.js attend item_id user_email
                    const attendMsg = await manager.toggleAttendance(args[1], args[2]);
                    console.log(attendMsg);
                    break;
                case 'decide':
                    await manager.selectWinner();
                    break;
                case 'list':
                    await manager.init(); // Ensure data is loaded for listing
                    console.log(JSON.stringify(manager.readingList, null, 2));
                    break;
                case 'list-full':
                    const fullList = await manager.getFullList();
                    console.log(JSON.stringify(fullList, null, 2));
                    break;
                case 'add-member':
                    // Usage: node manager.js add-member "Name" "email@example.com"
                    await manager.addMember(args[1], args[2]);
                    break;
                default:
                    console.log("Unknown command. Use: import-proposals, import-votes, add, delete, merge, vote, attend, decide, list, list-full, add-member");
            }
        } catch (error) {
            console.error("Operation failed:", error.message);
        }
    })();
}

module.exports = ReadingListManager;
