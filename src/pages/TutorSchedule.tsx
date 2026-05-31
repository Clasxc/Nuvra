// src/pages/TutorSchedule.tsx — tutor's classes + availability management
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  getTutorSchedule, getMyAvailability, addAvailability, deleteAvailability,
  isLoggedIn, getCurrentUser,
} from "@/lib/api";
import type { ScheduledClassOut, AvailabilityBlock, User } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, Users, User as UserIcon, Clock, Plus, X, AlertCircle, Mail } from "lucide-react";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TutorSchedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"today" | "week" | "availability">("today");
  const [classes, setClasses] = useState<ScheduledClassOut[]>([]);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);

  // Availability form
  const [showAvailForm, setShowAvailForm] = useState(false);
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("14:00");
  const [newEnd, setNewEnd] = useState("18:00");

  const load = () => {
    Promise.all([getTutorSchedule(), getMyAvailability().catch(() => [])])
      .then(([cs, av]) => { setClasses(cs); setAvailability(av); })
      .catch(() => toast.error("Failed to load schedule"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    getCurrentUser().then(u => {
      if (u.role !== "tutor" && u.role !== "admin") { navigate("/dashboard"); return; }
      setUser(u);
      load();
    });
  }, [navigate]);

  // Refresh every 30s for "real-time" updates
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const currentDay = useMemo(() => (new Date().getDay() + 6) % 7, []);
  const todayClasses = classes.filter(c => c.day_of_week === currentDay).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const byDay: Record<number, ScheduledClassOut[]> = {};
  for (let i = 0; i < 7; i++) byDay[i] = [];
  classes.forEach(c => byDay[c.day_of_week].push(c));
  Object.values(byDay).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));

  const handleAddAvailability = async () => {
    if (newStart >= newEnd) { toast.error("End time must be after start"); return; }
    try {
      const block = await addAvailability(newDay, newStart, newEnd);
      setAvailability([...availability, block]);
      setShowAvailForm(false);
      toast.success("Availability added");
    } catch (e: any) {
      toast.error(e.message || "Failed to add");
    }
  };

  const handleDeleteAvail = async (id: number) => {
    if (!confirm("Remove this availability block?")) return;
    try {
      await deleteAvailability(id);
      setAvailability(availability.filter(a => a.id !== id));
      toast.success("Removed");
    } catch (e: any) { toast.error(e.message); }
  };

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
          <p className="text-sm text-gray-500">Manage your classes and availability</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {([
            { key: "today", label: `Today (${todayClasses.length})` },
            { key: "week", label: "Full Week" },
            { key: "availability", label: "Availability" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TODAY */}
        {tab === "today" && (
          <div>
            {todayClasses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-700 mb-1">No classes today</h3>
                <p className="text-sm text-gray-400">Enjoy your day off — or check tomorrow's lineup in the Week tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayClasses.map(c => (
                  <ClassCard key={c.id} cls={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* WEEK */}
        {tab === "week" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-x-auto">
            <div className="grid grid-cols-7 gap-3 min-w-[820px]">
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
                        <div key={c.id} className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-xs">
                          <p className="font-semibold text-sat-primary flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {c.start_time}
                          </p>
                          <p className="text-gray-700 truncate mt-1" title={c.course_title}>{c.course_title}</p>
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                            {c.session_type === "individual" ? <UserIcon className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                            {c.current_students}/{c.max_students}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AVAILABILITY */}
        {tab === "availability" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Set your recurring weekly availability. Students will only be able to book within these windows.
              </p>
              <button
                onClick={() => setShowAvailForm(!showAvailForm)}
                className="inline-flex items-center gap-1 bg-sat-primary text-white text-sm px-3 py-1.5 rounded-lg hover:bg-sat-secondary"
              >
                <Plus className="w-4 h-4" /> Add window
              </button>
            </div>

            {showAvailForm && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Day</label>
                    <select value={newDay} onChange={e => setNewDay(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Start</label>
                    <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End</label>
                    <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleAddAvailability}
                      className="w-full bg-sat-primary text-white text-sm py-2 rounded-lg hover:bg-sat-secondary">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {availability.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <AlertCircle className="w-10 h-10 text-amber-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No availability set yet — add some so students can book you.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {availability.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-sat-primary rounded-lg flex items-center justify-center text-xs font-bold">
                        {SHORT_DAYS[a.day_of_week]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{a.day_name}</p>
                        <p className="text-xs text-gray-500">{a.start_time} – {a.end_time}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAvail(a.id)}
                      className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ClassCard = ({ cls }: { cls: ScheduledClassOut }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-sat-primary" />
          <span className="font-bold text-lg text-gray-900">{cls.start_time}</span>
          <span className="text-xs text-gray-400">· {cls.duration_minutes}min</span>
        </div>
        <p className="font-semibold text-gray-800">{cls.course_title}</p>
        <p className="text-xs text-gray-500">{cls.program_name}</p>
      </div>
      <div className={`text-xs font-semibold px-3 py-1 rounded-full ${
        cls.session_type === "individual" ? "bg-indigo-50 text-sat-primary" : "bg-purple-50 text-purple-600"
      }`}>
        {cls.session_type === "individual" ? "1-on-1" : `Group ${cls.current_students}/${cls.max_students}`}
      </div>
    </div>
    {cls.students.length > 0 ? (
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Students</p>
        <div className="space-y-1.5">
          {cls.students.map(s => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-sat-primary text-white text-xs font-semibold flex items-center justify-center">
                  {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </span>
                <span className="text-gray-800">{s.name}</span>
                <a href={`mailto:${s.email}`} className="text-gray-400 hover:text-sat-primary"><Mail className="w-3 h-3" /></a>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                s.payment_status === "paid" ? "bg-green-100 text-green-700"
                : s.payment_status === "pending" ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
              }`}>
                {s.payment_status}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">No students enrolled in this slot yet</p>
    )}
  </div>
);

export default TutorSchedule;
