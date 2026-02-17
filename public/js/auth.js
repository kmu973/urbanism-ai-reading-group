/**
 * Authentication - State management and UI updates
 */

import { API } from './api.js';

let currentUser = null;

export async function checkAuth() {
    try {
        const data = await API.fetchUser();
        currentUser = data.loggedIn ? data.user : null;
        updateHeader();
        updateFab();
    } catch (e) {
        console.error("Auth Error", e);
    }
}

export function getCurrentUser() {
    return currentUser;
}

export function updateHeader() {
    const header = document.getElementById('header-auth');
    if (!header) return;

    if (currentUser) {
        header.innerHTML = `
            <div class="flex items-center gap-4 text-sm">
                <span>${currentUser.name}</span>
                <a href="/logout" class="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 font-bold uppercase">Logout</a>
            </div>
        `;
    } else {
        header.innerHTML = `
            <a href="/auth/google" class="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold uppercase hover:bg-blue-700 shadow-sm transition-colors">
                Login with Google
            </a>
        `;
    }
}

export function updateFab() {
    const fab = document.getElementById('fabBtn');
    if (!fab) return;

    if (currentUser) {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}
