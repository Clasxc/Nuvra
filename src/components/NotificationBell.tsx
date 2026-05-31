// src/components/NotificationBell.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  getNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead,
} from "@/lib/api";
import type { Notification } from "@/lib/api";
import { timeAgo } from "@/lib/datetime";

const ICONS: Record<string, string> = {
  session: "📅",
  assignment: "📝",
  grade: "🏆",
  payment: "💳",
  enrollment: "🎓",
  schedule: "🗓️",
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count every 30 seconds
  useEffect(() => {
    const fetch = () => getUnreadCount().then(r => setUnread(r.count)).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = async () => {
    setOpen(v => !v);
    if (!open) {
      setLoading(true);
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {}
      setLoading(false);
    }
  };

  const handleMarkRead = async (n: Notification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-sat-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-sat-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    !n.is_read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{ICONS[n.notif_type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? "font-medium text-gray-800" : "text-gray-600"}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-sat-primary rounded-full shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
