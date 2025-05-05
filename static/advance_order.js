
  async function saveAdvanceOrder() {
    const order = {
      date: document.getElementById("date").value,
      amount: document.getElementById("amount").value,
      fishType: document.getElementById("fishType").value,
      advance: document.getElementById("advance").value,
      name: document.getElementById("name").value,
      contact: document.getElementById("contact").value,
    };

    // Send the order data to the backend using fetch
    try {
      const response = await fetch('/api/save_advance_order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),  // Send the order as JSON
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);  // Show success message
        window.location.href = "/advanceList";  // Redirect to the order list page
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error saving order: ' + error.message);
    }
  }

  async function saveAdvanceOrder() {
    const order = {
      date: document.getElementById("date").value,
      amount: document.getElementById("amount").value,
      fishType: document.getElementById("fishType").value,
      advance: document.getElementById("advance").value,
      name: document.getElementById("name").value,
      contact: document.getElementById("contact").value,
    };

    // Send the order data to the backend using fetch
    try {
      const response = await fetch('/api/save_advance_order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),  // Send the order as JSON
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);  // Show success message
        window.location.href = "/advanceList";  // Redirect to the order list page
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error saving order: ' + error.message);
    }
  }

  async function viewOrders() {
    const response = await fetch('/api/get_advance_orders');
    
    if (!response.ok) {
      alert('Failed to fetch orders');
      return;
    }

    const orders = await response.json();
    const ordersListDiv = document.getElementById('ordersList');
    ordersListDiv.innerHTML = '';  // Clear previous orders

    if (orders.length === 0) {
      ordersListDiv.innerHTML = '<p>No orders available</p>';
      return;
    }

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>Date</th>
        <th>Amount</th>
        <th>Fish Type</th>
        <th>Advance Amount</th>
        <th>Name</th>
        <th>Contact</th>
        <th>Action</th>
        `;

    table.appendChild(headerRow);

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${order.date}</td>
          <td>${order.amount}</td>
          <td>${order.fish_type}</td>
          <td>${order.advance}</td>
          <td>${order.name}</td>
          <td>${order.contact}</td>
          <td><button onclick="deleteOrder(${order.id})">Done</button></td>
        `;
        table.appendChild(row);
      });
      
    ordersListDiv.appendChild(table);
  }

  async function deleteOrder(orderId) {
    if (!confirm("Mark this order as done and remove it?")) return;
  
    try {
      const response = await fetch(`/api/delete_order/${orderId}`, {
        method: 'DELETE',
      });
  
      const result = await response.json();
  
      if (response.ok) {
        alert(result.message);
        viewOrders(); // Refresh the list
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Failed to delete order: ' + error.message);
    }
  }

  async function filterOrdersByDate() {
    const container = document.getElementById('ordersList');
    const date = document.getElementById("filterDate").value;
    if (!date) {
      alert("Please select a date.");
      return;
    }
  
    try {
      const response = await fetch(`/api/get_advance_orders?date=${date}`);
      const orders = await response.json();
      if (orders.length === 0) {
        container.innerHTML = '<p>No orders found for selected date.</p>';
        return;
      }else{
        displayOrders(orders);
      }
      
    } catch (error) {
      alert("Error fetching orders: " + error.message);
    }
  }

  function displayOrders(orders) {
    const ordersListDiv = document.getElementById('ordersList');
    ordersListDiv.innerHTML = '';  // Clear previous orders

    if (orders.length === 0) {
      ordersListDiv.innerHTML = '<p>No orders available</p>';
      return;
    }

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>Date</th>
        <th>Amount</th>
        <th>Fish Type</th>
        <th>Advance Amount</th>
        <th>Name</th>
        <th>Contact</th>
        <th>Action</th>
        `;

    table.appendChild(headerRow);

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${order.date}</td>
          <td>${order.amount}</td>
          <td>${order.fish_type}</td>
          <td>${order.advance}</td>
          <td>${order.name}</td>
          <td>${order.contact}</td>
          <td><button onclick="deleteOrder(${order.id})">Done</button></td>
        `;
        table.appendChild(row);
    });
    ordersListDiv.appendChild(table);
  }
  
  
  

