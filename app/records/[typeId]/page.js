"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell, Badge } from "../../components";
import { statusOf } from "@/lib/supabase-helpers";
import { PlusCircle, ChevronLeft, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function RecordsOfType() {
  const router = useRouter();
  const { typeId } = useParams();
  const [type, setType] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [editRecord, setEditRecord] = useState(null); // { id, name }
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name, catCount }

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    const { data: t } = await supabase.from("record_types").select("id, name").eq("id", typeId).single();
    setType(t);
    const { data: r } = await supabase
      .from("records")
      .select("id, name, document_categories ( id, documents ( id, expiry_date ) )")
      .eq("type_id", typeId)
      .order("created_at");
    setRecords(r || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [typeId]);

  const addRecord = async () => {
    if (!name) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data: member } = await supabase.from("org_members").select("org_id").eq("user_id", session.user.id).single();
    const { data: newRec, error } = await supabase.from("records").insert({ name, type_id: typeId, org_id: member.org_id }).select().single();
    if (error) { alert("Couldn't add this — your trial may have ended. Check the banner above to upgrade."); return; }
    setName(""); setShowAdd(false);
    router.push(`/records/${typeId}/${newRec.id}`);
  };

  const renameRecord = async (id, newName) => {
    await supabase.from("records").update({ name: newName }).eq("id", id);
    setEditRecord(null); load();
  };

  const deleteRecord = async () => {
    await supabase.from("records").delete().eq("id", confirmDelete.id);
    setConfirmDelete(null); load();
  };

  return (
    <Shell title={type?.name || "…"} subtitle="Every record here holds its own document categories and documents.">
      <button onClick={() => router.push("/records")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#6B7280" }}>
        <ChevronLeft size={14} /> Back to record types
      </button>

      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading…</p>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium" style={{ backgroundColor: "#D9A441", color: "#16232E" }}>
            <PlusCircle size={15} /> Add {type?.name?.toLowerCase()} record
          </button>
          <div className="grid grid-cols-2 gap-3">
            {records.map((r) => {
              const docCount = r.document_categories?.reduce((s, c) => s + (c.documents?.length || 0), 0) || 0;
              const statuses = r.document_categories?.flatMap((c) => c.documents?.map((d) => statusOf(d.expiry_date))) || [];
              const worst = statuses.includes("expired") ? "expired" : statuses.includes("urgent") ? "urgent" : statuses.includes("soon") ? "soon" : "ok";
              return (
                <div key={r.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition" style={{ borderColor: "#E4E2D8" }}>
                  <div className="flex items-start justify-between">
                    <button onClick={() => router.push(`/records/${typeId}/${r.id}`)} className="text-left flex-1">
                      <div className="text-sm font-medium" style={{ color: "#16232E" }}>{r.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{r.document_categories?.length || 0} categories · {docCount} documents</div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {worst !== "ok" && <Badge status={worst} />}
                      <button onClick={() => setEditRecord({ id: r.id, name: r.name })} className="text-gray-300 hover:text-gray-600 transition"><Pencil size={13} /></button>
                      <button onClick={() => setConfirmDelete({ id: r.id, name: r.name, catCount: r.document_categories?.length || 0 })} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {records.length === 0 && <div className="col-span-2 text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>No {type?.name?.toLowerCase()} records yet.</div>}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Add a {type?.name?.toLowerCase()} record</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>A specific one — a name you'd recognize.</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Sharma, or Patrol Van 2…"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }}
              onKeyDown={(e) => e.key === "Enter" && addRecord()} />
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={addRecord} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Create & continue</button>
            </div>
          </div>
        </div>
      )}

      {editRecord && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Rename record</h3>
              <button onClick={() => setEditRecord(null)}><X size={18} color="#9CA3AF" /></button>
            </div>
            <input autoFocus value={editRecord.name} onChange={(e) => setEditRecord({ ...editRecord, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }}
              onKeyDown={(e) => e.key === "Enter" && editRecord.name && renameRecord(editRecord.id, editRecord.name)} />
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditRecord(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={() => editRecord.name && renameRecord(editRecord.id, editRecord.name)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} color="#B3261E" /><h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Delete record?</h3></div>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              "{confirmDelete.name}" will be permanently deleted{confirmDelete.catCount > 0 ? ", including all its document categories and documents" : ""}. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
              <button onClick={deleteRecord} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#B3261E", color: "white" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
