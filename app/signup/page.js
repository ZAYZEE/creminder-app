"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Signup />
    </Suspense>
  );
}

function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite"); // e.g. /signup?invite=abc123

  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);

  useEffect(() => {
    if (!inviteCode) return;
    (async () => {
      const { data } = await supabase.from("invites").select("org_id, used_by, organizations ( name )").eq("code", inviteCode).single();
      if (data && !data.used_by) setInviteInfo(data);
    })();
  }, [inviteCode]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const metadata = inviteInfo
      ? { invite_code: inviteCode }
      : { org_name: orgName || "My Organization" };

    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F5F1" }}>
      <div className="bg-white rounded-xl border p-8 w-full max-w-sm" style={{ borderColor: "#E4E2D8", borderTop: "4px solid #D9A441" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "#D9A441" }}>
            <ShieldCheck size={18} color="#16232E" />
          </div>
          <span className="font-semibold text-lg" style={{ color: "#16232E" }}>Meyaad</span>
        </div>

        {inviteCode && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: inviteInfo ? "#E7F3ED" : "#FBEAE9", color: inviteInfo ? "#1F6B4A" : "#B3261E" }}>
            {inviteInfo
              ? `You're joining ${inviteInfo.organizations?.name || "an existing organization"}`
              : "This invite link is invalid or already used — you'll create a new organization instead."}
          </div>
        )}

        <h1 className="text-lg font-semibold" style={{ color: "#16232E" }}>
          {inviteInfo ? "Join your team" : "Create your account"}
        </h1>
        <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
          {inviteInfo ? "Set your own email and password to get started." : "New here — let's get you set up."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {!inviteInfo && (
            <input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
          )}
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
          <input type="password" required placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
            {loading ? "Creating…" : inviteInfo ? "Join team" : "Create account"}
          </button>
        </form>
        <p className="text-xs mt-4 text-center" style={{ color: "#6B7280" }}>
          Already have an account? <a href="/login" className="underline" style={{ color: "#B5750A" }}>Log in</a>
        </p>
      </div>
    </div>
  );
}
