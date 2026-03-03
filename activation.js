/**
 * 前端激活码验证模块（独立文件）
 * 
 * 功能：
 * 1. 页面加载时检查本地是否已激活
 * 2. 未激活则弹出全屏激活码输入界面，阻止使用
 * 3. 激活成功后保存到 localStorage，下次自动放行
 * 
 * 使用方式：在 index.html 中引入（必须在其他脚本之前）
 *   <link rel="stylesheet" href="activation.css">
 *   <script src="activation.js"></script>
 */

(function () {
    'use strict';

    // ==================== 配置（只需要改这里）====================
    
    // ★ 你的后端服务器地址（就是 server.js 部署的那个地址）
    // 如果前端和后端在同一个域名下，留空字符串 '' 即可
    // 如果不同域名，填完整地址，如 'https://xxx.zeabur.app' （末尾不要加 /）
    const SERVER_URL = '';
    
    // 拼接出完整的 API 地址（你不用管这行）
    const VERIFY_API = SERVER_URL + '/api/activation/verify';
    
    // localStorage 存储键名
    const STORAGE_KEY = 'activation_verified';
    const STORAGE_CODE_KEY = 'activation_code';
    
    // ==================== 检查是否已激活 ====================
    
    function isActivated() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return false;
            const parsed = JSON.parse(data);
            // 检查数据结构
            if (parsed && parsed.activated === true && parsed.code) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
    
    function saveActivation(code, qq) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            activated: true,
            code: code,
            qq: qq || null,
            time: Date.now()
        }));
        localStorage.setItem(STORAGE_CODE_KEY, code);
    }
    
    // ==================== 如果已激活，直接放行 ====================
    
    if (isActivated()) {
        console.log('[激活码] 已激活，放行');
        return;
    }
    
    // ==================== 未激活：创建激活界面 ====================
    
    console.log('[激活码] 未激活，显示激活界面');
    
    // 创建遮罩层（阻止操作页面）
    const overlay = document.createElement('div');
    overlay.id = 'activation-overlay';
    overlay.innerHTML = `
        <div class="activation-card">
            <div class="activation-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <h2 class="activation-title">请输入激活码</h2>
            <p class="activation-desc">请输入您的激活码以解锁使用</p>
            <div class="activation-input-wrap">
                <input 
                    type="text" 
                    id="activation-code-input" 
                    class="activation-input" 
                    placeholder="XXXX-XXXX-XXXX-XXXX" 
                    maxlength="19"
                    autocomplete="off"
                    spellcheck="false"
                >
            </div>
            <button id="activation-submit-btn" class="activation-btn">验 证</button>
            <div id="activation-message" class="activation-message"></div>
            <p class="activation-hint">激活码可通过QQ机器人获取</p>
        </div>
    `;
    
    // 等 DOM 就绪后插入
    function mountOverlay() {
        document.body.appendChild(overlay);
        
        const input = document.getElementById('activation-code-input');
        const btn = document.getElementById('activation-submit-btn');
        const msg = document.getElementById('activation-message');
        
        // 自动格式化输入（每4位加横杠）
        input.addEventListener('input', function () {
            let val = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (val.length > 16) val = val.substring(0, 16);
            // 每4位加横杠
            let formatted = val.replace(/(.{4})/g, '$1-');
            if (formatted.endsWith('-')) formatted = formatted.slice(0, -1);
            this.value = formatted;
        });
        
        // 回车提交
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                doVerify();
            }
        });
        
        // 点击按钮提交
        btn.addEventListener('click', doVerify);
        
        // 自动聚焦
        setTimeout(() => input.focus(), 300);
        
        // 验证逻辑
        async function doVerify() {
            const code = input.value.trim();
            if (!code) {
                showMsg('请输入激活码', 'error');
                shakeInput();
                return;
            }
            
            // 显示加载状态
            btn.disabled = true;
            btn.textContent = '验证中...';
            msg.textContent = '';
            msg.className = 'activation-message';
            
            try {
                // 获取设备指纹（简单版）
                const device = navigator.userAgent.substring(0, 200);
                
                const response = await fetch(VERIFY_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code, device: device })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMsg('✅ ' + (result.message || '激活成功！'), 'success');
                    saveActivation(code, result.qq);
                    
                    // 动画：卡片缩小消失
                    const card = overlay.querySelector('.activation-card');
                    card.style.transform = 'scale(0.8)';
                    card.style.opacity = '0';
                    overlay.style.opacity = '0';
                    
                    setTimeout(() => {
                        overlay.remove();
                        // 刷新页面以确保所有内容正常加载
                        // 如果不想刷新，可以注释掉下面这行
                        // location.reload();
                    }, 500);
                } else {
                    showMsg('❌ ' + (result.message || '激活码无效'), 'error');
                    shakeInput();
                    btn.disabled = false;
                    btn.textContent = '验 证';
                }
                
            } catch (error) {
                console.error('[激活码] 验证请求失败:', error);
                showMsg('❌ 网络错误，请检查服务器连接', 'error');
                btn.disabled = false;
                btn.textContent = '验 证';
            }
        }
        
        function showMsg(text, type) {
            msg.textContent = text;
            msg.className = 'activation-message ' + (type || '');
        }
        
        function shakeInput() {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    }
    
    // 确保 DOM 已加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountOverlay);
    } else {
        mountOverlay();
    }
    
})();


