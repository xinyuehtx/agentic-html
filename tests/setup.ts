/**
 * 测试基础配置
 * - 全局 mock 设置
 * - 公共 fixture 定义
 * - 测试辅助工具
 */

import { vi, beforeEach } from 'vitest';
import { VersionService } from '@/core/version.service';
import { AnnotationService } from '@/core/annotation.service';

// Reset shared state before each test for isolation
beforeEach(() => {
  VersionService.reset();
  AnnotationService.reset();
});

// Mock 文件系统操作
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  cp: vi.fn(),
}));

// Mock chokidar 文件监听
vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// ==================== 公共 Fixtures ====================

/** 示例 HTML 内容 */
export const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <div class="hero">
    <h1>Hello World</h1>
    <p class="subtitle">Welcome to the test page</p>
  </div>
  <div class="content">
    <p>Some content here</p>
  </div>
  <div class="sidebar">
    <div class="ad-banner">Ad content</div>
  </div>
</body>
</html>`;

/** 示例标注数据：点选方式（anchor_element + comment） */
export const SAMPLE_CLICK_ANNOTATION = {
  anchor_element: {
    selector: 'body > div.hero > h1',
  },
  comment: '标题颜色改为品牌色',
};

/** 示例标注数据：圈画方式（anchor_element + screenshot + hit_elements + comment） */
export const SAMPLE_INK_ANNOTATION = {
  screenshot: 'data:image/png;base64,iVBORw0KGgo=',
  anchor_element: {
    selector: 'div.hero',
  },
  hit_elements: [
    {
      selector: 'div.hero > h1',
      tag: 'H1',
      outerHtmlSummary: '<h1>Hello World</h1>',
      boundingRect: { x: 100, y: 50, width: 300, height: 40 },
    },
  ],
  comment: '这个区域的排版太紧凑了',
};

/** 示例标注：删除元素 */
export const SAMPLE_DELETE_ANNOTATION = {
  anchor_element: {
    selector: 'body > div.sidebar > .ad-banner',
  },
  comment: '删除广告横幅',
};

/** 示例标注：修改元素 */
export const SAMPLE_MODIFY_ANNOTATION = {
  anchor_element: {
    selector: 'body > div.hero > h1',
  },
  comment: '标题太大，改小一点',
};

/** 示例 Patch */
export const SAMPLE_PATCH = {
  annotationId: 'ann-1',
  selector: 'body > div.hero > h1',
  action: 'replace' as const,
  content: '<h1 style="color: #1a73e8">Hello World</h1>',
  oldContent: '<h1>Hello World</h1>',
};

/** 示例版本数据 */
export const SAMPLE_VERSION = {
  id: 'ver-001',
  version: 'v1',
  parentId: null,
  htmlContent: '<html><body><h1>Hello</h1></body></html>',
  annotations: [],
  sealed: true,
  timestamp: '2026-07-20T10:00:00.000Z',
  metadata: {
    agent: 'claude-code',
    promptSummary: 'Initial version',
  },
};
