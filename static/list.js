document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/inventory');
      const inventory = await response.json();
      
      const tableBody = document.querySelector('#inventoryTable tbody');
      tableBody.innerHTML = inventory.map(item => `
        <tr>
          <td>${item.date}</td>
          <td>${item.supplierName}</td>
          <td>${item.supplierContact}</td>
          <td>${item.fishType}</td>
          <td>${item.type}</td>
          <td>${item.quantity}</td>
          <td>₹${item.unitPrice.toFixed(2)}</td>
          <td>₹${item.totalPrice.toFixed(2)}</td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  });