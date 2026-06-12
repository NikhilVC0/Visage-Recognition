import { useState, useMemo, useCallback } from 'react';

export default function DataTable({
  columns = [],
  data = [],
  onRowClick,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  emptyIcon = '📭',
  emptyTitle = 'No data found',
  emptySubtitle = 'Try adjusting your search or filters',
  actions,
  id = 'data-table',
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Search filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => (typeof c.accessor === 'string' ? c.accessor : c.key) === sortKey);
    if (!col) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
      const bVal = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');

      if (!isNaN(aStr) && !isNaN(bStr)) {
        return sortDir === 'asc' ? Number(aStr) - Number(bStr) : Number(bStr) - Number(aStr);
      }
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }, [sortKey]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const getColKey = (col) => typeof col.accessor === 'string' ? col.accessor : col.key;

  // Render skeleton loading
  if (loading) {
    return (
      <div className="data-table-wrapper" id={id}>
        <div className="data-table-toolbar">
          <div className="skeleton" style={{ width: 240, height: 36 }} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="skeleton-row" key={i}>
            {columns.map((_, j) => (
              <div className="skeleton-cell" key={j} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="data-table-wrapper" id={id}>
      {/* Toolbar */}
      <div className="data-table-toolbar">
        {searchable && (
          <div className="data-table-search">
            <span className="data-table-search-icon">🔍</span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={handleSearch}
              id={`${id}-search`}
            />
          </div>
        )}
        {actions && <div className="data-table-actions">{actions}</div>}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => {
                const key = getColKey(col);
                const isSorted = sortKey === key;
                return (
                  <th
                    key={key}
                    onClick={() => col.sortable !== false && handleSort(key)}
                    className={isSorted ? 'sorted' : ''}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                    {col.sortable !== false && (
                      <span className="sort-icon">
                        {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="data-table-empty">
                    <div className="data-table-empty-icon">{emptyIcon}</div>
                    <div className="data-table-empty-text">{emptyTitle}</div>
                    <div className="data-table-empty-sub">{emptySubtitle}</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map(col => {
                    const key = getColKey(col);
                    const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
                    return (
                      <td key={key}>
                        {col.render ? col.render(val, row) : val}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="data-table-pagination">
          <div className="data-table-pagination-info">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="data-table-pagination-controls">
            <button
              className="data-table-pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              id={`${id}-prev`}
            >
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`data-table-pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="data-table-pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              id={`${id}-next`}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
