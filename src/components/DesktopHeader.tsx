import React from "react";
import { 
  Calendar, 
  Clock, 
  Share2, 
  Monitor, 
  Edit2, 
  Loader2, 
  Cloud,
  CloudOff
} from "lucide-react";

interface DesktopHeaderProps {
  schoolName: string;
  onEditSchoolName: () => void;
  isSavingSchoolName?: boolean;
  onRefreshData: () => Promise<void>;
  isRefreshing?: boolean;
  onOpenShareModal: () => void;
  todayAbsentCount?: number;
  todayBehaviorCount?: number;
  currentTime?: string;
  currentUser?: any;
  onGoogleLogin?: () => void;
  isStatsOnly?: boolean;
  onSyncCloudData?: () => Promise<void>;
  isSyncingCloud?: boolean;
  syncCloudSuccess?: boolean;
  onDownloadBackup?: () => void;
  onUploadBackup?: (file: File) => void;
}

export default function DesktopHeader({
  schoolName,
  onEditSchoolName,
  isSavingSchoolName = false,
  onRefreshData,
  isRefreshing = false,
  onOpenShareModal,
  todayAbsentCount = 0,
  todayBehaviorCount = 0,
  currentTime,
  currentUser,
  onGoogleLogin,
  isStatsOnly = false
}: DesktopHeaderProps) {
  const getTodayArabicDate = () => {
    const d = new Date();
    const weekday = d.toLocaleDateString("ar-SA", { weekday: "long" });
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${weekday} ${year}/${month}/${day}`;
  };

  return (
    <header 
      id="desktop-top-header"
      className="hidden md:flex items-center justify-between bg-white border-b border-slate-200/90 px-6 py-3 sticky top-0 z-30 shadow-xs"
      dir="rtl"
    >
      {/* Right: School Identification */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center text-lg shadow-md shadow-blue-500/20 flex-shrink-0">
          🏫
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 tracking-tight">
              {schoolName || "SmartSchool - البوابة المدرسية الرقمية"}
            </h2>
            {!isStatsOnly && onEditSchoolName && (
              <button
                type="button"
                onClick={onEditSchoolName}
                className="text-slate-400 hover:text-blue-600 transition p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="تعديل اسم المدرسة"
              >
                {isSavingSchoolName ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (
                  <Edit2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>{getTodayArabicDate()}</span>
            </span>
            {currentTime && (
              <>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  <span>{currentTime}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center/Left: Smart Badges & Quick Stats */}
      <div className="flex items-center gap-3">
        
        {/* Device Mode Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600">
          <Monitor className="w-3.5 h-3.5 text-indigo-600" />
          <span>نسخة سطح المكتب</span>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-black">
          <span className="text-slate-500 text-[11px]">غياب اليوم:</span>
          <span className={`px-2 py-0.5 rounded-lg text-xs ${todayAbsentCount > 0 ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"}`}>
            {todayAbsentCount} طالب
          </span>
        </div>

        {/* Share Modal Trigger (Hidden in stats-only mode) */}
        {!isStatsOnly && (
          <button
            type="button"
            onClick={onOpenShareModal}
            id="btn-desktop-share-links"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-black transition cursor-pointer shadow-3xs"
            title="مشاركة الروابط للمعلمين والمشرفين"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600" />
            <span>مشاركة الروابط</span>
          </button>
        )}

        {/* Auth status (Hidden in stats-only mode) */}
        {!isStatsOnly && (
          !currentUser || currentUser?.isGuest ? (
            <button
              type="button"
              onClick={onGoogleLogin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl text-xs font-black transition cursor-pointer shadow-3xs"
            >
              <CloudOff className="w-3.5 h-3.5" />
              <span>تسجيل بـ Google</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold">
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span className="truncate max-w-[140px]">{currentUser.displayName || "مدير المدرسة"}</span>
            </div>
          )
        )}
      </div>
    </header>
  );
}
