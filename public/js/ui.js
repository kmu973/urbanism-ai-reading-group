/**
 * UI Utilities - Shared UI functions
 */

export function toggleModal(show) {
    const modal = document.getElementById('proposalModal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
    }
}

export function scrollToVoting() {
    const section = document.getElementById('votingSection');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}
