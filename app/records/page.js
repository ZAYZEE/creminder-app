"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { PlusCircle, Folder, X } from "lucide-react";

export default function RecordTypes() {
  const router = useRouter();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("record_types")
      .select("id, name, records ( id, document_categories ( id, documents ( id ) ) )")
      .order("created_at");
    setTypes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addType = async () => {
    if (!name) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data: member } = await supabase.from("org_members").select("org_id").eq("user_id", session.user.id).single();
    await supabase.from("record_types").insert({ name, org_id: member.org_id });
    setName(""); setShowAdd(false); load();
  };

  return (
    <Shell title="Record types" subtitle="A record type groups similar things you track — a role, an asset category, anything.">
      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading…</p>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium" style={{ backgroundColor: "#D9A441", color: "#16232E" }}>
            <PlusCircle size={15} /> Add record type
          </button>
          <div className="grid grid-cols-3 gap-3">
            {types.map((t) => {
              const recordCount = t.records?.length || 0;
              const docCount = t.records?.reduce((s, r) => s + (r.document_categories?.reduce((s2, c) => s2 + (c.documents?.length || 0), 0) || 0), 0) || 0;
              return (
                <button key={t.id} onClick={() => router.push(`/records/${t.id}`)} className="bg-white rounded-xl border p-4 text-left hover:shadow-sm transition" style={{ borderColor: "#E4E2D8" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#16232E10" }}><Folder size={18} color="#16232E" /></div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#16232E" }}>{t.name}</div>
                      <div className="text-xs" style={{ color: "#9CA3AF" }}>{recordCount} record{recordCount !== 1 ? "s" : ""} · {docCount} doc{docCount !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {types.length === 0 && <div className="col-span-3 text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No record types yet — add your first one.</div>}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Add a record type</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>e.g. "Doctor", "Vehicle", "Guard" — type it however you think of it.</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Doctor, Vehicle, Premises…"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }}
              onKeyDown={(e) => e.key === "Enter" && addType()} />
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={addType} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
