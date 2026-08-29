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
    const [healthRes, overviewRes] = await Promise.all([
      fetch('/api/health').then(r => r.json()).catch(() => ({})),
      fetch('/api/policies/overview').then(r => r.json()).catch(() => ({}))
    ]);

    if (healthRes && healthRes.status === 'OK' && healthRes.cpu) {
      document.getElementById('cpu-pid').innerText = `Server PID: ${healthRes.cpu.pid}`;
    }

    if (overviewRes && overviewRes.success && overviewRes.data) {
      updateStatCards(overviewRes.data);
    }
  } catch (e) {
    console.error('Failed to fetch stats', e);
  }
}

function updateStatCards(data) {
  if (!data) return;
  document.getElementById('cnt-agents').innerText = data.agentsCount !== undefined ? data.agentsCount : (data.agents || 0);
  document.getElementById('cnt-users').innerText = data.usersCount !== undefined ? data.usersCount : (data.users || 0);
  document.getElementById('cnt-accounts').innerText = data.accountsCount !== undefined ? data.accountsCount : (data.accounts || 0);
  document.getElementById('cnt-categories').innerText = data.lobsCount !== undefined ? data.lobsCount : (data.lobs || 0);
  document.getElementById('cnt-carriers').innerText = data.carriersCount !== undefined ? data.carriersCount : (data.carriers || 0);
  document.getElementById('cnt-policies').innerText = data.processedRows !== undefined ? data.processedRows : (data.policies || 0);
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
  logBox.innerText = `[Worker Thread] Uploading ${selectedFile.name} to /api/import... Processing in background worker thread via bulkWrite()...`;

  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      logBox.innerText = `[Worker Thread Success] Bulk Data Ingestion completed in ${result.data.durationMs}ms!\n` +
        `Total Rows Read: ${result.data.totalRows}\n` +
        `Processed Rows: ${result.data.processedRows}\n` +
        `Skipped Invalid Rows: ${result.data.skippedRows}\n` +
        `Agents Created/Updated: ${result.data.agentsCount}\n` +
        `Users Created/Updated: ${result.data.usersCount}\n` +
        `Accounts Created/Updated: ${result.data.accountsCount}\n` +
        `LOBs Created/Updated: ${result.data.lobsCount}\n` +
        `Carriers Created/Updated: ${result.data.carriersCount}`;

      updateStatCards(result.data);
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

    if (!result.success || !result.data) {
      container.innerHTML = `<p style="color: #ff416c;">${result.message || 'No user found'}</p>`;
      return;
    }

    const { user, policies } = result.data;

    let html = `<div style="margin-bottom: 20px;">
      <span class="badge badge-cyan">User: ${user.name} (${user.email})</span>
      <span class="badge badge-purple">Policies Found: ${policies.length}</span>
    </div>`;

    html += `<table>
      <thead>
        <tr>
          <th>Policy #</th>
          <th>Category (LOB)</th>
          <th>Carrier</th>
          <th>Agent</th>
          <th>Account</th>
          <th>Premium</th>
          <th>Start Date</th>
        </tr>
      </thead>
      <tbody>`;

    policies.forEach(p => {
      html += `<tr>
        <td><strong>${p.policyNumber}</strong></td>
        <td><span class="badge badge-cyan">${p.category}</span></td>
        <td><span class="badge badge-purple">${p.carrier}</span></td>
        <td>${p.agent}</td>
        <td>${p.account}</td>
        <td>$${p.premiumAmount ? p.premiumAmount.toFixed(2) : '0.00'}</td>
        <td>${p.startDate || 'N/A'}</td>
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
  container.innerHTML = `<p style="color: var(--text-muted);">Loading MongoDB aggregation pipeline from /api/policies/aggregate/users...</p>`;

  try {
    const res = await fetch('/api/policies/aggregate/users');
    const result = await res.json();

    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted);">No aggregated policy records found. Import sample data first!</p>`;
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>User Name</th>
          <th>Email</th>
          <th>Total Policies</th>
          <th>Total Premium</th>
        </tr>
      </thead>
      <tbody>`;

    result.data.forEach(item => {
      html += `<tr>
        <td><strong>${item.userName}</strong></td>
        <td>${item.email || 'N/A'}</td>
        <td><span class="badge badge-cyan">${item.policyCount} policies</span></td>
        <td><strong>$${item.totalPremium ? item.totalPremium.toFixed(2) : '0.00'}</strong></td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color: #ff416c;">Aggregation error: ${err.message}</p>`;
  }
}

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
      body: JSON.stringify({ durationMs: 5000 })
    });
    alert('CPU Spike simulation launched! Watch CPU gauge for restart.');
  } catch (err) {
    alert('Triggered spike signal!');
  }
}

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
      alert(`Message successfully scheduled for ${new Date(data.data.scheduledAt).toLocaleString()}!`);
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

    if (!result.success || !result.data || result.data.length === 0) {
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
          <th>Completed At</th>
        </tr>
      </thead>
      <tbody>`;

    result.data.forEach(m => {
      const badgeClass = m.status === 'completed' ? 'badge-green' : (m.status === 'pending' ? 'badge-cyan' : 'badge-purple');
      html += `<tr>
        <td><strong>${m.message}</strong></td>
        <td>${m.day} at ${m.time}</td>
        <td>${new Date(m.scheduledAt).toLocaleString()}</td>
        <td><span class="badge ${badgeClass}">${m.status.toUpperCase()}</span></td>
        <td>${m.completedAt ? new Date(m.completedAt).toLocaleString() : 'Pending'}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color: var(--text-muted);">Failed to load scheduled messages.</p>`;
  }
}
