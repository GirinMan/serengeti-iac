import { lazy, Suspense, useEffect, useState } from "react";
import MapView from "@/components/map/MapView";
import MapControls from "@/components/map/MapControls";
import CoordinateDisplay from "@/components/map/CoordinateDisplay";
import MeasureTool from "@/components/map/MeasureTool";
import LayerManager from "@/components/map/LayerManager";
import HighlightMarker from "@/components/map/HighlightMarker";
import Legend from "@/components/map/Legend";
import RegionSelector from "@/components/sidebar/RegionSelector";
import LayerTree from "@/components/sidebar/LayerTree";
import FacilityDetail from "@/components/sidebar/FacilityDetail";
import SearchBar from "@/components/search/SearchBar";
import Spinner from "@/components/common/Spinner";
import { useAuthStore } from "@/stores/authStore";
import { fetchMe } from "@/api/auth";

const AdminPanel = lazy(() => import("@/components/admin/AdminPanel"));
const LoginForm = lazy(() => import("@/components/auth/LoginForm"));
const RegisterForm = lazy(() => import("@/components/auth/RegisterForm"));
const UserMenu = lazy(() => import("@/components/auth/UserMenu"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center p-4">
      <Spinner size="sm" />
    </div>
  );
}

export default function App() {
  const { token, user, setUser, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (!token) {
      setShowLogin(false);
      setShowRegister(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => logout());
  }, [token, setUser, logout]);

  if (showRegister && !user) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <RegisterForm
          onBack={() => setShowRegister(false)}
          onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }}
        />
      </Suspense>
    );
  }

  if (showLogin && !user) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <LoginForm
          onBack={() => setShowLogin(false)}
          onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }}
        />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-30 rounded bg-white p-2 shadow md:hidden"
        aria-label="메뉴 토글"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-20 flex w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white transition-transform md:relative md:w-72 md:translate-x-0`}
      >
        <div className="border-b p-3">
          <h1 className="text-sm font-bold text-gray-800">
            GIS 지하시설물 관리
          </h1>
        </div>

        <RegionSelector />

        {user && user.role !== "admin" && user.region_codes?.length === 0 && (
          <div className="mx-3 mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            아직 접근 가능한 지역이 할당되지 않았습니다. 관리자에게 지역 할당을 요청해 주세요.
          </div>
        )}

        <div className="border-t px-3 pt-3">
          <SearchBar onResultSelect={() => {
            if (window.innerWidth < 768) setSidebarOpen(false);
          }} />
        </div>

        <LayerTree />
        <FacilityDetail onDetailLoad={() => {
          if (window.innerWidth < 768) setSidebarOpen(true);
        }} />

        {user && user.role !== "viewer" && (
          <Suspense fallback={<LazyFallback />}>
            <AdminPanel />
          </Suspense>
        )}

        <div className="mt-auto">
          {user ? (
            <Suspense fallback={<LazyFallback />}>
              <UserMenu />
            </Suspense>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full border-t px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              로그인
            </button>
          )}
        </div>
      </aside>

      {/* Sidebar backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Map area */}
      <main className="relative flex-1">
        <MapView />
        <MapControls />
        <MeasureTool />
        <LayerManager />
        <HighlightMarker />
        <Legend />
        <CoordinateDisplay />
      </main>
    </div>
  );
}
