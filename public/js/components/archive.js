/**
 * Archive Component
 * Renders the table of discussed/archived readings.
 */

export function renderArchive(archiveItems) {
    const archiveBody = document.getElementById('discussedTableBody');
    if (!archiveBody) return;

    if (archiveItems.length === 0) {
        archiveBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">No history yet.</td></tr>`;
    } else {
        archiveBody.innerHTML = archiveItems.map(item => {
            const titleHtml = item.link 
                ? `<a href="${item.link}" target="_blank" class="hover:underline flex items-center gap-2 group-hover:text-black">${item.title} <span class="text-[10px] text-gray-400">↗</span></a>` 
                : item.title;

            return `
            <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 group">
                <td class="py-3 px-1 mono text-xs text-gray-400">${new Date(item.proposedDate).toLocaleDateString()}</td>
                <td class="py-3 px-1 font-medium text-gray-800">${titleHtml}</td>
                <td class="py-3 px-1">${item.author}</td>
                <td class="py-3 px-1 text-xs uppercase text-gray-400 mono">${item.mediumType}</td>
                <td class="py-3 px-1 text-gray-400 text-sm">${item.proposedBy}</td>
            </tr>
        `}).join('');
    }
}
