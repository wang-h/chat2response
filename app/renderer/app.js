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

// Get the first configured API key provider
function getConfiguredProvider() {
  const providers = [
    { name: 'deepseek', key: config.apiKeys?.deepseek },
    { name: 'kimi', key: config.apiKeys?.kimi },
    { name: 'glm', key: config.apiKeys?.glm },
    { name: 'minimax', key: config.apiKeys?.minimax }
  ];
  
  const configured = providers.find(p => p.key && p.key.trim().length > 0);
  return configured ? configured.name : (config.defaultProvider || 'deepseek');
}

// Update Codex config display
function updateCodexConfig(port) {
  const provider = getConfiguredProvider();
  const modelMap = {
    deepseek: 'deepseek-chat',
    kimi: 'kimi-coding',
    glm: 'glm-5',
    minimax: 'MiniMax-M2.7'  // 正确的 MiniMax 模型名
  };
  const model = modelMap[provider] || `${provider}-chat`;
  
  const configText = `# 添加到 ~/.codex/config.toml

model = "${model}"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:${port}/v1"
env_key = "${provider.toUpperCase()}_API_KEY"
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

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentElement.querySelector('.toggle-password');
  
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
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

// Check Codex config
async function checkCodexConfig() {
  try {
    log('检测 Codex 配置...', 'info');
    const result = await window.electronAPI.checkCodexConfig();
    
    const statusEl = document.getElementById('codexStatus');
    const warningEl = document.getElementById('codexWarning');
    
    if (result.exists) {
      if (result.hasChat2Response) {
        statusEl.className = 'codex-status success';
        statusEl.textContent = '✅ Codex 已配置 Chat2Response';
        warningEl.style.display = 'none';
        log('Codex 配置检测完成: 已正确配置', 'success');
      } else {
        statusEl.className = 'codex-status warning';
        statusEl.textContent = '⚠️ Codex 配置存在，但未配置 Chat2Response';
        warningEl.style.display = 'block';
        warningEl.textContent = '建议点击"一键写入配置"添加 Chat2Response 配置';
        log('Codex 配置检测完成: 未配置 Chat2Response', 'warn');
      }
    } else {
      statusEl.className = 'codex-status error';
      statusEl.textContent = '❌ 未找到 Codex 配置文件';
      warningEl.style.display = 'block';
      warningEl.textContent = '请先安装 Codex CLI: npm install -g @openai/codex';
      log('Codex 配置检测完成: 未找到配置文件', 'error');
    }
  } catch (error) {
    log('检测失败: ' + error.message, 'error');
  }
}

// Apply Codex config
async function applyCodexConfig() {
  try {
    log('正在写入 Codex 配置...', 'info');
    const configText = elements.codexConfig.textContent;
    const result = await window.electronAPI.applyCodexConfig(configText);
    
    if (result.success) {
      const statusEl = document.getElementById('codexStatus');
      const warningEl = document.getElementById('codexWarning');
      statusEl.className = 'codex-status success';
      statusEl.textContent = '✅ 配置已写入 ' + result.path;
      warningEl.style.display = 'none';
      log('Codex 配置写入成功: ' + result.path, 'success');
      alert('配置已写入成功！\n路径: ' + result.path);
    } else {
      log('写入失败: ' + result.message, 'error');
      alert('写入失败: ' + result.message);
    }
  } catch (error) {
    log('写入失败: ' + error.message, 'error');
    alert('写入失败: ' + error.message);
  }
}

// Open config directory
function openConfigDir() {
  window.electronAPI.openConfigDir();
  log('已打开配置目录', 'info');
}

// Start
init();
