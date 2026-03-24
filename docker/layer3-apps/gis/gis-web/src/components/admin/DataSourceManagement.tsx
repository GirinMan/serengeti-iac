import { useEffect, useState } from "react";
import {
  fetchDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  triggerSync,
  type DataSource,
  type DataSourceCreatePayload,
} from "@/api/dataSources";
import { fetchRegions, type Region } from "@/api/regions";
import { useAuthStore } from "@/stores/authStore";

const SOURCE_TYPES = [
  { value: "API", label: "API" },
  { value: "FILE", label: "파일(URL)" },
];

const TARGET_TABLES = [
  { value: "parcels", label: "필지" },
  { value: "buildings", label: "건물" },
  { value: "facilities", label: "시설물" },
  { value: "address", label: "주소" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  success: { label: "성공", color: "text-green-700 bg-green-50" },
  failed: { label: "실패", color: "text-red-700 bg-red-50" },
  running: { label: "진행 중", color: "text-blue-700 bg-blue-50" },
};

export default function DataSourceManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("API");
  const [formUrl, setFormUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formSchedule, setFormSchedule] = useState("");
  const [formTarget, setFormTarget] = useState("address");
  const [formRegion, setFormRegion] = useState("");

  // Edit form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editTarget, setEditTarget] = useState("");

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "editor")) return null;
  const isAdmin = currentUser.role === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const [ds, rg] = await Promise.all([fetchDataSources(), fetchRegions()]);
      setSources(ds);
      setRegions(rg);
      if (rg.length > 0 && !formRegion) setFormRegion(rg[0].code);
    } catch {
      setError("데이터 소스 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, []);

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formName.trim() || !formUrl.trim()) {
      setError("이름과 URL은 필수입니다");
      return;
    }
    try {
      const payload: DataSourceCreatePayload = {
        name: formName.trim(),
        source_type: formType,
        url: formUrl.trim(),
        target_table: formTarget,
        region_code: formRegion,
      };
      if (formApiKey.trim()) payload.api_key = formApiKey.trim();
      if (formSchedule.trim()) payload.schedule_cron = formSchedule.trim();
      await createDataSource(payload);
      showMsg(`데이터 소스 "${formName.trim()}" 등록 완료`);
      setShowForm(false);
      setFormName("");
      setFormUrl("");
      setFormApiKey("");
      setFormSchedule("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    }
  };

  const handleToggleActive = async (ds: DataSource) => {
    try {
      await updateDataSource(ds.id, { is_active: !ds.is_active });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  const handleDelete = async (ds: DataSource) => {
    if (!confirm(`"${ds.name}" 데이터 소스를 삭제하시겠습니까?`)) return;
    try {
      await deleteDataSource(ds.id);
      showMsg(`"${ds.name}" 삭제 완료`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const handleSync = async (ds: DataSource) => {
    setSyncingId(ds.id);
    try {
      const res = await triggerSync(ds.id);
      showMsg(res.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "동기화 트리거 실패");
    } finally {
      setSyncingId(null);
    }
  };

  const startEdit = (ds: DataSource) => {
    setEditingId(ds.id);
    setEditName(ds.name);
    setEditUrl(ds.url);
    setEditApiKey(ds.api_key ?? "");
    setEditSchedule(ds.schedule_cron ?? "");
    setEditTarget(ds.target_table);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    setError("");
    if (!editName.trim() || !editUrl.trim()) {
      setError("이름과 URL은 필수입니다");
      return;
    }
    try {
      await updateDataSource(editingId, {
        name: editName.trim(),
        url: editUrl.trim(),
        api_key: editApiKey.trim() || undefined,
        schedule_cron: editSchedule.trim() || undefined,
        target_table: editTarget,
      });
      showMsg("데이터 소스 수정 완료");
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">공공데이터 소스</h4>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded bg-teal-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-teal-700"
          >
            {showForm ? "취소" : "+ 소스 추가"}
          </button>
        )}
      </div>

      {success && (
        <div className="mb-2 rounded bg-green-50 px-3 py-1.5 text-xs text-green-700">{success}</div>
      )}
      {error && (
        <div className="mb-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2 rounded border bg-gray-50 p-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">소스 이름</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: 국토교통부 도로명주소 API"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">유형</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">대상 테이블</label>
              <select
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {TARGET_TABLES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">URL</label>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://apis.data.go.kr/..."
              className="w-full rounded border px-2 py-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">API Key (선택)</label>
            <input
              value={formApiKey}
              onChange={(e) => setFormApiKey(e.target.value)}
              placeholder="공공데이터포털 인증키"
              className="w-full rounded border px-2 py-1 font-mono text-xs"
              type="password"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">지역</label>
              <select
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">스케줄 (cron)</label>
              <input
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                placeholder="0 3 * * 1 (선택)"
                className="w-full rounded border px-2 py-1 font-mono text-xs"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-teal-600 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            소스 등록
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-1.5">
          {sources.map((ds) => (
            <div key={ds.id} className={`rounded border px-2 py-1.5 text-xs ${editingId === ds.id ? "border-teal-300 bg-teal-50/30" : "bg-white"}`}>
              {editingId === ds.id ? (
                <form onSubmit={handleUpdate} className="space-y-1.5">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500">소스 이름</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded border px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500">URL</label>
                    <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="w-full rounded border px-2 py-1 font-mono text-[11px]" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-gray-500">API Key</label>
                      <input value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} type="password" className="w-full rounded border px-2 py-1 font-mono text-[11px]" placeholder="(변경하지 않으면 유지)" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-gray-500">대상 테이블</label>
                      <select value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="w-full rounded border px-2 py-1 text-xs">
                        {TARGET_TABLES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500">스케줄 (cron)</label>
                    <input value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} placeholder="0 3 * * 1 (선택)" className="w-full rounded border px-2 py-1 font-mono text-[11px]" />
                  </div>
                  <div className="flex gap-1">
                    <button type="submit" className="flex-1 rounded bg-teal-600 py-1 text-xs font-medium text-white hover:bg-teal-700">저장</button>
                    <button type="button" onClick={cancelEdit} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50">취소</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${ds.is_active ? "bg-green-400" : "bg-gray-300"}`}
                        title={ds.is_active ? "활성" : "비활성"}
                      />
                      <span className="font-medium text-gray-700">{ds.name}</span>
                      <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-500">
                        {ds.source_type}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(ds)}
                          className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-600 hover:bg-teal-100"
                          title="수정"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleSync(ds)}
                          disabled={syncingId === ds.id || ds.last_sync_status === "running"}
                          className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                          title="수동 동기화"
                        >
                          {syncingId === ds.id ? "..." : "동기화"}
                        </button>
                        <button
                          onClick={() => handleToggleActive(ds)}
                          className={`rounded px-1.5 py-0.5 ${
                            ds.is_active
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {ds.is_active ? "중지" : "활성"}
                        </button>
                        <button
                          onClick={() => handleDelete(ds)}
                          className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-gray-400">
                    <span className="truncate max-w-[160px]" title={ds.url}>{ds.url}</span>
                    <span>|</span>
                    <span>{TARGET_TABLES.find((t) => t.value === ds.target_table)?.label ?? ds.target_table}</span>
                    <span>|</span>
                    <span>{ds.region_code}</span>
                  </div>
                  {ds.last_synced_at && (
                    <div className="mt-1 flex items-center gap-2 text-gray-400">
                      <span>마지막 동기화: {formatDate(ds.last_synced_at)}</span>
                      {ds.last_sync_status && (
                        <span
                          className={`rounded px-1 py-0.5 text-xs ${
                            STATUS_LABELS[ds.last_sync_status]?.color ?? "text-gray-500 bg-gray-50"
                          }`}
                        >
                          {STATUS_LABELS[ds.last_sync_status]?.label ?? ds.last_sync_status}
                        </span>
                      )}
                      {ds.last_sync_count != null && (
                        <span>{ds.last_sync_count}건</span>
                      )}
                    </div>
                  )}
                  {ds.last_sync_message && ds.last_sync_status === "failed" && (
                    <div className="mt-0.5 truncate text-red-400" title={ds.last_sync_message}>
                      {ds.last_sync_message}
                    </div>
                  )}
                  {ds.schedule_cron && (
                    <div className="mt-0.5 text-gray-400">
                      스케줄: <span className="font-mono">{ds.schedule_cron}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {sources.length === 0 && (
            <div className="text-xs text-gray-400">등록된 데이터 소스가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
