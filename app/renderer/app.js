// App state
let config = {};
let isRunning = false;

// DOM Elements
const elements = {
  statusCard: document.getElementById('statusCard'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  portInfo: document.getElementById('portInfo'),
  toggleServerBtn: document.getElementById('toggleServerBtn'),
  glmKey: document.getElementById('glmKey'),
  kimiKey: document.getElementById('kimiKey'),
  deepseekKey: document.getElementById('deepseekKey'),
  minimaxKey: document.getElementById('minimaxKey'),
  defaultProvider: document.getElementById('defaultProvider'),
  port: document.getElementById('port'),
  autoStart: document.getElementById('autoStart'),
  minimizeToTray: document.getElementById('minimizeToTray'),
  codexSection: document.getElementById('codexSection'),
  codexConfig: document.getElementById('codexConfig'),
  logContainer: document.getElementById('logContainer')
};

// Initialize
async function init() {
  log('应用初始化中...', 'info');
  
  // Load config
  try {
    config = await window.electronAPI.getConfig();
    log('配置加载成功', 'success');
  } catch (error) {
    log('配置加载失败: ' + error.message, 'error');
    config = {};
  }
  
  // Populate form
  populateForm();
  
  // Check server status
  await checkServerStatus();
  
  // Setup event listeners
  setupEventListeners();
  
  // Listen for server status updates
  window.electronAPI.onServerStatus((status) => {
    updateServerUI(status.running, status.port);
  });
  
  log('初始化完成', 'success');
}

// Populate form with config
function populateForm() {
  elements.glmKey.value = config.apiKeys?.glm || '';
  elements.kimiKey.value = config.apiKeys?.kimi || '';
  elements.deepseekKey.value = config.apiKeys?.deepseek || '';
  elements.minimaxKey.value = config.apiKeys?.minimax || '';
  elements.defaultProvider.value = config.defaultProvider || 'deepseek';
  elements.port.value = config.port || 3456;
  elements.autoStart.checked = config.autoStart || false;
  elements.minimizeToTray.checked = config.minimizeToTray !== false;
}

// Setup event listeners
function setupEventListeners() {
  // Toggle server button
  elements.toggleServerBtn.addEventListener('click', toggleServer);
  
  // Save on change (debounced)
  const saveInputs = [
    elements.glmKey, elements.kimiKey, elements.deepseekKey, elements.minimaxKey,
    elements.defaultProvider, elements.port, elements.autoStart, elements.minimizeToTray
  ];
  
  saveInputs.forEach(input => {
    input.addEventListener('change', saveConfig);
  });
}

// Toggle server
async function toggleServer() {
  if (isRunning) {
    elements.toggleServerBtn.textContent = '停止中...';
    elements.toggleServerBtn.disabled = true;
    
    try {
      const result = await window.electronAPI.stopServer();
      if (result.success) {
        log('服务器已停止', 'success');
      } else {
        log('停止失败: ' + result.message, 'error');
      }
    } catch (error) {
      log('停止错误: ' + error.message, 'error');
    }
  } else {
    // Save config first
    await saveConfig();
    
    elements.toggleServerBtn.textContent = '启动中...';
    elements.toggleServerBtn.disabled = true;
    
    try {
      const result = await window.electronAPI.startServer();
      if (result.success) {
        log('服务器启动成功: ' + result.message, 'success');
      } else {
        log('启动失败: ' + result.message, 'error');
        alert('启动失败: ' + result.message);
      }
    } catch (error) {
      log('启动错误: ' + error.message, 'error');
      alert('启动错误: ' + error.message);
    }
  }
  
  elements.toggleServerBtn.disabled = false;
}

// Check server status
async function checkServerStatus() {
  try {
    const status = await window.electronAPI.getServerStatus();
    updateServerUI(status.running, status.port);
  } catch (error) {
    log('获取服务器状态失败: ' + error.message, 'error');
  }
}

// Update server UI
function updateServerUI(running, port) {
  isRunning = running;
  
  if (running) {
    elements.statusIndicator.classList.add('running');
    elements.statusText.textContent = '服务器运行中';
    elements.portInfo.textContent = `(端口: ${port || config.port})`;
    elements.toggleServerBtn.textContent = '停止服务器';
    elements.toggleServerBtn.classList.remove('btn-primary');
    elements.toggleServerBtn.style.background = '#ef4444';
    
    // Show Codex config
    elements.codexSection.style.display = 'block';
    updateCodexConfig(port || config.port);
    
    log(`服务器运行中 (端口: ${port || config.port})`, 'success');
  } else {
    elements.statusIndicator.classList.remove('running');
    elements.statusText.textContent = '服务器未运行';
    elements.portInfo.textContent = '';
    elements.toggleServerBtn.textContent = '启动服务器';
    elements.toggleServerBtn.classList.add('btn-primary');
    elements.toggleServerBtn.style.background = '';
    
    // Hide Codex config
    elements.codexSection.style.display = 'none';
    
    log('服务器已停止', 'info');
  }
}

// Update Codex config display
function updateCodexConfig(port) {
  const configText = `# 添加到 ~/.codex/config.toml

model = "${config.defaultProvider || 'deepseek'}-chat"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:${port}/v1"
env_key = "${(config.defaultProvider || 'deepseek').toUpperCase()}_API_KEY"
`;
  elements.codexConfig.textContent = configText;
}

// Save config
async function saveConfig() {
  const newConfig = {
    port: parseInt(elements.port.value) || 3456,
    defaultProvider: elements.defaultProvider.value,
    apiKeys: {
      glm: elements.glmKey.value.trim(),
      kimi: elements.kimiKey.value.trim(),
      deepseek: elements.deepseekKey.value.trim(),
      minimax: elements.minimaxKey.value.trim()
    },
    autoStart: elements.autoStart.checked,
    minimizeToTray: elements.minimizeToTray.checked
  };
  
  try {
    await window.electronAPI.saveConfig(newConfig);
    config = newConfig;
    log('配置已保存', 'info');
  } catch (error) {
    log('保存配置失败: ' + error.message, 'error');
  }
}

// Log helper
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  elements.logContainer.appendChild(entry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// Clear logs
function clearLogs() {
  elements.logContainer.innerHTML = '<div class="log-entry info">日志已清空</div>';
}

// Copy config
function copyConfig() {
  const configText = elements.codexConfig.textContent;
  navigator.clipboard.writeText(configText).then(() => {
    log('配置已复制到剪贴板', 'success');
    alert('配置已复制！');
  }).catch(() => {
    log('复制失败', 'error');
  });
}

// Open config directory
function openConfigDir() {
  window.electronAPI.openConfigDir();
  log('已打开配置目录', 'info');
}

// Start
init();
