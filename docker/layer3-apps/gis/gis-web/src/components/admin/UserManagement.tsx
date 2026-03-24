import { useEffect, useState } from "react";
import type { UserInfo } from "@/api/auth";
import { fetchUsers, createUser, updateUser, deleteUser, setUserRegions } from "@/api/users";
import { fetchRegions, type Region } from "@/api/regions";
import { useAuthStore } from "@/stores/authStore";

const ROLES = [
  { value: "admin", label: "관리자" },
  { value: "editor", label: "편집자" },
  { value: "viewer", label: "뷰어" },
];

const ROLE_LABEL: Record<string, string> = { admin: "관리자", editor: "편집자", viewer: "뷰어" };

export default function UserManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pwTarget, setPwTarget] = useState<UserInfo | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionTarget, setRegionTarget] = useState<UserInfo | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  if (currentUser?.role !== "admin") return null;

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([fetchUsers(), fetchRegions()]);
      setUsers(u);
      setRegions(r);
      setError("");
    } catch {
      setError("사용자 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, []);

  const pendingCount = users.filter((u) => !u.is_active).length;

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        (u.name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }).sort((a, b) => {
    // Pending users first
    if (!a.is_active && b.is_active) return -1;
    if (a.is_active && !b.is_active) return 1;
    return 0;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        name: newName || undefined,
        role: newRole,
      });
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      setNewRole("viewer");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    }
  };

  const handleToggleActive = async (user: UserInfo) => {
    if (user.id === currentUser?.id) return;
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch {
      setError("상태 변경 실패");
    }
  };

  const handleRoleChange = async (user: UserInfo, role: string) => {
    if (user.id === currentUser?.id) return;
    try {
      await updateUser(user.id, { role });
      load();
    } catch {
      setError("역할 변경 실패");
    }
  };

  const handleDelete = async (user: UserInfo) => {
    if (user.id === currentUser?.id) return;
    if (!confirm(`'${user.username}' 사용자를 삭제하시겠습니까?`)) return;
    try {
      await deleteUser(user.id);
      load();
    } catch {
      setError("삭제 실패");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget || !newPw) return;
    if (newPw !== newPwConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPw.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    try {
      await updateUser(pwTarget.id, { password: newPw });
      setPwTarget(null);
      setNewPw("");
      setNewPwConfirm("");
      setError("");
      setSuccess(`'${pwTarget.username}' 비밀번호가 변경되었습니다.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("비밀번호 변경 실패");
    }
  };

  const startRegionEdit = (u: UserInfo) => {
    setRegionTarget(u);
    setSelectedRegions(u.region_codes ?? []);
  };

  const handleRegionToggle = (code: string) => {
    setSelectedRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleRegionSave = async () => {
    if (!regionTarget) return;
    try {
      await setUserRegions(regionTarget.id, selectedRegions);
      setRegionTarget(null);
      setSuccess(`'${regionTarget.username}' 지역 할당 변경 완료`);
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch {
      setError("지역 할당 변경 실패");
    }
  };

  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <div className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          승인 대기 {pendingCount}명
        </div>
      )}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">사용자 관리</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
        >
          {showForm ? "취소" : "+ 추가"}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded bg-green-50 px-2 py-1 text-[11px] text-green-600">{success}</div>
      )}

      {/* 검색/필터 */}
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="이름/사용자명 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-0.5 text-[11px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px]"
        >
          <option value="all">전체</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-1.5 rounded border border-blue-100 bg-blue-50/30 p-2">
          <input
            type="text"
            placeholder="사용자명"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            type="text"
            placeholder="이름 (선택)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            생성
          </button>
        </form>
      )}

      {/* 비밀번호 변경 폼 */}
      {pwTarget && (
        <form
          onSubmit={handlePasswordChange}
          className="space-y-1.5 rounded border border-amber-200 bg-amber-50/30 p-2"
        >
          <div className="text-[11px] font-medium text-gray-600">
            '{pwTarget.username}' 비밀번호 변경
          </div>
          <input
            type="password"
            placeholder="새 비밀번호"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            autoFocus
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={newPwConfirm}
            onChange={(e) => setNewPwConfirm(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <div className="flex gap-1">
            <button
              type="submit"
              className="flex-1 rounded bg-amber-600 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              변경
            </button>
            <button
              type="button"
              onClick={() => { setPwTarget(null); setNewPw(""); setNewPwConfirm(""); }}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 지역 할당 폼 */}
      {regionTarget && (
        <div className="space-y-1.5 rounded border border-indigo-200 bg-indigo-50/30 p-2">
          <div className="text-[11px] font-medium text-gray-600">
            '{regionTarget.username}' 접근 가능 지역
          </div>
          {regions.length === 0 ? (
            <div className="text-[10px] text-gray-400">등록된 지역이 없습니다</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {regions.map((r) => (
                <label
                  key={r.code}
                  className={`flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                    selectedRegions.includes(r.code)
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(r.code)}
                    onChange={() => handleRegionToggle(r.code)}
                    className="h-3 w-3"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={handleRegionSave}
              className="flex-1 rounded bg-indigo-600 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              저장
            </button>
            <button
              onClick={() => setRegionTarget(null)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-1">
          {filtered.length === 0 && users.length > 0 && (
            <div className="text-[11px] text-gray-400">검색 결과가 없습니다.</div>
          )}
          {filtered.map((u) => (
            <div
              key={u.id}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
                u.is_active ? "bg-gray-50" : "bg-red-50/50 opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-700">
                  {u.name ?? u.username}
                  {u.id === currentUser?.id && (
                    <span className="ml-1 text-[10px] text-blue-500">(나)</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400">
                  {u.username} · {ROLE_LABEL[u.role] ?? u.role}
                  {u.region_codes?.length > 0 && (
                    <span className="ml-1 text-indigo-400">
                      [{u.region_codes.join(", ")}]
                    </span>
                  )}
                </div>
              </div>
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u, e.target.value)}
                disabled={u.id === currentUser?.id}
                className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {u.id !== currentUser?.id && (
                <>
                  <button
                    onClick={() => startRegionEdit(u)}
                    className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600 hover:bg-indigo-100"
                    title="접근 가능 지역 설정"
                  >
                    지역{u.region_codes?.length ? `(${u.region_codes.length})` : ""}
                  </button>
                  <button
                    onClick={() => { setPwTarget(u); setNewPw(""); setNewPwConfirm(""); setError(""); }}
                    className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600 hover:bg-amber-100"
                    title="비밀번호 변경"
                  >
                    PW
                  </button>
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      u.is_active
                        ? "bg-green-50 text-green-600 hover:bg-green-100"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"
                    }`}
                    title={u.is_active ? "비활성화" : "승인 (활성화)"}
                  >
                    {u.is_active ? "활성" : "승인"}
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
