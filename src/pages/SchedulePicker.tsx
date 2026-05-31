// src/pages/SchedulePicker.tsx
// Browse programs for a course → pick one → pick N time slots → book.

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  getCourse, getPrograms, getAvailableSlots, enrollInProgram,
  isLoggedIn, getCurrentUser,
} from "@/lib/api";
import type { Course, Program, TimeSlotOption, User, BookedSlot } from "@/lib/api";
import { toast } from "sonner";
import { Users, User as UserIcon, Clock, CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SchedulePicker = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const cid = Number(courseId);
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [picked, setPicked] = useState<TimeSlotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    Promise.all([getCurrentUser(), getCourse(cid), getPrograms(cid)])
      .then(([u, c, ps]) => {
        if (u.role !== "student") { toast.error("Only students can enroll"); navigate(-1); return; }
        setUser(u);
        setCourse(c);
        setPrograms(ps);
      })
      .catch(() => { toast.error("Could not load course"); navigate(-1); })
      .finally(() => setLoading(false));
  }, [cid]);

  useEffect(() => {
    if (!selectedProgram) { setSlots([]); setPicked([]); return; }
    setLoadingSlots(true);
    getAvailableSlots(selectedProgram.id)
      .then(setSlots)
      .catch(() => toast.error("Failed to load slots"))
      .finally(() => setLoadingSlots(false));
  }, [selectedProgram]);

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, TimeSlotOption[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    slots.forEach(s => map[s.day_of_week].push(s));
    Object.values(map).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [slots]);

  const pickedKey = (s: TimeSlotOption) => `${s.tutor_id}-${s.day_of_week}-${s.start_time}`;
  const isPicked = (s: TimeSlotOption) => picked.some(p => pickedKey(p) === pickedKey(s));

  const togglePick = (s: TimeSlotOption) => {
    if (s.is_full) return;
    if (!selectedProgram) return;
    if (isPicked(s)) {
      setPicked(picked.filter(p => pickedKey(p) !== pickedKey(s)));
      return;
    }
    if (picked.length >= selectedProgram.sessions_per_week) {
      toast.error(`This program is ${selectedProgram.sessions_per_week} sessions/week — deselect one first`);
      return;
    }
    // No two slots same day
    if (picked.some(p => p.day_of_week === s.day_of_week)) {
      toast.error("Pick different days for each session");
      return;
    }
    setPicked([...picked, s]);
  };

  const handleBook = async () => {
    if (!selectedProgram) return;
    if (picked.length !== selectedProgram.sessions_per_week) {
      toast.error(`Pick exactly ${selectedProgram.sessions_per_week} slots first`);
      return;
    }
    setBooking(true);
    try {
      const payload: BookedSlot[] = picked.map(p => ({
        tutor_id: p.tutor_id,
        day_of_week: p.day_of_week,
        start_time: p.start_time,
      }));
      await enrollInProgram(selectedProgram.id, payload);
      toast.success("Enrolled! Check your schedule and complete payment.");
      navigate("/my-schedule");
    } catch (e: any) {
      toast.error(e.message || "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!course || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        <button
          onClick={() => navigate(`/courses/${cid}`)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to course
        </button>

        <div className="mb-6">
          <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide mb-1">Enroll in a program</p>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        </div>

        {/* Step 1: Pick a program */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Step 1 — Choose a program
          </h2>
          {programs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No programs available for this course yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map(p => {
                const isSelected = selectedProgram?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProgram(p); setPicked([]); }}
                    className={`text-left p-5 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? "border-sat-primary bg-indigo-50/50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {p.session_type === "individual" ? (
                        <UserIcon className="w-4 h-4 text-sat-primary" />
                      ) : (
                        <Users className="w-4 h-4 text-purple-600" />
                      )}
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        p.session_type === "individual" ? "text-sat-primary" : "text-purple-600"
                      }`}>
                        {p.session_type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Clock className="w-3 h-3" />
                      <span>{p.session_duration_minutes} min · {p.sessions_per_week}× per week</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900">${p.price_per_month}</span>
                      <span className="text-xs text-gray-400">/month</span>
                    </div>
                    {p.session_type === "group" && (
                      <p className="text-xs text-gray-400 mt-2">
                        Up to {p.max_students_per_class} students per class
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2: Pick time slots */}
        {selectedProgram && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Step 2 — Pick {selectedProgram.sessions_per_week} time slot{selectedProgram.sessions_per_week > 1 ? "s" : ""}
                {" "}({selectedProgram.session_duration_minutes} min each, different days)
              </h2>
              <div className="text-sm">
                <span className="font-semibold text-sat-primary">{picked.length}</span>
                <span className="text-gray-400"> / {selectedProgram.sessions_per_week} selected</span>
              </div>
            </div>

            {loadingSlots ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-8 h-8 mx-auto border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-x-auto">
                <div className="grid grid-cols-7 gap-3 min-w-[700px]">
                  {DAY_NAMES.map((day, di) => (
                    <div key={di} className="space-y-2">
                      <p className="text-xs font-semibold text-gray-600 text-center pb-2 border-b border-gray-100">
                        {day}
                      </p>
                      {slotsByDay[di].length === 0 ? (
                        <p className="text-xs text-gray-300 text-center py-4">—</p>
                      ) : (
                        slotsByDay[di].map(s => {
                          const picked_ = isPicked(s);
                          return (
                            <button
                              key={`${s.tutor_id}-${s.start_time}`}
                              onClick={() => togglePick(s)}
                              disabled={s.is_full}
                              title={s.is_full ? "This slot is taken" : `${s.tutor_name} · ${s.available_seats} seat${s.available_seats !== 1 ? "s" : ""} left`}
                              className={`w-full text-xs rounded-lg px-2 py-1.5 transition-colors ${
                                s.is_full
                                  ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                                  : picked_
                                  ? "bg-sat-primary text-white font-semibold"
                                  : "bg-indigo-50 text-sat-primary hover:bg-indigo-100"
                              }`}
                            >
                              {s.start_time}
                              {selectedProgram.session_type === "group" && !s.is_full && (
                                <span className="block text-[10px] opacity-70">{s.available_seats} seat{s.available_seats !== 1 ? "s" : ""}</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary + book button */}
            {picked.length > 0 && (
              <div className="mt-5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide mb-2">Your weekly schedule</p>
                    <div className="flex flex-wrap gap-2">
                      {picked.map((p, i) => (
                        <div key={i} className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs">
                          <span className="font-semibold text-gray-800">{p.day_name}</span>
                          <span className="text-gray-500 mx-1">·</span>
                          <span className="text-gray-700">{p.start_time}</span>
                          <span className="text-gray-400 ml-2 text-[10px]">w/ {p.tutor_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleBook}
                    disabled={booking || picked.length !== selectedProgram.sessions_per_week}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50 transition-all whitespace-nowrap inline-flex items-center gap-2"
                  >
                    {booking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Booking…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm — ${selectedProgram.price_per_month}/month
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedProgram && programs.length > 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <Sparkles className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Pick a program above to see available time slots</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulePicker;
