document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const videoElement = document.createElement('video');
  const canvasElement = document.createElement('canvas');
  let stream = null;
  let currentReceiptImage = null;
  let cameraView = null;

  // Initialize the app
  loadAllTransactions();
  initEventListeners();
  

  function initEventListeners() {
    const uploadBtn = document.getElementById('upload-receipt');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            document.getElementById('receipt-file').click();
        });
    }

    const fileInput = document.getElementById('receipt-file');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    const captureBtn = document.getElementById('capture-receipt');
    if (captureBtn) {
        captureBtn.addEventListener('click', handleCameraCapture);
    }

    const saveBtn = document.getElementById('save-transaction');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveTransaction);
    }

    const searchBtn = document.getElementById('search-transactions');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchTransactions);
    }
}



  let allTransactions = [];

  document.getElementById('show-summary-btn')?.addEventListener('click', async function () {
    const response = await fetch('/api/transactions/search');
    const transactions = await response.json();
    allTransactions = transactions;
    let selectedDate = document.getElementById('filter-date').value;
    selectedDate = new Date(selectedDate + 'T00:00:00').toISOString().slice(0, 10);
    if (!selectedDate || allTransactions.length === 0) return;

    const { dateSummary, totalSummary } = calculateTransactionSummaries(allTransactions, selectedDate);
    updateTransactionSummary(dateSummary, totalSummary);
});


  // Camera Functions
  async function handleCameraCapture() {
      try {
          // Stop any existing stream
          if (stream) {
              stream.getTracks().forEach(track => track.stop());
          }

          // Get camera access
          stream = await navigator.mediaDevices.getUserMedia({ 
              video: {
                  facingMode: 'environment',
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
              }
          });

          // Create camera preview UI
          const previewDiv = document.createElement('div');
          previewDiv.className = 'camera-preview';
          previewDiv.innerHTML = `
              <div class="video-container">
                  <video id="camera-view" autoplay playsinline></video>
                  <div class="camera-controls">
                      <button id="take-photo" class="btn-capture">Capture</button>
                      <button id="cancel-capture" class="btn-cancel">Cancel</button>
                  </div>
              </div>
          `;

          document.getElementById('receipt-preview').innerHTML = '';
          document.getElementById('receipt-preview').appendChild(previewDiv);
          
          // Get reference to the video element
          cameraView = document.getElementById('camera-view');
          cameraView.srcObject = stream;
          await cameraView.play();

          // Set up event listeners for camera controls
          document.getElementById('take-photo').addEventListener('click', capturePhoto);
          document.getElementById('cancel-capture').addEventListener('click', closeCamera);

      } catch (error) {
          console.error('Camera error:', error);
          showNotification('Camera error: ' + error.message, 'error');
      }
  }

  function capturePhoto() {
      try {
          // Ensure camera is ready
          if (!cameraView || !stream) {
              throw new Error('Camera not ready');
          }

          // Set canvas dimensions
          canvasElement.width = cameraView.videoWidth;
          canvasElement.height = cameraView.videoHeight;
          
          // Draw video frame to canvas
          const ctx = canvasElement.getContext('2d');
          ctx.drawImage(cameraView, 0, 0, canvasElement.width, canvasElement.height);
          
          // Convert to image file
          canvasElement.toBlob(blob => {
              if (!blob) {
                  throw new Error('Failed to create image');
              }
              
              currentReceiptImage = new File([blob], `receipt_${Date.now()}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
              });
              
              displayReceiptPreview(currentReceiptImage);
              closeCamera();
          }, 'image/jpeg', 0.9);
          
      } catch (error) {
          console.error('Capture error:', error);
          showNotification('Capture failed: ' + error.message, 'error');
      }
  }

  function closeCamera() {
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
      }
      cameraView = null;
  }

  // File Handling
  function handleFileSelect(e) {
      if (e.target.files.length > 0) {
          const file = e.target.files[0];
          if (!file.type.match('image.*')) {
              showNotification('Please select an image file', 'error');
              return;
          }
          currentReceiptImage = file;
          displayReceiptPreview(file);
      }
  }

  function displayReceiptPreview(file) {
      const previewDiv = document.getElementById('receipt-preview');
      previewDiv.innerHTML = '';
      
      if (file) {
          const img = document.createElement('img');
          const objectUrl = URL.createObjectURL(file);
          img.src = objectUrl;
          img.alt = 'Receipt preview';
          img.className = 'receipt-image';
          
          const removeBtn = document.createElement('button');
          removeBtn.textContent = 'Remove';
          removeBtn.className = 'btn-remove';
          removeBtn.addEventListener('click', () => {
              currentReceiptImage = null;
              previewDiv.innerHTML = '';
              URL.revokeObjectURL(objectUrl);
          });
          
          img.onload = () => URL.revokeObjectURL(objectUrl);
          
          previewDiv.appendChild(img);
          previewDiv.appendChild(removeBtn);
      }
  }

  // Transaction Handling
  async function handleSaveTransaction() {
      const amount = parseFloat(document.getElementById('amount').value);
      const clientName = document.getElementById('client_name').value.trim();
      
      // Validation
      if (!amount || isNaN(amount)) {
          showNotification('Please enter a valid amount', 'error');
          return;
      }
      
      if (!clientName) {
          showNotification('Client name is required', 'error');
          return;
      }
      
      if (!currentReceiptImage) {
          showNotification('Please capture or upload a receipt', 'error');
          return;
      }

      const saveBtn = document.getElementById('save-transaction');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
          const formData = new FormData();
          formData.append('transaction_type', document.querySelector('input[name="transaction_type"]:checked').value);
          formData.append('payment_method', document.querySelector('input[name="payment_method"]:checked').value);
          formData.append('amount', amount);
          formData.append('client_name', clientName);
          formData.append('client_phone', document.getElementById('client_phone').value.trim());
          formData.append('notes', document.getElementById('notes').value.trim());
          formData.append('receipt_image', currentReceiptImage);

          const response = await fetch('/api/transactions', {
              method: 'POST',
              body: formData
          });

          if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(error.message || 'Failed to save transaction');
          }

          const result = await response.json();
          showNotification('Transaction saved successfully!', 'success');
          resetForm();
          
          
      } catch (error) {
          console.error('Save error:', error);
          showNotification('Error: ' + error.message, 'error');
      } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Transaction';
      }
  }

  function resetForm() {
      document.getElementById('amount').value = '';
      document.getElementById('client_name').value = '';
      document.getElementById('client_phone').value = '';
      document.getElementById('notes').value = '';
      document.getElementById('receipt-preview').innerHTML = '';
      currentReceiptImage = null;
  }

  async function loadAllTransactions() {
    try {
      const response = await fetch('/api/transactions');
      if (!response.ok) throw new Error('Failed to load transactions');
      const transactions = await response.json();
      displayTransactionResults(transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      //alert('Error loading transactions. Please try again.');
    }
  }

  async function showDateSummary() {
    const date = document.getElementById('filter-date').value;
    if (!date) {
      alert('Please select a date');
      return;
    }
  
    try {
      const response = await fetch(`/api/transactions/summary?date=${date}`);
      if (!response.ok) throw new Error('Failed to load summary');
      // ... rest of the function
    } catch (error) {
      console.error('Summary error:', error);
      alert('Error loading summary. Please try again.');
    }
  }

  // Search Transactions Function - Fixed Version
  async function searchTransactions() {
    const searchBtn = document.getElementById('search-transactions');
    const startDate = document.getElementById('search-start-date').value;
    const endDate = document.getElementById('search-end-date').value;

    

    try {
        // Validate input
        if (!startDate && !endDate) {
            throw new Error('Please enter a start date or end date');
        }

        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';

        // Build URL with encoded parameters
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', new Date(startDate + 'T00:00:00').toISOString().slice(0, 10));
        if (endDate) params.append('end_date', new Date(endDate + 'T00:00:00').toISOString().slice(0, 10));

        const response = await fetch(`/api/transactions/search?${params.toString()}`);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Search failed');
        }

        const transactions = await response.json();
        displayTransactionResults(transactions);

    } catch (error) {
        console.error('Search error:', error);
        alert(`Error: ${error.message}`);
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search Transactions';
    }
}

function displayTransactionResults(transactions) {
    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No transactions found</td></tr>';
        return;
    }


    transactions.forEach(tx => {
        const row = document.createElement('tr');
        
        const typeClass = tx.transaction_type === 'in' ? 'type-in' : 'type-out';
        const typeText = tx.transaction_type === 'in' ? 'IN' : 'OUT';
        
        const receiptCell = tx.image_name 
            ? `<a href="/api/transactions/${tx.id}/receipt" target="_blank">View</a>` 
            : 'None';
        
        row.innerHTML = `
            <td>${new Date(tx.created_at + 'Z').toLocaleString()}</td>
            <td><span class="${typeClass}">${typeText}</span></td>
            <td>${tx.payment_method}</td>
            <td>₹${tx.amount.toFixed(2)}</td>
            <td>${tx.client_name || '-'}</td>
            <td>${tx.client_phone || '-'}</td>
            <td>${receiptCell}</td>
        `;
        
        tbody.appendChild(row);

    });

}

function calculateTransactionSummaries(transactions, filterDate = null) {
    const today = new Date();
    const selectedDate = filterDate ? new Date(filterDate) : today;

    const dateSummary = {
        inCount: 0,
        outCount: 0,
        inTotal: 0,
        outTotal: 0
    };

    const totalSummary = {
        inCount: 0,
        outCount: 0,
        inTotal: 0,
        outTotal: 0
    };

    transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        const isIn = tx.transaction_type === 'in';

        // Update total
        if (isIn) {
            totalSummary.inCount++;
            totalSummary.inTotal += amount;
        } else {
            totalSummary.outCount++;
            totalSummary.outTotal += amount;
        }

        // Compare transaction date with selectedDate
        const txDate = new Date(tx.created_at + 'Z');
        const isSameDate = txDate.getDate() === selectedDate.getDate() &&
                           txDate.getMonth() === selectedDate.getMonth() &&
                           txDate.getFullYear() === selectedDate.getFullYear();

        if (isSameDate) {
            if (isIn) {
                dateSummary.inCount++;
                dateSummary.inTotal += amount;
            } else {
                dateSummary.outCount++;
                dateSummary.outTotal += amount;
            }
        }
    });

    return { dateSummary, totalSummary };
}


// Add transaction summary display
function updateTransactionSummary(dateSummary, totalSummary = null) {
    const summaryContainer = document.getElementById('transaction-summary');
    
    if (!dateSummary) {
        summaryContainer.innerHTML = '';
        return;
    }

    let html = `
        <div class="summary-card in-summary">
            <h3>Filtered - Money In</h3>
            <div class="summary-count">${dateSummary.inCount} transactions</div>
            <div class="summary-amount">₹${dateSummary.inTotal.toFixed(2)}</div>
        </div>
        <div class="summary-card out-summary">
            <h3>Filtered - Money Out</h3>
            <div class="summary-count">${dateSummary.outCount} transactions</div>
            <div class="summary-amount">₹${dateSummary.outTotal.toFixed(2)}</div>
        </div>
    `;

    if (totalSummary) {
        html += `
            <div class="summary-card in-summary">
                <h3>Total - Money In</h3>
                <div class="summary-count">${totalSummary.inCount} transactions</div>
                <div class="summary-amount">₹${totalSummary.inTotal.toFixed(2)}</div>
            </div>
            <div class="summary-card out-summary">
                <h3>Total - Money Out</h3>
                <div class="summary-count">${totalSummary.outCount} transactions</div>
                <div class="summary-amount">₹${totalSummary.outTotal.toFixed(2)}</div>
            </div>
        `;
    }

    summaryContainer.innerHTML = html;
}




// Add this CSS to your stylesheet
const style = document.createElement('style');
style.textContent = `
    #transaction-summary {
        display: flex;
        gap: 20px;
        margin: 20px 0;
        flex-wrap: wrap;
    }
    
    .summary-card {
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        flex: 1;
        min-width: 200px;
    }
    
    .in-summary {
        border-top: 4px solid #10b981;
    }
    
    .out-summary {
        border-top: 4px solid #ef4444;
    }
    
    .summary-card h3 {
        margin: 0 0 10px 0;
        color: #334155;
    }
    
    .summary-count {
        font-size: 1.2rem;
        color: #64748b;
        margin-bottom: 5px;
    }
    
    .summary-amount {
        font-size: 1.5rem;
        font-weight: bold;
    }
    
    .btn-reset {
        background: #e2e8f0;
        color: #334155;
        align-self: flex-end;
        padding: 10px 15px;
    }
    
    .btn-reset:hover {
        background: #cbd5e1;
    }
`;
document.head.appendChild(style);

 


// Helper Function to Show Notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
  }, 3000);
}
});