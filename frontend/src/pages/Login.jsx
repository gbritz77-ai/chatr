// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { postJSON } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await postJSON("/auth", { username, password });

      if (res?.token) {
        // ✅ Store user session info
        localStorage.setItem("token", res.token);
        localStorage.setItem("username", username);

        setSuccess(true);
        setMessage("Login successful!");

        // ✅ Redirect after 1s delay (smooth transition)
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-slate-800">
          CHATr Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 font-semibold rounded-lg transition ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

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
