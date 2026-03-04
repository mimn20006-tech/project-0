const AbandonedCart = require("../models/abandonedCart");
const Product = require("../models/product");
const User = require("../models/user");
const { sendMail } = require("../utils/mailer");

const FRONTEND_URL = String(process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:5500").replace(/\/+$/, "");
const JOB_INTERVAL_MINUTES = Math.max(5, Number(process.env.MARKETING_JOB_INTERVAL_MINUTES || 15));
const ABANDONED_DELAY_MINUTES = Math.max(15, Number(process.env.ABANDONED_CART_DELAY_MINUTES || 60));
const ABANDONED_COOLDOWN_HOURS = Math.max(6, Number(process.env.ABANDONED_REMINDER_COOLDOWN_HOURS || 24));
const PROMO_COOLDOWN_HOURS = Math.max(24, Number(process.env.PROMO_INTERVAL_HOURS || 72)); // 3 days

let running = false;

function randomFrom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function toImageUrl(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) {
    const api = String(process.env.BASE_URL || "").replace(/\/+$/, "");
    return api ? `${api}${value}` : value;
  }
  return value;
}

async function sendAbandonedCartReminders() {
  const olderThan = new Date(Date.now() - ABANDONED_DELAY_MINUTES * 60 * 1000);
  const remindAgainAfter = new Date(Date.now() - ABANDONED_COOLDOWN_HOURS * 60 * 60 * 1000);
  const carts = await AbandonedCart.find({
    status: "active",
    lastActiveAt: { $lte: olderThan },
    $or: [{ remindedAt: { $exists: false } }, { remindedAt: null }, { remindedAt: { $lte: remindAgainAfter } }]
  })
    .sort({ lastActiveAt: 1 })
    .limit(200);

  let sent = 0;
  for (const cart of carts) {
    const first = Array.isArray(cart.items) && cart.items.length ? cart.items[0] : null;
    const productLine = first
      ? `منتج مثل: ${first.name || "منتج من المتجر"}${first.quantity ? ` × ${first.quantity}` : ""}\n`
      : "";
    const recoverUrl = `${FRONTEND_URL}/cart.html?recover=1`;
    try {
      await sendMail({
        to: cart.email,
        subject: "Hand Aura - عندك منتجات لسه في السلة",
        text:
          `مرحبًا ${cart.name || ""}\n` +
          `لسه عندك منتجات في السلة بقيمة ${Number(cart.total || 0).toFixed(0)} جنيه.\n` +
          productLine +
          `ادخل كمّل الشراء من هنا: ${recoverUrl}\n` +
          `لو حصل أي مشكلة، فريق Hand Aura جاهز يساعدك.`
      });
      cart.remindedAt = new Date();
      await cart.save();
      sent += 1;
    } catch (err) {
      console.error("ABANDONED_REMINDER_FAILED", { email: cart.email, error: err.message });
    }
  }
  if (sent > 0) {
    console.log("ABANDONED_REMINDERS_SENT", { sent, checked: carts.length });
  }
}

async function sendPromoCampaign() {
  const threshold = new Date(Date.now() - PROMO_COOLDOWN_HOURS * 60 * 60 * 1000);
  const users = await User.find({
    role: "user",
    emailVerified: true,
    email: { $exists: true, $ne: "" },
    $or: [{ marketingLastSentAt: { $exists: false } }, { marketingLastSentAt: null }, { marketingLastSentAt: { $lte: threshold } }]
  })
    .select("_id name email marketingLastSentAt")
    .limit(500);

  if (!users.length) return;

  const products = await Product.find({ stock: { $gt: 0 } })
    .select("name description price stock image images")
    .lean();
  if (!products.length) return;

  let sent = 0;
  for (const user of users) {
    const p = randomFrom(products);
    if (!p) break;
    const img = toImageUrl((p.images && p.images[0]) || p.image);
    const productUrl = `${FRONTEND_URL}/index.html`;
    const desc = String(p.description || "").trim();
    try {
      await sendMail({
        to: user.email,
        subject: `Hand Aura - عرض على ${p.name}`,
        text:
          `مرحبًا ${user.name || ""}\n` +
          `منتج مقترح لك اليوم: ${p.name}\n` +
          (desc ? `الوصف: ${desc}\n` : "") +
          `السعر: ${Number(p.price || 0).toFixed(0)} جنيه\n` +
          `المتوفر الآن: ${Number(p.stock || 0)} قطعة\n` +
          `الحق قبل نفاذ الكمية.\n` +
          `${img ? `الصورة: ${img}\n` : ""}` +
          `تسوق الآن: ${productUrl}`
      });
      user.marketingLastSentAt = new Date();
      await user.save();
      sent += 1;
    } catch (err) {
      console.error("PROMO_EMAIL_FAILED", { email: user.email, error: err.message });
    }
  }

  if (sent > 0) {
    console.log("PROMO_EMAILS_SENT", { sent, checked: users.length });
  }
}

async function runMarketingJobsOnce() {
  if (running) return;
  running = true;
  try {
    await sendAbandonedCartReminders();
    await sendPromoCampaign();
  } catch (err) {
    console.error("MARKETING_JOBS_ERROR", err.message);
  } finally {
    running = false;
  }
}

function startMarketingJobs() {
  const enabled = String(process.env.MARKETING_JOBS_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) {
    console.log("MARKETING_JOBS_DISABLED");
    return;
  }
  setTimeout(() => {
    runMarketingJobsOnce();
  }, 15000);
  setInterval(() => {
    runMarketingJobsOnce();
  }, JOB_INTERVAL_MINUTES * 60 * 1000);
  console.log("MARKETING_JOBS_STARTED", {
    intervalMinutes: JOB_INTERVAL_MINUTES,
    abandonedDelayMinutes: ABANDONED_DELAY_MINUTES,
    promoIntervalHours: PROMO_COOLDOWN_HOURS
  });
}

module.exports = { startMarketingJobs, runMarketingJobsOnce };
