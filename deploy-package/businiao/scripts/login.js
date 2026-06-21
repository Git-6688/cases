/* =========================================================
   不死鸟 · 登录逻辑
   ========================================================= */
const CORRECT_USER = "admin";
const CORRECT_PASS = "Aa223366";

function wrapFocus(id, focused) {
    const el = document.getElementById(id);
    if (el) {
        if (focused) el.classList.add("focused");
        else el.classList.remove("focused");
    }
}

function togglePassword() {
    const input = document.getElementById("password");
    const icon = document.getElementById("eyeIcon");
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        if (icon) icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    } else {
        input.type = "password";
        if (icon) icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    }
}

function skipLogin() {
    window.location.href = "./devices.html";
}

function showFieldError(wrapId) {
    const wrap = document.getElementById(wrapId);
    wrap.classList.add("error");
    setTimeout(() => wrap.classList.remove("error"), 2200);
}

function showTip(msg, isError) {
    const tip = document.getElementById("loginTip");
    if (!tip) return;
    tip.textContent = msg;
    tip.style.color = isError ? "rgba(252, 165, 165, 0.95)" : "rgba(187, 247, 208, 0.95)";
    clearTimeout(tip._t);
    tip._t = setTimeout(() => (tip.textContent = ""), 2800);
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username) { showFieldError("usernameWrap"); return; }
    if (!password) { showFieldError("passwordWrap"); return; }

    if (username !== CORRECT_USER || password !== CORRECT_PASS) {
        showFieldError("usernameWrap");
        showFieldError("passwordWrap");
        showTip("账号或密码错误，请使用 admin / Aa223366", true);
        return;
    }

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10" style="opacity: 0.25;"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> &nbsp;登 录 中...';

    try {
        sessionStorage.setItem("bushi_auth", "1");
        sessionStorage.setItem("bushi_user", username);
        sessionStorage.setItem("bushi_login_at", new Date().toISOString());
    } catch (e) {}

    setTimeout(() => {
        window.location.href = "./devices.html";
    }, 650);
}

function handlePwdKey(event) {
    if (event.key === "Enter") handleLogin(event);
}

/* 自动填充演示 */
window.addEventListener("DOMContentLoaded", () => {
    const demoHint = document.getElementById("loginTip");
    if (demoHint) {
        demoHint.textContent = "演示账号: admin / Aa223366";
        demoHint.style.color = "rgba(230, 175, 55, 0.75)";
    }
});
