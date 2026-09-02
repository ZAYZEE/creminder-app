"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shell, Badge } from "../components";
import { statusOf, fmt } from "@/lib/supabase-helpers";
import { AlertTriangle, Clock, Bell, Check, ChevronRight } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      // Pull every document with its parent category/record/type names in one query
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id, name, expiry_date,
          document_categories ( name, records ( id, name, record_types ( id, name ) ) )
        `);

      if (!error && data) {
        setDocs(
          data.map((d) => ({
            id: d.id,
            name: d.name,
            expiry: d.expiry_date,
            status: statusOf(d.expiry_date),
            categoryName: d.document_categories?.name,
            recordId: d.document_categories?.records?.id,
            recordName: d.document_categories?.records?.name,
            typeId: d.document_categories?.records?.record_types?.id,
            typeName: d.document_categories?.records?.record_types?.name,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  const counts = docs.reduce(
    (c, d) => ({ ...c, [d.status]: (c[d.status] || 0) + 1 }),
    { expired: 0, urgent: 0, soon: 0, ok: 0 }
  );

  const urgent = docs
    .filter((d) => d.status === "expired" || d.status === "urgent")
    .sort((a, b) => new Date(a.expiry || "9999-12-31") - new Date(b.expiry || "9999-12-31"))
    .slice(0, 8);

  const StatCard = ({ label, value, color, bg, icon }) => (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: bg }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white">{icon}</div>
      <div>
        <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
        <div className="text-xs" style={{ color }}>{label}</div>
      </div>
    </div>
  );

  return (
    <Shell title="Dashboard" subtitle={loading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""} tracked`}>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Expired" value={counts.expired} color="#B3261E" bg="#FBEAE9" icon={<AlertTriangle size={17} color="#B3261E" />} />
          <StatCard label="Expiring soon" value={counts.urgent} color="#B5750A" bg="#FBF1DF" icon={<Clock size={17} color="#B5750A" />} />
          <StatCard label="Coming up" value={counts.soon} color="#8A6D00" bg="#FAF6E0" icon={<Bell size={17} color="#8A6D00" />} />
          <StatCard label="On track" value={counts.ok} color="#1F6B4A" bg="#E7F3ED" icon={<Check size={17} color="#1F6B4A" />} />
        </div>

        <div className="bg-white rounded-xl border" style={{ borderColor: "#E4E2D8" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E4E2D8" }}>
            <h2 className="font-medium text-sm" style={{ color: "#16232E" }}>Needs attention now</h2>
            <button onClick={() => router.push("/records")} className="text-xs flex items-center gap-1" style={{ color: "#B5750A" }}>
              View all records <ChevronRight size={13} />
            </button>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Loading…</div>
          ) : urgent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "#6B7280" }}>
              {docs.length === 0 ? "No documents yet — add your first record to get started." : "Nothing urgent right now — you're on top of it."}
            </div>
          ) : (
            <ul>
              {urgent.map((d) => (
                <li key={d.id} onClick={() => router.push(`/records/${d.typeId}/${d.recordId}`)}
                  className="flex items-center justify-between px-5 py-3.5 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition" style={{ borderColor: "#F0EFE9" }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#16232E" }}>{d.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{d.typeName} · {d.recordName} · {d.categoryName}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "#6B7280" }}>{d.expiry ? fmt(d.expiry) : "—"}</span>
                    <Badge status={d.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
