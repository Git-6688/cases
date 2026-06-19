function wrapFocus(id, focused) {
    const el = document.getElementById(id);
    if (el) {
        if (focused) el.classList.add("focused");
        else el.classList.remove("focused");
    }
}

function togglePassword() {
    const input = document.getElementById("password");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
}

function skipLogin() {
    window.location.href = "./devices.html";
}

const CORRECT_USER = "admin";
const CORRECT_PASS = "Aa223366";

function showFieldError(wrapId) {
    const wrap = document.getElementById(wrapId);
    wrap.classList.add("error");
    setTimeout(() => wrap.classList.remove("error"), 2200);
}

function showTip(msg) {
    let tip = document.getElementById("loginTip");
    if (!tip) {
        tip = document.createElement("div");
        tip.id = "loginTip";
        tip.style.cssText = "color:#ff6e5ae6;font-size:12px;text-align:center;margin-top:10px;letter-spacing:1px;";
        document.querySelector(".login-form").appendChild(tip);
    }
    tip.textContent = msg;
    clearTimeout(tip._t);
    tip._t = setTimeout(() => (tip.textContent = ""), 2400);
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const usernameWrap = document.getElementById("usernameWrap");
    const passwordWrap = document.getElementById("passwordWrap");

    usernameWrap.classList.remove("error");
    passwordWrap.classList.remove("error");

    if (!username) { showFieldError("usernameWrap"); return; }
    if (!password) { showFieldError("passwordWrap"); return; }

    if (username !== CORRECT_USER || password !== CORRECT_PASS) {
        showFieldError("usernameWrap");
        showFieldError("passwordWrap");
        showTip("账号或密码错误，请使用 admin / admin");
        return;
    }

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "登 录 中...";

    setTimeout(() => {
        window.location.href = "./devices.html";
    }, 600);
}

function handlePwdKey(event) {
    if (event.key === "Enter") {
        handleLogin(event);
    }
}
