import { useState } from "react";
import { postJSON, getJSON } from "../lib/api";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

/* ============================================================
   🧾 Register Page
============================================================ */
export default function Register() {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /* ============================================================
     ✅ Check if profileName is available
  ============================================================ */
  async function checkProfileName(name) {
    if (!name.trim()) {
      setNameAvailable(null);
      return;
    }

    setCheckingName(true);
    try {
      const res = await getJSON("/members");
      const taken = res?.members?.some(
        (m) => m.profileName?.toLowerCase() === name.trim().toLowerCase()
      );
      setNameAvailable(!taken);
    } catch (err) {
      console.error("❌ Failed to check profile name:", err);
    } finally {
      setCheckingName(false);
    }
  }

  /* ============================================================
     🧩 Handle Register Submit
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username || !password || !confirmPassword || !profileName)
      return setError("Please fill in all required fields.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username))
      return setError("Please enter a valid email address.");

    if (password !== confirmPassword)
      return setError("Passwords do not match.");

    if (nameAvailable === false)
      return setError("That profile name is already in use.");

    setLoading(true);
    try {
      const res = await postJSON("/register", {
        username,
        password,
        confirmPassword,
        profileName,
      });

      if (!res.success) throw new Error(res.message || "Registration failed");

      // Store token + profile name for session
      localStorage.setItem("token", res.token);
      localStorage.setItem("username", res.username);
      localStorage.setItem("profileName", res.profileName);

      navigate("/messages");
    } catch (err) {
      console.error("❌ Registration error:", err);
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     🖼️ UI
  ============================================================ */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-white shadow-lg rounded-xl w-full max-w-md p-8 space-y-6 border border-slate-200">
        <div className="flex flex-col items-center space-y-2">
          <div className="bg-blue-600 p-3 rounded-full text-white">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-700">Create Account</h1>
          <p className="text-sm text-slate-500">Join ChatConnect today</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-600 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Profile Name */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Profile Name
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="e.g. Gerhard Britz"
              value={profileName}
              onChange={(e) => {
                setProfileName(e.target.value);
                checkProfileName(e.target.value);
              }}
            />
            {checkingName ? (
              <p className="text-xs text-slate-400 mt-1">Checking availability…</p>
            ) : nameAvailable === false ? (
              <p className="text-xs text-red-500 mt-1">Name already taken</p>
            ) : nameAvailable === true ? (
              <p className="text-xs text-emerald-600 mt-1">Name available ✓</p>
            ) : null}
          </div>

          {/* Password */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {/* Confirm Password */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((p) => !p)}
              className="absolute right-3 top-[34px] text-slate-500 hover:text-slate-700"
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-lg text-white font-semibold transition ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
