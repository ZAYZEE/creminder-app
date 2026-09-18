"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell } from "../components";
import { PlusCircle, Folder, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function RecordTypes() {
  const router = useRouter();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [editType, setEditType] = useState(null); // { id, name }
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name, recordCount }

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
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

  const renameType = async (id, newName) => {
    await supabase.from("record_types").update({ name: newName }).eq("id", id);
    setEditType(null); load();
  };

  const deleteType = async () => {
    await supabase.from("record_types").delete().eq("id", confirmDelete.id);
    setConfirmDelete(null); load();
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
                <div key={t.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition" style={{ borderColor: "#E4E2D8" }}>
                  <div className="flex items-start justify-between">
                    <button onClick={() => router.push(`/records/${t.id}`)} className="flex items-center gap-3 flex-1 text-left">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#16232E10" }}><Folder size={18} color="#16232E" /></div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "#16232E" }}>{t.name}</div>
                        <div className="text-xs" style={{ color: "#9CA3AF" }}>{recordCount} record{recordCount !== 1 ? "s" : ""} · {docCount} doc{docCount !== 1 ? "s" : ""}</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditType({ id: t.id, name: t.name })} className="text-gray-300 hover:text-gray-600 transition"><Pencil size={13} /></button>
                      <button onClick={() => setConfirmDelete({ id: t.id, name: t.name, recordCount })} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
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

      {editType && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Rename record type</h3>
              <button onClick={() => setEditType(null)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <input autoFocus value={editType.name} onChange={(e) => setEditType({ ...editType, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }}
              onKeyDown={(e) => e.key === "Enter" && editType.name && renameType(editType.id, editType.name)} />
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditType(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={() => editType.name && renameType(editType.id, editType.name)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} color="#B3261E" /><h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Delete record type?</h3></div>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              "{confirmDelete.name}" will be permanently deleted{confirmDelete.recordCount > 0 ? `, including all ${confirmDelete.recordCount} record${confirmDelete.recordCount !== 1 ? "s" : ""} inside it and everything tracked under them` : ""}. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={deleteType} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#B3261E", color: "white" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
