/**
 * Schedule Utility
 * Handles fetching configuration and calculating deadlines.
 */

let SCHEDULE_DATES = [];

export async function initSchedule() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        SCHEDULE_DATES = config.schedule;
        console.log("📅 Schedule loaded:", SCHEDULE_DATES);
    } catch (e) {
        console.error("❌ Failed to load schedule:", e);
        // Fallback or alert?
        alert("Failed to load schedule configuration.");
    }
}

export function getSchedule() {
    return SCHEDULE_DATES;
}

// Helper: Get strict 11:59:59 PM EST deadline for a given date string
export function getDeadline(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Create date at 23:59:59 local time of the date
    // Then force interpret as EST/EDT if needed, but for visual alignment
    // we just want to ensure we compare against end of that day.
    return new Date(y, m - 1, d, 23, 59, 59);
}

// Helper: Format date as "Month DD, HH:MM:SS PM EST"
export function formatDeadlineDisplay(dateObj) {
    return dateObj.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short'
    });
}
