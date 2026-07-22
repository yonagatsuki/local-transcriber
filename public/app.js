const fileInput = document.querySelector("#fileInput");
const preview = document.querySelector("#preview");
const transcribeBtn = document.querySelector("#transcribeBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const sourceLanguage = document.querySelector("#sourceLanguage");
const explanationLanguage = document.querySelector("#explanationLanguage");
const statusEl = document.querySelector("#status");
const sentencesEl = document.querySelector("#sentences");
const explanationEl = document.querySelector("#explanation");

let selectedFile = null;
let sentences = [];
let currentStatusKey = "ready";
let currentStatusMode = "neutral";

const sampleSentences = [
  { id: 1, text: "I should have told you earlier." },
  { id: 2, text: "But I did not know how to say it." },
  { id: 3, text: "Learning a language takes time, but small steps matter." }
];

const ui = {
  ja: {
    eyebrow: "Local Tool",
    title: "Local Transcriber",
    chooseFile: "ファイル選択",
    sourceLanguage: "音声言語",
    explanationLanguage: "表示・解説言語",
    transcribe: "文字起こし",
    explanationTitle: "AI解説",
    explanationEmpty: "文をクリックすると解説が表示されます。",
    sentencesTitle: "文章リスト",
    sample: "サンプル表示",
    transcriptEmpty: "文字起こし結果がここに表示されます。",
    explaining: "AI解説を生成中です...",
    transcribing: "文字起こし中です。少し待ってください...",
    chooseAFile: "ファイルを選択してください",
    explainFailed: "解説に失敗しました。",
    transcribeFailed: "文字起こしに失敗しました。",
    meaning: "意味",
    grammar: "文法",
    vocabulary: "単語",
    example: "例文",
    status: {
      ready: "Ready",
      explaining: "Explaining",
      transcribing: "Transcribing",
      done: "Done",
      sample: "Sample",
      error: "Error"
    }
  },
  zh: {
    eyebrow: "Local Tool",
    title: "Local Transcriber",
    chooseFile: "选择文件",
    sourceLanguage: "音频语言",
    explanationLanguage: "显示・解释语言",
    transcribe: "转文字",
    explanationTitle: "AI 解释",
    explanationEmpty: "点击句子后会显示解释。",
    sentencesTitle: "句子列表",
    sample: "显示示例",
    transcriptEmpty: "转写结果会显示在这里。",
    explaining: "正在生成 AI 解释...",
    transcribing: "正在转写，请稍等...",
    chooseAFile: "请先选择文件",
    explainFailed: "解释失败。",
    transcribeFailed: "转写失败。",
    meaning: "意思",
    grammar: "语法",
    vocabulary: "单词",
    example: "例句",
    status: {
      ready: "Ready",
      explaining: "Explaining",
      transcribing: "Transcribing",
      done: "Done",
      sample: "Sample",
      error: "Error"
    }
  },
  en: {
    eyebrow: "Local Tool",
    title: "Local Transcriber",
    chooseFile: "Choose file",
    sourceLanguage: "Audio language",
    explanationLanguage: "Display / explanation language",
    transcribe: "Transcribe",
    explanationTitle: "AI Explanation",
    explanationEmpty: "Click a sentence to show an explanation.",
    sentencesTitle: "Sentence List",
    sample: "Show Sample",
    transcriptEmpty: "Transcription results will appear here.",
    explaining: "Generating explanation...",
    transcribing: "Transcribing. Please wait...",
    chooseAFile: "Choose a file first",
    explainFailed: "Explanation failed.",
    transcribeFailed: "Transcription failed.",
    meaning: "Meaning",
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    example: "Example",
    status: {
      ready: "Ready",
      explaining: "Explaining",
      transcribing: "Transcribing",
      done: "Done",
      sample: "Sample",
      error: "Error"
    }
  }
};

const t = (key) => ui[explanationLanguage.value]?.[key] || ui.ja[key] || key;

const setStatus = (key, mode = "neutral", rawText = "") => {
  currentStatusKey = key;
  currentStatusMode = mode;
  statusEl.textContent = rawText || ui[explanationLanguage.value]?.status?.[key] || key;
  statusEl.dataset.mode = mode;
};

const applyUiLanguage = () => {
  document.documentElement.lang = explanationLanguage.value === "zh" ? "zh" : explanationLanguage.value;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  if (!selectedFile) {
    setStatus(currentStatusKey, currentStatusMode);
  }
  renderSentences();
  if (explanationEl.dataset.state === "empty") {
    explanationEl.textContent = t("explanationEmpty");
  }
};

const renderSentences = () => {
  sentencesEl.innerHTML = "";
  if (!sentences.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("transcriptEmpty");
    sentencesEl.append(empty);
    return;
  }

  for (const sentence of sentences) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sentence";
    button.textContent = sentence.text;
    button.addEventListener("click", () => explain(sentence));
    sentencesEl.append(button);
  }
};

const renderExplanation = (data) => {
  explanationEl.dataset.state = "result";
  explanationEl.className = "explanation";
  explanationEl.innerHTML = `
    <div>
      <h3>${escapeHtml(t("meaning"))}</h3>
      <p>${escapeHtml(data.translation)}</p>
    </div>
    <div>
      <h3>${escapeHtml(t("grammar"))}</h3>
      <p>${escapeHtml(data.grammar)}</p>
    </div>
    <div>
      <h3>${escapeHtml(t("vocabulary"))}</h3>
      <ul>
        ${data.vocabulary.map((item) => `<li><strong>${escapeHtml(item.word)}</strong><span>${escapeHtml(item.meaning)}</span></li>`).join("")}
      </ul>
    </div>
    <div>
      <h3>${escapeHtml(t("example"))}</h3>
      <p>${escapeHtml(data.example.sentence)}</p>
      <p class="muted">${escapeHtml(data.example.translation)}</p>
    </div>
  `;
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const explain = async (sentence) => {
  setStatus("explaining", "busy");
  explanationEl.dataset.state = "empty";
  explanationEl.className = "empty";
  explanationEl.textContent = t("explaining");

  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentence: sentence.text,
        sourceLanguage: sourceLanguage.value,
        explanationLanguage: explanationLanguage.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("explainFailed"));
    renderExplanation(data);
    setStatus("ready", "success");
  } catch (error) {
    explanationEl.dataset.state = "empty";
    explanationEl.className = "empty error";
    explanationEl.textContent = error.message;
    setStatus("error", "error");
  }
};

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files?.[0] || null;
  if (!selectedFile) return;
  preview.src = URL.createObjectURL(selectedFile);
  preview.style.display = "block";
  setStatus("ready", "success", selectedFile.name);
});

transcribeBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    setStatus("error", "error", t("chooseAFile"));
    return;
  }

  setStatus("transcribing", "busy");
  transcribeBtn.disabled = true;
  sentencesEl.innerHTML = `<p class="empty">${escapeHtml(t("transcribing"))}</p>`;

  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": selectedFile.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(selectedFile.name),
        "X-Source-Language": sourceLanguage.value
      },
      body: selectedFile
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("transcribeFailed"));
    sentences = data.sentences || [];
    renderSentences();
    setStatus("done", "success");
  } catch (error) {
    sentences = [];
    sentencesEl.innerHTML = `<p class="empty error">${escapeHtml(error.message)}</p>`;
    setStatus("error", "error");
  } finally {
    transcribeBtn.disabled = false;
  }
});

sampleBtn.addEventListener("click", () => {
  sentences = sampleSentences;
  renderSentences();
  setStatus("sample", "success");
});

explanationLanguage.addEventListener("change", applyUiLanguage);

explanationEl.dataset.state = "empty";
applyUiLanguage();
