"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Coins, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.error || "Login gagal");
        return;
      }
      router.replace(data.user?.role === "OWNER" ? "/dashboard" : "/pos");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(u: string, p: string) {
    setUsername(u);
    setPassword(p);
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-sm p-7 space-y-6 shadow-sm animate-page-enter">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/25 shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-900">
              Laundry Tricoins
            </span>
          </div>
          <p className="text-sm text-slate-500">Masuk sebagai Kasir atau Owner</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2.5 rounded-sm flex items-center gap-2 animate-content-swap">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              placeholder="kasir / owner"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Tampilkan password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm py-2.5 px-4 rounded-sm shadow-sm shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? "Memproses..." : "Masuk"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fillCredentials("owner", "owner123")}
            className="px-3 py-2 rounded-sm border border-slate-200 hover:bg-slate-50 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-semibold text-slate-900">Owner</div>
            <div className="text-[11px] font-mono text-slate-500">owner123</div>
          </button>
          <button
            type="button"
            onClick={() => fillCredentials("kasir", "kasir123")}
            className="px-3 py-2 rounded-sm border border-slate-200 hover:bg-slate-50 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-semibold text-slate-900">Kasir</div>
            <div className="text-[11px] font-mono text-slate-500">kasir123</div>
          </button>
        </div>
      </div>
    </div>
  );
}
