import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export interface ResourceResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface Resource {
  id: string;
}

export interface Reference extends Resource {
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  arxivId?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  citationKey: string;
}

export interface ImageResource extends Resource {
  name: string;
  description: string;
  dataUrl: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
}

export interface PdfResource extends Resource {
  name: string;
  description: string;
  dataUrl: string;
  fileSize: number;
  uploadDate: string;
  pageCount?: number;
}

export interface DataFile extends Resource {
  name: string;
  description: string;
  dataUrl: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  rowCount?: number;
  columns?: string[];
}

export interface CodeSnippet extends Resource {
  name: string;
  description: string;
  code: string;
  language: string;
  createDate: string;
}

export interface Note extends Resource {
  title: string;
  content: string;
  tags: string[];
  createDate: string;
  updateDate: string;
}

export type ResourceType = 'references' | 'images' | 'pdfs' | 'datafiles' | 'codesnippets' | 'notes';

export type ResourceData = Reference | ImageResource | PdfResource | DataFile | CodeSnippet | Note;

class ResourceService {
  async getResources<T extends ResourceData>(type: ResourceType): Promise<ResourceResponse<{ type: ResourceType; resources: T[]; count: number }>> {
    try {
      console.log(`[resourceService] 请求资源: ${type}`);
      const response = await axios.get(`${API_BASE_URL}/resources/${type}`);
      console.log(`[resourceService] 响应状态: ${response.status}`, response.data);
      
      // 验证响应格式
      if (!response.data) {
        console.error(`[resourceService] 响应数据为空: ${type}`);
        return {
          success: false,
          data: { type, resources: [], count: 0 },
          error: '服务器响应数据为空'
        };
      }
      
      if (!response.data.success) {
        console.error(`[resourceService] 请求失败: ${type}`, response.data.error);
        return {
          success: false,
          data: { type, resources: [], count: 0 },
          error: response.data.error || '获取资源失败'
        };
      }
      
      if (!response.data.data || !Array.isArray(response.data.data.resources)) {
        console.error(`[resourceService] 响应格式错误: ${type}`, response.data);
        return {
          success: false,
          data: { type, resources: [], count: 0 },
          error: '服务器响应格式错误'
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`[resourceService] 请求异常: ${type}`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      // 处理网络错误
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        return {
          success: false,
          data: { type, resources: [], count: 0 },
          error: '无法连接到后端服务器 (http://localhost:3001)，请确保服务器正在运行'
        };
      }
      
      // 处理HTTP错误
      if (error.response) {
        return {
          success: false,
          data: { type, resources: [], count: 0 },
          error: error.response.data?.error || `HTTP错误: ${error.response.status}`
        };
      }
      
      return {
        success: false,
        data: { type, resources: [], count: 0 },
        error: error.message || '获取资源失败'
      };
    }
  }

  async addResource<T extends ResourceData>(type: ResourceType, resourceData: T): Promise<ResourceResponse<{ message: string; resource_id: string; resource_type: ResourceType; resource_data: T; updated?: boolean }>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/resources/${type}`, { resource_data: resourceData });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: { message: '', resource_id: '', resource_type: type, resource_data: resourceData },
        error: error.response?.data?.error || '添加资源失败'
      };
    }
  }

  async updateResource<T extends ResourceData>(type: ResourceType, id: string, resourceData: T): Promise<ResourceResponse<{ message: string; resource_id: string; resource_type: ResourceType; resource_data: T }>> {
    try {
      const response = await axios.put(`${API_BASE_URL}/resources/${type}/${id}`, { resource_data: resourceData });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: { message: '', resource_id: id, resource_type: type, resource_data: resourceData },
        error: error.response?.data?.error || '更新资源失败'
      };
    }
  }

  async deleteResource(type: ResourceType, id: string): Promise<ResourceResponse<{ message: string; resource_id: string }>> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/resources/${type}/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: { message: '', resource_id: id },
        error: error.response?.data?.error || '删除资源失败'
      };
    }
  }

  async insertResource(type: ResourceType, id: string, insertFormat: 'latex' | 'markdown' = 'latex'): Promise<ResourceResponse<{ message: string; resource_type: ResourceType; resource_id: string; resource_name: string; insert_content: string; insert_format: string }>> {
    try {
      const response = await axios.post(`${API_BASE_URL}/resources/${type}/${id}/insert`, { insert_format: insertFormat });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        data: { message: '', resource_type: type, resource_id: id, resource_name: '', insert_content: '', insert_format: insertFormat },
        error: error.response?.data?.error || '生成资源引用失败'
      };
    }
  }
}

export const resourceService = new ResourceService();