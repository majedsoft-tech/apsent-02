import React from "react";
import { 
  X, 
  BarChart3, 
  ClipboardCheck, 
  Clock, 
  Users, 
  GraduationCap, 
  Briefcase, 
  LogOut, 
  Edit2, 
  Share2, 
  Check, 
  Copy, 
  Sparkles, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Cloud,
  CloudOff
} from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  appMode: "teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay";
  adminTab: "stats" | "grades" | "teachers" | "students";
  teacherTab: "attendance" | "behavior";
  onNavigate: (mode: "teacher" | "admin" | "morning-delay" | "super-admin", tab?: any) => void;
  schoolName: string;
  onSchoolNameChange: (newName: string) => Promise<void>;
  isSavingSchoolName?: boolean;
  currentUser: any;
  onGoogleLogin: () => void;
  onLogout: () => void;
  onCopyTeacherLink: () => void;
  teacherCopied: boolean;
  onCopyDelayLink: () => void;
  delayCopied: boolean;
  onCopyStatsLink: () => void;
  statsCopied: boolean;
  onCopyAdminSyncLink?: () => void;
  adminSyncCopied?: boolean;
  onSyncCloudData?: () => Promise<void>;
  isSyncingCloud?: boolean;
  syncCloudSuccess?: boolean;
  hasGradesAndClasses?: boolean;
  hasTeachers?: boolean;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  appMode,
  adminTab,
  teacherTab,
  onNavigate,
  schoolName,
  currentUser,
  onGoogleLogin,
  onLogout,
  onCopyTeacherLink,
  teacherCopied,
  onCopyDelayLink,
  delayCopied,
  onCopyStatsLink,
  statsCopied,
  onCopyAdminSyncLink,
  adminSyncCopied = false,
  onSyncCloudData,
  isSyncingCloud = false,
  syncCloudSuccess = false
}: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div 
        className="w-[85%] max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        {/* Drawer Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg">
              🏫
            </div>
            <div>
              <h3 className="text-sm font-black truncate max-w-[190px]">
                {schoolName || "SmartSchool الرقمية"}
              </h3>
              <p className="text-[11px] text-blue-100 font-bold">
                القائمة الشاملة للنظام
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Navigation Content */}
        <div className="p-4 space-y-5 flex-1">

          {/* Quick Share Links Section */}
          <div className="space-y-1.5">
            <button
                type="button"
                onClick={onCopyTeacherLink}
                className="w-full flex items-center justify-between p-2.5 bg-purple-50 hover:bg-purple-100/70 border border-purple-200 rounded-xl text-xs font-black text-purple-950 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-purple-600" />
                  <span>رابط المعلمين (الغياب)</span>
                </div>
                {teacherCopied ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
                    <Check className="w-3 h-3" /> تم النسخ
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
                )}
              </button>

              <button
                type="button"
                onClick={onCopyDelayLink}
                className="w-full flex items-center justify-between p-2.5 bg-amber-50 hover:bg-amber-100/70 border border-amber-200 rounded-xl text-xs font-black text-amber-950 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>رابط التأخر الصباحي</span>
                </div>
                {delayCopied ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
                    <Check className="w-3 h-3" /> تم النسخ
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
          </div>

          {/* Main Portals & Sections */}
          <div className="space-y-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
              أقسام النظام المدرسية
            </span>

            <div className="space-y-1">
              {/* Stats */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("admin", "stats");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "admin" && adminTab === "stats"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>لوحة الإحصائيات والرصد اليومي</span>
              </button>

              {/* Attendance */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("teacher", "attendance");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "teacher" && teacherTab === "attendance"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>بوابة المعلمين - غياب الحصص</span>
              </button>

              {/* Morning Delay */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("morning-delay");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "morning-delay"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>بوابة التأخر الصباحي للطابور</span>
              </button>

              {/* Grades & Classes */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("admin", "grades");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "admin" && adminTab === "grades"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>إدارة الصفوف والفصول الدراسية</span>
              </button>

              {/* Teachers */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("admin", "teachers");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "admin" && adminTab === "teachers"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>إدارة المعلمين وتوزيع الحصص</span>
              </button>

              {/* Students */}
              <button
                type="button"
                onClick={() => {
                  onNavigate("admin", "students");
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  appMode === "admin" && adminTab === "students"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>سجل الطلاب (إضافة / استيراد Excel)</span>
              </button>
            </div>
          </div>

        </div>

        {/* Drawer Footer: User & Logout */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-3">
          {!currentUser || currentUser?.isGuest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoogleLogin();
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <CloudOff className="w-4 h-4" />
              <span>تسجيل الدخول بـ Google للحفظ السحابي</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  {currentUser.displayName?.[0] || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {currentUser.displayName || "مدير المدرسة"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
