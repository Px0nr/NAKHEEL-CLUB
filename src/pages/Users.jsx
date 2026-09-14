import { useState } from "react";
import { C } from "../constants/theme.js";
import { PAGE_LIST, PERM_LABELS } from "../constants/seeds.js";
import { PageTop, Btn, Card, CardHead, Badge, Modal, Field, Inp, Sel } from "../components/ui.jsx";
import { todayISO } from "../utils/format.js";
import { genSalt, hashPassword } from "../utils/auth.js";

const emptyForm = { name: "", password: "", role: "بائع", shift: "صباحي", salary: "", salaryStart: todayISO() };

/* ============================ USERS ============================ */
export default function Users({ ctx }) {
  const { users, setUsers, employees, setEmployees, setAuditLog, user, showToast, confirm } = ctx;
  const [sel, setSel] = useState(users.find(u => u.role === "بائع")?.id || users[0]?.id || null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // مستخدم قيد تعديل بياناته الأساسية — null يعني إضافة جديد
  const [f, setF] = useState(emptyForm);
  const [newPwd, setNewPwd] = useState("");
  const current = users.find(u => u.id === sel) || users[0];
  if (!current) return <><PageTop title="المستخدمون والصلاحيات" /><Card><div style={{ textAlign: "center", padding: "2rem", color: C.mt }}>لا مستخدمون بعد.</div></Card></>;
  const logAudit = (type, detail) => setAuditLog(al => [{ id: "AU-" + Date.now(), date: todayISO(), by: user?.name || "—", type, detail }, ...al]);
  // كان تبديل صلاحية أو إظهار قائمة أو إيقاف حساب — كلها تغييرات حسّاسة على من
  // يرى/يفعل ماذا في النظام — يمرّ بلا أي أثر في سجل التدقيق، خلافاً حتى لتعديل
  // سعر منتج الذي يُسجَّل هناك فعلاً
  const togglePerm = (k) => {
    setUsers(us => us.map(u => u.id === sel ? { ...u, perms: { ...u.perms, [k]: !u.perms[k] } } : u));
    logAudit("تعديل صلاحيات", `${current.name}: ${PERM_LABELS[k]} ← ${current.perms[k] ? "معطّلة" : "مفعّلة"}`);
  };
  const toggleActive = async () => {
    if (current.active && !(await confirm(`إيقاف حساب ${current.name}؟ لن يستطيع تسجيل الدخول للنظام حتى تُعيد تفعيله.`, { danger: true }))) return;
    setUsers(us => us.map(u => u.id === sel ? { ...u, active: !u.active } : u));
    logAudit(current.active ? "إيقاف حساب" : "تفعيل حساب", current.name);
    showToast(current.active ? `أُوقف حساب ${current.name}` : `أُعيد تفعيل حساب ${current.name}`);
  };
  // page visibility: page مرئية إلا إذا كانت pages[id] === false
  const pageVisible = (id) => !(current.pages && current.pages[id] === false);
  const togglePage = (id) => {
    setUsers(us => us.map(u => {
      if (u.id !== sel) return u;
      const pages = { ...(u.pages || {}) };
      pages[id] = pages[id] === false ? true : false; // بدّل بين مرئي/مخفي
      return { ...u, pages };
    }));
    const label = PAGE_LIST.find(p => p.id === id)?.label || id;
    logAudit("تعديل القوائم الظاهرة", `${current.name}: ${label} ← ${pageVisible(id) ? "مخفية" : "ظاهرة"}`);
  };
  const setAllPages = (visible) => setUsers(us => us.map(u => {
    if (u.id !== sel) return u;
    const pages = {};
    PAGE_LIST.forEach(p => { if (!visible) pages[p.id] = false; }); // إخفاء الكل = وضع false للجميع
    return { ...u, pages };
  }));
  const openAddModal = () => { setEditing(null); setF(emptyForm); setModal(true); };
  // تعديل الاسم/اسم الدخول/الدور/الوردية بعد الإنشاء — لم تكن هناك وسيلة
  // لتصحيح خطأ إملائي أو تحديث الوردية سوى حذف الحساب وإعادة إنشائه بالكامل
  const openEditModal = (u) => { setEditing(u); setF({ name: u.name, password: "", role: u.role, shift: u.shift, salary: "", salaryStart: todayISO() }); setModal(true); };

  const addUser = async () => {
    if (!f.name.trim()) { showToast("أدخل الاسم"); return; }
    if (!f.password || f.password.length < 4) { showToast("أدخل رمز دخول من 4 خانات على الأقل"); return; }
    const perms = { invoices: true, discounts: false, cancel: false, reports: false, customers: true, prices: false, purchases: false, inventory: false, salaries: false };
    const newId = Math.max(0, ...users.map(x => x.id)) + 1;
    let linkedEmployeeId = null;
    // ربط تلقائي بسجل موظف — يُنشأ فور إضافة راتب لحساب غير إداري، لتفادي إدخال مزدوج أو خطأ تطابق بالاسم
    if (f.role !== "مدير" && f.salary && parseFloat(f.salary) > 0) {
      const empId = Math.max(0, ...employees.map(x => x.id)) + 1;
      setEmployees(es => [...es, { id: empId, name: f.name.trim(), role: f.role, hired: f.salaryStart, salaryStart: f.salaryStart, salary: parseFloat(f.salary), status: "نشط" }]);
      linkedEmployeeId = empId;
    }
    const passwordSalt = genSalt();
    const passwordHash = await hashPassword(f.password, passwordSalt);
    setUsers(us => [...us, { id: newId, name: f.name.trim(), passwordHash, passwordSalt, role: f.role, shift: f.shift, active: true, perms, pages: {}, linkedEmployeeId }]);
    showToast(linkedEmployeeId ? "تمت إضافة المستخدم وربطه تلقائياً بسجل موظف براتبه" : "تمت إضافة المستخدم");
    setModal(false); setF(emptyForm);
  };

  const saveEdit = () => {
    if (!f.name.trim()) { showToast("أدخل الاسم"); return; }
    setUsers(us => us.map(u => u.id === editing.id ? { ...u, name: f.name.trim(), role: f.role, shift: f.shift } : u));
    // مزامنة سجل الموظف المرتبط (إن وجد) كي لا يختلف الاسم بين الحسابين
    if (editing.linkedEmployeeId != null) {
      setEmployees(es => es.map(e => e.id === editing.linkedEmployeeId ? { ...e, name: f.name.trim(), role: f.role } : e));
    }
    logAudit("تعديل بيانات مستخدم", `${editing.name} ← ${f.name.trim()} (${f.role})`);
    showToast("تم تحديث بيانات المستخدم");
    setModal(false); setEditing(null); setF(emptyForm);
  };
  const save = () => editing ? saveEdit() : addUser();
  const visibleCount = PAGE_LIST.filter(p => pageVisible(p.id)).length;

  return (
    <>
      <PageTop title="المستخدمون والصلاحيات" action={<Btn gold onClick={openAddModal}>+ إضافة مستخدم</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: ctx.scr?.isTab ? "1fr" : "1fr 1.8fr", gap: 11 }}>
        <Card>
          <CardHead title="المستخدمون" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {users.map(u => (
              <div key={u.id} onClick={() => setSel(u.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".55rem .75rem", border: `0.5px solid ${sel === u.id ? "rgba(201,168,76,.5)" : C.bc}`, borderRadius: 9, cursor: "pointer", background: sel === u.id ? "rgba(201,168,76,.08)" : C.crm }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={{ width: 29, height: 29, borderRadius: "50%", background: u.role === "مدير" ? C.gold : C.grl, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{u.name.slice(0, 2)}</div><div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}{u.linkedEmployeeId && <span title="مرتبط بسجل موظف براتب" style={{ marginRight: 4 }}>🔗</span>}</div><div style={{ fontSize: 10, color: C.mt }}>{u.role}{u.shift !== "—" ? " — " + u.shift : ""}{!u.active && " · موقوف"}</div></div></div>
                <Badge tone={u.role === "مدير" ? "gold" : "g"}>{u.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {/* الصلاحيات التفصيلية */}
          <Card>
            <CardHead title={`صلاحيات — ${current.name}`} sub={current.role === "مدير" ? "المدير يملك كل الصلاحيات تلقائياً" : "فعّل أو عطّل كل صلاحية"} right={<Btn sm onClick={() => openEditModal(current)}>✎ تعديل البيانات</Btn>} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 7 }}>
              {Object.keys(PERM_LABELS).map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.crm, borderRadius: 7, padding: ".42rem .6rem", fontSize: 12, opacity: current.role === "مدير" ? .6 : 1 }}>
                  <span>{PERM_LABELS[k]}</span>
                  <div onClick={() => current.role !== "مدير" && togglePerm(k)} style={{ width: 32, height: 17, borderRadius: 8, position: "relative", cursor: current.role === "مدير" ? "default" : "pointer", background: (current.perms[k] || current.role === "مدير") ? C.grl : "#ccc", transition: ".2s" }}>
                    <div style={{ position: "absolute", width: 13, height: 13, borderRadius: "50%", background: "#fff", top: 2, right: (current.perms[k] || current.role === "مدير") ? 2 : 17, transition: ".2s" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* رمز الدخول */}
          <Card>
            <CardHead title="🔑 رمز الدخول" sub={(current.passwordHash || current.password) ? "رمز محدد لهذا الحساب ✓" : "⚠ لا يوجد رمز — يُنصح بتعيينه فوراً"} />
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <Inp type="password" autoComplete="new-password" placeholder="رمز جديد (4 خانات فأكثر)" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <Btn gold sm onClick={async () => {
                if (!newPwd || newPwd.length < 4) { showToast("الرمز يجب أن يكون 4 خانات على الأقل"); return; }
                const passwordSalt = genSalt();
                const passwordHash = await hashPassword(newPwd, passwordSalt);
                setUsers(us => us.map(u => u.id === sel ? { ...u, passwordHash, passwordSalt, password: undefined } : u));
                setNewPwd(""); showToast(`تم تحديث رمز دخول ${current.name}`);
              }}>حفظ الرمز</Btn>
            </div>
          </Card>

          {/* التحكم في القوائم الظاهرة */}
          <Card>
            <CardHead
              title="القوائم الظاهرة لهذا المستخدم"
              sub={current.role === "مدير" ? "المدير يرى كل القوائم دائماً" : `${visibleCount} من ${PAGE_LIST.length} قائمة ظاهرة`}
              right={current.role !== "مدير" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn sm onClick={() => setAllPages(true)}>إظهار الكل</Btn>
                  <Btn sm danger onClick={() => setAllPages(false)}>إخفاء الكل</Btn>
                </div>
              )}
            />
            {current.role === "مدير" ? (
              <div style={{ textAlign: "center", padding: "1.2rem", color: C.mt, fontSize: 12.5 }}>👑 حساب المدير يصل إلى جميع أقسام النظام دون قيود.</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: C.mt, marginBottom: 8 }}>اضغط على أي قائمة لإظهارها أو إخفائها من واجهة هذا المستخدم:</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 7 }}>
                  {PAGE_LIST.map(p => {
                    const vis = pageVisible(p.id);
                    return (
                      <div key={p.id} onClick={() => togglePage(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: vis ? "#e9f6ee" : "#f4f2ec", border: `1px solid ${vis ? "rgba(26,140,62,.3)" : C.bc}`, borderRadius: 8, padding: ".45rem .65rem", fontSize: 12, cursor: "pointer", opacity: vis ? 1 : .65 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span>{p.icon}</span>{p.label}</span>
                        <span style={{ fontSize: 13 }}>{vis ? "👁" : "🚫"}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {current.role !== "مدير" && (
              <div style={{ display: "flex", gap: 7, marginTop: ".85rem" }}>
                <Btn sm danger onClick={toggleActive}>{current.active ? "إيقاف الحساب" : "تفعيل الحساب"}</Btn>
              </div>
            )}
          </Card>
        </div>
      </div>
      {modal && <Modal title={editing ? `تعديل بيانات — ${editing.name}` : "إضافة مستخدم جديد"} onClose={() => { setModal(false); setEditing(null); }} width={460}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="الاسم الكامل" full><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="الدور"><Sel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="بائع">بائع</option><option value="مدير">مدير</option></Sel></Field>
          <Field label="الوردية"><Sel value={f.shift} onChange={e => setF({ ...f, shift: e.target.value })}><option>صباحي</option><option>مسائي</option><option value="—">—</option></Sel></Field>
          {!editing && <Field label="رمز الدخول * (4 خانات فأكثر)" full><Inp type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="••••••" /></Field>}
        </div>
        {!editing && f.role !== "مدير" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={"الراتب الشهري (" + (ctx.settings?.currency || "د.ل") + ") — اختياري"}><Inp type="number" min="0" value={f.salary} onChange={e => setF({ ...f, salary: e.target.value })} placeholder="0" /></Field>
              <Field label="تاريخ بداية العمل"><Inp type="date" value={f.salaryStart} onChange={e => setF({ ...f, salaryStart: e.target.value })} /></Field>
            </div>
            <div style={{ fontSize: 10.5, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 10, lineHeight: 1.7 }}>💡 إن أدخلت راتباً، سيُنشأ تلقائياً سجل موظف مرتبط بنفس هذا الحساب في صفحة «المرتبات» — لا حاجة لإدخاله مرتين.</div>
          </>
        )}
        {!editing && <div style={{ fontSize: 11, color: C.mt, marginBottom: 10 }}>سيُمنح المستخدم صلاحيات افتراضية وكل القوائم ظاهرة — عدّلها بعد الإضافة. يسجّل الدخول برمزه الخاص.</div>}
        {editing?.linkedEmployeeId != null && <div style={{ fontSize: 10.5, color: C.gdd, background: C.gold + "12", borderRadius: 8, padding: ".55rem .75rem", marginBottom: 10, lineHeight: 1.7 }}>💡 الاسم والدور سيُحدَّثان أيضاً في سجل الموظف المرتبط بهذا الحساب.</div>}
        <div style={{ display: "flex", gap: 8 }}><Btn gold onClick={save} style={{ flex: 1, justifyContent: "center" }}>✓ {editing ? "حفظ التعديلات" : "إضافة"}</Btn><Btn onClick={() => { setModal(false); setEditing(null); }}>إلغاء</Btn></div>
      </Modal>}
    </>
  );
}
