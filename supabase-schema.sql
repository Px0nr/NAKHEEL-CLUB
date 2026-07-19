-- =========================================================================
-- نادي النخيل — مخطط قاعدة البيانات (Supabase / PostgreSQL)
-- نفّذ هذا الملف مرة واحدة في: Supabase → SQL Editor → New query → Run
-- =========================================================================

-- جدول التخزين الرئيسي: كل مجموعة بيانات (منتجات، زبائن، فواتير...) تُحفظ
-- كمستند JSON تحت مفتاح خاص بها. هذا يطابق بنية النظام تماماً ويجعل
-- الحفظ والمزامنة فوريين وبسيطين.
create table if not exists nk_store (
  k          text primary key,          -- اسم المجموعة: products, customers, invoices...
  v          jsonb not null,            -- البيانات نفسها
  updated_at timestamptz default now()  -- آخر تحديث
);

-- تفعيل أمان مستوى الصفوف
alter table nk_store enable row level security;

-- سياسة وصول: مفتوحة لمفتاح anon (نظام داخلي لنادٍ واحد).
-- لاحقاً يمكن تقييدها بمصادقة Supabase Auth إن أردت حسابات حقيقية.
drop policy if exists "nakheel_full_access" on nk_store;
create policy "nakheel_full_access"
  on nk_store
  for all
  using (true)
  with check (true);

-- فهرس زمني اختياري لمراقبة آخر التحديثات
create index if not exists nk_store_updated_idx on nk_store (updated_at desc);

-- =========================================================================
-- تحقّق سريع (اختياري): بعد التشغيل نفّذ السطر التالي — يجب أن يعمل بلا خطأ
--   select * from nk_store;
-- =========================================================================

-- =========================================================================
-- ملاحظة للمستقبل: عند الرغبة في الترقية لمخطط علائقي كامل (جداول منفصلة
-- بعلاقات foreign keys وتقارير SQL مباشرة)، هذا هو الهيكل المقترح:
--
--   products(id, bc, name, cat_id, unit, pack_size, sell, sell_pack, buy,
--            stock, min, has_exp, exp, supplier_id, status, img)
--   categories(id, name)
--   customers(id, name, phone, wa, tier, debt, total, invoices_count, last)
--   suppliers(id, name, phone, wa, spec, total, due, status)
--   invoices(id, customer_id, date, source, details, pay, discount, total,
--            status, due_date)
--   invoice_lines(id, invoice_id, product_id, qty, unit, unit_price)
--   purchases(id, supplier_id, date, pay, total, status)
--   purchase_lines(id, purchase_id, product_id, qty, qty_unit, buy_basis,
--                  buy_price, sell_piece, sell_pack, exp)
--   expenses(id, date, category, note, amount)
--   employees(id, name, role, salary, phone)
--   coupons(id, code, descr, pct, used, usage_limit, exp, status)
--   promotions(id, name, cat_id, pct, date_from, date_to, period, active)
--   tables_(id, type, name, rate)
--   bookings(id, table_id, customer, start_time, rate, ended_at, total,
--            invoice_id)
--   users(id, name, username, role, shift, active, perms jsonb)
--   settings(k, v)
--
-- الانتقال إليه لا يغيّر واجهة النظام — فقط طبقة الحفظ.
-- =========================================================================
