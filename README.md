# متجر HOODIE - E-commerce كامل

## تشغيل المشروع

### 1. تشغيل قاعدة البيانات
تأكد من تشغيل MongoDB محلياً على `mongodb://127.0.0.1:27017`

### 2. تشغيل الباكند
```bash
cd back
npm install
node server.js
```

### 3. (اختياري) إضافة منتجات تجريبية
```bash
cd back
node server.js
```

### 4. تشغيل الفرونتند
افتح مجلد `front` واعرض الملفات عبر خادم محلي، مثلاً:
- من VS Code: استخدم Live Server على `index.html`
- أو: `npx serve front` من جذر المشروع

ثم افتح: `http://localhost:3000` (أو المنفذ الذي يظهر)

---

## الصفحات

| الصفحة | الوصف |
|--------|--------|
| `index.html` | الرئيسية - عرض المنتجات، فلترة، إضافة للسلة |
| `cart.html` | السلة - تعديل الكميات، إتمام الطلب |
| `admin.html` | لوحة الإدارة - إضافة/تعديل/حذف منتجات، عرض الطلبات وتحديث حالتها |

## API الباكند

- `GET /api/products` — كل المنتجات
- `GET /api/products/:id` — منتج واحد
- `POST /api/products` — إضافة منتج
- `PUT /api/products/:id` — تحديث منتج
- `DELETE /api/products/:id` — حذف منتج
- `POST /api/orders` — إنشاء طلب (checkout)
- `GET /api/orders` — كل الطلبات (للإدارة)
- `PUT /api/orders/:id` — تحديث حالة الطلب

السيرفر يعمل على المنفذ **5000**.
