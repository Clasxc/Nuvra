
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-50 pt-12">
      <h1 className="text-3xl font-bold mb-4">Welcome, {user.email}</h1>
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold mb-2">Your Courses</h2>
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Course cards - placeholders */}
            <div className="bg-sat-primary text-white rounded p-4 flex-1 cursor-pointer hover:bg-sat-secondary" onClick={() => navigate("/courses/SAT")}>SAT</div>
            <div className="bg-blue-600 text-white rounded p-4 flex-1 cursor-pointer hover:bg-blue-700" onClick={() => navigate("/courses/IELTS")}>IELTS</div>
            <div className="bg-green-600 text-white rounded p-4 flex-1 cursor-pointer hover:bg-green-700" onClick={() => navigate("/courses/College")}>College Courses</div>
            <div className="bg-yellow-500 text-white rounded p-4 flex-1 cursor-pointer hover:bg-yellow-600" onClick={() => navigate("/courses/GeneralEnglish")}>General English</div>
            <div className="bg-purple-600 text-white rounded p-4 flex-1 cursor-pointer hover:bg-purple-700" onClick={() => navigate("/courses/BusinessEnglish")}>Business English</div>
            <div className="bg-indigo-600 text-white rounded p-4 flex-1 cursor-pointer hover:bg-indigo-700" onClick={() => navigate("/courses/Programming")}>Programming</div>
          </div>
          <h2 className="text-xl font-semibold mt-8 mb-2">Progress & Tools</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-200 p-4 rounded text-center">Progress Bar (coming soon)</div>
            <div className="bg-gray-200 p-4 rounded text-center">Calendar (coming soon)</div>
            <div className="bg-gray-200 p-4 rounded text-center cursor-pointer">Practice Tests (coming soon)</div>
            <div className="bg-gray-200 p-4 rounded text-center cursor-pointer">Library (coming soon)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
