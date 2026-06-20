'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType>({
  searchQuery: '',
  setSearchQuery: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');

  // useMemo the value object so consumers don't re-render on unrelated
  // parent re-renders (setSearchQuery from useState is already stable).
  const value = useMemo<SearchContextType>(
    () => ({ searchQuery, setSearchQuery }),
    [searchQuery],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
