import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import ProfileEdit from "./ProfileEdit";

const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  admin: { label: "관리자", color: "bg-red-100 text-red-700" },
  editor: { label: "편집자", color: "bg-blue-100 text-blue-700" },
  viewer: { label: "뷰어", color: "bg-gray-100 text-gray-600" },
};

export default function UserMenu() {
  const { user, logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);

  if (!user) return null;

  const rd = ROLE_DISPLAY[user.role] ?? { label: user.role, color: "bg-gray-100 text-gray-600" };

  return (
    <div>
      {showProfile && <ProfileEdit onClose={() => setShowProfile(false)} />}
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium text-gray-700">
            {user.name ?? user.username}
          </div>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${rd.color}`}>
            {rd.label}
          </span>
        </div>
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="shrink-0 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="프로필 수정"
        >
          설정
        </button>
        <button
          onClick={logout}
          className="shrink-0 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
