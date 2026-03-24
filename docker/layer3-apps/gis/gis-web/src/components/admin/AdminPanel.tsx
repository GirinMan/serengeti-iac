import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import DataUpload from "./DataUpload";
import ImportHistory from "./ImportHistory";
import UserManagement from "./UserManagement";
import RegionManagement from "./RegionManagement";
import DataSourceManagement from "./DataSourceManagement";
import CustomLayerManagement from "./CustomLayerManagement";

export default function AdminPanel() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user || (user.role !== "admin" && user.role !== "editor")) {
    return null;
  }

  return (
    <div className="border-t">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-gray-600 uppercase hover:bg-gray-50"
      >
        <span>데이터 관리</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-3">
          <div>
            <h4 className="mb-2 text-xs font-medium text-gray-500">파일 업로드</h4>
            <DataUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium text-gray-500">수집 이력</h4>
            <ImportHistory refreshKey={refreshKey} />
          </div>

          <RegionManagement />

          <CustomLayerManagement />

          <DataSourceManagement />

          <UserManagement />
        </div>
      )}
    </div>
  );
}
