const router = require("express").Router();
const Comment = require("../models/comment");
const { requirePermission } = require("../middleware/auth");

router.get("/", requirePermission("comment.read"), async (req, res) => {
  try {
    const status = String(req.query.status || "all");
    const query = {};
    if (status === "pending") query.isApproved = false;
    if (status === "approved") query.isApproved = true;
    const comments = await Comment.find(query).sort({ isApproved: 1, createdAt: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/approve", requirePermission("comment.moderate"), async (req, res) => {
  try {
    const updated = await Comment.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, approvedAt: new Date(), approvedBy: req.user.id },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Comment not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/reject", requirePermission("comment.moderate"), async (req, res) => {
  try {
    const updated = await Comment.findByIdAndUpdate(
      req.params.id,
      { isApproved: false, approvedAt: null, approvedBy: null },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Comment not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requirePermission("comment.moderate"), async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
