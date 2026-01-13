#!/usr/bin/env node
/**
 * PDF阅读工具测试脚本
 * 测试PDF存储、下载、文本提取和读取功能
 */

const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('crypto');

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');
const RESOURCE_TYPES = ['references', 'images', 'pdfs', 'datafiles', 'codesnippets', 'notes'];

console.log('='.repeat(80));
console.log('PDF阅读工具测试脚本');
console.log('='.repeat(80));

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${name}`);
  if (message) {
    console.log(`   消息: ${message}`);
  }
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function logError(message) {
  console.log(`🚨 ${message}`);
}

async function runTests() {
  try {
    // 测试1: 检查目录结构
    console.log('\n' + '='.repeat(60));
    console.log('测试1: 检查目录结构');
    console.log('='.repeat(60));

    const storageExists = await fs.pathExists(STORAGE_DIR);
    logTest('存储目录存在', storageExists, storageExists ? STORAGE_DIR : `目录不存在: ${STORAGE_DIR}`);

    if (!storageExists) {
      logError('创建存储目录...');
      await fs.mkdirp(STORAGE_DIR);
      logInfo('存储目录创建成功');
    }

    const downloadsExists = await fs.pathExists(DOWNLOADS_DIR);
    logTest('下载目录存在', downloadsExists, downloadsExists ? DOWNLOADS_DIR : `目录不存在: ${DOWNLOADS_DIR}`);

    // 测试2: 检查存储文件
    console.log('\n' + '='.repeat(60));
    console.log('测试2: 检查存储文件');
    console.log('='.repeat(60));

    for (const type of RESOURCE_TYPES) {
      const filePath = path.join(STORAGE_DIR, `${type}.json`);
      const exists = await fs.pathExists(filePath);
      logTest(`存储文件 ${type}.json 存在`, exists, exists ? filePath : `文件不存在: ${filePath}`);

      if (!exists) {
        logInfo(`创建空的 ${type}.json 文件...`);
        await fs.writeJson(filePath, [], { spaces: 2 });
        logInfo(`创建成功: ${filePath}`);
      }
    }

    // 测试3: 检查下载的PDF文件
    console.log('\n' + '='.repeat(60));
    console.log('测试3: 检查PDF文件');
    console.log('='.repeat(60));

    if (!await fs.pathExists(DOWNLOADS_DIR)) {
      logTest('下载目录可访问', false, '下载目录不存在');
    } else {
      const pdfFiles = await fs.readdir(DOWNLOADS_DIR);
      const pdfFilesFiltered = pdfFiles.filter(f => f.endsWith('.pdf'));
      logTest(`下载目录包含PDF文件`, pdfFilesFiltered.length > 0, `找到 ${pdfFilesFiltered.length} 个PDF文件`);

      if (pdfFilesFiltered.length === 0) {
        logError('没有找到PDF文件进行测试');
      } else {
        for (const pdfFile of pdfFilesFiltered.slice(0, 3)) {
          const filePath = path.join(DOWNLOADS_DIR, pdfFile);
          const stats = await fs.stat(filePath);
          logTest(`PDF文件 ${pdfFile}`, stats.size > 0, `大小: ${(stats.size / 1024).toFixed(2)} KB`);
        }
      }
    }

    // 测试4: 测试存储读写功能
    console.log('\n' + '='.repeat(60));
    console.log('测试4: 测试存储读写功能');
    console.log('='.repeat(60));

    // 测试PDF存储
    const testPdfResource = {
      id: randomUUID(),
      name: 'test_paper.pdf',
      description: '测试PDF资源',
      dataUrl: 'data:application/pdf;base64,dGVzdA==',
      fileSize: 100,
      uploadDate: new Date().toISOString(),
      extractedText: '这是测试提取的文本内容',
      textStats: {
        textLength: 12,
        numWords: 3,
        numPages: 1
      },
      hasTextContent: true
    };

    const pdfFilePath = path.join(STORAGE_DIR, 'pdfs.json');
    let pdfResources = [];

    try {
      if (await fs.pathExists(pdfFilePath)) {
        pdfResources = await fs.readJson(pdfFilePath);
      }
      logTest('读取PDF存储文件', true, `当前数量: ${pdfResources.length}`);

      // 添加测试资源
      pdfResources.push(testPdfResource);
      await fs.writeJson(pdfFilePath, pdfResources, { spaces: 2 });
      logTest('写入PDF存储文件', true, `添加测试资源: ${testPdfResource.id}`);

      // 验证写入
      const verifyData = await fs.readJson(pdfFilePath);
      const found = verifyData.find(r => r.id === testPdfResource.id);
      logTest('验证PDF资源写入', !!found, found ? `找到资源: ${found.name}` : '未找到资源');

      // 移除测试资源
      if (found) {
        const newResources = verifyData.filter(r => r.id !== testPdfResource.id);
        await fs.writeJson(pdfFilePath, newResources, { spaces: 2 });
        logTest('清理测试数据', true, `移除测试资源后数量: ${newResources.length}`);
      }
    } catch (error) {
      logTest('存储读写测试', false, `错误: ${error.message}`);
    }

    // 测试5: 测试现有的PDF资源
    console.log('\n' + '='.repeat(60));
    console.log('测试5: 分析现有PDF资源');
    console.log('='.repeat(60));

    try {
      const existingPdfData = await fs.readJson(pdfFilePath);
      logTest('读取现有PDF资源', true, `找到 ${existingPdfData.length} 个资源`);

      if (existingPdfData.length > 0) {
        // 分析资源完整性
        let completeResources = 0;
        let incompleteResources = 0;

        for (const resource of existingPdfData) {
          const hasRequired = resource.id && resource.name && resource.dataUrl;
          const hasText = resource.extractedText && resource.extractedText.length > 0;
          const hasStats = resource.textStats;

          if (hasRequired && hasText) {
            completeResources++;
          } else {
            incompleteResources++;
            logInfo(`不完整资源: ${resource.name}`);
            if (!hasText) logInfo(`  - 缺少提取的文本`);
            if (!hasStats) logInfo(`  - 缺少文本统计`);
          }
        }

        logTest('资源完整性检查', incompleteResources === 0, `完整: ${completeResources}, 不完整: ${incompleteResources}`);

        // 检查存储与文件的对应关系
        const storedNames = existingPdfData.map(r => r.name);
        const pdfFilesInDownloads = (await fs.readdir(DOWNLOADS_DIR)).filter(f => f.endsWith('.pdf'));

        let matched = 0;
        let unmatched = [];

        for (const name of storedNames) {
          if (pdfFilesInDownloads.includes(name)) {
            matched++;
          } else {
            unmatched.push(name);
          }
        }

        logTest('存储与文件对应关系', unmatched.length === 0, `匹配: ${matched}, 不匹配: ${unmatched.length}`);
        if (unmatched.length > 0) {
          logError(`缺失文件: ${unmatched.join(', ')}`);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logTest('分析现有资源', false, 'PDF存储文件不存在');
      } else {
        logTest('分析现有资源', false, `错误: ${error.message}`);
      }
    }

    // 测试6: 模拟PDF下载和存储流程
    console.log('\n' + '='.repeat(60));
    console.log('测试6: 模拟PDF下载和存储流程');
    console.log('='.repeat(60));

    const testArxivId = '2301.07041';
    const testPdfName = `${testArxivId}.pdf`;
    const testFilePath = path.join(DOWNLOADS_DIR, testPdfName);

    if (await fs.pathExists(testFilePath)) {
      logTest('测试PDF文件存在', true, testPdfName);

      try {
        const stats = await fs.stat(testFilePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        logTest('PDF文件大小检查', fileSizeMB < 100, `${fileSizeMB.toFixed(2)} MB`);

        // 模拟完整的下载和存储流程
        const mockDownloadResult = {
          id: randomUUID(),
          name: testPdfName,
          description: `arXiv论文: ${testArxivId}`,
          dataUrl: 'data:application/pdf;base64,placeholder',
          fileSize: stats.size,
          uploadDate: new Date().toISOString(),
          extractedText: '',
          textStats: null,
          hasTextContent: false
        };

        // 读取现有资源
        let resources = [];
        if (await fs.pathExists(pdfFilePath)) {
          resources = await fs.readJson(pdfFilePath);
        }

        // 检查是否已存在
        const existingIndex = resources.findIndex(r => r.name === testPdfName);
        if (existingIndex !== -1) {
          logTest('PDF资源已存在', true, `更新现有资源: ${resources[existingIndex].id}`);
          resources[existingIndex] = mockDownloadResult;
        } else {
          logTest('添加新PDF资源', true, `添加资源: ${mockDownloadResult.id}`);
          resources.push(mockDownloadResult);
        }

        // 保存
        await fs.writeJson(pdfFilePath, resources, { spaces: 2 });
        logTest('保存PDF资源', true, `资源数量: ${resources.length}`);

        // 验证
        const verifyResources = await fs.readJson(pdfFilePath);
        const resourceExists = verifyResources.some(r => r.name === testPdfName);
        logTest('验证PDF资源', resourceExists, resourceExists ? '资源保存成功' : '资源保存失败');

      } catch (error) {
        logTest('模拟下载流程', false, `错误: ${error.message}`);
      }
    } else {
      logTest('测试PDF文件存在', false, `文件不存在: ${testPdfName}`);
    }

    // 测试7: 存储系统健康检查
    console.log('\n' + '='.repeat(60));
    console.log('测试7: 存储系统健康检查');
    console.log('='.repeat(60));

    let allFilesValid = true;
    for (const type of RESOURCE_TYPES) {
      const filePath = path.join(STORAGE_DIR, `${type}.json`);
      if (await fs.pathExists(filePath)) {
        try {
          const data = await fs.readJson(filePath);
          if (!Array.isArray(data)) {
            logTest(`验证 ${type}.json 格式`, false, '数据不是数组');
            allFilesValid = false;
          } else {
            logTest(`验证 ${type}.json 格式`, true, `包含 ${data.length} 个资源`);
          }
        } catch (error) {
          logTest(`验证 ${type}.json`, false, `解析错误: ${error.message}`);
          allFilesValid = false;
        }
      } else {
        logTest(`验证 ${type}.json 存在`, false, '文件不存在');
        allFilesValid = false;
      }
    }

    logTest('存储系统健康检查', allFilesValid, allFilesValid ? '所有存储文件正常' : '存在问题的存储文件');

    // 总结
    console.log('\n' + '='.repeat(80));
    console.log('测试总结');
    console.log('='.repeat(80));
    console.log(`总测试数: ${testResults.passed + testResults.failed}`);
    console.log(`通过: ${testResults.passed}`);
    console.log(`失败: ${testResults.failed}`);
    console.log(`成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
      console.log('\n失败的测试:');
      testResults.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.message}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    return testResults.failed === 0;
  } catch (error) {
    logError(`测试执行失败: ${error.message}`);
    logError(error.stack);
    return false;
  }
}

// 修复存储对齐问题
async function fixStorageIssues() {
  console.log('\n' + '='.repeat(60));
  console.log('修复存储对齐问题');
  console.log('='.repeat(60));

  try {
    // 确保所有目录存在
    await fs.ensureDir(STORAGE_DIR);
    logInfo('确保存储目录存在');

    // 确保下载目录存在
    await fs.ensureDir(DOWNLOADS_DIR);
    logInfo('确保下载目录存在');

    // 创建所有必要的存储文件
    for (const type of RESOURCE_TYPES) {
      const filePath = path.join(STORAGE_DIR, `${type}.json`);
      if (!(await fs.pathExists(filePath))) {
        await fs.writeJson(filePath, [], { spaces: 2 });
        logInfo(`创建缺失的存储文件: ${type}.json`);
      }
    }

    // 检查并修复PDF存储
    const pdfFilePath = path.join(STORAGE_DIR, 'pdfs.json');
    let pdfResources = [];

    if (await fs.pathExists(pdfFilePath)) {
      try {
        pdfResources = await fs.readJson(pdfFilePath);
      } catch (error) {
        logError(`读取PDF存储失败: ${error.message}`);
        pdfResources = [];
      }
    }

    // 检查PDF文件对应关系
    if (await fs.pathExists(DOWNLOADS_DIR)) {
      const pdfFiles = (await fs.readdir(DOWNLOADS_DIR)).filter(f => f.endsWith('.pdf'));

      // 修复不完整的资源
      let fixedCount = 0;
      for (const resource of pdfResources) {
        const expectedFile = path.join(DOWNLOADS_DIR, resource.name);
        const fileExists = await fs.pathExists(expectedFile);

        if (!fileExists) {
          logInfo(`文件不存在: ${resource.name}`);
          if (!resource.extractedText || resource.extractedText.length === 0) {
            logInfo(`  - 标记为无文本内容`);
            resource.hasTextContent = false;
            fixedCount++;
          }
        }
      }

      if (fixedCount > 0) {
        await fs.writeJson(pdfFilePath, pdfResources, { spaces: 2 });
        logInfo(`修复了 ${fixedCount} 个不完整的资源`);
      }
    }

    logInfo('存储修复完成');
    return true;
  } catch (error) {
    logError(`修复失败: ${error.message}`);
    return false;
  }
}

// 主程序
async function main() {
  console.log('\n开始执行测试...\n');

  // 首先修复存储问题
  await fixStorageIssues();

  // 运行测试
  const success = await runTests();

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('程序执行失败:', error);
  process.exit(1);
});
