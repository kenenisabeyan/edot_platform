/**
 * useIntelligence.js
 *
 * React hook for the Intelligence Core analytics report.
 * Provides risk level, engagement score, consistency score, and momentum.
 */

import { useState, useEffect } from 'react';
import { getMyAnalytics } from '../services/intelligenceApi.js';

/**
 * @returns {{ report: Object|null, isLoading: boolean, error: string|null, refetch: Function }}
 */
export function useIntelligence() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyAnalytics();
      if (result?.success) {
        setReport(result.data);
      } else {
        setError(result?.message || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to load intelligence report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return { report, isLoading, error, refetch: fetch };
}

export default useIntelligence;
