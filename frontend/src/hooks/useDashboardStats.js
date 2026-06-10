import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

/**
 * OPTIMIZED Dashboard Stats Hook with Smart Caching
 * @performance: Implements aggressive caching and stale-time strategy
 * 
 * Cache Strategy:
 * - staleTime: 2 minutes (data is fresh for 2 min without refetch)
 * - cacheTime: 5 minutes (cached data kept for 5 min)
 * - refetchInterval: 30s (periodic background refresh)
 * - refetchIntervalInBackground: true (refresh even when not focused)
 */
export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['adminDashboardStats'],
        queryFn: async () => {
            const { data } = await api.get('/dashboard/stats');
            return data.data;
        },
        staleTime: 120000, // 2 minutes - data stays fresh without refetch
        cacheTime: 300000, // 5 minutes - keep cached data
        refetchInterval: 30000, // Background refresh every 30 seconds
        refetchIntervalInBackground: true, // Keep refetching even when tab not focused
        refetchOnWindowFocus: false, // Don't refetch on window focus (reduce unnecessary calls)
        retry: 2, // Retry twice on network failure
        retryDelay: 1000, // Wait 1 second before retry
    });
};
