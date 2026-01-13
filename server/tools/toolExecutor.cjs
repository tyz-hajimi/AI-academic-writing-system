/**
 * 工具执行模块 - 执行各类工具调用
 */

const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const { join } = require('path');
const { randomUUID } = require('crypto');
const fs = require('fs-extra');

const { localStorage } = require('../storage.cjs');
const { extractPDFText } = require('../pdfUtils.cjs');
const { AVAILABLE_TOOLS, RESOURCE_TYPES, generateInsertContent, extractArxivId } = require('./toolDefinitions.cjs');

// 缓存最近的搜索结果（用于标题匹配）
let lastSearchResults = [];

// 根据标题模糊匹配论文
function findPaperByTitle(title) {
  if (!title || !lastSearchResults.length) return null;
  
  const normalizedTitle = title.toLowerCase().trim();
  
  // 精确匹配
  let paper = lastSearchResults.find(p => 
    p.title.toLowerCase().trim() === normalizedTitle
  );
  
  if (paper) return paper;
  
  // 包含匹配
  paper = lastSearchResults.find(p => 
    p.title.toLowerCase().includes(normalizedTitle) || 
    normalizedTitle.includes(p.title.toLowerCase())
  );
  
  if (paper) return paper;
  
  // 关键词匹配（至少匹配3个词）
  const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
  paper = lastSearchResults.find(p => {
    const paperTitle = p.title.toLowerCase();
    const matchCount = titleWords.filter(word => paperTitle.includes(word)).length;
    return matchCount >= Math.min(3, titleWords.length);
  });
  
  return paper;
}

// 根据标题在已下载的PDF中查找
function findDownloadedPdfByTitle(title) {
  if (!title) return null;
  
  const storedData = localStorage.getItem('academic_writing_pdfs');
  const pdfResources = storedData ? JSON.parse(storedData) : [];
  
  const normalizedTitle = title.toLowerCase().trim();
  
  // 在描述或名称中查找匹配
  return pdfResources.find(pdf => {
    const desc = (pdf.description || '').toLowerCase();
    const name = (pdf.name || '').toLowerCase();
    const pdfTitle = (pdf.title || '').toLowerCase();
    
    return desc.includes(normalizedTitle) || 
           normalizedTitle.includes(desc) ||
           pdfTitle.includes(normalizedTitle) ||
           normalizedTitle.includes(pdfTitle) ||
           name.includes(normalizedTitle.replace(/\s+/g, ''));
  });
}

// 执行工具调用
async function executeTool(tool_name, parameters, editor_content) {
  let result;
  
  switch (tool_name) {
    case 'search_papers':
      result = await executeSearchPapers(parameters);
      break;
    case 'download_paper':
      result = await executeDownloadPaper(parameters);
      break;
    case 'read_pdf_content':
      result = await executeReadPdfContent(parameters);
      break;
    case 'view_file':
      result = executeViewFile(parameters, editor_content);
      break;
    case 'edit_file':
      result = executeEditFile(parameters, editor_content);
      break;
    case 'search_in_file':
      result = executeSearchInFile(parameters, editor_content);
      break;
    case 'list_resources':
      result = executeListResources(parameters);
      break;
    case 'add_resource':
      result = executeAddResource(parameters);
      break;
    case 'insert_resource':
      result = executeInsertResource(parameters);
      break;
    default:
      result = { success: false, error: `不支持的工具: ${tool_name}` };
  }
  
  return result;
}

// 搜索论文
async function executeSearchPapers(parameters) {
  try {
    const arxivResponse = await axios.get(
      `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(parameters.query)}&start=0&max_results=${parameters.max_results || 10}`
    );
    
    const xmlResult = await parseStringPromise(arxivResponse.data, { explicitArray: false, mergeAttrs: true });
    const entries = xmlResult.feed.entry || [];
    const entriesArray = Array.isArray(entries) ? entries : [entries];
    
    const papers = entriesArray.map(entry => {
      const id = entry.id || '';
      let arxivId = extractArxivId(id);
      let pdfUrl = null;
      
      if (!arxivId && entry.link) {
        const linkArray = Array.isArray(entry.link) ? entry.link : [entry.link];
        for (const link of linkArray) {
          if (link.$ && link.$.type === 'application/pdf' && link.$.href) {
            pdfUrl = link.$.href;
            arxivId = extractArxivId(link.$.href);
          }
          if (!arxivId && link.$ && link.$.href && link.$.href.includes('arxiv.org/abs/')) {
            arxivId = extractArxivId(link.$.href);
          }
        }
      }
      
      if (!pdfUrl && arxivId) {
        pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
      }
      
      const authors = [];
      if (entry.author) {
        const authorArray = Array.isArray(entry.author) ? entry.author : [entry.author];
        authorArray.forEach(author => { if (author.name) authors.push(author.name); });
      }
      
      const summary = entry.summary?.trim() || '';
      
      return {
        arxiv_id: arxivId,
        title: entry.title?.trim() || '',
        authors,
        abstract: summary.substring(0, 500) + (summary.length > 500 ? '...' : ''),
        published: entry.published || '',
        has_pdf: !!pdfUrl
      };
    });
    
    // 缓存搜索结果（用于后续标题匹配）
    lastSearchResults = papers;
    console.log(`[ToolExecutor] 搜索完成，缓存 ${papers.length} 篇论文用于标题匹配`);
    
    return { success: true, data: { query: parameters.query, count: papers.length, papers } };
  } catch (error) {
    console.error('arXiv搜索失败:', error);
    return { success: false, error: `arXiv搜索失败: ${error.message || '未知错误'}` };
  }
}

// 下载论文
async function executeDownloadPaper(parameters) {
  const { arxiv_id, title } = parameters;
  
  let targetArxivId = arxiv_id;
  let matchedPaper = null;
  
  // 如果提供了标题，优先通过标题查找
  if (title) {
    matchedPaper = findPaperByTitle(title);
    if (matchedPaper) {
      targetArxivId = matchedPaper.arxiv_id;
      console.log(`[ToolExecutor] 通过标题 "${title}" 匹配到论文: ${matchedPaper.title} (${targetArxivId})`);
    } else {
      return { 
        success: false, 
        error: `未找到标题匹配的论文: "${title}"。请先使用 search_papers 搜索论文，或直接提供 arxiv_id。`,
        suggestion: '可用的论文标题: ' + lastSearchResults.slice(0, 5).map(p => p.title).join('; ')
      };
    }
  }
  
  if (!targetArxivId) {
    return { success: false, error: '请提供论文标题(title)或arXiv ID(arxiv_id)' };
  }
  
  const cleanArxivId = targetArxivId.split('v')[0].trim();
  const pdfUrl = `https://arxiv.org/pdf/${cleanArxivId}.pdf`;
  
  try {
    const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const downloadsDir = join(process.cwd(), 'downloads');
    
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    const filePath = join(downloadsDir, `${cleanArxivId}.pdf`);
    fs.writeFileSync(filePath, pdfResponse.data);
    
    // 提取PDF文本
    let extractedText = '';
    let extractionResult = null;
    try {
      extractionResult = await extractPDFText(filePath);
      if (extractionResult.success) {
        extractedText = extractionResult.text;
        console.log(`PDF文本提取成功: ${extractionResult.stats.textLength}字符`);
      }
    } catch (extractError) {
      console.warn('PDF文本提取异常:', extractError);
    }
    
    const pdfBuffer = Buffer.from(pdfResponse.data);
    const paperTitle = matchedPaper?.title || `arXiv论文: ${cleanArxivId}`;
    const pdfResource = {
      id: randomUUID(),
      name: `${cleanArxivId}.pdf`,
      title: paperTitle,  // 保存论文标题
      description: paperTitle,
      arxiv_id: cleanArxivId,
      authors: matchedPaper?.authors || [],
      dataUrl: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      fileSize: pdfBuffer.length,
      uploadDate: new Date().toISOString(),
      extractedText,
      textStats: extractionResult?.success ? {
        textLength: extractionResult.stats.textLength,
        numWords: extractionResult.stats.numWords,
        numPages: extractionResult.metadata.numPages
      } : null,
      hasTextContent: !!extractedText
    };
    
    // 保存到存储
    const storedData = localStorage.getItem('academic_writing_pdfs');
    let pdfResources = storedData ? JSON.parse(storedData) : [];
    
    const existingIndex = pdfResources.findIndex(r => r.name === pdfResource.name);
    if (existingIndex !== -1) {
      pdfResources[existingIndex] = pdfResource;
    } else {
      pdfResources.push(pdfResource);
    }
    
    localStorage.setItem('academic_writing_pdfs', JSON.stringify(pdfResources));
    
    return {
      success: true,
      data: {
        message: `论文已下载: "${paperTitle}"`,
        title: paperTitle,
        arxiv_id: cleanArxivId,
        filename: `${cleanArxivId}.pdf`,
        file_path: filePath,
        pdf_url: pdfUrl,
        resource_id: pdfResource.id,
        resource_type: 'pdfs'
      }
    };
  } catch (error) {
    console.error('下载论文失败:', error);
    return { success: false, error: `下载论文失败: ${error.message}` };
  }
}

// 读取PDF内容
async function executeReadPdfContent(parameters) {
  const { resource_id, arxiv_id, filename, title } = parameters;
  
  if (!resource_id && !arxiv_id && !filename && !title) {
    return { success: false, error: '请提供论文标题(title)、resource_id、arxiv_id或filename参数之一' };
  }
  
  try {
    const storedData = localStorage.getItem('academic_writing_pdfs');
    const pdfResources = storedData ? JSON.parse(storedData) : [];
    
    let pdfResource = null;
    
    // 优先通过标题查找
    if (title) {
      pdfResource = findDownloadedPdfByTitle(title);
      if (pdfResource) {
        console.log(`[ToolExecutor] 通过标题 "${title}" 找到已下载的论文: ${pdfResource.name}`);
      }
    }
    
    // 其他查找方式
    if (!pdfResource && resource_id) {
      pdfResource = pdfResources.find(r => r.id === resource_id);
    }
    if (!pdfResource && arxiv_id) {
      const cleanArxivId = arxiv_id.split('v')[0].trim();
      pdfResource = pdfResources.find(r => {
        const resourceName = r.name.replace('.pdf', '');
        return resourceName === cleanArxivId || resourceName === arxiv_id || r.arxiv_id === cleanArxivId;
      });
    }
    if (!pdfResource && filename) {
      pdfResource = pdfResources.find(r => r.name === filename);
    }
    
    if (!pdfResource) {
      return {
        success: false,
        error: `未找到指定的PDF资源${title ? `: "${title}"` : ''}`,
        available_papers: pdfResources.map(r => ({ 
          title: r.title || r.description, 
          arxiv_id: r.arxiv_id,
          name: r.name 
        }))
      };
    }
    
    let pdfText = pdfResource.extractedText || '';
    let textSource = 'stored';
    
    // 如果文本为空，尝试从文件提取
    if (!pdfText || pdfText.length < 100) {
      const filePath = join(process.cwd(), 'downloads', pdfResource.name);
      
      if (fs.existsSync(filePath)) {
        const extractionResult = await extractPDFText(filePath);
        
        if (extractionResult.success && extractionResult.text) {
          pdfText = extractionResult.text;
          textSource = 'extracted';
          
          // 更新存储
          pdfResource.extractedText = pdfText;
          pdfResource.textStats = extractionResult.stats;
          pdfResource.hasTextContent = true;
          
          const index = pdfResources.findIndex(r => r.id === pdfResource.id);
          if (index !== -1) {
            pdfResources[index] = pdfResource;
            localStorage.setItem('academic_writing_pdfs', JSON.stringify(pdfResources));
          }
        }
      }
    }
    
    if (!pdfText) {
      return { success: false, error: '无法获取PDF文本内容' };
    }
    
    return {
      success: true,
      data: {
        resource_id: pdfResource.id,
        title: pdfResource.title || pdfResource.description,
        arxiv_id: pdfResource.arxiv_id,
        name: pdfResource.name,
        text: pdfText,
        text_source: textSource,
        text_stats: pdfResource.textStats || { textLength: pdfText.length, numWords: pdfText.split(/\s+/).length },
        full_text_length: pdfText.length
      }
    };
  } catch (error) {
    console.error('读取PDF内容异常:', error);
    return { success: false, error: `读取PDF内容失败: ${error.message}` };
  }
}

// 查看文件
function executeViewFile(parameters, editor_content) {
  if (!editor_content) {
    return { success: false, error: '编辑器内容为空' };
  }
  
  return {
    success: true,
    data: {
      file_path: parameters.file_path || 'main.tex',
      content: editor_content,
      stats: { lines: editor_content.split('\n').length, characters: editor_content.length },
      preview: editor_content.substring(0, 1000) + (editor_content.length > 1000 ? '...' : '')
    }
  };
}

// 编辑文件
function executeEditFile(parameters, editor_content) {
  if (!editor_content) {
    return { success: false, error: '编辑器内容为空' };
  }
  
  const { operation, content, target_text, position } = parameters;
  let newContent = editor_content;
  
  switch (operation) {
    case 'append':
      newContent = editor_content + '\n\n' + content;
      break;
    case 'replace':
      if (!target_text || !editor_content.includes(target_text)) {
        return { success: false, error: '未找到要替换的目标文本' };
      }
      newContent = editor_content.replace(target_text, content);
      break;
    case 'insert_at':
      if (position === undefined || position < 0 || position > editor_content.length) {
        return { success: false, error: '插入位置无效' };
      }
      newContent = editor_content.slice(0, position) + content + editor_content.slice(position);
      break;
    default:
      return { success: false, error: `不支持的操作类型: ${operation}` };
  }
  
  return {
    success: true,
    data: {
      operation,
      new_content: newContent,
      message: `文件已成功${operation === 'append' ? '追加' : operation === 'replace' ? '替换' : '插入'}内容`,
      stats: {
        old_lines: editor_content.split('\n').length,
        new_lines: newContent.split('\n').length,
        lines_added: newContent.split('\n').length - editor_content.split('\n').length
      }
    }
  };
}

// 在文件中搜索
function executeSearchInFile(parameters, editor_content) {
  if (!editor_content) {
    return { success: false, error: '编辑器内容为空' };
  }
  
  const { search_text, case_sensitive = false } = parameters;
  
  if (!search_text) {
    return { success: false, error: '搜索文本不能为空' };
  }
  
  const searchContent = case_sensitive ? editor_content : editor_content.toLowerCase();
  const searchText = case_sensitive ? search_text : search_text.toLowerCase();
  
  const matches = [];
  const lines = editor_content.split('\n');
  
  lines.forEach((line, i) => {
    const searchLine = case_sensitive ? line : line.toLowerCase();
    let pos = searchLine.indexOf(searchText);
    while (pos !== -1) {
      const start = Math.max(0, pos - 20);
      const end = Math.min(line.length, pos + search_text.length + 20);
      matches.push({ line: i + 1, position: pos, context: line.substring(start, end) });
      pos = searchLine.indexOf(searchText, pos + 1);
    }
  });
  
  return { success: true, data: { search_text, case_sensitive, total_matches: matches.length, matches: matches.slice(0, 20) } };
}

// 列出资源
function executeListResources(parameters) {
  const { resource_type } = parameters;
  
  if (!resource_type) {
    return { success: false, error: '资源类型不能为空' };
  }
  
  if (resource_type === 'all') {
    const allResources = {};
    RESOURCE_TYPES.forEach(type => {
      const storedData = localStorage.getItem(`academic_writing_${type}`);
      allResources[type] = storedData ? JSON.parse(storedData) : [];
    });
    return { success: true, data: { resource_type: 'all', resources: allResources } };
  }
  
  if (!RESOURCE_TYPES.includes(resource_type)) {
    return { success: false, error: '无效的资源类型' };
  }
  
  const storedData = localStorage.getItem(`academic_writing_${resource_type}`);
  const resources = storedData ? JSON.parse(storedData) : [];
  
  return { success: true, data: { resource_type, resources, count: resources.length } };
}

// 添加资源
function executeAddResource(parameters) {
  const { resource_type, resource_data } = parameters;
  
  if (!resource_type || !RESOURCE_TYPES.includes(resource_type)) {
    return { success: false, error: '无效的资源类型' };
  }
  
  if (!resource_data || typeof resource_data !== 'object') {
    return { success: false, error: '资源数据不能为空' };
  }
  
  const storedData = localStorage.getItem(`academic_writing_${resource_type}`);
  let resources = storedData ? JSON.parse(storedData) : [];
  
  if (!resource_data.id) {
    resource_data.id = randomUUID();
  } else {
    const existingIndex = resources.findIndex(r => r.id === resource_data.id);
    if (existingIndex !== -1) {
      resources[existingIndex] = resource_data;
      localStorage.setItem(`academic_writing_${resource_type}`, JSON.stringify(resources));
      return { success: true, data: { message: '资源更新成功', resource_type, resource_id: resource_data.id, updated: true } };
    }
  }
  
  // 对于PDF检查同名文件
  if (resource_type === 'pdfs' && resource_data.name) {
    const existingIndex = resources.findIndex(r => r.name === resource_data.name);
    if (existingIndex !== -1) {
      resources[existingIndex] = resource_data;
      localStorage.setItem(`academic_writing_${resource_type}`, JSON.stringify(resources));
      return { success: true, data: { message: '资源更新成功', resource_type, resource_id: resource_data.id, updated: true } };
    }
  }
  
  resources.push(resource_data);
  localStorage.setItem(`academic_writing_${resource_type}`, JSON.stringify(resources));
  
  return { success: true, data: { message: '资源添加成功', resource_type, resource_id: resource_data.id, updated: false } };
}

// 插入资源引用
function executeInsertResource(parameters) {
  const { resource_type, resource_id, insert_format = 'latex' } = parameters;
  
  if (!resource_type || !RESOURCE_TYPES.includes(resource_type)) {
    return { success: false, error: '无效的资源类型' };
  }
  
  if (!resource_id) {
    return { success: false, error: '资源ID不能为空' };
  }
  
  const storedData = localStorage.getItem(`academic_writing_${resource_type}`);
  const resources = storedData ? JSON.parse(storedData) : [];
  const resource = resources.find(r => r.id === resource_id);
  
  if (!resource) {
    return { success: false, error: '未找到指定的资源' };
  }
  
  const insertContent = generateInsertContent(resource, resource_type, insert_format);
  
  return { success: true, data: { resource_type, resource_id, insert_format, content: insertContent } };
}

module.exports = {
  AVAILABLE_TOOLS,
  executeTool,
  generateInsertContent
};
