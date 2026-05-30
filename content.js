let translationPopup = null;
let currentTargetLang = 'zh';
let isSpeaking = false;
let speakingType = null;

const BCP47_MAP = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  ru: 'ru-RU',
  pt: 'pt-BR',
  it: 'it-IT',
  ar: 'ar-SA',
  th: 'th-TH',
  vi: 'vi-VN'
};

const LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'it', name: '意大利语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'th', name: '泰语' },
  { code: 'vi', name: '越南语' }
];

async function getSettings() {
  const result = await chrome.storage.sync.get(['targetLang']);
  return {
    targetLang: result.targetLang || 'zh'
  };
}

async function createPopup(selectedText) {
  const settings = await getSettings();
  currentTargetLang = settings.targetLang;
  stopSpeaking();
  removePopup();

  translationPopup = document.createElement('div');
  translationPopup.id = 'transease-popup';
  translationPopup.innerHTML = `
    <div class="transease-header">
      <span class="transease-title">TransEase</span>
      <select class="transease-lang-select" id="transease-lang-selector">
        ${LANGUAGES.map(lang => 
          `<option value="${lang.code}" ${lang.code === currentTargetLang ? 'selected' : ''}>${lang.name}</option>`
        ).join('')}
      </select>
      <button class="transease-close-btn" id="transease-close">&times;</button>
    </div>
    <div class="transease-content">
      <div class="transease-original">
        <div class="transease-section-header">
          <div class="transease-label">原文</div>
          <button type="button" class="transease-speak-icon-btn" id="transease-speak-original" title="朗读原文">朗读</button>
        </div>
        <div class="transease-text transease-original-text" id="transease-original">${escapeHtml(selectedText)}</div>
      </div>
      <div class="transease-translation">
        <div class="transease-section-header">
          <div class="transease-label">译文</div>
          <button type="button" class="transease-speak-icon-btn" id="transease-speak-translation" title="朗读译文" disabled>朗读</button>
        </div>
        <div class="transease-text transease-result" id="transease-result">
          <div class="transease-loading">
            <div class="transease-spinner"></div>
            <span>翻译中...</span>
          </div>
        </div>
      </div>
    </div>
    <div class="transease-footer">
      <button class="transease-copy-btn" id="transease-copy">复制译文</button>
    </div>
  `;

  document.body.appendChild(translationPopup);

  const langSelector = document.getElementById('transease-lang-selector');
  langSelector.addEventListener('change', (e) => {
    currentTargetLang = e.target.value;
    chrome.storage.sync.set({ targetLang: currentTargetLang });
    translateText(selectedText);
  });

  document.getElementById('transease-close').addEventListener('click', removePopup);
  document.getElementById('transease-copy').addEventListener('click', copyTranslation);
  document.getElementById('transease-speak-original').addEventListener('click', () => toggleSpeak('original'));
  document.getElementById('transease-speak-translation').addEventListener('click', () => toggleSpeak('translation'));

  positionPopup();
  translateText(selectedText);
}

function detectTextLang(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar-SA';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th-TH';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru-RU';
  if (/[\u00c0-\u024f]/.test(text)) return 'fr-FR';
  if (/[\u0370-\u03ff]/.test(text)) return 'el-GR';
  return 'en-US';
}

function updateSpeakButtons() {
  const originalBtn = document.getElementById('transease-speak-original');
  const translationBtn = document.getElementById('transease-speak-translation');
  if (!originalBtn || !translationBtn) return;

  const isOriginalSpeaking = isSpeaking && speakingType === 'original';
  const isTranslationSpeaking = isSpeaking && speakingType === 'translation';

  originalBtn.textContent = isOriginalSpeaking ? '停止' : '朗读';
  translationBtn.textContent = isTranslationSpeaking ? '停止' : '朗读';
  originalBtn.classList.toggle('transease-speaking', isOriginalSpeaking);
  translationBtn.classList.toggle('transease-speaking', isTranslationSpeaking);
}

function stopSpeaking() {
  if (window.speechSynthesis && (window.speechSynthesis.speaking || isSpeaking)) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  speakingType = null;
  updateSpeakButtons();
}

function toggleSpeak(type) {
  if (isSpeaking && speakingType === type) {
    stopSpeaking();
    return;
  }

  let text = '';
  let lang = '';

  if (type === 'original') {
    const originalEl = document.getElementById('transease-original');
    if (!originalEl) return;
    text = originalEl.textContent.trim();
    lang = detectTextLang(text);
  } else {
    const translationEl = document.querySelector('#transease-result .transease-translation-text');
    if (!translationEl) return;
    text = translationEl.textContent.trim();
    lang = BCP47_MAP[currentTargetLang] || currentTargetLang;
  }

  if (!text) return;
  speakText(text, lang, type);
}

function speakText(text, lang, type) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  utterance.onstart = () => {
    isSpeaking = true;
    speakingType = type;
    updateSpeakButtons();
  };

  utterance.onend = () => {
    isSpeaking = false;
    speakingType = null;
    updateSpeakButtons();
  };

  utterance.onerror = () => {
    isSpeaking = false;
    speakingType = null;
    updateSpeakButtons();
  };

  window.speechSynthesis.speak(utterance);
}

function positionPopup() {
  if (!translationPopup) return;

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const popupWidth = 360;
  const popupHeight = translationPopup.offsetHeight || 200;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 10;

  if (left + popupWidth > window.innerWidth) {
    left = window.innerWidth - popupWidth - 20;
  }
  if (left < 10) {
    left = 10;
  }

  if (top + popupHeight > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - popupHeight - 10;
  }

  translationPopup.style.left = `${left}px`;
  translationPopup.style.top = `${top}px`;
}

function removePopup() {
  stopSpeaking();
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function translateText(text) {
  const resultDiv = document.getElementById('transease-result');
  const translationSpeakBtn = document.getElementById('transease-speak-translation');
  if (!resultDiv) return;

  stopSpeaking();
  if (translationSpeakBtn) {
    translationSpeakBtn.disabled = true;
  }

  resultDiv.innerHTML = `
    <div class="transease-loading">
      <div class="transease-spinner"></div>
      <span>翻译中...</span>
    </div>
  `;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      targetLang: currentTargetLang
    });

    if (!response) {
      resultDiv.innerHTML = `<div class="transease-error">扩展连接失败，请刷新页面后重试</div>`;
      return;
    }

    if (response.success) {
      resultDiv.innerHTML = `<div class="transease-translation-text">${escapeHtml(response.translation)}</div>`;
      if (translationSpeakBtn) {
        translationSpeakBtn.disabled = false;
      }
    } else {
      resultDiv.innerHTML = `<div class="transease-error">${escapeHtml(response.error)}</div>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<div class="transease-error">翻译失败: ${escapeHtml(error.message)}</div>`;
  }
}

function copyTranslation() {
  const resultDiv = document.getElementById('transease-result');
  if (!resultDiv) return;

  const translationText = resultDiv.querySelector('.transease-translation-text');
  if (translationText) {
    navigator.clipboard.writeText(translationText.textContent).then(() => {
      const copyBtn = document.getElementById('transease-copy');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '已复制!';
      copyBtn.classList.add('transease-copied');
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('transease-copied');
      }, 1500);
    });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showTranslation') {
    const selectedText = request.text;
    if (selectedText && selectedText.length > 0) {
      createPopup(selectedText);
    }
  }
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#transease-popup')) {
    removePopup();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removePopup();
  }
});

window.addEventListener('scroll', () => {
  if (translationPopup) {
    positionPopup();
  }
});

window.addEventListener('resize', () => {
  if (translationPopup) {
    positionPopup();
  }
});
