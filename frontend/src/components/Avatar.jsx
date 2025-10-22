import React from "react";

/**
 * Modern chat avatar with initials, color circle, and online indicator
 */
export function Avatar({ name = "?", online = false, size = 10 }) {
  const initials = name
    .split(/[ ._-]/)
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  // Generate a consistent color for the user
  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.floor(Math.abs(Math.sin(hash) * 16777215) % 16777215)
      .toString(16)
      .padStart(6, "0");
    return `#${color}`;
  }

  const bg = stringToColor(name);

  return (
    <div className="relative flex-shrink-0">
      <div
        className="rounded-full flex items-center justify-center text-white font-semibold"
        style={{
          backgroundColor: bg,
          width: `${size * 4}px`,
          height: `${size * 4}px`,
          fontSize: `${size * 1.4}px`,
        }}
      >
        {initials}
      </div>
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${
          online ? "bg-green-500" : "bg-gray-400"
        }`}
      />
    </div>
  );
}
