const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const LANGUAGE_MAP = {
  'zh': '中文',
  'en': '英语',
  'ja': '日语',
  'ko': '韩语',
  'fr': '法语',
  'de': '德语',
  'es': '西班牙语',
  'ru': '俄语',
  'pt': '葡萄牙语',
  'it': '意大利语',
  'ar': '阿拉伯语',
  'th': '泰语',
  'vi': '越南语'
};

async function getApiKey() {
  const result = await chrome.storage.sync.get(['apiKey']);
  return result.apiKey || '';
}

async function translateText(text, targetLang) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('请先在插件设置中配置API密钥');
  }

  const targetLangName = LANGUAGE_MAP[targetLang] || targetLang;

  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的翻译助手。请按照以下要求进行翻译：
1. 自动识别原文的语言
2. 将原文翻译成${targetLangName}
3. 如果原文已经是${targetLangName}，请保持原文不变
4. 只返回翻译结果，不要添加任何解释或额外信息
5. 保持原文的格式和换行`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('API密钥无效，请检查配置');
    } else if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后再试');
    }
    throw new Error(errorData.error?.message || `翻译失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request.text, request.targetLang)
      .then(result => {
        sendResponse({ success: true, translation: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    targetLang: 'zh',
    triggerMode: 'select'
  });

  chrome.contextMenus.create({
    id: 'transease-translate',
    title: 'TransEase 翻译',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'transease-translate' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showTranslation',
      text: info.selectionText
    });
  }
});
