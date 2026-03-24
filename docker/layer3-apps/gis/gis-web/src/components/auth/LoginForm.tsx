import { useState } from "react";
import { login, fetchMe } from "@/api/auth";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  onBack?: () => void;
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onBack, onSwitchToRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await login(username, password);
      setToken(access_token);
      const user = await fetchMe();
      setUser(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      if (msg.includes("401")) {
        setError("사용자명 또는 비밀번호가 올바르지 않습니다. 회원가입 후 관리자 승인이 필요합니다.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md"
      >
        <h1 className="mb-6 text-center text-lg font-bold text-gray-800">
          GIS 지하시설물 관리
        </h1>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; 지도로 돌아가기
          </button>
        )}

        {error && (
          <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <label htmlFor="username" className="mb-1 block text-xs font-medium text-gray-600">
          사용자명
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-600">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-6 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {onSwitchToRegister && (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="mt-3 w-full text-center text-xs text-gray-500 hover:text-blue-600"
          >
            계정이 없으신가요? 회원가입
          </button>
        )}
      </form>
    </div>
  );
}
