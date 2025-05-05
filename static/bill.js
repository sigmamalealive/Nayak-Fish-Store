document.addEventListener('DOMContentLoaded', function() {
  // Initialize the app
  addFishItemRow();
  
  // Event listeners
  document.getElementById('add-item-btn').addEventListener('click', addFishItemRow);
  document.addEventListener('input', calculateBill);
  document.getElementById('generate-bill-btn').addEventListener('click', generateFinalBill);
  document.getElementById('print-bill-btn').addEventListener('click', printBill);
  document.getElementById('save-bill-btn').addEventListener('click', saveBillToBackend);
  document.getElementById('search-bills-btn').addEventListener('click', searchBills);
  
});

// Global variables
let fishItems = [];
let itemCounter = 0;


// Add new fish item row
function addFishItemRow() {
  itemCounter++;
  const tbody = document.getElementById('fish-items-body');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" class="fish-name" placeholder="Enter fish name"></td>
    <td><input type="number" class="fish-quantity" min="0" step="0.1" value="0"></td>
    <td><input type="number" class="fish-price" min="0" step="0.01" value="0.00"></td>
    <td class="item-total">₹0.00</td>
    <td><button class="remove-item-btn" data-id="${itemCounter}">×</button></td>
  `;
  tbody.appendChild(row);
  
  // Add event listeners to new row
  const select = row.querySelector('.fish-name');
  select.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption.dataset.price) {
      row.querySelector('.fish-price').value = selectedOption.dataset.price;
      calculateBill();
    }
  });
  
  row.querySelector('.remove-item-btn').addEventListener('click', function() {
    tbody.removeChild(row);
    calculateBill();
  });
  
  console.log('Added new fish item row'); // Debug log
}

// Calculate bill totals
function calculateBill() {
  console.log('Calculating bill...'); // Debug log
  let subtotal = 0;
  const rows = document.querySelectorAll('#fish-items-body tr');
  
  rows.forEach(row => {
    const quantity = parseFloat(row.querySelector('.fish-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.fish-price').value) || 0;
    const total = quantity * price;
    row.querySelector('.item-total').textContent = `₹${total.toFixed(2)}`;
    subtotal += total;
  });
  
  const taxInput = parseFloat(document.getElementById('tax-amount').value) || 0;
  const taxAmt = subtotal * (taxInput/100);
  const totalAmount = subtotal + taxAmt;
  const amountPaid = parseFloat(document.getElementById('amount-paid').value) || 0;
  const previousBalance = parseFloat(document.getElementById('previous-balance').value) || 0;
  const balanceDue = totalAmount + previousBalance - amountPaid;
  
  document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('tax-amount').textContent = `${taxInput.toFixed(2)}`;
  document.getElementById('total-amount').textContent = `₹${totalAmount.toFixed(2)}`;
  document.getElementById('balance-due').textContent = `₹${balanceDue.toFixed(2)}`;
  
  console.log('Calculation complete:', { subtotal, taxAmt, totalAmount, balanceDue }); // Debug log
}

// Generate final bill preview
function generateFinalBill() {
  console.log('Generating final bill preview...'); // Debug log
  const billDate = document.getElementById('bill-date').value;
  const customerName = document.getElementById('customer-name').value;
  const customerPhone = document.getElementById('customer-phone').value;
  const subtotal = document.getElementById('subtotal').textContent;
  const taxInput = document.getElementById('tax-amount').textContent;
  const totalAmount = document.getElementById('total-amount').textContent;
  const amountPaid = document.getElementById('amount-paid').value;
  const previousBalance = document.getElementById('previous-balance').value;
  const balanceDue = document.getElementById('balance-due').textContent;
  
  if (!customerName) {
    alert('Please enter customer name');
    return;
  }
  
  const rows = document.querySelectorAll('#fish-items-body tr');
  let hasValidItems = false;
  let itemsHtml = '';
  
  rows.forEach(row => {
    const fishName = row.querySelector('.fish-name').value;
    const quantity = parseFloat(row.querySelector('.fish-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.fish-price').value) || 0;
    const total = row.querySelector('.item-total').textContent;
    
    if (fishName && quantity > 0 && price > 0) {
      hasValidItems = true;
      itemsHtml += `
        <tr>
          <td>${fishName}</td>
          <td>${quantity} kg</td>
          <td>₹${parseFloat(price).toFixed(2)}</td>
          <td>${total}</td>
        </tr>
      `;
    }
  });
  
  if (!hasValidItems) {
    alert('Please add at least one valid fish item');
    return;
  }

  const billPreview = document.getElementById('bill-preview');
  billPreview.innerHTML = `
    <div class="final-bill">
      <div class="bill-header">
        <h3>Nayak Fish Store</h3>
        <p>Barikpur , Bhadrak , Odisha </p>
        <p>Phone: +91 6372663125</p>
      </div>
      
      <div class="bill-meta">
        <p><strong>Date:</strong> ${new Date(billDate).toLocaleDateString()}</p>
        <p><strong>Bill To:</strong> ${customerName} (${customerPhone})</p>
      </div>
      
      <table class="bill-items">
        <thead>
          <tr>
            <th>Fish Name</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="bill-totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${subtotal}</span>
        </div>
        <div class="total-row">
          <span>Tax (%):</span>
          <span>${taxInput}%</span>
        </div>
        <div class="total-row">
          <span>Previous Balance:</span>
          <span>₹${parseFloat(previousBalance).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Amount Paid:</span>
          <span>₹${parseFloat(amountPaid).toFixed(2)}</span>
        </div>
        <div class="total-row grand-total">
          <span>Balance Due:</span>
          <span>${balanceDue}</span>
        </div>
      </div>
      
      <div class="bill-footer">
        <p>Thank you for your business!</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;
  
  // Enable save button
  document.getElementById('save-bill-btn').disabled = false;
  document.getElementById('print-bill-btn').disabled = false;
  console.log('Final bill preview generated'); // Debug log
}

function printBill() {
  const printContent = document.getElementById('bill-preview').innerHTML;
  const originalContent = document.body.innerHTML;
  
  document.body.innerHTML = printContent;
  window.print();
  document.body.innerHTML = originalContent;
  
  // Reattach event listeners
  document.getElementById('print-bill-btn').addEventListener('click', printBill);
}


// Save bill to backend
async function saveBillToBackend() {
  console.log('Attempting to save bill...'); // Debug log
  
  // Get all form values
  const billDate = document.getElementById('bill-date').value;
  const customerName = document.getElementById('customer-name').value.trim();
  const customerPhone = document.getElementById('customer-phone').value.trim();
  const subtotal = parseFloat(document.getElementById('subtotal').textContent.replace('₹', ''));
  const taxAmt = parseFloat(document.getElementById('tax-amount').textContent.replace('₹', ''));
  const totalAmount = parseFloat(document.getElementById('total-amount').textContent.replace('₹', ''));
  const amountPaid = parseFloat(document.getElementById('amount-paid').value) || 0;
  const previousBalance = parseFloat(document.getElementById('previous-balance').value) || 0;
  const balanceDue = parseFloat(document.getElementById('balance-due').textContent.replace('₹', ''));

  // Validate required fields
  if (!customerName) {
    alert('Customer name is required');
    return;
  }

  if (isNaN(subtotal) || isNaN(totalAmount)) {
    alert('Invalid bill amounts. Please check the values.');
    return;
  }

  // Collect items
  const rows = document.querySelectorAll('#fish-items-body tr');
  const items = [];
  
  rows.forEach(row => {
    const fishName = row.querySelector('.fish-name').value;
    const quantity = parseFloat(row.querySelector('.fish-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.fish-price').value) || 0;
    
    if (fishName && quantity > 0 && price > 0) {
      // Find fish item ID if it exists
      const fishItem = fishItems.find(item => item.name === fishName);
      
      items.push({
        fish_item_id: fishItem ? fishItem.id : null,
        fish_name: fishName,
        quantity: quantity,
        unit_price: price,
        total_price: (quantity * price).toFixed(2)
      });
    }
  });

  // Validate at least one item
  if (items.length === 0) {
    alert('Please add at least one fish item to the bill');
    return;
  }

  // Prepare bill data
  const billData = {
    customer_name: customerName,
    customer_phone: customerPhone,
    bill_date: billDate,
    items: items,
    subtotal: subtotal,
    tax: taxAmt,
    total_amount: totalAmount,
    previous_balance: previousBalance,
    amount_paid: amountPaid,
    balance_due: balanceDue
  };

  console.log('Bill data to save:', billData); // Debug log

  try {
    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(billData)
    });

    console.log('Response status:', response.status); // Debug log
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData); // Debug log
      throw new Error(errorData.error || 'Failed to save bill');
    }

    const result = await response.json();
    console.log('Save successful, response:', result); // Debug log

    alert(`Bill saved successfully! Bill ID: ${result.id}`);
    
    // Enable print button and store bill ID
    document.getElementById('print-bill-btn').disabled = false;
    document.getElementById('print-bill-btn').dataset.billId = result.id;
    
    // Clear form for new bill
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('fish-items-body').innerHTML = '';
    document.getElementById('amount-paid').value = '';
    document.getElementById('previous-balance').value = '0.00';
    addFishItemRow(); // Add new empty row
    
    // Update calculations
    calculateBill();
    
  } catch (error) {
    console.error('Error saving bill:', error);
    alert(`Error saving bill: ${error.message}\nCheck console for details`);
  }
}

// ... (keep the existing searchBills, displaySearchResults, viewBillDetails, 
// renderBillPreview, printExistingBill functions from previous implementation)
  
  
  async function searchBills() {
    const name = document.getElementById('search-name').value;
    const phone = document.getElementById('search-phone').value;
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (name) params.append('name', name);
      if (phone) params.append('phone', phone);
      
      const response = await fetch(`/api/bills/search?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to search bills');
      
      const bills = await response.json();
      displaySearchResults(bills);
    } catch (error) {
      console.error('Error searching bills:', error);
      alert('Error searching bills: ' + error.message);
    }
  }
  
  function displaySearchResults(bills) {
    const tbody = document.getElementById('bills-list-body');
    tbody.innerHTML = '';
    
    if (bills.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No bills found</td></tr>';
      return;
    }
    
    bills.forEach(bill => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${bill.id}</td>
        <td>${new Date(bill.bill_date).toLocaleDateString()}</td>
        <td>${bill.customer_name || 'Walk-in Customer'}</td>
        <td>${bill.customer_phone || '-'}</td>
        <td>₹${parseFloat(bill.total_amount).toFixed(2)}</td>
        <td>₹${parseFloat(bill.balance_due).toFixed(2)}</td>
        <td>
          <button class="view-bill-btn" data-id="${bill.id}">View</button>
          <button class="print-bill-btn" data-id="${bill.id}">Print</button>
        </td>
      `;
      tbody.appendChild(row);
      
      // Add event listeners to buttons
      row.querySelector('.view-bill-btn').addEventListener('click', () => viewBillDetails(bill.id));
      row.querySelector('.print-bill-btn').addEventListener('click', () => printExistingBill(bill.id));
    });
  }
  
  async function viewBillDetails(billId) {
    try {
      const response = await fetch(`/api/bills/${billId}`);
      if (!response.ok) throw new Error('Failed to fetch bill details');
      
      const bill = await response.json();
      renderBillPreview(bill);
      
      // Scroll to preview section
      document.getElementById('bill-preview').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error viewing bill:', error);
      alert('Error viewing bill: ' + error.message);
    }
  }
  
  function renderBillPreview(bill) {
    const billPreview = document.getElementById('bill-preview');
    billPreview.innerHTML = '';
    
    const itemsHtml = bill.items.map(item => `
      <tr>
        <td>${item.fish_name}</td>
        <td>${item.quantity} kg</td>
        <td>₹${parseFloat(item.unit_price).toFixed(2)}</td>
        <td>₹${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const previewDiv = document.createElement('div');
    previewDiv.className = 'final-bill';
    previewDiv.innerHTML = `
      <div class="bill-header">
        <h3>Nayak Fish Store</h3>
        <p>Barikpur ,Bhadrak, Odisha</p>
        <p>Phone: +91 6372663125</p>
      </div>
      
      <div class="bill-meta">
        <p><strong>Bill #:</strong> ${bill.id}</p>
        <p><strong>Date:</strong> ${bill.bill_date}</p>
        <p><strong>Bill To:</strong> ${bill.customer_name || 'Walk-in Customer'} ${bill.customer_phone ? `(${bill.customer_phone})` : ''}</p>
      </div>
      
      <table class="bill-items">
        <thead>
          <tr>
            <th>Fish Name</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="bill-totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>₹${parseFloat(bill.subtotal).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Tax:</span>
          <span>${parseFloat(bill.tax).toFixed(2)}%</span>
        </div>
        <div class="total-row">
          <span>Previous Balance:</span>
          <span>₹${parseFloat(bill.previous_balance).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Amount Paid:</span>
          <span>₹${parseFloat(bill.amount_paid).toFixed(2)}</span>
        </div>
        <div class="total-row grand-total">
          <span>Balance Due:</span>
          <span>₹${parseFloat(bill.balance_due).toFixed(2)}</span>
        </div>
      </div>
      
      <div class="bill-footer">
        <p>Thank you for your business!</p>
        <p>Generated on: ${new Date(bill.created_at + 'Z').toLocaleString()}</p>
      </div>
    `;
    
    billPreview.appendChild(previewDiv);
  }
  
  async function printExistingBill(billId) {
    try {
      const response = await fetch(`/api/bills/${billId}`);
      if (!response.ok) throw new Error('Failed to fetch bill details');
      
      const bill = await response.json();
      printBill(bill);
    } catch (error) {
      console.error('Error printing bill:', error);
      alert('Error printing bill: ' + error.message);
    }
  }