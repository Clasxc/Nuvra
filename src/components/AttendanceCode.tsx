// src/components/AttendanceCode.tsx
// Tutor: generate and display a session code
// Student: enter a code to mark attendance

import { useState, useEffect } from "react";
import {
  generateAttendanceCode, getActiveCode,
  markAttendanceWithCode, getMyAttendedSessions,
} from "@/lib/api";
import type { AttendanceCode as AttendanceCodeType } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, Clock, RefreshCw } from "lucide-react";

// ─── TUTOR: Code Generator ────────────────────────────────────────────────────

export const AttendanceCodeGenerator = ({ sessionId, sessionTitle }: {
  sessionId: number;
  sessionTitle: string;
}) => {
  const [codeData, setCodeData] = useState<AttendanceCodeType | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Countdown timer
  useEffect(() => {
    if (!codeData) return;
    const interval = setInterval(() => {
      const remaining = new Date(codeData.expires_at).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.floor(remaining / 1000)));
      if (remaining <= 0) setCodeData(null);
    }, 1000);
    return () => clearInterval(interval);
  }, [codeData]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateAttendanceCode(sessionId);
      setCodeData(data);
      setTimeLeft(Math.floor(
        (new Date(data.expires_at).getTime() - Date.now()) / 1000
      ));
      toast.success("Code generated — share it with students now!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate code");
    } finally {
      setLoading(false);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isExpiringSoon = timeLeft > 0 && timeLeft < 60;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium text-sm text-gray-800">{sessionTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">Attendance code</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-sat-primary hover:underline disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {codeData ? "Regenerate" : "Generate code"}
        </button>
      </div>

      {codeData && timeLeft > 0 ? (
        <div className="text-center py-4">
          {/* Big code display */}
          <div className={`inline-block px-8 py-4 rounded-2xl mb-3 ${
            isExpiringSoon ? "bg-red-50 border-2 border-red-300" : "bg-blue-50 border-2 border-sat-primary/30"
          }`}>
            <p className={`text-4xl font-bold tracking-[0.3em] font-mono ${
              isExpiringSoon ? "text-red-600" : "text-sat-primary"
            }`}>
              {codeData.code}
            </p>
          </div>

          {/* Timer */}
          <div className={`flex items-center justify-center gap-1.5 text-sm font-medium ${
            isExpiringSoon ? "text-red-500" : "text-gray-500"
          }`}>
            <Clock className="w-4 h-4" />
            {isExpiringSoon
              ? `Expires in ${secs}s — regenerate soon`
              : `Expires in ${mins}:${secs.toString().padStart(2, "0")}`
            }
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Share this code verbally or paste it in the Meet chat
          </p>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm">
          {codeData
            ? "Code expired — generate a new one"
            : "No active code. Generate one when the session starts."
          }
        </div>
      )}
    </div>
  );
};

// ─── STUDENT: Code Entry ──────────────────────────────────────────────────────

export const AttendanceCodeEntry = ({ sessionId, sessionTitle, onMarked }: {
  sessionId: number;
  sessionTitle: string;
  onMarked: () => void;
}) => {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      toast.error("Code must be 6 characters"); return;
    }
    setSubmitting(true);
    try {
      await markAttendanceWithCode(sessionId, code.toUpperCase().trim());
      toast.success("Attendance marked!");
      onMarked();
    } catch (e: any) {
      toast.error(e.message || "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="Enter code"
        maxLength={6}
        className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-sat-primary uppercase"
      />
      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="bg-sat-primary text-white text-xs px-3 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-40 whitespace-nowrap"
      >
        {submitting ? "Marking..." : "Mark present"}
      </button>
    </form>
  );
};