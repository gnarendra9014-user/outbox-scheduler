import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Email, PaginatedResponse, Stats, Sender } from '../types';

export function useScheduledEmails(page: number = 1) {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/emails/scheduled?page=${page}&pageSize=20`);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch scheduled emails');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return { data, isLoading, error, refetch: fetchEmails };
}

export function useSentEmails(page: number = 1) {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/emails/sent?page=${page}&pageSize=20`);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sent emails');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return { data, isLoading, error, refetch: fetchEmails };
}

export function useEmailStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/emails/stats');
      setStats(response.data);
    } catch {
      // Silently fail for stats
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}

export function useSenders() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSenders() {
      try {
        const response = await api.get('/emails/senders');
        setSenders(response.data.senders);
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchSenders();
  }, []);

  return { senders, isLoading };
}
