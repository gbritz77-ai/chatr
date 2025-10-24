import { useState, useEffect } from "react";

export default function GifPicker({ onSelect }) {
  const [gifs, setGifs] = useState([]);
  const [query, setQuery] = useState("funny");
  const [loading, setLoading] = useState(false);

  const API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

  useEffect(() => {
    if (!API_KEY) return;
    async function load() {
      setLoading(true);
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=15&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
      setLoading(false);
    }
    load();
  }, [query]);

  return (
    <div className="absolute bottom-20 left-20 z-50 bg-white border rounded-lg shadow-xl w-80 p-3 max-h-80 overflow-y-auto">
      <input
        type="text"
        placeholder="Search GIFs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full text-sm border rounded-md px-2 py-1 mb-2"
      />
      {loading && <p className="text-center text-slate-400 text-sm">Loading...</p>}
      <div className="grid grid-cols-3 gap-2">
        {gifs.map((gif) => (
          <img
            key={gif.id}
            src={gif.images.fixed_height_small.url}
            alt={gif.title}
            className="cursor-pointer rounded hover:opacity-80"
            onClick={() => onSelect(gif.images.original.url)}
          />
        ))}
      </div>
    </div>
  );
}
