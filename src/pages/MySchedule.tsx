// src/pages/MySchedule.tsx — student's weekly recurring classes
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { getMySchedule, getMyEnrollmentsWithPayment, studentMarkPaid, isLoggedIn } from "@/lib/api";
import type { MyScheduleClass, MyEnrollment } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, Clock, User as UserIcon, Users, Sparkles, ChevronRight, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/datetime";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MySchedule = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<MyScheduleClass[]>([]);
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);

  const load = () => {
    Promise.all([getMySchedule(), getMyEnrollmentsWithPayment().catch(() => [] as MyEnrollment[])])
      .then(([cs, es]) => { setClasses(cs); setEnrollments(es); })
      .catch(() => toast.error("Couldn't load schedule"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    load();
  }, [navigate]);

  const handleMarkPaid = async (e: MyEnrollment) => {
    setMarkingPaidId(e.enrollment_id);
    try {
      await studentMarkPaid(e.enrollment_id);
      toast.success("Marked as paid. Admin will verify shortly.");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const unpaid = enrollments.filter(e => e.payment_status !== "paid");

  // Compute next class
  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7;  // Convert JS Sun=0 → Mon=0
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const nextClass = (() => {
    if (classes.length === 0) return null;
    // Find next chronological class within the week
    const sorted = [...classes].sort((a, b) => {
      const aDist = ((a.day_of_week - currentDay + 7) % 7) * 24 * 60 + timeToMinutes(a.start_time);
      const bDist = ((b.day_of_week - currentDay + 7) % 7) * 24 * 60 + timeToMinutes(b.start_time);
      const nowMin = timeToMinutes(currentTime);
      const aAbs = a.day_of_week === currentDay && a.start_time <= currentTime ? aDist + 7 * 24 * 60 : aDist;
      const bAbs = b.day_of_week === currentDay && b.start_time <= currentTime ? bDist + 7 * 24 * 60 : bDist;
      return aAbs - bAbs;
    });
    return sorted[0];
  })();

  // Group by day for the week view
  const byDay: Record<number, MyScheduleClass[]> = {};
  for (let i = 0; i < 7; i++) byDay[i] = [];
  classes.forEach(c => byDay[c.day_of_week].push(c));
  Object.values(byDay).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Schedule</h1>
          <p className="text-sm text-gray-500">Your recurring weekly classes</p>
        </div>

        {/* Payments panel — shown if any enrollment isn't fully paid */}
        {unpaid.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-800">Payments</h2>
              <span className="text-xs text-gray-400">· Pay your tutor / admin in person, then mark as paid below</span>
            </div>
            <div className="divide-y divide-gray-50">
              {unpaid.map(e => {
                const isOverdue = e.payment_status === "overdue";
                return (
                  <div key={e.enrollment_id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {isOverdue ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{e.course_title}</p>
                        <p className="text-xs text-gray-500">{e.program_name}</p>
                        {e.payment_due_date && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Due {formatDate(e.payment_due_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">${e.price_per_month}</p>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                          isOverdue ? "text-red-600" : "text-amber-600"
                        }`}>
                          {e.payment_status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleMarkPaid(e)}
                        disabled={markingPaidId === e.enrollment_id}
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {markingPaidId === e.enrollment_id ? "Marking…" : "I've paid"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100 text-xs text-amber-800">
              💡 Payment is handled offline (cash or transfer to your admin). Click "I've paid" so the admin knows to verify it.
            </div>
          </div>
        )}

        {classes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No classes scheduled</h3>
            <p className="text-sm text-gray-400 mb-5">Enroll in a program to lock in your weekly time slots.</p>
            <button
              onClick={() => navigate("/courses")}
              className="bg-sat-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary"
            >
              Browse courses
            </button>
          </div>
        ) : (
          <>
            {/* Next class highlight */}
            {nextClass && (
              <div className="mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                <div className="flex items-center gap-2 mb-2 text-indigo-100">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Next class</span>
                </div>
                <h2 className="text-2xl font-bold mb-1">{nextClass.course_title}</h2>
                <p className="text-indigo-100 text-sm mb-4">
                  {DAY_NAMES[nextClass.day_of_week]} at {nextClass.start_time} · {nextClass.duration_minutes} min · with {nextClass.tutor_name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                    {nextClass.session_type === "individual" ? "🎯 1-on-1" : "👥 Group"}
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                    {nextClass.program_name}
                  </span>
                </div>
              </div>
            )}

            {/* Week view */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-x-auto">
              <div className="grid grid-cols-7 gap-3 min-w-[760px]">
                {SHORT_DAYS.map((day, di) => {
                  const isToday = di === currentDay;
                  return (
                    <div key={di} className="space-y-2">
                      <p className={`text-xs font-bold text-center pb-2 border-b ${
                        isToday ? "text-sat-primary border-sat-primary" : "text-gray-600 border-gray-100"
                      }`}>
                        {day}
                        {isToday && <span className="block text-[10px] font-normal mt-0.5">today</span>}
                      </p>
                      {byDay[di].length === 0 ? (
                        <p className="text-xs text-gray-300 text-center py-2">—</p>
                      ) : (
                        byDay[di].map(c => (
                          <div
                            key={c.scheduled_class_id}
                            className="bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-2 text-xs"
                          >
                            <p className="font-semibold text-sat-primary flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {c.start_time}
                            </p>
                            <p className="text-gray-700 truncate mt-1" title={c.course_title}>{c.course_title}</p>
                            <p className="text-[10px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                              {c.session_type === "individual" ? <UserIcon className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                              {c.duration_minutes}min
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* List view for detail */}
            <div className="mt-6 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">All classes ({classes.length})</h2>
              {[0, 1, 2, 3, 4, 5, 6].flatMap(di => byDay[di]).map(c => (
                <div key={c.scheduled_class_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-indigo-200 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      c.session_type === "individual" ? "bg-indigo-50 text-sat-primary" : "bg-purple-50 text-purple-600"
                    }`}>
                      {c.session_type === "individual" ? <UserIcon className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.course_title}</p>
                      <p className="text-xs text-gray-500">
                        {c.day_name} at {c.start_time} · {c.duration_minutes} min · {c.tutor_name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.program_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/courses/${c.scheduled_class_id ? "" : ""}`)}
                    className="text-gray-300 group-hover:text-gray-500"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default MySchedule;
