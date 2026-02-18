/**
 * Schedule Utility
 * Handles fetching configuration and calculating deadlines.
 */

let VOTING_RULES = [];
let SCHEDULE_DATES = [];

export async function initSchedule() {
    try {
        console.log("📅 Fetching Voting Rules...");
        const response = await fetch('/api/voting-rules');
        VOTING_RULES = await response.json();
        
        // Extract array of date strings for compatibility
        SCHEDULE_DATES = VOTING_RULES.map(r => r.sessionDate);
        
        console.log("✅ Voting Rules Loaded:", VOTING_RULES);
    } catch (e) {
        console.error("❌ Failed to load voting rules:", e);
        // Fallback or alert?
        console.warn("Using empty schedule as fallback.");
    }
}

export function getSchedule() {
    return SCHEDULE_DATES;
}

// Helper: Get Current Time in New York (EST/EDT)
export function getNYTime() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Helper: Get Strict Voting Deadline for a specific session date string
// Uses the loaded VOTING_RULES.
export function getDeadline(sessionDateStr) {
    const rule = VOTING_RULES.find(r => r.sessionDate === sessionDateStr);
    
    if (rule && rule.votingClose) {
        // Return the explicit closing time from JSON
        return new Date(rule.votingClose);
    }
    
    // Fallback? Should not happen if JSON is complete.
    console.warn(`⚠️ No rule found for ${sessionDateStr}, defaulting to algorithmic.`);
    
    // Algorithmic Fallback (End of Day EST)
    const [y, m, d] = sessionDateStr.split('-').map(Number);
    const attempt = new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59));
     const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', hour12: false
    });
    const parts = formatter.formatToParts(attempt);
    const hourInNY = parseInt(parts.find(p => p.type === 'hour').value);
    if (hourInNY === 0 || hourInNY === 24) { 
        attempt.setHours(attempt.getHours() - 1);
    }
    return attempt;
}

// Helper: Get the Active Session Index based on Current NY Time
// Logic: A session is "Current/Upcoming" if we are locally before its "Rollover Time".
// Rule: Rollover is 6:00 PM EST on the Session Day.
export function getCurrentSessionIndex() {
    const nyNow = getNYTime();
    
    return SCHEDULE_DATES.findIndex(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        
        // Check if TODAY is this date
        const isSameDay = nyNow.getFullYear() === y && 
                          nyNow.getMonth() === (m - 1) && 
                          nyNow.getDate() === d;
                          
        if (isSameDay) {
            // Rollover at 6 PM
            return nyNow.getHours() < 18;
        }
        
        // Otherwise, is future?
        const nyY = nyNow.getFullYear();
        const nyM = String(nyNow.getMonth() + 1).padStart(2, '0');
        const nyD = String(nyNow.getDate()).padStart(2, '0');
        const nyDateStr = `${nyY}-${nyM}-${nyD}`;
        
        return dateStr > nyDateStr;
    });
}

// Helper: Format date for display
export function formatDeadlineDisplay(dateObj) {
    if (!dateObj) return "TBD";
    return dateObj.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric', // Compact time
        timeZone: 'America/New_York',
        timeZoneName: 'short'
    });
}
