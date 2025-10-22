// src/pages/Register.jsx
import { useState } from "react";
import { postJSON } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await postJSON("/auth/register", { username, password });
      if (res.success) {
        setMessage("Registration successful! Redirecting...");
        setTimeout(() => navigate("/login"), 1000);
      } else {
        setMessage(res.message || "Registration failed");
      }
    } catch (err) {
      setMessage("Server error: " + err.message);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-800">
      <div className="bg-white shadow-lg rounded-xl p-10 w-[400px]">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white grid place-items-center text-lg font-semibold">CR</div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Create your CHATr account</h1>
        <p className="text-center text-slate-500 mb-8">Professional Messaging</p>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-medium">
            Register
          </button>
        </form>

        {message && <p className="text-center mt-4 text-blue-600 text-sm">{message}</p>}

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
