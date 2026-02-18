/**
 * Voting Table Component
 * Renders the table of active proposals.
 */

import { getSchedule, getDeadline, formatDeadlineDisplay, getCurrentSessionIndex, getNYTime } from '../utils/schedule.js';

export function renderActiveVoting(activeItems, currentUser, selectedItem) {
    const voteBody = document.getElementById('votingTableBody');
    if (!voteBody) return;

    if (activeItems.length === 0) {
        voteBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-400">No active proposals right now. <br>Click the (+) button to suggest one!</td></tr>`;
    } else {
        // Count how many items the current user has voted for
        let userVoteCount = 0;
        if (currentUser) {
            userVoteCount = activeItems.filter(item => 
                item.voters && item.voters.includes(currentUser.email)
            ).length;
        }

        // Calculate deadline logic
        // Calculate deadline logic using strict NY Time rules
        const SCHEDULE_DATES = getSchedule();
        const nyNow = getNYTime();
        const activeIndex = getCurrentSessionIndex();
        
        let deadlineDate = null;
        let closureLabel = "";

        // Determine what we are voting FOR.
        // If we are active in Session N (e.g. Feb 18), we are voting for Session N+1 (Mar 4).
        // If we are BEFORE Session 0 (e.g. Feb 17), we are voting for Session 1 (Mar 4) because Session 0 is locked?
        // Wait, if today is Feb 17. 
        // Session 0 (Feb 18) voting closed Feb 4.
        // Session 1 (Mar 4) voting closes Feb 18.
        // So on Feb 17, we are voting for Session 1 (Mar 4).
        
        let targetSessionIndex = -1;
        
        if (activeIndex !== -1) {
            // Check if we are past the voting window for the *current* session?
            // "Current" usually means "Next Upcoming".
            // If next upcoming is Feb 18. Its voting closed Feb 4.
            // So we are NOT voting for Feb 18.
            // We are voting for the session AFTER that (Mar 4).
            
            // However, we need to handle the case where we might be in a "gap" or undefined state.
            // Simplified: We are always voting for `activeIndex + 1`?
            // Unless `activeIndex` is the last one.
            
            targetSessionIndex = activeIndex + 1;
            
            // Edge case: Before first session? 
            // If today is Jan 1. activeIndex might count as 0 (first future)?
            // getCurrentSessionIndex returns first future date.
            // If today is Feb 17. activeIndex = 0 (Feb 18).
            // We want to vote for Mar 4.
            
            if (targetSessionIndex < SCHEDULE_DATES.length) {
                deadlineDate = getDeadline(SCHEDULE_DATES[targetSessionIndex]);
            }
        }

        let votingClosed = false;
        if (deadlineDate && nyNow > deadlineDate) {
             closureLabel = "Closed";
             votingClosed = true;
        } else if (deadlineDate) {
             closureLabel = `Closes: ${formatDeadlineDisplay(deadlineDate)}`;
        }

        // Add vote counter to section title with instruction
        const titleElement = document.getElementById('votingSectionTitle');
        if (titleElement) {
            const baseText = titleElement.innerHTML.split('<div')[0].split('<span class="text-xs')[0]; // Cleanup previous injections
            
            // Create a coherent sub-header with instruction and counter
            // Using Blue theme colors
            const counterColor = userVoteCount >= 3 ? 'text-gray-800' : 'text-blue-800';
            const dotColor = userVoteCount >= 3 ? 'bg-black' : 'bg-blue-600';
            const counterText = `${userVoteCount}/3`;

            // ... (existing code for infoHtml) ...
            
            const infoHtml = `
                <div class="flex items-center gap-4 mt-2 ml-1">
                    <span class="badge badge-gray">Voting Limit: 3</span>
                    ${closureLabel ? `<span class="text-xs font-bold ${votingClosed ? 'text-red-600 bg-red-100' : 'text-red-500 bg-red-50'} border border-red-100 px-2 py-0.5 rounded uppercase tracking-wider">${closureLabel}</span>` : ''}
                    <span class="text-xs font-medium ${counterColor} flex items-center gap-2 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                        <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
                        <strong class="text-sm">${counterText}</strong> selected
                    </span>
                </div>
            `;
            
            // ... (existing code for appending infoHtml) ...
             // Append securely to parent section instead of relying on a potentially missing container
            const votingSection = document.getElementById('votingSection');
            const existingInfo = document.getElementById('votingInfoContainer');
            
            if (votingSection) {
                 if (existingInfo) {
                     existingInfo.innerHTML = infoHtml;
                 } else {
                     // Insert after header (h2)
                     const h2 = votingSection.querySelector('h2');
                     if (h2) {
                         const div = document.createElement('div');
                         div.id = 'votingInfoContainer';
                         div.innerHTML = infoHtml;
                         h2.insertAdjacentElement('afterend', div);
                     }
                 }
            }

            }

        voteBody.innerHTML = activeItems.map(item => {
            const iVotedForThis = currentUser && item.voters && item.voters.includes(currentUser.email);
            const iProposedThis = currentUser && item.proposedBy === currentUser.email;

            // Determine button state - Using fixed width and coherent styling
            let actionBtn = '';
            
            // Determine button state - Using CSS classes for coherence and maintenance
            
            if (!currentUser) {
                // Login state
                actionBtn = `<span class="login-placeholder">Login to vote</span>`;
            } else if (votingClosed) {
                // Closed state
                actionBtn = `<button disabled class="btn-vote-base btn-vote-disabled shadow-none opacity-50 cursor-not-allowed">Closed</button>`;
            } else if (iVotedForThis) {
                // Voted state - Brighter Natural Green (Emerald 500) -> Hover to Darker Green (Emerald 700)
                actionBtn = `<button onclick="submitVote('${item.id}')" class="btn-vote-base btn-vote-voted group shadow-md">
                    <span class="group-hover:hidden">Selected</span>
                    <span class="hidden group-hover:inline">Unvote</span>
                </button>`;
            } else {
                if (userVoteCount >= 3) {
                    // Limit reached - Disabled style
                    actionBtn = `<button disabled class="btn-vote-base btn-vote-disabled shadow-none">Max (3)</button>`;
                } else {
                     // Default Vote state - White with Green Border/Text on Hover
                    actionBtn = `<button onclick="submitVote('${item.id}')" class="btn-vote-base btn-vote-action transition-colors">Vote</button>`;
                }
            }

            const rowClass = iVotedForThis ? "bg-blue-50" : "hover:bg-gray-50";

            const titleHtml = item.link 
                ? `<a href="${item.link}" target="_blank" class="hover:underline flex items-center gap-2 group-hover:text-red-700">${item.title} <span class="text-[10px] text-gray-400">↗</span></a>` 
                : item.title;

            const isMine = currentUser && (
                item.proposedBy === currentUser.email || 
                item.proposedBy === currentUser.name
            );
            
            const editBtn = isMine 
                ? `<button onclick="openProposalModal('${item.id}')" class="text-xs text-gray-400 hover:text-black ml-2 underline">Edit</button>`
                : '';

            return `
                <tr class="border-b border-gray-100 last:border-0 ${rowClass} transition-colors group">
                    <td class="py-3 px-1 mono text-xs text-gray-400">${new Date(item.proposedDate).toLocaleDateString()}</td>
                    <td class="py-3 px-1 font-medium text-gray-900">${titleHtml} ${editBtn}</td>
                    <td class="py-3 px-1 text-gray-600">${item.author}</td>
                    <td class="py-3 px-1 text-xs uppercase text-gray-400 mono">${item.mediumType}</td>
                    <td class="py-3 px-1 text-sm text-gray-500">${item.proposedBy}</td>
                    <td class="py-3 px-1 text-center font-bold text-gray-800">${item.voteCount || 0}</td>
                    <td class="py-3 px-1 text-right">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }
}
