import { useState, useCallback, useEffect, useRef } from "react";
import { searchAddress, searchAutocomplete, type SearchResult } from "@/api/search";
import { useMapStore } from "@/stores/mapStore";
import SearchResults from "./SearchResults";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface SearchBarProps {
  onResultSelect?: () => void;
}

export default function SearchBar({ onResultSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFullSearch, setIsFullSearch] = useState(false);
  const region = useMapStore((s) => s.region);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2 || isFullSearch) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    searchAutocomplete(q, region?.code)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setResults(data.results);
          setOpen(true);
          setIsFullSearch(false);
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) console.error("Autocomplete failed:", err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [debouncedQuery, region, isFullSearch]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    abortRef.current?.abort();
    setLoading(true);
    setIsFullSearch(true);
    try {
      const data = await searchAddress(q, region?.code);
      setResults(data.results);
      setOpen(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [query, region]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsFullSearch(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="주소 검색..."
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "검색"}
        </button>
      </div>
      {open && results.length > 0 && (
        <SearchResults results={results} onClose={handleClose} onResultSelect={onResultSelect} />
      )}
      {open && results.length === 0 && !loading && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded border border-gray-200 bg-white px-3 py-3 text-center text-sm text-gray-400 shadow-lg">
          검색 결과가 없습니다.
          <button onClick={handleClose} className="ml-2 text-xs text-gray-400 underline hover:text-gray-600">닫기</button>
        </div>
      )}
    </div>
  );
}
