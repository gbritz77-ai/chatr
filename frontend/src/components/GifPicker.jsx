import { useEffect, useState } from "react";

export default function GifPicker({ onSelect }) {
  const [search, setSearch] = useState("funny");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Giphy API Key from .env
  const API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

  // ======================================================
  // 🧠 Fetch GIFs (either search or trending fallback)
  // ======================================================
  async function fetchGifs(query) {
    if (!API_KEY) {
      console.error("🚨 Missing Giphy API key — check your .env file!");
      setGifs([]);
      return;
    }

    setLoading(true);

    try {
      // If there's no search query, load trending GIFs
      const endpoint =
        query && query.trim().length > 0
          ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(
              query
            )}&limit=24&rating=g`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=24&rating=g`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!data?.data) throw new Error("No GIF data returned");
      setGifs(data.data);
    } catch (err) {
      console.error("❌ GIF fetch error:", err);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // 🚀 Load trending GIFs initially
  // ======================================================
  useEffect(() => {
    console.log("🔑 Loaded Giphy API key:", API_KEY);
    fetchGifs(search);
  }, []);

  // ======================================================
  // 🔍 Handle search
  // ======================================================
  function handleSearch(e) {
    e.preventDefault();
    fetchGifs(search);
  }

  // ======================================================
  // 🧱 UI
  // ======================================================
  return (
    <div className="absolute bottom-20 left-6 z-50 shadow-xl border rounded-lg bg-white w-[340px] p-3">
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GIFs..."
          className="flex-1 border rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
        {loading ? (
          <p className="text-center text-slate-400 col-span-3">Loading...</p>
        ) : gifs.length ? (
          gifs.map((gif) => (
            <img
              key={gif.id}
              src={gif.images.fixed_width_small.url}
              alt={gif.title}
              className="w-full rounded cursor-pointer hover:opacity-80 transition"
              onClick={() => onSelect(gif.images.original.url)}
            />
          ))
        ) : (
          <p className="text-center text-slate-400 col-span-3">
            No GIFs found
          </p>
        )}
      </div>
    </div>
  );
}
