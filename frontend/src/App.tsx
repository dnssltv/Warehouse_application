import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
const BRAND_PRIMARY = "#2C26C2";
const BRAND_SUCCESS = "#00C853";
const LOGO_FILENAME = "warehouse-logo.png";
const WORKER_MINUTE_RATE_KZT = 24;
const PREMIUM_FIRST_ORDER_KZT = 500;
const PREMIUM_EVERY_10_ORDERS_KZT = 3000;
const PREMIUM_FAST_AVG_MAX_SECONDS = 30 * 60;
const PREMIUM_FAST_AVG_KZT = 5000;
const PREMIUM_TOP_BONUS_KZT = 8000;
/** Стандарт для внутренних веб-приложений: 15 минут бездействия */
const IDLE_LOGOUT_MS = 15 * 60 * 1000;
const RATING_POSITIVE_OPTIONS = [
  "Быстрая сборка",
  "Хорошее качество сборки",
  "Понятный комментарий к заказу",
  "Быстрая реакция на замечания",
  "Удобная выдача готового заказа",
  "Профессиональная коммуникация",
];
const RATING_ISSUE_OPTIONS = [
  "Долго выполнялся заказ",
  "Слабая коммуникация по заказу",
  "Не хватило информации по статусу",
  "Заказ собран не полностью",
];

type Role =
  | "pending"
  | "admin"
  | "general_director"
  | "commercial_director"
  | "requester"
  | "warehouse_manager"
  | "warehouse_operator"
  | "grading_manager"
  | "warehouse_operator_agc";

type User = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
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
  /** warehouse — склад; stock_in_agc — Stock in AGC (грейдинг) */
  fulfillment_site?: string;
  status: string;
  manager_id?: string | null;
  assignee_id?: string | null;
  assignee_ids?: string[] | null;
  deadline_seconds: number;
  deadline_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  active_duration_seconds?: number | null;
  total_pause_seconds?: number | null;
  pause_started_at?: string | null;
  manager_comment?: string | null;
  pause_comment?: string | null;
  quality_rating?: number | null;
  quality_comment?: string | null;
  feedback_liked_points?: string[] | null;
  feedback_issue_points?: string[] | null;
  feedback_free_text?: string | null;
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
  role: Exclude<Role, "pending">;
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

type SelfPasswordForm = {
  current_password: string;
  new_password: string;
};

type RequestForm = {
  item_qty: number;
  movement_number: string;
  comment: string;
  priority: string;
  fulfillment_site: "warehouse" | "stock_in_agc";
};

type AdminRequestEditForm = {
  item_qty: string;
  movement_number: string;
  comment: string;
  quality_rating: string;
  quality_comment: string;
};

type RequestsSort =
  | "created_desc"
  | "created_asc"
  | "deadline_asc"
  | "deadline_desc"
  | "duration_asc"
  | "duration_desc"
  | "priority_desc"
  | "priority_asc";

type MainTab = "profile" | "dashboard" | "search" | "orders" | "users";

type TutorialStep = {
  tab: MainTab;
  title: string;
  text: string;
};

type RequestFilters = {
  period: "all" | "today" | "7" | "30" | "90";
  site: "all" | "warehouse" | "stock_in_agc";
  status: "all" | string;
  requesterId: "all" | string;
  workerId: "all" | string;
  managerId: "all" | string;
  query: string;
  sortBy: RequestsSort;
};

type RatingDraft = {
  rating: number;
  likedPoints: string[];
  issuePoints: string[];
  comment: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
};

type SalaryPreview = {
  minute_rate_kzt: number;
  total_duration_seconds: number;
  completed_orders_count: number;
  average_seconds?: number | null;
  best_seconds?: number | null;
  base_pay_kzt: number;
  premium_first_order_kzt: number;
  premium_milestone_kzt: number;
  premium_speed_kzt: number;
  premium_top_worker_kzt: number;
  premium_total_kzt: number;
  payout_total_kzt: number;
  achievements: string[];
};

type AchievementHistoryItem = {
  code: string;
  title: string;
  description: string;
  level: "bronze" | "silver" | "gold" | string;
  achieved_at: string;
};

type FeedbackPointStat = {
  point: string;
  count: number;
};

type FeedbackAnalytics = {
  total_rated: number;
  average_rating?: number | null;
  rating_distribution: Record<string, number>;
  top_liked_points: FeedbackPointStat[];
  top_issue_points: FeedbackPointStat[];
};

type AnalyticsFilters = {
  period: "all" | "7" | "30" | "90";
  site: "all" | "warehouse" | "stock_in_agc";
};

function toRussianErrorMessage(raw: string) {
  const normalized = raw.trim();
  const map: Record<string, string> = {
    "Internal Server Error": "Внутренняя ошибка сервера. Попробуйте повторить действие или обратитесь к администратору.",
    "Failed to fetch": "Не удалось подключиться к серверу. Проверьте адрес сервера и сеть.",
    "Invalid email or password": "Неверный email или пароль.",
    "Inactive user": "Пользователь отключен.",
    "Invalid token": "Недействительный токен.",
    "Not enough permissions": "Недостаточно прав для выполнения операции.",
    "Request not found": "Заявка не найдена.",
    "User not found": "Пользователь не найден.",
    "Email already exists": "Пользователь с таким email уже существует.",
    "Invalid role": "Некорректная роль.",
    "Only latin letters are allowed": "Допустимы только латинские буквы.",
    "Input should be a valid email address": "Введите корректный email адрес.",
    "Field required": "Заполните обязательные поля.",
    "String should have at least 1 character": "Поле не может быть пустым.",
    "Current password is incorrect": "Текущий пароль указан неверно.",
    "New password cannot be empty": "Новый пароль не может быть пустым.",
  };
  if (map[normalized]) return map[normalized];
  if (normalized.toLowerCase().includes("valid email")) return "Введите корректный email адрес.";
  if (normalized.toLowerCase().includes("field required")) return "Заполните обязательные поля.";
  if (normalized.toLowerCase().includes("at least 1 character")) return "Поле не может быть пустым.";
  if (normalized.toLowerCase().includes("json")) return "Некорректный формат данных запроса.";
  if (normalized.toLowerCase().includes("http 401")) return "Ошибка авторизации. Проверьте логин и пароль.";
  if (normalized.toLowerCase().includes("http 403")) return "Недостаточно прав для выполнения операции.";
  if (normalized.toLowerCase().includes("http 404")) return "Запрошенные данные не найдены.";
  return normalized;
}

async function api<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  try {
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
      let message = text || `Ошибка HTTP ${res.status}`;
      try {
        const parsed = text ? JSON.parse(text) : null;
        if (typeof parsed?.detail === "string") {
          message = parsed.detail;
        } else if (Array.isArray(parsed?.detail) && parsed.detail.length > 0) {
          const first = parsed.detail[0];
          const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : "";
          const msg = first?.msg || "Ошибка валидации";
          message = field ? `Поле "${field}": ${msg}` : msg;
        }
      } catch {
        // Keep raw text when body is not JSON.
      }
      throw new Error(toRussianErrorMessage(message));
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(toRussianErrorMessage(error.message));
    }
    throw new Error("Произошла неизвестная ошибка");
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = parseApiDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleString();
}

function renderStars(rating?: number | null) {
  if (!rating || rating < 1) return "—";
  return `${"★".repeat(rating)}${"☆".repeat(Math.max(0, 5 - rating))}`;
}

function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  const hasTimezone = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}м ${secs}с`;
}

function formatCurrencyKZT(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function getAvatarColor(seed: string) {
  const palette = ["#4f46e5", "#0ea5e9", "#16a34a", "#e11d48", "#f59e0b", "#7c3aed"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function avatarPublicUrl(avatarPath?: string | null) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) return avatarPath;
  if (avatarPath.startsWith("/")) return avatarPath;
  return `${API_ORIGIN}/${avatarPath}`;
}

function formatDeadline(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours <= 0) return `${minutes} мин`;
  return `${hours} ч ${minutes} мин`;
}

function priorityRank(priority: string) {
  const p = String(priority || "").toLowerCase();
  if (p.includes("urgent") || p.includes("сроч")) return 3;
  if (p.includes("high") || p.includes("высок")) return 2;
  return 1;
}

function getPriorityBadge(priority: string) {
  const rank = priorityRank(priority);
  if (rank === 3) {
    return { label: "Срочный", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  }
  if (rank === 2) {
    return { label: "Высокий", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" };
  }
  return { label: "Обычный", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
}

function getWorkerShareSeconds(request: RequestItem, workerId: string): number {
  const ids = request.assignee_ids && request.assignee_ids.length > 0
    ? request.assignee_ids
    : request.assignee_id
      ? [request.assignee_id]
      : [];
  const normalized = ids.map((id) => String(id));
  if (!normalized.includes(workerId)) return 0;
  const workers = Math.max(1, normalized.length);
  const effective = Number(request.active_duration_seconds ?? request.duration_seconds ?? 0);
  return Math.max(0, Math.round(effective / workers));
}

function getDefaultTabForRole(role: Role): MainTab {
  if (role === "requester") return "orders";
  if (role === "warehouse_operator" || role === "warehouse_operator_agc") return "orders";
  if (role === "warehouse_manager" || role === "grading_manager") return "dashboard";
  if (role === "admin" || role === "general_director" || role === "commercial_director") return "dashboard";
  return "profile";
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
    general_director: "Генеральный директор",
    commercial_director: "Коммерческий директор",
    requester: "Заказчик",
    warehouse_manager: "Заведующий складом",
    warehouse_operator: "Кладовщик (склад)",
    grading_manager: "Руководитель грейдинга",
    warehouse_operator_agc: "Кладовщик Stock in AGC",
    pending: "Ожидает назначения",
  };
  return map[role] || role;
}

function isAdminLike(role: Role): boolean {
  return role === "admin" || role === "general_director" || role === "commercial_director";
}

function getFulfillmentSiteLabel(site?: string | null) {
  const s = site || "warehouse";
  if (s === "stock_in_agc") return "Stock in AGC (грейдинг)";
  return "Склад";
}

function requestSite(request: RequestItem): "warehouse" | "stock_in_agc" {
  return request.fulfillment_site === "stock_in_agc" ? "stock_in_agc" : "warehouse";
}

function canOperateAsWarehouseWorker(me: User, request: RequestItem) {
  const site = requestSite(request);
  if (site === "warehouse") return me.role === "warehouse_operator";
  return me.role === "warehouse_operator_agc";
}

function useIsMobile(breakpoint = 768): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return matches;
}

function Card({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  const pad = compact ? 16 : 24;
  const radius = compact ? 18 : 24;
  const titleSize = compact ? 22 : 30;
  const titleMargin = compact ? 14 : 18;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dbe3ef",
        borderRadius: radius,
        padding: pad,
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
        maxWidth: "100%",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: titleMargin,
          color: "#0f172a",
          fontSize: titleSize,
          fontWeight: 600,
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}
      >
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
  block,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  block?: boolean;
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
        minHeight: 44,
        width: block ? "100%" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}
    </button>
  );
}

function SuccessButton({ children, onClick, block }: { children: React.ReactNode; onClick?: () => void; block?: boolean }) {
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
        minHeight: 44,
        width: block ? "100%" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, block }: { children: React.ReactNode; onClick?: () => void; block?: boolean }) {
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
        minHeight: 44,
        width: block ? "100%" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, block }: { children: React.ReactNode; onClick?: () => void; block?: boolean }) {
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
        minHeight: 44,
        width: block ? "100%" : undefined,
        boxSizing: "border-box",
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
  const [salaryPreview, setSalaryPreview] = useState<SalaryPreview | null>(null);
  const [achievementHistory, setAchievementHistory] = useState<AchievementHistoryItem[]>([]);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilters>({
    period: "all",
    site: "all",
  });
  const [activeTab, setActiveTab] = useState<MainTab>("profile");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [error, setError] = useState<string>("");
  const [authNotice, setAuthNotice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile(768);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string[]>>({});
  const [managerComments, setManagerComments] = useState<Record<string, string>>({});
  const [pauseComments, setPauseComments] = useState<Record<string, string>>({});
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [adminRequestEdits, setAdminRequestEdits] = useState<Record<string, AdminRequestEditForm>>({});
  const [adminAttachmentFiles, setAdminAttachmentFiles] = useState<Record<string, File[]>>({});
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
  const [selfPasswordForm, setSelfPasswordForm] = useState<SelfPasswordForm>({
    current_password: "",
    new_password: "",
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
    fulfillment_site: "warehouse",
  });
  const [requestFilters, setRequestFilters] = useState<RequestFilters>({
    period: "all",
    site: "all",
    status: "all",
    requesterId: "all",
    workerId: "all",
    managerId: "all",
    query: "",
    sortBy: "created_desc",
  });

  const warehouseOperators = users.filter((u) => u.role === "warehouse_operator");
  const agcOperators = users.filter((u) => u.role === "warehouse_operator_agc");

  const roleScopedRequests = useMemo(() => {
    if (!me) return [];
    if (isAdminLike(me.role)) return requests;
    if (me.role === "warehouse_manager") {
      return requests.filter((r) => requestSite(r) === "warehouse");
    }
    if (me.role === "grading_manager") {
      return requests.filter((r) => requestSite(r) === "stock_in_agc");
    }
    if (me.role === "warehouse_operator") {
      return requests.filter((r) => {
        if (requestSite(r) !== "warehouse") return false;
        const ids = r.assignee_ids || [];
        return ids.includes(me.id) || r.assignee_id === me.id;
      });
    }
    if (me.role === "warehouse_operator_agc") {
      return requests.filter((r) => {
        if (requestSite(r) !== "stock_in_agc") return false;
        const ids = r.assignee_ids || [];
        return ids.includes(me.id) || r.assignee_id === me.id;
      });
    }
    if (me.role === "requester") return requests.filter((r) => r.requester_id === me.id);
    return [];
  }, [requests, me]);

  const visibleRequests = useMemo(() => {
    const now = Date.now();
    let data = [...roleScopedRequests];

    if (requestFilters.site !== "all") {
      data = data.filter((r) => requestSite(r) === requestFilters.site);
    }
    if (requestFilters.status !== "all") {
      data = data.filter((r) => r.status === requestFilters.status);
    }
    if (requestFilters.requesterId !== "all") {
      data = data.filter((r) => r.requester_id === requestFilters.requesterId);
    }
    if (requestFilters.workerId !== "all") {
      data = data.filter((r) => {
        const assigned = r.assignee_ids || [];
        return assigned.includes(requestFilters.workerId) || r.assignee_id === requestFilters.workerId;
      });
    }
    if (requestFilters.managerId !== "all") {
      data = data.filter((r) => r.manager_id === requestFilters.managerId);
    }
    if (requestFilters.period !== "all") {
      const days = requestFilters.period === "today" ? 1 : Number(requestFilters.period);
      const ms = days * 24 * 60 * 60 * 1000;
      data = data.filter((r) => {
        const createdAt = parseApiDate(r.created_at)?.getTime() ?? NaN;
        return Number.isFinite(createdAt) && now - createdAt <= ms;
      });
    }
    if (requestFilters.query.trim()) {
      const q = requestFilters.query.trim().toLowerCase();
      data = data.filter((r) =>
        [r.request_number, r.requester_name, r.movement_number || "", r.comment || ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const toTime = (v?: string | null) => parseApiDate(v)?.getTime() ?? 0;
    data.sort((a, b) => {
      switch (requestFilters.sortBy) {
        case "created_asc":
          return toTime(a.created_at) - toTime(b.created_at);
        case "deadline_asc":
          return toTime(a.deadline_at) - toTime(b.deadline_at);
        case "deadline_desc":
          return toTime(b.deadline_at) - toTime(a.deadline_at);
        case "duration_asc":
          return (a.duration_seconds || Number.MAX_SAFE_INTEGER) - (b.duration_seconds || Number.MAX_SAFE_INTEGER);
        case "duration_desc":
          return (b.duration_seconds || 0) - (a.duration_seconds || 0);
        case "priority_desc":
          return priorityRank(b.priority) - priorityRank(a.priority);
        case "priority_asc":
          return priorityRank(a.priority) - priorityRank(b.priority);
        case "created_desc":
        default:
          return toTime(b.created_at) - toTime(a.created_at);
      }
    });

    return data;
  }, [roleScopedRequests, requestFilters]);

  const dashboardBySite = useMemo(() => {
    const sites: Array<"warehouse" | "stock_in_agc"> = ["warehouse", "stock_in_agc"];
    const completedStatuses = new Set(["assembled", "approved", "rated"]);

    const result = sites.map((site) => {
      const siteRequests = visibleRequests.filter((r) => requestSite(r) === site);
      const completedRequests = siteRequests.filter((r) => completedStatuses.has(r.status));
      const inProgressCount = siteRequests.filter((r) => r.status === "in_progress").length;
      const pausedCount = siteRequests.filter((r) => r.status === "paused").length;
      const overdueCount = siteRequests.filter(
        (r) =>
          !completedStatuses.has(r.status) &&
          r.deadline_at &&
          (parseApiDate(r.deadline_at)?.getTime() ?? Number.MAX_SAFE_INTEGER) < Date.now()
      ).length;
      const avgSeconds =
        completedRequests.length > 0
          ? Math.round(
              completedRequests.reduce((acc, r) => acc + (r.duration_seconds || 0), 0) /
                completedRequests.length
            )
          : null;

      const byWorker: Record<string, { count: number; bestSeconds: number | null; totalSeconds: number }> = {};
      for (const req of completedRequests) {
        const workerId = req.assignee_ids?.[0] || req.assignee_id || "";
        if (!workerId) continue;
        const duration = req.duration_seconds || 0;
        const prev = byWorker[workerId] || { count: 0, bestSeconds: null, totalSeconds: 0 };
        byWorker[workerId] = {
          count: prev.count + 1,
          bestSeconds:
            prev.bestSeconds == null
              ? duration
              : duration > 0
                ? Math.min(prev.bestSeconds, duration)
                : prev.bestSeconds,
          totalSeconds: prev.totalSeconds + duration,
        };
      }

      const ranking = Object.entries(byWorker)
        .map(([workerId, stat]) => ({
          workerId,
          workerName: users.find((u) => u.id === workerId)?.full_name || workerId,
          count: stat.count,
          bestSeconds: stat.bestSeconds,
          totalSeconds: stat.totalSeconds,
          avgSeconds: stat.count > 0 ? Math.round(stat.totalSeconds / stat.count) : null,
        }))
        .sort((a, b) => b.count - a.count || (a.avgSeconds || Number.MAX_SAFE_INTEGER) - (b.avgSeconds || Number.MAX_SAFE_INTEGER));

      const topWorker = ranking[0] || null;
      return {
        site,
        total: siteRequests.length,
        completed: completedRequests.length,
        inProgress: inProgressCount,
        paused: pausedCount,
        overdue: overdueCount,
        avgSeconds,
        topWorker,
        ranking: ranking.slice(0, 6),
      };
    });

    return {
      warehouse: result[0],
      stock_in_agc: result[1],
    };
  }, [visibleRequests, users]);

  const myProfileStats = useMemo(() => {
    if (!me) {
      return {
        assignedDoneCount: 0,
        requesterDoneCount: 0,
        managerApprovedCount: 0,
        inProgressCount: 0,
        avgSeconds: null as number | null,
        bestSeconds: null as number | null,
        totalDurationSeconds: 0,
        salaryEstimateKzt: 0,
        basePayKzt: 0,
        premiumFirstOrderKzt: 0,
        premiumMilestoneKzt: 0,
        premiumSpeedKzt: 0,
        premiumTopWorkerKzt: 0,
        premiumTotalKzt: 0,
        payoutTotalKzt: 0,
        achievements: [] as string[],
      };
    }

    const completedStatuses = new Set(["assembled", "approved", "rated"]);
    const asWorker = requests.filter((r) => (r.assignee_ids || []).includes(me.id) || r.assignee_id === me.id);
    const completedAsWorker = asWorker.filter((r) => completedStatuses.has(r.status));
    const durations = completedAsWorker.map((r) => getWorkerShareSeconds(r, me.id)).filter((x) => x > 0);
    const totalDurationSeconds = salaryPreview?.total_duration_seconds ?? durations.reduce((acc, x) => acc + x, 0);
    const avgSeconds =
      salaryPreview?.average_seconds ??
      (durations.length > 0 ? Math.round(totalDurationSeconds / durations.length) : null);
    const bestSeconds = salaryPreview?.best_seconds ?? (durations.length > 0 ? Math.min(...durations) : null);
    const requesterDoneCount = requests.filter((r) => r.requester_id === me.id && completedStatuses.has(r.status)).length;
    const managerApprovedCount = requests.filter((r) => r.manager_id === me.id && (r.status === "approved" || r.status === "rated")).length;
    const inProgressCount = asWorker.filter((r) => r.status === "in_progress").length;
    const basePayKzt = salaryPreview?.base_pay_kzt ?? Math.round((totalDurationSeconds / 60) * WORKER_MINUTE_RATE_KZT);
    const premiumFirstOrderKzt = salaryPreview?.premium_first_order_kzt ?? (completedAsWorker.length >= 1 ? PREMIUM_FIRST_ORDER_KZT : 0);
    const premiumMilestoneKzt = salaryPreview?.premium_milestone_kzt ?? (Math.floor(completedAsWorker.length / 10) * PREMIUM_EVERY_10_ORDERS_KZT);
    const premiumSpeedKzt = salaryPreview?.premium_speed_kzt ?? (avgSeconds != null && completedAsWorker.length >= 5 && avgSeconds <= PREMIUM_FAST_AVG_MAX_SECONDS ? PREMIUM_FAST_AVG_KZT : 0);
    const premiumTopWorkerKzt = salaryPreview?.premium_top_worker_kzt ?? 0;
    const premiumTotalKzt = salaryPreview?.premium_total_kzt ?? (premiumFirstOrderKzt + premiumMilestoneKzt + premiumSpeedKzt + premiumTopWorkerKzt);
    const payoutTotalKzt = salaryPreview?.payout_total_kzt ?? (basePayKzt + premiumTotalKzt);

    const achievements: string[] = salaryPreview?.achievements
      ? [...salaryPreview.achievements]
      : [];
    if (!salaryPreview) {
      if (completedAsWorker.length >= 1) achievements.push("🏁 Первый собранный заказ");
      if (completedAsWorker.length >= 10) achievements.push("🔟 10+ собранных заказов");
      if (completedAsWorker.length >= 50) achievements.push("🏆 50+ собранных заказов");
      if (bestSeconds != null && bestSeconds <= 15 * 60) achievements.push("⚡ Быстрый заказ (до 15 минут)");
      if (avgSeconds != null && avgSeconds <= 30 * 60 && completedAsWorker.length >= 5) achievements.push("🎯 Стабильная скорость (среднее до 30 минут)");
    }
    if (managerApprovedCount >= 20) achievements.push("🧭 Контроль качества: 20+ подтверждений");
    if (requesterDoneCount >= 5) achievements.push("📦 Активный заказчик: 5+ закрытых заявок");

    return {
      assignedDoneCount: salaryPreview?.completed_orders_count ?? completedAsWorker.length,
      requesterDoneCount,
      managerApprovedCount,
      inProgressCount,
      avgSeconds,
      bestSeconds,
      totalDurationSeconds,
      salaryEstimateKzt: payoutTotalKzt,
      basePayKzt,
      premiumFirstOrderKzt,
      premiumMilestoneKzt,
      premiumSpeedKzt,
      premiumTopWorkerKzt,
      premiumTotalKzt,
      payoutTotalKzt,
      achievements,
    };
  }, [me, requests, salaryPreview]);

  const managerBonusByWorkers = useMemo(() => {
    if (!me || (me.role !== "warehouse_manager" && me.role !== "grading_manager")) {
      return { rows: [] as Array<{ workerId: string; workerName: string; completed: number; payoutKzt: number }>, totalPayoutKzt: 0 };
    }
    const targetSite = me.role === "warehouse_manager" ? "warehouse" : "stock_in_agc";
    const completedStatuses = new Set(["assembled", "approved", "rated"]);
    const scoped = requests.filter((r) => requestSite(r) === targetSite && completedStatuses.has(r.status));
    const byWorker = new Map<string, { completed: number; totalDurationSeconds: number }>();

    for (const r of scoped) {
      const ids = r.assignee_ids && r.assignee_ids.length > 0 ? r.assignee_ids : r.assignee_id ? [r.assignee_id] : [];
      for (const workerId of ids) {
        const prev = byWorker.get(workerId) || { completed: 0, totalDurationSeconds: 0 };
        byWorker.set(workerId, {
          completed: prev.completed + 1,
          totalDurationSeconds: prev.totalDurationSeconds + getWorkerShareSeconds(r, workerId),
        });
      }
    }

    const rows = Array.from(byWorker.entries())
      .map(([workerId, stat]) => {
        const base = Math.round((stat.totalDurationSeconds / 60) * WORKER_MINUTE_RATE_KZT);
        const premiumFirst = stat.completed >= 1 ? PREMIUM_FIRST_ORDER_KZT : 0;
        const premiumMilestone = Math.floor(stat.completed / 10) * PREMIUM_EVERY_10_ORDERS_KZT;
        return {
          workerId,
          workerName: users.find((u) => u.id === workerId)?.full_name || workerId,
          completed: stat.completed,
          payoutKzt: base + premiumFirst + premiumMilestone,
        };
      })
      .sort((a, b) => b.payoutKzt - a.payoutKzt || b.completed - a.completed);

    return {
      rows,
      totalPayoutKzt: rows.reduce((acc, row) => acc + row.payoutKzt, 0),
    };
  }, [me, requests, users]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(roleScopedRequests.map((r) => r.status))).sort();
  }, [roleScopedRequests]);

  const requesterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roleScopedRequests) {
      map.set(r.requester_id, r.requester_name || r.requester_id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [roleScopedRequests]);

  const managerOptions = useMemo(() => {
    const ids = Array.from(new Set(roleScopedRequests.map((r) => r.manager_id).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, name: users.find((u) => u.id === id)?.full_name || id }));
  }, [roleScopedRequests, users]);

  const workerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const r of roleScopedRequests) {
      (r.assignee_ids || []).forEach((id) => ids.add(id));
      if (r.assignee_id) ids.add(r.assignee_id);
    }
    return Array.from(ids).map((id) => ({ id, name: users.find((u) => u.id === id)?.full_name || id }));
  }, [roleScopedRequests, users]);

  const canSeeDashboard = me ? me.role === "warehouse_manager" || me.role === "grading_manager" || isAdminLike(me.role) : false;
  const canSeeUsersTab = me ? isAdminLike(me.role) : false;
  const tutorialSteps = useMemo<TutorialStep[]>(() => {
    if (!me) return [];
    const base: TutorialStep[] = [
      {
        tab: "profile",
        title: "Профиль",
        text: "Здесь ваш личный кабинет: фото, достижения, зарплата и смена пароля.",
      },
      {
        tab: "search",
        title: "Поиск заказов",
        text: "Используйте фильтры по датам, складу, заказчику, кладовщику и статусу.",
      },
      {
        tab: "orders",
        title: "Заявки",
        text: "Основная рабочая вкладка: обработка и контроль заявок по вашей роли.",
      },
    ];
    if (canSeeDashboard) {
      base.splice(1, 0, {
        tab: "dashboard",
        title: "Дашборд",
        text: "Здесь ключевые показатели и рейтинг кладовщиков по площадкам.",
      });
    }
    if (canSeeUsersTab) {
      base.push({
        tab: "users",
        title: "Пользователи",
        text: "Во вкладке пользователи можно создавать учетные записи и управлять ролями.",
      });
    }
    return base;
  }, [me, canSeeDashboard, canSeeUsersTab]);

  async function loadFeedbackAnalyticsData(authToken: string, role: Role) {
    if (!(role === "warehouse_manager" || role === "grading_manager" || isAdminLike(role))) {
      setFeedbackAnalytics(null);
      return;
    }
    const params = new URLSearchParams();
    if (analyticsFilters.period !== "all") {
      params.set("period_days", analyticsFilters.period);
    }
    if (isAdminLike(role)) {
      params.set("site", analyticsFilters.site);
    }
    const query = params.toString();
    const path = query ? `/requests/feedback-analytics?${query}` : "/requests/feedback-analytics";
    try {
      const analyticsData = await api<FeedbackAnalytics>(path, authToken);
      setFeedbackAnalytics(analyticsData);
    } catch {
      setFeedbackAnalytics(null);
    }
  }

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

    if (meData.role === "warehouse_operator" || meData.role === "warehouse_operator_agc") {
      try {
        const salaryData = await api<SalaryPreview>("/salary/preview", authToken);
        setSalaryPreview(salaryData);
      } catch {
        setSalaryPreview(null);
      }

      try {
        const historyData = await api<AchievementHistoryItem[]>("/salary/achievements/history", authToken);
        setAchievementHistory(historyData);
      } catch {
        setAchievementHistory([]);
      }
    } else {
      setSalaryPreview(null);
      setAchievementHistory([]);
    }

    await loadFeedbackAnalyticsData(authToken, meData.role);
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
      setSalaryPreview(null);
      setAchievementHistory([]);
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

  useEffect(() => {
    if (!me) return;
    if (activeTab === "dashboard" && !canSeeDashboard) setActiveTab("profile");
    if (activeTab === "users" && !canSeeUsersTab) setActiveTab("profile");
  }, [me, activeTab, canSeeDashboard, canSeeUsersTab]);

  useEffect(() => {
    if (!me) return;
    const defaultTab = getDefaultTabForRole(me.role);
    if ((defaultTab === "dashboard" && !canSeeDashboard) || (defaultTab === "users" && !canSeeUsersTab)) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(defaultTab);
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const seenKey = `tutorial_seen_${me.id}`;
    const alreadySeen = localStorage.getItem(seenKey) === "1";
    if (!alreadySeen && tutorialSteps.length > 0) {
      setTutorialStepIndex(0);
      setTutorialOpen(true);
      localStorage.setItem(seenKey, "1");
    }
  }, [me?.id, tutorialSteps.length]);

  useEffect(() => {
    if (!tutorialOpen) return;
    const step = tutorialSteps[tutorialStepIndex];
    if (!step) return;
    setActiveTab(step.tab);
  }, [tutorialOpen, tutorialStepIndex, tutorialSteps]);

  useEffect(() => {
    if (!token || !me) return;
    if (!(me.role === "warehouse_manager" || me.role === "grading_manager" || isAdminLike(me.role))) return;
    loadFeedbackAnalyticsData(token, me.role);
  }, [analyticsFilters.period, analyticsFilters.site, token, me?.id, me?.role]);

  useEffect(() => {
    if (!token || !me) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        setAuthNotice("Вы вышли из системы из-за отсутствия активности (15 минут).");
        localStorage.removeItem("access_token");
        setToken("");
        setMe(null);
        setUsers([]);
        setRequests([]);
        setSalaryPreview(null);
        setAchievementHistory([]);
        setError("");
      }, IDLE_LOGOUT_MS);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click", "mousemove"] as const;
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [token, me]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      setAuthNotice("");
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
    setAuthNotice("");
    localStorage.removeItem("access_token");
    setToken("");
    setMe(null);
    setUsers([]);
    setRequests([]);
    setSalaryPreview(null);
    setAchievementHistory([]);
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

  async function updateMyPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      setError("");
      await api<{ status: string; message: string }>("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify(selfPasswordForm),
      });
      setSelfPasswordForm({ current_password: "", new_password: "" });
      alert("Ваш пароль успешно обновлен");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены пароля");
    }
  }

  async function uploadMyAvatar(file: File | null) {
    if (!token || !file) return;
    try {
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/auth/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(toRussianErrorMessage(text || "Ошибка загрузки аватара"));
      }
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки аватара");
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
          fulfillment_site: requestForm.fulfillment_site,
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
            throw new Error(toRussianErrorMessage(text || "Ошибка загрузки файла"));
          }
        }
      }

      setRequestForm({
        item_qty: 1,
        movement_number: "",
        comment: "",
        priority: "Обычный",
        fulfillment_site: "warehouse",
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

  async function deleteRequestByAdmin(requestId: string) {
    if (!token || !me || me.role !== "admin") return;
    if (!window.confirm("Удалить заявку без возможности восстановления?")) return;
    try {
      setError("");
      await api<{ status: string; message: string }>(`/requests/${requestId}`, token, {
        method: "DELETE",
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления заявки");
    }
  }

  function getAdminRequestEdit(request: RequestItem): AdminRequestEditForm {
    return (
      adminRequestEdits[request.id] || {
        item_qty: String(request.item_qty ?? 1),
        movement_number: request.movement_number || "",
        comment: request.comment || "",
        quality_rating: request.quality_rating ? String(request.quality_rating) : "",
        quality_comment: request.quality_comment || "",
      }
    );
  }

  function setAdminRequestEditField(requestId: string, field: keyof AdminRequestEditForm, value: string) {
    setAdminRequestEdits((old) => {
      const current = old[requestId] || {
        item_qty: "1",
        movement_number: "",
        comment: "",
        quality_rating: "",
        quality_comment: "",
      };
      return {
        ...old,
        [requestId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function saveRequestByAdmin(requestId: string) {
    if (!token || !me || me.role !== "admin") return;
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    const edit = getAdminRequestEdit(request);
    const itemQty = Number(edit.item_qty);
    if (!Number.isFinite(itemQty) || itemQty <= 0) {
      setError("Количество устройств должно быть больше 0.");
      return;
    }
    const qualityRating = edit.quality_rating.trim() ? Number(edit.quality_rating) : null;
    if (qualityRating != null && (!Number.isFinite(qualityRating) || qualityRating < 1 || qualityRating > 5)) {
      setError("Оценка должна быть от 1 до 5.");
      return;
    }
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/admin-edit`, token, {
        method: "PATCH",
        body: JSON.stringify({
          item_qty: Math.round(itemQty),
          movement_number: edit.movement_number.trim() || null,
          comment: edit.comment.trim() || null,
          quality_rating: qualityRating,
          quality_comment: edit.quality_comment.trim() || null,
        }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка редактирования заявки");
    }
  }

  async function uploadAttachmentForRequestByAdmin(requestId: string) {
    if (!token || !me || me.role !== "admin") return;
    const files = adminAttachmentFiles[requestId] || [];
    if (files.length === 0) {
      setError("Выберите файл для загрузки.");
      return;
    }
    try {
      setError("");
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/requests/${requestId}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(toRussianErrorMessage(text || "Ошибка загрузки файла"));
        }
      }
      setAdminAttachmentFiles((old) => ({ ...old, [requestId]: [] }));
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    }
  }

  async function deleteAttachmentForRequestByAdmin(requestId: string, filePath: string) {
    if (!token || !me || me.role !== "admin") return;
    try {
      setError("");
      await api<RequestItem>(`/requests/${requestId}/attachments`, token, {
        method: "DELETE",
        body: JSON.stringify({ file_path: filePath }),
      });
      await bootstrap(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления файла");
    }
  }

  async function downloadAttachment(filePath: string) {
    const publicPath = filePath.startsWith("uploads/")
      ? `${API_ORIGIN}/${filePath}`
      : `${API_ORIGIN}/uploads/${filePath}`;
    try {
      const res = await fetch(publicPath);
      if (!res.ok) {
        throw new Error("Не удалось скачать файл");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (filePath.split("/").pop() || filePath.split("\\").pop() || "attachment").trim();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания файла");
    }
  }

  function toggleAssignee(requestId: string, userId: string) {
    setSelectedAssignees((old) => {
      const prev = old[requestId] || [];
      const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId];
      return {
        ...old,
        [requestId]: next,
      };
    });
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

  function getOrCreateRatingDraft(requestId: string): RatingDraft {
    return (
      ratingDrafts[requestId] || {
        rating: 5,
        likedPoints: [],
        issuePoints: [],
        comment: "",
      }
    );
  }

  function setRatingDraft(requestId: string, patch: Partial<RatingDraft>) {
    setRatingDrafts((old) => {
      const current = old[requestId] || {
        rating: 5,
        likedPoints: [],
        issuePoints: [],
        comment: "",
      };
      return {
        ...old,
        [requestId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  function toggleRatingArrayItem(requestId: string, key: "likedPoints" | "issuePoints", value: string) {
    const draft = getOrCreateRatingDraft(requestId);
    const current = draft[key];
    const exists = current.includes(value);
    const next = exists ? current.filter((v) => v !== value) : [...current, value];
    if (key === "likedPoints") {
      setRatingDraft(requestId, { likedPoints: next });
    } else {
      setRatingDraft(requestId, { issuePoints: next });
    }
  }

  async function rateRequest(requestId: string) {
    if (!token || !me) return;
    const draft = getOrCreateRatingDraft(requestId);
    if (draft.rating <= 4 && draft.issuePoints.length === 0) {
      setError("Для оценки 4 и ниже выберите, что можно улучшить.");
      return;
    }
    try {
      setError("");
      const cleanComment = draft.comment.trim();
      await api<RequestItem>(`/requests/${requestId}/rate`, token, {
        method: "POST",
        body: JSON.stringify({
          requester_id: me.id,
          quality_rating: draft.rating,
          quality_comment: cleanComment || null,
          feedback_liked_points: draft.likedPoints,
          feedback_issue_points: draft.issuePoints,
          feedback_free_text: cleanComment || null,
        }),
      });
      setRatingDrafts((old) => {
        const next = { ...old };
        delete next[requestId];
        return next;
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
          padding: isMobile ? 12 : 24,
          paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560, display: "grid", gap: isMobile ? 16 : 24 }}>
          <Card compact={isMobile} title="Вход">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <img
                src={`/${LOGO_FILENAME}`}
                alt="Warehouse logo"
                style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, flexShrink: 0, objectFit: "contain" }}
              />
              <div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600 }}>Warehouse App</div>
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
              <Button type="submit" block={isMobile}>
                {loading ? "Входим..." : "Войти"}
              </Button>
            </form>
          </Card>

          {authNotice && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                padding: 14,
                borderRadius: 16,
              }}
            >
              {authNotice}
            </div>
          )}

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
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fc",
        padding: isMobile ? 12 : 24,
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => {
          setTutorialStepIndex(0);
          setTutorialOpen(true);
        }}
        title="Показать подсказки"
        style={{
          position: "fixed",
          top: isMobile ? 10 : 16,
          right: isMobile ? 10 : 16,
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "none",
          background: BRAND_PRIMARY,
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          boxShadow: "0 8px 20px rgba(44,38,194,0.35)",
          cursor: "pointer",
          zIndex: 20,
        }}
      >
        ?
      </button>
      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", display: "grid", gap: isMobile ? 16 : 24 }}>
        <Card compact={isMobile} title="Навигация">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "profile" as MainTab, label: "Профиль", show: true },
              { id: "dashboard" as MainTab, label: "Дашборд", show: canSeeDashboard },
              { id: "search" as MainTab, label: "Поиск заказов", show: true },
              { id: "orders" as MainTab, label: "Заявки", show: true },
              { id: "users" as MainTab, label: "Пользователи", show: canSeeUsersTab },
            ]
              .filter((x) => x.show)
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    border: activeTab === tab.id ? "none" : `1px solid ${BRAND_PRIMARY}`,
                    background: activeTab === tab.id ? BRAND_PRIMARY : "#fff",
                    color: activeTab === tab.id ? "#fff" : BRAND_PRIMARY,
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
          </div>
        </Card>

        {activeTab === "profile" && (
        <Card compact={isMobile} title="Личный кабинет">
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: isMobile ? "stretch" : "center",
                flexWrap: "wrap",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                {avatarPublicUrl(me.avatar_url) ? (
                  <img
                    src={avatarPublicUrl(me.avatar_url) || undefined}
                    alt="avatar"
                    style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 20,
                      background: getAvatarColor(me.id),
                    }}
                  >
                    {getInitials(me.full_name)}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, wordBreak: "break-word" }}>{me.full_name}</div>
                  <div style={{ color: "#475569", marginTop: 8, fontSize: isMobile ? 13 : 14, wordBreak: "break-all" }}>
                    Email: <span style={{ fontWeight: 600 }}>{me.email}</span>
                    <br />
                    Роль: <span style={{ fontWeight: 600 }}>{getRoleLabel(me.role)}</span>
                  </div>
                </div>
              </div>
              <SecondaryButton block={isMobile} onClick={handleLogout}>
                Выйти
              </SecondaryButton>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ cursor: "pointer" }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  style={{ display: "none" }}
                  onChange={(e) => uploadMyAvatar(e.target.files?.[0] || null)}
                />
                <span
                  style={{
                    display: "inline-block",
                    border: `1px solid ${BRAND_PRIMARY}`,
                    color: BRAND_PRIMARY,
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontWeight: 600,
                  }}
                >
                  Загрузить фото профиля
                </span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {(me.role === "warehouse_operator" || me.role === "warehouse_operator_agc") && (
                <>
                  <div style={{ borderRadius: 14, padding: 12, background: "#eef2ff" }}>
                    <div style={{ fontSize: 12, color: "#4338ca" }}>Выполнено как кладовщик</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#1e1b4b" }}>{myProfileStats.assignedDoneCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#ecfeff" }}>
                    <div style={{ fontSize: 12, color: "#0e7490" }}>Сейчас в работе</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#164e63" }}>{myProfileStats.inProgressCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#f0fdf4" }}>
                    <div style={{ fontSize: 12, color: "#15803d" }}>Среднее время</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#14532d" }}>{formatDuration(myProfileStats.avgSeconds)}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#fff7ed" }}>
                    <div style={{ fontSize: 12, color: "#c2410c" }}>Самый быстрый заказ</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#7c2d12" }}>{formatDuration(myProfileStats.bestSeconds)}</div>
                  </div>
                </>
              )}
              {me.role === "requester" && (
                <>
                  <div style={{ borderRadius: 14, padding: 12, background: "#eef2ff" }}>
                    <div style={{ fontSize: 12, color: "#4338ca" }}>Закрыто заявок</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#1e1b4b" }}>{myProfileStats.requesterDoneCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#ecfeff" }}>
                    <div style={{ fontSize: 12, color: "#0e7490" }}>Всего моих заявок</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#164e63" }}>{requests.filter((r) => r.requester_id === me.id).length}</div>
                  </div>
                </>
              )}
              {(me.role === "warehouse_manager" || me.role === "grading_manager") && (
                <>
                  <div style={{ borderRadius: 14, padding: 12, background: "#eef2ff" }}>
                    <div style={{ fontSize: 12, color: "#4338ca" }}>В работе</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#1e1b4b" }}>
                      {roleScopedRequests.filter((r) => r.status === "in_progress").length}
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#ecfeff" }}>
                    <div style={{ fontSize: 12, color: "#0e7490" }}>Количество заявок</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#164e63" }}>{roleScopedRequests.length}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#f0fdf4" }}>
                    <div style={{ fontSize: 12, color: "#166534" }}>Выполнено</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#14532d" }}>
                      {roleScopedRequests.filter((r) => ["assembled", "approved", "rated"].includes(r.status)).length}
                    </div>
                  </div>
                </>
              )}
              {isAdminLike(me.role) && (
                <>
                  <div style={{ borderRadius: 14, padding: 12, background: "#eef2ff" }}>
                    <div style={{ fontSize: 12, color: "#4338ca" }}>Всего пользователей</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#1e1b4b" }}>{users.length}</div>
                  </div>
                  <div style={{ borderRadius: 14, padding: 12, background: "#ecfeff" }}>
                    <div style={{ fontSize: 12, color: "#0e7490" }}>Всего заявок в системе</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#164e63" }}>{requests.length}</div>
                  </div>
                </>
              )}
            </div>

            {(me.role === "warehouse_operator" || me.role === "warehouse_operator_agc") && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fafafa" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Ачивки</div>
                  {myProfileStats.achievements.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Пока нет достижений. Соберите первый заказ!</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {myProfileStats.achievements.map((a) => (
                        <div key={a}>{a}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 12, borderTop: "1px dashed #cbd5e1", paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>История достижений</div>
                    {achievementHistory.length === 0 ? (
                      <div style={{ color: "#64748b" }}>История пока пуста.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {achievementHistory.slice(0, 8).map((item) => (
                          <div key={`${item.code}-${item.achieved_at}`} style={{ borderRadius: 10, padding: 8, background: "#fff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: "#475569", textTransform: "uppercase" }}>{item.level}</div>
                            </div>
                            <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{item.description}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                              {formatDateTime(item.achieved_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fafafa", display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>Расчет зарплаты и премии</div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Ставка: <b>{formatCurrencyKZT(WORKER_MINUTE_RATE_KZT)}</b> за минуту.
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Учтенное время: <b>{formatDuration(myProfileStats.totalDurationSeconds)}</b>.
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    База: <b>{formatCurrencyKZT(myProfileStats.basePayKzt)}</b>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Премия за 1-й заказ: <b>{formatCurrencyKZT(myProfileStats.premiumFirstOrderKzt)}</b>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Премия за каждые 10 заказов: <b>{formatCurrencyKZT(myProfileStats.premiumMilestoneKzt)}</b>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Премия за скорость: <b>{formatCurrencyKZT(myProfileStats.premiumSpeedKzt)}</b>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Премия топ-кладовщика: <b>{formatCurrencyKZT(myProfileStats.premiumTopWorkerKzt)}</b>
                  </div>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Всего премий: <b>{formatCurrencyKZT(myProfileStats.premiumTotalKzt)}</b>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
                    Итого к выплате: {formatCurrencyKZT(myProfileStats.payoutTotalKzt)}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    В расчете сейчас не учитываются штрафы и налоги.
                  </div>
                </div>
              </div>
            )}

            {(me.role === "warehouse_manager" || me.role === "grading_manager") && (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fafafa", display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>
                  Бонусы команды ({me.role === "warehouse_manager" ? "кладовщики склада" : "кладовщики Stock in AGC"})
                </div>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Оценка потенциальных выплат по сотрудникам вашей площадки.
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  Сумма по площадке: {formatCurrencyKZT(managerBonusByWorkers.totalPayoutKzt)}
                </div>
                {managerBonusByWorkers.rows.length === 0 ? (
                  <div style={{ color: "#64748b" }}>Данные пока не накоплены.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {managerBonusByWorkers.rows.slice(0, 8).map((row) => (
                      <div
                        key={row.workerId}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: 8,
                          background: "#fff",
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div>{row.workerName}</div>
                        <div style={{ color: "#475569" }}>Выполнено: {row.completed}</div>
                        <div style={{ fontWeight: 700 }}>{formatCurrencyKZT(row.payoutKzt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <SecondaryButton onClick={() => setShowPasswordForm((v) => !v)}>
                {showPasswordForm ? "Скрыть смену пароля" : "Сменить пароль"}
              </SecondaryButton>
              {showPasswordForm && (
                <form onSubmit={updateMyPassword} style={{ display: "grid", gap: 8 }}>
                  <PasswordField
                    placeholder="Текущий пароль"
                    value={selfPasswordForm.current_password}
                    onChange={(value) => setSelfPasswordForm((old) => ({ ...old, current_password: value }))}
                  />
                  <PasswordField
                    placeholder="Новый пароль"
                    value={selfPasswordForm.new_password}
                    onChange={(value) => setSelfPasswordForm((old) => ({ ...old, new_password: value }))}
                  />
                  <Button type="submit" block={isMobile}>
                    Обновить мой пароль
                  </Button>
                </form>
              )}
            </div>
          </div>
        </Card>
        )}

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

        {activeTab === "dashboard" && (me.role === "warehouse_manager" || me.role === "grading_manager" || isAdminLike(me.role)) && (
          <Card compact={isMobile} title="Дашборд производительности">
            <div style={{ display: "grid", gap: 16 }}>
              {(isAdminLike(me.role)
                ? [dashboardBySite.warehouse, dashboardBySite.stock_in_agc]
                : [me.role === "warehouse_manager" ? dashboardBySite.warehouse : dashboardBySite.stock_in_agc]
              ).map((d) => (
                <div
                  key={d.site}
                  style={{
                    border: "1px solid #dbeafe",
                    borderRadius: 16,
                    padding: isMobile ? 12 : 16,
                    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 65%)",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#1e3a8a" }}>
                      {d.site === "warehouse" ? "Склад" : "Stock in AGC (грейдинг)"}
                    </div>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      Среднее время: <b>{formatDuration(d.avgSeconds)}</b>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8 }}>
                    {[
                      { label: "Всего", value: d.total, color: "#1e3a8a", bg: "#dbeafe" },
                      { label: "Выполнено", value: d.completed, color: "#166534", bg: "#dcfce7" },
                      { label: "В работе", value: d.inProgress, color: "#0f766e", bg: "#ccfbf1" },
                      { label: "На паузе", value: d.paused, color: "#92400e", bg: "#fef3c7" },
                      { label: "Просрочено", value: d.overdue, color: "#991b1b", bg: "#fee2e2" },
                    ].map((kpi) => (
                      <div key={kpi.label} style={{ borderRadius: 12, padding: 10, background: kpi.bg }}>
                        <div style={{ fontSize: 12, color: kpi.color }}>{kpi.label}</div>
                        <div style={{ fontWeight: 800, fontSize: 22, color: kpi.color }}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr", gap: 10 }}>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>👑 Топ кладовщик</div>
                      {d.topWorker ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              background: getAvatarColor(d.topWorker.workerId),
                              color: "#fff",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {getInitials(d.topWorker.workerName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{d.topWorker.workerName}</div>
                            <div style={{ color: "#475569", fontSize: 14 }}>Заказов: {d.topWorker.count}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: "#64748b" }}>Пока нет завершенных заказов.</div>
                      )}
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Рейтинг кладовщиков</div>
                      {d.ranking.length === 0 ? (
                        <div style={{ color: "#64748b" }}>Данные пока не накоплены.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {d.ranking.map((w, idx) => (
                            <div key={w.workerId} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
                              <div style={{ color: "#64748b", fontWeight: 700, width: 22 }}>{idx + 1}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <div
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: "50%",
                                    background: getAvatarColor(w.workerId),
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {getInitials(w.workerName)}
                                </div>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.workerName}</div>
                              </div>
                              <div style={{ color: "#1e293b", fontWeight: 600 }}>{w.count}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: isMobile ? 12 : 16,
                  background: "#ffffff",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>Аналитика оценок заказчиков</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <Select
                    value={analyticsFilters.period}
                    onChange={(e) =>
                      setAnalyticsFilters((old) => ({
                        ...old,
                        period: e.target.value as AnalyticsFilters["period"],
                      }))
                    }
                  >
                    <option value="all">Период: за все время</option>
                    <option value="7">Период: 7 дней</option>
                    <option value="30">Период: 30 дней</option>
                    <option value="90">Период: 90 дней</option>
                  </Select>
                  <Select
                    value={analyticsFilters.site}
                    disabled={!isAdminLike(me.role)}
                    onChange={(e) =>
                      setAnalyticsFilters((old) => ({
                        ...old,
                        site: e.target.value as AnalyticsFilters["site"],
                      }))
                    }
                  >
                    <option value="all">Площадка: все</option>
                    <option value="warehouse">Площадка: склад</option>
                    <option value="stock_in_agc">Площадка: Stock in AGC</option>
                  </Select>
                </div>
                {!feedbackAnalytics ? (
                  <div style={{ color: "#64748b" }}>Пока нет данных по оценкам.</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8 }}>
                      <div style={{ borderRadius: 12, padding: 10, background: "#ecfeff" }}>
                        <div style={{ fontSize: 12, color: "#155e75" }}>Всего оценок</div>
                        <div style={{ fontWeight: 800, fontSize: 22, color: "#0e7490" }}>{feedbackAnalytics.total_rated}</div>
                      </div>
                      <div style={{ borderRadius: 12, padding: 10, background: "#fef9c3" }}>
                        <div style={{ fontSize: 12, color: "#854d0e" }}>Средняя оценка</div>
                        <div style={{ fontWeight: 800, fontSize: 22, color: "#a16207" }}>
                          {feedbackAnalytics.average_rating != null ? feedbackAnalytics.average_rating.toFixed(2) : "—"}
                        </div>
                      </div>
                      <div style={{ borderRadius: 12, padding: 10, background: "#eef2ff" }}>
                        <div style={{ fontSize: 12, color: "#3730a3" }}>5 звезд</div>
                        <div style={{ fontWeight: 800, fontSize: 22, color: "#4338ca" }}>
                          {feedbackAnalytics.rating_distribution["5"] || 0}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <div style={{ border: "1px solid #dbeafe", borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: "#1e3a8a" }}>Что чаще всего нравится</div>
                        {feedbackAnalytics.top_liked_points.length === 0 ? (
                          <div style={{ color: "#64748b" }}>Пока нет отмеченных пунктов.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {feedbackAnalytics.top_liked_points.map((item) => (
                              <div key={item.point} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span>{item.point}</span>
                                <b>{item.count}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ border: "1px solid #fecaca", borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: "#991b1b" }}>Что чаще всего не заходит</div>
                        {feedbackAnalytics.top_issue_points.length === 0 ? (
                          <div style={{ color: "#64748b" }}>Пока нет проблемных пунктов.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {feedbackAnalytics.top_issue_points.map((item) => (
                              <div key={item.point} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span>{item.point}</span>
                                <b>{item.count}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === "users" && isAdminLike(me.role) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr",
              gap: isMobile ? 16 : 24,
            }}
          >
            <Card compact={isMobile} title="Создать пользователя">
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
                  <option value="warehouse_operator">Кладовщик (склад)</option>
                  <option value="grading_manager">Руководитель грейдинга</option>
                  <option value="warehouse_operator_agc">Кладовщик Stock in AGC</option>
                  <option value="admin">Администратор</option>
                  <option value="general_director">Генеральный директор</option>
                  <option value="commercial_director">Коммерческий директор</option>
                </Select>
                <Button type="submit" block={isMobile}>
                  Создать пользователя
                </Button>
              </form>
            </Card>

            <Card compact={isMobile} title="Пользователи и роли">
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
                          <option value="general_director">Генеральный директор</option>
                          <option value="commercial_director">Коммерческий директор</option>
                          <option value="requester">Заказчик</option>
                          <option value="warehouse_manager">Заведующий складом</option>
                          <option value="warehouse_operator">Кладовщик (склад)</option>
                          <option value="grading_manager">Руководитель грейдинга</option>
                          <option value="warehouse_operator_agc">Кладовщик Stock in AGC</option>
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

        {activeTab === "orders" && me.role === "requester" && (
          <Card compact={isMobile} title="Создание заявки">
            <form onSubmit={createRequest} style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Тип работы</div>
              <Input value="Сборка устройств / аксессуаров" readOnly />

              <div style={{ fontSize: 14, color: "#475569", marginBottom: -4 }}>Где выполнять сборку</div>
              <Select
                value={requestForm.fulfillment_site}
                onChange={(e) =>
                  setRequestForm({
                    ...requestForm,
                    fulfillment_site: e.target.value as RequestForm["fulfillment_site"],
                  })
                }
              >
                <option value="warehouse">На складе</option>
                <option value="stock_in_agc">Stock in AGC (грейдинг)</option>
              </Select>

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

              <Button type="submit" block={isMobile}>
                Создать заявку
              </Button>
            </form>
          </Card>
        )}

        {activeTab === "search" && (
        <Card compact={isMobile} title="Поиск заказов">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
            <Input
              placeholder="Поиск: номер, заказчик, комментарий..."
              value={requestFilters.query}
              onChange={(e) => setRequestFilters((old) => ({ ...old, query: e.target.value }))}
            />
            <Select
              value={requestFilters.period}
              onChange={(e) => setRequestFilters((old) => ({ ...old, period: e.target.value as RequestFilters["period"] }))}
            >
              <option value="all">Период: всё время</option>
              <option value="today">Только сегодня</option>
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="90">Последние 90 дней</option>
            </Select>
            <Select
              value={requestFilters.site}
              onChange={(e) => setRequestFilters((old) => ({ ...old, site: e.target.value as RequestFilters["site"] }))}
            >
              <option value="all">Склад: все</option>
              <option value="warehouse">Склад</option>
              <option value="stock_in_agc">Stock in AGC</option>
            </Select>
            <Select
              value={requestFilters.status}
              onChange={(e) => setRequestFilters((old) => ({ ...old, status: e.target.value }))}
            >
              <option value="all">Статус: все</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {getStatusLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              value={requestFilters.requesterId}
              onChange={(e) => setRequestFilters((old) => ({ ...old, requesterId: e.target.value }))}
            >
              <option value="all">Заказчик: все</option>
              {requesterOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Select
              value={requestFilters.workerId}
              onChange={(e) => setRequestFilters((old) => ({ ...old, workerId: e.target.value }))}
            >
              <option value="all">Кладовщик: все</option>
              {workerOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Select
              value={requestFilters.managerId}
              onChange={(e) => setRequestFilters((old) => ({ ...old, managerId: e.target.value }))}
            >
              <option value="all">Руководитель: все</option>
              {managerOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Select
              value={requestFilters.sortBy}
              onChange={(e) => setRequestFilters((old) => ({ ...old, sortBy: e.target.value as RequestsSort }))}
            >
              <option value="created_desc">Сортировка: новые сверху</option>
              <option value="created_asc">Сортировка: старые сверху</option>
              <option value="deadline_asc">Срок: ближний сначала</option>
              <option value="deadline_desc">Срок: дальний сначала</option>
              <option value="duration_asc">Длительность: быстрее сначала</option>
              <option value="duration_desc">Длительность: дольше сначала</option>
              <option value="priority_desc">Приоритет: высокий сначала</option>
              <option value="priority_asc">Приоритет: обычный сначала</option>
            </Select>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SecondaryButton
              onClick={() =>
                setRequestFilters({
                  period: "all",
                  site: "all",
                  status: "all",
                  requesterId: "all",
                  workerId: "all",
                  managerId: "all",
                  query: "",
                  sortBy: "created_desc",
                })
              }
            >
              Сбросить фильтры
            </SecondaryButton>
            <div style={{ alignSelf: "center", color: "#475569", fontSize: 14 }}>
              Показано заявок: <b>{visibleRequests.length}</b>
            </div>
          </div>
        </Card>
        )}

        {activeTab === "orders" && (
        <Card compact={isMobile} title="Заявки">
          <div style={{ display: "grid", gap: 14 }}>
            {visibleRequests.map((request) => (
              (() => {
                const priorityBadge = getPriorityBadge(request.priority);
                return (
              <div
                key={request.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: isMobile ? 14 : 20,
                  padding: isMobile ? 12 : 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "stretch" : "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 600, wordBreak: "break-word" }}>{request.request_number}</div>
                    <div style={{ color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      {(() => {
                        const requester = users.find((u) => u.id === request.requester_id);
                        const avatarPath =
                          requester?.avatar_url ||
                          (me.id === request.requester_id ? me.avatar_url : null);
                        const avatarUrl = avatarPublicUrl(avatarPath);
                        return avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="requester-avatar"
                            style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: getAvatarColor(request.requester_id),
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(request.requester_name)}
                          </div>
                        );
                      })()}
                      <span>{request.requester_name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: isMobile ? "left" : "right", color: "#334155", fontSize: isMobile ? 13 : 14 }}>
                    <div>
                      Приоритет:{" "}
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          border: `1px solid ${priorityBadge.border}`,
                          background: priorityBadge.bg,
                          color: priorityBadge.color,
                        }}
                      >
                        {priorityBadge.label}
                      </span>
                    </div>
                    <div>Статус: <span style={{ fontWeight: 600 }}>{getStatusLabel(request.status)}</span></div>
                    <div>Норматив: <span style={{ fontWeight: 600 }}>{formatDeadline(request.deadline_seconds)}</span></div>
                    <div>Дедлайн до: <span style={{ fontWeight: 600 }}>{formatDateTime(request.deadline_at)}</span></div>
                    <div>
                      Факт:{" "}
                      <span style={{ fontWeight: 600 }}>
                        {formatDuration(request.active_duration_seconds ?? request.duration_seconds)}
                      </span>
                    </div>
                    <div>Перерывы: <span style={{ fontWeight: 600 }}>{formatDuration(request.total_pause_seconds)}</span></div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 6, color: "#334155", fontSize: 14 }}>
                  <div>Площадка: <span style={{ fontWeight: 600 }}>{getFulfillmentSiteLabel(request.fulfillment_site)}</span></div>
                  <div>Комментарий: {request.comment || "—"}</div>
                  <div>Старт: {formatDateTime(request.started_at)}</div>
                  <div>Финиш: {formatDateTime(request.finished_at)}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    Комментарий при паузе (кладовщик): {request.pause_comment || "—"}
                  </div>
                  <div>Комментарий руководителя: {request.manager_comment || "—"}</div>
                  <div>
                    Оценка заказчика:{" "}
                    <span style={{ color: "#d97706", fontSize: 20, letterSpacing: 1 }}>
                      {renderStars(request.quality_rating)}
                    </span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    Фидбек заказчика: {request.feedback_free_text || request.quality_comment || "—"}
                  </div>
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
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span>Файл {idx + 1}</span>
                            <SecondaryButton onClick={() => downloadAttachment(filePath)}>Скачать</SecondaryButton>
                            {me.role === "admin" && (
                              <DangerButton onClick={() => deleteAttachmentForRequestByAdmin(request.id, filePath)}>
                                Удалить файл
                              </DangerButton>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "stretch" : "flex-start",
                  }}
                >
                  {me.role === "admin" && (
                    <div
                      style={{
                        width: "100%",
                        display: "grid",
                        gap: 8,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 10,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>Редактирование заявки (админ)</div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <Input
                          type="number"
                          min={1}
                          value={getAdminRequestEdit(request).item_qty}
                          onChange={(e) => setAdminRequestEditField(request.id, "item_qty", e.target.value)}
                          placeholder="Количество устройств"
                        />
                        <Input
                          value={getAdminRequestEdit(request).movement_number}
                          onChange={(e) => setAdminRequestEditField(request.id, "movement_number", e.target.value)}
                          placeholder="Номер перемещения"
                        />
                      </div>
                      <Textarea
                        value={getAdminRequestEdit(request).comment}
                        onChange={(e) => setAdminRequestEditField(request.id, "comment", e.target.value)}
                        placeholder="Информация/комментарий по заявке"
                      />
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "120px 1fr", gap: 8 }}>
                        <Select
                          value={getAdminRequestEdit(request).quality_rating}
                          onChange={(e) => setAdminRequestEditField(request.id, "quality_rating", e.target.value)}
                        >
                          <option value="">Без оценки</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </Select>
                        <Input
                          value={getAdminRequestEdit(request).quality_comment}
                          onChange={(e) => setAdminRequestEditField(request.id, "quality_comment", e.target.value)}
                          placeholder="Комментарий к оценке"
                        />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          type="file"
                          onChange={(e) =>
                            setAdminAttachmentFiles((old) => ({
                              ...old,
                              [request.id]: e.target.files ? Array.from(e.target.files) : [],
                            }))
                          }
                        />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button block={isMobile} onClick={() => saveRequestByAdmin(request.id)}>
                            Сохранить изменения
                          </Button>
                          <SecondaryButton block={isMobile} onClick={() => uploadAttachmentForRequestByAdmin(request.id)}>
                            Загрузить файл в заявку
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  )}

                  {me.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => deleteRequestByAdmin(request.id)}
                      style={{
                        border: "1px solid #ef4444",
                        color: "#b91c1c",
                        background: "#fff",
                        borderRadius: 12,
                        padding: "8px 12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      Удалить заявку
                    </button>
                  )}

                  {me.role === "warehouse_manager" &&
                    requestSite(request) === "warehouse" &&
                    (request.status === "new" || request.status === "returned_to_work") &&
                    warehouseOperators.length > 0 && (
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 14, color: "#475569" }}>Назначить кладовщиков (склад)</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {warehouseOperators.map((u) => {
                          const selected = (selectedAssignees[request.id] || []).includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleAssignee(request.id, u.id)}
                              style={{
                                border: selected ? "1px solid #4338ca" : "1px solid #cbd5e1",
                                background: selected ? "#eef2ff" : "#fff",
                                color: selected ? "#312e81" : "#334155",
                                borderRadius: 999,
                                padding: "7px 12px",
                                fontWeight: selected ? 700 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {selected ? "✓ " : ""}{u.full_name}
                            </button>
                          );
                        })}
                      </div>
                      <Button block={isMobile} onClick={() => assignRequest(request.id)}>
                        Назначить
                      </Button>
                    </div>
                  )}

                  {me.role === "grading_manager" &&
                    requestSite(request) === "stock_in_agc" &&
                    (request.status === "new" || request.status === "returned_to_work") &&
                    agcOperators.length > 0 && (
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 14, color: "#475569" }}>Назначить кладовщиков Stock in AGC</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {agcOperators.map((u) => {
                          const selected = (selectedAssignees[request.id] || []).includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleAssignee(request.id, u.id)}
                              style={{
                                border: selected ? "1px solid #4338ca" : "1px solid #cbd5e1",
                                background: selected ? "#eef2ff" : "#fff",
                                color: selected ? "#312e81" : "#334155",
                                borderRadius: 999,
                                padding: "7px 12px",
                                fontWeight: selected ? 700 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {selected ? "✓ " : ""}{u.full_name}
                            </button>
                          );
                        })}
                      </div>
                      <Button block={isMobile} onClick={() => assignRequest(request.id)}>
                        Назначить
                      </Button>
                    </div>
                  )}

                  {canOperateAsWarehouseWorker(me, request) && request.status === "assigned" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <Button block={isMobile} onClick={() => startRequest(request.id)}>
                      Взять в работу
                    </Button>
                  )}

                  {canOperateAsWarehouseWorker(me, request) && request.status === "in_progress" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        width: "100%",
                        flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "stretch" : "flex-start",
                      }}
                    >
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
                      <Button block={isMobile} onClick={() => finishRequest(request.id)}>
                        Завершить сборку
                      </Button>
                      <SecondaryButton block={isMobile} onClick={() => pauseRequest(request.id)}>
                        Поставить на паузу
                      </SecondaryButton>
                    </div>
                  )}

                  {canOperateAsWarehouseWorker(me, request) && request.status === "paused" && (
                    request.assignee_ids?.includes(me.id) || request.assignee_id === me.id
                  ) && (
                    <SuccessButton block={isMobile} onClick={() => resumeRequest(request.id)}>
                      Продолжить работу
                    </SuccessButton>
                  )}

                  {me.role === "warehouse_manager" &&
                    requestSite(request) === "warehouse" &&
                    request.status === "assembled" &&
                    request.manager_id === me.id && (
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
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          flexDirection: isMobile ? "column" : "row",
                          alignItems: isMobile ? "stretch" : "flex-start",
                        }}
                      >
                        <SuccessButton block={isMobile} onClick={() => approveRequest(request.id)}>
                          Подтвердить
                        </SuccessButton>
                        <SecondaryButton block={isMobile} onClick={() => returnToWork(request.id)}>
                          Вернуть в работу
                        </SecondaryButton>
                      </div>
                    </div>
                  )}

                  {me.role === "grading_manager" &&
                    requestSite(request) === "stock_in_agc" &&
                    request.status === "assembled" &&
                    request.manager_id === me.id && (
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <Textarea
                        placeholder="Комментарий руководителя грейдинга"
                        value={managerComments[request.id] || ""}
                        onChange={(e) =>
                          setManagerComments((old) => ({
                            ...old,
                            [request.id]: e.target.value,
                          }))
                        }
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          flexDirection: isMobile ? "column" : "row",
                          alignItems: isMobile ? "stretch" : "flex-start",
                        }}
                      >
                        <SuccessButton block={isMobile} onClick={() => approveRequest(request.id)}>
                          Подтвердить
                        </SuccessButton>
                        <SecondaryButton block={isMobile} onClick={() => returnToWork(request.id)}>
                          Вернуть в работу
                        </SecondaryButton>
                      </div>
                    </div>
                  )}

                  {me.role === "requester" && request.status === "approved" && request.requester_id === me.id && (
                    <div
                      style={{
                        width: "100%",
                        display: "grid",
                        gap: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 12,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>Оцените сборку</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map((rating) => {
                          const currentRating = getOrCreateRatingDraft(request.id).rating;
                          const active = rating <= currentRating;
                          return (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => setRatingDraft(request.id, { rating })}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: active ? "#f59e0b" : "#cbd5e1",
                                padding: "4px 2px",
                                cursor: "pointer",
                                fontSize: 42,
                                lineHeight: 1,
                                textShadow: active ? "0 2px 6px rgba(245,158,11,0.45)" : "none",
                                transform: active ? "scale(1.04)" : "scale(1)",
                              }}
                              title={`Поставить ${rating} из 5`}
                            >
                              ★
                            </button>
                          );
                        })}
                        <span style={{ marginLeft: 8, fontWeight: 700, color: "#92400e" }}>
                          {getOrCreateRatingDraft(request.id).rating}/5
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: "#334155" }}>Что понравилось:</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {RATING_POSITIVE_OPTIONS.map((item) => {
                          const selected = getOrCreateRatingDraft(request.id).likedPoints.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleRatingArrayItem(request.id, "likedPoints", item)}
                              style={{
                                border: "1px solid #bfdbfe",
                                borderRadius: 999,
                                background: selected ? "#dbeafe" : "#fff",
                                color: "#1e3a8a",
                                padding: "6px 10px",
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>

                      {getOrCreateRatingDraft(request.id).rating <= 4 && (
                        <>
                          <div style={{ fontSize: 13, color: "#334155" }}>Что не зашло:</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {RATING_ISSUE_OPTIONS.map((item) => {
                              const selected = getOrCreateRatingDraft(request.id).issuePoints.includes(item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => toggleRatingArrayItem(request.id, "issuePoints", item)}
                                  style={{
                                    border: "1px solid #fecaca",
                                    borderRadius: 999,
                                    background: selected ? "#fee2e2" : "#fff",
                                    color: "#991b1b",
                                    padding: "6px 10px",
                                    cursor: "pointer",
                                    fontSize: 12,
                                  }}
                                >
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      <Textarea
                        placeholder="Комментарий (что хорошо, что улучшить)"
                        value={getOrCreateRatingDraft(request.id).comment}
                        onChange={(e) => setRatingDraft(request.id, { comment: e.target.value })}
                      />

                      <SuccessButton block={isMobile} onClick={() => rateRequest(request.id)}>
                        Отправить оценку
                      </SuccessButton>
                    </div>
                  )}
                </div>
              </div>
                );
              })()
            ))}

            {visibleRequests.length === 0 && <div style={{ color: "#64748b" }}>Заявок пока нет.</div>}
          </div>
        </Card>
        )}
      </div>
      {tutorialOpen && tutorialSteps[tutorialStepIndex] && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.25)",
            zIndex: 30,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 10 : 20,
          }}
          onClick={() => setTutorialOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #dbe3ef",
              boxShadow: "0 20px 40px rgba(15,23,42,0.25)",
              padding: 16,
              display: "grid",
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, color: "#475569" }}>
              Шаг {tutorialStepIndex + 1} из {tutorialSteps.length}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              {tutorialSteps[tutorialStepIndex].title}
            </div>
            <div style={{ color: "#334155", lineHeight: 1.45 }}>
              {tutorialSteps[tutorialStepIndex].text}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", marginTop: 6 }}>
              <SecondaryButton onClick={() => setTutorialOpen(false)}>Закрыть</SecondaryButton>
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryButton
                  onClick={() => setTutorialStepIndex((i) => Math.max(0, i - 1))}
                >
                  Назад
                </SecondaryButton>
                {tutorialStepIndex < tutorialSteps.length - 1 ? (
                  <Button onClick={() => setTutorialStepIndex((i) => Math.min(tutorialSteps.length - 1, i + 1))}>
                    Далее
                  </Button>
                ) : (
                  <SuccessButton onClick={() => setTutorialOpen(false)}>Готово</SuccessButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
