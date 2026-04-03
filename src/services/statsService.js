// src/services/statsService.js
// Client for /api/stats (Turso-backed player stats).
// Uses a relative URL so Vite's proxy (/api → localhost:3001) works in dev
// and the Vercel function is hit directly in production.

import axios from 'axios';

const client = axios.create({ timeout: 15000 });

const handleError = (error, label) => {
  console.error(`[statsService] ${label}:`, error);
  if (error.response) {
    throw new Error(
      `Server error: ${error.response.status} — ${error.response.data?.message || error.response.statusText}`
    );
  } else if (error.request) {
    throw new Error('No response from server. Please check your connection.');
  } else {
    throw new Error(`Request failed: ${error.message}`);
  }
};

/**
 * Fetch leaderboard for a given mode / stat / period.
 * @param {{ mode?: string, stat?: string, period?: string, limit?: number }} opts
 * @returns {Promise<{ status: string, data: Array }>}
 */
export const fetchLeaderboard = async ({
  mode = '4on4',
  stat = 'damage_given',
  period = 'all',
  limit = 25,
} = {}) => {
  try {
    const response = await client.get('/api/stats', {
      params: { action: 'leaderboard', mode, stat, period, limit },
    });
    return response.data;
  } catch (error) {
    handleError(error, 'fetchLeaderboard');
  }
};

/**
 * Fetch head-to-head history between two teams.
 * @param {{ team1: string, team2: string, mode?: string }} opts
 * @returns {Promise<{ status: string, data: Array }>}
 */
export const fetchH2H = async ({ team1, team2, mode = '4on4' }) => {
  try {
    const response = await client.get('/api/stats', {
      params: { action: 'h2h', team1, team2, mode },
    });
    return response.data;
  } catch (error) {
    handleError(error, 'fetchH2H');
  }
};

/**
 * Fetch aggregate stats + recent games for a single player.
 * @param {{ name: string, mode?: string }} opts
 * @returns {Promise<{ status: string, data: Object }>}
 */
export const fetchPlayerProfile = async ({ name, mode = '4on4' }) => {
  try {
    const response = await client.get('/api/stats', {
      params: { action: 'player', name, mode },
    });
    return response.data;
  } catch (error) {
    handleError(error, 'fetchPlayerProfile');
  }
};

export default { fetchLeaderboard, fetchH2H, fetchPlayerProfile };
