import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { URL } from 'url';

const BASE_URL = 'https://digitalarchive.tokyodisneyresort.jp/spacemountain/';

// 最大ファイルパス長
const MAX_PATH_LENGTH = 255;

// オリジンごとのディレクトリを生成し、相対パスでファイルパスを生成する関数
function generateFilePath(url: string): string {
  const parsedUrl = new URL(url);
  const origin = parsedUrl.origin.replace(/https?:\/\//, '').replace(/\/$/, '');
  let relativePath = parsedUrl.pathname + (parsedUrl.search || '');

  // 特殊文字をファイル名として利用可能な文字に置換
  relativePath = relativePath.replace(/[\?<>:"|*]/g, '_');

  // ファイルパスが長すぎる場合は制限をかける
  if (relativePath.length > MAX_PATH_LENGTH) {
    const hash = crypto.createHash('sha256').update(relativePath).digest('hex');
    relativePath = `${path.basename(parsedUrl.pathname)}-${hash}`;
  }

  return path.join(__dirname, 'responses', origin, relativePath);
}

// HTMLコンテンツを保存する関数
async function saveHTML(url: string, html: string) {
  try {
    const filePath = generateFilePath(url);
    const htmlFilePath = filePath + '.html';

    // 既にファイルが存在する場合、保存をスキップ
    if (fs.existsSync(htmlFilePath)) {
      console.log(`Skipped: ${url} - HTML file already exists`);
      return;
    }

    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(htmlFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // HTMLコンテンツをファイルに保存
    fs.writeFileSync(htmlFilePath, html);
    console.log(`Saved: ${url} as ${htmlFilePath}`);
  } catch (error) {
    console.error(`Failed to save HTML from ${url}:`, error);
  }
}

// レスポンスを保存する関数
async function saveResponse(url: string, buffer: Buffer) {
  try {
    const filePath = generateFilePath(url);

    // 既にファイルが存在する場合、保存をスキップ
    if (fs.existsSync(filePath)) {
      console.log(`Skipped: ${url} - File already exists`);
      return;
    }

    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // レスポンスをファイルに保存
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved: ${url} as ${filePath}`);
  } catch (error) {
    console.error(`Failed to save ${url}:`, error);
  }
}

(async () => {
  // ブラウザを起動
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // ビューポートサイズを設定
  await page.setViewport({ width: 1920, height: 1080 });

  // レスポンスをフック
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();

    if (status === 200) { // 成功したレスポンスのみ保存
      try {
        const buffer = await response.buffer();
        await saveResponse(url, buffer);
      } catch (error) {
        console.error(`Error processing response from ${url}:`, error);
      }
    }
  });

  // 指定されたURLを開く
  await page.goto(BASE_URL);

  // ページのHTMLコンテンツを取得して保存
  const htmlContent = await page.content();
  await saveHTML(BASE_URL, htmlContent);

  // 手動での操作のため、スクリプトを維持
  console.log('Press Ctrl+C to stop the script.');
})().catch(error => {
  console.error('Error:', error);
});

