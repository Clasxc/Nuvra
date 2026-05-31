// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { login, setToken } from "@/lib/api";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If user was redirected here from a protected page, send them back after login
  const from = (location.state as any)?.from || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await login(email, password);
      setToken(data.access_token);
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed. Check your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sat-primary mb-2">Welcome back</h1>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sat-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sat-primary focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-sat-primary text-white rounded-lg font-semibold hover:bg-sat-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-sat-primary font-medium hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;