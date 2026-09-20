import React from "react";
import { Eye, Copy, Check, RefreshCw, Sparkles, GraduationCap } from "lucide-react";

interface MobileTopHeaderProps {
  schoolName: string;
  userDisplayName?: string;
  userEmail?: string;
  isGoogleAuthenticated?: boolean;
  onCopyTeacherLink: () => void;
  teacherCopied: boolean;
  showTeacherLink?: boolean;
  onOpenShareModal: () => void;
  onRefreshData: () => Promise<void>;
  isRefreshing?: boolean;
  onTogglePreviewOrMenu?: () => void;
}

export default function MobileTopHeader({
  schoolName,
  userDisplayName,
  userEmail,
  isGoogleAuthenticated = false,
  onCopyTeacherLink,
  teacherCopied,
  showTeacherLink = false,
  onOpenShareModal,
  onRefreshData,
  isRefreshing = false,
  onTogglePreviewOrMenu
}: MobileTopHeaderProps) {
  const displayName = isGoogleAuthenticated 
    ? (userDisplayName || userEmail?.split("@")[0] || "ماجد الناصر")
    : "زائر (غير مسجل)";

  const portalTitle = schoolName || "SmartSchool | الغياب والتأخر";

  return (
    <header 
      id="mobile-top-header"
      className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 transition-all shadow-3xs"
      dir="rtl"
    >
      {/* 1. Right Side: Avatar Icon & User/School Info (Exact Match to Screenshot) */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
          <GraduationCap className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="text-xs font-black text-slate-900 truncate">
              {portalTitle}
            </h1>
          </div>
          <p className="text-[11px] text-blue-600 font-extrabold truncate">
            {displayName}
          </p>
        </div>
      </div>

      {/* 2. Left Side: Action Pills (Eye Icon + Teacher Link Copy Pill) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        
        {/* Eye / Refresh Button */}
        <button
          type="button"
          onClick={onRefreshData}
          id="btn-mobile-quick-refresh"
          disabled={isRefreshing}
          className="w-8 h-8 rounded-full border border-rose-200 bg-rose-50/80 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer active:scale-90"
          title="تحديث البيانات"
        >
          <Eye className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {/* Green Mint Copy Link Pill (Shown only when showTeacherLink is true, hidden on Stats) */}
        {showTeacherLink && (
          <button
            type="button"
            onClick={onCopyTeacherLink}
            id="btn-mobile-teacher-link-pill"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100 text-xs font-black transition cursor-pointer active:scale-95 shadow-3xs"
          >
            {teacherCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-emerald-700" />
                <span>رابط المعلمين</span>
              </>
            )}
          </button>
        )}

      </div>
    </header>
  );
}
