const seedDevices = [
    { code: "DEV-001", name: "监控终端-01", type: "终端", ip: "192.168.1.10", status: "online", loc: "机房A-3号柜", lastTime: "2025-01-15 14:32:11" },
    { code: "DEV-002", name: "主服务器 Alpha", type: "服务器", ip: "192.168.1.20", status: "online", loc: "机房A-1号柜", lastTime: "2025-01-15 14:31:55" },
    { code: "DEV-003", name: "核心路由器", type: "路由器", ip: "192.168.1.1", status: "online", loc: "机房A-核心", lastTime: "2025-01-15 14:32:02" },
    { code: "DEV-004", name: "摄像头-前门", type: "摄像头", ip: "192.168.1.101", status: "online", loc: "大厅", lastTime: "2025-01-15 14:32:10" },
    { code: "DEV-005", name: "摄像头-后门", type: "摄像头", ip: "192.168.1.102", status: "offline", loc: "后门", lastTime: "2025-01-15 12:10:03" },
    { code: "DEV-006", name: "终端 办公区A", type: "终端", ip: "192.168.1.11", status: "online", loc: "办公区A", lastTime: "2025-01-15 14:30:44" },
    { code: "DEV-007", name: "服务器 Beta", type: "服务器", ip: "192.168.1.21", status: "error", loc: "机房B-1号柜", lastTime: "2025-01-15 10:22:18" },
    { code: "DEV-008", name: "终端 办公区B", type: "终端", ip: "192.168.1.12", status: "online", loc: "办公区B", lastTime: "2025-01-15 14:29:51" },
    { code: "DEV-009", name: "交换机 SW-01", type: "路由器", ip: "192.168.1.2", status: "online", loc: "机房A-核心", lastTime: "2025-01-15 14:32:05" },
    { code: "DEV-010", name: "摄像头-走廊", type: "摄像头", ip: "192.168.1.103", status: "online", loc: "二楼走廊", lastTime: "2025-01-15 14:32:08" },
    { code: "DEV-011", name: "终端 会议室", type: "终端", ip: "192.168.1.13", status: "offline", loc: "三楼会议室", lastTime: "2025-01-15 09:05:17" },
    { code: "DEV-012", name: "存储服务器", type: "服务器", ip: "192.168.1.22", status: "online", loc: "机房B-2号柜", lastTime: "2025-01-15 14:31:45" },
    { code: "DEV-013", name: "摄像头-停车场", type: "摄像头", ip: "192.168.1.104", status: "error", loc: "停车场入口", lastTime: "2025-01-14 23:45:22" },
    { code: "DEV-014", name: "终端 开发区", type: "终端", ip: "192.168.1.14", status: "online", loc: "开发部", lastTime: "2025-01-15 14:32:00" },
    { code: "DEV-015", name: "网关路由器", type: "路由器", ip: "192.168.1.3", status: "online", loc: "机房A-核心", lastTime: "2025-01-15 14:32:03" },
    { code: "DEV-016", name: "测试终端", type: "终端", ip: "192.168.1.15", status: "online", loc: "测试区", lastTime: "2025-01-15 14:20:10" },
    { code: "DEV-017", name: "备份服务器", type: "服务器", ip: "192.168.1.23", status: "online", loc: "机房B-3号柜", lastTime: "2025-01-15 14:31:30" },
    { code: "DEV-018", name: "摄像头-楼梯口", type: "摄像头", ip: "192.168.1.105", status: "online", loc: "一楼楼梯", lastTime: "2025-01-15 14:32:12" },
    { code: "DEV-019", name: "终端 前台", type: "终端", ip: "192.168.1.16", status: "offline", loc: "前台", lastTime: "2025-01-15 08:00:00" },
    { code: "DEV-020", name: "边缘计算节点", type: "服务器", ip: "192.168.1.24", status: "online", loc: "机房A-2号柜", lastTime: "2025-01-15 14:31:58" },
];

let devices = JSON.parse(JSON.stringify(seedDevices));
let currentPage = 1;
let editingIndex = -1;

const statusMap = {
    online: { text: "在线", cls: "success" },
    offline: { text: "离线", cls: "default" },
    error: { text: "异常", cls: "danger" }
};

function getFiltered() {
    const kw = document.getElementById("searchInput").value.trim().toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const type = document.getElementById("typeFilter").value;
    return devices.filter(d => {
        const matchKw = !kw || d.name.toLowerCase().includes(kw) || d.code.toLowerCase().includes(kw) || d.ip.includes(kw);
        const matchStatus = !status || d.status === status;
        const matchType = !type || d.type === type;
        return matchKw && matchStatus && matchType;
    });
}

function renderStats() {
    document.getElementById("stTotal").textContent = devices.length;
    document.getElementById("stOnline").textContent = devices.filter(d => d.status === "online").length;
    document.getElementById("stOffline").textContent = devices.filter(d => d.status === "offline").length;
    document.getElementById("stError").textContent = devices.filter(d => d.status === "error").length;
}

function renderTable() {
    const list = getFiltered();
    const pageSize = parseInt(document.getElementById("pageSize").value, 10);
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    document.getElementById("totalCount").textContent = list.length;
    document.getElementById("currentPage").textContent = currentPage;
    document.getElementById("totalPages").textContent = totalPages;

    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);

    const tbody = document.getElementById("deviceTableBody");
    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:60px 0;color:#86909c;">暂无设备数据</td></tr>`;
        return;
    }

    tbody.innerHTML = pageItems.map((d, i) => {
        const globalIdx = devices.indexOf(d);
        const s = statusMap[d.status];
        return `<tr>
            <td><input type="checkbox" class="row-check"></td>
            <td>${start + i + 1}</td>
            <td class="device-code">${d.code}</td>
            <td><strong>${d.name}</strong></td>
            <td><span class="tag tag-info">${d.type}</span></td>
            <td style="font-family:Consolas,monospace;color:#4e5969;font-size:13px;">${d.ip}</td>
            <td><span class="status-dot ${d.status}"></span><span class="tag tag-${s.cls}">${s.text}</span></td>
            <td>${d.loc}</td>
            <td style="color:#86909c;font-size:12px;">${d.lastTime}</td>
            <td>
                <div class="row-actions">
                    <button class="row-action" onclick="editDevice(${globalIdx})">编辑</button>
                    <button class="row-action" onclick="toggleStatus(${globalIdx})">切换</button>
                    <button class="row-action danger" onclick="deleteDevice(${globalIdx})">删除</button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function changePage(delta) {
    const list = getFiltered();
    const pageSize = parseInt(document.getElementById("pageSize").value, 10);
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    currentPage = Math.min(totalPages, Math.max(1, currentPage + delta));
    renderTable();
}

function toggleAll(cb) {
    document.querySelectorAll(".row-check").forEach(c => c.checked = cb.checked);
}

function addDevice() {
    editingIndex = -1;
    document.getElementById("modalTitle").textContent = "添加设备";
    document.getElementById("deviceForm").reset();
    document.getElementById("fCode").value = "DEV-" + String(devices.length + 1).padStart(3, "0");
    document.getElementById("deviceModal").style.display = "flex";
}

function editDevice(idx) {
    editingIndex = idx;
    const d = devices[idx];
    document.getElementById("modalTitle").textContent = "编辑设备";
    document.getElementById("fCode").value = d.code;
    document.getElementById("fName").value = d.name;
    document.getElementById("fType").value = d.type;
    document.getElementById("fIp").value = d.ip;
    document.getElementById("fLoc").value = d.loc;
    document.getElementById("fStatus").value = d.status;
    document.getElementById("deviceModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("deviceModal").style.display = "none";
}

function saveDevice(event) {
    event.preventDefault();
    const data = {
        code: document.getElementById("fCode").value.trim(),
        name: document.getElementById("fName").value.trim(),
        type: document.getElementById("fType").value,
        ip: document.getElementById("fIp").value.trim() || "-",
        loc: document.getElementById("fLoc").value.trim() || "-",
        status: document.getElementById("fStatus").value,
        lastTime: formatNow()
    };
    if (editingIndex >= 0) {
        devices[editingIndex] = data;
        showToast("设备已更新");
    } else {
        devices.unshift(data);
        currentPage = 1;
        showToast("设备已添加");
    }
    closeModal();
    renderStats();
    renderTable();
}

function deleteDevice(idx) {
    if (!confirm(`确定删除设备「${devices[idx].name}」吗？`)) return;
    devices.splice(idx, 1);
    renderStats();
    renderTable();
    showToast("删除成功");
}

function toggleStatus(idx) {
    const order = ["online", "offline", "error"];
    const cur = order.indexOf(devices[idx].status);
    devices[idx].status = order[(cur + 1) % order.length];
    devices[idx].lastTime = formatNow();
    renderStats();
    renderTable();
}

function refreshList() {
    devices.forEach(d => d.lastTime = formatNow());
    renderStats();
    renderTable();
    showToast("列表已刷新");
}

function logout() {
    if (confirm("确定退出登录？")) {
        window.location.href = "./index.html";
    }
}

function formatNow() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let toastTimer = null;
function showToast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

document.getElementById("searchInput").addEventListener("input", () => { currentPage = 1; renderTable(); });
document.getElementById("statusFilter").addEventListener("change", () => { currentPage = 1; renderTable(); });
document.getElementById("typeFilter").addEventListener("change", () => { currentPage = 1; renderTable(); });

renderStats();
renderTable();
