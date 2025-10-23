// frontend/src/pages/Register.jsx
import { useState } from "react";
import { postJSON, getJSON } from "../lib/api";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
<img src="/logo/logo.JPG" alt="CHATR Logo" />



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

  /* -------------------------------------------------------
     ✅ Check if profileName already exists
  ------------------------------------------------------- */
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

  /* -------------------------------------------------------
     🧩 Handle Register Submit
  ------------------------------------------------------- */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username || !password || !confirmPassword || !profileName)
      return setError("Please fill in all required fields.");

    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

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
        profileName,
      });

      if (!res.success) throw new Error(res.message || "Registration failed");

      // Save session details
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

  /* -------------------------------------------------------
     🖼️ UI
  ------------------------------------------------------- */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-10 w-full max-w-md">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo/logo.JPG"  // ✅ Correct path for Amplify & Vite
            alt="CHATR Logo"
            className="w-40 h-24 rounded-lg shadow-lg border border-slate-600 mb-3"
          />
      
          <p className="text-slate-400 text-sm">Create your account</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Profile Name */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Profile Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Gerhard Britz"
              value={profileName}
              onChange={(e) => {
                setProfileName(e.target.value);
                checkProfileName(e.target.value);
              }}
              required
            />
            {checkingName ? (
              <p className="text-xs text-slate-400 mt-1">Checking...</p>
            ) : nameAvailable === false ? (
              <p className="text-xs text-red-400 mt-1">Name already taken</p>
            ) : nameAvailable === true ? (
              <p className="text-xs text-emerald-400 mt-1">Name available ✓</p>
            ) : null}
          </div>

          {/* Password */}
          <div className="relative">
            <label className="block text-sm text-slate-300 mb-1">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <label className="block text-sm text-slate-300 mb-1">
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-9 text-slate-400 hover:text-white"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        {/* Footer Link */}
        <p className="text-sm text-center text-slate-400 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
