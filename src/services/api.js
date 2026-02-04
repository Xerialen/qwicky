// src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not defined. Please set it in your .env file.');
}

/**
 * Creates an axios instance with base configuration
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Generic error handler for API requests
 */
const handleApiError = (error, endpoint) => {
  console.error(`API Error (${endpoint}):`, error);
  
  if (error.response) {
    throw new Error(`Server error: ${error.response.status} - ${error.response.statusText}`);
  } else if (error.request) {
    throw new Error('No response from server. Please check your connection.');
  } else {
    throw new Error(`Request failed: ${error.message}`);
  }
};

/**
 * Fetch standings data
 */
export const fetchStandings = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'standings' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'standings');
  }
};

/**
 * Fetch players data
 */
export const fetchPlayers = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'players' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'players');
  }
};

/**
 * Fetch group stage games
 */
export const fetchGroupGames = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'groupGames' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'groupGames');
  }
};

/**
 * Fetch playoff games
 */
export const fetchPlayoffGames = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'playoffGames' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'playoffGames');
  }
};

/**
 * Fetch teams data
 */
export const fetchTeams = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'teams' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'teams');
  }
};

/**
 * Fetch schedule configuration
 */
export const fetchScheduleConfig = async () => {
  try {
    const response = await apiClient.get('', {
      params: { endpoint: 'scheduleConfig' }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'scheduleConfig');
  }
};

/**
 * Fetch all tournament data at once
 */
export const fetchAllTournamentData = async () => {
  try {
    const [
      standings,
      players,
      groupGames,
      playoffGames,
      teams,
      scheduleConfig
    ] = await Promise.all([
      fetchStandings(),
      fetchPlayers(),
      fetchGroupGames(),
      fetchPlayoffGames(),
      fetchTeams(),
      fetchScheduleConfig()
    ]);

    return {
      standings,
      players,
      groupGames,
      playoffGames,
      teams,
      scheduleConfig
    };
  } catch (error) {
    console.error('Error fetching all tournament data:', error);
    throw error;
  }
};

export default {
  fetchStandings,
  fetchPlayers,
  fetchGroupGames,
  fetchPlayoffGames,
  fetchTeams,
  fetchScheduleConfig,
  fetchAllTournamentData
};
