"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite"); // preserved so "No account? Sign up" carries it forward

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  };

  const sendResetEmail = async () => {
    if (!email) {
      setError("Enter your email above first, then click 'Forgot password?'");
      return;
    }
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setResetSent(true);
  };

  const signupHref = inviteCode ? `/signup?invite=${inviteCode}` : "/signup";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F5F1" }}>
      <div className="bg-white rounded-xl border p-8 w-full max-w-sm" style={{ borderColor: "#E4E2D8", borderTop: "4px solid #16232E" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "#D9A441" }}>
            <ShieldCheck size={18} color="#16232E" />
          </div>
          <span className="font-semibold text-lg" style={{ color: "#16232E" }}>Meyaad</span>
        </div>
        <h1 className="text-lg font-semibold" style={{ color: "#16232E" }}>Log in</h1>
        <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Welcome back — enter your details below.</p>

        {resetSent ? (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#E7F3ED", color: "#1F6B4A" }}>
            Password reset link sent to {email} — check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
            <div className="flex justify-end">
              <button type="button" onClick={sendResetEmail} className="text-xs" style={{ color: "#B5750A" }}>Forgot password?</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        )}

        <p className="text-xs mt-4 text-center" style={{ color: "#6B7280" }}>
          No account? <a href={signupHref} className="underline" style={{ color: "#B5750A" }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}
