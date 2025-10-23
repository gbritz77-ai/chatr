import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { postJSON, getJSON } from "../lib/api";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ============================================================
     🔑 Handle Login
  ============================================================ */
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await postJSON("/auth", { username, password });

      if (res?.token) {
        // ✅ Store token + username
        localStorage.setItem("token", res.token);
        localStorage.setItem("username", username);

        // ✅ Fetch profile name automatically
        const membersRes = await getJSON("/members");
        const member = membersRes?.members?.find(
          (m) => m.userid?.toLowerCase() === username.toLowerCase()
        );
        if (member?.profileName)
          localStorage.setItem("profileName", member.profileName);

        setSuccess(true);
        setMessage("Login successful!");

        // Redirect after short delay
        setTimeout(() => navigate("/messages", { replace: true }), 1000);
      } else {
        setMessage("Invalid username or password");
        setSuccess(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setMessage("Login failed. Please try again.");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     🖼️ UI
  ============================================================ */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md border border-slate-200">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 mb-6">
          <div className="bg-blue-600 p-3 rounded-full text-white">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-700">Welcome Back</h1>
          <p className="text-sm text-slate-500">Sign in to ChatConnect</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 text-sm"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-[34px] text-slate-500 hover:text-slate-700"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 font-semibold rounded-lg transition text-white ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 text-sm text-center font-medium ${
              success ? "text-green-600" : "text-red-600"
            }`}
          >
            {success ? "✅ " : "❌ "}
            {message}
          </div>
        )}

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-slate-500">
          Don’t have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 font-medium hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
