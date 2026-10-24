import { useEffect, useState } from "react";

export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loader().then((next) => { if (mounted) { setData(next); setError(null); } }).catch((err) => { if (mounted) setError(err); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, deps);
  return { data, loading, error };
}
