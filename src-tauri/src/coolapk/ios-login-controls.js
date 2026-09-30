// iOS 没有桌面窗口标题栏，在官方登录页提供返回入口。
(function () {
    if (window.top !== window || !/^https:$/.test(location.protocol)) return;
    if (!['account.coolapk.com', 'www.coolapk.com', 'm.coolapk.com', 'coolapk.com'].includes(location.hostname)) return;

    function mountReturnButton() {
        if (!document.documentElement || document.getElementById('coolapk-ios-login-return')) return;
        var host = document.createElement('div');
        host.id = 'coolapk-ios-login-return';
        host.style.cssText = 'all:initial!important;position:fixed!important;top:calc(env(safe-area-inset-top, 0px) + 8px)!important;right:calc(env(safe-area-inset-right, 0px) + 8px)!important;z-index:2147483647!important;';
        // 隔离官网样式，保证按钮尺寸和点击范围，不覆盖整张登录表单。
        var root = host.attachShadow({ mode: 'closed' });
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = '返回应用';
        button.setAttribute('aria-label', '同步登录凭据并返回应用');
        button.style.cssText = 'border:1px solid #ccc;border-radius:8px;background:#fff;color:#222;padding:10px 14px;font:14px system-ui;cursor:pointer;';
        button.addEventListener('click', function () {
            button.disabled = true;
            button.textContent = '正在返回…';
            // 不开放远程 IPC；原生导航回调拦截标记，先校验 Cookie 再关闭窗口。
            location.href = 'coolapk-login://return';
            setTimeout(function () { button.disabled = false; button.textContent = '返回应用'; }, 8000);
        });
        root.appendChild(button);
        document.documentElement.appendChild(host);
    }

    mountReturnButton();
    document.addEventListener('DOMContentLoaded', mountReturnButton);
    new MutationObserver(mountReturnButton).observe(document, { childList: true, subtree: true });
})();
