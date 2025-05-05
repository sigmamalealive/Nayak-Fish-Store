 // 1. View Sales History
document.addEventListener('DOMContentLoaded', async () => {
    // Load summary data
    const summaryResponse = await fetch('/api/sales/summary');
    const summary = await summaryResponse.json();
    
    document.getElementById('total-sales').textContent = `₹${summary.total_sales.toFixed(2)}`;
    document.getElementById('total-purchases').textContent = `₹${summary.total_purchases.toFixed(2)}`;
    document.getElementById('profit').textContent = `₹${summary.profit.toFixed(2)}`;
    document.getElementById('total-transactions').textContent = summary.total_transactions;
    
    // Load and render charts
    await renderMonthlyTrendChart();
    await renderFishTypeChart();
    await loadRecentTransactions();
  });
  
  async function renderMonthlyTrendChart() {
    const response = await fetch('/api/sales/monthly-trend');
    const trendData = await response.json();
    
    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendData.map(item => item.month),
        datasets: [
          {
            label: 'Sales',
            data: trendData.map(item => item.sales),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Purchases',
            data: trendData.map(item => item.purchases),
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount (₹)'
            }
          }
        }
      }
    });
  }
  
  async function renderFishTypeChart() {
    const response = await fetch('/api/sales/by-fish');
    const fishData = await response.json();
    
    const ctx = document.getElementById('fishTypeChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: fishData.map(item => item.fish_type),
        datasets: [{
          label: 'Sales by Fish Type (₹)',
          data: fishData.map(item => item.total_value),
          backgroundColor: fishData.map((_, i) => 
            `hsl(${(i * 360 / fishData.length)}, 70%, 50%)`),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount (₹)'
            }
          }
        }
      }
    });
  }
  
  async function loadRecentTransactions() {
    const response = await fetch('/api/inventory?limit=5');
    const transactions = await response.json();
    
    const tableBody = document.querySelector('#recentTransactions tbody');
    tableBody.innerHTML = transactions.map(item => `
      <tr>
        <td>${item.date}</td>
        <td>${item.type}</td>
        <td>${item.fishType}</td>
        <td>${item.quantity}</td>
        <td>₹${item.totalPrice.toFixed(2)}</td>
      </tr>
    `).join('');
  }

  async function loadStockLevels() {
    const response = await fetch('/api/stock');
    const stock = await response.json();
    
    const tableBody = document.querySelector('#stockLevels tbody');
    tableBody.innerHTML = stock.map(item => `
      <tr>
        <td>${item.fish_type}</td>
        <td>${item.quantity.toFixed(2)} kg</td>
        <td>${new Date(item.last_updated).toLocaleString()}</td>
      </tr>
    `).join('');
  }
  
  // Call this in your DOMContentLoaded event
  loadStockLevels();

  document.addEventListener('DOMContentLoaded', () => {
    // Button event listeners
    
    document.getElementById('addSalesBtn').addEventListener('click', loadAddSalesForm);
    document.getElementById('stockBtn').addEventListener('click', loadCurrentStock);
    document.getElementById('resetStockBtn').addEventListener('click', confirmResetStock);
  });
  
 
  
  
  // 2. Add Sales Form
function loadAddSalesForm() {
  document.getElementById('salesContent').innerHTML = `
    <h3>Record New Sale</h3>
    <form id="salesForm">
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="saleDate" required>
      </div>
      
      <div class="form-group">
        <label>Purchaser Name</label>
        <input type="text" id="purchaserName" required>
      </div>
      
      <div class="form-group">
        <label>Purchaser Contact</label>
        <input type="tel" id="purchaserContact" required>
      </div>
      
      <div class="form-group">
        <label>Fish Type</label>
        <select id="saleFishType" required>
          <!-- Options will be loaded dynamically -->
        </select>
      </div>

      <label>Transaction Type</label>
      <select id="type" required>
        <option value="OUT">OUT</option>
      </select>
      
      <div class="form-group">
        <label>Quantity (kg)</label>
        <input type="number" id="saleQty" step="0.01" min="0.01" required>
      </div>
      
      <div class="form-group">
        <label>Unit Price (₹)</label>
        <input type="number" id="salePrice" step="0.01" min="0.01" required>
      </div>
      
      <button type="submit" class="sales-btn">Record Sale</button>
    </form>
  `;
  
  // Load fish types
  loadFishTypes();
  
  // Form submission
  document.getElementById('salesForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await recordNewSale();
  });
}

async function recordNewSale() {
  const form = document.getElementById('salesForm');
  const data = {
    date: document.getElementById('saleDate').value,
    purchaserName: document.getElementById('purchaserName').value,
    purchaserContact: document.getElementById('purchaserContact').value,
    fishType: document.getElementById('saleFishType').value,
    quantity: parseFloat(document.getElementById('saleQty').value),
    unitPrice: parseFloat(document.getElementById('salePrice').value),
    type: 'OUT'
  };
  
  try {
    const response = await fetch('/api/salesRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!response.ok) throw new Error(result.error || 'Failed to record sale');
    
    alert('Sale recorded successfully!');
    form.reset();
    loadCurrentStock(); // Refresh stock view
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
  
  // 3. Current Stock View - Improved
  async function loadCurrentStock() {
    const content = document.getElementById('salesContent');
    content.innerHTML = '<h3>Loading current stock...</h3>';
    
    try {
      const response = await fetch('/api/stock');
      const stock = await response.json();
      
      // Add null check before using toFixed()
      content.innerHTML = `
        <h3>Current Stock Levels</h3>
        <div class="stock-table-container">
          <table class="stock-table">
            <thead>
              <tr>
                <th>Fish Type</th>
                <th>Current Stock</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stock.map(item => `
                <tr class="${item.quantity <= (item.min_stock_level || 10) ? 'low-stock' : ''}">
                  <td>${item.fish_type}</td>
                  <td>
                    ${item.quantity.toFixed(1)}
                  </td>
                  <td>${item.unit || 'kg'}</td>
                  <td>
                    ${item.quantity <= (item.min_stock_level || 10) ? 
                      '⚠️ Low Stock' : '✔️ In Stock'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      console.error('Error loading stock:', error);
      content.innerHTML = `
        <div class="error">
          Error loading stock data. Please try again later.
          ${error.message ? `<br><small>${error.message}</small>` : ''}
        </div>
      `;
    }
  }
  
  // 4. Reset Stock Confirmation
  function confirmResetStock() {
    document.getElementById('salesContent').innerHTML = `
      <div class="reset-confirm">
        <h3>⚠️ Reset All Stock?</h3>
        <p>This will set all fish quantities to zero. This action cannot be undone.</p>
        <div class="reset-buttons">
          <button id="confirmReset" class="sales-btn danger">Confirm Reset</button>
          <button id="cancelReset" class="sales-btn">Cancel</button>
        </div>
      </div>
    `;
    
    document.getElementById('confirmReset').addEventListener('click', resetAllStock);
    document.getElementById('cancelReset').addEventListener('click', loadCurrentStock);
  }
  
  // Helper Functions
  async function loadFishTypes() {
    try {
      const response = await fetch('/api/fish-types');
      const fishTypes = await response.json();
      const select = document.getElementById('saleFishType');
      
      select.innerHTML = fishTypes.map(type => 
        `<option value="${type}">${type}</option>`
      ).join('');
    } catch (error) {
      console.error("Couldn't load fish types:", error);
    }
  }
  
  
  
  async function resetAllStock() {
    try {
      const response = await fetch('/api/stock/reset', {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to reset stock');
      
      alert('All stock levels have been reset to zero');
      loadCurrentStock();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }