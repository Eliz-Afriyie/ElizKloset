"use client";
import FormError from "../../components/FormError";

import { useState, type FormEvent } from "react";
import { inviteStaff, parsers, saveSettings, updateStaff, type Settings, type StaffRecord } from "../lib/resources";
import { useAdminQuery } from "../lib/useAdminQuery";
import { useAdminSession } from "./AdminSession";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";

function SettingsForm({ settings, onSaved, onReload }: { settings: Settings; onSaved: () => void; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    try {
      const contact = Object.fromEntries(["whatsapp", "phone", "email"].map((field) => [field, String(fields.get(field)).trim() || null])) as Settings["contact"];
      await saveSettings(settings, { storeName: String(fields.get("storeName")).trim(), contact });
      setNotice("Store settings saved."); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <form className="admin-form" onSubmit={save}>{error && <FormError className="admin-form-error" >{error} <button type="button" onClick={onReload}>Reload settings</button></FormError>}<fieldset disabled={busy}><legend>Store details</legend><label>Business name<input name="storeName" required maxLength={100} defaultValue={settings.storeName} /></label><label>WhatsApp<input name="whatsapp" type="tel" maxLength={25} defaultValue={settings.contact.whatsapp ?? ""} /></label><label>Phone<input name="phone" type="tel" maxLength={25} defaultValue={settings.contact.phone ?? ""} /></label><label>Business email<input name="email" type="email" maxLength={254} defaultValue={settings.contact.email ?? ""} /></label><dl className="admin-definition"><div><dt>Currency</dt><dd>{settings.currency}</dd></div><div><dt>Business timezone</dt><dd>{settings.timezone}</dd></div></dl>{notice && <p role="status">{notice}</p>}<button className="admin-button" type="submit">{busy ? "Saving..." : "Save settings"}</button></fieldset></form>;
}

function StaffEditor({ staff, onClose, onSaved, onReload }: { staff: StaffRecord | null; onClose: () => void; onSaved: (message: string) => void; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(staff?.status ?? "active");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const role = String(fields.get("role")) as "catalog" | "fulfilment";
    setBusy(true); setError("");
    try {
      if (staff) { await updateStaff(staff, { role, status }); onSaved("Staff access updated."); }
      else { const result = await inviteStaff({ email: String(fields.get("email")).trim(), role }); onSaved(`Invitation created for ${result.email}. Expires ${result.expiresAt.slice(0, 10)}.`); }
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save staff changes."); }
    finally { setBusy(false); }
  }
  return <AdminDialog title={staff ? "Edit staff access" : "Invite staff member"} busy={busy} onClose={onClose}><form className="admin-form" onSubmit={save}>{error && <FormError  className="admin-form-error">{error} <button type="button" onClick={onReload}>Reload staff records</button></FormError>}<fieldset disabled={busy}>{staff ? <p>{staff.name || staff.email}<br />{staff.email}</p> : <label>Work email<input name="email" type="email" required maxLength={254} /></label>}<label>Role<select name="role" defaultValue={staff?.role ?? "catalog"}><option value="catalog">Catalog staff</option><option value="fulfilment">Fulfilment staff</option></select></label>{staff && <label>Access<select value={status} onChange={(event) => setStatus(event.target.value as StaffRecord["status"])}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>}{staff?.status === "active" && status === "disabled" && <label className="admin-checkbox"><input type="checkbox" required />Confirm disabling this staff member and ending their sessions.</label>}<button type="submit" className="admin-button">{busy ? "Saving..." : staff ? "Save access" : "Send invitation"}</button></fieldset></form></AdminDialog>;
}

function StaffManagement() {
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ staff: StaffRecord | null } | null>(null);
  const [notice, setNotice] = useState("");
  const query = useAdminQuery(`staff?page=${page}&pageSize=8`, parsers.staff);
  return <section className="admin-card"><div className="admin-card-heading"><h2>Staff & permissions</h2><button className="admin-button" onClick={() => setEditor({ staff: null })}>Invite staff</button></div>{notice && <p className="admin-notice" role="status">{notice}</p>}<ApiStatus variant="table" loading={query.loading} error={query.error} retry={query.refresh} />
    {query.data && !query.loading && <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>MFA</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((member) => <tr key={member.id}><td>{member.name || member.email}<small>{member.email}</small></td><td>{member.role}</td><td>{member.status}</td><td>{member.mfaEnabled ? "Enabled" : "Not enabled"}</td><td>{["catalog", "fulfilment"].includes(member.role) ? <button className="admin-text-button" onClick={() => setEditor({ staff: member })}>Edit access</button> : <span>Owner managed</span>}</td></tr>)}</tbody></table>{!query.data.data.length && <p className="admin-empty">No staff records found.</p>}</div><ApiPagination page={page} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} loading={query.loading} onChange={setPage} /></>}
    {editor && <StaffEditor staff={editor.staff} onClose={() => setEditor(null)} onReload={() => { setEditor(null); query.refresh(); }} onSaved={(message) => { setNotice(message); query.refresh(); }} />}
  </section>;
}

export default function AdminSettings() {
  const { staff } = useAdminSession();
  const canSettings = !!staff?.permissions.includes("settings:write");
  const canStaff = !!staff?.permissions.includes("staff:manage");
  const query = useAdminQuery(canSettings ? "settings" : null, parsers.settings);
  const [notice, setNotice] = useState("");
  return <>{notice && <p role="status" className="admin-notice">{notice}</p>}{canSettings && <><ApiStatus variant="form" loading={query.loading} error={query.error} retry={query.refresh} />{query.data && !query.loading && <div className="admin-settings-grid"><section className="admin-card"><SettingsForm key={query.data.version} settings={query.data} onSaved={() => { setNotice("Store settings saved."); query.refresh(); }} onReload={query.refresh} /></section><section className="admin-card"><h2>Connections</h2><dl className="admin-definition">{query.data.connections.map((connection) => <div key={connection.service}><dt>{connection.service}</dt><dd>{connection.status}</dd></div>)}</dl></section></div>}</>}{canStaff && <StaffManagement />}</>;
}
