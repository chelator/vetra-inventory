import React from "react";

// Inventory page displaying material list, filters, and add-item form.
function InventoryPage({
  items,
  filteredItems,
  categoryOptions,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  newName,
  setNewName,
  newQuantity,
  setNewQuantity,
  newUnit,
  setNewUnit,
  newCategory,
  setNewCategory,
  newNotes,
  setNewNotes,
  handleAddItem,
  handleAdjustQuantity,
  handleDelete,
  getStockStatusClass,
}) {
  return (
    <>
      <header className="app-header">
        <h1>Vetra Van Inventory</h1>
        <p>Wind turbine blade repair materials at a glance.</p>
      </header>

      <main className="app-main">
        <section className="controls-section">
          <div className="filters">
            <div className="field">
              <label htmlFor="search">Search by name</label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. resin, peel ply..."
              />
            </div>

            <div className="field">
              <label htmlFor="categoryFilter">Category</label>
              <select
                id="categoryFilter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form className="add-form" onSubmit={handleAddItem}>
            <h2>Add Item</h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Epoxy Resin Kit"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="field">
                <label htmlFor="unit">Unit</label>
                <input
                  id="unit"
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="kits, m², pcs..."
                />
              </div>

              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-notes">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  rows="2"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Batch, supplier, typical use, etc."
                />
              </div>
            </div>

            <button type="submit" className="primary-button">
              Add to inventory
            </button>
          </form>
        </section>

        <section className="list-section">
          <div className="list-header">
            <h2>Materials ({filteredItems.length})</h2>
          </div>
          {filteredItems.length === 0 ? (
            <p className="empty-state">No items match your filters.</p>
          ) : (
            <div className="cards-grid">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  className={`card ${getStockStatusClass(item.quantity)}`}
                >
                  <header className="card-header">
                    <div>
                      <h3>{item.name}</h3>
                      <span className="card-category">{item.category}</span>
                    </div>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </header>

                  <div className="card-body">
                    <div className="quantity-row">
                      <span className="quantity-label">Quantity</span>
                      <div className="quantity-controls">
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(item.id, -1)}
                          disabled={item.quantity === 0}
                        >
                          −
                        </button>
                        <span className="quantity-value">
                          {item.quantity} {item.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {item.notes && (
                      <p className="card-notes">{item.notes}</p>
                    )}

                    {item.quantity === 0 && (
                      <p className="stock-label stock-critical">
                        Out of stock – restock before next job.
                      </p>
                    )}
                    {item.quantity === 1 || item.quantity === 2 ? (
                      <p className="stock-label stock-warning">
                        Low stock – consider restocking.
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default InventoryPage;

