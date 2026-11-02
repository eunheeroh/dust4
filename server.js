// 로컬 테스트용 경량 서버 (별도 npm 패키지 설치 없이 Node.js 내장 모듈만 사용)
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// .env.local 파일에서 환경변수 로드
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...values] = trimmed.split("=");
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join("=").trim();
      }
    }
  });
}

// api/dust.js 핸들러 가져오기
const dustHandler = require("./api/dust.js");

// MIME 타입 매핑
const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. /api/dust 요청 처리 (Vercel 서버리스 함수 모의 실행)
  if (pathname === "/api/dust") {
    // Vercel Serverless Function 호환 req, res 래핑
    req.query = parsedUrl.query;

    res.status = function (statusCode) {
      this.statusCode = statusCode;
      return this;
    };

    res.json = function (data) {
      this.setHeader("Content-Type", "application/json; charset=UTF-8");
      this.end(JSON.stringify(data));
    };

    try {
      await dustHandler(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=UTF-8");
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. 정적 파일 서빙 (index.html, style.css, script.js 등)
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.join(__dirname, path.normalize(filePath));

  if (!safePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end("403 Forbidden");
    return;
  }

  fs.readFile(safePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=UTF-8");
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(content);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[서버 실행 중] http://localhost:${PORT}`);
});

