// src/pages/Admin.tsx — Full admin panel
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser, isLoggedIn, removeToken,
  getAdminStats, getAdminUsers, deleteAdminUser, updateUserRole,
  getAdminEnrollments, deleteAdminEnrollment,
  getCourses, adminDeleteCourse,
  getCourseInstructors, addCourseInstructor, removeCourseInstructor,
} from "@/lib/api";
import type { User, AdminStats, AdminUser, AdminEnrollment, Course, CourseInstructor } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { formatDate } from "@/lib/datetime";

type Tab = "overview" | "users" | "enrollments" | "courses";

const Admin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    getCurrentUser()
      .then(u => {
        if (u.role !== "admin") { navigate("/dashboard"); return; }
        setUser(u);
      })
      .catch(() => { removeToken(); navigate("/login"); })
      .finally(() => setIsLoading(false));
  }, [navigate]);

  if (isLoading) return <Spinner />;
  if (!user) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users" },
    { key: "enrollments", label: "Enrollments" },
    { key: "courses", label: "Courses" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
            <p className="text-sm text-gray-400 mt-1">Platform management</p>
          </div>
          <button
            onClick={() => { removeToken(); navigate("/"); }}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200 hover:text-red-500 transition-colors"
          >Log out</button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "users" && <UsersTab currentAdminId={user.id} />}
        {activeTab === "enrollments" && <EnrollmentsTab />}
        {activeTab === "courses" && <CoursesTab />}
      </div>
    </div>
  );
};

// ─── Overview ─────────────────────────────────────────────────────────────────

const OverviewTab = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats) return null;

  const statItems = [
    { label: "Students", value: stats.total_students, color: "bg-blue-50 text-blue-700" },
    { label: "Tutors", value: stats.total_tutors, color: "bg-purple-50 text-purple-700" },
    { label: "Courses", value: stats.total_courses, color: "bg-green-50 text-green-700" },
    { label: "Sessions", value: stats.total_sessions, color: "bg-yellow-50 text-yellow-700" },
    { label: "Enrollments", value: stats.total_enrollments, color: "bg-orange-50 text-orange-700" },
    { label: "AI Queries", value: stats.total_ai_queries, color: "bg-pink-50 text-pink-700" },
    { label: "Assignments", value: stats.total_assignments, color: "bg-teal-50 text-teal-700" },
    { label: "Submissions", value: stats.total_submissions, color: "bg-indigo-50 text-indigo-700" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {statItems.map(s => (
        <div key={s.label} className={`rounded-xl p-5 ${s.color.split(" ")[0]}`}>
          <p className={`text-3xl font-bold ${s.color.split(" ")[1]}`}>{s.value}</p>
          <p className="text-sm text-gray-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Users ────────────────────────────────────────────────────────────────────

const UsersTab = ({ currentAdminId }: { currentAdminId: number }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "student" | "tutor" | "admin">("all");
  const [search, setSearch] = useState("");

  const load = () => {
    getAdminUsers()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This is irreversible.`)) return;
    try {
      await deleteAdminUser(id);
      toast.success("User deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    try {
      await updateUserRole(id, newRole);
      toast.success(`Role updated to ${newRole}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = users.filter(u => {
    const matchRole = filter === "all" || u.role === filter;
    const matchSearch = search === "" ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  if (loading) return <Spinner />;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
        />
        <div className="flex gap-1">
          {(["all", "student", "tutor", "admin"] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === r ? "bg-sat-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">ID</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400">{u.id}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === currentAdminId}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sat-primary disabled:opacity-50"
                  >
                    <option value="student">student</option>
                    <option value="tutor">tutor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.id !== currentAdminId && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {filtered.length} of {users.length} users
      </div>
    </div>
  );
};

// ─── Enrollments ──────────────────────────────────────────────────────────────

const EnrollmentsTab = () => {
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    getAdminEnrollments()
      .then(setEnrollments)
      .catch(() => toast.error("Failed to load enrollments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, studentName: string, courseTitle: string) => {
    if (!confirm(`Remove ${studentName} from "${courseTitle}"?`)) return;
    try {
      await deleteAdminEnrollment(id);
      toast.success("Enrollment removed");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = enrollments.filter(e =>
    search === "" ||
    e.student_name.toLowerCase().includes(search.toLowerCase()) ||
    e.student_email.toLowerCase().includes(search.toLowerCase()) ||
    e.course_title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <input
          placeholder="Search by student or course..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Student</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Course</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Enrolled</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No enrollments found</td></tr>
            ) : filtered.map(e => (
              <tr key={e.enrollment_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{e.student_name}</td>
                <td className="px-4 py-3 text-gray-500">{e.student_email}</td>
                <td className="px-4 py-3 text-gray-700">{e.course_title}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatDate(e.enrolled_at)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(e.enrollment_id, e.student_name, e.course_title)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {filtered.length} of {enrollments.length} enrollments
      </div>
    </div>
  );
};

// ─── Courses ──────────────────────────────────────────────────────────────────

const CoursesTab = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [instructorsModal, setInstructorsModal] = useState<Course | null>(null);

  const load = () => {
    getCourses()
      .then(setCourses)
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete course "${title}" and all its data? This cannot be undone.`)) return;
    try {
      await adminDeleteCourse(id);
      toast.success("Course deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = courses.filter(c =>
    search === "" || c.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <input
          placeholder="Search courses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">ID</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Description</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Sessions</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No courses found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400">{c.id}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.description}</td>
                <td className="px-4 py-3 text-gray-500">{c.sessions.length}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 items-center">
                    <button
                      onClick={() => setInstructorsModal(c)}
                      className="text-xs text-sat-primary hover:underline transition-colors"
                    >Instructors</button>
                    <button
                      onClick={() => handleDelete(c.id, c.title)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {filtered.length} of {courses.length} courses
      </div>
      {instructorsModal && (
        <InstructorsModal
          course={instructorsModal}
          onClose={() => setInstructorsModal(null)}
        />
      )}
    </div>
  );
};

// ─── Instructors management modal ─────────────────────────────────────────────

const InstructorsModal = ({ course, onClose }: { course: Course; onClose: () => void }) => {
  const [instructors, setInstructors] = useState<CourseInstructor[]>([]);
  const [tutors, setTutors] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<"co_teacher" | "primary">("co_teacher");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      getCourseInstructors(course.id),
      getAdminUsers().then(us => us.filter(u => u.role === "tutor")),
    ])
      .then(([inst, tts]) => { setInstructors(inst); setTutors(tts); })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const enrolledIds = new Set(instructors.map(i => i.user_id));
  const candidates = tutors.filter(t => !enrolledIds.has(t.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await addCourseInstructor(course.id, selectedUserId, selectedRole);
      toast.success(`Added as ${selectedRole === "primary" ? "primary" : "co-teacher"}`);
      setSelectedUserId(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleRemove = async (user_id: number, role: string) => {
    if (role === "primary") { toast.error("Promote another instructor first"); return; }
    if (!confirm("Remove this instructor?")) return;
    try {
      await removeCourseInstructor(course.id, user_id);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Instructors</p>
            <h2 className="font-semibold text-gray-800">{course.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="p-5 space-y-4">
            {/* Current instructors */}
            <div className="space-y-2">
              {instructors.map(i => (
                <div key={i.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-sat-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
                      {i.user_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{i.user_name}</p>
                      <p className="text-xs text-gray-400">{i.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      i.role === "primary" ? "bg-indigo-100 text-sat-primary" : "bg-purple-100 text-purple-600"
                    }`}>
                      {i.role === "primary" ? "Primary" : "Co-teacher"}
                    </span>
                    {i.role !== "primary" && (
                      <button onClick={() => handleRemove(i.user_id, i.role)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add new */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide mb-2">Add another instructor</p>
              {candidates.length === 0 ? (
                <p className="text-xs text-gray-400">All tutors are already on this course.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedUserId ?? ""}
                    onChange={e => setSelectedUserId(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">— pick a tutor —</option>
                    {candidates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as any)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="co_teacher">Co-teacher</option>
                    <option value="primary">Promote to primary</option>
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!selectedUserId || saving}
                    className="bg-sat-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-50"
                  >
                    {saving ? "Adding..." : "Add"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Shared ───────────────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default Admin;
