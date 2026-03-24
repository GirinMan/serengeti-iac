import { useEffect, useState, useCallback, useRef } from "react";
import { fetchImportHistory, rollbackImport, type DataImport } from "@/api/imports";
import { useMapStore } from "@/stores/mapStore";
import { useAuthStore } from "@/stores/authStore";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  published: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  rolled_back: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "대기",
  published: "발행됨",
  processing: "처리 중",
  completed: "완료",
  failed: "실패",
  rolled_back: "롤백됨",
};

const ACTIVE_STATUSES = new Set(["queued", "published", "processing"]);
const POLL_INTERVAL = 5000;
const ROLLBACK_ALLOWED = new Set(["completed", "failed"]);

interface Props {
  refreshKey?: number;
}

export default function ImportHistory({ refreshKey }: Props) {
  const region = useMapStore((s) => s.region);
  const user = useAuthStore((s) => s.user);
  const [imports, setImports] = useState<DataImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchImportHistory(region?.code, 30);
      setImports(data);
    } catch (err) {
      console.error("Failed to fetch import history:", err);
    } finally {
      setLoading(false);
    }
  }, [region?.code]);

  const handleRollback = useCallback(async (di: DataImport) => {
    if (!confirm(`"${di.filename}" 임포트를 롤백하시겠습니까?\n이 작업으로 해당 임포트에서 추가된 데이터가 삭제됩니다.`)) return;
    setRollingBack(di.id);
    setMessage(null);
    try {
      const res = await rollbackImport(di.id);
      setMessage({ text: `롤백 완료: ${res.deleted_count}건 삭제됨 (${res.target_table})`, type: "success" });
      load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "롤백 실패", type: "error" });
    } finally {
      setRollingBack(null);
    }
  }, [load]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Auto-poll when there are active imports
  const hasActive = imports.some((di) => ACTIVE_STATUSES.has(di.status));

  useEffect(() => {
    if (hasActive) {
      intervalRef.current = setInterval(load, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasActive, load]);

  if (loading && imports.length === 0) {
    return <div className="py-4 text-center text-sm text-gray-400">로딩 중...</div>;
  }

  if (imports.length === 0) {
    return <div className="py-4 text-center text-sm text-gray-400">수집 이력이 없습니다.</div>;
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-2">
      {message && (
        <div className={`rounded px-3 py-1.5 text-xs ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {message.text}
        </div>
      )}
      {hasActive && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-600">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          진행 중인 작업이 있어 자동 갱신 중...
        </div>
      )}
      {imports.map((di) => (
        <div key={di.id} className="rounded border border-gray-200 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-medium text-gray-700">{di.filename}</span>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[di.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[di.status] ?? di.status}
              </span>
              {isAdmin && ROLLBACK_ALLOWED.has(di.status) && (
                <button
                  onClick={() => handleRollback(di)}
                  disabled={rollingBack === di.id}
                  className="rounded border border-orange-300 px-1.5 py-0.5 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                  title="이 임포트를 롤백합니다"
                >
                  {rollingBack === di.id ? "..." : "롤백"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-1 flex gap-3 text-xs text-gray-400">
            <span>{di.target_table}</span>
            {di.record_count != null && <span>{di.record_count}건</span>}
            <span>{new Date(di.created_at).toLocaleString("ko-KR")}</span>
          </div>
          {di.error_msg && (
            <div className="mt-1 text-xs text-red-500">{di.error_msg}</div>
          )}
        </div>
      ))}
    </div>
  );
}
