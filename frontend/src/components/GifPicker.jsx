import { useEffect, useState } from "react";

export default function GifPicker({ onSelect }) {
  const [search, setSearch] = useState("funny");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

  async function fetchGifs(query) {
    if (!API_KEY) {
      console.error("🚨 Missing Giphy API key");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=24&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error("❌ GIF fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGifs(search);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchGifs(search);
  }

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
          <p className="text-center text-slate-400 col-span-3">No GIFs found</p>
        )}
      </div>
    </div>
  );
}
