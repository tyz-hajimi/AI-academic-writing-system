/**
 * 工具定义模块 - AI可调用的工具列表
 */

// 工具列表定义
const AVAILABLE_TOOLS = [
  {
    name: 'search_papers',
    description: '在arXiv数据库中搜索学术论文。返回结果包含论文的arXiv ID，可用于下载PDF文件',
    parameters: {
      query: { type: 'string', description: '搜索关键词', required: true },
      max_results: { type: 'number', description: '返回的最大结果数量', required: false, default: 10 }
    }
  },
  {
    name: 'download_paper',
    description: '下载指定论文的PDF文件。可以使用论文标题（从搜索结果中获取）或arXiv ID下载',
    parameters: {
      title: { type: 'string', description: '论文标题（优先使用，会自动匹配最近搜索结果中的论文）', required: false },
      arxiv_id: { type: 'string', description: 'arXiv论文ID（例如：2301.07041）', required: false }
    }
  },
  {
    name: 'read_pdf_content',
    description: '读取已下载PDF论文的文本内容。可以通过论文标题、资源ID、arxiv_id或文件名访问',
    parameters: {
      title: { type: 'string', description: '论文标题（会模糊匹配已下载的论文）', required: false },
      resource_id: { type: 'string', description: '资源ID（从list_resources获取）', required: false },
      arxiv_id: { type: 'string', description: 'arXiv论文ID', required: false },
      filename: { type: 'string', description: 'PDF文件名', required: false }
    }
  },
  {
    name: 'view_file',
    description: '查看当前编辑器中的文件内容',
    parameters: {
      file_path: { type: 'string', description: '文件路径', required: false, default: 'main.tex' }
    }
  },
  {
    name: 'edit_file',
    description: '修改当前编辑器中的文件内容',
    parameters: {
      operation: { type: 'string', description: '操作类型：append/replace/insert_at', required: true },
      content: { type: 'string', description: '要添加或替换的内容', required: true },
      target_text: { type: 'string', description: '要替换的目标文本', required: false },
      position: { type: 'number', description: '插入位置', required: false }
    }
  },
  {
    name: 'search_in_file',
    description: '在当前文件中搜索特定文本',
    parameters: {
      search_text: { type: 'string', description: '要搜索的文本', required: true },
      case_sensitive: { type: 'boolean', description: '是否区分大小写', required: false, default: false }
    }
  },
  {
    name: 'list_resources',
    description: '查看资源列表，支持按类型筛选',
    parameters: {
      resource_type: { type: 'string', description: '资源类型：references/images/pdfs/datafiles/codesnippets/notes/all', required: true }
    }
  },
  {
    name: 'add_resource',
    description: '添加新资源到资源库',
    parameters: {
      resource_type: { type: 'string', description: '资源类型：references/images/pdfs/datafiles/codesnippets/notes', required: true },
      resource_data: { type: 'object', description: '资源数据对象，包含name/title/description等字段', required: true }
    }
  },
  {
    name: 'insert_resource',
    description: '生成资源引用内容，可插入到文档中',
    parameters: {
      resource_type: { type: 'string', description: '资源类型：references/images/pdfs/datafiles/codesnippets/notes', required: true },
      resource_id: { type: 'string', description: '资源ID', required: true },
      insert_format: { type: 'string', description: '插入格式：latex/markdown', required: false, default: 'latex' }
    }
  }
];

// 资源类型列表
const RESOURCE_TYPES = ['references', 'images', 'pdfs', 'datafiles', 'codesnippets', 'notes'];

// 统一的引用生成函数
function generateInsertContent(resource, type, format = 'latex') {
  let insertContent = '';
  
  switch (type) {
    case 'references':
      if (format === 'latex') {
        insertContent = `\\cite{${resource.citationKey || resource.id}}`;
      } else {
        insertContent = `[${resource.citationKey || resource.id}] ${resource.title}`;
      }
      break;
    case 'images':
      if (format === 'latex') {
        insertContent = `\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{${resource.name}}
  \\caption{${resource.description || resource.name}}
  \\label{fig:${resource.id}}
\\end{figure}`;
      } else {
        insertContent = `![${resource.description || resource.name}](${resource.dataUrl || resource.name})`;
      }
      break;
    case 'pdfs':
      if (format === 'latex') {
        insertContent = `\\href{${resource.url || resource.name}}{${resource.name || resource.title}}`;
      } else {
        insertContent = `[${resource.name || resource.title}](${resource.url || resource.name})`;
      }
      break;
    case 'datafiles':
      if (format === 'latex') {
        insertContent = `\\textbf{数据来源：} ${resource.name} (${resource.fileType || ''})`;
      } else {
        insertContent = `**数据来源：** ${resource.name} (${resource.fileType || ''})`;
      }
      break;
    case 'codesnippets':
      if (format === 'latex') {
        insertContent = `\\begin{lstlisting}[language=${resource.language}]
${resource.code}
\\end{lstlisting}`;
      } else {
        insertContent = `\`\`\`${resource.language}
${resource.code}
\`\`\``;
      }
      break;
    case 'notes':
      if (format === 'latex') {
        insertContent = `\\textit{注：${resource.title} - ${resource.content.substring(0, 100)}${resource.content.length > 100 ? '...' : ''}}`;
      } else {
        insertContent = `*注：${resource.title} - ${resource.content.substring(0, 100)}${resource.content.length > 100 ? '...' : ''}*`;
      }
      break;
  }
  
  return insertContent;
}

// 辅助函数：从URL或ID中提取arXiv ID（去掉版本号）
function extractArxivId(idOrUrl) {
  if (!idOrUrl) return null;
  const match = idOrUrl.match(/([0-9]+\.[0-9]+)(v[0-9]+)?/);
  return match ? match[1] : null;
}

module.exports = {
  AVAILABLE_TOOLS,
  RESOURCE_TYPES,
  generateInsertContent,
  extractArxivId
};
