
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons?.();
});

// Login function
window.handleLogin = function () {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (username === "admin" && password === "Nayak@2016") {
    window.location.href = "/dashboard";
  } else {
    alert("Invalid credentials! Try admin / admin");
  }
};

// Navigation function
window.goTo = function (section) {
  const routes = {
    'sales': '/sales',
    'salesChart': '/salesChart',
    'advance_order': './advanceOrder',
    'inventoryy': '/inventorySelect',
    'book_keeping': './templates/book_keeping.html',
    'bill': '/bill'
  };

  if (routes[section]) {
    window.location.href = routes[section];
  } else {
    alert('Page under development!');
  }
};

// Automatic total calculation
const quantity = document.getElementById('quantity');
const unitPrice = document.getElementById('unitPrice');
const totalPrice = document.getElementById('totalPrice');
const form = document.getElementById('inventoryForm');

[quantity, unitPrice].forEach(input => {
  input.addEventListener('input', () => {
    totalPrice.value = (quantity.value * unitPrice.value).toFixed(2);
  });
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const inventoryItem = {
    date: document.getElementById('date').value,
    supplierName: document.getElementById('supplierName').value,
    supplierContact: document.getElementById('supplierContact').value,
    fishType: document.getElementById('fishType').value,
    type: document.getElementById('type').value,
    quantity: parseFloat(quantity.value),
    unitPrice: parseFloat(unitPrice.value),
    totalPrice: parseFloat(totalPrice.value)
  };

  try {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inventoryItem)
    });

    const result = await response.json();
    if (result.success) {
      alert('Inventory saved successfully!');
      form.reset();
      window.location.href = '/inventory';
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to save inventory');
  }
});