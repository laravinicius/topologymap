import { useEffect, useState } from 'react';

/** Somente apresentação. Permissões continuam definidas pela API. */
export function useCompact() {
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const change = () => setCompact(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return compact;
}
