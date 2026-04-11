import { useState, useEffect } from "react";

// Each object describes one form field. The form is rendered by looping over
// this array (see the FIELDS.map() in the JSX below), so adding or reordering
// a field is just a one-line change here — no JSX to copy-paste.
//
// Keys:
//   name        — maps to the form state key and the <input name="...">
//   label       — displayed above the input
//   type        — HTML input type ("number", "url"); defaults to text
//   element     — "textarea" or "select" to render those instead of <input>
//   options     — for select elements, the list of <option> values
//   required    — shows a red asterisk and sets the HTML required attribute
//   placeholder — input placeholder text
//   fullWidth   — spans both columns in the 2-column grid
//   props       — any extra props spread directly onto the <input>/<textarea>
//
// prettier-ignore
const FIELDS = [
  // Required fields
  { name: "amount", label: "Amount", type: "number", required: true, props: { min: "0", step: "0.5" } },
  { name: "brand", label: "Brand", required: true, placeholder: "e.g. Lion Brand" },
  { name: "name", label: "Name", required: true, placeholder: "e.g. Re-Make" },
  { name: "weight", label: "Weight", required: true, placeholder: "e.g. Medium (4)" },
  { name: "colorway", label: "Colorway", required: true, placeholder: "e.g. Amber" },
  { name: "fiber_content", label: "Fiber Content", required: true, placeholder: "e.g. 100% recycled polyester" },
  { name: "yardage", label: "Yardage (yds/g)", required: true, placeholder: "e.g. 217yds/100g" },
  { name: "recommended_needle", label: "Recommended Needle",required: true, placeholder: "e.g. 8 (5mm)" },
  { name: "recommended_hook", label: "Recommended Hook", required: true, placeholder: "e.g. H-8 (5mm)" },
  // Optional fields
  { name: "care_instructions", label: "Care Instructions", element: "textarea", fullWidth: true, props: { rows: 4, style: { resize: "none" } } },
  { name: "dye_lot", label: "Dye Lot #" },
  { name: "knit_gauge_swatch", label: "Knit Gauge Swatch", placeholder: "e.g. 18S/26R" },
  { name: "crochet_gauge_swatch", label: "Crochet Gauge Swatch", placeholder: "e.g. 13S/16R" },
  { name: "discontinued", label: "Discontinued?", element: "select", options: ["No", "Yes"] },
  { name: "link", label: "Link", type: "url", fullWidth: true, placeholder: "https://..." },
];

// Build the blank form state from FIELDS so it stays in sync automatically.
// Select fields default to their first option, everything else to "".
const EMPTY_FORM = Object.fromEntries(
  FIELDS.map((f) => [f.name, f.options ? f.options[0] : ""]),
);

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);
  const [pendingImage, setPendingImage] = useState(null); // File object waiting for submit

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const res = await fetch("/api/inventory");
    setItems(await res.json());
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      discontinued: form.discontinued === "Yes",
    };

    let targetId = editId;
    if (editId) {
      await fetch(`/api/inventory/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await res.json();
      targetId = created.id;
    }

    if (pendingImage && targetId) {
      const formData = new FormData();
      formData.append("file", pendingImage);
      await fetch(`/api/inventory/${targetId}/image`, {
        method: "POST",
        body: formData,
      });
      setImgVersion((v) => v + 1);
    }

    setPendingImage(null);
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    fetchItems();
  }

  function startEdit(item) {
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY_FORM).map((k) => {
          const val = item[k] ?? EMPTY_FORM[k];
          // Convert boolean back to "Yes"/"No" for the select dropdown
          if (typeof val === "boolean") return [k, val ? "Yes" : "No"];
          return [k, val];
        }),
      ),
    );
    setEditId(item.id);
    setShowForm(true);
  }

  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) setPendingImage(file);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this yarn?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    fetchItems();
  }

  function cancelForm() {
    setPendingImage(null);
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Yarn Inventory ({items.length})</h2>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add Yarn
          </button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <h3 className="form-title">{editId ? "Edit Yarn" : "Add Yarn"}</h3>
          <div className="form-grid">
            {/* Loop over the FIELDS config to render each form field.
                Each field object drives what gets rendered:
                - `Tag` is "input", "textarea", or "select" based on f.element
                - `{...f.props}` spreads any extra attributes (e.g. min, step, rows)
                - Select fields render <option>s from f.options */}
            {FIELDS.map((f) => {
              const Tag =
                f.element === "textarea"
                  ? "textarea"
                  : f.element === "select"
                    ? "select"
                    : "input";
              return (
                <div
                  key={f.name}
                  className={f.fullWidth ? "full-width" : undefined}
                >
                  <label>
                    {f.label}
                    {f.required && <span className="required"> *</span>}
                  </label>
                  <Tag
                    name={f.name}
                    type={f.type}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    required={f.required}
                    {...f.props}
                  >
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Tag>
                </div>
              );
            })}
          </div>

          {/* image upload and preview */}
          {(() => {
            const savedImage =
              editId && items.find((i) => i.id === editId)?.image;
            const previewSrc = pendingImage
              ? URL.createObjectURL(pendingImage)
              : savedImage
                ? `/api/images/${savedImage}?v=${imgVersion}`
                : null;
            return (
              <div className="image-field">
                <label>Image</label>
                {previewSrc && (
                  <img
                    src={previewSrc}
                    alt="Yarn"
                    className="image-field-img"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </div>
            );
          })()}

          {/* save/cancel buttons */}
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

      {/* Inventory list with minimal details */}
      {!showForm &&
        items.map((item) => (
          <div key={item.id} className="card yarn-card">
            {item.image && (
              <img
                src={`/api/images/${item.image}?v=${imgVersion}`}
                alt={`${item.brand} ${item.colorway}`}
                className="yarn-card-thumb"
              />
            )}
            <div className="yarn-card-info">
              <h3>
                {item.brand} {item.name} - {item.colorway}
              </h3>
              <p>
                {item.amount} skeins - {item.yardage}
              </p>
              {item.link && (
                <p>
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    {item.link}
                  </a>
                </p>
              )}
              {item.discontinued && (
                <p>
                  <span style={{ color: "red", fontWeight: "bold" }}>
                    Discontinued
                  </span>
                </p>
              )}
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
