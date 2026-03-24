import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { updateProfile } from "@/api/auth";

interface Props {
  onClose: () => void;
}

export default function ProfileEdit({ onClose }: Props) {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (newPassword && newPassword.length < 4) {
      setError("새 비밀번호는 4자 이상이어야 합니다");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("현재 비밀번호를 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data: Parameters<typeof updateProfile>[0] = {};
      if (name !== (user.name ?? "")) data.name = name;
      if (newPassword) {
        data.current_password = currentPassword;
        data.new_password = newPassword;
      }

      if (Object.keys(data).length === 0) {
        setSuccess("변경 사항이 없습니다");
        setSaving(false);
        return;
      }

      const updated = await updateProfile(data);
      setUser(updated);
      setSuccess("프로필이 업데이트되었습니다");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장 실패";
      if (msg.includes("Current password is incorrect")) {
        setError("현재 비밀번호가 올바르지 않습니다");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-700">프로필 수정</h3>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          닫기
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-gray-500">사용자명</label>
          <input
            type="text"
            value={user.username}
            disabled
            className="w-full rounded border bg-gray-100 px-2 py-1 text-xs text-gray-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            placeholder="표시 이름"
          />
        </div>

        <div className="border-t pt-2">
          <p className="mb-1 text-[10px] font-medium text-gray-500">비밀번호 변경</p>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mb-1 w-full rounded border px-2 py-1 text-xs"
            placeholder="현재 비밀번호"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mb-1 w-full rounded border px-2 py-1 text-xs"
            placeholder="새 비밀번호 (4자 이상)"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            placeholder="새 비밀번호 확인"
          />
        </div>

        {error && <p className="text-[10px] text-red-500">{error}</p>}
        {success && <p className="text-[10px] text-green-600">{success}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
