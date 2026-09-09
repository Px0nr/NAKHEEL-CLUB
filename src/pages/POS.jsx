import { useState, useRef, useEffect, useMemo } from "react";
import { C, fmt } from "../constants/theme.js";
import { CATS } from "../constants/seeds.js";
import { PageTop, Card, Badge, Btn, Sel, Inp, inputStyle } from "../components/ui.jsx";
import AnimatedNumber from "../components/AnimatedNumber.jsx";
import { useMotion, gsap, EASE, D } from "../utils/motion.js";
import NewCustomerModal from "../components/NewCustomerModal.jsx";
import { openPdfDoc } from "../components/pdfHook.js";
import { todayISO, matchesBarcode, matchesBarcodePartial } from "../utils/format.js";
import { promoFor } from "../utils/promos.js";
import { applyReversal } from "../utils/invoiceReversal.js";
import { loadCart, saveCart } from "../utils/posCart.js";
import { buildSplit, PAY_METHODS } from "../utils/payments.js";
import { couponActive } from "../utils/coupons.js";

const qbtn = { width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.bc}`, background: C.crm, cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
const posUnitBtn = (primary) => ({ flex: 1, padding: ".28rem .3rem", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${primary ? C.gold : C.bc}`, background: primary ? C.gold + "18" : C.crm, color: primary ? C.gdd : C.k2, whiteSpace: "nowrap" });
const Row = ({ label, val, color }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: color || C.k2, marginBottom: ".4rem" }}><span>{label}</span><span>{val}</span></div>;

/* ============================ POS ============================ */
export default function POS({ ctx, can, go }) {
  const { products, setProducts, invoices, setInvoices, coupons, setCoupons, customers, setCustomers, employees, promotions, user, showToast, settings, parkedSales, setParkedSales } = ctx;
  const cur = settings?.currency || "د.ل";
  // السلة تُستعاد من تخزين الجهاز عند فتح الصفحة (تحديث الصفحة أو انقطاع كهرباء
  // كان يمسحها). الاستعادة تُطابَق مع الواقع الحالي أولاً — انظر utils/posCart.js
  const restoredRef = useRef(null);
  const [cart, setCart] = useState(() => {
    const res = loadCart(products);
    if (Object.keys(res.cart).length) restoredRef.current = res;
    return res.cart;
  });
  const [pay, setPay] = useState("cash");
  const [coupon, setCoupon] = useState("");
  const [discPct, setDiscPct] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { id, code } — الكوبون الفعلي المطبَّق حالياً، لتحديث عداد استخدامه عند إتمام البيع
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [bcInput, setBcInput] = useState("");
  const bcRef = useRef(null);
  const [deferCustomer, setDeferCustomer] = useState(null);
  const [custModal, setCustModal] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [pointsCustomer, setPointsCustomer] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [deferEmployee, setDeferEmployee] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  // دفع مقسَّم على طريقتين (كاش + بطاقة مثلاً) — متاح للطرق الفورية فقط، لأن
  // الآجل والموظف يُنشئان ديناً على حساب فلا يصحّ خلطهما بجزء مقبوض
  const [splitOn, setSplitOn] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitMethod2, setSplitMethod2] = useState("بطاقة");
  // اسم/ملاحظة للفاتورة المعلَّقة — ثلاث فواتير معلَّقة متشابهة القيمة كانت بلا هوية
  const [parkPrompt, setParkPrompt] = useState(false);
  const [parkLabel, setParkLabel] = useState("");
  const [lastSale, setLastSale] = useState(null); // آخر عملية بيع مكتملة — لإتاحة الإيصال الفوري والتراجع

  // حفظ السلة على الجهاز مع كل تغيير. لا حاجة لمسحٍ صريح عند إتمام البيع أو
  // التعليق: تفريغها يمرّ من هنا أيضاً وsaveCart يمسح المخزَّن حين تكون فارغة
  useEffect(() => { saveCart(cart); }, [cart]);

  // إخطار الكاشير بما استُعيد وبما سقط منه — الصمت هنا يعني إتمام بيع بكمية
  // ناقصة أو بلا صنف كان في السلة دون أن ينتبه أحد
  useEffect(() => {
    const r = restoredRef.current;
    if (!r) return;
    restoredRef.current = null;
    const notes = [];
    if (r.dropped.length) notes.push(`أُسقط ${r.dropped.length} صنف لم يعد متاحاً`);
    if (r.clamped.length) notes.push(`عُدِّلت كمية ${r.clamped.length} صنف حسب المخزون`);
    showToast(`استُعيدت السلة غير المكتملة${notes.length ? " — " + notes.join("، ") : ""}`);
    // مرة واحدة عند الفتح فقط: showToast تُعاد صياغتها كل رندر، وإدراجها هنا
    // يجعل الإخطار يتكرّر بلا داعٍ (والحارس restoredRef يمنع تكراره أصلاً)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PAY_LABEL = { cash: "كاش", card: "بطاقة", transfer: "تحويل", defer: "آجل", employee: "موظف" };
  const shown = products.filter(p =>
    (catFilter === "all" || p.cat === catFilter) &&
    (search === "" || p.name.includes(search) || matchesBarcodePartial(p, search))
  );

  // الأصناف الأكثر مبيعاً — للوصول السريع بضغطة واحدة، محسوبة من سجل الفواتير الفعلي (يستثني الملغاة)
  const topSellers = useMemo(() => {
    const qtyByPid = {};
    (invoices || []).forEach(inv => {
      if (inv.source !== "منتج" || inv.status === "ملغاة") return;
      (inv.items || []).forEach(it => { if (it.pid != null) qtyByPid[it.pid] = (qtyByPid[it.pid] || 0) + it.qty; });
    });
    return Object.entries(qtyByPid)
      .sort((a, b) => b[1] - a[1])
      .map(([pid]) => products.find(p => String(p.id) === pid))
      .filter(p => p && p.sell)
      .slice(0, 8);
  }, [invoices, products]);

  // إضافة صنف بمطابقة كود باركود — يطابق الباركود الأساسي أو أياً من الباركودات الإضافية لنفس المنتج
  const addByCode = (code) => {
    if (!code) return;
    const p = products.find(x => matchesBarcode(x, code)) || products.find(x => matchesBarcodePartial(x, code));
    if (!p) { showToast(`لا يوجد صنف بالباركود «${code}»`); return; }
    add(p, "piece");
  };
  // من حقل الباركود اليدوي (Enter أو زر إضافة)
  const addByBarcode = () => {
    const code = bcInput.trim();
    addByCode(code);
    setBcInput("");
    bcRef.current?.focus();
  };
  // مرجع دائم التحديث لأحدث addByCode — يتفادى مشكلة الإغلاق القديم (stale closure) في مستمع مثبَّت مرة واحدة فقط
  const addByCodeRef = useRef(addByCode);
  addByCodeRef.current = addByCode;
  // التقاط الباركود عالمياً: قارئ الباركود يكتب كلوحة مفاتيح سريعة جداً بغض النظر عن مكان التركيز الحالي —
  // نميّزه عن كتابة الموظف اليدوية بسرعة الأحرف (فجوة قصيرة جداً بين كل ضغطة ومقدار قبله)، ونتجاهله كلياً
  // إن كان التركيز فعلاً داخل حقل نصي (بحث/كوبون/كمية...) حتى لا نقاطع كتابة المستخدم العادية هناك.
  // المستمع يُثبَّت مرة واحدة فقط (بلا اعتماديات) ويستدعي دائماً أحدث addByCode عبر المرجع أعلاه.
  useEffect(() => {
    let buffer = "", lastTime = 0;
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const tag = document.activeElement?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;
      if (isEditable) { buffer = ""; return; }
      const now = Date.now();
      if (now - lastTime > 80) buffer = ""; // فجوة أطول من نمط القارئ ⇐ بداية سلسلة جديدة
      lastTime = now;
      if (e.key === "Enter") {
        if (buffer.length >= 3) { addByCodeRef.current(buffer); }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  // piecesInCartFor: total pieces already reserved for a product across piece+pack lines
  const piecesReserved = (pid) => Object.values(cart).filter(it => it.pid === pid).reduce((s, it) => s + it.qty * it.perPieces, 0);
  const add = (p, sellUnit = "piece") => {
    if (!p.sell) { showToast(`«${p.name}» غير مُسعّر بعد — يُسعّر عند التوريد`); return; }
    const pack = p.packSize || 1;
    const perPieces = sellUnit === "pack" ? pack : 1;
    const key = p.id + ":" + sellUnit;
    const already = piecesReserved(p.id);
    if (p.stock !== null && p.stock < already + perPieces) { showToast(`لا يوجد مخزون كافٍ من «${p.name}»`); return; }
    const promo = promoFor(promotions, p.cat);
    const factor = promo ? 1 - promo.pct / 100 : 1;
    const baseUnitPrice = sellUnit === "pack" ? (p.sellPack || p.sell * pack) : p.sell;
    const unitPrice = Math.round(baseUnitPrice * factor * 100) / 100;
    const unitLabel = sellUnit === "pack" ? p.unit : "قطعة";
    setCart(c => ({ ...c, [key]: { key, pid: p.id, cat: p.cat, name: p.name, img: p.img, sell: p.sell, unitPrice, perPieces, sellUnit, unitLabel, promoPct: promo ? promo.pct : 0, qty: (c[key]?.qty || 0) + 1 } }));
  };
  const chg = (key, d) => setCart(c => {
    const q = (c[key]?.qty || 0) + d;
    const nc = { ...c };
    if (q <= 0) delete nc[key]; else nc[key] = { ...nc[key], qty: q };
    return nc;
  });
  // تعديل الكمية مباشرة بالكتابة (بدل الضغط المتكرر على +) — يُحترم سقف المخزون المتاح
  const setQtyDirect = (key, val) => setCart(c => {
    const it = c[key]; if (!it) return c;
    let q = Math.max(0, parseInt(val) || 0);
    const p = products.find(x => x.id === it.pid);
    if (p && p.stock !== null) {
      const otherPieces = Object.values(c).filter(x => x.pid === it.pid && x.key !== key).reduce((s, x) => s + x.qty * x.perPieces, 0);
      const maxQty = Math.max(0, Math.floor((p.stock - otherPieces) / it.perPieces));
      q = Math.min(q, maxQty);
    }
    const nc = { ...c };
    if (q <= 0) delete nc[key]; else nc[key] = { ...it, qty: q };
    return nc;
  });
  const items = Object.values(cart);
  const isEmployeeSale = pay === "employee";
  const freeDepts = settings?.freeDeptsForEmployees || [];
  const isFreeItem = (it) => isEmployeeSale && freeDepts.includes(it.cat);
  const sub = items.reduce((s, i) => s + (isFreeItem(i) ? 0 : i.unitPrice * i.qty), 0);
  const freeValue = items.reduce((s, i) => s + (isFreeItem(i) ? i.unitPrice * i.qty : 0), 0);
  const disc = Math.round(sub * discPct / 100);
  const custForPoints = pay === "defer" ? deferCustomer : (pay === "employee" ? null : pointsCustomer);
  const redeemBlocks = (settings?.loyaltyOn && redeemPoints && custForPoints) ? Math.floor((custForPoints.points || 0) / 100) : 0;
  const pointsDiscount = Math.min(redeemBlocks * (settings?.pointsRedeemValue || 0), Math.max(0, sub - disc));
  const total = Math.max(0, sub - disc - pointsDiscount);
  const cashNum = parseFloat(cashReceived) || 0;
  const change = pay === "cash" ? Math.round((cashNum - total) * 100) / 100 : 0;
  // التقسيم للطرق الفورية فقط: الآجل والموظف يُنشئان ديناً على حساب، وخلطهما
  // بجزء مقبوض يجعل الدَين والخزينة كليهما خاطئَين
  const splitAllowed = pay === "cash" || pay === "card" || pay === "transfer";
  const splitActive = splitAllowed && splitOn;
  const splitFirst = Math.round((parseFloat(splitAmount) || 0) * 100) / 100;
  const splitRest = Math.round((total - splitFirst) * 100) / 100;
  // حاسبة الباقي للكاش الكامل فقط — في التقسيم يُدخَل مبلغ كل جزء بدقة
  const cashInsufficient = pay === "cash" && !splitActive && cashReceived !== "" && cashNum < total;

  /* ---------- حركة السلة ----------
     دخول الأصناف المضافة حديثاً فقط: تأكيد بصري فوري للمس على اللوحي.

     جُرِّب Flip لانزلاق الصفوف الباقية بعد حذف صنف ثم أُزيل: الحالة المُلتقطة في
     useEffect كانت تطابق ما بعد التغيير لا ما قبله، فيحسب Flip فرقاً صفرياً —
     قِيس ذلك مباشرةً (3 أهداف مُلتقطة، tween بمدة 0.32s، والتحويل يبقى
     translate(0px,0px) طوال الحركة والصفوف تقفز لموضعها النهائي فوراً).
     الالتقاط الصحيح يستلزم قراءة التخطيط قبل تثبيت React للتغيير، وهو غير آمن
     مع الرندر المتزامن. المكسب (انزلاق 50px عند الحذف) لا يبرّر ذلك. */
  const cartRef = useRef(null);
  const seenKeysRef = useRef(new Set());
  const itemsKey = items.map(i => i.key + ":" + i.qty).join("|");

  useMotion((m) => {
    const rows = gsap.utils.toArray(".nk-cart-row", cartRef.current);
    const seen = seenKeysRef.current;
    const fresh = rows.filter(el => !seen.has(el.dataset.key));
    seenKeysRef.current = new Set(rows.map(el => el.dataset.key));
    if (!m.enabled || !fresh.length) return;
    gsap.from(fresh, { autoAlpha: 0, x: m.dirX(-18), duration: m.d(D.base), ease: EASE, overwrite: "auto", willChange: "transform, opacity", clearProps: "willChange" });
  }, { scope: cartRef, dependencies: [itemsKey] });

  // تأكيد بصري عند إتمام البيع — لوحة «آخر عملية» تدخل بنبضة خفيفة تلفت النظر
  // إلى زرّي الإيصال والتراجع دون مقاطعة البيعة التالية
  const lastSaleRef = useRef(null);
  useMotion((m) => {
    if (!lastSaleRef.current || !m.enabled) return;
    gsap.from(lastSaleRef.current, { autoAlpha: 0, scale: 0.94, duration: m.d(D.base), ease: EASE, clearProps: "scale" });
  }, { dependencies: [lastSale?.invoice?.id] });

  // كانت تتحقق فقط من status==="نشط" — فكوبون منتهي الصلاحية أو تجاوز حد
  // استخدامه المفترض كان يُطبَّق بلا أي مانع فعلي (couponActive تفحص الثلاثة معاً)
  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    const c = coupons.find(x => x.code === code);
    if (!c) { setDiscPct(0); setAppliedCoupon(null); showToast("كود الخصم غير صحيح"); return; }
    if (!couponActive(c)) {
      const reason = c.status !== "نشط" ? "هذا الكوبون معطَّل"
        : (c.exp && c.exp < todayISO()) ? "انتهت صلاحية هذا الكوبون"
        : "بلغ هذا الكوبون حد الاستخدام المسموح";
      setDiscPct(0); setAppliedCoupon(null); showToast(reason); return;
    }
    setDiscPct(c.pct); setAppliedCoupon({ id: c.id, code: c.code });
    showToast(`كوبون ${c.code} مفعّل — خصم ${c.pct}%`);
  };

  const checkout = () => {
    if (!items.length) return;
    if (cashInsufficient) { showToast("المبلغ المستلم أقل من الإجمالي"); return; }
    // أجزاء الدفع المقسَّم — تُبنى وتُتحقَّق قبل أي تعديل على المخزون أو الحسابات
    let split = null;
    if (splitAllowed && splitOn) {
      split = buildSplit({ total, firstMethod: PAY_LABEL[pay], firstAmount: splitAmount, secondMethod: splitMethod2 });
      if (split.error) { showToast(split.error); return; }
    }
    const num = "INV-" + ctx.nextCounter("invoice");
    const details = items.map(i => `${i.name} ×${i.qty} ${i.sellUnit === "pack" ? i.unitLabel : ""}`.trim()).join("، ");
    let custName = "زبون نقدي";
    let custId = null;

    if (pay === "defer") {
      if (!deferCustomer) { showToast("اختر زبوناً أو سجّل زبوناً جديداً للبيع الآجل"); return; }
      custName = deferCustomer.name;
      custId = deferCustomer.id;
      setCustomers(cs => cs.map(c => c.id === deferCustomer.id
        ? { ...c, debt: (c.debt || 0) + total, total: c.total + total, invoices: c.invoices + 1, last: todayISO() }
        : c));
    } else if (pay === "employee") {
      if (!deferEmployee) { showToast("اختر الموظف الذي يشتري"); return; }
      custName = deferEmployee.name;
    } else if (custForPoints) {
      custName = custForPoints.name;
      custId = custForPoints.id;
    }

    // نقاط الولاء: استبدال (إن اختير) ثم اكتساب نقاط جديدة على قيمة البيع النهائية
    if (settings?.loyaltyOn && custForPoints) {
      const earned = Math.floor(total / (settings.pointsPerCurrency || 10));
      const redeemed = redeemBlocks * 100;
      setCustomers(cs => cs.map(c => c.id === custForPoints.id ? { ...c, points: Math.max(0, (c.points || 0) - redeemed + earned) } : c));
    }

    // decrement stock in pieces (sum piece+pack lines per product) — نحتفظ بمقدار التخفيض لكل منتج للتراجع لاحقاً إن لزم
    const stockDeltas = items.reduce((m, it) => { m[it.pid] = (m[it.pid] || 0) + it.qty * it.perPieces; return m; }, {});
    setProducts(ps => ps.map(p => {
      const pieces = stockDeltas[p.id];
      if (pieces && p.stock !== null) return { ...p, stock: Math.max(0, p.stock - pieces) };
      return p;
    }));
    // تكلفة البضاعة المباعة (COGS) = مجموع (سعر شراء القطعة × عدد القطع)
    const cost = items.reduce((s, it) => {
      const p = products.find(x => x.id === it.pid);
      return s + (p?.buy || 0) * it.qty * it.perPieces;
    }, 0);
    const loyaltyEarned = (settings?.loyaltyOn && custForPoints) ? Math.floor(total / (settings.pointsPerCurrency || 10)) : 0;
    const loyaltyRedeemed = (settings?.loyaltyOn && custForPoints) ? redeemBlocks * 100 : 0;
    // pieces: عدد القطع المخصومة فعلاً من المخزون لهذا السطر (qty قد يكون بالعلبة).
    // بدونه لا يستطيع إلغاء الفاتورة لاحقاً من سجل المبيعات إعادة الكمية الصحيحة —
    // انظر utils/invoiceReversal.js
    const inv = { id: num, customer: custName, customerId: custId, date: todayISO(), source: "منتج", details, items: items.map(it => ({ pid: it.pid, cat: it.cat, name: it.name, qty: it.qty, pieces: it.qty * it.perPieces, lineTotal: isFreeItem(it) ? 0 : Math.round(it.unitPrice * it.qty * 100) / 100, free: isFreeItem(it) || undefined })), loyaltyEarned, loyaltyRedeemed, pay: split ? split.label : PAY_LABEL[pay], ...(split ? { payParts: split.parts } : {}), discount: [discPct ? discPct + "%" : "", pointsDiscount ? `نقاط -${fmt(pointsDiscount)}` : "", freeValue > 0 ? `مزايا مجانية -${fmt(freeValue)}` : ""].filter(Boolean).join(" + ") || "—", total, cost: Math.round(cost * 100) / 100, status: pay === "defer" ? "معلقة" : "مدفوعة", by: user?.name || "—", time: new Date().toTimeString().slice(0, 5), ...(pay === "defer" ? { dueDate: dueDate || todayISO() } : {}), ...(pay === "employee" ? { empId: deferEmployee.id } : {}), ...(appliedCoupon ? { couponId: appliedCoupon.id, coupon: appliedCoupon.code } : {}) };
    setInvoices(iv => [inv, ...iv]);
    // يُحدَّث عداد استخدام الكوبون هنا فقط — عند إتمام بيع فعلي، لا عند مجرّد
    // تطبيقه في applyCoupon — فكان يبقى صفراً للأبد بلا أي ربط بالبيع الحقيقي
    if (appliedCoupon) setCoupons(cs => cs.map(x => x.id === appliedCoupon.id ? { ...x, used: (x.used || 0) + 1 } : x));
    showToast(pay === "defer" ? `فاتورة آجلة #${num} على ${custName} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}` : pay === "employee" ? `فاتورة موظف #${num} على ${custName} — ${fmt(total)} ${cur}${freeValue > 0 ? ` (مزايا مجانية ${fmt(freeValue)} ${cur})` : ""}` : `تم إنشاء الفاتورة #${num} — ${fmt(total)} ${ctx.settings?.currency || "د.ل"}`);
    setLastSale({ invoice: inv, stockDeltas, isDefer: pay === "defer", deferCustId: pay === "defer" ? deferCustomer.id : null, loyaltyCustId: custForPoints ? custForPoints.id : null, loyaltyEarned, loyaltyRedeemed });
    setCart({}); setDiscPct(0); setCoupon(""); setAppliedCoupon(null); setDeferCustomer(null); setDueDate(""); setPointsCustomer(null); setRedeemPoints(false); setDeferEmployee(null); setCashReceived(""); setSplitOn(false); setSplitAmount("");
  };

  // مرجع دائم التحديث لأحدث checkout — نفس سبب addByCodeRef أعلاه: المستمع العالمي
  // يُثبَّت مرة واحدة فقط فلا يرى تحديثات cart/pay اللاحقة إلا عبر هذا المرجع
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;
  // اختصار Ctrl+Enter لإتمام البيع من أي مكان في الشاشة — لا يتعارض مع Enter الخاص
  // بقارئ الباركود (يتجاهل الأحداث المصحوبة بـ ctrlKey أصلاً) ولا بحقول الإدخال العادية
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); checkoutRef.current(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // تراجع عن آخر عملية بيع فقط (أحدث فاتورة) — يعكس خصم المخزون ودَين الزبون الآجل ونقاط الولاء ثم يحذف الفاتورة.
  // العكس نفسه في utils/invoiceReversal.js ليتطابق مع إلغاء/حذف الفاتورة من سجل المبيعات بدل منطقَين منفصلين
  const undoLastSale = async () => {
    if (!lastSale) return;
    if (!(await ctx.confirm(`التراجع عن الفاتورة #${lastSale.invoice.id} نهائياً؟ سيُعاد المخزون المخصوم وأي دين أو نقاط ولاء مرتبطة بها.`, { danger: true }))) return;
    applyReversal(lastSale.invoice, { setProducts, setCustomers });
    setInvoices(iv => iv.filter(i => i.id !== lastSale.invoice.id));
    // التراجع عن فاتورة استخدمت كوبوناً يُعيد له استخدامه — وإلا يبقى العداد
    // محتسباً بيعاً أُلغي فعلياً
    if (lastSale.invoice.couponId != null) setCoupons(cs => cs.map(x => x.id === lastSale.invoice.couponId ? { ...x, used: Math.max(0, (x.used || 0) - 1) } : x));
    showToast(`تم التراجع عن الفاتورة #${lastSale.invoice.id}`);
    setLastSale(null);
  };

  const printLastReceipt = () => {
    if (!lastSale) return;
    const inv = lastSale.invoice;
    openPdfDoc(settings, {
      title: "إيصال بيع", recipientLabel: "الزبون", recipientName: inv.customer,
      docNo: inv.id,
      columns: ["الصنف", "الكمية", "الإجمالي"],
      rows: inv.items.map(it => [it.name, it.qty, fmt(it.lineTotal) + " " + cur]),
      totals: [["طريقة الدفع", inv.pay], ["الإجمالي", fmt(inv.total) + " " + cur]],
      note: `التاريخ: ${inv.date}${inv.time ? " — " + inv.time : ""} — بواسطة: ${inv.by || "—"}`,
    });
  };

  // تعليق السلة الحالية مؤقتاً (مثلاً حين يبتعد الزبون) — تُحفظ ويُفرَّغ العمل الحالي لخدمة زبون آخر فوراً
  const parkSale = () => {
    if (!items.length) return;
    setParkedSales(ps => [{ id: "PK-" + Date.now(), ts: new Date().toISOString(), label: parkLabel.trim(), cart, discPct, coupon, appliedCoupon, pay, count: items.reduce((s, i) => s + i.qty, 0), total }, ...ps]);
    setCart({}); setDiscPct(0); setCoupon(""); setAppliedCoupon(null); setCashReceived(""); setSplitOn(false); setSplitAmount(""); setParkPrompt(false); setParkLabel("");
    showToast("عُلِّقت الفاتورة — يمكنك استئنافها لاحقاً من الأعلى");
  };
  // استئناف فاتورة معلَّقة: يستبدل سلة العمل الحالية (إن كانت فيها أصناف تُفقد — نحذّر أولاً)
  const resumeSale = async (pk) => {
    if (items.length && !(await ctx.confirm("سيستبدل استئناف هذه الفاتورة سلة العمل الحالية غير المكتملة. متابعة؟", { danger: true }))) return;
    setCart(pk.cart); setDiscPct(pk.discPct); setCoupon(pk.coupon); setAppliedCoupon(pk.appliedCoupon || null); setPay(pk.pay);
    setParkedSales(ps => ps.filter(x => x.id !== pk.id));
  };
  const discardParked = async (pk) => {
    if (!(await ctx.confirm("حذف هذه الفاتورة المعلَّقة نهائياً؟", { danger: true }))) return;
    setParkedSales(ps => ps.filter(x => x.id !== pk.id));
  };

  const CAT_ICON = { games: "🎮", cafe: "☕" };
  const mode = ctx.settings?.posMode || "grid";
  return (
    <>
      <PageTop title="نقطة البيع السريع" />
      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 360px", gap: 14, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: ".7rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1.2, minWidth: 170, display: "flex", alignItems: "center", gap: 6, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".42rem .75rem" }}>
              <span style={{ color: C.mt, fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن صنف بالاسم..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.ink }} />
              {search && <button onClick={() => setSearch("")} aria-label="مسح البحث" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>✕</button>}
            </div>
            <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 6, background: C.grn, borderRadius: 10, padding: ".42rem .75rem", border: `1px solid ${C.gold}55` }}>
              <span style={{ fontSize: 14 }}>📷</span>
              <input ref={bcRef} value={bcInput} onChange={e => setBcInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addByBarcode()}
                placeholder="امسح الباركود أو اكتبه ثم Enter"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: "100%", fontFamily: "inherit", color: C.gld, letterSpacing: 1 }} />
              <button onClick={addByBarcode} style={{ background: C.gold, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>إضافة</button>
            </div>
          </div>

          {topSellers.length > 0 && (
            <div style={{ marginBottom: ".9rem" }}>
              <div style={{ fontSize: 11, color: C.mt, fontWeight: 600, marginBottom: 6 }}>⭐ الأكثر مبيعاً</div>
              <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 3 }}>
                {topSellers.map(p => (
                  <button key={p.id} onClick={() => add(p, "piece")} title={p.sell ? `${p.sell} ${cur}` : ""} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: C.cd, border: `1px solid ${C.gold}55`, borderRadius: 20, padding: ".35rem .8rem .35rem .5rem", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", overflow: "hidden", flexShrink: 0 }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: C.grn2, fontWeight: 700 }}>{p.sell} {cur}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: ".9rem", flexWrap: "wrap" }}>
            {[["all", "الكل"], ...Object.entries(ctx.cats || CATS)].map(([k, l]) => (
              <button key={k} onClick={() => setCatFilter(k)} style={{ padding: ".3rem .8rem", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", border: `0.5px solid ${C.bc}`, background: catFilter === k ? C.grn : C.crm, color: catFilter === k ? C.gld : C.k2, fontWeight: catFilter === k ? 600 : 400 }}>{l}</button>
            ))}
          </div>

          {parkedSales && parkedSales.length > 0 && (
            <div style={{ display: "flex", gap: 7, marginBottom: ".9rem", flexWrap: "wrap", background: C.gold + "12", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".55rem .7rem" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.gdd, alignSelf: "center" }}>⏸ فواتير معلَّقة ({parkedSales.length}):</span>
              {parkedSales.map(pk => (
                <div key={pk.id} style={{ display: "flex", alignItems: "center", gap: 5, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".3rem .5rem", fontSize: 11.5 }}>
                  <button onClick={() => resumeSale(pk)} style={{ background: "none", border: "none", cursor: "pointer", color: C.grn2, fontWeight: 600, fontFamily: "inherit" }}>▶ {pk.label ? pk.label + " — " : ""}{pk.count} صنف — {fmt(pk.total)} {cur}{pk.ts ? <span style={{ color: C.mt, fontWeight: 400 }}>{" · " + new Date(pk.ts).toTimeString().slice(0, 5)}</span> : null}</button>
                  <button onClick={() => discardParked(pk)} title="حذف" style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* حالتا فراغ مختلفتان قصداً: نظام بلا أي منتجات بعد يحتاج توجيهاً فعلياً (زر مباشر
              لصفحة المنتجات)، لا نفس رسالة "لا نتائج للبحث" التي تبدو كأن النظام لا يعمل */}
          {shown.length === 0 && products.length === 0 && (
            <div style={{ textAlign: "center", padding: "2.2rem 1rem", color: C.mt, fontSize: 12.5, background: C.cd, borderRadius: 11, border: `0.5px dashed ${C.bc}` }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📦</div>
              <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>لا توجد منتجات في النظام بعد</div>
              <div style={{ marginBottom: 12 }}>أضِف أول منتج من صفحة المنتجات لتظهر هنا جاهزة للبيع</div>
              {go && <Btn sm onClick={() => go("products")}>+ إضافة منتج</Btn>}
            </div>
          )}
          {shown.length === 0 && products.length > 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: C.mt, fontSize: 12.5, background: C.cd, borderRadius: 11, border: `0.5px dashed ${C.bc}` }}>لا توجد أصناف مطابقة{search ? ` لـ«${search}»` : ""}.</div>
          )}
          {mode === "grid" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
              {shown.map(p => {
                const promo = promoFor(promotions, p.cat);
                const dSell = promo && p.sell ? Math.round(p.sell * (1 - promo.pct / 100) * 100) / 100 : null;
                return (
                <div key={p.id} className="nk-card-hover" style={{ background: C.cd, border: `0.5px solid ${promo ? "#1a8c3e55" : C.bc}`, borderRadius: 11, padding: ".8rem .75rem", textAlign: "center", position: "relative" }}>
                  {promo && p.sell ? <span style={{ position: "absolute", top: 6, left: 6, background: "#1a8c3e", color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "1px 6px" }}>-{promo.pct}%</span> : null}
                  <div onClick={() => add(p, "piece")} style={{ cursor: "pointer" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto .5rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", overflow: "hidden" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                    {dSell !== null
                      ? <div style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: C.mt, textDecoration: "line-through", fontSize: 10.5, marginLeft: 4 }}>{p.sell}</span><span style={{ color: "#1a8c3e" }}>{dSell} {cur}</span></div>
                      : <div style={{ fontSize: 13, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "غير مُسعّر"}</div>}
                    <div style={{ fontSize: 10, color: C.mt, marginTop: 2 }}>{p.stock !== null ? `مخزون: ${p.stock} قطعة` : "خدمة"}</div>
                  </div>
                  {p.packSize > 1 && p.sell ? (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                      <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit} — {fmt(Math.round((p.sellPack || p.sell * p.packSize) * (promo ? 1 - promo.pct / 100 : 1) * 100) / 100)}</button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          )}
          {mode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {shown.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 10, padding: ".55rem .8rem" }}>
                  <div onClick={() => add(p, "piece")} style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: p.cat === "games" ? C.grl + "22" : C.gold + "22", flexShrink: 0, overflow: "hidden", cursor: "pointer" }}>{p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[p.cat]}</div>
                  <div onClick={() => add(p, "piece")} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>{CATS[p.cat]} · {p.stock !== null ? `مخزون ${p.stock} قطعة` : "خدمة"}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.grn2 }}>{p.sell ? `${p.sell} ${cur}` : "—"}</div>
                  {p.packSize > 1 && p.sell ? <button onClick={() => add(p, "pack")} style={posUnitBtn(true)}>{p.unit}</button> : null}
                  <button onClick={() => add(p, "piece")} style={posUnitBtn(false)}>قطعة</button>
                </div>
              ))}
            </div>
          )}
          {mode === "compact" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))", gap: 6 }}>
              {shown.map(p => (
                <div key={p.id} onClick={() => add(p, "piece")} style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 8, padding: ".45rem .5rem", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.grn2, marginTop: 2 }}>{p.sell || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Card style={{ position: "sticky", top: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".9rem" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🛍 سلة المبيعات</div>
            {items.length > 0 && <button onClick={() => { setParkLabel(deferCustomer?.name || pointsCustomer?.name || ""); setParkPrompt(true); }} title="تعليق الفاتورة لاستئنافها لاحقاً" style={{ background: "none", border: `1px solid ${C.bc}`, borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: ".25rem .6rem", color: C.k2, fontFamily: "inherit" }}>⏸ تعليق</button>}
          </div>
          {/* تسمية الفاتورة المعلَّقة — اختيارية: Enter بلا كتابة يُعلّق كما كان سابقاً */}
          {parkPrompt && (
            <div style={{ background: C.gold + "12", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".6rem .7rem", marginBottom: ".8rem" }}>
              <div style={{ fontSize: 11, color: C.gdd, fontWeight: 700, marginBottom: 5 }}>اسم الزبون أو ملاحظة (اختياري)</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={parkLabel} onChange={e => setParkLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") parkSale(); if (e.key === "Escape") { setParkPrompt(false); setParkLabel(""); } }}
                  placeholder="مثال: الطاولة 3" style={{ ...inputStyle, flex: 1 }} />
                <Btn sm gold onClick={parkSale}>⏸ تعليق</Btn>
                <Btn sm onClick={() => { setParkPrompt(false); setParkLabel(""); }}>إلغاء</Btn>
              </div>
            </div>
          )}
          {!items.length && lastSale && (
            <div ref={lastSaleRef} style={{ background: "#eaf6ee", border: "0.5px solid #1a8c3e55", borderRadius: 10, padding: ".7rem", marginBottom: ".9rem" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1a8c3e", marginBottom: 4 }}>✓ آخر عملية — فاتورة #{lastSale.invoice.id}</div>
              <div style={{ fontSize: 12, color: C.k2, marginBottom: 8 }}>{lastSale.invoice.customer} — {fmt(lastSale.invoice.total)} {cur}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn sm onClick={printLastReceipt} style={{ flex: 1, justifyContent: "center" }}>🖨 إيصال</Btn>
                <Btn sm danger onClick={undoLastSale} style={{ flex: 1, justifyContent: "center" }}>↩ تراجع</Btn>
              </div>
            </div>
          )}
          {!items.length && <div style={{ textAlign: "center", padding: "2rem 0", color: C.mt, fontSize: 12.5 }}>لا توجد منتجات بعد<br /><span style={{ fontSize: 11 }}>اضغط على منتج لإضافته</span></div>}
          <div ref={cartRef}>
          {items.map(it => (
            <div key={it.key} className="nk-cart-row" data-key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "0.5px solid rgba(201,168,76,.12)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name} {it.sellUnit === "pack" && <Badge tone="gold" style={{ fontSize: 9 }}>{it.unitLabel}</Badge>} {it.promoPct ? <Badge tone="g" style={{ fontSize: 9 }}>-{it.promoPct}%</Badge> : null}</div><div style={{ fontSize: 11, color: C.mt }}>{it.unitPrice} × {it.qty} {it.sellUnit === "pack" ? `(${it.perPieces} قطعة)` : ""}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.grn2, minWidth: 50, textAlign: "left" }}>{fmt(it.unitPrice * it.qty)}</span>
                <button onClick={() => chg(it.key, -1)} aria-label="إنقاص الكمية" style={qbtn}>−</button>
                <input type="number" min="1" value={it.qty} onChange={e => setQtyDirect(it.key, e.target.value)}
                  style={{ width: 32, fontSize: 12, fontWeight: 700, textAlign: "center", border: "none", background: "transparent", fontFamily: "inherit", color: C.ink, MozAppearance: "textfield" }} />
                <button onClick={() => chg(it.key, 1)} aria-label="زيادة الكمية" style={qbtn}>+</button>
              </div>
            </div>
          ))}
          </div>
          {items.length > 0 && (
            <div style={{ marginTop: ".75rem", borderTop: `1px solid ${C.bc}`, paddingTop: ".75rem" }}>
              <Row label="المجموع الفرعي" val={fmt(sub) + " د.ل"} />
              {disc > 0 && <Row label="الخصم" val={"-" + fmt(disc) + " د.ل"} color="#1a8c3e" />}
              {pointsDiscount > 0 && <Row label="🎁 خصم النقاط" val={"-" + fmt(pointsDiscount) + " د.ل"} color="#1a8c3e" />}
              {freeValue > 0 && <Row label="🎁 مزايا مجانية (موظف)" val={fmt(freeValue) + " د.ل"} color="#1a8c3e" />}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: `0.5px solid ${C.bc}`, marginTop: ".5rem", paddingTop: ".5rem" }}><span>الإجمالي</span><span style={{ color: C.grn2 }}><AnimatedNumber value={total} /> د.ل</span></div>
              {can("discounts") && (
                <div style={{ display: "flex", gap: 7, marginTop: ".7rem" }}>
                  <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="كود الخصم" style={{ ...inputStyle, flex: 1 }} />
                  <Btn sm onClick={applyCoupon}>تطبيق</Btn>
                </div>
              )}
              <div style={{ fontSize: 11, color: C.mt, fontWeight: 600, margin: ".8rem 0 5px" }}>طريقة الدفع</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["cash", "كاش"], ["card", "بطاقة"], ["transfer", "تحويل مصرفي"], ["defer", "آجل — زبون"], ["employee", "آجل — موظف (يُخصم من راتبه)"]].map(([k, l]) => (
                  <div key={k} onClick={() => setPay(k)} style={{ gridColumn: (k === "defer" || k === "employee") ? "1/-1" : "auto", border: `1px solid ${pay === k ? C.gold : C.bc}`, borderRadius: 8, padding: ".45rem .6rem", cursor: "pointer", fontSize: 12, fontWeight: pay === k ? 600 : 500, background: pay === k ? "rgba(201,168,76,.12)" : C.crm, color: pay === k ? C.grn2 : C.k2, textAlign: "center" }}>{l}</div>
                ))}
              </div>
              {splitAllowed && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, cursor: "pointer", color: C.k2 }}>
                    <input type="checkbox" checked={splitOn} onChange={e => { setSplitOn(e.target.checked); setSplitAmount(""); }} />
                    دفع مقسَّم على طريقتين
                  </label>
                  {splitOn && (
                    <div style={{ marginTop: 6, background: C.bluebg, border: `0.5px solid ${C.blue}44`, borderRadius: 10, padding: ".7rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, whiteSpace: "nowrap" }}>{PAY_LABEL[pay]}</span>
                        <input type="number" min="0" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} placeholder="المبلغ" style={{ ...inputStyle, flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Sel value={splitMethod2} onChange={e => setSplitMethod2(e.target.value)} style={{ flex: 1 }}>
                          {PAY_METHODS.filter(m => m !== PAY_LABEL[pay]).map(m => <option key={m} value={m}>{m}</option>)}
                        </Sel>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: splitFirst > 0 && splitFirst < total ? C.grn2 : C.mt, minWidth: 70, textAlign: "left" }}>
                          {splitFirst > 0 && splitFirst < total ? `${fmt(splitRest)} ${cur}` : "الباقي"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {pay === "cash" && !splitActive && (
                <div style={{ marginTop: 8, background: "#eaf6ee", border: "0.5px solid #1a8c3e55", borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1a8c3e", marginBottom: 6 }}>حاسبة الباقي</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input type="number" min="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="المبلغ المستلم من الزبون" style={{ ...inputStyle, flex: 1 }} />
                    {cashReceived !== "" && <button onClick={() => setCashReceived("")} aria-label="مسح المبلغ المستلم" style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 13 }}>✕</button>}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: cashReceived !== "" ? 8 : 0 }}>
                    {[5, 10, 20, 50, 100].map(v => (
                      <button key={v} onClick={() => setCashReceived(String((parseFloat(cashReceived) || 0) + v))} style={{ flex: 1, minWidth: 40, padding: ".3rem 0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "0.5px solid #1a8c3e55", background: "#fff", color: "#1a8c3e" }}>+{v}</button>
                    ))}
                  </div>
                  {cashReceived !== "" && (
                    cashInsufficient
                      ? <div style={{ fontSize: 12, fontWeight: 700, color: C.red, textAlign: "center" }}>ناقص <AnimatedNumber value={Math.abs(change)} /> {cur}</div>
                      : <div style={{ fontSize: 13, fontWeight: 700, color: "#1a8c3e", textAlign: "center" }}>الباقي للزبون: <AnimatedNumber value={change} /> {cur}</div>
                  )}
                </div>
              )}
              {pay === "defer" && (
                <div style={{ marginTop: 8, background: C.gold + "10", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>البيع الآجل يُسجّل على حساب زبون</div>
                  {deferCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>📱 {deferCustomer.phone}</div></div>
                      <button onClick={() => setDeferCustomer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <>
                      <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setDeferCustomer(c); }} style={{ marginBottom: 6 }}>
                        <option value="">اختر من قائمة الزبائن...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                      </Sel>
                      <Btn sm onClick={() => setCustModal(true)} style={{ width: "100%", justifyContent: "center" }}>+ تسجيل زبون جديد</Btn>
                    </>
                  )}
                  {deferCustomer && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.mt, fontWeight: 600, marginBottom: 3 }}>تاريخ استحقاق السداد</div>
                      <Inp type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ background: C.cd }} />
                    </div>
                  )}
                </div>
              )}
              {pay === "employee" && (
                <div style={{ marginTop: 8, background: C.purpbg, border: `0.5px solid ${C.purp}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purp, marginBottom: 6 }}>يُخصم المبلغ تلقائياً من راتب الموظف — تُحتسب هذه العملية ضمن مبيعات وأرباح النادي فوراً</div>
                  {deferEmployee ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{deferEmployee.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>راتب {fmt(deferEmployee.salary)} {cur}</div></div>
                      <button onClick={() => setDeferEmployee(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>تغيير</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const emp = employees.find(x => x.id == e.target.value); if (emp) setDeferEmployee(emp); }}>
                      <option value="">اختر الموظف...</option>
                      {employees.filter(e => e.status === "نشط").map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                    </Sel>
                  )}
                  {freeValue > 0 && <div style={{ marginTop: 8, fontSize: 11, color: "#1a8c3e", fontWeight: 600, background: "#eaf6ee", borderRadius: 7, padding: ".4rem .6rem" }}>🎁 {fmt(freeValue)} {cur} من هذه السلة مجانية (أقسام معفاة) — لن تُخصم من راتبه</div>}
                </div>
              )}
              {settings?.loyaltyOn && pay !== "defer" && pay !== "employee" && (
                <div style={{ marginTop: 8, background: "#fff7eb", border: `0.5px solid ${C.gold}55`, borderRadius: 10, padding: ".7rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gdd, marginBottom: 6 }}>🎁 اختر زبوناً لكسب نقاط الولاء (اختياري)</div>
                  {pointsCustomer ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cd, borderRadius: 8, padding: ".5rem .7rem" }}>
                      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{pointsCustomer.name}</div><div style={{ fontSize: 10.5, color: C.mt }}>🎁 {pointsCustomer.points || 0} نقطة</div></div>
                      <button onClick={() => { setPointsCustomer(null); setRedeemPoints(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mt, fontSize: 14 }}>إزالة</button>
                    </div>
                  ) : (
                    <Sel value="" onChange={e => { const c = customers.find(x => x.id == e.target.value); if (c) setPointsCustomer(c); }}>
                      <option value="">اختر من قائمة الزبائن...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.points || 0} نقطة</option>)}
                    </Sel>
                  )}
                </div>
              )}
              {settings?.loyaltyOn && custForPoints && Math.floor((custForPoints.points || 0) / 100) > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 8, cursor: "pointer", background: "rgba(26,140,62,.07)", borderRadius: 8, padding: ".5rem .7rem" }}>
                  <input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />
                  استخدام {Math.floor((custForPoints.points || 0) / 100) * 100} نقطة = خصم {fmt(Math.floor((custForPoints.points || 0) / 100) * (settings.pointsRedeemValue || 0))} {cur}
                </label>
              )}
              <button onClick={checkout} disabled={cashInsufficient} title="اختصار: Ctrl+Enter" style={{ width: "100%", marginTop: ".9rem", padding: ".65rem", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: cashInsufficient ? "not-allowed" : "pointer", border: "none", background: cashInsufficient ? C.mt : "linear-gradient(135deg," + C.gold + "," + C.gdd + ")", color: "#fff", fontFamily: "inherit", opacity: cashInsufficient ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ✓ إتمام البيع
                <span style={{ fontSize: 10, fontWeight: 600, opacity: .75, background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "1px 6px" }}>Ctrl+Enter</span>
              </button>
            </div>
          )}
        </Card>
      </div>
      {custModal && <NewCustomerModal ctx={ctx} onClose={() => setCustModal(false)} onCreated={(c) => { setDeferCustomer(c); setCustModal(false); }} />}
    </>
  );
}
