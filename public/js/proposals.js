/**
 * Proposals - Proposal management functionality
 */

import { API } from './api.js';
import { getCurrentUser } from './auth.js';
import { toggleModal } from './ui.js';

let allData = [];

export function setAllData(data) {
    allData = data;
}

export function openProposalModal(itemId = null) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '/auth/google';
        return;
    }
    
    const modalTitle = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('submitBtnText');
    const form = document.getElementById('proposalForm');
    
    if (itemId) {
        // Edit mode
        const item = allData.find(i => i.id === itemId);
        if (item) {
            document.getElementById('p_title').value = item.title;
            document.getElementById('p_author').value = item.author;
            document.getElementById('p_type').value = item.mediumType;
            document.getElementById('p_link').value = item.link || '';
            modalTitle.innerText = "Edit Your Proposal";
            submitBtn.innerText = "UPDATE PROPOSAL";
        }
    } else {
        // New proposal mode
        const myActive = allData.find(i => 
            i.proposedBy === currentUser.email && i.discussionStatus === 'proposed'
        );
        
        modalTitle.innerText = myActive ? "Edit Your Proposal" : "Submit a Proposal";
        submitBtn.innerText = myActive ? "UPDATE PROPOSAL" : "SUBMIT";
        
        if (myActive) {
            document.getElementById('p_title').value = myActive.title;
            document.getElementById('p_author').value = myActive.author;
            document.getElementById('p_type').value = myActive.mediumType;
            document.getElementById('p_link').value = myActive.link || '';
        } else {
            form.reset();
        }
    }

    toggleModal(true);
}

export async function submitProposal(e) {
    e.preventDefault();
    const currentUser = getCurrentUser();
    
    // Check if user already has an active proposal in the local data (for instant feedback/confirmation logic)
    // Note: The backend enforces the logic, but we can make the UI nicer.
    
    const payload = {
        title: document.getElementById('p_title').value,
        author: document.getElementById('p_author').value,
        mediumType: document.getElementById('p_type').value || 'Book',
        link: document.getElementById('p_link').value,
        proposedBy: currentUser.name
    };
    
    const submitBtn = document.getElementById('submitBtnText');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Processing...";
    submitBtn.disabled = true;

    try {
        const { ok, data } = await API.submitProposal(payload);
        if (ok) {
            // Success
            // Check message to see if it was an update or new
            // backend returns: "Proposal updated successfully." or "Proposal added successfully."
            alert(data.message);
            toggleModal(false);
            form.reset();
            // Trigger reload by dispatching custom event
            window.dispatchEvent(new CustomEvent('dataReload'));
        } else {
            alert(data.error || "Submission failed.");
        }
    } catch (e) {
        console.error(e);
        alert("Proposal submission failed due to network error.");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

// Make functions globally accessible for onclick handlers
window.openProposalModal = openProposalModal;
