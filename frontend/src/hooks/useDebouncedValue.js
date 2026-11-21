import { useEffect, useState } from 'react';

// Returns `value` once it has stopped changing for `delay` ms — keeps search boxes from
// firing a request on every keystroke.
export const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
