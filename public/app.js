let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchOverviewStats();
  startCpuPolling();
  loadScheduledMessages();
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');

  if (tabId === 'task1-aggregated') {
    loadAggregatedPolicies();
  } else if (tabId === 'task2-services') {
    loadScheduledMessages();
  }
}

async function fetchOverviewStats() {
  try {
    const res = await fetch('/api/policies/overview');
    const data = await res.json();
    if (data.success) {
      document.getElementById('cnt-agents').innerText = data.collections.agents;
      document.getElementById('cnt-users').innerText = data.collections.users;
      document.getElementById('cnt-accounts').innerText = data.collections.accounts;
      document.getElementById('cnt-categories').innerText = data.collections.categories;
      document.getElementById('cnt-carriers').innerText = data.collections.carriers;
      document.getElementById('cnt-policies').innerText = data.collections.policies;
    }
  } catch (e) {
    console.error('Failed to fetch stats', e);
  }
}

function handleFileSelect(e) {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    document.getElementById('file-name-display').innerText = `Selected File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
  }
}

async function uploadSelectedFile() {
  if (!selectedFile) {
    alert('Please select an XLSX or CSV file first!');
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);

  const logBox = document.getElementById('upload-log');
  logBox.style.display = 'block';
  logBox.innerText = `[Worker Thread] Uploading ${selectedFile.name} to server... Processing in background worker thread...`;

  try {
    const res = await fetch('/api/policies/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      logBox.innerText = `[Worker Thread Success] Data successfully ingested in ${result.data.durationMs}ms!\n` +
        `Total Rows: ${result.data.totalRows}\n` +
        `Inserted Policies: ${result.data.insertedPolicies}\n` +
        `Agents Created: ${result.data.agentsCount}\n` +
        `Users Created: ${result.data.usersCount}\n` +
        `Accounts Created: ${result.data.accountsCount}\n` +
        `Categories (LOB) Created: ${result.data.categoriesCount}\n` +
        `Carriers Created: ${result.data.carriersCount}`;
      fetchOverviewStats();
    } else {
      logBox.innerText = `[Error] ${result.message || result.error}`;
    }
  } catch (err) {
    logBox.innerText = `[Upload Error] ${err.message}`;
  }
}

async function searchPolicies() {
  const query = document.getElementById('search-username').value.trim();
  const container = document.getElementById('search-results-container');
  if (!query) {
    alert('Please enter a username or firstname to search.');
    return;
  }

  container.innerHTML = `<p style="color: var(--text-muted);">Searching policies for "${query}"...</p>`;

  try {
    const res = await fetch(`/api/policies/search?username=${encodeURIComponent(query)}`);
    const result = await res.json();

    if (!result.success) {
      container.innerHTML = `<p style="color: #ff416c;">${result.message}</p>`;
      return;
    }

    let html = `<div style="margin-bottom: 20px;">
      <span class="badge badge-cyan">Users Found: ${result.usersFound}</span>
      <span class="badge badge-purple">Total Policies: ${result.totalPolicies}</span>
    </div>`;

    html += `<table>
      <thead>
        <tr>
          <th>Policy #</th>
          <th>User</th>
          <th>Account</th>
          <th>Category (LOB)</th>
          <th>Carrier</th>
          <th>Agent</th>
          <th>Premium</th>
          <th>Start Date</th>
        </tr>
      </thead>
      <tbody>`;

    result.data.policies.forEach(p => {
      html += `<tr>
        <td><strong>${p.policy_number}</strong></td>
        <td>${p.user_id ? p.user_id.firstname : 'N/A'}</td>
        <td>${p.account_id ? p.account_id.account_name : 'N/A'}</td>
        <td><span class="badge badge-cyan">${p.category_id ? p.category_id.category_name : 'N/A'}</span></td>
        <td><span class="badge badge-purple">${p.company_id ? p.company_id.company_name : 'N/A'}</span></td>
        <td>${p.agent_id ? p.agent_id.name : 'N/A'}</td>
        <td>$${p.premium_amount ? p.premium_amount.toFixed(2) : '0.00'}</td>
        <td>${p.policy_start_date ? new Date(p.policy_start_date).toLocaleDateString() : 'N/A'}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color: #ff416c;">Search failed: ${err.message}</p>`;
  }
}

async function loadAggregatedPolicies() {
  const container = document.getElementById('aggregated-results-container');
  container.innerHTML = `<p style="color: var(--text-muted);">Loading MongoDB aggregation pipeline...</p>`;

  try {
    const res = await fetch('/api/policies/aggregated');
    const result = await res.json();

    if (!result.success || result.data.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted);">No aggregated policy records found. Upload sample data first!</p>`;
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>User Name</th>
          <th>Email</th>
          <th>User Type</th>
          <th>Total Policies</th>
          <th>Total Premium</th>
          <th>Category Count</th>
          <th>Carrier Count</th>
        </tr>
      </thead>
      <tbody>`;

    result.data.forEach(item => {
      html += `<tr>
        <td><strong>${item.userName}</strong></td>
        <td>${item.email || 'N/A'}</td>
        <td><span class="badge badge-green">${item.userType || 'Client'}</span></td>
        <td><span class="badge badge-cyan">${item.totalPolicies} policies</span></td>
        <td><strong>$${item.totalPremiumAmount.toFixed(2)}</strong></td>
        <td>${item.categoryCount} LOBs</td>
        <td>${item.carrierCount} Carriers</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color: #ff416c;">Aggregation error: ${err.message}</p>`;
  }
}

// CPU Monitoring
function startCpuPolling() {
  setInterval(async () => {
    try {
      const res = await fetch('/api/system/cpu');
      const data = await res.json();
      if (data.success) {
        const cpu = data.data.currentCpuPercentage;
        document.getElementById('cpu-val').innerText = `${cpu}%`;
        document.getElementById('cpu-pid').innerText = `Server PID: ${data.data.pid}`;
        
        const deg = (cpu / 100) * 360;
        document.getElementById('cpu-gauge').style.setProperty('--cpu-deg', `${deg}deg`);

        const statusEl = document.getElementById('cpu-status-text');
        if (cpu >= 70) {
          statusEl.innerText = `Status: CRITICAL (>70% Restarting...)`;
          statusEl.style.color = '#ff416c';
        } else {
          statusEl.innerText = `Status: Normal (${data.data.status})`;
          statusEl.style.color = '#00e676';
        }
      }
    } catch (e) {
      // Server might be restarting
      document.getElementById('cpu-status-text').innerText = 'Status: Server Restarting...';
      document.getElementById('cpu-status-text').style.color = '#ff416c';
    }
  }, 2000);
}

async function triggerCpuSpike() {
  if (!confirm('This will simulate a CPU spike >70% and cause the Node server to automatically restart. Proceed?')) {
    return;
  }
  try {
    await fetch('/api/system/simulate-cpu-spike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMs: 6000 })
    });
    alert('CPU Spike simulation launched! Watch the CPU gauge and server log for auto-restart.');
  } catch (err) {
    alert('Triggered spike signal!');
  }
}

// Task 2 (2) Scheduled Message
async function handleScheduleSubmit(e) {
  e.preventDefault();
  const message = document.getElementById('msg-input').value.trim();
  const day = document.getElementById('day-input').value.trim();
  const time = document.getElementById('time-input').value.trim();

  try {
    const res = await fetch('/api/messages/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, day, time })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Message successfully scheduled for ${new Date(data.data.scheduledFor).toLocaleString()}!`);
      document.getElementById('schedule-form').reset();
      loadScheduledMessages();
    } else {
      alert(`Error: ${data.message}`);
    }
  } catch (err) {
    alert(`Schedule failed: ${err.message}`);
  }
}

async function loadScheduledMessages() {
  const container = document.getElementById('scheduled-messages-list');
  try {
    const res = await fetch('/api/messages');
    const result = await res.json();

    if (!result.success || result.data.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted);">No scheduled messages in database.</p>`;
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>Message</th>
          <th>Day / Time Input</th>
          <th>Scheduled Target Time</th>
          <th>Status</th>
          <th>Inserted At</th>
        </tr>
      </thead>
      <tbody>`;

    result.data.forEach(m => {
      const badgeClass = m.status === 'inserted' ? 'badge-green' : (m.status === 'scheduled' ? 'badge-cyan' : 'badge-purple');
      html += `<tr>
        <td><strong>${m.message}</strong></td>
        <td>${m.day} at ${m.time}</td>
        <td>${new Date(m.scheduledFor).toLocaleString()}</td>
        <td><span class="badge ${badgeClass}">${m.status.toUpperCase()}</span></td>
        <td>${m.insertedAt ? new Date(m.insertedAt).toLocaleString() : 'Pending'}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color: var(--text-muted);">Failed to load scheduled messages.</p>`;
  }
}
