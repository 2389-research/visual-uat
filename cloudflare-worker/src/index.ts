// ABOUTME: Cloudflare Worker for visual-uat report hosting with token-based access control
// ABOUTME: Handles report uploads from GitHub Actions and serves HTML reports with expiring access tokens

interface Env {
  REPORTS: KVNamespace;
  TOKENS: KVNamespace;
}

interface ReportMetadata {
  org: string;
  repo: string;
  pr: number;
  token: string;
  uploadedAt: number;
  expiresAt: number;
}

interface TokenData {
  org: string;
  repo: string;
  pr: number;
  createdAt: number;
  expiresAt: number;
}

const MAX_REPORT_SIZE = 50 * 1024 * 1024; // 50MB
const TOKEN_EXPIRY_DAYS = 7;
const RATE_LIMIT_UPLOADS_PER_HOUR = 10;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Upload endpoint: POST /upload
    if (url.pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env, corsHeaders);
    }

    // View endpoint: GET /{org}/{repo}/pr-{number}/{token}/{file}
    const viewMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pr-(\d+)\/([a-f0-9]{32})\/(.+)$/);
    if (viewMatch && request.method === 'GET') {
      const [, org, repo, prStr, token, file] = viewMatch;
      return handleView(org, repo, parseInt(prStr), token, file, env);
    }

    // List endpoint (for testing): GET /{org}/{repo}/pr-{number}/{token}/
    const listMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pr-(\d+)\/([a-f0-9]{32})\/?$/);
    if (listMatch && request.method === 'GET') {
      const [, org, repo, prStr, token] = listMatch;
      return handleList(org, repo, parseInt(prStr), token, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleUpload(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const contentType = request.headers.get('Content-Type');
    if (!contentType?.includes('multipart/form-data')) {
      return new Response('Content-Type must be multipart/form-data', {
        status: 400,
        headers: corsHeaders
      });
    }

    const formData = await request.formData();
    const org = formData.get('org') as string;
    const repo = formData.get('repo') as string;
    const prStr = formData.get('pr') as string;
    const githubToken = formData.get('github_token') as string;

    if (!org || !repo || !prStr || !githubToken) {
      return new Response('Missing required fields: org, repo, pr, github_token', {
        status: 400,
        headers: corsHeaders
      });
    }

    const pr = parseInt(prStr);
    if (isNaN(pr)) {
      return new Response('Invalid PR number', { status: 400, headers: corsHeaders });
    }

    // Verify GitHub token (check it's a real PR)
    const ghResponse = await fetch(`https://api.github.com/repos/${org}/${repo}/pulls/${pr}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'visual-uat-reports'
      }
    });

    if (!ghResponse.ok) {
      return new Response('Invalid GitHub token or PR does not exist', {
        status: 403,
        headers: corsHeaders
      });
    }

    // Rate limiting check
    const rateLimitKey = `ratelimit:${org}:${repo}:${Math.floor(Date.now() / 3600000)}`;
    const uploadCount = parseInt((await env.REPORTS.get(rateLimitKey)) || '0');
    if (uploadCount >= RATE_LIMIT_UPLOADS_PER_HOUR) {
      return new Response('Rate limit exceeded. Max 10 uploads per hour per repo.', {
        status: 429,
        headers: corsHeaders
      });
    }

    // Generate token
    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store token metadata
    const tokenData: TokenData = {
      org,
      repo,
      pr,
      createdAt: now,
      expiresAt
    };
    await env.TOKENS.put(`token:${token}`, JSON.stringify(tokenData), {
      expirationTtl: TOKEN_EXPIRY_DAYS * 24 * 60 * 60
    });

    // Store files
    const files = formData.getAll('files');
    let totalSize = 0;

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const fileSize = file.size;
      totalSize += fileSize;

      if (totalSize > MAX_REPORT_SIZE) {
        return new Response('Total report size exceeds 50MB limit', {
          status: 413,
          headers: corsHeaders
        });
      }

      const fileKey = `report:${org}:${repo}:${pr}:${token}:${file.name}`;
      const fileData = await file.arrayBuffer();

      await env.REPORTS.put(fileKey, fileData, {
        expirationTtl: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        metadata: {
          contentType: file.type || 'application/octet-stream',
          filename: file.name,
          size: fileSize
        }
      });
    }

    // Update rate limit counter
    await env.REPORTS.put(rateLimitKey, (uploadCount + 1).toString(), {
      expirationTtl: 3600
    });

    // Return report URL
    const reportUrl = `https://visual-uat-reports.pages.dev/${org}/${repo}/pr-${pr}/${token}/latest.html`;

    return new Response(JSON.stringify({
      success: true,
      url: reportUrl,
      token,
      expiresAt: new Date(expiresAt).toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}

async function handleView(
  org: string,
  repo: string,
  pr: number,
  token: string,
  file: string,
  env: Env
): Promise<Response> {
  // Validate token
  const tokenDataStr = await env.TOKENS.get(`token:${token}`);
  if (!tokenDataStr) {
    return new Response('Invalid or expired token', { status: 404 });
  }

  const tokenData: TokenData = JSON.parse(tokenDataStr);

  // Verify token matches the requested org/repo/pr
  if (tokenData.org !== org || tokenData.repo !== repo || tokenData.pr !== pr) {
    return new Response('Token does not match requested report', { status: 403 });
  }

  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    return new Response('Token has expired', { status: 410 });
  }

  // Fetch file
  const fileKey = `report:${org}:${repo}:${pr}:${token}:${file}`;
  const fileData = await env.REPORTS.get(fileKey, { type: 'arrayBuffer', cacheTtl: 3600 });

  if (!fileData) {
    return new Response('File not found', { status: 404 });
  }

  const metadata = await env.REPORTS.getWithMetadata(fileKey);
  const contentType = (metadata.metadata as any)?.contentType || 'application/octet-stream';

  return new Response(fileData, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function handleList(
  org: string,
  repo: string,
  pr: number,
  token: string,
  env: Env
): Promise<Response> {
  // Validate token (same as handleView)
  const tokenDataStr = await env.TOKENS.get(`token:${token}`);
  if (!tokenDataStr) {
    return new Response('Invalid or expired token', { status: 404 });
  }

  const tokenData: TokenData = JSON.parse(tokenDataStr);
  if (tokenData.org !== org || tokenData.repo !== repo || tokenData.pr !== pr) {
    return new Response('Token does not match requested report', { status: 403 });
  }

  if (Date.now() > tokenData.expiresAt) {
    return new Response('Token has expired', { status: 410 });
  }

  // List files for this report
  const prefix = `report:${org}:${repo}:${pr}:${token}:`;
  const list = await env.REPORTS.list({ prefix });

  const files = list.keys.map(k => k.name.replace(prefix, ''));

  // Generate HTML with links
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual UAT Report - ${org}/${repo} PR #${pr}</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { margin: 10px 0; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Visual UAT Report</h1>
  <p><strong>Repository:</strong> ${org}/${repo}</p>
  <p><strong>Pull Request:</strong> #${pr}</p>
  <p><strong>Expires:</strong> ${new Date(tokenData.expiresAt).toLocaleString()}</p>
  <h2>Files:</h2>
  <ul>
    ${files.map(f => `<li><a href="/${org}/${repo}/pr-${pr}/${token}/${f}">${f}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

function generateToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
