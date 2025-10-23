import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import logo from "/logo/logo.JPG";

export default function AuthLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-10 w-full max-w-md relative overflow-hidden">
        {/* Floating Logo Section */}
        <div className="flex flex-col items-center mb-6">
          <motion.img
            src={logo}
            alt="ChatConnect Logo"
            className="w-24 h-24 rounded-full shadow-lg mb-3 border border-slate-600"
            animate={{
              y: [0, -8, 0], // gentle up-down motion
            }}
            transition={{
              duration: 4, // 4 seconds for one full float cycle
              repeat: Infinity, // loops forever
              ease: "easeInOut",
            }}
          />
          <h1 className="text-3xl font-bold text-white">ChatConnect</h1>
          <p className="text-slate-400 text-sm">Professional Messaging</p>
        </div>

        {/* Fade transitions for login/register */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
