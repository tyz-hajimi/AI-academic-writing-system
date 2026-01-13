/**
 * PDF工具模块 - PDF加载和文本提取
 */

const fs = require('fs-extra');

let pdfjsLib = null;

// 加载PDF.js库
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  
  try {
    console.log('[DEBUG loadPdfJs] 开始加载 pdfjs-dist...');
    let pdfjsModule;
    try {
      pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
      console.log('[DEBUG loadPdfJs] 使用路径: pdfjs-dist/legacy/build/pdf.mjs');
    } catch (e1) {
      console.log('[DEBUG loadPdfJs] 路径1失败，尝试路径2...');
      try {
        pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
        console.log('[DEBUG loadPdfJs] 使用路径: pdfjs-dist/build/pdf.mjs');
      } catch (e2) {
        console.error('[DEBUG loadPdfJs] 所有导入路径都失败');
        console.error('[DEBUG loadPdfJs] 错误1:', e1.message);
        console.error('[DEBUG loadPdfJs] 错误2:', e2.message);
        throw e2;
      }
    }
    
    pdfjsLib = pdfjsModule.default || pdfjsModule;
    console.log('[DEBUG loadPdfJs] pdfjs-dist 加载成功');
    console.log('[DEBUG loadPdfJs] pdfjsLib 类型:', typeof pdfjsLib);
    console.log('[DEBUG loadPdfJs] getDocument 类型:', typeof pdfjsLib?.getDocument);
    
    if (typeof pdfjsLib?.getDocument !== 'function') {
      throw new Error('pdfjs-dist 加载失败：getDocument 不是函数');
    }
    
    return pdfjsLib;
  } catch (e) {
    console.error('[DEBUG loadPdfJs] 无法加载 pdfjs-dist:', e);
    console.error('[DEBUG loadPdfJs] 错误堆栈:', e.stack);
    throw new Error(`PDF解析库加载失败: ${e.message}`);
  }
};

// PDF文本提取函数
async function extractPDFText(filePath) {
  console.log(`[DEBUG extractPDFText] 开始提取PDF: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[DEBUG extractPDFText] 文件不存在: ${filePath}`);
      return {
        success: false,
        error: `PDF文件不存在: ${filePath}`,
        text: ''
      };
    }
    
    // 检查文件大小（避免处理过大的文件）
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`[DEBUG extractPDFText] 文件大小: ${stats.size} 字节 (${fileSizeMB.toFixed(2)} MB)`);
    
    if (fileSizeMB > 100) {
      console.log(`[DEBUG extractPDFText] 文件过大，超过限制`);
      return {
        success: false,
        error: `PDF文件过大 (${fileSizeMB.toFixed(2)}MB)，超过100MB限制`,
        text: ''
      };
    }
    
    // 读取文件
    console.log(`[DEBUG extractPDFText] 开始读取文件...`);
    const dataBuffer = await fs.readFile(filePath);
    console.log(`[DEBUG extractPDFText] 文件读取完成，缓冲区大小: ${dataBuffer.length} 字节`);
    
    // 检查文件头，确认是PDF
    const fileHeader = dataBuffer.slice(0, 4).toString();
    console.log(`[DEBUG extractPDFText] 文件头: ${fileHeader}`);
    if (!fileHeader.startsWith('%PDF')) {
      console.warn(`[DEBUG extractPDFText] 警告: 文件头不是PDF格式`);
    }
    
    // 使用 pdfjs-dist 解析PDF
    console.log(`[DEBUG extractPDFText] 开始解析PDF (使用 pdfjs-dist)...`);
    
    // 确保 pdfjs-dist 已加载
    if (!pdfjsLib) {
      console.log(`[DEBUG extractPDFText] pdfjsLib 未加载，开始加载...`);
      try {
        pdfjsLib = await loadPdfJs();
        console.log(`[DEBUG extractPDFText] pdfjsLib 加载成功，类型: ${typeof pdfjsLib}`);
        console.log(`[DEBUG extractPDFText] getDocument 类型: ${typeof pdfjsLib?.getDocument}`);
      } catch (loadError) {
        console.error(`[DEBUG extractPDFText] pdfjsLib 加载失败:`, loadError);
        throw new Error(`PDF解析库加载失败: ${loadError.message}`);
      }
    } else {
      console.log(`[DEBUG extractPDFText] pdfjsLib 已加载`);
    }
    
    // 将 Buffer 转换为 Uint8Array（pdfjs-dist 需要）
    const uint8Array = new Uint8Array(dataBuffer);
    
    // 加载PDF文档
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0 // 0 = errors, 1 = warnings, 5 = infos
    });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    console.log(`[DEBUG extractPDFText] PDF加载成功，页数: ${numPages}`);
    
    // 提取所有页面的文本
    let allText = '';
    const textItems = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`[DEBUG extractPDFText] 提取第 ${pageNum}/${numPages} 页...`);
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // 合并文本项
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      allText += pageText + '\n';
      textItems.push(...textContent.items);
      
      console.log(`[DEBUG extractPDFText] 第 ${pageNum} 页提取完成，文本长度: ${pageText.length}`);
    }
    
    // 清理和规范化文本
    let text = allText
      .replace(/\r\n/g, '\n')  // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')  // 多个空行合并为两个
      .replace(/[ \t]+/g, ' ')  // 多个空格合并为一个
      .trim();
    
    console.log(`[DEBUG extractPDFText] 原始文本长度: ${allText.length} 字符`);
    console.log(`[DEBUG extractPDFText] 清理后文本长度: ${text.length} 字符`);
    
    if (text.length === 0) {
      console.warn(`[DEBUG extractPDFText] 警告: PDF文本为空，可能是扫描版PDF`);
    }
    
    // 获取PDF元数据
    let metadataInfo = null;
    try {
      metadataInfo = await pdfDocument.getMetadata();
    } catch (metaError) {
      console.warn(`[DEBUG extractPDFText] 获取元数据失败:`, metaError.message);
    }
    
    const info = metadataInfo?.info || {};
    const metadata = {
      numPages: numPages,
      title: info.Title || null,
      author: info.Author || null,
      subject: info.Subject || null,
      creator: info.Creator || null,
      producer: info.Producer || null,
      creationDate: info.CreationDate || null,
      modificationDate: info.ModDate || null
    };
    console.log(`[DEBUG extractPDFText] 元数据:`, metadata);
    
    // 计算统计信息
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const paragraphs = text.split(/\n\n/).filter(p => p.trim().length > 0);
    
    const stats_result = {
      textLength: text.length,
      numWords: words.length,
      numParagraphs: paragraphs.length,
      numPages: numPages,
      fileSize: stats.size,
      fileSizeMB: fileSizeMB.toFixed(2)
    };
    console.log(`[DEBUG extractPDFText] 统计信息:`, stats_result);
    
    console.log(`[DEBUG extractPDFText] 提取成功！`);
    return {
      success: true,
      text: text,
      metadata: metadata,
      stats: stats_result
    };
  } catch (error) {
    console.error('[DEBUG extractPDFText] PDF文本提取失败:', error);
    console.error('[DEBUG extractPDFText] 错误类型:', error.constructor.name);
    console.error('[DEBUG extractPDFText] 错误消息:', error.message);
    console.error('[DEBUG extractPDFText] 错误堆栈:', error.stack);
    
    // 提供更详细的错误信息
    let errorMessage = 'PDF解析失败';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else if (error.toString) {
      errorMessage += `: ${error.toString()}`;
    }
    
    return {
      success: false,
      error: errorMessage,
      text: '',
      debug: {
        error_type: error.constructor.name,
        error_message: error.message,
        error_stack: error.stack
      }
    };
  }
}

module.exports = {
  loadPdfJs,
  extractPDFText
};
