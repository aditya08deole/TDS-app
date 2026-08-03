/**
 * apiClient.ts — Centralized API fetch helper (Fix #5 frontend)
 *
 * All API requests to the backend now go through this helper which:
 * 1. Automatically attaches the Firebase ID Token as Bearer authorization
 * 2. Sets Content-Type and other standard headers
 * 3. Handles token refresh transparently (getIdToken(true) when needed)
 *
 * Usage:
 *   import { apiFetch } from '@/lib/apiClient'
 *   const res = await apiFetch('/api/devices')
 *   const data = await res.json()
 */

import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Performs a fetch to the backend API with automatic Firebase ID token injection.
 * Falls back gracefully if the user is not authenticated.
 */
export async function apiFetch(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    // Inject Firebase ID token if user is logged in
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            // Force refresh=false for speed; the token is auto-refreshed by Firebase SDK
            const token = await currentUser.getIdToken(false);
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (tokenErr) {
        console.warn('[apiClient] Failed to get ID token (proceeding without auth):', tokenErr);
    }

    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });
}

/**
 * Convenience: apiFetch + JSON parse in one call.
 * Throws if the response is not ok.
 */
export async function apiJson<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await apiFetch(endpoint, options);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    return res.json() as Promise<T>;
}
