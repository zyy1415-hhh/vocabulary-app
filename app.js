// ===== 配置 =====
var BUILTIN = [];

// ===== 状态 =====
var words = loadWords();
var queue = [];
var qi = 0;
var sentIdx = 0;
var showingAnswer = false;
var doneToday = 0;
var typingMode = false;

// ===== 工具函数 =====
function mkW(w, p, m, s) {
    return {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        word: w.toLowerCase(),
        phonetic: p || "",
        meaning: m,
        sentences: s || [],
        level: 0,
        interval: 0,
        ease: 2.5,
        reps: 0,
        nextReview: today(),
        lastReview: null
    };
}

function today() {
    return new Date().toISOString().split("T")[0];
}

function loadWords() {
    var s = localStorage.getItem("vl_words");
    if (s) return JSON.parse(s);
    return BUILTIN.map(function (b) {
        return mkW(b.w, b.p, b.m, b.s);
    });
}

function saveWords() {
    localStorage.setItem("vl_words", JSON.stringify(words));
}

function getDue() {
    return words.filter(function (w) {
        return w.nextReview <= today();
    });
}

// SM-2 算法
function srs(w, rem) {
    if (rem) {
        w.reps += 1;
        if (w.reps === 1) w.interval = 1;
        else if (w.reps === 2) w.interval = 3;
        else w.interval = Math.round(w.interval * w.ease);
        w.ease = Math.max(1.3, w.ease + 0.1);
        w.level = Math.min(2, w.level + 1);
    } else {
        w.reps = 0;
        w.interval = 0;
        w.ease = Math.max(1.3, w.ease - 0.2);
        w.level = 0;
    }
    var d = new Date();
    d.setDate(d.getDate() + w.interval);
    w.nextReview = d.toISOString().split("T")[0];
    w.lastReview = today();
    return w;
}

function escH(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escJ(s) {
    return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ===== UI 更新 =====
function updateStats() {
    var due = getDue();
    document.getElementById("statTotal").textContent = words.length;
    document.getElementById("statDue").textContent = due.length;
    document.getElementById("statDone").textContent = doneToday;
    var b = document.getElementById("reviewBadge");
    if (due.length > 0) {
        b.style.display = "flex";
        b.textContent = due.length;
    } else {
        b.style.display = "none";
    }
    updateStreak();
}

function updateStreak() {
    var s = 0, base = new Date();
    for (var i = 0; i < 365; i++) {
        var d = new Date(base);
        d.setDate(d.getDate() - i);
        var ds = d.toISOString().split("T")[0];
        var log = JSON.parse(localStorage.getItem("vl_log_" + ds) || "[]");
        if (log.length > 0) s++;
        else if (i > 0) break;
    }
    document.getElementById("streakBadge").textContent = "🔥 " + s + "天";
}

// ===== 模式切换 =====
function switchMode() {
    typingMode = !typingMode;
    var btn = document.getElementById("toggleBtn");
    var labels = document.querySelectorAll(".mode-label");
    if (typingMode) {
        btn.classList.add("active");
        labels[0].textContent = "点选模式";
        labels[1].textContent = "打字模式 ✓";
    } else {
        btn.classList.remove("active");
        labels[0].textContent = "点选模式";
        labels[1].textContent = "打字模式";
    }
    if (queue.length > 0) {
        showingAnswer = false;
        renderCur();
    }
}

// ===== 卡片渲染 =====
function renderCard() {
    queue = getDue();
    qi = 0;
    sentIdx = 0;
    showingAnswer = false;
    document.getElementById("judgeRow").style.display = "none";
    document.getElementById("completeArea").innerHTML = "";
    if (queue.length === 0) {
        document.getElementById("cardArea").innerHTML = "";
        document.getElementById("completeArea").innerHTML =
            '<div class="complete fade-up"><div class="emo">🎉</div><h2>今天搞定啦！</h2><p>已完成 ' + doneToday + ' 个单词</p><button class="btn-rst" onclick="reviewAll()">🔄 复习全部词库</button></div>';
        updateProg();
        return;
    }
    renderCur();
}

function renderCur() {
    if (qi >= queue.length) {
        renderCard();
        return;
    }
    var w = queue[qi];
    var ts = w.sentences.length || 1;
    var area = document.getElementById("cardArea");

    if (!showingAnswer) {
        var blanked = w.sentences[sentIdx]
            ? w.sentences[sentIdx].replace(/\{\{(\w+)\}\}/gi, '<span class="blank">________</span>')
            : "";
        var dots = "";
        for (var i = 0; i < ts; i++) {
            dots += '<div class="s-dot' + (i === sentIdx ? ' act' : '') + '"></div>';
        }

        if (typingMode) {
            area.innerHTML =
                '<div class="card fade-up" onclick="event.stopPropagation()">' +
                    '<div class="card-deco">?</div>' +
                    '<div class="hint-label">⌨️ 打字模式 — 输入正确单词</div>' +
                    '<div class="sentence">' + blanked + '</div>' +
                    '<div class="typing-area">' +
                        '<input type="text" class="typing-input" id="typingInput" placeholder="输入单词..." autocomplete="off">' +
                        '<button class="typing-btn" onclick="checkTyping()">检查</button>' +
                    '</div>' +
                    '<div class="typing-feedback" id="typingFeedback"></div>' +
                    '<div class="hint-box">' +
                        '<div class="hl">意大利语提示</div>' +
                        '<div class="hm">' + escH(w.meaning) + '</div>' +
                    '</div>' +
                    (ts > 1 ? '<div class="sent-nav">' + dots + '<span class="s-nav-label">' + (sentIdx + 1) + '/' + ts + ' 例句</span></div>' : '') +
                    '<div class="tap-hint">💡 听发音：点击🔊按钮</div>' +
                '</div>';
            setTimeout(function () {
                var inp = document.getElementById("typingInput");
                if (inp) inp.focus();
            }, 100);
        } else {
            area.innerHTML =
                '<div class="card fade-up" onclick="flipCard()">' +
                    '<div class="card-deco">?</div>' +
                    '<div class="hint-label">🎯 根据提示猜单词</div>' +
                    '<div class="sentence">' + blanked + '</div>' +
                    '<div class="hint-box">' +
                        '<div class="hl">意大利语提示</div>' +
                        '<div class="hm">' + escH(w.meaning) + '</div>' +
                    '</div>' +
                    (ts > 1 ? '<div class="sent-nav">' + dots + '<span class="s-nav-label">' + (sentIdx + 1) + '/' + ts + ' 例句</span></div>' : '') +
                    '<div class="tap-hint">👆 点击查看答案</div>' +
                '</div>';
        }
    } else {
        var filled = w.sentences[sentIdx]
            ? w.sentences[sentIdx].replace(/\{\{(\w+)\}\}/gi, '<span class="filled">$1</span>')
            : "";
        var dots2 = "";
        for (var j = 0; j < ts; j++) {
            dots2 += '<div class="s-dot' + (j <= sentIdx ? ' act' : '') + '"></div>';
        }
        var nextBtn = (sentIdx + 1 < ts)
            ? '<button class="btn-next-sent" onclick="nextSent()">看下一句例句 →</button>'
            : "";
        area.innerHTML =
            '<div class="card fade-up">' +
                '<button class="speak-btn" onclick="event.stopPropagation();speak(\'' + escJ(w.word) + '\')">🔊</button>' +
                '<div class="aw">' + escH(w.word) + '</div>' +
                (w.phonetic ? '<div class="aph">' + escH(w.phonetic) + '</div>' : '') +
                '<div class="asent">' + filled + '</div>' +
                nextBtn +
                (ts > 1 ? '<div class="sent-nav">' + dots2 + '<span class="s-nav-label">' + (sentIdx + 1) + '/' + ts + ' 例句</span></div>' : '') +
                '<div class="amean">📖 ' + escH(w.meaning) + '</div>' +
            '</div>';
    }
    updateProg();
}

// ===== 打字检查 =====
function checkTyping() {
    var inp = document.getElementById("typingInput");
    var fb = document.getElementById("typingFeedback");
    if (!inp || !fb) return;
    var val = inp.value.trim().toLowerCase();
    var w = queue[qi];
    if (!val) return;
    if (val === w.word) {
        fb.className = "typing-feedback correct";
        fb.textContent = "✅ 正确！";
        setTimeout(function () {
            showingAnswer = true;
            renderCur();
        }, 800);
    } else {
        fb.className = "typing-feedback wrong";
        fb.textContent = "❌ 不对，正确答案是：" + w.word;
        inp.value = "";
        setTimeout(function () { if (inp) inp.focus(); }, 100);
    }
}

function flipCard() {
    if (!showingAnswer) {
        showingAnswer = true;
        renderCur();
        document.getElementById("judgeRow").style.display = "flex";
    }
}

function nextSent() {
    var w = queue[qi];
    if (sentIdx + 1 < (w.sentences.length || 0)) {
        sentIdx++;
        renderCur();
    }
}

function updateProg() {
    var total = Math.max(queue.length, 1);
    var pct = Math.round(qi / total * 100);
    document.getElementById("progFill").style.width = pct + "%";
    document.getElementById("progFrac").textContent = Math.min(qi + 1, total) + "/" + total;
}

function judge(rem) {
    var w = queue[qi];
    var wi = words.findIndex(function (x) { return x.id === w.id; });
    if (wi === -1) return;
    words[wi] = srs(words[wi], rem);
    saveWords();
    doneToday++;
    logToday(w.id);
    updateStats();
    var card = document.querySelector(".card");
    if (card) {
        card.classList.add(rem ? "slide-out-l" : "slide-out-r");
        setTimeout(function () {
            qi++;
            sentIdx = 0;
            showingAnswer = false;
            document.getElementById("judgeRow").style.display = "none";
            if (qi >= queue.length) renderCard();
            else renderCur();
        }, 180);
    }
}

function logToday(id) {
    var ds = today();
    var log = JSON.parse(localStorage.getItem("vl_log_" + ds) || "[]");
    log.push({ id: id });
    localStorage.setItem("vl_log_" + ds, JSON.stringify(log));
}

function reviewAll() {
    words.forEach(function (w) { w.nextReview = today(); });
    saveWords();
    updateStats();
    renderCard();
}

// ===== 页面导航 =====
function goPage(name, btn) {
    document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); });
    document.getElementById("page" + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
    if (btn) btn.classList.add("active");
    if (name === "card") renderCard();
    if (name === "list") renderList();
    if (name === "review") renderReview();
}

function renderList() {
    var area = document.getElementById("listArea");
    if (words.length === 0) {
        area.innerHTML = '<div class="empty"><div class="ic">📖</div>还没有单词，快去添加吧</div>';
        return;
    }
    var h = "";
    words.forEach(function (w) {
        var lv = ["<span class='wl-lv lv-0'>新词</span>", "<span class='wl-lv lv-1'>学习中</span>", "<span class='wl-lv lv-2'>已掌握</span>"][w.level];
        h += '<div class="wl-item fade-up"><div><span class="wl-word">' + escH(w.word) + '</span>' +
            (w.phonetic ? '<span class="wl-ph">' + escH(w.phonetic) + '</span>' : '') +
            '<div class="wl-mean">' + escH(w.meaning) + '</div></div>' +
            '<div class="wl-right">' + lv +
            '<button class="wl-del" onclick="delWord(' + w.id + ')">✕</button></div></div>';
    });
    area.innerHTML = h;
}

function delWord(id) {
    if (!confirm("确定删除？")) return;
    words = words.filter(function (w) { return w.id !== id; });
    saveWords();
    updateStats();
    renderList();
}

// ===== 添加单词 =====
function showAdd() {
    document.getElementById("addModal").classList.add("show");
    document.getElementById("inpWord").focus();
}

function hideAdd() {
    document.getElementById("addModal").classList.remove("show");
    ["inpWord", "inpPhonetic", "inpMeaning", "inpSent1", "inpSent2"].forEach(function (id) {
        document.getElementById(id).value = "";
    });
}

function submitAdd() {
    var w = document.getElementById("inpWord").value.trim().toLowerCase();
    var p = document.getElementById("inpPhonetic").value.trim();
    var m = document.getElementById("inpMeaning").value.trim();
    var s1 = document.getElementById("inpSent1").value.trim();
    var s2 = document.getElementById("inpSent2").value.trim();
    if (!w || !m || !s1) {
        alert("请至少填写单词、释义和例句");
        return;
    }
    function fix(s) {
        if (s && !s.includes("{{")) s = s.replace(new RegExp("\\b" + escRe(w) + "\\b", "i"), "{{" + w + "}}");
        return s;
    }
    var sa = [];
    if (s1) sa.push(fix(s1));
    if (s2) sa.push(fix(s2));
    words.push(mkW(w, p, m, sa));
    saveWords();
    updateStats();
    hideAdd();
    renderList();
    goPage("list", document.querySelectorAll(".nav-item")[2]);
}

// ===== 导入单词 =====
function showImport() {
    document.getElementById("importModal").classList.add("show");
    document.getElementById("importArea").focus();
    document.getElementById("importMsg").className = "import-msg";
    document.getElementById("importArea").value = "";
}

function hideImport() {
    document.getElementById("importModal").classList.remove("show");
}

function doImport() {
    var raw = document.getElementById("importArea").value.trim();
    var msg = document.getElementById("importMsg");
    if (!raw) {
        msg.className = "import-msg err";
        msg.textContent = "请粘贴单词数据";
        return;
    }
    var lines = raw.split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    var count = 0, errs = [];
    lines.forEach(function (line, li) {
        var parts = line.split("|").map(function (p) { return p.trim(); }).filter(function (p) { return p; });
        if (parts.length < 3) {
            errs.push("第" + (li + 1) + "行格式不正确");
            return;
        }
        var w = parts[0].toLowerCase(), m = parts[1], sa = [];
        for (var i = 2; i < parts.length; i++) {
            var s = parts[i];
            if (s && !s.includes("{{")) s = s.replace(new RegExp("\\b" + escRe(w) + "\\b", "i"), "{{" + w + "}}");
            if (s) sa.push(s);
        }
        if (!w || !m || sa.length === 0) {
            errs.push("第" + (li + 1) + "行缺少必要信息");
            return;
        }
        words.push(mkW(w, "", m, sa));
        count++;
    });
    saveWords();
    updateStats();
    if (errs.length > 0) {
        msg.className = "import-msg err";
        msg.textContent = "成功导入 " + count + " 个，失败 " + errs.length + " 个。" + (errs[0] || "");
    } else {
        msg.className = "import-msg ok";
        msg.textContent = "✅ 成功导入 " + count + " 个单词！";
        setTimeout(function () {
            hideImport();
            renderList();
            goPage("list", document.querySelectorAll(".nav-item")[2]);
        }, 800);
    }
}

// ===== 复习页面 =====
function renderReview() {
    document.getElementById("reviewNum").textContent = getDue().length;
    renderCal();
}

function renderCal() {
    var area = document.getElementById("calArea");
    var dns = ["日", "一", "二", "三", "四", "五", "六"];
    var base = new Date();
    var h = '<div class="cal-title">📅 学习记录</div><div class="cal-grid">';
    dns.forEach(function (d) {
        h += '<div class="cal-hdr">' + d + '</div>';
    });
    for (var i = 27; i >= 0; i--) {
        var d = new Date(base);
        d.setDate(d.getDate() - i);
        var ds = d.toISOString().split("T")[0];
        var log = JSON.parse(localStorage.getItem("vl_log_" + ds) || "[]");
        var cls = "cal-day" + (log.length > 0 ? " done" : "") + (ds === today() ? " today" : "");
        h += '<div class="' + cls + '">' + d.getDate() + '</div>';
    }
    h += '</div>';
    area.innerHTML = h;
}

function startReview() {
    goPage("card", document.querySelectorAll(".nav-item")[0]);
}

// ===== 语音朗读 =====
function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.82;
    window.speechSynthesis.speak(u);
}

// ===== 键盘快捷键 =====
document.addEventListener("keydown", function (e) {
    if (document.getElementById("addModal").classList.contains("show")) {
        if (e.key === "Escape") hideAdd();
        if (e.key === "Enter" && e.ctrlKey) submitAdd();
        return;
    }
    if (document.getElementById("importModal").classList.contains("show")) {
        if (e.key === "Escape") hideImport();
        return;
    }
    if (typingMode && document.getElementById("typingInput")) {
        if (e.key === "Enter") {
            e.preventDefault();
            checkTyping();
        }
        return;
    }
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!showingAnswer) flipCard();
    }
    if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); judge(false); }
    if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); judge(true); }
    if (e.key === "n" && showingAnswer) nextSent();
});

// ===== 启动 =====
updateStats();
renderCard();
