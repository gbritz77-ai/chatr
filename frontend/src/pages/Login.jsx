// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { postJSON } from "../lib/api";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await postJSON("/auth", form);
      if (res?.success && res?.token) {
        localStorage.setItem("token", res.token);
        localStorage.setItem("username", form.username);
        navigate("/messages");
      } else {
        setError(res?.message || "Login failed. Please check credentials.");
      }
    } catch {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-10 w-full max-w-md">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo/logo.JPG"
            alt="CHATR Logo"
            className="w-48 h-20 object-cover mb-4"
          />
          <h1 className="text-2xl font-semibold text-gray-800">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="username"
              placeholder="you@example.com"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-400 outline-none"
            />
          </div>

          <div className="relative">
            <label className="block text-sm text-gray-700 mb-1">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-sm text-center text-gray-600 mt-5">
          Don’t have an account?{" "}
          <Link
            to="/register"
            className="text-gray-900 font-medium hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
