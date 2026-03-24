import { useState } from "react";
import { register } from "@/api/auth";

interface Props {
  onBack?: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onBack, onSwitchToLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.length < 3) {
      setError("사용자명은 3자 이상이어야 합니다.");
      return;
    }
    if (password.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      await register(username, password, name);
      setRegistered(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      if (msg.includes("409")) {
        setError("이미 존재하는 사용자명입니다.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h2 className="mb-2 text-lg font-bold text-gray-800">가입 신청 완료</h2>
          <p className="mb-4 text-sm text-gray-600">
            관리자의 승인 후 로그인하실 수 있습니다.<br />
            승인까지 잠시 기다려 주세요.
          </p>
          {onSwitchToLogin && (
            <button
              onClick={onSwitchToLogin}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              로그인 페이지로
            </button>
          )}
          {onBack && !onSwitchToLogin && (
            <button
              onClick={onBack}
              className="rounded bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              돌아가기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md"
      >
        <h1 className="mb-6 text-center text-lg font-bold text-gray-800">
          회원가입
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

        <label htmlFor="reg-username" className="mb-1 block text-xs font-medium text-gray-600">
          사용자명
        </label>
        <input
          id="reg-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          placeholder="3자 이상"
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-gray-600">
          이름 (선택)
        </label>
        <input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-gray-600">
          비밀번호
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="4자 이상"
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label htmlFor="reg-password-confirm" className="mb-1 block text-xs font-medium text-gray-600">
          비밀번호 확인
        </label>
        <input
          id="reg-password-confirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          className="mb-5 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>

        {onSwitchToLogin && (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="mt-3 w-full text-center text-xs text-gray-500 hover:text-blue-600"
          >
            이미 계정이 있으신가요? 로그인
          </button>
        )}
      </form>
    </div>
  );
}
