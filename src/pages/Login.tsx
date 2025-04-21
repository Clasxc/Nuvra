
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <form onSubmit={handleLogin} className="bg-white shadow-md rounded-lg p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
        <Input
          type="email"
          placeholder="Your email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
          className="mb-4"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={e => setPassword(e.target.value)}
          className="mb-4"
        />
        {error && <div className="text-red-600 mb-2 text-center">{error}</div>}
        <Button type="submit" className="w-full bg-sat-primary">Sign In</Button>
        <p className="mt-4 text-center">
          New?{" "}
          <span
            onClick={() => navigate("/signup")}
            className="text-blue-600 underline cursor-pointer"
          >Create account</span>
        </p>
      </form>
    </div>
  );
};

export default Login;
