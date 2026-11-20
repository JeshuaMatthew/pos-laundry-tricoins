"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Edit2,
  Eye,
  EyeOff,
  MoreVertical,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatDateTime } from "@/lib/format";

interface UserRecord {
  id: string;
  name: string;
  username: string;
  role: "OWNER" | "CASHIER";
  isActive: boolean;
  createdAt: string;
}

type RoleFilter = "ALL" | "CASHIER" | "OWNER";

async function parseJsonSafe(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserRecord | null>(null);

  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<"OWNER" | "CASHIER">("CASHIER");
  const [formIsActive, setFormIsActive] = useState(true);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal memuat pengguna");
      setUsers(data.users || []);
      if (data.currentUserId) setCurrentUserId(data.currentUserId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat pengguna.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/users", { cache: "no-store" })
      .then(async (res) => {
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal memuat pengguna");
        return data;
      })
      .then((data) => {
        if (active) {
          setUsers(data.users || []);
          if (data.currentUserId) setCurrentUserId(data.currentUserId);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          toast.error(err instanceof Error ? err.message : "Gagal memuat pengguna.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const ownerCount = useMemo(
    () => users.filter((u) => u.role === "OWNER").length,
    [users]
  );

  const activeOwnerCount = useMemo(
    () => users.filter((u) => u.role === "OWNER" && u.isActive).length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  function openCreateModal() {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("CASHIER");
    setFormIsActive(true);
    setModalError("");
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  function openEditModal(u: UserRecord) {
    setEditingUser(u);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword("");
    setShowPassword(false);
    setFormRole(u.role);
    setFormIsActive(u.isActive);
    setModalError("");
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError("");

    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            username: formUsername.trim().toLowerCase(),
            role: formRole,
            isActive: formIsActive,
            ...(formPassword ? { password: formPassword } : {}),
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui pengguna");
        toast.success(`Akun "${formName.trim()}" berhasil diperbarui.`);
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            username: formUsername.trim().toLowerCase(),
            password: formPassword,
            role: formRole,
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal menambahkan pengguna");
        toast.success(`Akun "${formName.trim()}" berhasil ditambahkan.`);
      }

      setIsModalOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u: UserRecord) {
    setActiveMenuId(null);

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pengguna");
      toast.success(
        `Akun "${u.name}" ${!u.isActive ? "diaktifkan" : "dinonaktifkan"}.`
      );
      await loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status pengguna.");
    }
  }

  async function executeDelete() {
    if (!confirmDeleteUser) return;
    if (confirmDeleteUser.id === currentUserId) {
      toast.error("Tidak dapat menghapus akun yang sedang digunakan.");
      setConfirmDeleteUser(null);
      return;
    }
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${confirmDeleteUser.id}`, {
        method: "DELETE",
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pengguna");
      toast.success(data.message || `Pengguna "${confirmDeleteUser.name}" dihapus.`);
      setConfirmDeleteUser(null);
      await loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pengguna.");
      setConfirmDeleteUser(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell ownerOnly>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Manajemen Pengguna
          </h2>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau username..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-sm border border-slate-200/70">
              {(
                [
                  { id: "ALL", label: "Semua" },
                  { id: "CASHIER", label: "Kasir" },
                  { id: "OWNER", label: "Owner" },
                ] as { id: RoleFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm whitespace-nowrap transition-all cursor-pointer ${
                    roleFilter === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-blue-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Terdaftar</th>
                  <th className="py-3 px-5 text-right w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                          <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                        </div>
                      </td>
                      <td className="py-3 px-4"><div className="h-3.5 w-20 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-5 w-14 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-12 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-5 text-right"><div className="h-6 w-6 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr className="animate-content-swap">
                    <td colSpan={6} className="py-12 px-4 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        Tidak ada pengguna yang sesuai
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Klik &quot;Tambah Pengguna&quot; untuk menambahkan akun kasir atau owner.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const isSelf = u.id === currentUserId;
                    const isOnlyOwner = u.role === "OWNER" && ownerCount <= 1;
                    const isOnlyActiveOwner =
                      u.role === "OWNER" && u.isActive && activeOwnerCount <= 1;
                    const cannotDeactivate = isSelf || isOnlyActiveOwner;
                    const cannotDelete = isSelf || isOnlyOwner || isOnlyActiveOwner;

                    return (
                    <tr
                      key={u.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        activeMenuId === u.id ? "relative z-30" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-sm flex items-center justify-center text-xs font-semibold shrink-0 ${
                              u.role === "OWNER"
                                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                                : "bg-blue-50 text-blue-700 border border-blue-100"
                            }`}
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-slate-900 truncate">{u.name}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-semibold shrink-0">
                                Anda
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        @{u.username}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold ${
                            u.role === "OWNER"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/80"
                              : "bg-slate-100 text-slate-700 border border-slate-200/80"
                          }`}
                        >
                          {u.role === "OWNER" ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <UserIcon className="w-3 h-3" />
                          )}
                          {u.role === "OWNER" ? "Owner" : "Kasir"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            u.isActive ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          {u.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td
                        className={`py-3 px-5 text-right relative ${
                          activeMenuId === u.id ? "z-30" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === u.id ? null : u.id)
                          }
                          className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                          title="Opsi Pengguna"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === u.id && (
                          <div
                            ref={menuRef}
                            className={`absolute right-5 w-48 bg-white rounded-sm shadow-xl border border-slate-200 py-1.5 z-50 text-left ${
                              idx >= filteredUsers.length - 2 && filteredUsers.length > 2
                                ? "bottom-11"
                                : "top-11"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit Pengguna
                            </button>
                            <button
                              type="button"
                              disabled={cannotDeactivate}
                              onClick={() => toggleActive(u)}
                              title={
                                isSelf
                                  ? "Tidak dapat menonaktifkan akun sendiri"
                                  : isOnlyActiveOwner
                                  ? "Minimal harus ada 1 akun Owner aktif"
                                  : undefined
                              }
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                              {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              disabled={cannotDelete}
                              onClick={() => {
                                setActiveMenuId(null);
                                setConfirmDeleteUser(u);
                              }}
                              title={
                                isSelf
                                  ? "Tidak dapat menghapus akun sendiri"
                                  : isOnlyOwner || isOnlyActiveOwner
                                  ? "Minimal harus ada 1 akun Owner"
                                  : undefined
                              }
                              className="w-full px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus Pengguna
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-backdrop-enter">
            <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-modal-enter">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-base text-slate-900">
                  {editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Kasir Shift Siang"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={formUsername}
                      onChange={(e) =>
                        setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                      }
                      placeholder="kasir2"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Peran <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formRole}
                      disabled={
                        !!editingUser &&
                        (editingUser.id === currentUserId ||
                          (editingUser.role === "OWNER" && ownerCount <= 1))
                      }
                      onChange={(e) => setFormRole(e.target.value as "OWNER" | "CASHIER")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    >
                      <option value="CASHIER">Kasir</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser ? "Password Baru (opsional)" : "Password"}{" "}
                    {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      required={!editingUser}
                      type={showPassword ? "text" : "password"}
                      minLength={6}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={
                        editingUser ? "Kosongkan jika tidak diubah" : "Minimal 6 karakter"
                      }
                      className="w-full px-3.5 py-2 pr-10 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Tampilkan password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {editingUser && (() => {
                  const lockActive =
                    editingUser.id === currentUserId ||
                    (editingUser.role === "OWNER" &&
                      editingUser.isActive &&
                      activeOwnerCount <= 1);
                  return (
                    <label
                      className={`flex items-center gap-2 text-xs font-medium pt-1 ${
                        lockActive
                          ? "text-slate-400 cursor-not-allowed"
                          : "text-slate-700 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={lockActive}
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="rounded-sm border-slate-300 text-blue-600 disabled:opacity-50"
                      />
                      Status Akun Aktif
                    </label>
                  );
                })()}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Pengguna"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-backdrop-enter">
            <div className="bg-white rounded-sm max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-modal-enter">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-slate-900">
                  Hapus Pengguna
                </h3>
                <p className="text-xs text-slate-600">
                  Hapus akun <strong>{confirmDeleteUser.name}</strong> (@{confirmDeleteUser.username})?
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteUser(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={executeDelete}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
