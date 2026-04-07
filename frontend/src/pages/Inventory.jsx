import { useState, useEffect } from "react";

const EMPTY_FORM = {
  amount: "",
  brand: "",
  name: "",
  fiber_content: "",
  yardage: "",
  care_instructions: "",
  weight: "",
  colorway: "",
  dye_lot: "",
  recommended_needle: "",
  recommended_hook: "",
  knit_gauge_swatch: "",
  crochet_gauge_swatch: "",
  link: "",
  discontinued: false,
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const res = await fetch("/api/inventory");
    setItems(await res.json());
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
    };

    if (editId) {
      await fetch(`/api/inventory/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    fetchItems();
  }

  function startEdit(item) {
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY_FORM).map((k) => [k, item[k] ?? EMPTY_FORM[k]]),
      ),
    );
    setEditId(item.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this yarn?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    fetchItems();
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  }

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2>Yarn Inventory ({items.length})</h2>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add Yarn
          </button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: "0.75rem" }}>
            {editId ? "Edit Yarn" : "Add Yarn"}
          </h3>
          <div className="form-grid">
            {/* Begin required fields */}
            <div>
              <label>
                Amount <span className="required">*</span>
              </label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.5"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label>
                Brand <span className="required">*</span>
              </label>
              <input
                name="brand"
                value={form.brand}
                onChange={handleChange}
                placeholder="e.g. Lion Brand"
                required
              />
            </div>
            <div>
              <label>
                Name <span className="required">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Re-Make"
                required
              />
            </div>
            <div>
              <label>
                Weight <span className="required">*</span>
              </label>
              <input
                name="weight"
                value={form.weight}
                onChange={handleChange}
                placeholder="e.g. Medium (4)"
                required
              />
            </div>
            <div>
              <label>
                Colorway <span className="required">*</span>
              </label>
              <input
                name="colorway"
                value={form.colorway}
                onChange={handleChange}
                placeholder="e.g. Amber"
                required
              />
            </div>
            <div>
              <label>
                Fiber Content <span className="required">*</span>
              </label>
              <input
                name="fiber_content"
                value={form.fiber_content}
                onChange={handleChange}
                placeholder="e.g. 100% recycled polyester"
                required
              />
            </div>
            <div>
              <label>
                Yardage (yds/g) <span className="required">*</span>
              </label>
              <input
                name="yardage"
                value={form.yardage}
                onChange={handleChange}
                placeholder="e.g. 217yds/100g"
                required
              />
            </div>

            {/* Begin optional fields */}
            <div className="full-width">
              <label>Care Instructions</label>
              <textarea
                name="care_instructions"
                value={form.care_instructions}
                onChange={handleChange}
                rows={4}
                style={{
                  resize: "none",
                }}
              />
            </div>
            <div>
              <label>Dye Lot #</label>
              <input
                name="dye_lot"
                value={form.dye_lot}
                onChange={handleChange}
              />
            </div>
            <div>
              <label>Recommended Needle</label>
              <input
                name="recommended_needle"
                value={form.recommended_needle}
                onChange={handleChange}
                placeholder="e.g. 8 (5mm)"
              />
            </div>
            <div>
              <label>Recommended Hook</label>
              <input
                name="recommended_hook"
                value={form.recommended_hook}
                onChange={handleChange}
                placeholder="e.g. H-8 (5mm)"
              />
            </div>
            <div>
              <label>Knit Gauge Swatch</label>
              <input
                name="knit_gauge_swatch"
                value={form.knit_gauge_swatch}
                onChange={handleChange}
                placeholder="e.g. 18S/26R"
              />
            </div>
            <div>
              <label>Crochet Gauge Swatch</label>
              <input
                name="crochet_gauge_swatch"
                value={form.crochet_gauge_swatch}
                onChange={handleChange}
                placeholder="e.g. 13S/16R"
              />
            </div>
            <div className="full-width">
              <label>Link</label>
              <input
                name="link"
                type="url"
                value={form.link}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                paddingTop: "0.25rem",
              }}
            >
              <input
                name="discontinued"
                type="checkbox"
                checked={form.discontinued}
                onChange={handleChange}
                style={{ width: "auto" }}
              />
              <label style={{ margin: 0 }}>Discontinued?</label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editId ? "Save Changes" : "Add to Stash"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={cancelForm}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!showForm &&
        items.map((item) => (
          <div key={item.id} className="card yarn-card">
            <div className="yarn-card-info">
              <h3>
                {item.brand} {item.name} — {item.colorway} ({item.amount})
              </h3>
              <p>{item.yardage}</p>
            </div>
            <div className="yarn-card-actions">
              <button className="btn-secondary" onClick={() => startEdit(item)}>
                Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
