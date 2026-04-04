// Translations
const translations = {
  zh: {
    nav_dashboard: "控制面板",
    nav_providers: "模型配置",
    nav_codex: "Codex 设置",
    nav_settings: "全局设置",
    nav_logs: "运行日志",
    status_running: "运行中",
    status_stopped: "未运行",
    hero_running: "服务器运行中",
    hero_stopped: "服务器已停止",
    hero_btn_start: "启动服务器",
    hero_btn_stop: "停止服务器",
    hero_port_listen: "监听端口",
    hero_port_ready: "就绪端口",
    stat_provider: "当前提供商",
    stat_model: "当前模型",
    card_quick_actions: "快速操作",
    action_config_dir: "配置目录",
    action_check_config: "检测配置",
    action_clear_logs: "清空日志",
    header_providers: "模型提供商配置",
    provider_recommended: "推荐",
    header_codex: "Codex 配置",
    codex_hint: "将以下内容添加到您的 ~/.codex/config.toml 文件中",
    codex_btn_redetect: "重新检测",
    codex_btn_apply: "自动写入配置",
    header_settings: "设置",
    setting_lang_title: "界面语言",
    setting_lang_desc: "切换中英文界面显示",
    setting_provider_title: "默认提供商",
    setting_provider_desc: "未在请求头指定提供商时使用的默认模型",
    setting_port_title: "服务器端口",
    setting_port_desc: "代理服务器运行的本地端口",
    setting_autostart_title: "开机启动",
    setting_autostart_desc: "登录系统时自动启动代理",
    setting_tray_title: "最小化到托盘",
    setting_tray_desc: "关闭窗口时不退出程序，而是隐藏到菜单栏",
    header_logs: "运行日志",
    btn_clear: "清空",
    btn_copy: "复制",
    log_init: "应用初始化中...",
    log_config_loaded: "配置加载成功",
    log_init_done: "初始化完成",
    log_stopped: "服务器已停止",
    log_save_success: "配置已保存",
    msg_copy_success: "配置已复制到剪贴板",
    codex_status_ok: "✅ Codex 已正确配置",
    codex_status_warn: "⚠️ 发现配置，但缺少本代理设置",
    codex_status_error: "❌ 未找到 Codex 配置文件",
    kimi_special_title: "Kimi Coding 专线",
    kimi_special_desc: "使用 api.kimi.com/coding 补全线路",
  },
  en: {
    nav_dashboard: "Dashboard",
    nav_providers: "Models",
    nav_codex: "Codex",
    nav_settings: "Settings",
    nav_logs: "Logs",
    status_running: "Running",
    status_stopped: "Stopped",
    hero_running: "Server is Running",
    hero_stopped: "Server Stopped",
    hero_btn_start: "Start Server",
    hero_btn_stop: "Stop Server",
    hero_port_listen: "Listening Port",
    hero_port_ready: "Ready Port",
    stat_provider: "Current Provider",
    stat_model: "Current Model",
    card_quick_actions: "Quick Actions",
    action_config_dir: "Config Dir",
    action_check_config: "Check Config",
    action_clear_logs: "Clear Logs",
    header_providers: "Provider Configuration",
    provider_recommended: "REC",
    header_codex: "Codex Setup",
    codex_hint: "Add following content to your ~/.codex/config.toml",
    codex_btn_redetect: "Re-detect",
    codex_btn_apply: "Auto Apply",
    header_settings: "Global Settings",
    setting_lang_title: "Language",
    setting_lang_desc: "Switch between Chinese and English",
    setting_provider_title: "Default Provider",
    setting_provider_desc: "Used when no x-provider header is sent",
    setting_port_title: "Server Port",
    setting_port_desc: "Local port for the proxy server",
    setting_autostart_title: "Auto Start",
    setting_autostart_desc: "Start server automatically on login",
    setting_tray_title: "Minimize to Tray",
    setting_tray_desc: "Hide window to menu bar when closed",
    header_logs: "System Logs",
    btn_clear: "Clear",
    btn_copy: "Copy",
    log_init: "Initializing app...",
    log_config_loaded: "Config loaded successfully",
    log_init_done: "Initialization complete",
    log_stopped: "Server stopped",
    log_save_success: "Settings saved",
    msg_copy_success: "Config copied to clipboard",
    codex_status_ok: "✅ Codex configured correctly",
    codex_status_warn: "⚠️ Config found but missing Chat2Response",
    codex_status_error: "❌ Codex config not found",
    kimi_special_title: "Kimi Coding Plan",
    kimi_special_desc: "Use api.kimi.com/coding endpoint",
  }
};

// App state
let config = {};
let isRunning = false;
let currentLanguage = 'zh';

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
  language: document.getElementById('language'),
  defaultProvider: document.getElementById('defaultProvider'),
  port: document.getElementById('port'),
  autoStart: document.getElementById('autoStart'),
  minimizeToTray: document.getElementById('minimizeToTray'),
  
  // Logs
  logContainer: document.getElementById('logContainer')
};

// Translate function
function t(key) {
  return translations[currentLanguage][key] || key;
}

// Update UI Text
function applyTranslations() {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.getAttribute('data-t');
    el.textContent = t(key);
  });
  
  // Update non-data-t elements
  updateServerUI(isRunning, config.port);
  updateStats();
}

// Initialize
async function init() {
  // Load config
  try {
    config = await window.electronAPI.getConfig();
    currentLanguage = config.language || 'zh';
  } catch (error) {
    config = {};
  }
  
  // Populate form
  populateForm();
  
  // Apply initial translations
  applyTranslations();
  
  log(t('log_init'), 'info');
  
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
  
  log(t('log_init_done'), 'success');
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
  elements.language.value = currentLanguage;
  
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
  
  // Language switcher
  elements.language.addEventListener('change', async () => {
    currentLanguage = elements.language.value;
    await saveConfig();
    applyTranslations();
  });

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
    elements.mainToggleBtn.disabled = true;
    try {
      const result = await window.electronAPI.stopServer();
      if (result.success) {
        log(t('log_stopped'), 'success');
      }
    } catch (error) {}
  } else {
    // Save config first
    await saveConfig();
    elements.mainToggleBtn.disabled = true;
    try {
      const result = await window.electronAPI.startServer();
      if (result.success) {
        log(t('status_running'), 'success');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert(error.message);
    }
  }
  elements.mainToggleBtn.disabled = false;
}

// Check server status
async function checkServerStatus() {
  try {
    const status = await window.electronAPI.getServerStatus();
    updateServerUI(status.running, status.port);
  } catch (error) {}
}

// Update server UI
function updateServerUI(running, port) {
  isRunning = running;
  const currentPort = port || config.port || 3456;
  
  if (running) {
    // Sidebar badge
    elements.sidebarStatus.classList.add('running');
    elements.sidebarStatus.querySelector('.status-label').textContent = t('status_running');
    
    // Dashboard Hero
    elements.heroIndicator.classList.add('running');
    elements.heroStatusText.textContent = t('hero_running');
    elements.heroPortText.textContent = `${t('hero_port_listen')}: ${currentPort}`;
    elements.mainToggleBtn.textContent = t('hero_btn_stop');
    elements.mainToggleBtn.style.background = '#ff3b30';
    
    // Codex config
    updateCodexConfig(currentPort);
  } else {
    // Sidebar badge
    elements.sidebarStatus.classList.remove('running');
    elements.sidebarStatus.querySelector('.status-label').textContent = t('status_stopped');
    
    // Dashboard Hero
    elements.heroIndicator.classList.remove('running');
    elements.heroStatusText.textContent = t('hero_stopped');
    elements.heroPortText.textContent = `${t('hero_port_ready')}: ${currentPort}`;
    elements.mainToggleBtn.textContent = t('hero_btn_start');
    elements.mainToggleBtn.style.background = '#007aff';
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
    language: elements.language.value,
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
    log(t('log_save_success'), 'info');
    
    if (isRunning) {
      updateCodexConfig(config.port);
    }
  } catch (error) {}
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
    elements.logContainer.innerHTML = `<div class="log-entry info">${t('btn_clear')}</div>`;
  }
}

// Toggle password visibility
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
    `;
  } else {
    input.type = 'password';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
    `;
  }
}

// Copy config
function copyConfig() {
  const configText = elements.codexConfig.textContent;
  navigator.clipboard.writeText(configText).then(() => {
    log(t('msg_copy_success'), 'success');
  }).catch(() => {});
}

// Check Codex config
async function checkCodexConfig() {
  try {
    log(t('action_check_config') + '...', 'info');
    const result = await window.electronAPI.checkCodexConfig();
    
    if (result.exists) {
      if (result.hasChat2Response) {
        elements.codexStatus.className = 'codex-status-banner success';
        elements.codexStatus.textContent = t('codex_status_ok');
        elements.codexWarning.style.display = 'none';
      } else {
        elements.codexStatus.className = 'codex-status-banner warning';
        elements.codexStatus.textContent = t('codex_status_warn');
        elements.codexWarning.style.display = 'block';
      }
    } else {
      elements.codexStatus.className = 'codex-status-banner error';
      elements.codexStatus.textContent = t('codex_status_error');
      elements.codexWarning.style.display = 'block';
    }
  } catch (error) {}
}

// Apply Codex config
async function applyCodexConfig() {
  try {
    const configText = elements.codexConfig.textContent;
    const result = await window.electronAPI.applyCodexConfig(configText);
    
    if (result.success) {
      elements.codexStatus.className = 'codex-status-banner success';
      elements.codexStatus.textContent = t('codex_status_ok');
      elements.codexWarning.style.display = 'none';
    }
  } catch (error) {}
}

// Open config directory
function openConfigDir() {
  window.electronAPI.openConfigDir();
}

// Start
init();
