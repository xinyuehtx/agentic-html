/**
 * Demo mode data for screenshot generation and E2E testing.
 * When ?demo=true is in the URL, the UI uses this mock data instead of backend APIs.
 */

import type { VersionNode, VersionEdge, VersionDiff } from './hooks/useVersionGraph';
import type { HtmlError } from './components/HtmlErrorBanner';

/** Check if the app is running in demo mode */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('demo') === 'true';
}

/** Check if demo errors should be shown */
export function isDemoErrors(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('errors') === 'true';
}

/** Mock HTML content for preview */
export const DEMO_HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProductX - 让效率翻倍</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      text-align: center;
    }
    .hero h1 { font-size: 3rem; margin-bottom: 16px; }
    .hero .subtitle { font-size: 1.25rem; opacity: 0.9; margin-bottom: 40px; }
    .hero .cta-button {
      display: inline-block;
      padding: 14px 36px;
      background: #fff;
      color: #764ba2;
      font-size: 1.1rem;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: transform 0.2s;
    }
    .hero .cta-button:hover { transform: translateY(-2px); }
    .features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      padding: 60px 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .feature-card { text-align: center; padding: 24px; }
    .feature-card .icon { font-size: 48px; margin-bottom: 16px; }
    .feature-card h3 { margin-bottom: 8px; }
    .feature-card p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>ProductX - 让效率翻倍</h1>
    <p class="subtitle">智能工作流引擎，帮助团队快速交付高质量产品</p>
    <a href="#signup" class="cta-button">免费试用</a>
  </section>
  <section class="features">
    <div class="feature-card">
      <div class="icon">🤖</div>
      <h3>智能自动化</h3>
      <p>AI 驱动的工作流自动化，减少重复劳动</p>
    </div>
    <div class="feature-card">
      <div class="icon">👥</div>
      <h3>实时协作</h3>
      <p>团队成员实时协作，沟通零延迟</p>
    </div>
    <div class="feature-card">
      <div class="icon">📊</div>
      <h3>数据洞察</h3>
      <p>可视化数据面板，一目了然掌握进度</p>
    </div>
  </section>
</body>
</html>`;

/** Mock session and version IDs */
export const DEMO_SESSION_ID = 'demo-session-001';
export const DEMO_VERSION_ID = 'ver-demo-001';

/** Mock version nodes for the version graph */
export const DEMO_VERSION_NODES: VersionNode[] = [
  {
    id: 'ver-demo-001',
    parentId: null,
    timestamp: '2026-07-20T10:00:00.000Z',
    annotationCount: 2,
    sealed: true,
  },
  {
    id: 'ver-demo-002',
    parentId: 'ver-demo-001',
    timestamp: '2026-07-20T10:30:00.000Z',
    annotationCount: 1,
    sealed: true,
  },
  {
    id: 'ver-demo-003',
    parentId: 'ver-demo-002',
    timestamp: '2026-07-20T11:00:00.000Z',
    annotationCount: 0,
    sealed: false,
  },
];

/** Mock version edges */
export const DEMO_VERSION_EDGES: VersionEdge[] = [
  { from: 'ver-demo-001', to: 'ver-demo-002' },
  { from: 'ver-demo-002', to: 'ver-demo-003' },
];

/** Mock diff data for version comparison */
export const DEMO_DIFF: VersionDiff = {
  additions: 5,
  deletions: 2,
  hunks: [
    { type: 'context', content: '<section class="hero">' },
    { type: 'remove', content: '  <h1>ProductX</h1>' },
    { type: 'add', content: '  <h1>ProductX - 让效率翻倍</h1>' },
    { type: 'context', content: '  <p class="subtitle">智能工作流引擎</p>' },
    { type: 'remove', content: '  <a href="#" class="btn">开始</a>' },
    { type: 'add', content: '  <a href="#signup" class="cta-button">免费试用</a>' },
    { type: 'context', content: '</section>' },
    { type: 'add', content: '<section class="features">' },
    { type: 'add', content: '  <div class="feature-card">...</div>' },
    { type: 'add', content: '</section>' },
  ],
};

/** Mock HTML errors */
export const DEMO_HTML_ERRORS: HtmlError[] = [
  {
    line: 15,
    column: 3,
    message: 'Unclosed tag <div> detected',
    type: 'parse-error',
  },
  {
    line: 28,
    column: 10,
    message: 'Unexpected closing tag </span>',
    type: 'parse-error',
  },
];
