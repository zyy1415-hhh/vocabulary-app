// ===== Supabase 初始化（可选，失败不影响本地运行）=====
window._supabaseClient = null;
try {
  if (window.window._supabaseClient) {
    window._supabaseClient = window.supabase.createClient(
      "https://zqucjgajbvanfsosyhfv.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWNqZ2FqYnZhbmZzb3N5aGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTM4MzcsImV4cCI6MjA5MzM4OTgzN30.WjsYkqm4BypEnfH5RqeloGO4X1y_dmVy8GAoUGPlXPg"
    );
  }
} catch(e) { window._supabaseClient = null; }
const window._supabaseClient = window._supabaseClient;

// ===== 全局状态 =====
let words = [];
let queue = [];
let qi = 0;
let sentIdx = 0;
let doneToday = 0;
let showingAnswer = false;
let currentDeviceId = localStorage.getItem('vl_device_id') || (Math.random().toString(36).substr(2, 9));
localStorage.setItem('vl_device_id', currentDeviceId);

// ===== 工具函数 =====
function today() {
  return new Date().toISOString().split("T")[0];
}

function mkW(w, p, m, s) {
  return {
    word: w.toLowerCase(),
    phonetic: p || "",
    meaning: m,
    sentences: s || [],
    level: 0,
    interval: 0,
    ease: 2.5,
    reps: 0,
    next_review: today(),
    last_review: null
  };
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

// ===== Supabase 数据操作 =====
async function loadWords() {
  const { data, error } = await window._supabaseClient
    .from('words')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('加载单词失败:', error);
    return [];
  }
  return data || [];
}

async function saveWord(word) {
  // 先写本地
  words.push(word);
  saveWordsToStorage();
  // 尝试同步到 Supabase
  if (window._supabaseClient) {
    try {
      const { data } = await window._supabaseClient.from('words').insert([{ ...word, device_id: currentDeviceId }]).select();
      if (data && data[0]) {
        word.id = data[0].id;
        saveWordsToStorage();
      }
    } catch(e) {}
  }
  return word;
}

async function updateWord(id, updates) {
  // 更新本地
  const idx = words.findIndex(w => w.id === id);
  if (idx !== -1) { Object.assign(words[idx], updates); saveWordsToStorage(); }
  // 同步到 Supabase
  if (window._supabaseClient) {
    try { await window._supabaseClient.from('words').update(updates).eq('id', id); } catch(e) {}
  }
}

async function deleteWord(id) {
  words = words.filter(w => w.id !== id);
  saveWordsToStorage();
  if (window._supabaseClient) {
    try { await window._supabaseClient.from('words').delete().eq('id', id); } catch(e) {}
  }
}

async function loadStudyLogs(date) {
  const { data, error } = await window._supabaseClient
    .from('study_logs')
    .select('word_id')
    .eq('studied_at', date);

  if (error) {
    console.error('加载学习记录失败:', error);
    return [];
  }
  return data || [];
}

// 批量查询一段时间内的所有学习记录（一次请求）
async function loadStudyLogsBatch(startDate, endDate) {
  if (!window._supabaseClient) return [];
  const { data, error } = await window._supabaseClient
    .from('study_logs')
    .select('studied_at')
    .gte('studied_at', startDate)
    .lte('studied_at', endDate);

  if (error) {
    console.error('批量加载学习记录失败:', error);
    return [];
  }
  return data || [];
}

async function saveStudyLog(wordId) {
  const { error } = await window._supabaseClient
    .from('study_logs')
    .insert([{ word_id: wordId, studied_at: today(), device_id: currentDeviceId }]);

  if (error) {
    console.error('保存学习记录失败:', error);
  }
}

// ===== 内置单词数据 =====
const BUILTIN = [
  {w:"achieve",p:"/əˈtʃiːv/",m:"raggiungere, realizzare",s:["She finally {{achieve}}d her dream of becoming a doctor.", "The team {{achieve}}d excellent results this year."]},
  {w:"afford",p:"/əˈfɔːd/",m:"potersi permettere",s:["I can't {{afford}} a new phone right now.", "They finally {{afford}}ed to buy a house."]},
  {w:"agree",p:"/əˈɡriː/",m:"essere d'accordo",s:["I {{agree}} with your opinion completely.", "They finally {{agree}}d on the price."]},
  {w:"allow",p:"/əˈlaʊ/",m:"permettere",s:["My parents don't {{allow}} me to stay out late.", "The law does not {{allow}} parking here."]},
  {w:"argue",p:"/ˈɑːɡjuː/",m:"discutere",s:["They often {{argue}} about money.", "She {{argue}}d that education should be free."]},
  {w:"arrange",p:"/əˈreɪndʒ/",m:"organizzare",s:["Can you {{arrange}} a meeting for tomorrow?", "I need to {{arrange}} my books by color."]},
  {w:"arrive",p:"/əˈraɪv/",m:"arrivare",s:["We finally {{arrive}}d at the hotel at midnight.", "The package will {{arrive}} tomorrow morning."]},
  {w:"attend",p:"/əˈtend/",m:"partecipare",s:["Everyone should {{attend}} the meeting.", "She {{attend}}ed the same school as me."]},
  {w:"avoid",p:"/əˈvɔɪd/",m:"evitare",s:["You should {{avoid}} eating too much sugar.", "He tried to {{avoid}} answering the question."]},
  {w:"believe",p:"/bɪˈliːv/",m:"credere",s:["I {{believe}} that honesty is very important.", "Nobody wanted to {{believe}} her story."]},
  {w:"borrow",p:"/ˈbɒrəʊ/",m:"prendere in prestito",s:["Can I {{borrow}} your pen for a moment?", "She often {{borrow}}s books from the library."]},
  {w:"bother",p:"/ˈbɒðə/",m:"disturbare",s:["Don't {{bother}} cooking - we can order pizza.", "He didn't {{bother}} to lock the door."]},
  {w:"break",p:"/breɪk/",m:"rompere",s:["Be careful not to {{break}} the glass.", "Let's take a short {{break}} before continuing."]},
  {w:"breath",p:"/breθ/",m:"respiro",s:["Take a deep {{breath}} and relax.", "He was out of {{breath}} after running."]},
  {w:"build",p:"/bɪld/",m:"costruire",s:["They plan to {{build}} a new school here.", "She has {{build}}t a successful business."]},
  {w:"burn",p:"/bɜːn/",m:"bruciare",s:["The fire {{burn}}ed for several hours.", "Be careful not to {{burn}} your hand."]},
  {w:"calm",p:"/kɑːm/",m:"calmo, tranquillo",s:["Please try to stay {{calm}} during the exam.", "The sea was very {{calm}} that morning."]},
  {w:"cause",p:"/kɔːz/",m:"causa, provocare",s:["What was the {{cause}} of the accident?", "The heavy rain {{cause}}d a flood."]},
  {w:"challenge",p:"/ˈtʃælɪndʒ/",m:"sfida",s:["Climbing the mountain was a real {{challenge}}.", "She {{challenge}}d herself to run every day."]},
  {w:"change",p:"/tʃeɪndʒ/",m:"cambiare",s:["The weather can {{change}} very quickly here.", "Can you give me {{change}} for a 20 euro note?"]},
  {w:"check",p:"/tʃek/",m:"controllare",s:["Please {{check}} your email when you have time.", "I always {{check}} the door is locked."]},
  {w:"choose",p:"/tʃuːz/",m:"scegliere",s:["You can {{choose}} any color you like.", "It's difficult to {{choose}} between the two options."]},
  {w:"collect",p:"/kəˈlekt/",m:"raccogliere",s:["She loves to {{collect}} old postcards.", "Can you {{collect}} the kids from school?"]},
  {w:"communicate",p:"/kəˈmjuːnɪkeɪt/",m:"comunicare",s:["We use email to {{communicate}} with clients.", "Babies {{communicate}} by crying and smiling."]},
  {w:"compare",p:"/kəmˈpeə/",m:"confrontare",s:["It's hard to {{compare}} the two cities.", "Please {{compare}} these two options carefully."]},
  {w:"compete",p:"/kəmˈpiːt/",m:"gareggiare",s:["Five teams will {{compete}} in the finals.", "She loves to {{compete}} in chess tournaments."]},
  {w:"complain",p:"/kəmˈpleɪn/",m:"lamentarsi",s:["He always {{complain}}s about the weather.", "You should {{complain}} to the manager."]},
  {w:"concentrate",p:"/ˈkɒnsəntreɪt/",m:"concentrarsi",s:["I can't {{concentrate}} with all this noise.", "Please {{concentrate}} on one task at a time."]},
  {w:"confident",p:"/ˈkɒnfɪdənt/",m:"sicuro di se",s:["She felt {{confident}} before the interview.", "He gave a {{confident}} and clear speech."]},
  {w:"consider",p:"/kənˈsɪdə/",m:"considerare",s:["Please {{consider}} my suggestion carefully.", "I {{consider}} him one of my closest friends."]},
  {w:"continue",p:"/kənˈtɪnjuː/",m:"continuare",s:["The rain will {{continue}} until tomorrow.", "Please {{continue}} working on the project."]},
  {w:"control",p:"/kənˈtrəʊl/",m:"controllare",s:["He couldn't {{control}} his anger.", "The remote {{control}} is on the table."]},
  {w:"courage",p:"/ˈkʌrɪdʒ/",m:"coraggio",s:["It takes a lot of {{courage}} to speak in public.", "She had the {{courage}} to start a new life abroad."]},
  {w:"curious",p:"/ˈkjʊəriəs/",m:"curioso",s:["I'm very {{curious}} about other cultures.", "The cat was {{curious}} about the box."]},
  {w:"decide",p:"/dɪˈsaɪd/",m:"decidere",s:["We need to {{decide}} by tomorrow morning.", "She {{decide}}d to study abroad next year."]},
  {w:"defend",p:"/dɪˈfend/",m:"difendere",s:["Soldiers are trained to {{defend}} their country.", "She tried to {{defend}} her point of view."]},
  {w:"deliver",p:"/dɪˈlɪvə/",m:"consegnare",s:["The pizza will be {{deliver}}ed in 30 minutes.", "She {{deliver}}ed an excellent speech."]},
  {w:"depend",p:"/dɪˈpend/",m:"dipendere",s:["The result will {{depend}} on the weather.", "You can {{depend}} on me to help you."]},
  {w:"describe",p:"/dɪˈskraɪb/",m:"descrivere",s:["Can you {{describe}} the person you saw?", "She {{describe}}d the scene in detail."]},
  {w:"develop",p:"/dɪˈveləp/",m:"sviluppare",s:["Children {{develop}} at different speeds.", "The company plans to {{develop}} a new app."]},
  {w:"discuss",p:"/dɪsˈkʌs/",m:"discutere",s:["We need to {{discuss}} this issue together.", "They {{discuss}}ed the plan for two hours."]},
  {w:"distance",p:"/ˈdɪstəns/",m:"distanza",s:["The {{distance}} from here to the station is 2 km.", "We walked a long {{distance}} today."]},
  {w:"disturb",p:"/dɪˈstɜːb/",m:"disturbare",s:["Please don't {{disturb}} me while I'm studying.", "I'm sorry to {{disturb}} you, but it's urgent."]},
  {w:"divide",p:"/dɪˈvaɪd/",m:"dividere",s:["Let's {{divide}} the cake into eight pieces.", "The river {{divide}}s the city in two."]},
  {w:"double",p:"/ˈdʌbl/",m:"doppio, raddoppiare",s:["I'd like a {{double}} espresso, please.", "The price has {{double}}d in the last year."]},
  {w:"doubt",p:"/daʊt/",m:"dubbio",s:["I have no {{doubt}} that she will succeed.", "They {{doubt}}ed his ability to finish on time."]},
  {w:"education",p:"/ˌedʒuˈkeɪʃn/",m:"istruzione",s:["Education is very important for a country's future.", "She works in higher education."]},
  {w:"effect",p:"/ɪˈfekt/",m:"effetto",s:["The medicine had an immediate {{effect}}.", "Global warming will have a serious {{effect}}."]},
  {w:"effort",p:"/ˈefət/",m:"sforzo",s:["Learning a language requires a lot of {{effort}}.", "He put a lot of {{effort}} into the project."]},
  {w:"encourage",p:"/ɪnˈkʌrɪdʒ/",m:"incoraggiare",s:["Parents should {{encourage}} their children to read.", "The coach always {{encourage}}d the team."]},
  {w:"energy",p:"/ˈenədʒi/",m:"energia",s:["She has so much {{energy}} in the morning.", "We need to save energy at home."]},
  {w:"enjoy",p:"/ɪnˈdʒɔɪ/",m:"godere",s:["I really enjoyed the concert last night.", "We hope you enjoy your stay here."]},
  {w:"enough",p:"/ɪˈnʌf/",m:"abbastanza",s:["Do we have enough time to finish?", "I haven't had enough sleep lately."]},
  {w:"ensure",p:"/ɪnˈʃʊə/",m:"garantire",s:["Please ensure that all doors are locked.", "This will ensure a better result."]},
  {w:"entire",p:"/ɪnˈtaɪə/",m:"intero, completo",s:["The entire project took three years.", "She spent the entire day reading."]},
  {w:"environment",p:"/ɪnˈvaɪrənmənt/",m:"ambiente",s:["We need to protect the natural environment.", "The office is a friendly working environment."]},
  {w:"escape",p:"/ɪˈskeɪp/",m:"fuggire",s:["They managed to escape from the burning building.", "Reading is a good escape from reality."]},
  {w:"establish",p:"/ɪˈstæblɪʃ/",m:"stabilire",s:["The company was established in 1990.", "We need to establish a new policy."]},
  {w:"evidence",p:"/ˈevɪdəns/",m:"prova",s:["There is no evidence that he was involved.", "The police found evidence at the scene."]},
  {w:"exact",p:"/ɪɡˈzækt/",m:"esatto, preciso",s:["What is the exact time of the meeting?", "The two words have the exact same meaning."]},
  {w:"examine",p:"/ɪɡˈzæmɪn/",m:"esaminare",s:["The doctor will examine you carefully.", "We need to examine the data more closely."]},
  {w:"example",p:"/ɪɡˈzɑːmpl/",m:"esempio",s:["Can you give me an example of this grammar rule?", "For example, we could leave at 8 o'clock."]},
  {w:"excellent",p:"/ˈeksələnt/",m:"eccellente",s:["She did an excellent job on the presentation.", "The food at that restaurant is excellent."]},
  {w:"exist",p:"/ɪɡˈzɪst/",m:"esistere",s:["Do you think aliens exist?", "The problem doesn't really exist."]},
  {w:"expect",p:"/ɪkˈspekt/",m:"aspettarsi",s:["I expect to finish the report by Friday.", "Don't expect too much too soon."]},
  {w:"experience",p:"/ɪkˈspɪriəns/",m:"esperienza",s:["She has a lot of teaching experience.", "Living abroad was an amazing experience."]},
  {w:"explain",p:"/ɪkˈspleɪn/",m:"spiegare",s:["Can you please explain this rule to me?", "He didn't explain why he was late."]},
  {w:"explore",p:"/ɪkˈsplɔː/",m:"esplorare",s:["We want to explore the old part of the city.", "The children love to explore the garden."]},
  {w:"express",p:"/ɪkˈspres/",m:"esprimere",s:["She found it hard to express her feelings.", "Please express your opinion clearly."]},
  {w:"familiar",p:"/fəˈmɪliə/",m:"familiare",s:["The song sounds very familiar.", "Are you familiar with this software?"]},
  {w:"famous",p:"/ˈfeɪməs/",m:"famoso",s:["Paris is famous for the Eiffel Tower.", "She became famous after her first film."]},
  {w:"fear",p:"/fɪə/",m:"paura",s:["She has a fear of flying.", "There is no fear of losing the match."]},
  {w:"figure",p:"/ˈfɪɡə/",m:"figura, capire",s:["She's a well-known public figure.", "Can you figure out how to solve this?"]},
  {w:"focus",p:"/ˈfəʊkəs/",m:"concentrarsi",s:["You need to focus on your studies.", "The focus of the lesson is grammar."]},
  {w:"follow",p:"/ˈfɒləʊ/",m:"seguire",s:["Please follow the instructions carefully.", "She followed him to the station."]},
  {w:"foreign",p:"/ˈfɒrɪn/",m:"straniero",s:["He works in a foreign company.", "Do you speak any foreign languages?"]},
  {w:"frequent",p:"/ˈfriːkwənt/",m:"frequente",s:["He is a frequent visitor to this cafe.", "The most frequent problem is the internet connection."]},
  {w:"generation",p:"/ˌdʒenəˈreɪʃn/",m:"generazione",s:["Younger generations use technology more.", "This is a multi-generation family business."]},
  {w:"goal",p:"/ɡəʊl/",m:"obiettivo",s:["Our main goal is to improve customer service.", "She scored the winning goal."]},
  {w:"government",p:"/ˈɡʌvənmənt/",m:"governo",s:["The government introduced a new tax policy.", "People are losing trust in the government."]},
  {w:"gradual",p:"/ˈɡrædʒuəl/",m:"graduale",s:["There has been a gradual increase in sales.", "Learning takes gradual progress."]},
  {w:"guess",p:"/ɡes/",m:"indovinare",s:["Can you guess how old she is?", "I guess it will rain later."]},
  {w:"guide",p:"/ɡaɪd/",m:"guida",s:["Our tour guide spoke excellent English.", "This book is a helpful guide for beginners."]},
  {w:"harm",p:"/hɑːm/",m:"danno",s:["Pollution can harm the environment.", "He meant no harm by his comment."]},
  {w:"heart",p:"/hɑːt/",m:"cuore",s:["She has a very kind heart.", "He had a heart attack last year."]},
  {w:"heavy",p:"/ˈhevi/",m:"pesante",s:["It's going to rain - the sky looks very heavy.", "How heavy is this suitcase?"]},
  {w:"height",p:"/haɪt/",m:"altezza",s:["What is the height of Mount Everest?", "She is medium height and has dark hair."]},
  {w:"honest",p:"/ˈɒnɪst/",m:"onesto",s:["I think he is a very honest person.", "To be honest, I don't like this film."]},
  {w:"imagine",p:"/ɪˈmædʒɪn/",m:"immaginare",s:["Can you imagine life without a smartphone?", "I can't imagine how she managed alone."]},
  {w:"improve",p:"/ɪmˈpruːv/",m:"migliorare",s:["We need to improve our customer service.", "Her English has improved a great deal."]},
  {w:"include",p:"/ɪnˈkluːd/",m:"includere",s:["The price does not include tax.", "The package includes free delivery."]},
  {w:"increase",p:"/ɪnˈkriːs/",m:"aumentare",s:["The city's population continues to increase.", "Exercise can increase your energy levels."]},
  {w:"influence",p:"/ˈɪnfluəns/",m:"influenza",s:["Social media has a huge influence on young people.", "His father influenced him a lot."]},
  {w:"manage",p:"/ˈmænɪdʒ/",m:"gestire, riuscire",s:["She manages a team of twenty people.", "How do you manage to stay so calm?"]},
  {w:"necessary",p:"/ˈnesəsəri/",m:"necessario",s:["It's necessary to wear a seatbelt.", "Is it necessary to book in advance?"]},
  {w:"opinion",p:"/əˈpɪnjən/",m:"opinione",s:["In my opinion, this is the best option.", "Everyone is entitled to their own opinion."]},
  {w:"opportunity",p:"/ˌɒpəˈtjuːnəti/",m:"opportunità",s:["This is a great opportunity for you.", "Don't miss this opportunity to grow."]},
  {w:"participate",p:"/pɑːˈtɪsɪpeɪt/",m:"partecipare",s:["Everyone is welcome to participate.", "She refused to participate in the debate."]},
  {w:"persuade",p:"/pəˈsweɪd/",m:"convincere",s:["I finally persuaded him to see a doctor.", "Can anyone persuade her to change her mind?"]},
  {w:"prefer",p:"/prɪˈfɜː/",m:"preferire",s:["I prefer tea to coffee in the morning.", "Which do you prefer, red or blue?"]},
  {w:"prepare",p:"/prɪˈpeə/",m:"preparare",s:["We need to prepare for bad weather.", "She is preparing hard for her final exam."]},
  {w:"prevent",p:"/prɪˈvent/",m:"prevenire",s:["This vaccine can prevent serious illness.", "Nothing could prevent them from trying again."]},
  {w:"private",p:"/ˈpraɪvət/",m:"privato",s:["This is a private conversation.", "She goes to a private school."]},
  {w:"probably",p:"/ˈprɒbəbli/",m:"probabilmente",s:["It will probably rain tomorrow.", "He probably won't come to the party."]},
  {w:"promise",p:"/ˈprɒmɪs/",m:"promettere",s:["I promise I will call you tomorrow.", "The forecast promises sunny weather this weekend."]},
  {w:"protect",p:"/prəˈtekt/",m:"proteggere",s:["We must protect the environment.", "Sunscreen protects your skin from UV rays."]},
  {w:"provide",p:"/prəˈvaɪd/",m:"fornire",s:["The school will provide lunch for all students.", "Can you provide more details about the plan?"]},
  {w:"purpose",p:"/ˈpɜːpəs/",m:"scopo",s:["What is the purpose of this meeting?", "She studied medicine with a clear purpose."]},
  {w:"recognize",p:"/ˈrekəɡnaɪz/",m:"riconoscere",s:["I didn't recognize you with your new haircut!", "The government recognized their contribution."]},
  {w:"recommend",p:"/ˌrekəˈmend/",m:"raccomandare",s:["Can you recommend a good restaurant nearby?", "I recommend reading this book to everyone."]},
  {w:"reduce",p:"/rɪˈdjuːs/",m:"ridurre",s:["We need to reduce our daily expenses.", "The company decided to reduce the price."]},
  {w:"regular",p:"/ˈreɡjʊlə/",m:"regolare",s:["He goes to the gym on a regular basis.", "This is a regular event in our school."]},
  {w:"require",p:"/rɪˈkwaɪə/",m:"richiedere",s:["The job requires a university degree.", "All visitors are required to sign in."]},
  {w:"research",p:"/rɪˈsɜːtʃ/",m:"ricerca",s:["She is doing research on climate change.", "The research shows interesting results."]},
  {w:"responsible",p:"/rɪˈspɒnsɪbl/",m:"responsabile",s:["Who is responsible for this project?", "She is a very responsible person."]},
  {w:"satisfy",p:"/ˈsætɪsfaɪ/",m:"soddisfare",s:["The results didn't fully satisfy him.", "Nothing seems to satisfy her curiosity."]},
  {w:"solution",p:"/səˈluːʃn/",m:"soluzione",s:["We need to find a solution to this problem.", "There is no simple solution to this issue."]},
  {w:"suffer",p:"/ˈsʌfə/",m:"soffrire",s:["Many people suffer from stress at work.", "The town suffered heavy damage in the storm."]},
  {w:"support",p:"/səˈpɔːt/",m:"supportare",s:["Thank you for supporting me through this.", "The government supports small businesses."]},
  {w:"survive",p:"/səˈvaɪv/",m:"sopravvivere",s:["He survived the accident without serious injury.", "It's difficult to survive alone in the wild."]},
  {w:"suggest",p:"/səˈdʒest/",m:"suggerire",s:["I suggest we take a different route today.", "She suggested meeting at the coffee shop."]},
  {w:"value",p:"/ˈvæljuː/",m:"valore",s:["This painting has great historical value.", "I really value our friendship."]},
  {w:"volunteer",p:"/ˌvɒlənˈtɪə/",m:"volontario",s:["She works as a volunteer at the hospital.", "We need volunteers for the charity event."]},
  {w:"wonder",p:"/ˈwʌndə/",m:"chiedersi",s:["I wonder what time the train leaves.", "She wondered if he would come to the party."]}
];

// ===== 本地存储读写 =====
function loadWordsFromStorage() {
  try { return JSON.parse(localStorage.getItem('vl_words') || '[]'); }
  catch(e) { return []; }
}
function saveWordsToStorage() {
  try { localStorage.setItem('vl_words', JSON.stringify(words)); }
  catch(e) {}
}

// ===== 初始化：优先本地，可选云端同步 =====
async function initApp() {
  // 优先从 localStorage 加载
  words = loadWordsFromStorage();

  // 本地无数据，初始化内置单词
  if (words.length === 0) {
    for (const b of BUILTIN) {
      const w = mkW(b.w, b.p, b.m, b.s);
      words.push(w);
    }
    saveWordsToStorage();
    // 尝试同步到 Supabase（不影响本地）
    if (window._supabaseClient) {
      for (const w of words) {
        try {
          const { data } = await window._supabaseClient.from('words').insert([{ ...w, device_id: currentDeviceId }]).select();
          if (data && data[0]) w.id = data[0].id;
        } catch(e) {}
      }
      saveWordsToStorage();
    }
  } else {
    // 本地有数据，尝试从 Supabase 拉取新数据合并
    if (window._supabaseClient) {
      try {
        const { data } = await window._supabaseClient.from('words').select('*').order('id', { ascending: true });
        if (data && data.length > 0) {
          const localWords = new Set(words.map(w => w.word));
          for (const rw of data) {
            if (!localWords.has(rw.word)) words.push(rw);
          }
          saveWordsToStorage();
        }
      } catch(e) {}
    }
  }

  updateStats();
  renderCard();
}

// ===== SRS 算法 =====
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
  const d = new Date();
  d.setDate(d.getDate() + w.interval);
  w.next_review = d.toISOString().split("T")[0];
  w.last_review = today();
  return w;
}

// ===== 获取待复习单词 =====
function getDue() {
  return words.filter(function(w) { return w.next_review <= today(); });
}

// ===== 更新统计 =====
async function updateStats() {
  const due = getDue();
  document.getElementById("statTotal").textContent = words.length;
  document.getElementById("statDue").textContent = due.length;
  document.getElementById("statDone").textContent = doneToday;
  const b = document.getElementById("reviewBadge");
  if (due.length > 0) {
    b.style.display = "flex";
    b.textContent = due.length;
  } else {
    b.style.display = "none";
  }
  await updateStreak();
}

async function updateStreak() {
  const base = new Date();
  const end = base.toISOString().split("T")[0];
  const start = new Date(base);
  start.setDate(start.getDate() - 364);
  const startStr = start.toISOString().split("T")[0];

  const logs = await loadStudyLogsBatch(startStr, end);
  const hasLog = {};
  logs.forEach(function(l) { hasLog[l.studied_at] = true; });

  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (hasLog[ds]) s++;
    else if (i > 0) break;
  }
  document.getElementById("streakBadge").textContent = "🔥 " + s + "天";
}

// ===== 渲染卡片 =====
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
      '<div class="complete fade-up"><div class="em">🎉</div><h2>今天搞定啊！</h2><p>已完成 ' + doneToday + ' 个单词</p><button class="btn-rst" onclick="reviewAll()">🔄 复习全部词库</button></div>';
    updateProg();
    return;
  }
  renderCur();
}

function renderCur() {
  if (qi >= queue.length) { renderCard(); return; }
  const w = queue[qi];
  const ts = (w.sentences || []).length || 1;
  const area = document.getElementById("cardArea");
  if (!showingAnswer) {
    const blanked = w.sentences && w.sentences[sentIdx]
      ? w.sentences[sentIdx].replace(/\{\{(\w+)\}\}/gi, '<span class="blank">________</span>')
      : "";
    let dots = "";
    for (let i = 0; i < ts; i++) {
      dots += '<div class="s-dot' + (i === sentIdx ? ' act' : '') + '"></div>';
    }
    area.innerHTML =
      '<div class="card fade-up" onclick="flipCard()">' +
        '<div class="card-deco">?</div>' +
        '<div class="hint-label">🧩 根据提示猜单词</div>' +
        '<div class="sentence">' + blanked + '</div>' +
        '<div class="hint-box"><div class="hl">意大利语提示</div><div class="hm">' + escH(w.meaning) + '</div></div>' +
        '<div class="type-area"><input class="type-input" id="typeInput" type="text" placeholder="输入单词后按 Enter..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>' +
        (ts > 1 ? '<div class="sent-nav">' + dots + '<span class="s-nav-label">' + (sentIdx+1) + '/' + ts + ' 例句</span></div>' : '') +
        '<div class="tap-hint">👆 单击或按 Enter 查看答案</div>' +
      '</div>';
    // 自动聚焦到输入框
    setTimeout(function() { var inp = document.getElementById("typeInput"); if (inp) { inp.focus(); inp.addEventListener("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); flipCard(); } }); } }, 50);
  } else {
    const filled = w.sentences && w.sentences[sentIdx]
      ? w.sentences[sentIdx].replace(/\{\{(\w+)\}\}/gi, '<span class="filled">$1</span>')
      : "";
    let dots2 = "";
    for (let j = 0; j < ts; j++) {
      dots2 += '<div class="s-dot' + (j <= sentIdx ? ' act' : '') + '"></div>';
    }
    const nexBtn = (sentIdx + 1 < ts)
      ? '<button class="btn-next-sent" onclick="nextSent()">看下一个例句 →</button>'
      : "";
    area.innerHTML =
      '<div class="card fade-up">' +
        '<button class="speak-btn" onclick="event.stopPropagation();speak(\'' + escJ(w.word) + '\')">🔊</button>' +
        '<div class="aw">' + escH(w.word) + '</div>' +
        (w.phonetic ? '<div class="aph">' + escH(w.phonetic) + '</div>' : '') +
        '<div class="asent">' + filled + '</div>' +
        nexBtn +
        (ts > 1 ? '<div class="sent-nav">' + dots2 + '<span class="s-nav-label">' + (sentIdx+1) + '/' + ts + ' 例句</span></div>' : '') +
        '<div class="amean">📖 ' + escH(w.meaning) + '</div>' +
      '</div>';
  }
  updateProg();
}

function flipCard() {
  if (!showingAnswer) {
    showingAnswer = true;
    renderCur();
    document.getElementById("judgeRow").style.display = "flex";
  }
}

function nextSent() {
  const w = queue[qi];
  if (sentIdx + 1 < (w.sentences || []).length) {
    sentIdx++;
    renderCur();
  }
}

function updateProg() {
  const total = Math.max(queue.length, 1);
  const pct = Math.round(qi / total * 100);
  document.getElementById("progFill").style.width = pct + "%";
  document.getElementById("progFrac").textContent = Math.min(qi + 1, total) + "/" + total;
}

// ===== 判断记住/没记住 =====
async function judge(rem) {
  const w = queue[qi];
  const updated = srs(w, rem);
  // 更新本地
  const idx = words.findIndex(x => x.word === w.word);
  if (idx !== -1) words[idx] = updated;
  saveWordsToStorage();
  // 同步到 Supabase（可选）
  if (window._supabaseClient && w.id) {
    try {
      await window._supabaseClient.from('words').update({
        level: updated.level, interval: updated.interval,
        ease: updated.ease, reps: updated.reps,
        next_review: updated.next_review, last_review: updated.last_review
      }).eq('id', w.id);
    } catch(e) {}
  }
  // 保存学习记录
  const todayStr = today();
  try {
    const logs = JSON.parse(localStorage.getItem('vl_logs_' + todayStr) || '[]');
    if (!logs.includes(w.id || w.word)) {
      logs.push(w.id || w.word);
      localStorage.setItem('vl_logs_' + todayStr, JSON.stringify(logs));
    }
  } catch(e) {}
  if (window._supabaseClient) {
    try { await window._supabaseClient.from('study_logs').insert([{ word_id: w.id || w.word, studied_at: todayStr, device_id: currentDeviceId }]); } catch(e) {}
  }
  doneToday++;
  await updateStats();
  const card = document.querySelector(".card");
  if (card) {
    card.classList.add(rem ? "slide-out-l" : "slide-out-r");
    setTimeout(function() {
      qi++;
      sentIdx = 0;
      showingAnswer = false;
      document.getElementById("judgeRow").style.display = "none";
      if (qi >= queue.length) renderCard();
      else renderCur();
    }, 180);
  }
}

async function reviewAll() {
  for (const w of words) {
    w.next_review = today();
    await updateWord(w.id, { next_review: today() });
  }
  await updateStats();
  renderCard();
}

// ===== 页面切换 =====
function goPage(name, btn) {
  document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
  document.querySelectorAll(".nav-item").forEach(function(b) { b.classList.remove("active"); });
  document.getElementById("page" + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
  if (btn) btn.classList.add("active");
  if (name === "card") renderCard();
  if (name === "list") renderList();
  if (name === "review") renderReview();
}

// ===== 词库列表 =====
function renderList() {
  const area = document.getElementById("listArea");
  if (words.length === 0) {
    area.innerHTML = '<div class="empty"><div class="ic">📭</div>还没有单词，快去添加吧</div>';
    return;
  }
  let h = "";
  words.forEach(function(w) {
    const lv = ["<span class=\"wl-lv lv-0\">新词</span>",
                "<span class=\"wl-lv lv-1\">学习中</span>",
                "<span class=\"wl-lv lv-2\">已掌握</span>"][w.level] || "<span class=\"wl-lv lv-0\">新词</span>";
    h += '<div class="wl-item fade-up"><div><span class="wl-word">' + escH(w.word) + '</span>' +
         (w.phonetic ? '<span class="wl-ph">' + escH(w.phonetic) + '</span>' : '') +
         '<div class="wl-mean">' + escH(w.meaning) + '</div></div>' +
         '<div class="wl-right">' + lv + '<button class="wl-del" onclick="delWord(' + w.id + ')">✕</button></div></div>';
  });
  area.innerHTML = h;
}

async function delWord(id) {
  if (!confirm("确定删除？")) return;
  await deleteWord(id);
  words = words.filter(function(w) { return w.id !== id; });
  await updateStats();
  renderList();
}

// ===== 添加单词 =====
function showAdd() {
  document.getElementById("addModal").classList.add("show");
  document.getElementById("inpWord").focus();
}

function hideAdd() {
  document.getElementById("addModal").classList.remove("show");
  ["inpWord","inpPhonetic","inpMeaning","inpSent1","inpSent2"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
}

async function submitAdd() {
  const w = document.getElementById("inpWord").value.trim().toLowerCase();
  const p = document.getElementById("inpPhonetic").value.trim();
  const m = document.getElementById("inpMeaning").value.trim();
  const s1 = document.getElementById("inpSent1").value.trim();
  const s2 = document.getElementById("inpSent2").value.trim();
  if (!w || !m || !s1) { alert("请至少填写单词、释义和例句"); return; }
  function fix(s) {
    if (s && !s.includes("{{")) {
      s = s.replace(new RegExp("\\b" + escRe(w) + "\\b", "i"), "{{" + w + "}}");
    }
    return s;
  }
  const sa = [];
  if (s1) sa.push(fix(s1));
  if (s2) sa.push(fix(s2));
  const newWord = mkW(w, p, m, sa);
  const saved = await saveWord(newWord);
  if (saved) {
    words.push(saved);
    await updateStats();
    hideAdd();
    renderList();
    goPage('list', document.querySelectorAll(".nav-item")[2]);
  }
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

async function doImport() {
  const raw = document.getElementById("importArea").value.trim();
  const msg = document.getElementById("importMsg");
  if (!raw) {
    msg.className = "import-msg err";
    msg.textContent = "请粘贴单词数据";
    return;
  }
  const lines = raw.split("\n").map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  let count = 0;
  const errs = [];
  for (let li = 0; li < lines.length; li++) {
    const parts = lines[li].split("|").map(function(p) { return p.trim(); }).filter(function(p) { return p; });
    if (parts.length < 3) {
      errs.push("第" + (li+1) + "行格式不正确");
      continue;
    }
    const w = parts[0].toLowerCase();
    const m = parts[1];
    const sa = [];
    for (let i = 2; i < parts.length; i++) {
      let s = parts[i];
      if (s && !s.includes("{{")) {
        s = s.replace(new RegExp("\\b" + escRe(w) + "\\b", "i"), "{{" + w + "}}");
      }
      if (s) sa.push(s);
    }
    if (!w || !m || sa.length === 0) {
      errs.push("第" + (li+1) + "行缺少必要信息");
      continue;
    }
    const newWord = mkW(w, "", m, sa);
    const saved = await saveWord(newWord);
    if (saved) {
      words.push(saved);
      count++;
    }
  }
  await updateStats();
  if (errs.length > 0) {
    msg.className = "import-msg err";
    msg.textContent = "成功导入 " + count + " 个，失败 " + errs.length + " 个。" + (errs[0] || "");
  } else {
    msg.className = "import-msg ok";
    msg.textContent = "✅ 成功导入 " + count + " 个单词！";
    setTimeout(function() {
      hideImport();
      renderList();
      goPage('list', document.querySelectorAll(".nav-item")[2]);
    }, 800);
  }
}

// ===== 复习页面 =====
async function renderReview() {
  document.getElementById("reviewNum").textContent = getDue().length;
  await renderCal();
}

async function renderCal() {
  const area = document.getElementById("calArea");
  const dns = ["日","一","二","三","四","五","六"];
  const base = new Date();
  const end = base.toISOString().split("T")[0];
  const calStart = new Date(base);
  calStart.setDate(calStart.getDate() - 27);
  const start = calStart.toISOString().split("T")[0];

  // 一次查询28天所有记录
  const logs = await loadStudyLogsBatch(start, end);
  const hasLog = {};
  logs.forEach(function(l) { hasLog[l.studied_at] = true; });

  let h = '<div class="cal-title">📅 学习记录</div><div class="cal-grid">';
  dns.forEach(function(d) { h += '<div class="cal-hdr">' + d + '</div>'; });
  for (let i = 27; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const cls = "cal-day" + (hasLog[ds] ? " done" : "") + (ds === today() ? " today" : "");
    h += '<div class="' + cls + '">' + d.getDate() + '</div>';
  }
  h += '</div>';
  area.innerHTML = h;
}

function startReview() {
  goPage('card', document.querySelectorAll(".nav-item")[0]);
}

// ===== 语音朗读 =====
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.82;
  window.speechSynthesis.speak(u);
}

// ===== 键盘快捷键 =====
document.addEventListener("keydown", function(e) {
  if (document.getElementById("addModal").classList.contains("show")) {
    if (e.key === "Escape") hideAdd();
    if (e.key === "Enter" && e.ctrlKey) submitAdd();
    return;
  }
  if (document.getElementById("importModal").classList.contains("show")) {
    if (e.key === "Escape") hideImport();
    return;
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (!showingAnswer) flipCard();
  }
  if (e.key === "ArrowLeft" || e.key === "a") {
    e.preventDefault();
    judge(false);
  }
  if (e.key === "ArrowRight" || e.key === "d") {
    e.preventDefault();
    judge(true);
  }
  if (e.key === "n" && showingAnswer) nextSent();
});

// ===== 启动应用 =====
initApp();
