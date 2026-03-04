# Railway – نشر الباك إند واستخدام CLI

## تثبيت Railway CLI

### Windows (PowerShell)
```powershell
iwr https://raw.githubusercontent.com/railwayapp/cli/master/install.ps1 | iex
```

### أو عبر npm
```bash
npm install -g @railway/cli
```

### تسجيل الدخول
```bash
railway login
```
يفتح المتصفح لتسجيل الدخول بحساب Railway.

---

## ربط المشروع بمشروع Railway

من جذر المشروع:
```bash
railway link
```
اختر المشروع (Project) والسيرفس (Service) الخاص بالباك إند.

---

## متغيرات البيئة المطلوبة على Railway

اضبطها من لوحة Railway أو عبر CLI:

### أساسية
| المتغير | الوصف |
|--------|--------|
| `PORT` | Railway يضبطه تلقائياً؛ لا تحتاج لتعديله |
| `MONGODB_URI` | رابط اتصال MongoDB (مثلاً Atlas) |
| `JWT_SECRET` | سري لتوقيع JWT |
| `ALLOWED_ORIGINS` | أصول الفرونت (مثلاً `https://your-front.railway.app`) |
| `BASE_URL` | رابط الباك إند على Railway (مثلاً `https://your-back.railway.app`) |
| `FRONTEND_URL` | رابط الفرونت إند |

### البريد (SendGrid فقط)
| المتغير | الوصف |
|--------|--------|
| `SENDGRID_API_KEY` | مفتاح API من [SendGrid](https://app.sendgrid.com/settings/api_keys) |
| `MAIL_FROM` | بريد المرسل المُتحقق منه في SendGrid (Single Sender أو Domain) |

### اختيارية
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (لتسجيل الدخول بـ Google)
- `ADMIN_EMAIL`
- إعدادات الدفع (Stripe, PayPal, إلخ) حسب الحاجة

---

## تعيين المتغيرات عبر CLI

```bash
# تعيين واحد
railway variables set SENDGRID_API_KEY=SG.xxxx

# تعيين عدة متغيرات من ملف .env (لا تنشر ملف .env نفسه)
railway variables set --from .env
```

---

## النشر

من جذر المشروع:
```bash
railway up
```

أو من مجلد `back`:
```bash
cd back
railway up
```

البناء والبدء مُعرّفان في `railway.json`:
- **Build:** `npm --prefix back install`
- **Start:** `npm --prefix back start`

---

## أوامر مفيدة

| الأمر | الوصف |
|--------|--------|
| `railway status` | حالة المشروع والخدمة |
| `railway logs` | عرض السجلات المباشرة |
| `railway shell` | فتح shell داخل بيئة Railway |
| `railway run npm start` | تشغيل أمر محلياً مع متغيرات Railway |

---

## التأكد من عمل SendGrid

1. إنشاء API Key من [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys).
2. التحقق من المرسل (Single Sender أو Domain) في SendGrid.
3. تعيين على Railway:
   - `SENDGRID_API_KEY=SG.xxx`
   - `MAIL_FROM=your-verified@example.com`
4. إعادة النشر ثم تجربة "إعادة إرسال الرمز" أو التسجيل؛ يجب أن تصل الإيميلات عبر SendGrid.
