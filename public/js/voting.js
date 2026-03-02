/**
 * Voting - Voting and attendance functionality
 * Refactored to use modular components.
 */

import { API } from './api.js';
import { getCurrentUser } from './auth.js'; // Helper from auth.js (assuming it exists or was part of this)
// Note: original voting.js imported `getCurrentUser` from `./auth.js`
import { scrollToVoting as uiScrollToVoting } from './ui.js';

// Modules
import { initSchedule } from './utils/schedule.js';
import { renderFeaturedReading, renderTBDReading } from './components/featured.js';
import { renderActiveVoting } from './components/votingTable.js';
import { renderArchive } from './components/archive.js';
import { renderSchedule, viewSessionResults } from './components/scheduleGrid.js';
import { renderProposalBanner } from './components/proposalBanner.js';

console.log('✅ Voting.js loaded - VERSION 3.0 - Modularized');

export { getCurrentUser }; // Export for components if needed

let allMembers = [];

export function setAllMembers(members) {
    allMembers = members;
}

// Wrapper for UI scroll
export function scrollToVoting() {
    uiScrollToVoting();
}

// Global actions
export async function submitVote(itemId) {
    try {
        const data = await API.submitVote(itemId);
        alert(data.message);
        // Trigger reload
        window.dispatchEvent(new CustomEvent('dataReload'));
    } catch (e) {
        alert("Vote failed.");
    }
}

export async function submitAttendance(itemId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '/auth/google';
        return;
    }
    
    try {
        await API.submitAttendance(itemId);
        // Trigger reload
        window.dispatchEvent(new CustomEvent('dataReload'));
    } catch (e) {
        console.error("Attendance failed", e);
    }
}

// Main Render Function
export async function renderTables(data) {
    // Ensure schedule is loaded first
    await initSchedule();
    
    const currentUser = getCurrentUser();
    const activeItems = data.filter(i => i.voteStatus === 'open');
    const archiveItems = data.filter(i => i.discussionStatus !== 'proposed' && i.voteStatus !== 'open' && i.discussionStatus !== 'selected')
                             .sort((a,b) => new Date(b.proposedDate) - new Date(a.proposedDate));
    
    // 0. Render Featured/Upcoming
    const selectedItem = data.find(i => i.discussionStatus === 'selected') || data.find(i => i.discussionStatus === 'discussed');
    
    if (selectedItem) {
        renderFeaturedReading(selectedItem, currentUser, allMembers);
    } else {
        renderTBDReading();
    }

    // 1. Render Active Voting
    renderActiveVoting(activeItems, currentUser, selectedItem);
    
    // 2. Render Archive
    renderArchive(archiveItems, allMembers);
    
    // 3. Render Schedule
    renderSchedule(data, selectedItem);

    // 4. Render Proposal Banner (New)
    renderProposalBanner(data, currentUser);
}

// Modal Actions
window.closeResultsModal = function() {
    document.getElementById('resultsModal').classList.add('hidden');
    document.getElementById('resultsModal').classList.remove('flex');
};

// Make functions globally accessible for onclick handlers
window.submitVote = submitVote;
window.submitAttendance = submitAttendance;
window.scrollToVoting = scrollToVoting;
window.viewSessionResults = viewSessionResults;

