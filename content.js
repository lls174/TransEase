let translationPopup = null;
let currentTargetLang = 'zh';

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
  const result = await chrome.storage.sync.get(['targetLang', 'triggerMode']);
  return {
    targetLang: result.targetLang || 'zh',
    triggerMode: result.triggerMode || 'select'
  };
}

function createPopup(selectedText) {
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
        <div class="transease-label">原文</div>
        <div class="transease-text">${escapeHtml(selectedText)}</div>
      </div>
      <div class="transease-translation">
        <div class="transease-label">译文</div>
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

  positionPopup();
  translateText(selectedText);
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
  if (!resultDiv) return;

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

    if (response.success) {
      resultDiv.innerHTML = `<div class="transease-translation-text">${escapeHtml(response.translation)}</div>`;
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
