import React, { useState, useEffect } from 'react';
import { agentService } from '../services/agentService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySaved: (model: 'deepseek' | 'qwen', apiKey: string) => void;
  onApiKeyStatusChange?: (status: { deepseek: boolean; qwen: boolean }) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  isOpen, 
  onClose, 
  onApiKeySaved,
  onApiKeyStatusChange
}) => {
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>('');
  const [qwenApiKey, setQwenApiKey] = useState<string>('');
  const [showDeepseekApiKey, setShowDeepseekApiKey] = useState<boolean>(false);
  const [showQwenApiKey, setShowQwenApiKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; model?: 'deepseek' | 'qwen' } | null>(null);

  // 模型配置信息
  const modelConfig = {
    deepseek: {
      name: 'DeepSeek',
      description: 'DeepSeek API 提供强大的语言模型能力，支持 deepseek-chat 和 deepseek-reasoner 模型',
      placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      pattern: /^sk-[a-zA-Z0-9]{32,}$/,
      helpText: 'DeepSeek API Key 应以 "sk-" 开头，后面跟随至少32个字母数字字符',
      url: 'https://platform.deepseek.com/api-keys',
      features: ['学术写作', '论文润色', '研究辅助', '深度推理'],
      pricing: '按使用量计费，新用户有免费额度'
    },
    qwen: {
      name: '通义千问 (Qwen)',
      description: '阿里云通义千问 API，提供中文优化的语言模型服务',
      placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      pattern: /^sk-[a-zA-Z0-9]{32,}$/,
      helpText: '通义千问 API Key 应以 "sk-" 开头，后面跟随至少32个字母数字字符',
      url: 'https://dashscope.console.aliyun.com/apiKey',
      features: ['中文优化', '学术写作', '代码生成', '多模态能力'],
      pricing: '按调用次数计费，提供免费试用额度'
    }
  };

  // 加载已保存的API Key
  useEffect(() => {
    if (isOpen) {
      const savedDeepseekKey = loadApiKey('deepseek');
      const savedQwenKey = loadApiKey('qwen');
      setDeepseekApiKey(savedDeepseekKey);
      setQwenApiKey(savedQwenKey);
      setTestResult(null);
    }
  }, [isOpen]);

  // 从localStorage加载API Key
  const loadApiKey = (modelType: 'deepseek' | 'qwen'): string => {
    try {
      const savedApiKey = localStorage.getItem(`apiKey_${modelType}`);
      if (savedApiKey) {
        // 检查是否是base64编码的格式
        if (savedApiKey.length > 20 && /^[A-Za-z0-9+/]*={0,2}$/.test(savedApiKey)) {
          try {
            // 尝试解码存储的API Key
            const decoded = atob(savedApiKey);
            // 验证解码后的内容是否像API key
            if (decoded.startsWith('sk-') && decoded.length >= 32) {
              return decoded;
            }
          } catch (decodeError) {
            console.warn('Base64解码失败，可能是旧格式:', decodeError);
          }
        }
        
        // 如果不是base64格式或解码失败，检查是否是直接的API key格式
        if (savedApiKey.startsWith('sk-') && savedApiKey.length >= 32) {
          return savedApiKey;
        }
      }
    } catch (error) {
      console.error('加载API Key失败:', error);
    }
    return '';
  };

  // 验证API Key格式
  const validateApiKey = (key: string, model: 'deepseek' | 'qwen'): boolean => {
    if (!key || key.trim().length === 0) {
      return false;
    }
    
    return modelConfig[model].pattern.test(key);
  };

  // 测试DeepSeek API Key（使用流式请求）
  const handleTestDeepseekApiKey = async () => {
    if (!validateApiKey(deepseekApiKey, 'deepseek')) {
      setTestResult({
        success: false,
        message: 'DeepSeek API Key格式不正确，请检查格式',
        model: 'deepseek'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // DeepSeek 使用流式请求
      await agentService.sendStreamRequest({
        content: '测试',
        input: '你好，请回复"测试成功"',
        mode: 'discuss',
        model: 'deepseek',
        apiKey: deepseekApiKey
      }, () => {
        // 忽略流式事件，只关心是否成功
      });

      setTestResult({
        success: true,
        message: '✅ DeepSeek API Key测试成功！可以正常使用。',
        model: 'deepseek'
      });
    } catch (error) {
      let errorMsg = 'DeepSeek API Key测试失败：';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('无效') || error.message.includes('Unauthorized')) {
          errorMsg += 'API Key无效或已过期';
        } else if (error.message.includes('403')) {
          errorMsg += 'API Key权限不足';
        } else if (error.message.includes('网络') || error.message.includes('NETWORK')) {
          errorMsg += '网络连接失败';
        } else {
          errorMsg += error.message;
        }
      } else {
        errorMsg += '未知错误';
      }
      
      setTestResult({
        success: false,
        message: errorMsg,
        model: 'deepseek'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 测试Qwen API Key
  const handleTestQwenApiKey = async () => {
    if (!validateApiKey(qwenApiKey, 'qwen')) {
      setTestResult({
        success: false,
        message: 'Qwen API Key格式不正确，请检查格式',
        model: 'qwen'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      await agentService.sendRequest({
        content: '测试',
        input: '你好，请回复"测试成功"',
        mode: 'discuss',
        model: 'qwen',
        apiKey: qwenApiKey
      });

      setTestResult({
        success: true,
        message: '✅ Qwen API Key测试成功！可以正常使用。',
        model: 'qwen'
      });
    } catch (error) {
      let errorMsg = 'Qwen API Key测试失败：';
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMsg += 'API Key无效或已过期';
        } else if (error.message.includes('403')) {
          errorMsg += 'API Key权限不足';
        } else if (error.message.includes('网络')) {
          errorMsg += '网络连接失败';
        } else {
          errorMsg += error.message;
        }
      } else {
        errorMsg += '未知错误';
      }
      
      setTestResult({
        success: false,
        message: errorMsg,
        model: 'qwen'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存所有API Key
  const handleSaveAllApiKeys = () => {
    try {
      const status = { deepseek: false, qwen: false };
      
      // 保存DeepSeek API Key（同时用于 deepseek-chat 和 deepseek-reasoner）
      if (validateApiKey(deepseekApiKey, 'deepseek')) {
        const encodedDeepseekKey = btoa(deepseekApiKey);
        localStorage.setItem('apiKey_deepseek', encodedDeepseekKey);
        onApiKeySaved('deepseek', deepseekApiKey);
        status.deepseek = true;
      }

      // 保存Qwen API Key
      if (validateApiKey(qwenApiKey, 'qwen')) {
        const encodedQwenKey = btoa(qwenApiKey);
        localStorage.setItem('apiKey_qwen', encodedQwenKey);
        onApiKeySaved('qwen', qwenApiKey);
        status.qwen = true;
      }

      localStorage.setItem('apiKeyStatus', JSON.stringify(status));
      
      if (onApiKeyStatusChange) {
        onApiKeyStatusChange(status);
      }

      onClose();
    } catch (error) {
      setTestResult({
        success: false,
        message: '保存失败：存储API Key时发生错误'
      });
    }
  };

  // 清除DeepSeek API Key
  const handleClearDeepseekApiKey = () => {
    localStorage.removeItem('apiKey_deepseek');
    setDeepseekApiKey('');
    setTestResult({
      success: true,
      message: 'DeepSeek API Key已清除',
      model: 'deepseek'
    });
  };

  // 清除Qwen API Key
  const handleClearQwenApiKey = () => {
    localStorage.removeItem('apiKey_qwen');
    setQwenApiKey('');
    setTestResult({
      success: true,
      message: 'Qwen API Key已清除',
      model: 'qwen'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API Key 配置</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="api-config-container">
            {/* DeepSeek 配置 */}
            <div className="model-config-section">
              <div className="model-info">
                <h3>{modelConfig.deepseek.name}</h3>
                <p className="model-description">{modelConfig.deepseek.description}</p>
                <div className="model-features">
                  <strong>主要功能：</strong>
                  <ul>
                    {modelConfig.deepseek.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <div className="model-pricing">
                  <strong>计费方式：</strong> {modelConfig.deepseek.pricing}
                </div>
                <button className="get-apikey-btn" onClick={() => window.open(modelConfig.deepseek.url, '_blank')}>
                  获取 {modelConfig.deepseek.name} API Key →
                </button>
              </div>

              <div className="api-key-form">
                <label className="form-label">DeepSeek API Key:</label>
                <div className="key-input-container">
                  <input
                    type={showDeepseekApiKey ? 'text' : 'password'}
                    value={deepseekApiKey}
                    onChange={(e) => setDeepseekApiKey(e.target.value)}
                    placeholder={modelConfig.deepseek.placeholder}
                    className="key-input"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowDeepseekApiKey(!showDeepseekApiKey)}
                    className="toggle-key-visibility"
                  >
                    {showDeepseekApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
                <div className="help-text">{modelConfig.deepseek.helpText}</div>
              </div>

              <div className="button-group">
                <button 
                  onClick={handleTestDeepseekApiKey} 
                  disabled={isTesting || !deepseekApiKey.trim()}
                  className="test-btn"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button 
                  onClick={handleClearDeepseekApiKey} 
                  className="clear-btn"
                >
                  清除
                </button>
              </div>
            </div>


            {/* Qwen 配置 */}
            <div className="model-config-section">
              <div className="model-info">
                <h3>{modelConfig.qwen.name}</h3>
                <p className="model-description">{modelConfig.qwen.description}</p>
                <div className="model-features">
                  <strong>主要功能：</strong>
                  <ul>
                    {modelConfig.qwen.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <div className="model-pricing">
                  <strong>计费方式：</strong> {modelConfig.qwen.pricing}
                </div>
                <button className="get-apikey-btn" onClick={() => window.open(modelConfig.qwen.url, '_blank')}>
                  获取 {modelConfig.qwen.name} API Key →
                </button>
              </div>

              <div className="api-key-form">
                <label className="form-label">Qwen API Key:</label>
                <div className="key-input-container">
                  <input
                    type={showQwenApiKey ? 'text' : 'password'}
                    value={qwenApiKey}
                    onChange={(e) => setQwenApiKey(e.target.value)}
                    placeholder={modelConfig.qwen.placeholder}
                    className="key-input"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowQwenApiKey(!showQwenApiKey)}
                    className="toggle-key-visibility"
                  >
                    {showQwenApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
                <div className="help-text">{modelConfig.qwen.helpText}</div>
              </div>

              <div className="button-group">
                <button 
                  onClick={handleTestQwenApiKey} 
                  disabled={isTesting || !qwenApiKey.trim()}
                  className="test-btn"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button 
                  onClick={handleClearQwenApiKey} 
                  className="clear-btn"
                >
                  清除
                </button>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.message}
            </div>
          )}

          <div className="modal-footer">
            <button onClick={handleSaveAllApiKeys} className="save-btn">
              保存所有配置
            </button>
            <button onClick={onClose} className="cancel-btn">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;