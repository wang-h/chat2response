// App state
let config = {};
let isRunning = false;

// DOM Elements
const elements = {
  // Sidebar
  navItems: document.querySelectorAll('.nav-item'),
  tabContents: document.querySelectorAll('.tab-content'),
  sidebarStatus: document.getElementById('sidebarStatus'),
  
  // Dashboard
  heroIndicator: document.getElementById('heroIndicator'),
  heroStatusText: document.getElementById('heroStatusText'),
  heroPortText: document.getElementById('heroPortText'),
  mainToggleBtn: document.getElementById('mainToggleBtn'),
  statProvider: document.getElementById('statProvider'),
  statModel: document.getElementById('statModel'),
  
  // Providers
  glmKey: document.getElementById('glmKey'),
  kimiKey: document.getElementById('kimiKey'),
  deepseekKey: document.getElementById('deepseekKey'),
  minimaxKey: document.getElementById('minimaxKey'),
  kimiCodingPlan: document.getElementById('kimiCodingPlan'),
  
  // Codex
  codexStatus: document.getElementById('codexStatus'),
  codexConfig: document.getElementById('codexConfig'),
  codexWarning: document.getElementById('codexWarning'),
  
  // Settings
  defaultProvider: document.getElementById('defaultProvider'),
  port: document.getElementById('port'),
  autoStart: document.getElementById('autoStart'),
  minimizeToTray: document.getElementById('minimizeToTray'),
  
  // Logs
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
  
  // Tab Switching
  setupTabs();
  
  log('初始化完成', 'success');
}

// Tab Switching Logic
function setupTabs() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      
      // Update sidebar
      elements.navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update content
      elements.tabContents.forEach(tab => tab.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
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
  
  // Kimi coding plan
  if (elements.kimiCodingPlan) {
    elements.kimiCodingPlan.checked = config.kimiCodingPlan || false;
  }
  
  updateStats();
}

// Update Dashboard Stats
function updateStats() {
  const provider = elements.defaultProvider.value;
  elements.statProvider.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
  
  const modelMap = {
    deepseek: 'deepseek-reasoner',
    kimi: 'kimi-coding',
    glm: 'glm-5',
    minimax: 'minimax-2.7'
  };
  elements.statModel.textContent = modelMap[provider] || 'default';
}

// Setup event listeners
function setupEventListeners() {
  // Toggle server button
  elements.mainToggleBtn.addEventListener('click', toggleServer);
  
  // Save on change
  const saveInputs = [
    elements.glmKey, elements.kimiKey, elements.deepseekKey, elements.minimaxKey,
    elements.defaultProvider, elements.port, elements.autoStart, elements.minimizeToTray,
    elements.kimiCodingPlan
  ];
  
  saveInputs.forEach(input => {
    if (input) {
      input.addEventListener('change', async () => {
        await saveConfig();
        updateStats();
      });
    }
  });
}

// Toggle server
async function toggleServer() {
  if (isRunning) {
    elements.mainToggleBtn.textContent = '停止中...';
    elements.mainToggleBtn.disabled = true;
    
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
    
    elements.mainToggleBtn.textContent = '启动中...';
    elements.mainToggleBtn.disabled = true;
    
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
  
  elements.mainToggleBtn.disabled = false;
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
  const currentPort = port || config.port || 3456;
  
  if (running) {
    // Sidebar badge
    elements.sidebarStatus.classList.add('running');
    elements.sidebarStatus.querySelector('.status-label').textContent = '运行中';
    
    // Dashboard Hero
    elements.heroIndicator.classList.add('running');
    elements.heroStatusText.textContent = '服务器运行中';
    elements.heroPortText.textContent = `监听端口: ${currentPort}`;
    elements.mainToggleBtn.textContent = '停止服务器';
    elements.mainToggleBtn.style.background = '#ff3b30'; // macOS Red
    
    // Codex config
    updateCodexConfig(currentPort);
    
    log(`服务器运行中 (端口: ${currentPort})`, 'success');
  } else {
    // Sidebar badge
    elements.sidebarStatus.classList.remove('running');
    elements.sidebarStatus.querySelector('.status-label').textContent = '未运行';
    
    // Dashboard Hero
    elements.heroIndicator.classList.remove('running');
    elements.heroStatusText.textContent = '服务器已停止';
    elements.heroPortText.textContent = `就绪端口: ${currentPort}`;
    elements.mainToggleBtn.textContent = '启动服务器';
    elements.mainToggleBtn.style.background = '#007aff'; // macOS Blue
    
    log('服务器已停止', 'info');
  }
}

// Update Codex config display
function updateCodexConfig(port) {
  const provider = elements.defaultProvider.value;
  const modelMap = {
    deepseek: 'deepseek-reasoner',
    kimi: 'kimi-coding',
    glm: 'glm-5',
    minimax: 'minimax-2.7'
  };
  const model = modelMap[provider] || `${provider}-chat`;
  
  const configText = `# ~/.codex/config.toml

model = "${model}"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:${port}/v1"
env_key = "${provider.toUpperCase()}_API_KEY"
wire_api = "responses"
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
    minimizeToTray: elements.minimizeToTray.checked,
    kimiCodingPlan: elements.kimiCodingPlan?.checked || false
  };
  
  try {
    await window.electronAPI.saveConfig(newConfig);
    config = newConfig;
    log('配置已保存', 'info');
    
    // 更新 Codex 配置显示
    if (isRunning) {
      updateCodexConfig(config.port);
    }
  } catch (error) {
    log('保存配置失败: ' + error.message, 'error');
  }
}

// Log helper
function log(message, type = 'info') {
  if (!elements.logContainer) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  elements.logContainer.appendChild(entry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// Clear logs
function clearLogs() {
  if (elements.logContainer) {
    elements.logContainer.innerHTML = '<div class="log-entry info">日志已清空</div>';
  }
}

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// Copy config
function copyConfig() {
  const configText = elements.codexConfig.textContent;
  navigator.clipboard.writeText(configText).then(() => {
    log('配置已复制到剪贴板', 'success');
  }).catch(() => {
    log('复制失败', 'error');
  });
}

// Check Codex config
async function checkCodexConfig() {
  try {
    log('检测 Codex 配置...', 'info');
    const result = await window.electronAPI.checkCodexConfig();
    
    if (result.exists) {
      if (result.hasChat2Response) {
        elements.codexStatus.className = 'codex-status-banner success';
        elements.codexStatus.textContent = '✅ Codex 已正确配置';
        elements.codexWarning.style.display = 'none';
      } else {
        elements.codexStatus.className = 'codex-status-banner warning';
        elements.codexStatus.textContent = '⚠️ 发现配置，但缺少本代理设置';
        elements.codexWarning.style.display = 'block';
        elements.codexWarning.textContent = '点击下方按钮自动添加配置。';
      }
    } else {
      elements.codexStatus.className = 'codex-status-banner error';
      elements.codexStatus.textContent = '❌ 未找到 Codex 配置文件';
      elements.codexWarning.style.display = 'block';
      elements.codexWarning.textContent = '请确认已安装 Codex CLI。';
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
      elements.codexStatus.className = 'codex-status-banner success';
      elements.codexStatus.textContent = '✅ 配置已成功写入';
      elements.codexWarning.style.display = 'none';
      log('Codex 配置写入成功', 'success');
    } else {
      log('写入失败: ' + result.message, 'error');
    }
  } catch (error) {
    log('写入失败: ' + error.message, 'error');
  }
}

// Open config directory
function openConfigDir() {
  window.electronAPI.openConfigDir();
  log('已打开配置目录', 'info');
}

// Start
init();
