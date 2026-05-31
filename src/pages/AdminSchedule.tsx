// src/pages/AdminSchedule.tsx — master schedule + financier
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  getMasterSchedule, getRevenue, getPayments, getTutorEarnings,
  updatePayment, remindPayment, isLoggedIn, getCurrentUser,
} from "@/lib/api";
import type { ScheduledClassOut, RevenueSummary, PaymentRow, TutorEarningsRow, User } from "@/lib/api";
import { toast } from "sonner";
import {
  Calendar, DollarSign, TrendingUp, AlertTriangle, Users,
  CheckCircle, Clock, Bell, Award,
} from "lucide-react";

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AdminSchedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"schedule" | "revenue" | "payments" | "tutors">("schedule");
  const [classes, setClasses] = useState<ScheduledClassOut[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [tutorEarnings, setTutorEarnings] = useState<TutorEarningsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      getMasterSchedule(),
      getRevenue(),
      getPayments(),
      getTutorEarnings(),
    ])
      .then(([cs, rev, pays, earns]) => {
        setClasses(cs); setRevenue(rev); setPayments(pays); setTutorEarnings(earns);
      })
      .catch(() => toast.error("Failed to load admin data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    getCurrentUser().then(u => {
      if (u.role !== "admin") { navigate("/dashboard"); return; }
      setUser(u);
      load();
    });
  }, [navigate]);

  // Auto-refresh every 20s for real-time feel
  useEffect(() => {
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const handleMarkPaid = async (e: PaymentRow) => {
    try {
      await updatePayment(e.enrollment_id, "paid");
      toast.success("Marked as paid");
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRemind = async (e: PaymentRow) => {
    try {
      await remindPayment(e.enrollment_id);
      toast.success("Reminder sent");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleMarkOverdue = async (e: PaymentRow) => {
    try {
      await updatePayment(e.enrollment_id, "overdue");
      toast.success("Marked overdue");
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  // Group classes by day
  const byDay: Record<number, ScheduledClassOut[]> = {};
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
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Center Operations</h1>
          <p className="text-sm text-gray-500">Schedules, revenue, and payments — updated every 20 seconds</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit flex-wrap">
          {([
            { key: "schedule", icon: Calendar, label: "Master Schedule" },
            { key: "revenue", icon: TrendingUp, label: "Revenue" },
            { key: "payments", icon: DollarSign, label: `Payments (${payments.length})` },
            { key: "tutors", icon: Award, label: "Tutor Earnings" },
          ] as const).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Showing {classes.length} recurring class slot{classes.length !== 1 ? "s" : ""} across all tutors
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-x-auto">
              <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
                {SHORT_DAYS.map((day, di) => (
                  <div key={di} className="space-y-2">
                    <p className="text-xs font-bold text-gray-600 text-center pb-2 border-b border-gray-100">
                      {day} ({byDay[di].length})
                    </p>
                    {byDay[di].length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-2">—</p>
                    ) : (
                      byDay[di].map(c => (
                        <div key={c.id} className={`rounded-lg p-2 text-xs border ${
                          c.current_students >= c.max_students
                            ? "bg-red-50 border-red-100"
                            : c.session_type === "individual"
                            ? "bg-indigo-50 border-indigo-100"
                            : "bg-purple-50 border-purple-100"
                        }`}>
                          <p className="font-bold text-gray-800 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {c.start_time}
                          </p>
                          <p className="text-gray-700 truncate mt-1 font-medium" title={c.course_title}>
                            {c.course_title}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate" title={c.tutor_name}>{c.tutor_name}</p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {c.current_students}/{c.max_students} · {c.duration_minutes}m
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* REVENUE */}
        {tab === "revenue" && revenue && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Revenue (paid)" value={`$${revenue.total_revenue}`} color="text-green-600" icon={CheckCircle} />
              <StatCard label="Pending" value={`$${revenue.total_pending}`} color="text-amber-600" icon={Clock} />
              <StatCard label="Overdue" value={`$${revenue.total_overdue}`} color="text-red-600" icon={AlertTriangle} />
              <StatCard label="Active enrollments" value={revenue.active_enrollments.toString()} color="text-sat-primary" icon={Users} />
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Enrollment status breakdown</h3>
              <div className="space-y-3">
                <Bar label="Paid" count={revenue.paid_count} total={revenue.active_enrollments} color="bg-green-500" />
                <Bar label="Pending" count={revenue.pending_count} total={revenue.active_enrollments} color="bg-amber-500" />
                <Bar label="Overdue" count={revenue.overdue_count} total={revenue.active_enrollments} color="bg-red-500" />
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {tab === "payments" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Enrollments & Payments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Program</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Paid</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(p => (
                    <tr key={p.enrollment_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.student_name}</p>
                        <p className="text-xs text-gray-400">{p.student_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{p.course_title}</p>
                        <p className="text-xs text-gray-400">{p.program_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${p.price_per_month}</td>
                      <td className="px-4 py-3 text-right text-gray-600">${p.amount_paid}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          p.payment_status === "paid" ? "bg-green-100 text-green-700"
                          : p.payment_status === "pending" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          {p.payment_status !== "paid" && (
                            <button
                              onClick={() => handleMarkPaid(p)}
                              className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg"
                            >
                              Mark paid
                            </button>
                          )}
                          {p.payment_status === "pending" && (
                            <button
                              onClick={() => handleRemind(p)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-sat-primary bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg"
                            >
                              <Bell className="w-3 h-3" /> Remind
                            </button>
                          )}
                          {p.payment_status === "pending" && (
                            <button
                              onClick={() => handleMarkOverdue(p)}
                              className="text-xs font-medium text-red-600 hover:text-red-700 px-2.5 py-1 rounded-lg"
                            >
                              Overdue
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TUTORS */}
        {tab === "tutors" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Tutor Performance & Earnings</h3>
              <p className="text-xs text-gray-400 mt-1">Monthly revenue is sum of paid program enrollments</p>
            </div>
            <div className="divide-y divide-gray-50">
              {tutorEarnings.map(t => (
                <div key={t.tutor_id} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-sat-primary rounded-full flex items-center justify-center font-bold">
                      {t.tutor_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{t.tutor_name}</p>
                      <p className="text-xs text-gray-500">
                        {t.student_count} student{t.student_count !== 1 ? "s" : ""} · {t.active_classes} class{t.active_classes !== 1 ? "es" : ""}/week
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">${t.monthly_revenue}</p>
                    <p className="text-xs text-gray-400">monthly revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const Bar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500 font-medium">{count} of {total}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default AdminSchedule;
