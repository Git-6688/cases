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

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const usernameWrap = document.getElementById("usernameWrap");
    const passwordWrap = document.getElementById("passwordWrap");

    usernameWrap.classList.remove("error");
    passwordWrap.classList.remove("error");

    let ok = true;
    if (!username) {
        usernameWrap.classList.add("error");
        ok = false;
    }
    if (!password) {
        passwordWrap.classList.add("error");
        ok = false;
    }

    if (!ok) return;

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "登 录 中...";

    setTimeout(() => {
        window.location.href = "./devices.html";
    }, 800);
}

function handlePwdKey(event) {
    if (event.key === "Enter") {
        handleLogin(event);
    }
}
