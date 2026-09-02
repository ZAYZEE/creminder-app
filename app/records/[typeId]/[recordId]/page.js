"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell, Badge } from "../../../components";
import { statusOf, fmt } from "@/lib/supabase-helpers";
import { PlusCircle, ChevronLeft, X, Folder, FolderPlus, FileText, Trash2, Upload } from "lucide-react";

export default function RecordDetail() {
  const router = useRouter();
  const { typeId, recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addDocFor, setAddDocFor] = useState(null); // { categoryId, categoryName }

  const load = async () => {
    const { data: r } = await supabase.from("records").select("id, name, record_types ( name )").eq("id", recordId).single();
    setRecord(r);
    const { data: c } = await supabase
      .from("document_categories")
      .select("id, name, documents ( id, name, expiry_date, file_path )")
      .eq("record_id", recordId)
      .order("created_at");
    setCategories(c || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [recordId]);

  const orgId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: member } = await supabase.from("org_members").select("org_id").eq("user_id", session.user.id).single();
    return member.org_id;
  };

  const addCategory = async () => {
    if (!newCategoryName) return;
    const org_id = await orgId();
    await supabase.from("document_categories").insert({ name: newCategoryName, record_id: recordId, org_id });
    setNewCategoryName(""); setAddingCategory(false); load();
  };

  const removeCategory = async (id) => {
    await supabase.from("document_categories").delete().eq("id", id);
    load();
  };

  const removeDoc = async (id) => {
    await supabase.from("documents").delete().eq("id", id);
    load();
  };

  return (
    <Shell title={record?.name || "…"} subtitle={record?.record_types?.name ? `${record.record_types.name} record` : ""}>
      <button onClick={() => router.push(`/records/${typeId}`)} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#6B7280" }}>
        <ChevronLeft size={14} /> Back to records
      </button>

      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading…</p>
      ) : (
        <div className="space-y-4">
          {categories.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border" style={{ borderColor: "#E4E2D8" }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "#E4E2D8" }}>
                <div className="flex items-center gap-2"><Folder size={14} color="#9CA3AF" /><h3 className="text-sm font-medium" style={{ color: "#16232E" }}>{c.name}</h3></div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAddDocFor({ categoryId: c.id, categoryName: c.name })}
                    className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: "#D9A44120", color: "#8A5D00" }}>
                    <PlusCircle size={12} /> Add document
                  </button>
                  <button onClick={() => removeCategory(c.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
                </div>
              </div>
              {(!c.documents || c.documents.length === 0) ? (
                <div className="px-5 py-6 text-center text-xs" style={{ color: "#9CA3AF" }}>No documents in this category yet.</div>
              ) : (
                <ul>
                  {c.documents.map((d) => {
                    const status = statusOf(d.expiry_date);
                    return (
                      <li key={d.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0" style={{ borderColor: "#F0EFE9" }}>
                        <div className="flex items-center gap-2.5"><FileText size={14} color="#9CA3AF" /><span className="text-sm" style={{ color: "#16232E" }}>{d.name}</span></div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "#6B7280" }}>{d.expiry_date ? fmt(d.expiry_date) : "No expiry"}</span>
                          <Badge status={status} />
                          <button onClick={() => removeDoc(d.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}

          {addingCategory ? (
            <div className="bg-white rounded-xl border p-4 flex items-center gap-2" style={{ borderColor: "#D9A441" }}>
              <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. License, Certification, Insurance…"
                className="flex-1 text-sm outline-none border rounded-lg px-3 py-2" style={{ borderColor: "#E4E2D8" }}
                onKeyDown={(e) => e.key === "Enter" && addCategory()} />
              <button onClick={addCategory} className="text-xs px-3 py-2 rounded-lg font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Create category</button>
              <button onClick={() => setAddingCategory(false)}><X size={16} color="#9CA3AF" /></button>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)} className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3.5 text-sm" style={{ borderColor: "#D9A441", color: "#B5750A" }}>
              <FolderPlus size={15} /> Add a document category for this record
            </button>
          )}
        </div>
      )}

      {addDocFor && (
        <AddDocModal
          categoryId={addDocFor.categoryId}
          categoryName={addDocFor.categoryName}
          recordName={record?.name}
          onClose={() => setAddDocFor(null)}
          onSaved={load}
          orgIdFn={orgId}
        />
      )}
    </Shell>
  );
}

function AddDocModal({ categoryId, categoryName, recordName, onClose, onSaved, orgIdFn }) {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name || (!expiry && !noExpiry)) return;
    setSaving(true);
    const org_id = await orgIdFn();
    let file_path = null;

    if (file) {
      const path = `${org_id}/${categoryId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (!uploadErr) file_path = path;
    }

    await supabase.from("documents").insert({
      name, category_id: categoryId, org_id,
      expiry_date: noExpiry ? null : expiry,
      file_path,
    });

    setSaving(false);
    setName(""); setExpiry(""); setNoExpiry(false); setFile(null);
    onSaved();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Add a document</h3>
          <button onClick={onClose}><X size={18} color="#9CA3AF" /></button>
        </div>
        <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>Adding to <b style={{ color: "#16232E" }}>{recordName}</b> → <b style={{ color: "#16232E" }}>{categoryName}</b></p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>Document name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Medical Fitness Certificate"
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: "#E4E2D8" }} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: "#6B7280" }}>Expiry date</label>
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
                <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} /> Doesn't expire
              </label>
            </div>
            <input type="date" value={expiry} disabled={noExpiry} onChange={(e) => setExpiry(e.target.value)}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40" style={{ borderColor: "#E4E2D8" }} />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>Attach file (optional)</label>
            <label className="mt-1 flex items-center justify-center gap-2 border border-dashed rounded-lg py-4 text-xs cursor-pointer" style={{ borderColor: "#D9A441", color: "#B5750A" }}>
              <Upload size={14} />{file?.name || "Click to upload document"}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Done</button>
          <button disabled={saving} onClick={submit} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
            {saving ? "Saving…" : "Save & add another"}
          </button>
        </div>
      </div>
    </div>
  );
}
