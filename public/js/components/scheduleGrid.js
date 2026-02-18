/**
 * Schedule Grid Component
 * Renders the calendar grid and handles "View Results" interactions.
 */

import { getSchedule, getDeadline, formatDeadlineDisplay, getCurrentSessionIndex, getNYTime } from '../utils/schedule.js';
import { scrollToVoting } from '../voting.js'; // Import action

export function renderSchedule(data, selectedItem) {
    const scheduleGrid = document.getElementById('scheduleGrid');
    if (!scheduleGrid) return;
    
    // Fetch archive data to check if sessions have results
    fetch('/api/voting-history')
        .then(res => res.json())
        .then(archives => {
            console.log('📊 Archives fetched:', archives);
            const archivedSessionIds = new Set(archives.map(a => a.sessionId));
            
            // Update voting section title with current session info
            updateVotingSectionTitle(archivedSessionIds);
            
            renderScheduleGrid(data, selectedItem, archivedSessionIds);
        })
        .catch(err => {
            console.error('❌ Error fetching archives:', err);
            renderScheduleGrid(data, selectedItem, new Set());
        });
}

function updateVotingSectionTitle(archivedSessionIds) {
    const titleElement = document.getElementById('votingSectionTitle');
    if (!titleElement) return;
    
    const SCHEDULE_DATES = getSchedule();
    const now = new Date();
    let currentSessionIndex = -1;
    
    // Find the currently open session
    // It's simply the first session that hasn't been archived yet
    for (let i = 0; i < SCHEDULE_DATES.length; i++) {
        const sessionId = `session_${SCHEDULE_DATES[i]}`;
        const hasArchive = archivedSessionIds.has(sessionId);
        
        if (!hasArchive) {
            currentSessionIndex = i;
            break;
        }
    }
    
    // Update title with session info
    if (currentSessionIndex !== -1) {
        const sessionDate = SCHEDULE_DATES[currentSessionIndex];
        const [y, m, d] = sessionDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        titleElement.innerHTML = `Open for Voting: <span class="text-blue-600">Session ${currentSessionIndex + 1}</span> <span class="text-gray-500 text-base font-normal">(${formattedDate})</span>`;
    } else {
        titleElement.textContent = 'Open for Voting';
    }
}

function renderScheduleGrid(data, selectedItem, archivedSessionIds) {
    const scheduleGrid = document.getElementById('scheduleGrid');
    const SCHEDULE_DATES = getSchedule();
    const nyNow = getNYTime();
    
    // Use unified logic:
    // This returns the index of the UPCOMING session (e.g. Feb 18 if today is Feb 17).
    let nextIndex = getCurrentSessionIndex();
    
    // If nextIndex is -1 (all sessions past), target beyond end
    if (nextIndex === -1) {
        // Double check if *really* past or just not found? 
        // getCurrentSessionIndex handles "Past last session"
         nextIndex = SCHEDULE_DATES.length;
    }

    scheduleGrid.innerHTML = SCHEDULE_DATES.map((dateStr, idx) => {
        // Use consistent date parsing (Year-Month-Day)
        const [y, m, d] = dateStr.split('-').map(Number);
        // Create date object for display (Midnight local is fine for day/month names)
        const localDate = new Date(y, m - 1, d);
        
        const month = localDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = localDate.getDate().toString().padStart(2, '0');
        
        let title = "Topic TBD";
        let titleDisplay = title; 
        let buttons = "";
        let opacity = "opacity-100";
        let containerClass = "bg-white border-transparent";
        
        // Define relationship to Current Session
        const isNext = (idx === nextIndex);
        const isPast = (idx < nextIndex); // STRICTLY previous
        
        // Check archive status
        const sessionId = `session_${dateStr}`;
        const hasArchive = archivedSessionIds.has(sessionId);

        // Determine if this session is "Completed"
        // Completed = Archived OR Past
        const isCompleted = hasArchive || isPast;
        
        if (isCompleted) {
             // Past session - show View Results
            title = hasArchive ? "View Results" : "Session Completed";
            titleDisplay = title;
            opacity = "opacity-60";
            
            // Show "View Results" button if archive exists
            buttons = hasArchive ? `
                <button onclick="viewSessionResults('${dateStr}')" class="w-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600 py-1.5 rounded hover:bg-blue-100 transition-colors border border-blue-100">View Results</button>
            ` : `
                <button disabled class="w-full text-[10px] font-bold uppercase bg-gray-100 text-gray-400 py-1.5 rounded cursor-not-allowed">Vote</button>
            `;
        } else if (isNext) {
             // THIS IS THE CURRENT / UPCOMING SESSION
            if (selectedItem) {
                // If we have selected a book for this session
                title = selectedItem.title;
                titleDisplay = selectedItem.link 
                    ? `<a href="${selectedItem.link}" target="_blank" class="hover:underline hover:text-blue-600">${selectedItem.title}</a>`
                    : selectedItem.title;
                
                containerClass = "bg-white border-2 border-red-500 transform scale-105 z-10 shadow-xl";
                
                buttons = `
                    <button disabled class="w-full text-[10px] font-bold uppercase bg-gray-100 text-gray-400 py-1.5 rounded cursor-not-allowed">Vote</button>
                `;
            } else {
                // No book selected yet? 
                // Wait, if it is the "Next" session (e.g. tomorrow), usually a book IS selected.
                // If not, maybe we are still voting?
                // But voting closes TODAY/NOW? or Yesterday?
                // Check deadline
                const deadline = getDeadline(dateStr); // Deadline is TODAY 11:59PM
                if (nyNow < deadline) {
                     // Voting is OPEN for this session!
                     const deadlineStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                     title = `Voting closes <br> ${deadlineStr}`;
                     titleDisplay = title;
                     containerClass = "bg-white border-2 border-blue-500 transform scale-105 z-10 shadow-xl";
                     buttons = `
                        <button onclick="scrollToVoting()" class="w-full text-[10px] font-bold uppercase bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700 transition-colors shadow-md">Vote Now</button>
                     `;
                } else {
                     // Voting Closed, Discussion imminent
                     title = "Voting Closed";
                     titleDisplay = title;
                     containerClass = "bg-white border-2 border-gray-200";
                     buttons = `<button disabled class="w-full text-[10px] font-bold uppercase bg-gray-100 text-gray-400 py-1.5 rounded cursor-not-allowed">Closed</button>`;
                }
            }
         } else {
            // FUTURE SESSIONS (idx > nextIndex)
            // Determine if voting is OPEN for this future session.
            // Rule: Voting opens when previous session ends?
            // Actually, voting for Session N usually starts after Session N-1 voting closes.
            
            // Check Previous Session
            const prevSessionIdx = idx - 1;
            if (prevSessionIdx >= 0) {
                 const prevDeadline = getDeadline(SCHEDULE_DATES[prevSessionIdx]);
                 // If previous deadline passed, we might be open.
                 if (nyNow > prevDeadline) {
                      // Open for voting!
                      // Deadline is logic for THIS session
                      const deadline = getDeadline(dateStr);
                      const deadlineStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      title = `Voting closes <br> ${deadlineStr}`;
                      titleDisplay = title;
                      containerClass = "bg-white border-2 border-gray-200";
                      buttons = `
                        <button onclick="scrollToVoting()" class="w-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600 py-1.5 rounded hover:bg-blue-100 transition-colors border border-blue-100">Vote</button>
                      `;
                 } else {
                      // Locked
                      const deadline = getDeadline(dateStr);
                      const deadlineStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      title = `Voting closes <br> ${deadlineStr}`;
                      titleDisplay = title;
                      buttons = `
                        <button disabled class="w-full text-[10px] font-bold uppercase bg-gray-100 text-gray-400 py-1.5 rounded cursor-not-allowed">Locked</button>
                      `;
                 }
            }
        }
        
        return `
           <div class="p-3 rounded-lg shadow-sm ${opacity} ${containerClass} transition-all duration-300 flex flex-col justify-between h-full min-h-[110px]">
               <div class="flex items-start gap-3 mb-2">
                   <div class="text-center w-10 shrink-0">
                       <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">${month}</span>
                       <span class="block text-xl font-bold leading-none">${day}</span>
                   </div>
                   <div class="overflow-hidden">
                       <h3 class="font-bold text-xs text-gray-400 uppercase tracking-wide mb-0.5">Session ${idx + 1}</h3>
                       <p class="text-sm font-bold text-gray-800 leading-tight line-clamp-2" title="${title}">${titleDisplay}</p>
                   </div>
               </div>
               <div class="mt-auto pt-2">
                   ${buttons}
               </div>
           </div>
        `;
    }).join('');
}

// Voting Results Modal Functions
export async function viewSessionResults(dateStr) {
    try {
        const response = await fetch('/api/voting-history');
        const archives = await response.json();
        const SCHEDULE_DATES = getSchedule();
        
        // Find session by date
        const sessionId = `session_${dateStr}`;
        const session = archives.find(s => s.sessionId === sessionId);
        
        if (!session) {
            alert('No voting results found for this session.');
            return;
        }
        
        // Show modal
        const modal = document.getElementById('resultsModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        
        // Populate title with voting closure date
        const sessionIndex = SCHEDULE_DATES.indexOf(dateStr);
        
        // Voting closes on the previous session date (or D-12 for first session)
        let closureDate;
        if (sessionIndex > 0) {
            // Use previous session date as closure date
            closureDate = getDeadline(SCHEDULE_DATES[sessionIndex - 1]);
        } else {
            // First session: voting closed 12 days before
            const baseDate = getDeadline(dateStr);
            baseDate.setDate(baseDate.getDate() - 12);
            closureDate = baseDate;
        }
        
        const formattedDate = closureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        document.getElementById('resultsTitle').textContent = `Voting Closed: ${formattedDate}`;
        
        // Populate winner
        const { winningReading } = session;
        if (winningReading) {
            document.getElementById('winnerTitle').textContent = winningReading.title;
            document.getElementById('winnerAuthor').textContent = winningReading.author;
            document.getElementById('winnerVotes').textContent = `${winningReading.voteCount} vote${winningReading.voteCount !== 1 ? 's' : ''}`;
        }
        
        // Sort and display all proposals
        const sorted = session.allProposals.sort((a, b) => b.voteCount - a.voteCount);
        document.getElementById('allResultsList').innerHTML = sorted.map((proposal, idx) => `
            <div class="flex justify-between items-center p-3 rounded ${idx === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}">
                <div class="flex-1">
                    <div class="font-semibold">${proposal.title}</div>
                    <div class="text-sm text-gray-600">${proposal.author}</div>
                </div>
                <div class="text-right ml-4">
                    <div class="font-bold text-lg ${idx === 0 ? 'text-blue-600' : 'text-gray-700'}">${proposal.voteCount}</div>
                    <div class="text-xs text-gray-500">vote${proposal.voteCount !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `).join('');
        
        // Populate stats
        document.getElementById('totalVoters').textContent = session.totalVoters;
        document.getElementById('totalProposals').textContent = session.totalProposals;
        
    } catch (error) {
        console.error('Error loading results:', error);
        alert('Failed to load voting results.');
    }
}
