import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

const API_GOC = "https://seven89live.onrender.com/api/789/live";

// =======================
// LƯU LỊCH SỬ
// =======================
const HISTORY_LIMIT = 50;
let history = [];

// =======================
// HELPER
// =======================
const ketQuaTuTong = (tong) => (tong <= 10 ? "Xỉu" : "Tài");

function taoDoanVi(duDoan) {
  const map = {
    "Xỉu": [3, 4, 5, 6, 7, 8, 9, 10],
    "Tài": [11, 12, 13, 14, 15, 16, 17, 18]
  };
  return map[duDoan]
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
}

function tinhDoTinCay(tong, bonus = 0) {
  let base = tong <= 10 ? (10 - tong) : (tong - 11);
  let percent = 50 + base * 6 + bonus;
  if (percent > 92) percent = 92;
  if (percent < 50) percent = 50;
  return percent;
}

// =======================
// PHÂN TÍCH CẦU
// =======================
function detectCauPattern(history) {
  if (history.length < 6) return null;

  let streaks = [];
  let cur = history[0].ket_qua;
  let cnt = 1;

  for (let i = 1; i < history.length; i++) {
    if (history[i].ket_qua === cur) cnt++;
    else {
      streaks.push({ side: cur, len: cnt });
      cur = history[i].ket_qua;
      cnt = 1;
    }
  }
  streaks.push({ side: cur, len: cnt });

  const last = streaks.slice(-3);

  // 1-1
  if (last.length >= 2 && last[0].len === 1 && last[1].len === 1) {
    return {
      type: "Cầu 1-1",
      predict: last[1].side === "Tài" ? "Xỉu" : "Tài",
      bonus: 15
    };
  }

  // 1-2-1
  if (last.length === 3 && last[0].len === 1 && last[1].len === 2 && last[2].len === 1) {
    return {
      type: "Cầu 1-2-1",
      predict: last[2].side,
      bonus: 18
    };
  }

  // 1-2-3
  if (last.length === 3 && last[0].len === 1 && last[1].len === 2 && last[2].len === 3) {
    return {
      type: "Cầu 1-2-3",
      predict: last[2].side,
      bonus: 22
    };
  }

  // 3-2-1
  if (last.length === 3 && last[0].len === 3 && last[1].len === 2 && last[2].len === 1) {
    return {
      type: "Cầu 3-2-1",
      predict: last[1].side === "Tài" ? "Xỉu" : "Tài",
      bonus: 25
    };
  }

  // 1-2-5 (VIP)
  if (last.length === 3 && last[0].len === 1 && last[1].len === 2 && last[2].len >= 5) {
    return {
      type: "Cầu 1-2-5 (VIP)",
      predict: last[2].side === "Tài" ? "Xỉu" : "Tài",
      bonus: 30
    };
  }

  return null;
}

// =======================
// VIP PREDICT
// =======================
function vipPredict() {
  // fallback khi ít dữ liệu
  if (history.length < 6) {
    const last = history[history.length - 1];
    return {
      du_doan: last.ket_qua,
      do_tin_cay: 50,
      note: "VIP khởi tạo (fallback)"
    };
  }

  // ưu tiên cầu
  const cau = detectCauPattern(history);
  if (cau) {
    const lastTong = history[history.length - 1].tong;
    return {
      du_doan: cau.predict,
      do_tin_cay: tinhDoTinCay(lastTong, cau.bonus),
      note: cau.type
    };
  }

  // trend thường
  const last10 = history.slice(-10);
  const tai = last10.filter(i => i.ket_qua === "Tài").length;
  const xiu = last10.filter(i => i.ket_qua === "Xỉu").length;

  const duDoan = tai >= xiu ? "Tài" : "Xỉu";
  const lastTong = history[history.length - 1].tong;

  return {
    du_doan: duDoan,
    do_tin_cay: tinhDoTinCay(lastTong, 10),
    note: "Theo cầu thường"
  };
}

// =======================
// API
// =======================
app.get("/api/789/vip", async (req, res) => {
  try {
    const { data } = await axios.get(API_GOC, { timeout: 5000 });

    const x1 = +data.xuc_xac_1;
    const x2 = +data.xuc_xac_2;
    const x3 = +data.xuc_xac_3;
    const tong = x1 + x2 + x3;
    const ket_qua = ketQuaTuTong(tong);

    history.push({ tong, ket_qua });
    if (history.length > HISTORY_LIMIT) history.shift();

    const vip = vipPredict();

    res.json({
      phien: data.phien,
      xuc_xac_1: x1,
      xuc_xac_2: x2,
      xuc_xac_3: x3,
      tong,
      ket_qua,
      phien_hien_tai: data.phien + 1,
      du_doan: vip.du_doan,
      dudoan_vi: taoDoanVi(vip.du_doan),
      do_tin_cay: vip.do_tin_cay,
      vip_note: vip.note
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("🔥 API VIP 789 chạy tại port", PORT);
});
