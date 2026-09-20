import React, { useState, useEffect, useMemo } from "react";
import { Grade, Class, Teacher, Student, MorningDelayRecord } from "../types";
import { 
  getStudentsByClass,
  getMorningDelayRecords,
  saveMorningDelayRecord,
  deleteMorningDelayRecord,
  subscribeToMorningDelayRecords
} from "../dbService";
import { 
  Clock, 
  Calendar, 
  UserCheck, 
  Search, 
  Plus, 
  Trash2, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  User, 
  Building2, 
  Layers, 
  Loader2, 
  SunMedium, 
  ArrowRight,
  HelpCircle,
  List,
  LayoutGrid
} from "lucide-react";

interface MorningDelayPortalProps {
  grades: Grade[];
  classes: Class[];
  students: Student[];
  teachers?: Teacher[];
  onRefreshData?: () => Promise<void>;
  navigateTo?: (mode: "teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay") => void;
  schoolName?: string;
  isDirectLink?: boolean;
  globalProgress?: { active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string };
  setGlobalProgress?: React.Dispatch<React.SetStateAction<{ active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string }>>;
  isGoogleAuthenticated?: boolean;
  onRequireGoogleLogin?: () => void;
}

const TIME_PRESETS = ["07:05", "07:15", "07:25", "07:30", "07:45", "08:00", "08:15"];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeString = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function MorningDelayPortal({
  grades,
  classes,
  students,
  teachers = [],
  navigateTo,
  schoolName = "",
  isDirectLink = false,
  setGlobalProgress,
  isGoogleAuthenticated,
  onRequireGoogleLogin
}: MorningDelayPortalProps) {
  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const isToday = selectedDate === getTodayDateString();

  // Supervisor & Input States
  const [recorderName, setRecorderName] = useState<string>(() => {
    return localStorage.getItem("morning_delay_recorder_name") || "";
  });
  const [arrivalTime, setArrivalTime] = useState<string>(getCurrentTimeString());
  const [selectedReason, setSelectedReason] = useState<string>("بدون عذر");
  const [customReason, setCustomReason] = useState<string>("");
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [notes, setNotes] = useState<string>("");

  // Mode Selection: "search" (Instant Student Lookup) vs "class" (List/Grid by Class) - Default to "class"
  const [entryMode, setEntryMode] = useState<"search" | "class">("class");
  const [classViewMode, setClassViewMode] = useState<"list" | "grid">("list");

  // Search Filter State
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Records state
  const [records, setRecords] = useState<MorningDelayRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Custom In-App Confirmation Modal for deleting delays (avoiding blocked window.confirm in iframes)
  const [confirmDeleteState, setConfirmDeleteState] = useState<{
    recordId: string;
    studentName: string;
    studentId?: string;
    date?: string;
  } | null>(null);

  // Save recorder name to localStorage
  useEffect(() => {
    if (recorderName) {
      localStorage.setItem("morning_delay_recorder_name", recorderName);
    }
  }, [recorderName]);

  // Real-time Firestore Subscription for Morning Delay Records
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToMorningDelayRecords(selectedDate, (newRecords) => {
      setRecords(newRecords);
      setLoading(false);
    }, (_err) => {
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [selectedDate]);

  // Sorted Grades
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => {
      const timeA = (a as any).createdAt || 0;
      const timeB = (b as any).createdAt || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.name.localeCompare(b.name, "ar");
    });
  }, [grades]);

  // Set default grade and class when grades load
  useEffect(() => {
    if (sortedGrades.length > 0 && !selectedGradeId) {
      setSelectedGradeId(sortedGrades[0].id);
    }
  }, [sortedGrades, selectedGradeId]);

  // Filtered and sorted classes based on selected grade
  const filteredClasses = useMemo(() => {
    if (!selectedGradeId) return [];
    const list = classes.filter(c => c.gradeId === selectedGradeId);
    return list.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || "999", 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || "999", 10);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, "ar");
    });
  }, [classes, selectedGradeId]);

  // Set default class when grade changes
  useEffect(() => {
    if (filteredClasses.length > 0 && (!selectedClassId || !filteredClasses.some(c => c.id === selectedClassId))) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  // Filtered students for class view
  const classStudents = useMemo(() => {
    if (!selectedGradeId || !selectedClassId) return [];
    return students
      .filter(s => s.gradeId === selectedGradeId && s.classId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [students, selectedGradeId, selectedClassId]);

  // Instant Search Students List
  const searchResults = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return [];
    
    return students
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map(s => {
        const gr = grades.find(g => g.id === s.gradeId);
        const cl = classes.find(c => c.id === s.classId);
        const isRecorded = records.some(r => r.studentId === s.id);
        return {
          ...s,
          gradeName: gr?.name || "غير محدد",
          className: cl?.name || "غير محدد",
          isRecorded
        };
      });
  }, [students, studentSearchQuery, grades, classes, records]);

  // Quick record handler for a student - Records exact real-time on click instantly!
  const handleRecordStudent = async (student: Student, overrideReason?: string) => {
    if (!isGoogleAuthenticated && !isDirectLink) {
      onRequireGoogleLogin?.();
      return;
    }
    const gr = grades.find(g => g.id === student.gradeId);
    const cl = classes.find(c => c.id === student.classId);
    const finalReason = overrideReason || (selectedReason === "أخرى" ? (customReason || "أخرى") : selectedReason);
    
    // Always capture exact real-time when clicking on the student!
    const exactRecordTime = getCurrentTimeString();
    setArrivalTime(exactRecordTime);

    const recordPayload = {
      studentId: student.id,
      studentName: student.name,
      gradeId: student.gradeId,
      gradeName: gr?.name || "",
      classId: student.classId,
      className: cl?.name || "",
      date: selectedDate,
      arrivalTime: exactRecordTime,
      delayMinutes: Number(delayMinutes) || 15,
      reason: finalReason,
      recordedBy: recorderName.trim() || "مشرف التأخر الصباحي",
      notes: notes.trim()
    };

    // Optimistic instant UI update (0ms delay)
    const tempId = "delay_" + student.id + "_" + Date.now();
    const optimisticRecord: MorningDelayRecord = {
      ...recordPayload,
      id: tempId,
      timestamp: Date.now()
    };

    setRecords(prev => {
      const filtered = prev.filter(r => r.studentId !== student.id);
      return [optimisticRecord, ...filtered];
    });

    setSaveToast(`تم تسجيل تأخر (${student.name}) - ${exactRecordTime}`);
    setTimeout(() => setSaveToast(null), 2500);
    setNotes("");

    // Background persistent save
    try {
      const realId = await saveMorningDelayRecord(recordPayload);
      if (realId && realId !== tempId) {
        setRecords(prev => prev.map(r => r.id === tempId ? { ...r, id: realId } : r));
      }
    } catch (err) {
      console.error("Error saving morning delay:", err);
    }
  };

  // Delete Record Handler - opens custom in-app confirmation modal
  const handleDeleteRecord = (recordId: string, studentName?: string, studentId?: string, date?: string) => {
    if (!isGoogleAuthenticated && !isDirectLink) {
      onRequireGoogleLogin?.();
      return;
    }
    setConfirmDeleteState({
      recordId,
      studentName: studentName || "الطالب",
      studentId,
      date: date || selectedDate
    });
  };

  // Execution of the confirmed deletion
  const executeConfirmDelete = async () => {
    if (!confirmDeleteState) return;
    const { recordId, studentName, studentId, date } = confirmDeleteState;
    setConfirmDeleteState(null);

    const targetDate = date || selectedDate;

    // Optimistic instant remove from UI (0ms delay)
    setRecords(prev => prev.filter(r => {
      if (r.id === recordId) return false;
      if (studentId && targetDate && r.studentId === studentId && r.date === targetDate) return false;
      return true;
    }));
    setSaveToast(`تم حذف وإلغاء تسجيل تأخر (${studentName}) بنجاح`);
    setTimeout(() => setSaveToast(null), 2500);

    try {
      await deleteMorningDelayRecord(recordId, { studentId, date: targetDate });
    } catch (err) {
      console.error("Error deleting morning delay:", err);
    }
  };

  // Formatted date in Arabic (e.g. الأحد، ٢٣ أغسطس)
  const formattedArabicDate = useMemo(() => {
    try {
      if (!selectedDate) return "";
      const [year, month, day] = selectedDate.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
      return dateObj.toLocaleDateString("ar-SA", options);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Change Date helper
  const handleDateShift = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12" dir="rtl">
      
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* 1. PORTAL HERO HEADER (Matching screenshot layout with morning delay amber/warm palette) */}
      <div className="text-center relative bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white rounded-xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 shadow-md overflow-hidden border border-amber-900/60">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-400/10 rounded-full -ml-10 -mb-10 pointer-events-none"></div>
        
        {/* Main School Name (Bold, Golden/Amber Yellow) */}
        <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-amber-300 mb-1 tracking-wide">
          {schoolName || "ام الحمام الثانوية"}
        </h1>

        {/* Subtitle with icon */}
        <div className="flex items-center justify-center gap-1.5 text-amber-100 font-bold text-[11px] sm:text-xs md:text-sm mb-2 sm:mb-3">
          <span>نظام تسجيل التأخر الصباحي</span>
          <span>⏰</span>
        </div>

        {/* Date Pill / Badge (Centered pill matching screenshot) */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-black/25 hover:bg-black/35 backdrop-blur-md text-white font-bold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs md:text-sm border border-white/15 shadow-inner transition-all">
          <button
            type="button"
            onClick={() => handleDateShift(1)}
            className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer text-amber-200"
            title="اليوم التالي"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 cursor-pointer relative px-1">
            <span className="text-sm">🗓️</span>
            <span className="font-extrabold text-amber-50">{formattedArabicDate || "اليوم"}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="تغيير التاريخ"
            />
          </div>

          <button
            type="button"
            onClick={() => handleDateShift(-1)}
            className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer text-amber-200"
            title="اليوم السابق"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayDateString())}
              className="mr-1 px-2 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-black rounded-full hover:bg-amber-300 transition cursor-pointer"
            >
              اليوم
            </button>
          )}
        </div>
      </div>

      {/* 2. INDEPENDENT STICKY GRADE & CLASS SELECTION PANEL (مستقل ومثبت في أعلى الصفحة عند التمرير) */}
      <div className="sticky top-14 md:top-16 z-30 bg-white/95 backdrop-blur-md p-2.5 sm:p-4 rounded-xl sm:rounded-2xl md:rounded-3xl border sm:border-2 border-indigo-500/80 shadow-md space-y-2 sm:space-y-3 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-black text-slate-800">الصف والفصل</label>
            <span className="text-[9px] sm:text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 sm:px-2 py-0.5 rounded-full">
              📌 مثبت أثناء التمرير
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold">
            عدد طلاب الفصل: <strong className="text-indigo-700 font-black">{classStudents.length}</strong> طالب
          </span>
        </div>

        {/* Grade Select Row */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 flex-wrap scrollbar-none">
          {sortedGrades.map((g, idx) => {
            const isSelected = selectedGradeId === g.id;
            const gradeShortName = g.name.replace(/^الصف\s+/, "").replace(/^صف\s+/, "");
            return (
              <button
                key={`${g.id}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedGradeId(g.id);
                  const gradeClasses = classes.filter(c => c.gradeId === g.id);
                  if (gradeClasses.length > 0 && !gradeClasses.some(c => c.id === selectedClassId)) {
                    setSelectedClassId(gradeClasses[0].id);
                  }
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-black border transition-all cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.02] active:scale-95 ${
                  isSelected
                    ? "bg-[#5046e5] text-white border-[#5046e5] shadow-sm shadow-indigo-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>🏫</span>
                <span>{gradeShortName}</span>
              </button>
            );
          })}
          {grades.length === 0 && (
            <p className="text-xs text-slate-400 font-bold py-1">لا توجد صفوف دراسية</p>
          )}
        </div>

        {/* Class Select Row (Separate Line, Pills) */}
        {selectedGradeId && (
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 flex-wrap scrollbar-none pt-1 border-t border-slate-100">
            {filteredClasses.map((c, idx) => {
              const isSelected = selectedClassId === c.id;
              const classNum = c.name.replace(/^الفصل\s*/, "").replace(/^فصل\s*/, "").trim();
              return (
                <button
                  key={`${c.id}-${idx}`}
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className={`flex items-center justify-center min-w-[34px] sm:min-w-[40px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-black border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
                    isSelected
                      ? "bg-[#5046e5] text-white border-[#5046e5] shadow-sm shadow-indigo-500/20"
                      : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50/70"
                  }`}
                >
                  <span>{classNum || c.name}</span>
                </button>
              );
            })}
            {filteredClasses.length === 0 && (
              <p className="text-xs text-slate-400 font-bold py-1">لا توجد فصول تابعة لهذا الصف</p>
            )}
          </div>
        )}
      </div>

      {/* 3. STUDENTS LIST CARD (منفصلة ومستقلة) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* CLASS-BASED REGISTRATION */}
        <div className="space-y-3 sm:space-y-4">
            {/* Students Display Area */}
            {classStudents.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold">
                لا يوجد طلاب مسجلين في هذا الفصل حالياً
              </div>
            ) : (
              <div className="space-y-0 rounded-xl sm:rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
                {/* List Sub-Header matching Teacher Attendance List */}
                <div className="bg-slate-50/80 border-b border-slate-200/90 px-3 py-2 sm:px-4 sm:py-3 flex flex-wrap gap-2 sm:gap-3 justify-between items-center text-right">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-xs font-black text-slate-800">قائمة طلاب الفصل ({classStudents.length})</span>
                      {classStudents.filter(st => records.some(r => r.studentId === st.id)).length > 0 && (
                        <span className="text-[9px] sm:text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-3xs">
                          {classStudents.filter(st => records.some(r => r.studentId === st.id)).length} متأخر اليوم
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">اضغط على اسم الطالب للرصد المباشر للتأخر الصباحي</span>
                  </div>

                  {/* View Mode Switcher (List vs Grid) */}
                  <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-3xs">
                    <button
                      type="button"
                      onClick={() => setClassViewMode("list")}
                      className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        classViewMode === "list"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="عرض كقائمة (مثل تسجيل الغياب)"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>قائمة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassViewMode("grid")}
                      className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        classViewMode === "grid"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="عرض كشبكة"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>شبكة</span>
                    </button>
                  </div>
                </div>

                {/* 1. LIST VIEW (Default - Exact match to Teacher Attendance Portal) */}
                {classViewMode === "list" ? (
                  <div className="divide-y divide-slate-100 max-w-full">
                    {classStudents.map((st, idx) => {
                      const isRecorded = records.some(r => r.studentId === st.id);
                      const isSaving = savingStudentId === st.id;
                      const rec = records.find(r => r.studentId === st.id);

                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            if (isSaving) return;
                            if (isRecorded) {
                              const currentRec = rec || records.find(r => r.studentId === st.id);
                              if (currentRec) {
                                handleDeleteRecord(currentRec.id, st.name, currentRec.studentId || st.id, currentRec.date || selectedDate);
                              }
                            } else {
                              handleRecordStudent(st);
                            }
                          }}
                          className={`p-2.5 sm:px-4 sm:py-3 w-full max-w-full cursor-pointer transition select-none active:scale-[0.99] active:bg-slate-100/80 ${
                            isRecorded ? "bg-amber-50/70 hover:bg-amber-100/60" : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          {/* Primary line: Student index, name, and action / desktop badges */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <span className={`text-[11px] sm:text-xs font-black w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full shrink-0 ${
                                isRecorded ? "bg-amber-500 text-white shadow-3xs" : "bg-slate-100 text-slate-700"
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                                {st.name}
                              </span>
                            </div>

                            {/* Status or Action indicator */}
                            <div className="shrink-0 transition-all duration-150 flex items-center">
                              {isSaving ? (
                                <span className="inline-flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-amber-700 bg-amber-100 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl animate-pulse">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>رصد...</span>
                                </span>
                              ) : isRecorded ? (
                                /* Desktop single-line badges (hidden on mobile) */
                                <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
                                  <span className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-2xs">
                                    <span>متأخر</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-200/90 text-amber-950 px-1.5 py-0.5 rounded-md border border-amber-300/80 shadow-3xs" title="وقت تسجيل التأخر">
                                      <Clock className="w-3 h-3 text-amber-800 shrink-0" />
                                      <span dir="ltr">{rec?.arrivalTime || arrivalTime || "07:30"}</span>
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentRec = rec || records.find(r => r.studentId === st.id);
                                      if (currentRec) {
                                        handleDeleteRecord(currentRec.id, st.name, currentRec.studentId || st.id, currentRec.date || selectedDate);
                                      }
                                    }}
                                    className="inline-flex items-center justify-center gap-1 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-xl transition cursor-pointer shadow-3xs hover:shadow-xs active:scale-95"
                                    title={`حذف تسجيل التأخر الصباحي لـ ${st.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span className="text-[11px] font-extrabold">حذف</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center gap-1 text-[11px] sm:text-xs font-black text-slate-500 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition">
                                  <span>+ تسجيل</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Mobile second line for recorded student (عرض بيانات التسجيل والوقت والحذف في سطر مخصص للجوال) */}
                          {isRecorded && !isSaving && (
                            <div className="flex sm:hidden items-center justify-between gap-2 mt-2 mr-8 pt-1.5 border-t border-amber-200/60">
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-amber-900 bg-amber-200/90 border border-amber-300 px-2 py-0.5 rounded-md shadow-3xs">
                                  متأخر
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded-md border border-amber-300/70 shadow-3xs" dir="ltr" title="وقت تسجيل التأخر">
                                  <Clock className="w-2.5 h-2.5 text-amber-800 shrink-0" />
                                  <span>{rec?.arrivalTime || arrivalTime || "07:30"}</span>
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentRec = rec || records.find(r => r.studentId === st.id);
                                  if (currentRec) {
                                    handleDeleteRecord(currentRec.id, st.name, currentRec.studentId || st.id, currentRec.date || selectedDate);
                                  }
                                }}
                                className="inline-flex items-center justify-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-md transition cursor-pointer shadow-3xs active:scale-95"
                                title={`حذف تسجيل التأخر الصباحي لـ ${st.name}`}
                              >
                                <Trash2 className="w-3 h-3 text-rose-500" />
                                <span>حذف</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 2. GRID VIEW */
                  <div className="p-2.5 sm:p-3 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {classStudents.map((st) => {
                      const isRecorded = records.some(r => r.studentId === st.id);
                      const isSaving = savingStudentId === st.id;
                      const rec = records.find(r => r.studentId === st.id);

                      return (
                        <div
                          key={st.id}
                          onClick={() => !isSaving && handleRecordStudent(st)}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 select-none relative min-h-[72px] ${
                            isRecorded
                              ? "bg-amber-50/90 border-amber-300 ring-1 ring-amber-400/40 shadow-3xs"
                              : "bg-slate-50/70 border-slate-200/90 hover:bg-white hover:border-amber-400 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                                isRecorded ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-700"
                              }`}>
                                {st.name.charAt(0)}
                              </div>
                              <p className="text-xs font-black text-slate-800 truncate">{st.name}</p>
                            </div>

                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                            ) : isRecorded ? (
                              <div className="hidden sm:flex items-center gap-1 shrink-0">
                                <span className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-3xs whitespace-nowrap">
                                  <Clock className="w-2.5 h-2.5" /> {rec?.arrivalTime || "07:30"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentRec = rec || records.find(r => r.studentId === st.id);
                                    if (currentRec) {
                                      handleDeleteRecord(currentRec.id, st.name, currentRec.studentId || st.id, currentRec.date || selectedDate);
                                    }
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer shrink-0"
                                  title="حذف تسجيل التأخر"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-200/50">
                            <span className="truncate">{isRecorded ? `السبب: ${rec?.reason || "تأخر"}` : "اضغط للرصد 👈"}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Mobile Only: Delay time placed below student name next to 'متأخر' */}
                              {isRecorded && (
                                <span className="sm:hidden bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-3xs whitespace-nowrap">
                                  <Clock className="w-2.5 h-2.5" /> {rec?.arrivalTime || "07:30"}
                                </span>
                              )}
                              <span className={`font-black ${isRecorded ? "text-amber-700" : "text-amber-600"}`}>
                                {isRecorded ? "متأخر" : "+ رصد"}
                              </span>
                              {isRecorded && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentRec = rec || records.find(r => r.studentId === st.id);
                                    if (currentRec) {
                                      handleDeleteRecord(currentRec.id, st.name, currentRec.studentId || st.id, currentRec.date || selectedDate);
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-0.5 text-[9.5px] font-bold shadow-3xs"
                                  title={`حذف تسجيل التأخر الصباحي لـ ${st.name}`}
                                >
                                  <Trash2 className="w-2.5 h-2.5 text-rose-500" />
                                  <span>حذف</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      {/* Custom Confirmation Modal for Deleting Delays */}
      {confirmDeleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in zoom-in-95 duration-150" dir="rtl">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-rose-200">
              <Trash2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-800">إلغاء وحذف تسجيل التأخر</h4>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                هل أنت متأكد من رغبتك في حذف تسجيل تأخر الطالب{" "}
                <span className="text-rose-700 font-black">"{confirmDeleteState.studentName}"</span>؟
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeConfirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black py-2.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تأكيد الحذف</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteState(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
