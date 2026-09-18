"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell, Badge } from "../../../components";
import { statusOf, fmt } from "@/lib/supabase-helpers";
import { PlusCircle, ChevronLeft, X, Folder, FolderPlus, FileText, Trash2, Upload, Pencil, ExternalLink, AlertTriangle } from "lucide-react";

export default function RecordDetail() {
  const router = useRouter();
  const { typeId, recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addDocFor, setAddDocFor] = useState(null); // { categoryId, categoryName }
  const [editDoc, setEditDoc] = useState(null); // the doc object being edited
  const [editCategory, setEditCategory] = useState(null); // the category object being edited
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'category'|'document', id, label }

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
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

  const renameCategory = async (id, name) => {
    await supabase.from("document_categories").update({ name }).eq("id", id);
    setEditCategory(null); load();
  };

  const performDelete = async () => {
    if (confirmDelete.type === "category") {
      await supabase.from("document_categories").delete().eq("id", confirmDelete.id);
    } else {
      // clean up the stored file first, if any, so it doesn't sit orphaned in storage
      if (confirmDelete.filePath) await supabase.storage.from("documents").remove([confirmDelete.filePath]);
      await supabase.from("documents").delete().eq("id", confirmDelete.id);
    }
    setConfirmDelete(null);
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
                <div className="flex items-center gap-2 flex-1">
                  <Folder size={14} color="#9CA3AF" />
                  {editCategory === c.id ? (
                    <CategoryRenameInline initial={c.name} onSave={(name) => renameCategory(c.id, name)} onCancel={() => setEditCategory(null)} />
                  ) : (
                    <h3 className="text-sm font-medium" style={{ color: "#16232E" }}>{c.name}</h3>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAddDocFor({ categoryId: c.id, categoryName: c.name })}
                    className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: "#D9A44120", color: "#8A5D00" }}>
                    <PlusCircle size={12} /> Add document
                  </button>
                  {editCategory !== c.id && (
                    <button onClick={() => setEditCategory(c.id)} className="text-gray-300 hover:text-gray-600 transition"><Pencil size={13} /></button>
                  )}
                  <button onClick={() => setConfirmDelete({ type: "category", id: c.id, label: c.name })} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
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
                          <button onClick={() => setEditDoc(d)} className="text-gray-300 hover:text-gray-600 transition"><Pencil size={13} /></button>
                          <button onClick={() => setConfirmDelete({ type: "document", id: d.id, label: d.name, filePath: d.file_path })} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
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
        <AddDocModal categoryId={addDocFor.categoryId} categoryName={addDocFor.categoryName} recordName={record?.name}
          onClose={() => setAddDocFor(null)} onSaved={load} orgIdFn={orgId} />
      )}

      {editDoc && (
        <EditDocModal doc={editDoc} recordName={record?.name} onClose={() => setEditDoc(null)} onSaved={load} orgIdFn={orgId} />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          label={confirmDelete.label}
          type={confirmDelete.type}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={performDelete}
        />
      )}
    </Shell>
  );
}

function CategoryRenameInline({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)}
        className="text-sm border rounded-lg px-2 py-1 outline-none flex-1" style={{ borderColor: "#D9A441" }}
        onKeyDown={(e) => e.key === "Enter" && value && onSave(value)} />
      <button onClick={() => value && onSave(value)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>Save</button>
      <button onClick={onCancel}><X size={14} color="#9CA3AF" /></button>
    </div>
  );
}

function ConfirmDeleteModal({ label, type, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} color="#B3261E" /><h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Delete {type}?</h3></div>
        <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
          "{label}" will be permanently deleted{type === "category" ? ", including every document inside it" : ""}. This can't be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#B3261E", color: "white" }}>Delete</button>
        </div>
      </div>
    </div>
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
    await supabase.from("documents").insert({ name, category_id: categoryId, org_id, expiry_date: noExpiry ? null : expiry, file_path });
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

function EditDocModal({ doc, recordName, onClose, onSaved, orgIdFn }) {
  const [name, setName] = useState(doc.name);
  const [expiry, setExpiry] = useState(doc.expiry_date ? doc.expiry_date.slice(0, 10) : "");
  const [noExpiry, setNoExpiry] = useState(!doc.expiry_date);
  const [newFile, setNewFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publicUrl, setPublicUrl] = useState(null);

  useEffect(() => {
    if (doc.file_path) {
      supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600).then(({ data }) => {
        if (data) setPublicUrl(data.signedUrl);
      });
    }
  }, [doc.file_path]);

  const submit = async () => {
    if (!name || (!expiry && !noExpiry)) return;
    setSaving(true);
    const org_id = await orgIdFn();
    let file_path = doc.file_path;

    if (newFile) {
      // replace the old file: upload new, remove old, so storage doesn't accumulate orphaned files
      const path = `${org_id}/${doc.id}/${Date.now()}_${newFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, newFile);
      if (!uploadErr) {
        if (doc.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
        file_path = path;
      }
    }

    await supabase.from("documents").update({ name, expiry_date: noExpiry ? null : expiry, file_path }).eq("id", doc.id);
    setSaving(false);
    onSaved();
    onClose();
  };

  const removeFile = async () => {
    if (doc.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").update({ file_path: null }).eq("id", doc.id);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(22,35,46,0.45)" }}>
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-base" style={{ color: "#16232E" }}>Edit document</h3>
          <button onClick={onClose}><X size={18} color="#9CA3AF" /></button>
        </div>
        <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>On <b style={{ color: "#16232E" }}>{recordName}</b></p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>Document name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
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
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>Attached file</label>
            {doc.file_path && !newFile ? (
              <div className="mt-1 flex items-center justify-between border rounded-lg px-3 py-2" style={{ borderColor: "#E4E2D8" }}>
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1.5" style={{ color: "#B5750A" }}>
                    <ExternalLink size={12} /> View current file
                  </a>
                ) : <span className="text-xs" style={{ color: "#9CA3AF" }}>Loading link…</span>}
                <button onClick={removeFile} className="text-xs" style={{ color: "#B3261E" }}>Remove</button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 border border-dashed rounded-lg py-4 text-xs cursor-pointer" style={{ borderColor: "#D9A441", color: "#B5750A" }}>
                <Upload size={14} />{newFile?.name || "No file attached — click to upload"}
                <input type="file" className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: "#E4E2D8", color: "#4B5563" }}>Cancel</button>
          <button disabled={saving} onClick={submit} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#16232E", color: "white" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
