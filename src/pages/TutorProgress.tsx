// src/pages/TutorProgress.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCoursesImTeaching, getTutorCourseProgress, getCurrentUser, isLoggedIn, removeToken, getClassWeaknessAnalysis } from "@/lib/api";
import type { User, Course, StudentCourseProgress, ClassWeaknessItem } from "@/lib/api";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, TrendingDown } from "lucide-react";

const TutorProgress = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentCourseProgress[]>([]);
  const [weakness, setWeakness] = useState<ClassWeaknessItem[]>([]);
  const [tab, setTab] = useState<"students" | "weakness">("students");
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    Promise.all([getCurrentUser(), getCoursesImTeaching()])
      .then(([u, mine]) => {
        setUser(u);
        if (u.role !== "tutor" && u.role !== "admin") { navigate("/dashboard"); return; }
        setCourses(mine);
        if (mine.length > 0) setSelectedCourseId(mine[0].id);
      })
      .catch(() => { removeToken(); navigate("/login"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingStudents(true);
    Promise.all([
      getTutorCourseProgress(selectedCourseId),
      getClassWeaknessAnalysis(selectedCourseId).catch(() => []),
    ])
      .then(([s, w]) => {
        setStudents(s);
        setWeakness(w);
      })
      .catch(() => toast.error("Failed to load student progress"))
      .finally(() => setLoadingStudents(false));
  }, [selectedCourseId]);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Student Progress</h1>
            <p className="text-gray-400 text-sm mt-1">
              View attendance, assignment completion, and grades for each student in your courses
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
              <p className="text-4xl mb-3">📚</p>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No courses yet</h3>
              <p className="text-sm text-gray-400">Create a course on your dashboard first.</p>
            </div>
          ) : (
            <>
              {/* Course tabs */}
              <div className="flex gap-2 flex-wrap mb-6">
                {courses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCourseId === c.id
                        ? "bg-sat-primary text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-sat-primary hover:text-sat-primary"
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
                {[
                  { key: "students" as const, label: "Students" },
                  { key: "weakness" as const, label: "✨ Class Insights" },
                ].map(t => (
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

              {loadingStudents ? (
                <Spinner />
              ) : tab === "weakness" ? (
                <WeaknessPanel items={weakness} />
              ) : students.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
                  <p className="text-4xl mb-3">👥</p>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No students enrolled</h3>
                  <p className="text-sm text-gray-400">Share the course link so students can enroll.</p>
                </div>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <SummaryCard label="Students" value={students.length} />
                    <SummaryCard
                      label="Avg attendance"
                      value={`${Math.round(
                        students.reduce((acc, s) => acc + (s.total_sessions > 0 ? s.sessions_attended / s.total_sessions * 100 : 0), 0) / students.length
                      )}%`}
                    />
                    <SummaryCard
                      label="Avg grade"
                      value={(() => {
                        const graded = students.filter(s => s.average_grade !== null);
                        if (graded.length === 0) return "—";
                        return `${Math.round(graded.reduce((acc, s) => acc + s.average_grade!, 0) / graded.length)}`;
                      })()}
                    />
                    <SummaryCard
                      label="Total AI queries"
                      value={students.reduce((acc, s) => acc + s.ai_questions_asked, 0)}
                    />
                  </div>

                  {/* Student table */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                            <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attendance</th>
                            <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignments</th>
                            <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Grade</th>
                            <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Queries</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {students.map(s => {
                            const attendancePct = s.total_sessions > 0
                              ? Math.round(s.sessions_attended / s.total_sessions * 100)
                              : null;
                            const submitPct = s.total_assignments > 0
                              ? Math.round(s.assignments_submitted / s.total_assignments * 100)
                              : null;

                            return (
                              <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-sat-primary text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                                      {s.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                    </span>
                                    <div>
                                      <p className="font-medium text-gray-800">{s.name}</p>
                                      <p className="text-xs text-gray-400">{s.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`text-sm font-semibold ${attendancePct === null ? "text-gray-400" : attendancePct >= 70 ? "text-green-600" : attendancePct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                      {attendancePct !== null ? `${attendancePct}%` : "—"}
                                    </span>
                                    <span className="text-xs text-gray-400">{s.sessions_attended}/{s.total_sessions} sessions</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`text-sm font-semibold ${submitPct === null ? "text-gray-400" : submitPct >= 70 ? "text-green-600" : submitPct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                      {submitPct !== null ? `${submitPct}%` : "—"}
                                    </span>
                                    <span className="text-xs text-gray-400">{s.assignments_submitted}/{s.total_assignments} submitted</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  {s.average_grade !== null ? (
                                    <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${
                                      s.average_grade >= 70 ? "bg-green-100 text-green-700"
                                      : s.average_grade >= 50 ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                    }`}>
                                      {s.average_grade}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-sm">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="text-sm text-indigo-600 font-medium bg-indigo-50 px-2.5 py-1 rounded-full">
                                    {s.ai_questions_asked}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
    <p className="text-2xl font-bold text-gray-800">{value}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

const WeaknessPanel = ({ items }: { items: ClassWeaknessItem[] }) => {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
        <p className="text-4xl mb-3">📊</p>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No quiz attempts yet</h3>
        <p className="text-sm text-gray-400">Once your students attempt quizzes, you'll see exactly which concepts the class is struggling with.</p>
      </div>
    );
  }

  const top = items.slice(0, 8);
  const chartData = top.map(it => ({
    name: it.topic.length > 28 ? it.topic.slice(0, 25) + "…" : it.topic,
    fullTopic: it.topic,
    wrong: it.wrong_pct,
  }));
  const colorFor = (pct: number) =>
    pct >= 70 ? "#dc2626" : pct >= 40 ? "#d97706" : "#16a34a";

  const critical = items.filter(i => i.wrong_pct >= 60);

  return (
    <div className="space-y-6">
      {/* Critical alert banner */}
      {critical.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">
              {critical.length} concept{critical.length > 1 ? "s" : ""} need{critical.length === 1 ? "s" : ""} attention
            </h3>
            <p className="text-sm text-gray-600">
              {critical[0].wrong_pct}% of your class got{" "}
              <span className="font-medium text-gray-800">"{critical[0].topic}"</span> wrong.
              Consider revisiting this in the next session.
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-5 h-5 text-sat-primary" />
          <h3 className="font-semibold text-gray-800">Class Weakness Heatmap</h3>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          % of students who got each concept wrong. Lower is better.
        </p>

        <ResponsiveContainer width="100%" height={Math.max(260, top.length * 42)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={12} stroke="#94a3b8" />
            <YAxis
              type="category"
              dataKey="name"
              width={220}
              fontSize={12}
              stroke="#64748b"
              tick={{ fill: "#475569" }}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 13,
              }}
              formatter={(value: number) => [`${value}%`, "got it wrong"]}
              labelFormatter={(label: string, payload: any) => {
                const item = payload?.[0]?.payload;
                return item?.fullTopic || label;
              }}
            />
            <Bar dataKey="wrong" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={colorFor(entry.wrong)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">What students get wrong most</h3>
          <p className="text-xs text-gray-400 mt-1">Including the wrong answer they most often pick</p>
        </div>
        <div className="divide-y divide-gray-50">
          {items.slice(0, 5).map((it, i) => (
            <div key={i} className="p-5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 mb-1">{it.question}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-green-700">Correct:</span> {it.correct_answer}
                  </p>
                </div>
                <span
                  className="text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: `${colorFor(it.wrong_pct)}15`,
                    color: colorFor(it.wrong_pct),
                  }}
                >
                  {it.wrong_pct}% wrong
                </span>
              </div>
              {it.most_common_wrong && (
                <div className="mt-3 text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <span className="font-medium text-amber-700">Most common mistake:</span>{" "}
                  picked <em>"{it.most_common_wrong.option_text}"</em> ({it.most_common_wrong.count} of {it.total_attempts} students)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default TutorProgress;
