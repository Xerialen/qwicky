// src/hooks/useTournamentData.js
import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { transformToDivision } from '../services/dataTransformer';

/**
 * Generic hook for fetching data with loading and error states
 */
const useFetch = (fetchFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

/**
 * Hook to fetch standings
 */
export const useStandings = () => useFetch(api.fetchStandings);

/**
 * Hook to fetch players
 */
export const usePlayers = () => useFetch(api.fetchPlayers);

/**
 * Hook to fetch group games
 */
export const useGroupGames = () => useFetch(api.fetchGroupGames);

/**
 * Hook to fetch playoff games
 */
export const usePlayoffGames = () => useFetch(api.fetchPlayoffGames);

/**
 * Hook to fetch teams
 */
export const useTeams = () => useFetch(api.fetchTeams);

/**
 * Hook to fetch schedule config
 */
export const useScheduleConfig = () => useFetch(api.fetchScheduleConfig);

/**
 * Hook to fetch all tournament data at once and transform to division format
 */
export const useAllTournamentData = (divisionName = 'Division 1') => {
  const [data, setData] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.fetchAllTournamentData();
      setRawData(result);
      
      // Transform to division format for wiki components
      const division = transformToDivision(result, divisionName);
      setData(division);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching tournament data');
    } finally {
      setLoading(false);
    }
  }, [divisionName]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, rawData, loading, error, refetch: fetchAll };
};

/**
 * Hook with auto-refresh capability
 */
export const useAutoRefresh = (fetchFunction, intervalMs = 0) => {
  const { data, loading, error, refetch } = useFetch(fetchFunction);

  useEffect(() => {
    if (intervalMs > 0) {
      const interval = setInterval(() => {
        refetch();
      }, intervalMs);

      return () => clearInterval(interval);
    }
  }, [intervalMs, refetch]);

  return { data, loading, error, refetch };
};
