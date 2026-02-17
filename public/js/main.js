/**
 * Main App - Index page initialization
 */

import { checkAuth } from './auth.js';
import { API } from './api.js';
import { renderTables, setAllMembers } from './voting.js';
import { setAllData, submitProposal } from './proposals.js';
import { toggleModal } from './ui.js';

let allData = [];

async function init() {
    await checkAuth();
    await loadData();
    
    // Listen for data reload events
    window.addEventListener('dataReload', loadData);
}

async function loadData() {
    try {
        const [readingsRes, membersRes] = await Promise.all([
            API.fetchReadings(),
            API.fetchMembers()
        ]);
        
        allData = readingsRes;
        const allMembers = membersRes || [];
        
        // Share data with other modules
        setAllData(allData);
        setAllMembers(allMembers);
        
        renderTables(allData);
    } catch (e) {
        console.error(e);
    }
}

// Setup form handler
document.getElementById('proposalForm')?.addEventListener('submit', submitProposal);

// Initialize app
init();

// Make toggleModal globally accessible for onclick handlers
window.toggleModal = toggleModal;
