import { useState, useEffect } from 'react';

// the search only runs once typing stops for a moment, so a long list isn't filtered on every key
export function useDebouncedValue(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
