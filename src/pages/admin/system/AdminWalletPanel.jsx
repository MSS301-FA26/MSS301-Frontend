import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
  XCircle, RefreshCw, Search, Eye, ChevronDown, DollarSign,
  TrendingUp, TrendingDown, AlertCircle, CreditCard,
  AlertTriangle, Copy, Check, ArrowLeft, ShieldAlert,
  Building2, User, Calendar, Hash, FileText, ChevronRight, X
} from "lucide-react";
import { adminService } from "../../../services/adminService";

const fmtVND = (v) => `${Number(v || 0).toLocaleString("vi-VN")}đ`;
const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_CONFIG = {
  PENDING:  { label: "Chờ xử lý",   color: "#f59e0b", bg: "rgba(245,158,11,0.14)", icon: Clock },
  PAID:     { label: "Đã chuyển",    color: "#10b981", bg: "rgba(16,185,129,0.14)",  icon: CheckCircle2 },
  REJECTED: { label: "Từ chối",      color: "#f43f5e", bg: "rgba(244,63,94,0.14)",   icon: XCircle },
};

const QUICK_REJECT_REASONS = [
  "Thông tin số tài khoản hoặc ngân hàng thụ hưởng không chính xác",
  "Tên chủ tài khoản không trùng khớp với thông tin người dùng",
  "Ngân hàng thụ hưởng từ chối nhận tiền / đang bảo trì hệ thống",
  "Tài khoản thụ hưởng đã bị khóa hoặc không hỗ trợ nhận tiền 24/7",
  "Yêu cầu rút tiền chưa thỏa mãn điều kiện hạn mức giao dịch quy định",
  "Phát hiện nghi vấn bảo mật tài khoản, vui lòng liên hệ CSKH",
];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}35`,
      fontFamily: "Inter, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
};

const KpiCard = ({ label, value, icon: Icon, accent, sub }) => (
  <div style={{
    background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: -30, right: -30, width: 90, height: 90, borderRadius: "50%",
      background: `radial-gradient(circle, ${accent}25 0%, transparent 70%)`, pointerEvents: "none",
    }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}>
        {label}
      </span>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${accent}30` }}>
        <Icon size={16} color={accent} />
      </div>
    </div>
    <div>
      <span style={{ display: "block", fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif", marginTop: 4, display: "block" }}>{sub}</span>}
    </div>
  </div>
);

export default function AdminWalletPanel({ ctx }) {
  const { activeTab, getAdminToken, showToast, playPulseSound } = ctx;

  const [dashboard, setDashboard] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wdPage, setWdPage] = useState({ page: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [selectedWd, setSelectedWd] = useState(null);
  const [processNote, setProcessNote] = useState("");
  const [processMethod] = useState("BANK_TRANSFER");
  const [txPage, setTxPage] = useState(0);

  // Bank metadata from VietQR API
  const [bankList, setBankList] = useState([]);

  // Rejection handling state
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [copiedField, setCopiedField] = useState(null);

  // Load VietQR bank logos for authentic look
  useEffect(() => {
    fetch('https://api.vietqr.io/v2/banks')
      .then(r => r.json())
      .then(d => setBankList(d.data || []))
      .catch(() => { });
  }, []);

  const getBankLogo = useCallback((bankName) => {
    if (!bankName || !bankList.length) return null;
    const clean = String(bankName).trim().toLowerCase();
    const found = bankList.find(b =>
      (b.short_name && b.short_name.toLowerCase() === clean) ||
      (b.shortName && b.shortName.toLowerCase() === clean) ||
      (b.code && b.code.toLowerCase() === clean) ||
      (b.name && b.name.toLowerCase().includes(clean))
    );
    return found?.logo || null;
  }, [bankList]);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    showToast?.(`Đã sao chép: ${text}`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleCloseModal = () => {
    setSelectedWd(null);
    setIsRejectMode(false);
    setRejectReason("");
    setRejectError("");
    setProcessNote("");
  };

  const fetchDashboard = useCallback(async () => {
    const token = getAdminToken?.(false);
    if (!token) return;
    try {
      const data = await adminService.getWalletDashboard(token);
      setDashboard(data);
    } catch (e) { console.error("Dashboard fetch failed", e); }
  }, [getAdminToken]);

  const fetchWithdrawals = useCallback(async (page = 0) => {
    const token = getAdminToken?.(false);
    if (!token) return;
    setIsLoading(true);
    try {
      const params = { page, size: 10 };
      if (statusFilter) params.status = statusFilter;
      const data = await adminService.getAdminWithdrawals(token, params);
      const items = data?.content || data?.items || (Array.isArray(data) ? data : []);
      setWithdrawals(items);
      setWdPage({ page: data?.page ?? data?.number ?? page, totalPages: data?.totalPages ?? 1 });
    } catch (e) { console.error("Withdrawals fetch failed", e); }
    finally { setIsLoading(false); }
  }, [getAdminToken, statusFilter]);

  useEffect(() => {
    if (activeTab !== "cinewallet") return;
    fetchDashboard();
    fetchWithdrawals(0);
  }, [activeTab, fetchDashboard, fetchWithdrawals]);

  const handleApprove = async (wd) => {
    const token = getAdminToken?.();
    if (!token) return;
    setProcessing(wd.id);
    try {
      await adminService.approveWithdrawal(token, wd.id, { method: processMethod, note: processNote || "Đã chuyển khoản thành công" });
      showToast?.("Đã duyệt yêu cầu rút tiền #" + wd.id);
      playPulseSound?.(600, "sine", 0.06);
      handleCloseModal();
      fetchWithdrawals(wdPage.page);
      fetchDashboard();
    } catch (e) { showToast?.("Lỗi: " + (e.message || "Không thể duyệt")); }
    finally { setProcessing(null); }
  };

  const handleReject = async (wd, reason) => {
    const finalReason = (reason ?? rejectReason)?.trim();
    if (!finalReason) {
      setRejectError("Vui lòng nhập hoặc chọn lý do từ chối để thông báo cho khách hàng.");
      return;
    }
    const token = getAdminToken?.();
    if (!token) return;
    setProcessing(wd.id);
    try {
      await adminService.rejectWithdrawal(token, wd.id, { method: null, note: finalReason });
      showToast?.("Đã từ chối yêu cầu #" + wd.id + " và cộng lại 100% tiền vào ví khách hàng");
      playPulseSound?.(300, "sine", 0.06);
      handleCloseModal();
      fetchWithdrawals(wdPage.page);
      fetchDashboard();
    } catch (e) { showToast?.("Lỗi: " + (e.message || "Không thể từ chối")); }
    finally { setProcessing(null); }
  };

  const displayedWithdrawals = useMemo(() => {
    if (!searchTerm.trim()) return withdrawals;
    const q = searchTerm.trim().toLowerCase();
    return withdrawals.filter(w =>
      (w.userName && w.userName.toLowerCase().includes(q)) ||
      (w.userEmail && w.userEmail.toLowerCase().includes(q)) ||
      (w.accountNumber && String(w.accountNumber).includes(q)) ||
      (w.accountHolder && w.accountHolder.toLowerCase().includes(q)) ||
      (w.bankName && w.bankName.toLowerCase().includes(q)) ||
      String(w.id).includes(q)
    );
  }, [withdrawals, searchTerm]);

  if (activeTab !== "cinewallet") return null;

  const kpis = dashboard ? [
    { label: "Tổng số dư ví người dùng", value: fmtVND(dashboard.totalWalletBalance), icon: Wallet, accent: "#f59e0b", sub: `${dashboard.totalWallets || 0} tài khoản ví đang hoạt động` },
    { label: "Tổng tiền hoàn vào ví", value: fmtVND(dashboard.totalRefundedToWallet), icon: ArrowDownCircle, accent: "#10b981", sub: "Tự động hoàn tiền từ hủy suất chiếu" },
    { label: "Tổng tiền đã rút thành công", value: fmtVND(dashboard.totalWithdrawnAmount), icon: ArrowUpCircle, accent: "#06b6d4", sub: "Đã chuyển khoản thực tế đến ngân hàng" },
    { label: "Lệnh rút đang chờ duyệt", value: `${dashboard.pendingWithdrawalsCount} yêu cầu`, icon: Clock, accent: "#a855f7", sub: fmtVND(dashboard.pendingWithdrawalsAmount) },
  ] : [];

  return (
    <motion.div
      key="panel-cinewallet"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      style={{ display: "flex", flexDirection: "column", gap: 26 }}
    >
      {/* ── HEADER CHÍNH ────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 28px rgba(245,158,11,0.4)",
            border: "1px solid rgba(255,255,255,0.25)"
          }}>
            <Wallet size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "Inter, sans-serif" }}>
                CineWallet Management
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                Hệ thống trực tuyến
              </span>
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}>
              Quản lý ví CineWallet & Lệnh rút tiền
            </h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => { fetchDashboard(); fetchWithdrawals(wdPage.page); playPulseSound?.(500, "sine", 0.03); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "Inter, sans-serif", transition: "all 0.2s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
          >
            <RefreshCw size={14} /> Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* ── KPI METRICS (4 CỘT CÂN ĐỐI) ─────────────────────────────── */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
      )}

      {/* ── BẢNG YÊU CẦU RÚT TIỀN (CHUẨN THIẾT KẾ CÂN XỨNG) ──────────── */}
      <div style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}>
        {/* Thanh công cụ & Bộ lọc */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
          padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", gap: 16,
          background: "rgba(0,0,0,0.2)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a855f7", fontFamily: "Inter, sans-serif" }}>
                Danh sách lệnh rút tiền
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}>
                ({displayedWithdrawals.length} yêu cầu)
              </span>
            </div>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>
              Yêu cầu rút tiền từ ví khách hàng
            </h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Quick search input */}
            <div style={{ position: "relative", minWidth: 260 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
              <input
                type="text"
                placeholder="Tìm tên, STK, mã #WD..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%", padding: "8px 14px 8px 36px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.4)",
                  color: "#fff", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none",
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 5, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { val: "", label: "Tất cả" },
                { val: "PENDING", label: `Chờ xử lý ${dashboard?.pendingWithdrawalsCount ? `(${dashboard.pendingWithdrawalsCount})` : ''}` },
                { val: "PAID", label: "Đã chuyển" },
                { val: "REJECTED", label: "Từ chối" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => { setStatusFilter(opt.val); }}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                    borderRadius: 6, border: "none", cursor: "pointer", transition: "all 0.2s",
                    background: statusFilter === opt.val ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "transparent",
                    color: statusFilter === opt.val ? "#fff" : "rgba(255,255,255,0.6)",
                    boxShadow: statusFilter === opt.val ? "0 2px 8px rgba(168,85,247,0.35)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── TIÊU ĐỀ BẢNG (TABLE HEADER) CÂN ĐỐI ──────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 140px 1.6fr 140px 120px 110px",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          fontFamily: "Inter, sans-serif",
        }}>
          <span>Mã & Khách hàng</span>
          <span>Số tiền rút</span>
          <span>Tài khoản nhận tiền</span>
          <span>Thời gian gửi</span>
          <span style={{ textAlign: "center" }}>Trạng thái</span>
          <span style={{ textAlign: "right" }}>Thao tác</span>
        </div>

        {/* ── THÂN BẢNG (TABLE BODY) ─────────────────────────────────── */}
        <div style={{ padding: "8px 18px 16px" }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block", marginBottom: 10 }}>
                <RefreshCw size={20} color="#a855f7" />
              </motion.div>
              <br />Đang tải danh sách yêu cầu rút tiền...
            </div>
          ) : displayedWithdrawals.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <AlertCircle size={26} style={{ marginBottom: 10, opacity: 0.4 }} /><br />
              Không tìm thấy yêu cầu rút tiền nào phù hợp với bộ lọc
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {displayedWithdrawals.map((wd) => {
                const bankLogo = getBankLogo(wd.bankName);
                const isSelected = selectedWd?.id === wd.id;
                const isPending = wd.status === "PENDING";
                const isPaid = wd.status === "PAID";
                const isRejected = wd.status === "REJECTED";

                return (
                  <motion.div
                    key={wd.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 140px 1.6fr 140px 120px 110px",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 18px",
                      background: isSelected
                        ? "rgba(168,85,247,0.12)"
                        : isPending
                          ? "rgba(245,158,11,0.03)"
                          : "rgba(255,255,255,0.02)",
                      border: isSelected
                        ? "1px solid rgba(168,85,247,0.5)"
                        : isPending
                          ? "1px solid rgba(245,158,11,0.22)"
                          : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 12,
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                    whileHover={{
                      borderColor: isPending ? "rgba(245,158,11,0.45)" : "rgba(168,85,247,0.4)",
                      background: isPending ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.04)"
                    }}
                    onClick={() => {
                      if (selectedWd?.id === wd.id) {
                        handleCloseModal();
                      } else {
                        setSelectedWd(wd);
                        setIsRejectMode(false);
                        setRejectReason("");
                        setRejectError("");
                        setProcessNote("");
                      }
                    }}
                  >
                    {/* Cột 1: Mã & Khách hàng */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: isPending ? "rgba(245,158,11,0.15)" : isPaid ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                        border: `1px solid ${isPending ? "rgba(245,158,11,0.3)" : isPaid ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center", shrink: 0,
                        fontSize: 12, fontWeight: 800, color: isPending ? "#f59e0b" : isPaid ? "#10b981" : "#f43f5e"
                      }}>
                        #{wd.id}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {wd.userName || wd.userEmail || "Khách hàng"}
                        </span>
                        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                          {wd.userEmail}
                        </span>
                      </div>
                    </div>

                    {/* Cột 2: Số tiền rút */}
                    <div>
                      <span style={{
                        fontSize: 15.5, fontWeight: 800, fontFamily: "Inter, sans-serif",
                        color: isPaid ? "#10b981" : isRejected ? "#f43f5e" : "#f59e0b",
                        display: "block"
                      }}>
                        {fmtVND(wd.amount)}
                      </span>
                      {isRejected && (
                        <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700, fontFamily: "Inter, sans-serif", marginTop: 1, display: "block" }}>
                          ✓ Đã cộng ví
                        </span>
                      )}
                    </div>

                    {/* Cột 3: Ngân hàng & STK */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      {bankLogo ? (
                        <img
                          src={bankLogo}
                          alt={wd.bankName}
                          style={{ width: 40, height: 28, objectFit: "contain", background: "#fff", borderRadius: 5, padding: "2px 4px", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 28, borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>
                          BANK
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                            {wd.bankName}
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: "monospace", letterSpacing: "0.03em", fontWeight: 600 }}>
                            {wd.accountNumber}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontFamily: "Inter, sans-serif", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                          {wd.accountHolder}
                        </span>
                      </div>
                    </div>

                    {/* Cột 4: Thời gian */}
                    <div>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: "Inter, sans-serif", display: "block" }}>
                        {fmtDate(wd.createdAt)}
                      </span>
                      {wd.processedAt && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif", marginTop: 1, display: "block" }}>
                          Xử lý: {fmtDate(wd.processedAt)}
                        </span>
                      )}
                    </div>

                    {/* Cột 5: Trạng thái */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <StatusBadge status={wd.status} />
                    </div>

                    {/* Cột 6: Nút thao tác */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {isPending ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "6px 14px", borderRadius: 7,
                          background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.4)",
                          color: "#f59e0b", fontSize: 12, fontWeight: 800, fontFamily: "Inter, sans-serif"
                        }}>
                          Xử lý <ChevronRight size={13} />
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 7,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif"
                        }}>
                          <Eye size={13} /> Chi tiết
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Phân trang */}
          {wdPage.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
              <button
                disabled={wdPage.page === 0}
                onClick={() => fetchWithdrawals(Math.max(0, wdPage.page - 1))}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)", color: wdPage.page === 0 ? "rgba(255,255,255,0.2)" : "#fff",
                  fontSize: 12, fontWeight: 700, cursor: wdPage.page === 0 ? "not-allowed" : "pointer"
                }}
              >
                Trước
              </button>
              {Array.from({ length: wdPage.totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => fetchWithdrawals(i)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
                    background: i === wdPage.page ? "#a855f7" : "rgba(255,255,255,0.04)",
                    color: i === wdPage.page ? "#fff" : "rgba(255,255,255,0.5)",
                    fontSize: 13, fontWeight: 800, cursor: "pointer",
                    boxShadow: i === wdPage.page ? "0 2px 8px rgba(168,85,247,0.35)" : "none"
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={wdPage.page >= wdPage.totalPages - 1}
                onClick={() => fetchWithdrawals(Math.min(wdPage.totalPages - 1, wdPage.page + 1))}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)", color: wdPage.page >= wdPage.totalPages - 1 ? "rgba(255,255,255,0.2)" : "#fff",
                  fontSize: 12, fontWeight: 700, cursor: wdPage.page >= wdPage.totalPages - 1 ? "not-allowed" : "pointer"
                }}
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL PHIẾU XÉT DUYỆT & BIÊN NHẬN CHI TIẾT ───────────────── */}
      <AnimatePresence>
        {selectedWd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
              style={{
                width: 530, maxWidth: "96vw", maxHeight: "94vh", overflowY: "auto",
                background: "linear-gradient(165deg, #16161a 0%, #0c0c0e 100%)",
                border: isRejectMode ? "1px solid rgba(244,63,94,0.35)" : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16, padding: "18px 22px",
                boxShadow: isRejectMode ? "0 25px 60px rgba(244,63,94,0.22)" : "0 30px 80px rgba(0,0,0,0.85)",
                position: "relative",
              }}
            >
              {/* ── CHẾ ĐỘ 1: XÁC NHẬN TỪ CHỐI & NHẬP LÝ DO (COMPACT, NO SCROLLBAR) ── */}
              {selectedWd.status === "PENDING" && isRejectMode && (
                <div>
                  <button
                    type="button"
                    onClick={() => { setIsRejectMode(false); setRejectError(""); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none",
                      color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      padding: 0, marginBottom: 10, fontFamily: "Inter, sans-serif"
                    }}
                  >
                    <ArrowLeft size={13} /> Quay lại phiếu xét duyệt
                  </button>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <XCircle size={18} color="#f43f5e" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                          Từ chối yêu cầu rút tiền #WD-{selectedWd.id}
                        </h3>
                        <span style={{ fontSize: 11.5, color: "#10b981", fontWeight: 700, fontFamily: "Inter, sans-serif", marginTop: 1, display: "block" }}>
                          ✓ Tự động cộng hoàn lại 100% tiền vào ví CineWallet của khách
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cảnh báo tự động hoàn tiền */}
                  <div style={{
                    background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.22)",
                    borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10
                  }}>
                    <ShieldAlert size={18} color="#f43f5e" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif" }}>
                      <strong style={{ color: "#f43f5e" }}>Cơ chế bảo toàn số dư:</strong> Khi từ chối, số tiền <strong style={{ color: "#f59e0b" }}>{fmtVND(selectedWd.amount)}</strong> sẽ được hệ thống <strong>tự động CỘNG LẠI 100%</strong> vào số dư ví của khách hàng (<span style={{ color: "#fff", fontWeight: 600 }}>{selectedWd.userName || selectedWd.userEmail}</span>) với giao dịch hoàn trả dương (+).
                    </div>
                  </div>

                  {/* Tóm tắt người nhận */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12
                  }}>
                    <div>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>Tài khoản thụ hưởng</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif", marginTop: 2, display: "block" }}>
                        {selectedWd.bankName} · {selectedWd.accountNumber} ({selectedWd.accountHolder})
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>Số tiền hoàn lại</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981", fontFamily: "Inter, sans-serif", marginTop: 2, display: "block" }}>+{fmtVND(selectedWd.amount)}</span>
                    </div>
                  </div>

                  {/* Lý do từ chối */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: "#f43f5e", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "Inter, sans-serif" }}>
                        Lý do từ chối (Bắt buộc thông báo cho khách) *
                      </label>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>
                        Hiển thị trực tiếp trên biên nhận
                      </span>
                    </div>

                    {/* Gợi ý lý do chuẩn: 2 cột gọn gàng, không bị tràn cuộn */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {QUICK_REJECT_REASONS.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          title={r}
                          onClick={() => { setRejectReason(r); setRejectError(""); }}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 7,
                            background: rejectReason === r ? "rgba(244,63,94,0.22)" : "rgba(255,255,255,0.04)",
                            border: rejectReason === r ? "1px solid rgba(244,63,94,0.6)" : "1px solid rgba(255,255,255,0.08)",
                            color: rejectReason === r ? "#fca5a5" : "rgba(255,255,255,0.75)",
                            cursor: "pointer", transition: "all 0.15s ease", fontFamily: "Inter, sans-serif",
                            textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={rejectReason}
                      onChange={(e) => { setRejectReason(e.target.value); if (rejectError) setRejectError(""); }}
                      placeholder="Nhập lý do chi tiết từ chối để giải thích rõ ràng cho khách hàng..."
                      rows={2}
                      style={{
                        padding: "8px 12px", borderRadius: 9,
                        border: rejectError ? "1px solid #f43f5e" : "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12,
                        fontFamily: "Inter, sans-serif", outline: "none", resize: "none", lineHeight: 1.4
                      }}
                    />

                    {rejectError && (
                      <span style={{ fontSize: 11.5, color: "#f43f5e", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                        <AlertCircle size={13} /> {rejectError}
                      </span>
                    )}
                  </div>

                  {/* Hành động */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleReject(selectedWd)}
                      disabled={processing === selectedWd.id}
                      style={{
                        flex: 1.4, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, #f43f5e, #be123c)", color: "#fff",
                        fontSize: 13, fontWeight: 800, fontFamily: "Inter, sans-serif",
                        opacity: processing === selectedWd.id ? 0.6 : 1, transition: "opacity 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        boxShadow: "0 3px 14px rgba(244,63,94,0.35)"
                      }}
                    >
                      <XCircle size={16} /> {processing === selectedWd.id ? "Đang xử lý..." : "Xác nhận từ chối & Hoàn tiền vào ví"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsRejectMode(false); setRejectError(""); }}
                      style={{
                        padding: "10px 20px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 700,
                        fontFamily: "Inter, sans-serif", cursor: "pointer",
                      }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </div>
              )}

              {/* ── CHẾ ĐỘ 2: DUYỆT RÚT TIỀN (PENDING) ── */}
              {selectedWd.status === "PENDING" && !isRejectMode && (
                <div>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Wallet size={18} color="#f59e0b" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                          Phiếu duyệt rút tiền #WD-{selectedWd.id}
                        </h3>
                        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif", marginTop: 1, display: "block" }}>
                          Vui lòng chuyển khoản ngân hàng trước khi xác nhận
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4 }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Khối tiền nổi bật trung tâm */}
                  <div style={{
                    padding: "10px 16px", background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 10
                  }}>
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", fontFamily: "Inter, sans-serif" }}>
                        Số tiền cần chuyển khoản
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em", marginTop: 2, display: "block" }}>
                        {fmtVND(selectedWd.amount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedWd.amount, "amount")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                        border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                        fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif"
                      }}
                    >
                      {copiedField === "amount" ? <Check size={13} /> : <Copy size={13} />}
                      {copiedField === "amount" ? "Đã chép" : "Sao chép số tiền"}
                    </button>
                  </div>

                  {/* Lưới 2 cột thông tin cân xứng */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    {/* Cột 1: Thông tin tài khoản thụ hưởng */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
                        Tài khoản thụ hưởng
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {getBankLogo(selectedWd.bankName) && (
                          <img src={getBankLogo(selectedWd.bankName)} alt="" style={{ height: 18, objectFit: "contain", background: "#fff", borderRadius: 4, padding: "1px 3px" }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{selectedWd.bankName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, padding: "6px 10px", background: "rgba(0,0,0,0.35)", borderRadius: 7 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>{selectedWd.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedWd.accountNumber, "accountNumber")}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 2 }}
                        >
                          {copiedField === "accountNumber" ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        </button>
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block", marginTop: 5 }}>
                        {selectedWd.accountHolder}
                      </span>
                    </div>

                    {/* Cột 2: Thông tin giao dịch & Khách hàng */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
                        Người yêu cầu & Thời gian
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "block" }}>
                        {selectedWd.userName || "Khách hàng"}
                      </span>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", display: "block", marginTop: 2 }}>
                        {selectedWd.userEmail}
                      </span>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", display: "block", marginTop: 6 }}>
                        Gửi lúc: <strong style={{ color: "#fff" }}>{fmtDate(selectedWd.createdAt)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Nhập ghi chú chuyển tiền / mã FT */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Inter, sans-serif" }}>
                        Mã giao dịch / Ghi chú chuyển tiền (Lưu làm đối soát)
                      </label>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>Tùy chọn</span>
                    </div>
                    <textarea
                      value={processNote}
                      onChange={(e) => setProcessNote(e.target.value)}
                      placeholder="Ví dụ: Mã FT2610..., đã chuyển khoản thành công qua MBBank..."
                      rows={2}
                      style={{
                        padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12,
                        fontFamily: "Inter, sans-serif", outline: "none", resize: "none", lineHeight: 1.4
                      }}
                    />
                  </div>

                  {/* Nút hành động xét duyệt cân xứng */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedWd)}
                      disabled={processing === selectedWd.id}
                      style={{
                        flex: 1.3, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff",
                        fontSize: 13, fontWeight: 800, fontFamily: "Inter, sans-serif",
                        opacity: processing === selectedWd.id ? 0.5 : 1, transition: "opacity 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        boxShadow: "0 3px 14px rgba(16,185,129,0.3)"
                      }}
                    >
                      <CheckCircle2 size={16} /> {processing === selectedWd.id ? "Đang xử lý..." : "Xác nhận đã chuyển tiền"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsRejectMode(true); setRejectReason(""); setRejectError(""); }}
                      disabled={processing === selectedWd.id}
                      style={{
                        flex: 0.9, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(244,63,94,0.4)",
                        background: "rgba(244,63,94,0.12)", color: "#f43f5e", cursor: "pointer",
                        fontSize: 12.5, fontWeight: 800, fontFamily: "Inter, sans-serif",
                        opacity: processing === selectedWd.id ? 0.5 : 1, transition: "opacity 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      <XCircle size={16} /> Từ chối yêu cầu
                    </button>
                  </div>
                </div>
              )}

              {/* ── CHẾ ĐỘ 3: BIÊN NHẬN CHI TIẾT (PAID HOẶC REJECTED) ── */}
              {selectedWd.status !== "PENDING" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: selectedWd.status === "PAID" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                        border: `1px solid ${selectedWd.status === "PAID" ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {selectedWd.status === "PAID" ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#f43f5e" />}
                      </div>
                      <div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: selectedWd.status === "PAID" ? "#10b981" : "#f43f5e", fontFamily: "Inter, sans-serif" }}>
                          {selectedWd.status === "PAID" ? "Biên nhận chuyển khoản thành công" : "Biên bản từ chối lệnh rút tiền"}
                        </span>
                        <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                          Mã giao dịch #WD-{selectedWd.id}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge status={selectedWd.status} />
                  </div>

                  {/* Khối số tiền nổi bật */}
                  <div style={{
                    padding: "10px 16px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 10
                  }}>
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block" }}>
                        {selectedWd.status === "PAID" ? "Số tiền đã chuyển khoản" : "Số tiền đã cộng hoàn lại vào ví"}
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#10b981", fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em", marginTop: 2, display: "block" }}>
                        {selectedWd.status === "PAID" ? "-" : "+"}{fmtVND(selectedWd.amount)}
                      </span>
                    </div>
                    <span style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                      background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)",
                      textTransform: "uppercase"
                    }}>
                      {selectedWd.status === "PAID" ? "✓ Đã chuyển thành công" : "✓ Đã cộng 100% vào ví"}
                    </span>
                  </div>

                  {/* Chi tiết 2 cột cân xứng */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Tài khoản nhận</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "block" }}>{selectedWd.bankName}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace", display: "block", marginTop: 3 }}>{selectedWd.accountNumber}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", display: "block", marginTop: 3 }}>{selectedWd.accountHolder}</span>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Khách hàng & Thời gian</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "block" }}>{selectedWd.userName || "Khách hàng"}</span>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", display: "block", marginTop: 2 }}>Gửi: {fmtDate(selectedWd.createdAt)}</span>
                      <span style={{ fontSize: 11.5, color: "#10b981", fontWeight: 700, display: "block", marginTop: 4 }}>Xử lý: {fmtDate(selectedWd.processedAt)}</span>
                    </div>
                  </div>

                  {/* Khối lý do / ghi chú xử lý */}
                  {selectedWd.status === "REJECTED" ? (
                    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ padding: "8px 12px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>
                          Lý do từ chối gửi đến khách hàng:
                        </span>
                        <p style={{ margin: 0, fontSize: 12, color: "#fff", fontStyle: "italic", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>
                          "{selectedWd.processedNote || 'Admin từ chối yêu cầu rút tiền do thông tin không phù hợp'}"
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10 }}>
                        <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: "#10b981", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                          Số tiền <strong>+{fmtVND(selectedWd.amount)}</strong> đã được tự động cộng hoàn lại 100% vào ví CineWallet của khách hàng.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>
                          Ghi chú chuyển khoản / Mã đối soát:
                        </span>
                        <p style={{ margin: 0, fontSize: 12, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                          {selectedWd.processedNote || 'Đã chuyển tiền thành công qua tài khoản ngân hàng'}
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      fontFamily: "Inter, sans-serif", cursor: "pointer",
                    }}
                  >
                    Đóng biên nhận
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BẢNG GIAO DỊCH VÍ GẦN ĐÂY (RECENT ACTIVITY) ──────────────── */}
      {(() => {
        const recentTxs = (dashboard?.recentTransactions || []).filter((tx) => tx.type !== "WITHDRAWAL_PAID" && Math.abs(Number(tx.amount || 0)) > 0);
        if (recentTxs.length === 0) return null;
        const txPageSize = 10;
        const txTotalPages = Math.ceil(recentTxs.length / txPageSize) || 1;
        const currentTxs = recentTxs.slice(txPage * txPageSize, (txPage + 1) * txPageSize);

        return (
          <div style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
          }}>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#10b981", fontFamily: "Inter, sans-serif" }}>
                  Đối soát dòng tiền
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                  Biến động số dư ví hệ thống gần đây
                </h3>
              </div>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}>
                Trang {txPage + 1}/{txTotalPages} ({recentTxs.length} giao dịch)
              </span>
            </div>

            {/* Header giao dịch gần đây */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.4fr 1.2fr 140px 130px",
              padding: "10px 16px", background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.06em", textTransform: "uppercase"
            }}>
              <span>Loại giao dịch</span>
              <span>Mã tham chiếu / Đối soát</span>
              <span>Thời gian</span>
              <span style={{ textAlign: "right" }}>Biến động số dư</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {currentTxs.map((tx, i) => {
                const isCredit = (tx.amount > 0 || tx.type === "REFUND_CREDIT" || tx.type === "WITHDRAWAL_REFUND" || tx.type === "WITHDRAWAL_REJECTED");
                const label = tx.type === "REFUND_CREDIT"
                  ? "+ Hoàn tiền vé"
                  : (tx.type === "WITHDRAWAL_REFUND" || tx.type === "WITHDRAWAL_REJECTED")
                    ? "+ Cộng tiền vào ví (Lệnh rút bị từ chối)"
                    : tx.type === "WITHDRAWAL_HOLD"
                      ? "- Yêu cầu rút tiền"
                      : tx.type;

                return (
                  <div
                    key={tx.id || i}
                    style={{
                      display: "grid", gridTemplateColumns: "1.4fr 1.2fr 140px 130px",
                      alignItems: "center",
                      padding: "10px 16px", background: "rgba(255,255,255,0.02)",
                      borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                        background: isCredit ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
                        border: `1px solid ${isCredit ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                      }}>
                        {isCredit
                          ? <ArrowDownCircle size={15} color="#10b981" />
                          : <ArrowUpCircle size={15} color="#f59e0b" />
                        }
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                        {label}
                      </span>
                    </div>

                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
                      {tx.referenceCode || "N/A"}
                    </span>

                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}>
                      {fmtDate(tx.createdAt)}
                    </span>

                    <span style={{
                      fontSize: 14.5, fontWeight: 800, fontFamily: "Inter, sans-serif",
                      color: isCredit ? "#10b981" : "#f59e0b", textAlign: "right"
                    }}>
                      {isCredit ? "+" : "-"}{fmtVND(Math.abs(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>

            {txTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 14 }}>
                <button
                  disabled={txPage === 0}
                  onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: txPage === 0 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 11.5, fontWeight: 700, cursor: txPage === 0 ? "not-allowed" : "pointer" }}
                >
                  Trước
                </button>
                {Array.from({ length: txTotalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setTxPage(i)}
                    style={{
                      width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)",
                      background: i === txPage ? "#10b981" : "rgba(255,255,255,0.04)",
                      color: i === txPage ? "#fff" : "rgba(255,255,255,0.5)",
                      fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={txPage >= txTotalPages - 1}
                  onClick={() => setTxPage((p) => Math.min(txTotalPages - 1, p + 1))}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: txPage >= txTotalPages - 1 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 11.5, fontWeight: 700, cursor: txPage >= txTotalPages - 1 ? "not-allowed" : "pointer" }}
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </motion.div>
  );
}
