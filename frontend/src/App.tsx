import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
const BRAND_PRIMARY = "#2C26C2";
const BRAND_SUCCESS = "#00C853";
const LOGO_FILENAME = "warehouse-logo.png";

type Role = "pending" | "admin" | "requester" | "warehouse_manager" | "warehouse_operator";

type User = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
};

type RequestItem = {
  id: string;
  request_number: string;
  requester_id: string;
  requester_name: string;
  requester_department: string;
  work_type_id: string;
  item_qty: number;
  movement_number?: string | null;
  comment?: string | null;
  attachments?: string[] | null;
  priority: string;
  status: string;
  manager_id?: string | null;
  assignee_id?: string | null;
  assignee_ids?: string[] | null;
  deadline_seconds: number;
  deadline_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  manager_comment?: string | null;
  quality_rating?: number | null;
  quality_comment?: string | null;
  quality_rated_at?: string | null;
  created_at: string;
  updated_at: string;
};

type LoginForm = {
  email: string;
  password: string;
};

type AdminCreateUserForm = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: Exclude<Role, "admin" | "pending">;
};

type EditUserForm = {
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  is_active: boolean;
};

type PasswordUpdateForm = {
  password: string;
};

type RequestForm = {
  item_qty: number;
  movement_number: string;
  comment: string;
  priority: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
};

async function api<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}м ${secs}с`;
}

function formatDeadline(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours <= 0) return `${minutes} мин`;
  return `${hours} ч ${minutes} мин`;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    new: "Новая",
    assigned: "Назначена",
    in_progress: "В работе",
    paused: "На паузе",
    assembled: "Собрана",
    approved: "Подтверждена",
    returned_to_work: "Возврат в работу",
    rated: "Оценена",
  };
  return map[status] || status;
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin: "Администратор",
    requester: "Заказчик",
    warehouse_manager: "Заведующий складом",
    warehouse_operator: "Кладовщик",
    pending: "Ожидает назначения",
  };
  return map[role] || role;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dbe3ef",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 18, color: "#0f172a", fontSize: 30, fontWeight: 600 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        border: "none",
        background: BRAND_PRIMARY,
        color: "#fff",
        borderRadius: 14,
        padding: "12px 16px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function SuccessButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: BRAND_SUCCESS,
        color: "#fff",
        borderRadius: 14,
        padding: "12px 16px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${BRAND_PRIMARY}`,
        background: "#fff",
        color: BRAND_PRIMARY,
        borderRadius: 14,
        padding: "12px 16px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function DangerButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #dc2626",
        background: "#fff",
        color: "#dc2626",
        borderRadius: 14,
        padding: "12px 16px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        border: "1px solid #c7d2e2",
        borderRadius: 14,
        boxSizing: "border-box",
        fontSize: 16,
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        border: "1px solid #c7d2e2",
        borderRadius: 14,
        boxSizing: "border-box",
        fontSize: 16,
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        border: "1px solid #c7d2e2",
        borderRadius: 14,
        boxSizing: "border-box",
        minHeight: 90,
        fontSize: 16,
      }}
    />
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <Input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: "absolute",
          right: 12,
          top: 10,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 18,
        }}
        title={visible ? "Скрыть пароль" : "Показать пароль"}
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("access_token") || "");
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string[]>>({});
  const [managerComments, setManagerComments] = useState<Record<string, string>>({});
  const [pauseComments, setPauseComments] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>({
    first_name: "",
    last_name: "",
    email: "",
    role: "requester",
    is_active: true,
  });
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordUpdateForm, setPasswordUpdateForm] = useState<PasswordUpdateForm>({
    password: "",
  });

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  });

  const [adminCreateUserForm, setAdminCreateUserForm] = useState<AdminCreateUserForm>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "requester",
  });

  const [requestForm, setRequestForm] = useState<RequestForm>({
    item_qty: 1,
    movement_number: "",
    comment: "",
    priority: "Обычный",
  });

  const operatorUsers = users.filter((u) => u.role === "warehouse_operator");

  const visibleRequests = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin" || me.role === "warehouse_manager") return requests;
    if (me.role === "warehouse_operator") {
      return requests.filter((r) => {
        const ids = r.assignee_ids || [];
        return ids.includes(me.id) || r.assignee_id === me.id;
      });
    }
    if (me.role === "requester") return requests.filter((r) => r.requester_id === me.id);
    return [];
  }, [requests, me]);

  async function loadProtectedData(authToken: string) {
    const [meData, requestsData] = await Promise.all([
      api<User>("/auth/me", authToken),
      api<RequestItem[]>("/requests", authToken),
    ]);

    setMe(meData);
    setRequests(requestsData);

    try {
      const usersData = await api<User[]>("/users", authToken);
      setUsers(usersData);
    } catch {
      setUsers([]);
    }
  }

  async function bootstrap(authToken: string) {
    try {
      setLoading(true);
      setError("");
      await loadProtectedData(authToken);
    } catch (e) {
      localStorage.removeItem("access_token");
      setToken("");
      setMe(null);
      setUsers([]);
      setRequests([]);
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      bootstrap(token);
    }
  }, [token]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const result = await api<TokenResponse>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem("access_token", result.access_token);
      setToken(result.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    setToken("");
    setMe(null);
    setUsers([]);
    setRequests([]);
    setError("");
  }

  async function createUserByAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      setError("");
      await api<User>("/users/admin-create", token, {
        method: "POST",
        body: JSON.stringify(adminCreateUserForm),
      });
      setAdminCreateUserForm({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        role: "requester",
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания пользователя");
    }
  }

  async function changeRole(userId: string, role: Role) {
    if (!token) return;
    try {
      setError("");
      await api<User>(`/users/${userId}/role`, token, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены роли");
    }
  }

  function startEditUser(user: User) {
    setEditingUserId(user.id);
    setEditUserForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    });
  }

  async function saveUserEdit(userId: string) {
    if (!token) return;
    try {
      setError("");
      await api<User>(`/users/${userId}`, token, {
        method: "PATCH",
        body: JSON.stringify(editUserForm),
      });
      setEditingUserId(null);
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения пользователя");
    }
  }

  async function updateUserPassword(userId: string) {
    if (!token) return;
    try {
      setError("");
      await api<{ status: string; message: string }>(`/users/${userId}/password`, token, {
        method: "PATCH",
        body: JSON.stringify(passwordUpdateForm),
      });
      setPasswordUserId(null);
      setPasswordUpdateForm({ password: "" });
      alert("Пароль обновлен");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены пароля");
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !me) return;

    try {
      setError("");

      const createdRequest = await api<RequestItem>("/requests", token, {
        method: "POST",
        body: JSON.stringify({
          item_qty: Number(requestForm.item_qty),
          movement_number: requestForm.movement_number || null,
          comment: requestForm.comment || null,
          priority:
            requestForm.priority === "Обычный"
              ? "normal"
              : requestForm.priority === "Высокий"
              ? "high"
              : requestForm.priority === "Срочный"
              ? "urgent"
              : "normal",
        }),
      });

      if (selectedFiles && selectedFiles.length > 0) {
        for (const file of Array.from(selectedFiles)) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`${API_BASE}/requests/${createdRequest.id}/attachments`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Ошибка загрузки файла");
          }
        }
      }

      setRequestForm({
        item_qty: 1,
        movement_number: "",
        comment: "",
        priority: "Обычный",
      });
      setSelectedFiles(null);

      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания заявки");
    }
  }

  async function assignRequest(requestId: string) {
    if (!token || !me) return;

    const assigneeIds = selectedAssignees[requestId] || [];
    if (assigneeIds.length === 0) {
      setError("Выбери хотя бы одного кладовщика");
      return;
    }

    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/assign`, token, {
        method: "POST",
        body: JSON.stringify({
          manager_id: me.id,
          assignee_ids: assigneeIds,
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка назначения");
    }
  }

  async function startRequest(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/start`, token, {
        method: "POST",
        body: JSON.stringify({ user_id: me.id }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка старта");
    }
  }

  async function finishRequest(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/finish`, token, {
        method: "POST",
        body: JSON.stringify({ user_id: me.id }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка завершения");
    }
  }

  async function pauseRequest(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/pause`, token, {
        method: "POST",
        body: JSON.stringify({
          user_id: me.id,
          pause_comment: pauseComments[requestId] || null,
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка постановки на паузу");
    }
  }

  async function resumeRequest(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/resume`, token, {
        method: "POST",
        body: JSON.stringify({ user_id: me.id }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка продолжения работы");
    }
  }

  async function approveRequest(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/approve`, token, {
        method: "POST",
        body: JSON.stringify({
          manager_id: me.id,
          manager_comment: managerComments[requestId] || "Сборка подтверждена",
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подтверждения");
    }
  }

  async function returnToWork(requestId: string) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/return-to-work`, token, {
        method: "POST",
        body: JSON.stringify({
          manager_id: me.id,
          manager_comment: managerComments[requestId] || "Нужно пересобрать заказ",
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка возврата в работу");
    }
  }

  async function rateRequest(requestId: string, rating: number) {
    if (!token || !me) return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/rate`, token, {
        method: "POST",
        body: JSON.stringify({
          requester_id: me.id,
          quality_rating: rating,
          quality_comment: rating >= 4 ? "Заказ собран отлично" : "Нужны улучшения",
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оценки");
    }
  }

  if (!token || !me) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f6f8fc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560, display: "grid", gap: 24 }}>
          <Card title="Вход">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <img src={`/${LOGO_FILENAME}`} alt="Warehouse logo" style={{ width: 56, height: 56, objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>Warehouse App</div>
                <div style={{ color: "#475569" }}>Вход в систему</div>
              </div>
            </div>

            <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
              <Input
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
              <PasswordField
                placeholder="Пароль"
                value={loginForm.password}
                onChange={(value) => setLoginForm({ ...loginForm, password: value })}
              />
              <Button type="submit">{loading ? "Входим..." : "Войти"}</Button>
            </form>
          </Card>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: 14,
                borderRadius: 16,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fc", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 }}>
        <Card title="Профиль">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src={`/${LOGO_FILENAME}`} alt="Warehouse logo" style={{ width: 56, height: 56, objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 600 }}>{me.full_name}</div>
                <div style={{ color: "#475569", marginTop: 8 }}>
                  Email: <span style={{ fontWeight: 600 }}>{me.email}</span> · Роль: <span style={{ fontWeight: 600 }}>{getRoleLabel(me.role)}</span>
                </div>
              </div>
            </div>
            <SecondaryButton onClick={handleLogout}>Выйти</SecondaryButton>
          </div>
        </Card>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 14,
              borderRadius: 16,
            }}
          >
            {error}
          </div>
        )}

        {me.role === "admin" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24 }}>
            <Card title="Создать пользователя">
              <form onSubmit={createUserByAdmin} style={{ display: "grid", gap: 12 }}>
                <Input
                  placeholder="Имя (латиница)"
                  value={adminCreateUserForm.first_name}
                  onChange={(e) => setAdminCreateUserForm({ ...adminCreateUserForm, first_name: e.target.value })}
                />
                <Input
                  placeholder="Фамилия (латиница)"
                  value={adminCreateUserForm.last_name}
                  onChange={(e) => setAdminCreateUserForm({ ...adminCreateUserForm, last_name: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={adminCreateUserForm.email}
                  onChange={(e) => setAdminCreateUserForm({ ...adminCreateUserForm, email: e.target.value })}
                />
                <PasswordField
                  placeholder="Пароль"
                  value={adminCreateUserForm.password}
                  onChange={(value) => setAdminCreateUserForm({ ...adminCreateUserForm, password: value })}
                />
                <Select
                  value={adminCreateUserForm.role}
                  onChange={(e) => setAdminCreateUserForm({ ...adminCreateUserForm, role: e.target.value as AdminCreateUserForm["role"] })}
                >
                  <option value="requester">Заказчик</option>
                  <option value="warehouse_manager">Заведующий складом</option>
                  <option value="warehouse_operator">Кладовщик</option>
                </Select>
                <Button type="submit">Создать пользователя</Button>
              </form>
            </Card>

            <Card title="Пользователи и роли">
              <div style={{ display: "grid", gap: 12 }}>
                {users.map((user) => (
                  <div key={user.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, display: "grid", gap: 8 }}>
                    {editingUserId === user.id ? (
                      <>
                        <Input
                          value={editUserForm.first_name}
                          onChange={(e) => setEditUserForm({ ...editUserForm, first_name: e.target.value })}
                          placeholder="Имя"
                        />
                        <Input
                          value={editUserForm.last_name}
                          onChange={(e) => setEditUserForm({ ...editUserForm, last_name: e.target.value })}
                          placeholder="Фамилия"
                        />
                        <Input
                          value={editUserForm.email}
                          onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                          placeholder="Email"
                        />
                        <Select
                          value={editUserForm.role}
                          onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as Role })}
                        >
                          <option value="pending">Ожидает назначения</option>
                          <option value="admin">Администратор</option>
                          <option value="requester">Заказчик</option>
                          <option value="warehouse_manager">Заведующий складом</option>
                          <option value="warehouse_operator">Кладовщик</option>
                        </Select>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={editUserForm.is_active}
                            onChange={(e) => setEditUserForm({ ...editUserForm, is_active: e.target.checked })}
                          />
                          Активен
                        </label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button onClick={() => saveUserEdit(user.id)}>Сохранить</Button>
                          <SecondaryButton onClick={() => setEditingUserId(null)}>Отмена</SecondaryButton>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>{user.email}</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>
                          Роль: <span style={{ fontWeight: 600 }}>{getRoleLabel(user.role)}</span> · Статус:{" "}
                          <span style={{ fontWeight: 600 }}>{user.is_active ? "Активен" : "Отключен"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button onClick={() => startEditUser(user)}>Редактировать</Button>
                          <SecondaryButton onClick={() => {
                            setPasswordUserId(user.id);
                            setPasswordUpdateForm({ password: "" });
                          }}>
                            Сменить пароль
                          </SecondaryButton>
                        </div>
                        {passwordUserId === user.id && (
                          <div style={{ display: "grid", gap: 8 }}>
                            <PasswordField
                              placeholder="Новый пароль"
                              value={passwordUpdateForm.password}
                              onChange={(value) => setPasswordUpdateForm({ password: value })}
                            />
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Button onClick={() => updateUserPassword(user.id)}>Сохранить пароль</Button>
                              <DangerButton onClick={() => setPasswordUserId(null)}>Отмена</DangerButton>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {me.role === "requester" && (
          <Card title="Создание заявки">
            <form onSubmit={createRequest} style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Тип работы</div>
              <Input value="Сборка устройств / аксессуаров" readOnly />

              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Количество устройств / аксессуаров</div>
              <Input type="number" min={1} value={requestForm.item_qty} onChange={(e) => setRequestForm({ ...requestForm, item_qty: Number(e.target.value) })} />

              <Input placeholder="№ перемещения" value={requestForm.movement_number} onChange={(e) => setRequestForm({ ...requestForm, movement_number: e.target.value })} />

              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Пояснения к заказу</div>
              <Textarea placeholder="Пояснения к заказу" value={requestForm.comment} onChange={(e) => setRequestForm({ ...requestForm, comment: e.target.value })} />

              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Файлы</div>
              <Input type="file" multiple onChange={(e) => setSelectedFiles(e.target.files)} />

              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Приоритет</div>
              <Select value={requestForm.priority} onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}>
                <option value="Обычный">Обычный</option>
                <option value="Высокий">Высокий</option>
                <option value="Срочный">Срочный</option>
              </Select>

              <Button type="submit">Создать заявку</Button>
            </form>
          </Card>
        )}

        <Card title="Заявки">
          <div style={{ display: "grid", gap: 14 }}>
            {visibleRequests.map((request) => (
              <div key={request.id} style={{ border: "1px solid #e2e8f0", borderRadius: 20, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{request.request_number}</div>
                    <div style={{ color: "#475569", marginTop: 6 }}>{request.requester_name}</div>
                  </div>
                  <div style={{ textAlign: "right", color: "#334155", fontSize: 14 }}>
                    <div>Статус: <span style={{ fontWeight: 600 }}>{getStatusLabel(request.status)}</span></div>
                    <div>Норматив: <span style={{ fontWeight: 600 }}>{formatDeadline(request.deadline_seconds)}</span></div>
                    <div>Дедлайн до: <span style={{ fontWeight: 600 }}>{formatDateTime(request.deadline_at)}</span></div>
                    <div>Факт: <span style={{ fontWeight: 600 }}>{formatDuration(request.duration_seconds)}</span></div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 6, color: "#334155", fontSize: 14 }}>
                  <div>Комментарий: {request.comment || "—"}</div>
                  <div>Старт: {formatDateTime(request.started_at)}</div>
                  <div>Финиш: {formatDateTime(request.finished_at)}</div>
                  <div>Комментарий заведующего: {request.manager_comment || "—"}</div>
                  <div>Оценка заказчика: {request.quality_rating ?? "—"}</div>
                  <div>
                    Назначенные кладовщики:{" "}
                    {request.assignee_ids && request.assignee_ids.length > 0
                      ? request.assignee_ids
                          .map((id) => users.find((u) => u.id === id)?.full_name || id)
                          .join(", ")
                      : "—"}
                  </div>
                  <div>
                    Файлы:{" "}
                    {request.attachments && request.attachments.length > 0 ? (
                      request.attachments.map((filePath, idx) => {
                        const publicPath = filePath.startsWith("uploads/")
                          ? `${API_ORIGIN}/${filePath}`
                          : `${API_ORIGIN}/uploads/${filePath}`;
                        return (
                          <div key={idx}>
                            <a href={publicPath} target="_blank" rel="noreferrer">
                              Файл {idx + 1}
                            </a>
                          </div>
                        );
                      })
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {me.role === "warehouse_manager" && request.status === "new" && operatorUsers.length > 0 && (
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 14, color: "#475569" }}>Назначить кладовщиков</div>
                      {operatorUsers.map((u) => {
                        const current = selectedAssignees[request.id] || [];
                        const checked = current.includes(u.id);

                        return (
                          <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const prev = selectedAssignees[request.id] || [];
                                const next = e.target.checked
                                  ? [...prev, u.id]
                                  : prev.filter((id) => id !== u.id);

                                setSelectedAssignees((old) => ({
                                  ...old,
                                  [request.id]: next,
                                }));
                              }}
                            />
                            {u.full_name}
                          </label>
                        );
                      })}
                      <Button onClick={() => assignRequest(request.id)}>Назначить</Button>
                    </div>
                  )}

                  {me.role === "warehouse_operator" && request.status === "assigned" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <Button onClick={() => startRequest(request.id)}>Взять в работу</Button>
                  )}

                  {me.role === "warehouse_operator" && request.status === "in_progress" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}>
                      <Textarea
                        placeholder="Комментарий при паузе (необязательно)"
                        value={pauseComments[request.id] || ""}
                        onChange={(e) =>
                          setPauseComments((old) => ({
                            ...old,
                            [request.id]: e.target.value,
                          }))
                        }
                      />
                      <Button onClick={() => finishRequest(request.id)}>Завершить сборку</Button>
                      <SecondaryButton onClick={() => pauseRequest(request.id)}>Поставить на паузу</SecondaryButton>
                    </div>
                  )}

                  {me.role === "warehouse_operator" && request.status === "paused" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <SuccessButton onClick={() => resumeRequest(request.id)}>Продолжить работу</SuccessButton>
                  )}

                  {me.role === "warehouse_manager" && request.status === "assembled" && request.manager_id === me.id && (
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <Textarea
                        placeholder="Комментарий заведующего"
                        value={managerComments[request.id] || ""}
                        onChange={(e) =>
                          setManagerComments((old) => ({
                            ...old,
                            [request.id]: e.target.value,
                          }))
                        }
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <SuccessButton onClick={() => approveRequest(request.id)}>Подтвердить</SuccessButton>
                        <SecondaryButton onClick={() => returnToWork(request.id)}>Вернуть в работу</SecondaryButton>
                      </div>
                    </div>
                  )}

                  {me.role === "requester" && request.status === "approved" && request.requester_id === me.id && (
                    <>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <SecondaryButton key={rating} onClick={() => rateRequest(request.id, rating)}>
                          Оценка {rating}
                        </SecondaryButton>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}

            {visibleRequests.length === 0 && <div style={{ color: "#64748b" }}>Заявок пока нет.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
