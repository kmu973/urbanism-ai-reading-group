/**
 * Featured Component
 * Renders the main "Next Reading" card or TBD card.
 */

import { getSchedule } from '../utils/schedule.js';
import { submitAttendance, getCurrentUser } from '../voting.js'; // Control passed back to main for actions, or import auth/api directly? 
// Better to import auth/api logic or actions. 
// voting.js exports `submitAttendance` and `allMembers`.
// Let's rely on voting.js to export necessary data/actions or pass them in?
// For cleaner dependency, let's pass data in or import from `voting.js` if circular dependency isn't an issue.
// Circular dependency: voting.js imports featured.js, featured.js imports voting.js.
// FIX: Move `allMembers` and actions to a separate store or pass as args.
// For now, I will assume we pass `allMembers` as argument or export it from a non-circular place?
// `allMembers` is in voting.js.
// Let's pass `allMembers` and `submitAttendance` as arguments or attach to window for now (legacy way used in original) or import from a new `store.js`.
// To keep it simple: `renderFeaturedReading` will accept `allMembers` and `currentUser` as args.
// Actions like `submitAttendance` are globally available via `window` in the original code, 
// so the HTML strings generated here will still work if `voting.js` attaches them to window.
// Ideally, we move `submitAttendance` to `api.js` or `actions.js`, but let's stick to the window binding for onclicks in HTML strings.

export function renderFeaturedReading(selectedItem, currentUser, allMembers) {
    const SCHEDULE_DATES = getSchedule();
    const now = new Date();
    let nextDate = SCHEDULE_DATES.find(d => new Date(d) >= now);
    
    let dateStr = "";
    let dateLabel = "Next Session";
    
    if (nextDate) {
        const [y, m, d] = nextDate.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        dateStr = localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 14);
        dateStr = fallback.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateLabel = "Target Date";
    }
    
    const titleHtml = selectedItem.link 
        ? `<a href="${selectedItem.link}" target="_blank" class="hover:underline hover:text-gray-300 flex items-center gap-4 group transition-colors">${selectedItem.title} <span class="bg-white text-black text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">OPEN ↗</span></a>`
        : selectedItem.title;

    const attendees = selectedItem.attendees || [];
    const isAttending = currentUser && attendees.includes(currentUser.email);
    
    let attendBtn = '';
    if (!currentUser) {
        attendBtn = `<button onclick="window.location.href='/auth/google'" class="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold uppercase hover:bg-blue-700 transition-colors">Login to Attend</button>`;
    } else if (isAttending) {
        attendBtn = `<button onclick="submitAttendance('${selectedItem.id}')" class="bg-blue-600 text-white px-6 py-2 rounded text-xs font-bold uppercase hover:bg-blue-700 transition-colors shadow-lg">I'm Attending ✓</button>`;
    } else {
        attendBtn = `<button onclick="submitAttendance('${selectedItem.id}')" class="bg-white text-blue-600 px-6 py-2 rounded text-xs font-bold uppercase hover:bg-blue-50 transition-colors">Count Me In</button>`;
    }

    const attendeeNames = attendees.map(email => {
        const mem = allMembers.find(m => m.email === email);
        return mem ? mem.name : email.split('@')[0];
    });
    
    const attendeeListHtml = attendeeNames.length > 0 
        ? `<div class="mt-4 pt-4 border-t border-gray-800 w-full">
             <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Joining Session (${attendeeNames.length})</p>
             <div class="flex flex-wrap gap-2 text-xs text-gray-400">
                ${attendeeNames.map(n => `<span class="bg-gray-800 px-2 py-1 rounded">${n}</span>`).join('')}
             </div>
           </div>`
        : '';

    document.getElementById('featuredReading').innerHTML = `
        <section class="bg-black text-white p-8 rounded-lg shadow-xl relative overflow-hidden mb-12 border-l-8 border-red-600">
            <div class="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold mono select-none pointer-events-none">READ</div>
            <div class="relative z-10">
                <div class="flex justify-between items-start mb-4">
                    <p class="text-xs font-bold text-red-500 uppercase tracking-widest">
                        ${selectedItem.discussionStatus === 'selected' ? 'UPCOMING READING' : 'PREVIOUS READING'}
                    </p>
                    <div class="text-right">
                        <p class="text-xs text-gray-400 uppercase">${dateLabel}</p>
                        <p class="text-lg font-bold text-white">${dateStr} (Wed)</p>
                    </div>
                </div>
                <h2 class="text-3xl md:text-5xl font-bold mb-4 leading-tight">${titleHtml}</h2>
                <div class="flex flex-col md:flex-row gap-6 text-gray-400 border-t border-gray-800 pt-6 mt-6 mb-4">
                    <p class="mono text-sm">AUTHOR: <span class="text-white">${selectedItem.author}</span></p>
                </div>
                
                <div class="flex flex-col items-start gap-4 relative z-20">
                    ${attendBtn}
                    ${attendeeListHtml}
                </div>
            </div>
        </section>
    `;
}

export function renderTBDReading() {
    const nextWednesday = new Date();
    nextWednesday.setDate(nextWednesday.getDate() + (3 + 7 - nextWednesday.getDay()) % 7);
    const dateStr = nextWednesday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    document.getElementById('featuredReading').innerHTML = `
        <section class="bg-gray-900 text-white p-8 rounded-lg shadow-xl relative overflow-hidden mb-12 border-l-8 border-gray-600">
            <div class="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold mono">TBD</div>
            <div class="relative z-10">
                <div class="flex justify-between items-start mb-4">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        UPCOMING READING
                    </p>
                    <div class="text-right">
                        <p class="text-xs text-gray-400 uppercase">Next Session</p>
                        <p class="text-lg font-bold text-white">${dateStr} (Wed)</p>
                    </div>
                </div>
                <h2 class="text-3xl md:text-5xl font-bold mb-4 leading-tight text-gray-300 italic">Voting in Progress...</h2>
                <div class="flex flex-col md:flex-row gap-6 text-gray-500 border-t border-gray-800 pt-6 mt-6">
                    <p class="mono text-sm">TOPIC: <span class="text-gray-300">To Be Decided</span></p>
                    <p class="mono text-sm">STATUS: <span class="text-gray-300 uppercase">Open for Voting</span></p>
                </div>
            </div>
        </section>
    `;
}
