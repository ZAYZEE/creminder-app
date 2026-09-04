"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F5F1" }}>
      <div className="bg-white rounded-xl border p-8 w-full max-w-sm" style={{ borderColor: "#E4E2D8", borderTop: "4px solid #16232E" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "#D9A441" }}>
            <ShieldCheck size={18} color="#16232E" />
          </div>
          <span className="font-semibold text-lg" style={{ color: "#16232E" }}>Meyaad</span>
        </div>
        <h1 className="text-lg font-semibold mb-4" style={{ color: "#16232E" }}>Set a new password</h1>

        {done ? (
          <div>
            <p className="text-xs px-3 py-2 rounded-lg mb-4" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>
              Password updated. You can log in now.
            </p>
            <button onClick={() => router.push("/login")} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="password" required placeholder="New password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
            <input type="password" required placeholder="Confirm new password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
