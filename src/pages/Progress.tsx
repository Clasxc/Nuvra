// src/pages/Progress.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isLoggedIn, getCurrentUser, getMyProgress } from "@/lib/api";
import type { User } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/lib/datetime";

interface CourseProgress {
  course_id: number;
  course_title: string;
  enrolled_at: string;
  total_sessions: number;
  attended_sessions: number;
  total_assignments: number;
  submitted_assignments: number;
  graded_assignments: number;
  average_grade: number | null;
  ai_questions_asked: number;
  completion_percentage: number;
}

interface ProgressData {
  courses: CourseProgress[];
  total_ai_questions: number;
  total_sessions_attended: number;
  total_assignments_submitted: number;
}


const CircleProgress = ({ percentage, size = 80 }: { percentage: number; size?: number }) => {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? "#16a34a" : percentage >= 40 ? "#2563eb" : "#f59e0b";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle" dominantBaseline="middle"
        className="rotate-90"
        style={{
          fill: color, fontSize: size < 70 ? 11 : 14,
          fontWeight: 600, transform: `rotate(90deg)`,
          transformOrigin: "center",
        }}
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  );
};

const StatBar = ({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value} / {total}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

const Progress = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }

    Promise.all([getCurrentUser(), getMyProgress()])
      .then(([u, p]) => { setUser(u); setData(p as ProgressData); })
      .catch((e) => { console.error(e); toast.error("Failed to load progress"); })
      .finally(() => setIsLoading(false));
  }, [navigate]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">My Progress</h1>
            <p className="text-gray-400 mt-1 text-sm">Track your learning across all enrolled courses</p>
          </div>

          {/* Overall stats */}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Sessions attended", value: data.total_sessions_attended, icon: "📅" },
                { label: "Assignments submitted", value: data.total_assignments_submitted, icon: "📝" },
                { label: "AI questions asked", value: data.total_ai_questions, icon: "🤖" },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                  <span className="text-3xl">{stat.icon}</span>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Per-course progress */}
          {data?.courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-4">📚</p>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses yet</h3>
              <p className="text-gray-400 text-sm mb-6">Enroll in a course to start tracking your progress.</p>
              <button
                onClick={() => navigate("/courses")}
                className="bg-sat-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
              >
                Browse courses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {data?.courses.map(course => (
                <div key={course.course_id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Course header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <CircleProgress percentage={course.completion_percentage} />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-800">{course.course_title}</h2>
                        <p className="text-sm text-gray-400 mt-0.5">
                          Enrolled {formatDate(course.enrolled_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-2xl font-bold text-gray-800">{course.completion_percentage}%</p>
                      <p className="text-xs text-gray-400">completion</p>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <StatBar
                        label="Sessions attended"
                        value={course.attended_sessions}
                        total={course.total_sessions}
                        color="#2563eb"
                      />
                      <StatBar
                        label="Assignments submitted"
                        value={course.submitted_assignments}
                        total={course.total_assignments}
                        color="#7c3aed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Grade */}
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-gray-800">
                          {course.average_grade !== null ? `${course.average_grade}` : "—"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Avg grade</p>
                        {course.graded_assignments > 0 && (
                          <p className="text-xs text-gray-300 mt-0.5">
                            from {course.graded_assignments} graded
                          </p>
                        )}
                      </div>

                      {/* AI usage */}
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-gray-800">{course.ai_questions_asked}</p>
                        <p className="text-xs text-gray-400 mt-1">AI questions</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Progress;