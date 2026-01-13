import React, { useState, useEffect } from 'react';
import { 
  resourceService, 
  Reference, 
  ImageResource, 
  PdfResource, 
  DataFile, 
  CodeSnippet, 
  Note 
} from '../services/resourceService';

export interface ResourcePanelProps {
  onInsertReference?: (reference: Reference) => void;
  onInsertImage?: (image: ImageResource) => void;
  onInsertPdf?: (pdf: PdfResource) => void;
  onInsertDataFile?: (dataFile: DataFile) => void;
  onInsertCodeSnippet?: (codeSnippet: CodeSnippet) => void;
  onInsertNote?: (note: Note) => void;
}

const modernStyles: { [key: string]: React.CSSProperties } = {
  panel: {
    backgroundColor: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e8ecf1',
    backgroundColor: '#ffffff',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#1a1a2e',
    letterSpacing: '-0.5px',
  },
  tabsContainer: {
    display: 'flex',
    padding: '12px 16px 0',
    gap: '8px',
    overflowX: 'auto',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e8ecf1',
  },
  tab: {
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    color: '#3b82f6',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    backgroundColor: '#f8fafc',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    marginBottom: '16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f1f5f9',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
  },
  addButton: {
    padding: '8px 14px',
    backgroundColor: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  resourceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resourceItem: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  itemTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    lineHeight: 1.4,
  },
  itemMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '8px',
  },
  itemActions: {
    display: 'flex',
    gap: '6px',
  },
  actionButton: {
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontSize: '14px',
  },
  insertButton: {
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    color: '#ef4444',
  },
  downloadButton: {
    backgroundColor: '#f0fdf4',
    color: '#22c55e',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#64748b',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#ef4444',
  },
  retryButton: {
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
  },
  citationKey: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#7c3aed',
    backgroundColor: '#f5f3ff',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
  },
  imagePreview: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  imageCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '12px',
    transition: 'all 0.2s ease',
  },
  pdfIcon: {
    width: '40px',
    height: '40px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    marginRight: '12px',
  },
  codeBlock: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'Monaco, Consolas, monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre-wrap',
    maxHeight: '120px',
  },
  languageBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
  },
  tagBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    marginRight: '6px',
  },
  noteTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '8px',
  },
  noteContent: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: '8px',
  },
  itemDescription: {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '8px',
    lineHeight: 1.5,
  },
  form: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '10px',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  formTextarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '10px',
    resize: 'vertical',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  formSelect: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '10px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  abstract: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '8px',
  },
  abstractSummary: {
    cursor: 'pointer',
    color: '#3b82f6',
    fontWeight: 500,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#64748b',
  },
  loadingText: {
    fontSize: '14px',
    marginTop: '12px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#ef4444',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '16px',
  },
  errorText: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '8px',
    textAlign: 'center',
  },
  activeTab: {
    backgroundColor: '#ffffff',
    color: '#3b82f6',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    backgroundColor: '#f8fafc',
  },
};

const tabs: { id: 'references' | 'images' | 'pdfs' | 'datafiles' | 'codesnippets' | 'notes'; label: string; icon: string }[] = [
  { id: 'references', label: '参考文献', icon: '📚' },
  { id: 'images', label: '图片', icon: '🖼️' },
  { id: 'pdfs', label: 'PDF文献', icon: '📄' },
  { id: 'datafiles', label: '数据文件', icon: '📊' },
  { id: 'codesnippets', label: '代码片段', icon: '💻' },
  { id: 'notes', label: '笔记', icon: '📝' },
];

const ResourcePanel: React.FC<ResourcePanelProps> = ({
  onInsertReference,
  onInsertImage,
  onInsertPdf,
  onInsertDataFile,
  onInsertCodeSnippet,
  onInsertNote
}) => {
  const [activeTab, setActiveTab] = useState<'references' | 'images' | 'pdfs' | 'datafiles' | 'codesnippets' | 'notes'>('references');
  const [references, setReferences] = useState<Reference[]>([]);
  const [images, setImages] = useState<ImageResource[]>([]);
  const [pdfs, setPdfs] = useState<PdfResource[]>([]);
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showAddReference, setShowAddReference] = useState(false);
  const [showAddCodeSnippet, setShowAddCodeSnippet] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newReference, setNewReference] = useState<Partial<Reference>>({
    title: '',
    authors: [],
    year: new Date().getFullYear(),
    citationKey: ''
  });
  const [newCodeSnippet, setNewCodeSnippet] = useState<Partial<CodeSnippet>>({
    name: '',
    description: '',
    code: '',
    language: 'python'
  });
  const [newNote, setNewNote] = useState<Partial<Note>>({
    title: '',
    content: '',
    tags: []
  });

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    console.log('[ResourcePanel] 开始加载资源...');
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ResourcePanel] 发送API请求...');
      const [refsRes, imgsRes, pdfsRes, dataRes, codeRes, notesRes] = await Promise.all([
        resourceService.getResources('references'),
        resourceService.getResources('images'),
        resourceService.getResources('pdfs'),
        resourceService.getResources('datafiles'),
        resourceService.getResources('codesnippets'),
        resourceService.getResources('notes')
      ]);

      console.log('[ResourcePanel] API响应:', {
        references: refsRes,
        images: imgsRes,
        pdfs: pdfsRes,
        datafiles: dataRes,
        codesnippets: codeRes,
        notes: notesRes
      });

      // 处理每个资源类型的响应
      if (refsRes.success) {
        console.log('[ResourcePanel] 参考文献加载成功，数量:', refsRes.data.resources.length);
        // 数据清理：确保authors是数组类型
        const cleanedReferences = refsRes.data.resources.map((ref: any) => ({
          ...ref,
          authors: Array.isArray(ref.authors) ? ref.authors : (ref.authors ? [ref.authors] : [])
        }));
        setReferences(cleanedReferences as Reference[]);
      } else {
        console.warn('[ResourcePanel] 参考文献加载失败:', refsRes.error);
      }

      if (imgsRes.success) {
        console.log('[ResourcePanel] 图片加载成功，数量:', imgsRes.data.resources.length);
        setImages(imgsRes.data.resources as ImageResource[]);
      } else {
        console.warn('[ResourcePanel] 图片加载失败:', imgsRes.error);
      }

      if (pdfsRes.success) {
        console.log('[ResourcePanel] PDF加载成功，数量:', pdfsRes.data.resources.length);
        setPdfs(pdfsRes.data.resources as PdfResource[]);
      } else {
        console.warn('[ResourcePanel] PDF加载失败:', pdfsRes.error);
      }

      if (dataRes.success) {
        console.log('[ResourcePanel] 数据文件加载成功，数量:', dataRes.data.resources.length);
        setDataFiles(dataRes.data.resources as DataFile[]);
      } else {
        console.warn('[ResourcePanel] 数据文件加载失败:', dataRes.error);
      }

      if (codeRes.success) {
        console.log('[ResourcePanel] 代码片段加载成功，数量:', codeRes.data.resources.length);
        setCodeSnippets(codeRes.data.resources as CodeSnippet[]);
      } else {
        console.warn('[ResourcePanel] 代码片段加载失败:', codeRes.error);
      }

      if (notesRes.success) {
        console.log('[ResourcePanel] 笔记加载成功，数量:', notesRes.data.resources.length);
        setNotes(notesRes.data.resources as Note[]);
      } else {
        console.warn('[ResourcePanel] 笔记加载失败:', notesRes.error);
      }

      console.log('[ResourcePanel] 资源加载完成');
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[ResourcePanel] 加载资源失败 - 详细信息:', {
        message: errorMessage,
        stack: errorStack,
        error: error
      });
      
      // 检查是否是网络错误
      if (error instanceof TypeError && errorMessage.includes('fetch')) {
        setError('无法连接到后端服务器。请确保后端服务器正在运行 (http://localhost:3001)');
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        setError('网络连接失败。请检查后端服务器是否运行中。');
      } else {
        setError(`加载资源失败: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddReference = async () => {
    if (!newReference.title || !newReference.citationKey) {
      alert('请填写标题和引用键');
      return;
    }

    const reference: Reference = {
      id: '', // 由服务器端生成UUID
      title: newReference.title,
      authors: newReference.authors || [],
      year: newReference.year || new Date().getFullYear(),
      journal: newReference.journal,
      arxivId: newReference.arxivId,
      doi: newReference.doi,
      url: newReference.url,
      abstract: newReference.abstract,
      citationKey: newReference.citationKey
    };

    const result = await resourceService.addResource('references', reference);
    if (result.success && result.data.resource_data) {
      setReferences([...references, result.data.resource_data as Reference]);
    } else {
      alert(result.error || '添加参考文献失败');
      return;
    }
    setNewReference({
      title: '',
      authors: [],
      year: new Date().getFullYear(),
      citationKey: ''
    });
    setShowAddReference(false);
  };

  const handleDeleteReference = async (id: string) => {
    if (window.confirm('确定要删除这条参考文献吗？')) {
      await resourceService.deleteResource('references', id);
      setReferences(references.filter(ref => ref.id !== id));
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
    const imageResource: ImageResource = {
      id: '', // 由服务器端生成UUID
      name: file.name,
        description: '',
        dataUrl: e.target?.result as string,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toISOString()
      };

      const result = await resourceService.addResource('images', imageResource);
      if (result.success && result.data.resource_data) {
        setImages([...images, result.data.resource_data as ImageResource]);
      } else {
        alert(result.error || '上传图片失败');
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('请选择PDF文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const pdfResource: PdfResource = {
        id: '', // 由服务器端生成UUID
        name: file.name,
        description: '',
        dataUrl: e.target?.result as string,
        fileSize: file.size,
        uploadDate: new Date().toISOString()
      };

      const result = await resourceService.addResource('pdfs', pdfResource);
      if (result.success && result.data.resource_data) {
        setPdfs([...pdfs, result.data.resource_data as PdfResource]);
      } else {
        alert(result.error || '上传PDF失败');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (id: string) => {
    if (window.confirm('确定要删除这张图片吗？')) {
      await resourceService.deleteResource('images', id);
      setImages(images.filter(img => img.id !== id));
    }
  };

  const handleDeletePdf = async (id: string) => {
    if (window.confirm('确定要删除这个PDF吗？')) {
      await resourceService.deleteResource('pdfs', id);
      setPdfs(pdfs.filter(pdf => pdf.id !== id));
    }
  };

  const handleDownloadImage = (image: ImageResource) => {
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = image.name;
    link.click();
  };

  const handleDownloadPdf = (pdf: PdfResource) => {
    const link = document.createElement('a');
    link.href = pdf.dataUrl;
    link.download = pdf.name;
    link.click();
  };

  const handleUpdateImageDescription = async (id: string, description: string) => {
    const image = images.find(img => img.id === id);
    if (!image) return;
    
    const updatedImage = { ...image, description };
    const result = await resourceService.updateResource('images', id, updatedImage);
    
    if (result.success) {
      setImages(images.map(img => img.id === id ? updatedImage : img));
    } else {
      console.error('更新图片描述失败:', result.error);
      alert('更新失败: ' + result.error);
    }
  };

  const handleUpdatePdfDescription = async (id: string, description: string) => {
    const pdf = pdfs.find(p => p.id === id);
    if (!pdf) return;
    
    const updatedPdf = { ...pdf, description };
    const result = await resourceService.updateResource('pdfs', id, updatedPdf);
    
    if (result.success) {
      setPdfs(pdfs.map(p => p.id === id ? updatedPdf : p));
    } else {
      console.error('更新PDF描述失败:', result.error);
      alert('更新失败: ' + result.error);
    }
  };

  const handleUpdateDataFileDescription = async (id: string, description: string) => {
    const dataFile = dataFiles.find(df => df.id === id);
    if (!dataFile) return;
    
    const updatedDataFile = { ...dataFile, description };
    const result = await resourceService.updateResource('datafiles', id, updatedDataFile);
    
    if (result.success) {
      setDataFiles(dataFiles.map(df => df.id === id ? updatedDataFile : df));
    } else {
      console.error('更新数据文件描述失败:', result.error);
      alert('更新失败: ' + result.error);
    }
  };

  const handleDataFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataFile: DataFile = {
        id: '', // 由服务器端生成UUID
        name: file.name,
        description: '',
        dataUrl: e.target?.result as string,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toISOString()
      };

      const result = await resourceService.addResource('datafiles', dataFile);
      if (result.success && result.data.resource_data) {
        setDataFiles([...dataFiles, result.data.resource_data as DataFile]);
      } else {
        alert(result.error || '上传数据文件失败');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDataFile = async (id: string) => {
    if (window.confirm('确定要删除这个数据文件吗？')) {
      await resourceService.deleteResource('datafiles', id);
      setDataFiles(dataFiles.filter(df => df.id !== id));
    }
  };

  const handleDownloadDataFile = (dataFile: DataFile) => {
    const link = document.createElement('a');
    link.href = dataFile.dataUrl;
    link.download = dataFile.name;
    link.click();
  };

  const handleAddCodeSnippet = async () => {
    if (!newCodeSnippet.name || !newCodeSnippet.code) {
      alert('请填写名称和代码');
      return;
    }

    const codeSnippet: CodeSnippet = {
      id: '', // 由服务器端生成UUID
      name: newCodeSnippet.name,
      description: newCodeSnippet.description || '',
      code: newCodeSnippet.code,
      language: newCodeSnippet.language || 'python',
      createDate: new Date().toISOString()
    };

    const result = await resourceService.addResource('codesnippets', codeSnippet);
    if (result.success && result.data.resource_data) {
      setCodeSnippets([...codeSnippets, result.data.resource_data as CodeSnippet]);
    } else {
      alert(result.error || '添加代码片段失败');
      return;
    }
    setNewCodeSnippet({
      name: '',
      description: '',
      code: '',
      language: 'python'
    });
    setShowAddCodeSnippet(false);
  };

  const handleDeleteCodeSnippet = async (id: string) => {
    if (window.confirm('确定要删除这个代码片段吗？')) {
      await resourceService.deleteResource('codesnippets', id);
      setCodeSnippets(codeSnippets.filter(cs => cs.id !== id));
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title || !newNote.content) {
      alert('请填写标题和内容');
      return;
    }

    const note: Note = {
      id: '', // 由服务器端生成UUID
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags || [],
      createDate: new Date().toISOString(),
      updateDate: new Date().toISOString()
    };

    const result = await resourceService.addResource('notes', note);
    if (result.success && result.data.resource_data) {
      setNotes([...notes, result.data.resource_data as Note]);
    } else {
      alert(result.error || '添加笔记失败');
      return;
    }
    setNewNote({
      title: '',
      content: '',
      tags: []
    });
    setShowAddNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (window.confirm('确定要删除这条笔记吗？')) {
      await resourceService.deleteResource('notes', id);
      setNotes(notes.filter(n => n.id !== id));
    }
  };

  const handleUpdateNote = async (id: string, title: string, content: string, tags: string[]) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    const updatedNote = { ...note, title, content, tags, updateDate: new Date().toISOString() };
    const result = await resourceService.updateResource('notes', id, updatedNote);
    
    if (result.success) {
      setNotes(notes.map(n => n.id === id ? updatedNote : n));
    } else {
      console.error('更新笔记失败:', result.error);
      alert('更新失败: ' + result.error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const renderReferences = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>参考文献 ({references.length})</h3>
        <button 
          style={modernStyles.addButton}
          onClick={() => setShowAddReference(true)}
        >
          + 添加
        </button>
      </div>

      {showAddReference && (
        <div style={modernStyles.form}>
          <input
            style={modernStyles.formInput}
            placeholder="引用键 (如: smith2024)"
            value={newReference.citationKey}
            onChange={(e) => setNewReference({ ...newReference, citationKey: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="标题"
            value={newReference.title}
            onChange={(e) => setNewReference({ ...newReference, title: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="作者 (用逗号分隔)"
            value={newReference.authors?.join(', ')}
            onChange={(e) => setNewReference({ 
              ...newReference, 
              authors: e.target.value.split(',').map(a => a.trim()) 
            })}
          />
          <input
            style={modernStyles.formInput}
            type="number"
            placeholder="年份"
            value={newReference.year}
            onChange={(e) => setNewReference({ ...newReference, year: parseInt(e.target.value) })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="期刊"
            value={newReference.journal || ''}
            onChange={(e) => setNewReference({ ...newReference, journal: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="arXiv ID"
            value={newReference.arxivId || ''}
            onChange={(e) => setNewReference({ ...newReference, arxivId: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="DOI"
            value={newReference.doi || ''}
            onChange={(e) => setNewReference({ ...newReference, doi: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="URL"
            value={newReference.url || ''}
            onChange={(e) => setNewReference({ ...newReference, url: e.target.value })}
          />
          <textarea
            style={modernStyles.formTextarea}
            placeholder="摘要"
            value={newReference.abstract || ''}
            onChange={(e) => setNewReference({ ...newReference, abstract: e.target.value })}
            rows={3}
          />
          <div style={modernStyles.formActions}>
            <button style={modernStyles.saveButton} onClick={handleAddReference}>保存</button>
            <button style={modernStyles.cancelButton} onClick={() => setShowAddReference(false)}>取消</button>
          </div>
        </div>
      )}

      <div style={modernStyles.resourceList}>
        {references.length === 0 ? (
          <div style={modernStyles.emptyState}>暂无参考文献</div>
        ) : (
          references.map(ref => (
            <div key={ref.id} style={modernStyles.resourceItem}>
              <div style={modernStyles.itemHeader}>
                <span style={modernStyles.citationKey}>[{ref.citationKey}]</span>
                <div style={modernStyles.itemActions}>
                  {onInsertReference && (
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                      onClick={() => onInsertReference(ref)}
                      title="插入引用"
                    >
                      📝
                    </button>
                  )}
                  <button 
                    style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                    onClick={() => handleDeleteReference(ref.id)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <h4 style={modernStyles.itemTitle}>{ref.title}</h4>
              <div style={modernStyles.itemMeta}>
                <span>{Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors || '未知作者')}</span>
                <span>({ref.year})</span>
                {ref.journal && <span>- {ref.journal}</span>}
              </div>
              {ref.arxivId && (
                <div style={{marginTop: '8px'}}>
                  <a 
                    href={`https://arxiv.org/abs/${ref.arxivId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={modernStyles.link}
                  >
                    arXiv:{ref.arxivId}
                  </a>
                </div>
              )}
              {ref.doi && (
                <div style={{marginTop: '4px'}}>
                  <a 
                    href={`https://doi.org/${ref.doi}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={modernStyles.link}
                  >
                    DOI:{ref.doi}
                  </a>
                </div>
              )}
              {ref.url && (
                <div style={{marginTop: '4px'}}>
                  <a 
                    href={ref.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={modernStyles.link}
                  >
                    🔗 链接
                  </a>
                </div>
              )}
              {ref.abstract && (
                <div style={modernStyles.abstract}>
                  <details>
                    <summary style={modernStyles.abstractSummary}>摘要</summary>
                    <p>{ref.abstract}</p>
                  </details>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderImages = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>图片资源 ({images.length})</h3>
        <label style={modernStyles.uploadButton}>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <span>📤 上传图片</span>
        </label>
      </div>

      <div style={modernStyles.imageGrid}>
        {images.length === 0 ? (
          <div style={{...modernStyles.emptyState, gridColumn: '1 / -1'}}>暂无图片</div>
        ) : (
          images.map(img => (
            <div key={img.id} style={modernStyles.imageCard}>
              <img 
                src={img.dataUrl} 
                alt={img.name} 
                style={modernStyles.imagePreview}
              />
              <h4 style={{...modernStyles.itemTitle, fontSize: '13px', marginBottom: '6px'}}>{img.name}</h4>
              <div style={modernStyles.itemMeta}>
                <span>{formatFileSize(img.fileSize)}</span>
                <span>{new Date(img.uploadDate).toLocaleDateString('zh-CN')}</span>
              </div>
              <textarea
                style={{...modernStyles.formTextarea, marginBottom: '8px', minHeight: '60px'}}
                placeholder="添加描述..."
                value={img.description}
                onChange={(e) => handleUpdateImageDescription(img.id, e.target.value)}
              />
              <div style={modernStyles.itemActions}>
                {onInsertImage && (
                  <button 
                    style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                    onClick={() => onInsertImage(img)}
                    title="插入图片"
                  >
                    📝
                  </button>
                )}
                <button 
                  style={{...modernStyles.actionButton, ...modernStyles.downloadButton}}
                  onClick={() => handleDownloadImage(img)}
                  title="下载"
                >
                  ⬇️
                </button>
                <button 
                  style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                  onClick={() => handleDeleteImage(img.id)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPdfs = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>PDF文献 ({pdfs.length})</h3>
        <label style={modernStyles.uploadButton}>
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            style={{ display: 'none' }}
          />
          <span>📤 上传PDF</span>
        </label>
      </div>

      <div style={modernStyles.resourceList}>
        {pdfs.length === 0 ? (
          <div style={modernStyles.emptyState}>暂无PDF文献</div>
        ) : (
          pdfs.map(pdf => (
            <div key={pdf.id} style={modernStyles.resourceItem}>
              <div style={{display: 'flex', alignItems: 'flex-start'}}>
                <div style={modernStyles.pdfIcon}>📄</div>
                <div style={{flex: 1}}>
                  <h4 style={modernStyles.itemTitle}>{pdf.name}</h4>
                  <div style={modernStyles.itemMeta}>
                    <span>{formatFileSize(pdf.fileSize)}</span>
                    <span>{new Date(pdf.uploadDate).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <textarea
                    style={{...modernStyles.formTextarea, marginBottom: '8px', minHeight: '50px'}}
                    placeholder="添加描述..."
                    value={pdf.description}
                    onChange={(e) => handleUpdatePdfDescription(pdf.id, e.target.value)}
                  />
                  <div style={modernStyles.itemActions}>
                    {onInsertPdf && (
                      <button 
                        style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                        onClick={() => onInsertPdf(pdf)}
                        title="插入引用"
                      >
                        📝
                      </button>
                    )}
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.downloadButton}}
                      onClick={() => handleDownloadPdf(pdf)}
                      title="下载"
                    >
                      ⬇️
                    </button>
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                      onClick={() => handleDeletePdf(pdf.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDataFiles = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>数据文件 ({dataFiles.length})</h3>
        <label style={modernStyles.uploadButton}>
          <input
            type="file"
            accept=".csv,.json,.xlsx,.txt"
            onChange={handleDataFileUpload}
            style={{ display: 'none' }}
          />
          <span>📤 上传数据</span>
        </label>
      </div>

      <div style={modernStyles.resourceList}>
        {dataFiles.length === 0 ? (
          <div style={modernStyles.emptyState}>暂无数据文件</div>
        ) : (
          dataFiles.map(df => (
            <div key={df.id} style={modernStyles.resourceItem}>
              <div style={{display: 'flex', alignItems: 'flex-start'}}>
                <div style={{...modernStyles.pdfIcon, backgroundColor: '#fef3c7'}}>📊</div>
                <div style={{flex: 1}}>
                  <h4 style={modernStyles.itemTitle}>{df.name}</h4>
                  <div style={modernStyles.itemMeta}>
                    <span>{formatFileSize(df.fileSize)}</span>
                    <span>{new Date(df.uploadDate).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <textarea
                    style={{...modernStyles.formTextarea, marginBottom: '8px', minHeight: '50px'}}
                    placeholder="添加描述..."
                    value={df.description}
                    onChange={(e) => handleUpdateDataFileDescription(df.id, e.target.value)}
                  />
                  <div style={modernStyles.itemActions}>
                    {onInsertDataFile && (
                      <button 
                        style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                        onClick={() => onInsertDataFile(df)}
                        title="插入引用"
                      >
                        📝
                      </button>
                    )}
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.downloadButton}}
                      onClick={() => handleDownloadDataFile(df)}
                      title="下载"
                    >
                      ⬇️
                    </button>
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                      onClick={() => handleDeleteDataFile(df.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderCodeSnippets = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>代码片段 ({codeSnippets.length})</h3>
        <button 
          style={modernStyles.addButton}
          onClick={() => setShowAddCodeSnippet(true)}
        >
          + 添加
        </button>
      </div>

      {showAddCodeSnippet && (
        <div style={modernStyles.form}>
          <input
            style={modernStyles.formInput}
            placeholder="名称"
            value={newCodeSnippet.name}
            onChange={(e) => setNewCodeSnippet({ ...newCodeSnippet, name: e.target.value })}
          />
          <select
            style={modernStyles.formSelect}
            value={newCodeSnippet.language}
            onChange={(e) => setNewCodeSnippet({ ...newCodeSnippet, language: e.target.value })}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="r">R</option>
            <option value="matlab">MATLAB</option>
            <option value="latex">LaTeX</option>
            <option value="bash">Bash</option>
          </select>
          <textarea
            style={modernStyles.formTextarea}
            placeholder="描述"
            value={newCodeSnippet.description}
            onChange={(e) => setNewCodeSnippet({ ...newCodeSnippet, description: e.target.value })}
            rows={2}
          />
          <textarea
            style={modernStyles.formTextarea}
            placeholder="代码"
            value={newCodeSnippet.code}
            onChange={(e) => setNewCodeSnippet({ ...newCodeSnippet, code: e.target.value })}
            rows={8}
          />
          <div style={modernStyles.formActions}>
            <button style={modernStyles.saveButton} onClick={handleAddCodeSnippet}>保存</button>
            <button style={modernStyles.cancelButton} onClick={() => setShowAddCodeSnippet(false)}>取消</button>
          </div>
        </div>
      )}

      <div style={modernStyles.resourceList}>
        {codeSnippets.length === 0 ? (
          <div style={modernStyles.emptyState}>暂无代码片段</div>
        ) : (
          codeSnippets.map(cs => (
            <div key={cs.id} style={modernStyles.resourceItem}>
              <div style={modernStyles.itemHeader}>
                <h4 style={modernStyles.itemTitle}>{cs.name}</h4>
                <span style={modernStyles.languageBadge}>{cs.language}</span>
              </div>
              {cs.description && (
                <p style={modernStyles.itemDescription}>{cs.description}</p>
              )}
              <pre style={modernStyles.codeBlock}>
                <code>{cs.code.substring(0, 200)}{cs.code.length > 200 ? '...' : ''}</code>
              </pre>
              <div style={modernStyles.itemMeta}>
                <span>{new Date(cs.createDate).toLocaleDateString('zh-CN')}</span>
              </div>
              <div style={modernStyles.itemActions}>
                {onInsertCodeSnippet && (
                  <button 
                    style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                    onClick={() => onInsertCodeSnippet(cs)}
                    title="插入代码"
                  >
                    📝
                  </button>
                )}
                <button 
                  style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                  onClick={() => handleDeleteCodeSnippet(cs.id)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderNotes = () => (
    <div style={modernStyles.section}>
      <div style={modernStyles.sectionHeader}>
        <h3 style={modernStyles.sectionTitle}>笔记 ({notes.length})</h3>
        <button 
          style={modernStyles.addButton}
          onClick={() => setShowAddNote(true)}
        >
          + 添加
        </button>
      </div>

      {showAddNote && (
        <div style={modernStyles.form}>
          <input
            style={modernStyles.formInput}
            placeholder="标题"
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="标签 (用逗号分隔)"
            value={newNote.tags?.join(', ')}
            onChange={(e) => setNewNote({ 
              ...newNote, 
              tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
            })}
          />
          <textarea
            style={modernStyles.formTextarea}
            placeholder="内容"
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            rows={6}
          />
          <div style={modernStyles.formActions}>
            <button style={modernStyles.saveButton} onClick={handleAddNote}>保存</button>
            <button style={modernStyles.cancelButton} onClick={() => setShowAddNote(false)}>取消</button>
          </div>
        </div>
      )}

      {editingNote && (
        <div style={modernStyles.form}>
          <input
            style={modernStyles.formInput}
            placeholder="标题"
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
          />
          <input
            style={modernStyles.formInput}
            placeholder="标签 (用逗号分隔)"
            value={newNote.tags?.join(', ')}
            onChange={(e) => setNewNote({ 
              ...newNote, 
              tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
            })}
          />
          <textarea
            style={modernStyles.formTextarea}
            placeholder="内容"
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            rows={6}
          />
          <div style={modernStyles.formActions}>
            <button 
              style={modernStyles.saveButton}
              onClick={() => {
                if (editingNote && newNote.title && newNote.content) {
                  handleUpdateNote(editingNote, newNote.title, newNote.content, newNote.tags || []);
                  setEditingNote(null);
                  setNewNote({ title: '', content: '', tags: [] });
                }
              }}
            >
              更新
            </button>
            <button 
              style={modernStyles.cancelButton}
              onClick={() => {
                setEditingNote(null);
                setNewNote({ title: '', content: '', tags: [] });
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div style={modernStyles.resourceList}>
        {notes.length === 0 ? (
          <div style={modernStyles.emptyState}>暂无笔记</div>
        ) : (
          notes.map(note => (
            <div key={note.id} style={modernStyles.resourceItem}>
              <div style={modernStyles.itemHeader}>
                <h4 style={modernStyles.itemTitle}>{note.title}</h4>
                <div style={modernStyles.itemActions}>
                  <button 
                    style={{...modernStyles.actionButton, backgroundColor: '#fef3c7', color: '#d97706'}}
                    onClick={() => {
                      setEditingNote(note.id);
                      setNewNote({
                        title: note.title,
                        content: note.content,
                        tags: note.tags || []
                      });
                    }}
                    title="编辑"
                  >
                    ✏️
                  </button>
                  {onInsertNote && (
                    <button 
                      style={{...modernStyles.actionButton, ...modernStyles.insertButton}}
                      onClick={() => onInsertNote(note)}
                      title="插入笔记"
                    >
                      📝
                    </button>
                  )}
                  <button 
                    style={{...modernStyles.actionButton, ...modernStyles.deleteButton}}
                    onClick={() => handleDeleteNote(note.id)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {note.tags && note.tags.length > 0 && (
                <div style={modernStyles.noteTags}>
                  {note.tags.map(tag => (
                    <span key={tag} style={modernStyles.tagBadge}>#{tag}</span>
                  ))}
                </div>
              )}
              <p style={modernStyles.noteContent}>{note.content.substring(0, 300)}{note.content.length > 300 ? '...' : ''}</p>
              <div style={modernStyles.itemMeta}>
                <span>创建: {new Date(note.createDate).toLocaleDateString('zh-CN')}</span>
                {note.updateDate !== note.createDate && (
                  <span>更新: {new Date(note.updateDate).toLocaleDateString('zh-CN')}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div style={modernStyles.panel}>
        <div style={modernStyles.loadingContainer}>
          <div style={modernStyles.loadingSpinner}></div>
          <p style={modernStyles.loadingText}>加载中...</p>
        </div>
      </div>
    );
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div style={modernStyles.panel}>
        <div style={modernStyles.errorContainer}>
          <div style={modernStyles.errorIcon}>⚠️</div>
          <p style={modernStyles.errorText}>{error}</p>
          <button style={modernStyles.retryButton} onClick={loadResources}>
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={modernStyles.panel}>
      <div style={modernStyles.header}>
        <h2 style={modernStyles.title}>资源管理</h2>
      </div>

      <div style={modernStyles.tabsContainer}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...modernStyles.tab,
              ...(activeTab === tab.id ? modernStyles.activeTab : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={modernStyles.tabContent}>
        {activeTab === 'references' && renderReferences()}
        {activeTab === 'images' && renderImages()}
        {activeTab === 'pdfs' && renderPdfs()}
        {activeTab === 'datafiles' && renderDataFiles()}
        {activeTab === 'codesnippets' && renderCodeSnippets()}
        {activeTab === 'notes' && renderNotes()}
      </div>
    </div>
  );
};

export default ResourcePanel;
