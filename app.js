/* LinguaVerse · 多语种学习平台 · 主应用 */

/* ============ 工具函数 ============ */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const LS_KEYS = {
  users: 'lv_users',
  session: 'lv_session',
  userdata: 'lv_userdata',     // 各用户数据
  posts: 'lv_posts'
};

const readJSON = (key, def) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; }
  catch (e) { return def; }
};
const writeJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const toast = (msg, type='info') => {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast toast-' + type;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
};

/* ============ 状态管理 ============ */
const state = {
  currentUser: null,
  data: {},      // 已登录用户的学习数据
  posts: []
};

function loadSession() {
  const sid = localStorage.getItem(LS_KEYS.session);
  if (sid) {
    const users = readJSON(LS_KEYS.users, {});
    if (users[sid]) {
      state.currentUser = { username: sid, ...users[sid] };
      state.data = readJSON(LS_KEYS.userdata + ':' + sid, makeDefaultUserData(sid));
    }
  }
  state.posts = readJSON(LS_KEYS.posts, SEED_POSTS.map(p => ({...p})));
  ensureUserData();
}

function makeDefaultUserData(username) {
  return {
    username,
    createdAt: Date.now(),
    preferredLang: 'en',
    streak: 0,
    lastLearnDate: null,
    totalMinutes: 0,
    stats: { words:0, grammar:0, speaking:0, listening:0, posts:0 },
    learnedLangs: [],   // 已学习过的语言
    completedUnits: [], // topic 字符串
    masteredWords: {},   // topic -> [wordIdx]
    grammarHistory: [], // {lang,correct,total}
    speakingHistory: [],
    listeningHistory: [],
    achievements: []
  };
}

function ensureUserData() {
  if (state.currentUser && !state.data.username) {
    state.data = makeDefaultUserData(state.currentUser.username);
  }
}

function saveData() {
  if (state.currentUser) {
    writeJSON(LS_KEYS.userdata + ':' + state.currentUser.username, state.data);
  }
}

function checkAchievements() {
  const user = state.data;
  if (!user) return [];
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!user.achievements.includes(a.id) && a.need(user)) {
      user.achievements.push(a.id);
      newly.push(a);
    }
  }
  if (newly.length) saveData();
  return newly;
}

function registerStreak() {
  const today = new Date().toISOString().slice(0,10);
  if (state.data.lastLearnDate !== today) {
    const ytd = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    state.data.streak = (state.data.lastLearnDate === ytd) ? (state.data.streak || 0) + 1 : 1;
    state.data.lastLearnDate = today;
    saveData();
  }
}

function recordLang(lang) {
  if (state.data && !state.data.learnedLangs.includes(lang)) {
    state.data.learnedLangs.push(lang);
    saveData();
  }
}

/* ============ 路由 ============ */
function navigate(hash) {
  location.hash = hash;
}

function parseHash() {
  const h = (location.hash || '#/').slice(1);
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = {};
  if (query) {
    query.split('&').forEach(pair => {
      const [k,v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { parts, params };
}

function route() {
  renderNav();
  const { parts, params } = parseHash();
  const app = $('#app');
  app.innerHTML = '';

  const page = parts[0] || 'home';
  switch (page) {
    case 'home':      renderHome(app); break;
    case 'languages': renderLanguages(app); break;
    case 'learn':     renderLearnRoot(app, parts.slice(1), params); break;
    case 'progress':  renderProgress(app); break;
    case 'community': renderCommunity(app); break;
    case 'achievements': renderAchievements(app); break;
    case 'login':     renderLogin(app, params); break;
    case 'profile':   renderProfile(app); break;
    default:          renderHome(app);
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ============ 顶部导航 ============ */
function renderNav() {
  const nav = $('#navLinks');
  const user = $('#navUser');

  nav.innerHTML = `
    <a class="nav-link" href="#/home">首页</a>
    <a class="nav-link" href="#/languages">语言中心</a>
    <a class="nav-link" href="#/progress">学习进度</a>
    <a class="nav-link" href="#/achievements">成就徽章</a>
    <a class="nav-link" href="#/community">社区</a>
  `;

  if (state.currentUser) {
    user.innerHTML = `
      <div class="user-box">
        <span class="avatar">${state.currentUser.username.slice(0,1).toUpperCase()}</span>
        <span class="username">${state.currentUser.username}</span>
        <a class="btn-text" href="#/profile">个人中心</a>
        <button class="btn-text" id="btnLogout">退出</button>
      </div>
    `;
    $('#btnLogout').onclick = () => {
      localStorage.removeItem(LS_KEYS.session);
      state.currentUser = null;
      state.data = {};
      toast('已退出登录', 'info');
      navigate('/home');
    };
  } else {
    user.innerHTML = `<a class="btn-primary" href="#/login">登录 / 注册</a>`;
  }
}

/* ============ 首页 ============ */
function renderHome(app) {
  const user = state.currentUser;
  const welcome = user
    ? `<h1>欢迎回来，${user.username} 👋</h1><p class="lead">继续你的沉浸式多语种学习之旅</p>`
    : `<h1>LinguaVerse · 多语种学习平台</h1><p class="lead">英语 · 日本語 · 한국어 —— 一站式沉浸式学习</p>`;

  // 个性化推荐
  const recommendCards = [];
  if (user) {
    const data = state.data;
    const prefLang = data.preferredLang || 'en';
    const next = findNextTopic(prefLang);
    recommendCards.push({
      tag: '为你推荐', color: LANG_META[prefLang].color,
      title: `继续 ${LANG_META[prefLang].nativeName} ${next.level} · ${next.unit.title}`,
      desc: '根据你的学习进度，我们为你推荐了接下来的单元。',
      action: '开始学习', href: `#/learn/${prefLang}/unit?topic=${next.unit.topic}&level=${encodeURIComponent(next.level)}`
    });
    // 薄弱项
    if (data.stats.grammar < data.stats.words) {
      recommendCards.push({
        tag: '重点加强', color:'#8b5cf6', title:'语法练习，巩固你的薄弱项',
        desc:'根据数据分析，建议你多练习语法题。',
        action:'开始练习', href:`#/learn/${prefLang}/grammar`
      });
    }
    recommendCards.push({
      tag:'挑战一下', color:'#10b981', title:'完成听力训练，获得更多积分',
      desc:'每日听力训练能显著提高理解能力。',
      action:'开始挑战', href:`#/learn/${prefLang}/listening`
    });
  } else {
    recommendCards.push(
      { tag:'欢迎', color:'#3b82f6', title:'免费注册，开启个性化学习', desc:'立即创建账户，跟踪进度、获得成就徽章。', action:'注册账号', href:'#/login' },
      { tag:'语言', color:'#ef4444', title:'英语 · 日语 · 韩语', desc:'从入门到高级，分级课程体系，循序渐进。', action:'浏览语言', href:'#/languages' },
      { tag:'社区', color:'#f59e0b', title:'加入学习者社区', desc:'与全球同学交流学习心得、分享经验。', action:'进入社区', href:'#/community' }
    );
  }

  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">${welcome}
        <div class="hero-actions">
          <a class="btn-primary lg" href="#/languages">浏览语言课程 →</a>
          ${user ? `<a class="btn-ghost lg" href="#/progress">查看我的进度</a>` : `<a class="btn-ghost lg" href="#/login">立即注册</a>`}
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><span class="big">${3}</span><span>主流语言</span></div>
        <div class="hero-stat"><span class="big">${Object.keys(WORDS).length}</span><span>学习单元</span></div>
        <div class="hero-stat"><span class="big">${ACHIEVEMENTS.length}</span><span>成就徽章</span></div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">✨ 推荐学习</h2>
      <div class="grid-3">
        ${recommendCards.map(c => card(c)).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">🎯 四大学习模块</h2>
      <div class="grid-4">
        ${[
          { icon:'📖', title:'单词记忆', desc:'卡片式学习、智能复习，高效掌握核心词汇。' },
          { icon:'✍️', title:'语法练习', desc:'分级语法题、即时解析，告别死记硬背。' },
          { icon:'🎤', title:'口语跟读', desc:'标准短句跟读训练，自信开口说外语。' },
          { icon:'🎧', title:'听力训练', desc:'真实情景对话，循序渐进提升听力水平。' }
        ].map(i => `<div class="feature-card"><div class="feature-icon">${i.icon}</div><h3>${i.title}</h3><p>${i.desc}</p></div>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">🌐 立即选择你的语言</h2>
      <div class="grid-3">
        ${Object.values(LANG_META).map(l => card({
          tag:l.levels[0], color:l.color,
          title:`${l.flag} ${l.name} · ${l.nativeName}`,
          desc:l.description,
          action:'开始学习',
          href:`#/learn/${l.id}`
        })).join('')}
      </div>
    </section>
  `;
}

function card(c) {
  return `<a class="card card-link" href="${c.href}" style="border-color:${c.color}30">
    <div class="card-tag" style="background:${c.color}">${c.tag}</div>
    <h3>${c.title}</h3>
    <p>${c.desc}</p>
    <div class="card-action">${c.action} →</div>
  </a>`;
}

/* ============ 语言中心 ============ */
function renderLanguages(app) {
  app.innerHTML = `
    <section class="section">
      <h2 class="section-title">🌐 语言中心</h2>
      <p class="section-sub">选择你最想学习的语言，立即进入分级课程体系。</p>
      <div class="grid-3">
        ${Object.values(LANG_META).map(l => `
          <div class="card card-lg" style="border-color:${l.color}30; border-top:4px solid ${l.color};">
            <div class="lang-flag">${l.flag}</div>
            <h3 style="color:${l.color}">${l.name} · ${l.nativeName}</h3>
            <p>${l.description}</p>
            <div class="meta"><span>难度：${l.difficulty}</span><span>共 ${CURRICULUM[l.id].reduce((s,x)=>s+x.units.length,0)} 个单元</span></div>
            <div class="levels">
              ${l.levels.map(x=>`<span class="level-chip">${x}</span>`).join('')}
            </div>
            <div style="margin-top:16px;"><a class="btn-primary" href="#/learn/${l.id}">开始学习</a></div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

/* ============ 学习入口（/learn/:lang 及子模块） ============ */
function renderLearnRoot(app, parts, params) {
  const lang = parts[0] || 'en';
  if (!LANG_META[lang]) { navigate('/languages'); return; }

  if (state.currentUser) recordLang(lang);

  const sub = parts[1] || 'overview';
  if (sub === 'overview' || sub === '') { renderLearnOverview(app, lang, params); return; }
  if (sub === 'unit')    { renderWordUnit(app, lang, params); return; }
  if (sub === 'grammar') { renderGrammar(app, lang, params); return; }
  if (sub === 'speaking'){ renderSpeaking(app, lang, params); return; }
  if (sub === 'listening') { renderListening(app, lang, params); return; }
  renderLearnOverview(app, lang, params);
}

function renderLearnOverview(app, lang, params) {
  const meta = LANG_META[lang];
  const data = state.currentUser ? state.data : null;
  const cur = CURRICULUM[lang];

  // 完成率
  const totalUnits = cur.reduce((s,lv)=>s+lv.units.length,0);
  const doneUnits = data ? cur.reduce((s,lv)=>s+lv.units.filter(u=>data.completedUnits.includes(u.topic)).length,0) : 0;
  const pct = totalUnits ? Math.round(doneUnits*100/totalUnits) : 0;

  // 推荐下一单元
  const next = findNextTopic(lang);

  app.innerHTML = `
    <section class="section" style="max-width:1100px;margin:0 auto;">
      <div class="lang-hero" style="background:linear-gradient(135deg, ${meta.color}15, ${meta.color}05); border-left:6px solid ${meta.color};">
        <div>
          <div class="breadcrumbs"><a href="#/languages">语言中心</a> / ${meta.name}</div>
          <h1 class="lang-title">${meta.flag} ${meta.name} · ${meta.nativeName}</h1>
          <p class="section-sub">${meta.description}</p>
          ${data ? `<div class="progress-row">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${meta.color}"></div></div>
            <span class="progress-text">进度 ${doneUnits}/${totalUnits} 单元 · ${pct}%</span>
          </div>` : `<p class="muted"><a href="#/login">登录</a>后可记录学习进度</p>`}
        </div>
        <div class="lang-stats">
          <div><div class="big">${cur.length}</div><div>级别</div></div>
          <div><div class="big">${totalUnits}</div><div>单元</div></div>
          <div><div class="big">${cur.reduce((s,x)=>s+x.units.reduce((a,u)=>a+(WORDS[u.topic]?.length||0),0),0)}</div><div>单词</div></div>
        </div>
      </div>

      <div class="module-grid">
        <a class="module-card" href="#/learn/${lang}/unit?topic=${next.unit.topic}&level=${encodeURIComponent(next.level)}" style="border-color:${meta.color}40">
          <div class="module-icon" style="background:${meta.color}">📖</div>
          <h3>继续：${next.unit.title}</h3>
          <p class="muted">级别：${next.level} · ${next.unit.words} 个核心单词 · ${next.unit.duration} 分钟</p>
          <div class="module-cta">开始学习 →</div>
        </a>
        <a class="module-card" href="#/learn/${lang}/grammar" style="border-color:#8b5cf640">
          <div class="module-icon" style="background:#8b5cf6">✍️</div>
          <h3>语法练习</h3>
          <p class="muted">选择正确答案，获得即时解析。</p>
          <div class="module-cta">开始练习 →</div>
        </a>
        <a class="module-card" href="#/learn/${lang}/speaking" style="border-color:#ec489940">
          <div class="module-icon" style="background:#ec4899">🎤</div>
          <h3>口语跟读</h3>
          <p class="muted">经典短句跟读训练，大声开口说！</p>
          <div class="module-cta">开始练习 →</div>
        </a>
        <a class="module-card" href="#/learn/${lang}/listening" style="border-color:#10b98140">
          <div class="module-icon" style="background:#10b981">🎧</div>
          <h3>听力训练</h3>
          <p class="muted">真实情景对话，训练你的耳朵。</p>
          <div class="module-cta">开始挑战 →</div>
        </a>
      </div>

      <h2 class="section-title">📚 分级课程体系</h2>
      ${cur.map((lv, i) => `
        <div class="level-block" style="border-left:4px solid ${meta.color}">
          <div class="level-header">
            <h3>Level ${i+1} · ${lv.level}</h3>
            <span class="muted">${lv.desc}</span>
          </div>
          <div class="unit-grid">
            ${lv.units.map((u, idx) => {
              const done = data && data.completedUnits.includes(u.topic);
              return `<a class="unit-card" href="#/learn/${lang}/unit?topic=${u.topic}&level=${encodeURIComponent(lv.level)}">
                <div class="unit-num">${idx+1}</div>
                <div class="unit-info">
                  <div class="unit-title">${u.title} ${done ? '<span class="badge-done">已完成 ✓</span>' : ''}</div>
                  <div class="unit-meta muted">${u.words} 词 · ${u.duration} 分钟</div>
                </div>
              </a>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function findNextTopic(lang) {
  const cur = CURRICULUM[lang];
  const done = state.data.completedUnits || [];
  for (const lv of cur) {
    for (const u of lv.units) {
      if (!done.includes(u.topic)) return { level: lv.level, unit: u };
    }
  }
  return { level: cur[0].level, unit: cur[0].units[0] };
}

/* ============ 单词单元（卡片学习） ============ */
function renderWordUnit(app, lang, params) {
  const topic = params.topic;
  const level = params.level || '';
  const words = WORDS[topic] || [];
  if (!words.length) { navigate('/learn/' + lang); return; }

  const meta = LANG_META[lang];
  const idx = 0;

  app.innerHTML = `
    <section class="section" style="max-width:900px;margin:0 auto;">
      <div class="breadcrumbs"><a href="#/learn/${lang}">${meta.nativeName}</a> / 单词学习</div>
      <h2 class="section-title" style="text-align:left">${level} · ${topic}（共 ${words.length} 词）</h2>

      <div class="word-progress"><div id="wordProgressBar" class="word-progress-bar" style="width:0%"></div></div>
      <div class="word-progress-info"><span id="wordProgressInfo">1 / ${words.length}</span><span id="wordMastered">已掌握 0</span></div>

      <div id="cardContainer" class="card-container">
        <div class="flash-card" id="flashCard">
          <div class="flash-face front">
            <div class="flash-hint">点击卡片查看释义 →</div>
            <div class="flash-word" id="wordFront">${words[0].word}</div>
            <div class="flash-example" id="wordExample">"${words[0].example}"</div>
          </div>
          <div class="flash-face back">
            <div class="flash-hint">释义</div>
            <div class="flash-word">${words[0].meaning}</div>
            <div class="flash-example">${words[0].word} · "${words[0].example}"</div>
          </div>
        </div>
      </div>

      <div class="word-actions">
        <button class="btn-ghost" id="btnPrev">← 上一词</button>
        <button class="btn-ghost" id="btnSpeak">🔊 朗读</button>
        <button class="btn-primary" id="btnKnow">✓ 已掌握</button>
        <button class="btn-primary" id="btnNext">下一词 →</button>
      </div>

      <div class="unit-complete" id="unitComplete" style="display:none">
        <h3>🎉 学习完成！</h3>
        <p>你已浏览完本单元所有单词，可以复习或进入下一模块。</p>
        <div class="hero-actions">
          <button class="btn-primary" id="btnFinishUnit">✓ 标记本单元完成</button>
          <a class="btn-ghost" href="#/learn/${lang}/grammar">继续：语法练习</a>
          <a class="btn-ghost" href="#/learn/${lang}">返回语言主页</a>
        </div>
      </div>
    </section>
  `;

  let curIdx = 0;
  const mastered = new Set(state.data.masteredWords[topic] || []);
  const card = $('#flashCard');
  const frontWord = $('#wordFront');
  const frontExample = $('#wordExample');
  const backWord = card.querySelector('.back .flash-word');
  const backExample = card.querySelector('.back .flash-example');

  function updateCard() {
    frontWord.textContent = words[curIdx].word;
    frontExample.textContent = '"' + words[curIdx].example + '"';
    backWord.textContent = words[curIdx].meaning;
    backExample.textContent = words[curIdx].word + ' · "' + words[curIdx].example + '"';
    card.classList.remove('flipped');
    $('#wordProgressBar').style.width = ((curIdx+1)/words.length*100) + '%';
    $('#wordProgressInfo').textContent = `${curIdx+1} / ${words.length}`;
    $('#wordMastered').textContent = `已掌握 ${mastered.size}`;
  }

  card.onclick = () => card.classList.toggle('flipped');
  $('#btnPrev').onclick = () => { curIdx = (curIdx - 1 + words.length) % words.length; updateCard(); };
  $('#btnNext').onclick = () => {
    curIdx = (curIdx + 1) % words.length;
    if (curIdx === 0) $('#unitComplete').style.display = 'block';
    updateCard();
  };
  $('#btnKnow').onclick = () => {
    mastered.add(curIdx);
    if (state.currentUser) {
      state.data.masteredWords[topic] = [...mastered];
      state.data.stats.words = Object.values(state.data.masteredWords).reduce((s,a)=>s+a.length,0);
      registerStreak();
      saveData();
      checkAchievements().forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
    } else {
      toast('登录后可永久保存学习记录', 'info');
    }
    toast('已标记为掌握 ✓', 'success');
    updateCard();
  };
  $('#btnSpeak').onclick = () => speakText(words[curIdx].word, lang);

  $('#btnFinishUnit').onclick = () => {
    if (!state.currentUser) { toast('请先登录以保存进度', 'info'); navigate('/login'); return; }
    if (!state.data.completedUnits.includes(topic)) state.data.completedUnits.push(topic);
    state.data.stats.words = Object.values(state.data.masteredWords).reduce((s,a)=>s+a.length,0);
    state.data.totalMinutes += 15;
    registerStreak();
    saveData();
    const newA = checkAchievements();
    newA.forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
    toast('单元已完成，真棒！', 'success');
    navigate('/learn/' + lang);
  };

  updateCard();
}

/* ============ 语法练习 ============ */
function renderGrammar(app, lang, params) {
  const list = GRAMMAR[lang] || [];
  const meta = LANG_META[lang];
  if (!list.length) { app.innerHTML = `<p class="muted">暂无语法题。</p>`; return; }

  app.innerHTML = `
    <section class="section" style="max-width:800px;margin:0 auto;">
      <div class="breadcrumbs"><a href="#/learn/${lang}">${meta.nativeName}</a> / 语法练习</div>
      <h2 class="section-title" style="text-align:left">✍️ 语法练习 · ${meta.nativeName}</h2>
      <p class="section-sub">选择你认为正确的选项，完成后查看解析。</p>

      <div id="quizArea" class="quiz-area"></div>
    </section>
  `;

  let curIdx = 0, correct = 0;
  const area = $('#quizArea');

  function renderQ() {
    if (curIdx >= list.length) {
      if (state.currentUser) {
        state.data.stats.grammar += list.length;
        state.data.grammarHistory.push({ lang, correct, total: list.length, at: Date.now() });
        registerStreak();
        saveData();
        checkAchievements().forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
      }
      area.innerHTML = `
        <div class="quiz-summary card">
          <h3>🎉 本轮练习完成！</h3>
          <p>你答对了 <strong>${correct}/${list.length}</strong> 题，正确率 <strong>${Math.round(correct/list.length*100)}%</strong></p>
          <div class="hero-actions">
            <button class="btn-primary" id="btnAgain">再来一轮</button>
            <a class="btn-ghost" href="#/learn/${lang}">返回语言主页</a>
          </div>
        </div>
      `;
      $('#btnAgain').onclick = () => { curIdx=0; correct=0; renderQ(); };
      return;
    }
    const q = list[curIdx];
    area.innerHTML = `
      <div class="quiz-progress">题目 ${curIdx+1} / ${list.length} · 已答对 ${correct}</div>
      <div class="card quiz-card">
        <div class="quiz-level">${q.level}</div>
        <h3 class="quiz-q">${q.q}</h3>
        <div class="quiz-options">
          ${q.a.map((opt,i)=>`<button class="quiz-opt" data-i="${i}">${String.fromCharCode(65+i)}. ${opt}</button>`).join('')}
        </div>
        <div id="quizFeedback"></div>
        <div class="hero-actions" style="margin-top:16px">
          <button class="btn-ghost" id="btnSkip">跳过</button>
          <button class="btn-primary" id="btnNext" disabled>下一题 →</button>
        </div>
      </div>
    `;
    $$('.quiz-opt').forEach(btn => {
      btn.onclick = () => {
        const chosen = parseInt(btn.dataset.i, 10);
        const fb = $('#quizFeedback');
        if (chosen === q.c) {
          btn.classList.add('opt-correct');
          correct++;
          fb.innerHTML = `<div class="fb fb-correct">✅ 正确！${q.e}</div>`;
        } else {
          btn.classList.add('opt-wrong');
          $$('.quiz-opt')[q.c].classList.add('opt-correct');
          fb.innerHTML = `<div class="fb fb-wrong">❌ 不正确。正确答案是 ${String.fromCharCode(65+q.c)}。<br>解析：${q.e}</div>`;
        }
        $$('.quiz-opt').forEach(b=>b.disabled = true);
        $('#btnNext').disabled = false;
      };
    });
    $('#btnNext').onclick = () => { curIdx++; renderQ(); };
    $('#btnSkip').onclick = () => { curIdx++; renderQ(); };
  }

  renderQ();
}

/* ============ 口语跟读 ============ */
function renderSpeaking(app, lang, params) {
  const list = SPEAKING[lang] || [];
  const meta = LANG_META[lang];
  if (!list.length) { app.innerHTML = `<p class="muted">暂无口语素材。</p>`; return; }

  app.innerHTML = `
    <section class="section" style="max-width:800px;margin:0 auto;">
      <div class="breadcrumbs"><a href="#/learn/${lang}">${meta.nativeName}</a> / 口语跟读</div>
      <h2 class="section-title" style="text-align:left">🎤 口语跟读 · ${meta.nativeName}</h2>
      <p class="section-sub">点击播放标准发音，然后跟读，训练你的语音语调。</p>
      <div id="speakArea"></div>
    </section>
  `;
  let cur = 0;
  const render = () => {
    if (cur >= list.length) {
      if (state.currentUser) {
        state.data.stats.speaking += list.length;
        state.data.speakingHistory.push({ lang, at: Date.now() });
        registerStreak(); saveData();
        checkAchievements().forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
      }
      $('#speakArea').innerHTML = `
        <div class="card">
          <h3>🎉 完成 ${list.length} 条跟读！</h3>
          <div class="hero-actions">
            <button class="btn-primary" onclick="location.reload()">再来一轮</button>
            <a class="btn-ghost" href="#/learn/${lang}">返回</a>
          </div>
        </div>`;
      return;
    }
    const s = list[cur];
    $('#speakArea').innerHTML = `
      <div class="speak-card">
        <div class="speak-topic">${s.d}</div>
        <h3 class="speak-sentence">"${s.s}"</h3>
        <p class="muted" style="text-align:center">${s.t}</p>
        <div class="hero-actions" style="margin-top:16px">
          <button class="btn-primary" id="btnPlay">🔊 播放原音</button>
          <button class="btn-ghost" id="btnSlow">🔉 慢速播放</button>
          <button class="btn-primary" id="btnDone">✓ 我已跟读</button>
        </div>
      </div>
      <div class="speak-progress">${cur+1} / ${list.length}</div>
    `;
    $('#btnPlay').onclick = () => speakText(s.s, lang, 1);
    $('#btnSlow').onclick = () => speakText(s.s, lang, 0.7);
    $('#btnDone').onclick = () => { cur++; toast('跟读完成 +1', 'success'); render(); };
  };
  render();
}

function speakText(text, lang, rate=1) {
  if (!window.speechSynthesis) { toast('当前浏览器不支持语音合成', 'warn'); return; }
  const u = new SpeechSynthesisUtterance(text);
  const codeMap = { en:'en-US', ja:'ja-JP', ko:'ko-KR' };
  u.lang = codeMap[lang] || 'en-US';
  u.rate = rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ============ 听力训练 ============ */
function renderListening(app, lang, params) {
  const list = LISTENING[lang] || [];
  const meta = LANG_META[lang];
  if (!list.length) { app.innerHTML = `<p class="muted">暂无听力素材。</p>`; return; }

  app.innerHTML = `
    <section class="section" style="max-width:800px;margin:0 auto;">
      <div class="breadcrumbs"><a href="#/learn/${lang}">${meta.nativeName}</a> / 听力训练</div>
      <h2 class="section-title" style="text-align:left">🎧 听力训练 · ${meta.nativeName}</h2>
      <p class="section-sub">先听对话，再作答，检测你的听力水平。</p>
      <div id="listenArea"></div>
    </section>
  `;
  let cur = 0, correct = 0;
  const render = () => {
    if (cur >= list.length) {
      if (state.currentUser) {
        state.data.stats.listening += list.length;
        state.data.listeningHistory.push({ lang, correct, total: list.length, at: Date.now() });
        registerStreak(); saveData();
        checkAchievements().forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
      }
      $('#listenArea').innerHTML = `
        <div class="card">
          <h3>🎉 听力训练完成！</h3>
          <p>你答对了 <strong>${correct}/${list.length}</strong> 题，正确率 <strong>${Math.round(correct/list.length*100)}%</strong></p>
          <div class="hero-actions">
            <button class="btn-primary" id="btnAgain">再来一轮</button>
            <a class="btn-ghost" href="#/learn/${lang}">返回</a>
          </div>
        </div>`;
      $('#btnAgain').onclick = () => { cur=0; correct=0; render(); };
      return;
    }
    const q = list[cur];
    $('#listenArea').innerHTML = `
      <div class="card quiz-card">
        <div class="speak-progress">第 ${cur+1} / ${list.length} 题 · 已答对 ${correct}</div>
        <div class="speak-topic">对话</div>
        <div class="speak-sentence" style="background:${meta.color}15; padding:16px 20px; border-radius:12px;">${q.d}</div>
        <div class="hero-actions" style="margin:16px 0;">
          <button class="btn-primary" id="btnPlay">🔊 播放对话</button>
        </div>
        <h3 class="quiz-q">${q.q}</h3>
        <div class="quiz-options">
          ${q.a.map((opt,i)=>`<button class="quiz-opt" data-i="${i}">${String.fromCharCode(65+i)}. ${opt}</button>`).join('')}
        </div>
        <div id="listenFB"></div>
        <div class="hero-actions" style="margin-top:16px;">
          <button class="btn-primary" id="btnNext" disabled>下一题 →</button>
        </div>
      </div>
    `;
    $('#btnPlay').onclick = () => speakText(q.d, lang, 0.9);
    $$('.quiz-opt').forEach(btn => {
      btn.onclick = () => {
        const chosen = parseInt(btn.dataset.i,10);
        if (chosen === q.c) { btn.classList.add('opt-correct'); correct++; $('#listenFB').innerHTML = `<div class="fb fb-correct">✅ 正确！</div>`; }
        else { btn.classList.add('opt-wrong'); $$('.quiz-opt')[q.c].classList.add('opt-correct'); $('#listenFB').innerHTML = `<div class="fb fb-wrong">❌ 不正确，正确答案为 ${String.fromCharCode(65+q.c)}。</div>`; }
        $$('.quiz-opt').forEach(b=>b.disabled = true);
        $('#btnNext').disabled = false;
      };
    });
    $('#btnNext').onclick = () => { cur++; render(); };
  };
  render();
}

/* ============ 学习进度 ============ */
function renderProgress(app) {
  if (!state.currentUser) {
    app.innerHTML = `
      <section class="section" style="text-align:center; padding:80px 20px;">
        <h2>请先登录以查看学习进度</h2>
        <a class="btn-primary lg" href="#/login">登录 / 注册</a>
      </section>`;
    return;
  }
  const d = state.data;
  const totalWords = d.stats.words;
  const langs = d.learnedLangs || [];

  // 每语言完成率
  const langRows = Object.values(LANG_META).map(m => {
    const cur = CURRICULUM[m.id];
    const total = cur.reduce((s,lv)=>s+lv.units.length,0);
    const done = cur.reduce((s,lv)=>s+lv.units.filter(u=>d.completedUnits.includes(u.topic)).length,0);
    const pct = total ? Math.round(done*100/total) : 0;
    return { meta: m, total, done, pct };
  });

  app.innerHTML = `
    <section class="section" style="max-width:1100px;margin:0 auto;">
      <h2 class="section-title">📊 我的学习进度</h2>

      <div class="grid-4">
        <div class="stat-card"><div class="stat-num">${totalWords}</div><div class="stat-label">已学单词</div></div>
        <div class="stat-card"><div class="stat-num">${d.stats.grammar}</div><div class="stat-label">语法题</div></div>
        <div class="stat-card"><div class="stat-num">${d.stats.speaking}</div><div class="stat-label">口语跟读数</div></div>
        <div class="stat-card"><div class="stat-num">${d.stats.listening}</div><div class="stat-label">听力题</div></div>
        <div class="stat-card"><div class="stat-num">${d.completedUnits.length}</div><div class="stat-label">完成单元</div></div>
        <div class="stat-card"><div class="stat-num">${d.streak||0}</div><div class="stat-label">连续学习天数</div></div>
        <div class="stat-card"><div class="stat-num">${d.achievements.length}</div><div class="stat-label">获得徽章</div></div>
        <div class="stat-card"><div class="stat-num">${langs.length}</div><div class="stat-label">学习语言数</div></div>
      </div>

      <h3 class="section-title" style="margin-top:40px">🌐 各语言完成率</h3>
      <div class="progress-list">
        ${langRows.map(r => `<div class="progress-item card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:${r.meta.color}">${r.meta.flag} ${r.meta.name} · ${r.meta.nativeName}</h3>
            <div class="progress-text">${r.done}/${r.total} · ${r.pct}%</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${r.pct}%;background:${r.meta.color}"></div></div>
          <div class="hero-actions" style="margin-top:12px"><a class="btn-primary" href="#/learn/${r.meta.id}">继续学习</a></div>
        </div>`).join('')}
      </div>

      <h3 class="section-title" style="margin-top:40px">⭐ 最近获得的徽章</h3>
      <div class="grid-4">
        ${d.achievements.slice(-8).map(id => {
          const a = ACHIEVEMENTS.find(x=>x.id===id);
          return a ? `<div class="achievement-card"><div class="ach-icon">${a.icon}</div><h4>${a.name}</h4><p class="muted">${a.desc}</p></div>` : '';
        }).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">还没有徽章，快去学习获得吧！</p>`}
      </div>
    </section>
  `;
}

/* ============ 成就徽章页 ============ */
function renderAchievements(app) {
  if (!state.currentUser) {
    app.innerHTML = `<section class="section" style="text-align:center;padding:80px 20px;">
      <h2>请先登录查看成就</h2>
      <a class="btn-primary lg" href="#/login">登录 / 注册</a></section>`;
    return;
  }
  const got = new Set(state.data.achievements);
  app.innerHTML = `
    <section class="section" style="max-width:1100px;margin:0 auto;">
      <h2 class="section-title">🏅 成就徽章系统</h2>
      <p class="section-sub">完成学习目标，解锁更多徽章！你已获得 ${got.size} / ${ACHIEVEMENTS.length} 枚徽章。</p>
      <div class="grid-4">
        ${ACHIEVEMENTS.map(a => {
          const ok = got.has(a.id);
          return `<div class="achievement-card ${ok?'':'ach-locked'}">
            <div class="ach-icon">${ok ? a.icon : '🔒'}</div>
            <h4>${a.name}</h4>
            <p class="muted">${a.desc}</p>
            <div class="ach-status">${ok ? '✓ 已获得' : '未获得'}</div>
          </div>`;
        }).join('')}
      </div>
    </section>
  `;
}

/* ============ 社区 ============ */
function renderCommunity(app) {
  app.innerHTML = `
    <section class="section" style="max-width:900px;margin:0 auto;">
      <h2 class="section-title">💬 学习者社区</h2>
      <p class="section-sub">与全球学习者分享经验、互相鼓励。</p>

      ${state.currentUser ? `
      <div class="card post-form">
        <h3 style="margin:0 0 12px">发布新帖子</h3>
        <div class="form-row">
          <label>选择语言</label>
          <select id="postLang">
            <option value="en">英语</option>
            <option value="ja">日语</option>
            <option value="ko">韩语</option>
          </select>
        </div>
        <div class="form-row">
          <label>标签</label>
          <select id="postTag">
            <option>学习心得</option>
            <option>经验分享</option>
            <option>求助</option>
            <option>资源推荐</option>
            <option>日常打卡</option>
          </select>
        </div>
        <div class="form-row">
          <label>内容</label>
          <textarea id="postContent" rows="3" placeholder="分享你的想法..."></textarea>
        </div>
        <button class="btn-primary" id="btnPost">发布</button>
      </div>` : `<div class="card muted" style="text-align:center">请 <a href="#/login">登录</a> 后发布帖子</div>`}

      <div class="filter-bar">
        <button class="filter-btn filter-active" data-lang="all">全部</button>
        <button class="filter-btn" data-lang="en">🇬🇧 英语</button>
        <button class="filter-btn" data-lang="ja">🇯🇵 日语</button>
        <button class="filter-btn" data-lang="ko">🇰🇷 韩语</button>
      </div>

      <div id="postList"></div>
    </section>
  `;

  if (state.currentUser) {
    $('#btnPost').onclick = () => {
      const content = $('#postContent').value.trim();
      if (!content) { toast('请输入内容', 'warn'); return; }
      const post = {
        id: 'u_' + Date.now(),
        author: state.currentUser.username,
        lang: $('#postLang').value,
        tag: $('#postTag').value,
        time: '刚刚',
        content,
        likes: 0,
        replies: 0,
        likedByMe: false
      };
      state.posts.unshift(post);
      writeJSON(LS_KEYS.posts, state.posts);
      state.data.stats.posts = (state.data.stats.posts||0) + 1;
      saveData();
      checkAchievements().forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
      toast('发布成功！', 'success');
      $('#postContent').value = '';
      renderPostList('all');
    };
  }

  $$('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.filter-btn').forEach(b => b.classList.remove('filter-active'));
      btn.classList.add('filter-active');
      renderPostList(btn.dataset.lang);
    };
  });

  function renderPostList(filter) {
    const list = (filter === 'all' ? state.posts : state.posts.filter(p => p.lang === filter));
    if (!list.length) { $('#postList').innerHTML = `<div class="card muted" style="text-align:center">暂时没有帖子，快来发布第一条吧！</div>`; return; }
    $('#postList').innerHTML = list.map(p => {
      const m = LANG_META[p.lang];
      return `<div class="card post-card" data-id="${p.id}">
        <div class="post-head">
          <span class="post-avatar" style="background:${m.color}">${p.author.slice(0,1).toUpperCase()}</span>
          <div>
            <div class="post-author">${p.author} · ${m.flag} ${m.nativeName}</div>
            <div class="post-meta">${p.tag} · ${p.time}</div>
          </div>
        </div>
        <p class="post-content">${escapeHTML(p.content)}</p>
        <div class="post-actions">
          <button class="btn-like" data-id="${p.id}">❤️ ${p.likes}</button>
          <button class="btn-like" data-id="${p.id}" data-r="1">💬 ${p.replies}</button>
        </div>
      </div>`;
    }).join('');

    $$('.btn-like').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const r = btn.dataset.r;
        const p = state.posts.find(x => x.id === id);
        if (!p) return;
        if (r) {
          const reply = prompt('写下你的回复：');
          if (reply && reply.trim()) {
            p.replies = (p.replies||0) + 1;
            writeJSON(LS_KEYS.posts, state.posts);
            toast('回复成功', 'success');
            renderPostList(document.querySelector('.filter-active').dataset.lang);
          }
        } else {
          p.likes = (p.likes || 0) + 1;
          writeJSON(LS_KEYS.posts, state.posts);
          btn.textContent = '❤️ ' + p.likes;
        }
      };
    });
  }
  renderPostList('all');
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============ 登录 / 注册 ============ */
function renderLogin(app, params) {
  if (state.currentUser) { navigate('/progress'); return; }
  app.innerHTML = `
    <section class="section" style="max-width:460px;margin:40px auto;">
      <div class="card" style="padding:32px">
        <h2 style="text-align:center">${params.mode==='register' ? '创建新账户' : '欢迎回来'}</h2>
        <p class="muted" style="text-align:center">${params.mode==='register' ? '加入 LinguaVerse，开启个性化学习' : '登录以保存学习进度与成就'}</p>

        <div class="tabs">
          <button class="tab ${params.mode!=='register'?'tab-active':''}" data-mode="login">登录</button>
          <button class="tab ${params.mode==='register'?'tab-active':''}" data-mode="register">注册</button>
        </div>

        <div class="form-row">
          <label>用户名</label>
          <input id="inUser" placeholder="请输入用户名" autocomplete="username"/>
        </div>
        <div class="form-row">
          <label>密码</label>
          <input id="inPass" type="password" placeholder="请输入密码" autocomplete="current-password"/>
        </div>
        <div class="form-row" id="prefLangRow" style="${params.mode==='register'?'':'display:none'}">
          <label>最想学习的语言</label>
          <select id="inLang">
            <option value="en">英语 English</option>
            <option value="ja">日语 日本語</option>
            <option value="ko">韩语 한국어</option>
          </select>
        </div>

        <button class="btn-primary" id="btnSubmit" style="width:100%;margin-top:12px">${params.mode==='register'?'立即注册':'立即登录'}</button>
        <p class="muted" style="text-align:center;margin-top:12px;font-size:13px">数据将保存在浏览器本地，支持多用户切换。</p>
      </div>
    </section>
  `;

  $$('.tab').forEach(t => t.onclick = () => navigate('/login?mode=' + t.dataset.mode));

  $('#btnSubmit').onclick = () => {
    const u = $('#inUser').value.trim();
    const p = $('#inPass').value;
    if (!u || !p) { toast('请输入用户名和密码', 'warn'); return; }
    const users = readJSON(LS_KEYS.users, {});
    const isReg = params.mode === 'register';
    if (isReg) {
      if (users[u]) { toast('用户名已存在', 'warn'); return; }
      users[u] = { password: simpleHash(p), createdAt: Date.now() };
      writeJSON(LS_KEYS.users, users);
      localStorage.setItem(LS_KEYS.session, u);
      state.currentUser = { username: u, ...users[u] };
      state.data = makeDefaultUserData(u);
      state.data.preferredLang = $('#inLang').value;
      saveData();
      const newA = checkAchievements();
      toast('注册成功，欢迎加入 LinguaVerse！', 'success');
      newA.forEach(a => toast(`🏅 获得成就：${a.name}`, 'success'));
      navigate('/home');
    } else {
      if (!users[u] || users[u].password !== simpleHash(p)) { toast('用户名或密码错误', 'warn'); return; }
      localStorage.setItem(LS_KEYS.session, u);
      state.currentUser = { username: u, ...users[u] };
      state.data = readJSON(LS_KEYS.userdata + ':' + u, makeDefaultUserData(u));
      toast('登录成功', 'success');
      navigate('/progress');
    }
  };
}

function simpleHash(s) {
  let h = 0;
  for (let i=0;i<s.length;i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'h' + h;
}

/* ============ 个人中心 ============ */
function renderProfile(app) {
  if (!state.currentUser) { navigate('/login'); return; }
  const d = state.data;
  app.innerHTML = `
    <section class="section" style="max-width:800px;margin:0 auto;">
      <h2 class="section-title">👤 个人中心</h2>
      <div class="card" style="padding:28px">
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="avatar" style="width:72px;height:72px;font-size:32px">${state.currentUser.username.slice(0,1).toUpperCase()}</div>
          <div>
            <h3 style="margin:0">${state.currentUser.username}</h3>
            <p class="muted" style="margin:4px 0">注册于 ${new Date(d.createdAt).toLocaleDateString()}</p>
            <p class="muted" style="margin:0">偏好语言：${LANG_META[d.preferredLang].flag} ${LANG_META[d.preferredLang].nativeName}</p>
          </div>
        </div>

        <h3 style="margin-top:24px">修改偏好语言</h3>
        <div class="form-row">
          <select id="selPref">
            ${Object.values(LANG_META).map(m=>`<option value="${m.id}" ${d.preferredLang===m.id?'selected':''}>${m.flag} ${m.nativeName}</option>`).join('')}
          </select>
          <button class="btn-primary" id="btnSavePref">保存</button>
        </div>

        <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
        <h3>账户操作</h3>
        <div class="hero-actions">
          <button class="btn-ghost" id="btnReset">清空我的学习记录</button>
          <button class="btn-ghost" id="btnLogout">退出登录</button>
        </div>
      </div>
    </section>
  `;
  $('#btnSavePref').onclick = () => { state.data.preferredLang = $('#selPref').value; saveData(); toast('偏好已更新', 'success'); };
  $('#btnReset').onclick = () => {
    if (!confirm('确认清空所有学习记录与成就吗？此操作不可撤销。')) return;
    state.data = makeDefaultUserData(state.currentUser.username);
    saveData();
    toast('数据已重置', 'info');
    navigate('/progress');
  };
  $('#btnLogout').onclick = () => {
    localStorage.removeItem(LS_KEYS.session);
    state.currentUser = null; state.data = {};
    toast('已退出', 'info'); navigate('/home');
  };
}

/* ============ 启动 ============ */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  loadSession();
  route();
});
