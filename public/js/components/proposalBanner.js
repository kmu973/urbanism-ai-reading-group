/**
 * Proposal Banner Component
 * Renders the "Add/Change Reading" banner with dynamic status and deadline info.
 */

import { getSchedule, getDeadline, formatDeadlineDisplay } from '../utils/schedule.js';

export function renderProposalBanner(data, currentUser) {
    const banner = document.getElementById('proposalBanner');
    if (!banner) return;
    
    // 1. Calculate Deadline
    const SCHEDULE_DATES = getSchedule();
    const now = new Date();
    let nextIndex = SCHEDULE_DATES.findIndex(d => new Date(d) >= now);
    
    // Logic from votingTable.js to determine which session we are voting for
    let deadlineDate = null;
    let sessionLabel = "next session";
    
    if (nextIndex !== -1) {
         // Voting deadlines are generally the day before the session (Tuesday)
         // Check if we are in the voting window for Session N
         // Voting for Session N starts after Session N-1 closes.
         
         // If nextIndex is 0 (First session), logic is a bit custom, usually D-12
         // If nextIndex > 0, deadline is Session N (nextIndex) minus 1 day? 
         // ACTUALLY: The rule is "Voting closes Tuesday 11:59PM before session"
         // Session Date is Wednesday.
         // So for Session `SCHEDULE_DATES[nextIndex]`, the deadline is that date - 1 day.
         
         const nextSessionDateStr = SCHEDULE_DATES[nextIndex];
         const [y, m, d] = nextSessionDateStr.split('-').map(Number);
         const sessionDate = new Date(y, m - 1, d);
         
         const deadline = new Date(sessionDate);
         deadline.setDate(deadline.getDate() - 1); // Tuesday
         deadline.setHours(23, 59, 59, 999); // End of day
         
         deadlineDate = deadline;
    }
    
    const timeWindowText = deadlineDate 
        ? `Proposals open until <span class="font-bold text-blue-700">${formatDeadlineDisplay(deadlineDate)}</span>`
        : "Loading schedule...";

    // 2. Check User Status
    let hasActiveProposal = false;
    let userProposal = null;

    if (currentUser) {
        userProposal = data.find(item => 
            (item.proposedBy === currentUser.email || item.proposedBy === currentUser.name) &&
            (item.discussionStatus === 'proposed' || item.voteStatus === 'open')
        );
        
        hasActiveProposal = !!userProposal;
    }

    // 3. Render Content
    if (!currentUser) {
        // Logged out state
        banner.innerHTML = `
            <div class="flex-1">
                <p class="text-sm font-semibold text-gray-800 mb-1">Want to suggest a reading?</p>
                <p class="text-xs text-gray-600">${timeWindowText}</p>
            </div>
            <button onclick="window.location.href='/auth/google'" class="bg-gray-800 text-white px-6 py-2.5 rounded font-bold text-sm uppercase hover:bg-black transition-colors whitespace-nowrap">
                Login to Propose
            </button>
        `;
    } else if (hasActiveProposal) {
        // Active proposal state (Update mode)
        banner.className = "mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between transition-colors duration-500";
        banner.innerHTML = `
            <div class="flex-1">
                <p class="text-sm font-semibold text-green-900 mb-1 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    You have an active proposal
                </p>
                <p class="text-xs text-green-700">"<strong>${userProposal.title}</strong>"</p>
                <p class="text-[10px] text-green-600 mt-1 uppercase tracking-wide">SUBMITTING AGAIN WILL UPDATE THIS ENTRY</p>
            </div>
            <button onclick="openProposalModal()" class="bg-green-600 text-white px-6 py-2.5 rounded font-bold text-sm uppercase hover:bg-green-700 transition-colors whitespace-nowrap shadow-sm">
                Change Reading
            </button>
        `;
    } else {
        // Standard state (Can add new)
        banner.className = "mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between transition-colors";
        banner.innerHTML = `
            <div class="flex-1">
                <p class="text-sm font-semibold text-gray-800 mb-1">Want to suggest a reading?</p>
                <p class="text-xs text-gray-600 mb-1">Members can add one reading every two weeks</p>
                <p class="text-[10px] text-blue-600 uppercase tracking-wide bg-blue-100 inline-block px-1.5 py-0.5 rounded">${timeWindowText}</p>
            </div>
            <button onclick="openProposalModal()" class="bg-blue-600 text-white px-6 py-2.5 rounded font-bold text-sm uppercase hover:bg-blue-700 transition-colors whitespace-nowrap shadow-blue-200 shadow-lg translate-y-0 hover:-translate-y-0.5 transition-all">
                Add Reading to List
            </button>
        `;
    }
}
