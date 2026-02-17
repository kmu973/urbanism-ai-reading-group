/**
 * API Client - Centralized API calls
 */

export const API = {
    async fetchUser() {
        const res = await fetch('/api/user');
        return await res.json();
    },

    async fetchReadings() {
        const res = await fetch('/api/readings');
        return await res.json();
    },

    async fetchMembers() {
        const res = await fetch('/api/members');
        return await res.json();
    },

    async submitVote(itemId) {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ itemId })
        });
        return await res.json();
    },

    async submitProposal(proposal) {
        const res = await fetch('/api/proposals', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(proposal)
        });
        return { ok: res.ok, data: await res.json() };
    },

    async deleteProposal(id) {
        const res = await fetch(`/api/proposals/${id}`, { 
            method: 'DELETE' 
        });
        return { ok: res.ok };
    },

    async submitAttendance(itemId) {
        const res = await fetch('/api/attend', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ itemId })
        });
        return await res.json();
    }
};
