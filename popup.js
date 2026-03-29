document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const targetLangSelect = document.getElementById('targetLang');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  const result = await chrome.storage.sync.get(['apiKey', 'targetLang']);
  
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  
  if (result.targetLang) {
    targetLangSelect.value = result.targetLang;
  }

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const targetLang = targetLangSelect.value;

    if (!apiKey) {
      showStatus('请输入API密钥', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({
        apiKey: apiKey,
        targetLang: targetLang
      });
      showStatus('设置已保存!', 'success');
    } catch (error) {
      showStatus('保存失败: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
});
