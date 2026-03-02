/**
 * Archive Component
 * Renders the table of discussed/archived readings.
 */

export function renderArchive(archiveItems, allMembers = []) {
    const archiveBody = document.getElementById('discussedTableBody');
    if (!archiveBody) return;

    if (archiveItems.length === 0) {
        archiveBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-400 italic">No history yet.</td></tr>`;
    } else {
        archiveBody.innerHTML = archiveItems.map(item => {
            const titleHtml = item.link 
                ? `<a href="${item.link}" target="_blank" class="hover:underline flex items-center gap-2 group-hover:text-black">${item.title} <span class="text-[10px] text-gray-400">↗</span></a>` 
                : item.title;

            // Generate attendees list
            const attendees = item.attendees || [];
            let attendeeListHtml = '<span class="text-gray-400 italic text-xs">None</span>';
            if (attendees.length > 0) {
                const attendeeNames = attendees.map(email => {
                    const mem = allMembers.find(m => m.email === email);
                    return mem ? mem.name : email.split('@')[0];
                });
                attendeeListHtml = `<div class="flex flex-wrap gap-1">${attendeeNames.map(n => `<span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-200">${n}</span>`).join('')}</div>`;
            }

            // Generate session date intelligently
            let sessionDateStr = 'Unknown';
            if (item.selectedForSession) {
                const d = new Date(item.selectedForSession + "T12:00:00");
                sessionDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } else if (item.proposedDate) {
                sessionDateStr = new Date(item.proposedDate).toLocaleDateString('en-US');
            }

            return `
            <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 group">
                <td class="py-3 px-1 mono text-xs text-gray-500 font-medium">${sessionDateStr}</td>
                <td class="py-3 px-1 font-medium text-gray-800">${titleHtml}</td>
                <td class="py-3 px-1 text-sm text-gray-700">${item.author}</td>
                <td class="py-3 px-1 max-w-[200px]">${attendeeListHtml}</td>
            </tr>
        `}).join('');
    }
}
