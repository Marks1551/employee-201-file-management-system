'use client';

import { useEffect, useMemo, useState } from 'react';

export interface UsePaginationResult<T> {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  pageItems: T[];
  startIndex: number;
  endIndex: number;
}

/**
 * Slices `items` into pages of `pageSize`, keeping `page` in range as the
 * underlying list shrinks/grows (e.g. from search or filters) and resetting
 * to page 1 whenever the filtered result set changes.
 */
export function usePagination<T>(items: T[], pageSize = 10): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to the first page whenever the filtered list changes size
  // (new search/filter), rather than being stuck on an empty later page.
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const startIndex = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, items.length);

  return { page, setPage, totalPages, pageItems, startIndex, endIndex };
}
