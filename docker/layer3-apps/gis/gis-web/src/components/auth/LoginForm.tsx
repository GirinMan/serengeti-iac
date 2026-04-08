import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, fetchMe, forgotPassword } from "@/api/auth";
import { useAuthStore } from "@/stores/authStore";

const SAVED_USERNAME_KEY = "gis_saved_username";

interface Props {
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSwitchToRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUsername, setRememberUsername] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ success: boolean; message: string } | null>(null);

  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  // Load saved username on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_USERNAME_KEY);
    if (saved) {
      setUsername(saved);
      setRememberUsername(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("아이디를 입력하세요."); return; }
    if (password.length < 4) { setError("비밀번호를 4자 이상 입력하세요."); return; }

    setError("");
    setLoading(true);
    try {
      // Save/clear username
      if (rememberUsername) {
        localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }

      const { access_token } = await login(username, password);
      setToken(access_token);
      const user = await fetchMe();
      setUser(user);
      navigate(user.role === "admin" ? "/admin" : "/");
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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setForgotResult({ success: false, message: "아이디를 입력하세요." });
      return;
    }
    setForgotLoading(true);
    setForgotResult(null);
    try {
      const res = await forgotPassword(forgotUsername.trim());
      setForgotResult({ success: true, message: res.message || "비밀번호 재설정 이메일이 발송되었습니다." });
    } catch (err) {
      setForgotResult({
        success: false,
        message: err instanceof Error ? err.message : "요청에 실패했습니다.",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen">
        {/* Left: GIS Hero */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#f3f4f5]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0066ff] text-white">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                precision_manufacturing
              </span>
            </div>
            <h1
              className="text-2xl font-extrabold tracking-tighter text-[#191c1d]"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              GIS 지하시설물 관리
            </h1>
          </div>

          <div className="space-y-6">
            <h2
              className="text-4xl font-bold leading-tight text-[#191c1d]"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              정밀한 데이터로 설계하는
              <br />
              <span className="text-[#0066ff]">도시 인프라의 미래</span>
            </h2>
            <p className="max-w-sm leading-relaxed text-[#424656]" style={{ fontFamily: "Pretendard, sans-serif" }}>
              지하시설물 통합 관리 시스템을 통해 상하수도 및 관로 데이터를 실시간으로 관리하고 분석하세요.
            </p>
          </div>

          <p
            className="text-sm font-medium uppercase tracking-widest text-slate-400"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            The Precision Cartographer
          </p>
        </div>

        {/* Right: Login Form */}
        <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="mb-10 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0066ff] text-white">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  precision_manufacturing
                </span>
              </div>
              <span className="text-lg font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>
                GIS 지하시설물 관리
              </span>
            </div>

            <div className="mb-8">
              <h3
                className="mb-2 text-2xl font-bold text-[#191c1d]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                시스템 로그인
              </h3>
              <p className="text-sm text-[#424656]">
                등록된 계정 정보를 입력하여 접속해주십시오.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#ba1a1a]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold text-[#424656]/80" style={{ fontFamily: "Inter, sans-serif" }}>
                  아이디
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    person
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    placeholder="아이디를 입력하세요"
                    className="w-full rounded-lg bg-white py-3.5 pl-12 pr-4 text-sm text-[#191c1d] outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-[#0066ff]/20"
                    style={{ border: "1.5px solid rgba(194,198,216,0.3)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#0066ff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(194,198,216,0.3)"; }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold text-[#424656]/80" style={{ fontFamily: "Inter, sans-serif" }}>
                  비밀번호
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="비밀번호를 입력하세요"
                    className="w-full rounded-lg bg-white py-3.5 pl-12 pr-4 text-sm text-[#191c1d] outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-[#0066ff]/20"
                    style={{ border: "1.5px solid rgba(194,198,216,0.3)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#0066ff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(194,198,216,0.3)"; }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberUsername}
                    onChange={(e) => setRememberUsername(e.target.checked)}
                    className="h-4 w-4 rounded text-[#0066ff] focus:ring-[#0066ff]/30"
                    style={{ border: "1.5px solid rgba(194,198,216,0.5)" }}
                  />
                  <span className="text-sm text-[#424656]">아이디 저장</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotResult(null); setForgotUsername(""); }}
                  className="text-sm font-medium text-[#0050cb] hover:underline"
                >
                  비밀번호 찾기
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "linear-gradient(to bottom, #0066ff, #0050cb)",
                  boxShadow: "0 4px 14px rgba(0,102,255,0.2)",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {loading ? "접속 중..." : "시스템 접속하기"}
              </button>
            </form>

            {onSwitchToRegister && (
              <div className="mt-10 pt-8 text-center" style={{ borderTop: "1px solid #edeeef" }}>
                <p className="text-sm text-[#424656]">
                  아직 계정이 없으신가요?{" "}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="ml-1 font-bold text-[#0050cb] hover:underline"
                  >
                    회원가입 요청
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3
                className="text-xl font-bold text-[#191c1d]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                비밀번호 찾기
              </h3>
              <button
                onClick={() => setForgotOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="mb-6 text-sm text-[#424656]">
              가입 시 등록한 아이디를 입력하면 비밀번호 재설정 토큰이 생성됩니다.
            </p>

            {forgotResult && (
              <div
                className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                  forgotResult.success
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[#ffdad6] text-[#ba1a1a]"
                }`}
              >
                {forgotResult.message}
              </div>
            )}

            <form onSubmit={handleForgotSubmit}>
              <label className="mb-1.5 block text-xs font-bold text-[#424656]/80">
                아이디
              </label>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                className="mb-6 w-full rounded-lg bg-white px-4 py-3 text-sm text-[#191c1d] outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-[#0066ff]/20"
                style={{ border: "1.5px solid rgba(194,198,216,0.3)" }}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 rounded-xl bg-[#edeeef] px-4 py-3 text-sm font-semibold text-[#424656]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "#0066ff" }}
                >
                  {forgotLoading ? "전송 중..." : "재설정 링크 발송"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
