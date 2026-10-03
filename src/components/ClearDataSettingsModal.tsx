import React, { useState, useEffect, useMemo } from "react";
import { Grade, Class, Student, AttendanceRecord, MorningDelayRecord } from "../types";
import { 
  clearAttendanceRecords, 
  clearMorningDelayRecords, 
  getAllAttendanceRecords, 
  getAllMorningDelayRecords,
  getTodayDateString 
} from "../dbService";
import { 
  Trash2, 
  X, 
  Calendar, 
  School, 
  DoorOpen, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  ClipboardCheck, 
  RefreshCw 
} from "lucide-react";

interface ClearDataSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  grades: Grade[];
  classes: Class[];
  students: Student[];
  onDataCleared?: () => void;
}

export default function ClearDataSettingsModal({
  isOpen,
  onClose,
  grades,
  classes,
  students,
  onDataCleared
}: ClearDataSettingsModalProps) {
  // Main Tab: "attendance" (الغياب) or "delay" (التأخر الصباحي)
  const [activeTab, setActiveTab] = useState<"attendance" | "delay">("attendance");

  // Clearing Mode: "all" | "date" | "grade" | "class"
  const [clearMode, setClearMode] = useState<"all" | "date" | "grade" | "class">("all");

  // Target selectors
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Cached records for live calculation
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [delayRecords, setDelayRecords] = useState<MorningDelayRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false);

  // Execution states
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmStep, setConfirmStep] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Initialize grade and class dropdowns
  useEffect(() => {
    if (grades.length > 0 && !selectedGradeId) {
      setSelectedGradeId(grades[0].id);
    }
  }, [grades, selectedGradeId]);

  useEffect(() => {
    if (selectedGradeId) {
      const filtered = classes.filter(c => c.gradeId === selectedGradeId);
      if (filtered.length > 0) {
        setSelectedClassId(filtered[0].id);
      } else {
        setSelectedClassId("");
      }
    }
  }, [selectedGradeId, classes]);

  // Load records on modal open
  const loadRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const [att, del] = await Promise.all([
        getAllAttendanceRecords(true),
        getAllMorningDelayRecords(true)
      ]);
      setAttendanceRecords(Array.isArray(att) ? att : []);
      setDelayRecords(Array.isArray(del) ? del : []);
    } catch (e) {
      console.error("Error loading records for clear modal:", e);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecords();
      setConfirmStep(false);
      setFeedback(null);
    }
  }, [isOpen]);

  // Reset confirmation step when changing tabs or modes
  useEffect(() => {
    setConfirmStep(false);
    setFeedback(null);
  }, [activeTab, clearMode, selectedDate, selectedGradeId, selectedClassId]);

  // Filter classes matching selected grade
  const availableClasses = useMemo(() => {
    if (!selectedGradeId) return classes;
    return classes.filter(c => c.gradeId === selectedGradeId);
  }, [classes, selectedGradeId]);

  // Calculate matching records dynamically
  const matchingAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(rec => {
      if (!rec) return false;
      if (clearMode === "all") return true;
      if (clearMode === "date") return rec.date === selectedDate;
      if (clearMode === "grade") {
        if (rec.gradeId === selectedGradeId) return true;
        if (selectedGradeId && Array.isArray(rec.absent)) {
          return rec.absent.some(stId => {
            const st = students.find(s => s && (s.id === stId || s.name === stId));
            return st && st.gradeId === selectedGradeId;
          });
        }
        return false;
      }
      if (clearMode === "class") {
        if (rec.classId === selectedClassId) return true;
        if (selectedClassId && Array.isArray(rec.absent)) {
          return rec.absent.some(stId => {
            const st = students.find(s => s && (s.id === stId || s.name === stId));
            return st && st.classId === selectedClassId;
          });
        }
        return false;
      }
      return false;
    });
  }, [attendanceRecords, clearMode, selectedDate, selectedGradeId, selectedClassId, students]);

  const matchingDelayRecords = useMemo(() => {
    return delayRecords.filter(d => {
      if (!d) return false;
      if (clearMode === "all") return true;
      if (clearMode === "date") return d.date === selectedDate;
      if (clearMode === "grade") {
        if (d.gradeId === selectedGradeId) return true;
        if (selectedGradeId) {
          const st = students.find(s => s && (s.id === d.studentId || s.name === d.studentId || s.name === d.studentName));
          if (st && st.gradeId === selectedGradeId) return true;
        }
        return false;
      }
      if (clearMode === "class") {
        if (d.classId === selectedClassId) return true;
        if (selectedClassId) {
          const st = students.find(s => s && (s.id === d.studentId || s.name === d.studentId || s.name === d.studentName));
          if (st && st.classId === selectedClassId) return true;
        }
        return false;
      }
      return false;
    });
  }, [delayRecords, clearMode, selectedDate, selectedGradeId, selectedClassId, students]);

  const matchingCount = activeTab === "attendance" 
    ? matchingAttendanceRecords.length 
    : matchingDelayRecords.length;

  const currentGradeName = grades.find(g => g.id === selectedGradeId)?.name || "الصف المحدد";
  const currentClassName = classes.find(c => c.id === selectedClassId)?.name || "الفصل المحدد";

  // Execute clear operation
  const handleExecuteClear = async () => {
    setIsDeleting(true);
    setFeedback(null);
    try {
      let deletedCount = 0;
      if (activeTab === "attendance") {
        deletedCount = await clearAttendanceRecords(
          {
            mode: clearMode,
            date: selectedDate,
            gradeId: selectedGradeId,
            classId: selectedClassId
          },
          students
        );
      } else {
        deletedCount = await clearMorningDelayRecords(
          {
            mode: clearMode,
            date: selectedDate,
            gradeId: selectedGradeId,
            classId: selectedClassId
          },
          students
        );
      }

      setFeedback({
        type: "success",
        message: `تم مسح ${deletedCount} سجل ${activeTab === "attendance" ? "غياب" : "تأخر صباحي"} بنجاح! 🗑️`
      });

      // Reload local modal records to reflect deletion immediately
      await loadRecords();
      setConfirmStep(false);

      if (onDataCleared) {
        onDataCleared();
      }
    } catch (err: any) {
      console.error("Error executing clear:", err);
      setFeedback({
        type: "error",
        message: err?.message || "حدث خطأ أثناء تنفيذ عملية المسح، يرجى المحاولة مرة أخرى."
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn" 
      dir="rtl"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>قسم الإعدادات</span>
                <span className="text-slate-400 font-normal">|</span>
                <span className="text-rose-400">مسح بيانات الغياب والتأخر</span>
              </h2>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                تصفير ومسح سجلات الرصد بدقة حسب الخيارات المرغوبة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Main 2 Tabs: الغياب vs التأخر الصباحي */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "attendance"
                  ? "bg-white text-rose-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <ClipboardCheck className={`w-4 h-4 ${activeTab === "attendance" ? "text-rose-600" : "text-slate-400"}`} />
              <span>مسح بيانات الغياب</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === "attendance" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-600"
              }`}>
                {attendanceRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("delay")}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "delay"
                  ? "bg-white text-amber-800 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Clock className={`w-4 h-4 ${activeTab === "delay" ? "text-amber-600" : "text-slate-400"}`} />
              <span>مسح التأخر الصباحي</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === "delay" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-600"
              }`}>
                {delayRecords.length}
              </span>
            </button>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div className={`p-3 rounded-xl text-xs font-black border flex items-center gap-2 animate-fadeIn ${
              feedback.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}>
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Select Clearing Method (طريقة المسح) */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-800">
              اختر نطاق وطريقة المسح:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Option 1: Complete / All */}
              <button
                type="button"
                onClick={() => setClearMode("all")}
                className={`p-3 rounded-xl border text-right flex flex-col justify-between transition-all cursor-pointer ${
                  clearMode === "all"
                    ? "bg-rose-50/80 border-rose-400 shadow-xs ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">🗑️</span>
                  <input 
                    type="radio" 
                    name="clearMode" 
                    checked={clearMode === "all"} 
                    onChange={() => setClearMode("all")}
                    className="accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">مسح كامل</span>
                  <span className="text-[10px] text-slate-500 font-medium block">تصفير كافة السجلات</span>
                </div>
              </button>

              {/* Option 2: By Date */}
              <button
                type="button"
                onClick={() => setClearMode("date")}
                className={`p-3 rounded-xl border text-right flex flex-col justify-between transition-all cursor-pointer ${
                  clearMode === "date"
                    ? "bg-rose-50/80 border-rose-400 shadow-xs ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">🗓️</span>
                  <input 
                    type="radio" 
                    name="clearMode" 
                    checked={clearMode === "date"} 
                    onChange={() => setClearMode("date")}
                    className="accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">تاريخ محدد</span>
                  <span className="text-[10px] text-slate-500 font-medium block">مسح يوم معين</span>
                </div>
              </button>

              {/* Option 3: By Grade */}
              <button
                type="button"
                onClick={() => setClearMode("grade")}
                className={`p-3 rounded-xl border text-right flex flex-col justify-between transition-all cursor-pointer ${
                  clearMode === "grade"
                    ? "bg-rose-50/80 border-rose-400 shadow-xs ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">🏫</span>
                  <input 
                    type="radio" 
                    name="clearMode" 
                    checked={clearMode === "grade"} 
                    onChange={() => setClearMode("grade")}
                    className="accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">صف محدد</span>
                  <span className="text-[10px] text-slate-500 font-medium block">مسح صف بالكامل</span>
                </div>
              </button>

              {/* Option 4: By Class */}
              <button
                type="button"
                onClick={() => setClearMode("class")}
                className={`p-3 rounded-xl border text-right flex flex-col justify-between transition-all cursor-pointer ${
                  clearMode === "class"
                    ? "bg-rose-50/80 border-rose-400 shadow-xs ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">🚪</span>
                  <input 
                    type="radio" 
                    name="clearMode" 
                    checked={clearMode === "class"} 
                    onChange={() => setClearMode("class")}
                    className="accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">فصل محدد</span>
                  <span className="text-[10px] text-slate-500 font-medium block">مسح فصل واحد</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Target Controls */}
          {clearMode === "date" && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2 animate-fadeIn">
              <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>حدد تاريخ اليوم المراد مسحه:</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-3xs"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className={`text-[11px] font-black px-3 py-2 rounded-xl border transition cursor-pointer ${
                    selectedDate === getTodayDateString()
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  اليوم الحالي
                </button>
              </div>
            </div>
          )}

          {clearMode === "grade" && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2 animate-fadeIn">
              <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <School className="w-4 h-4 text-indigo-600" />
                <span>اختر الصف الدراسي المراد مسح سجلاته:</span>
              </label>
              <select
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-3xs"
              >
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {clearMode === "class" && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-2xs font-extrabold text-slate-500">1. الصف الدراسي:</label>
                  <select
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-3xs"
                  >
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-2xs font-extrabold text-slate-500">2. الفصل الدراسي:</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-3xs"
                  >
                    {availableClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    {availableClasses.length === 0 && (
                      <option value="">لا توجد فصول لهذا الصف</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Live Matching Records Counter & Summary Box */}
          <div className="p-3.5 rounded-2xl border bg-gradient-to-r from-slate-50 to-slate-100/60 border-slate-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-extrabold text-slate-500 block">
                السجلات المستهدفة بالمسح:
              </span>
              <p className="text-xs font-black text-slate-800">
                {clearMode === "all" ? (
                  <span>كافة سجلات {activeTab === "attendance" ? "الغياب" : "التأخر"} في النظام</span>
                ) : clearMode === "date" ? (
                  <span>سجلات يوم: <strong className="text-blue-700">{selectedDate}</strong></span>
                ) : clearMode === "grade" ? (
                  <span>سجلات صف: <strong className="text-indigo-700">{currentGradeName}</strong></span>
                ) : (
                  <span>سجلات فصل: <strong className="text-indigo-700">{currentClassName}</strong> ({currentGradeName})</span>
                )}
              </p>
            </div>

            <div className="text-center shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs border shadow-3xs ${
                matchingCount > 0 
                  ? "bg-rose-100 text-rose-800 border-rose-300" 
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {isLoadingRecords ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{matchingCount} سجل</span>
                )}
              </span>
            </div>
          </div>

          {/* Warning / Caution Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-right text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه هام ومسؤولية الحذف:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-700 font-medium pr-5">
              عملية المسح ستؤدي لحذف السجلات المحددة بشكل نهائي وفوري وتحديث الإحصائيات ونسب الغياب والتأخر لجميع شاشات وبوابات الموقع.
            </p>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition cursor-pointer"
          >
            إلغاء وإغلاق
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {!confirmStep ? (
              <button
                type="button"
                onClick={() => setConfirmStep(true)}
                disabled={isDeleting || matchingCount === 0 || isLoadingRecords}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition cursor-pointer ${
                  matchingCount === 0 || isLoadingRecords
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 active:scale-98"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>بدء مسح ({matchingCount}) سجل</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  disabled={isDeleting}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleExecuteClear}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-rose-700 hover:bg-rose-800 text-white shadow-md shadow-rose-700/30 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer animate-pulse"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري المسح والتصفير...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>نعم، أكّد مسح {matchingCount} سجل نهائياً</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
