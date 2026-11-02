// Vercel 서버리스 함수 핸들러
module.exports = async function handler(req, res) {
  // CORS 및 메서드 허용 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  // OPTIONS 사전 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. 주소 쿼리로 sido(시도 이름) 가져오기 (기본값: '서울')
  const sido = req.query.sido || "서울";

  // 2. 환경변수 AIRKOREA_KEY 에서 인증키 읽어오기
  const serviceKey = process.env.AIRKOREA_KEY;

  // 인증키가 설정되지 않은 경우 에러 응답 반환
  if (!serviceKey) {
    return res.status(500).json({
      error: "환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인해주세요.",
    });
  }

  try {
    // 3. Decoding 인증키를 encodeURIComponent로 인코딩하여 요청 URL 생성
    const encodedKey = encodeURIComponent(serviceKey.trim());
    const encodedSido = encodeURIComponent(sido);
    const targetUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=10&pageNo=1&sidoName=${encodedSido}&ver=1.3`;

    // 공공데이터포털 에어코리아 API 호출
    const response = await fetch(targetUrl);
    const responseText = await response.text();

    // 4. 응답 본문이 JSON인지 확인 (XML 오류 응답 대비)
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      // JSON 파싱 실패(XML 에러 메시지 등) 시 한국어 안내 메시지 반환
      return res.status(400).json({
        error: "인증키 또는 요청값을 확인해주세요.",
        raw: responseText,
      });
    }

    // 5. 응답 본문 안의 resultCode가 '00'(정상)이 아닐 때 처리
    const header = parsedData?.response?.header;
    if (header && header.resultCode !== "00") {
      return res.status(400).json({
        error: `공공데이터 API 오류: [${header.resultCode}] ${header.resultMsg || "요청을 처리할 수 없습니다."}`,
        resultCode: header.resultCode,
        resultMsg: header.resultMsg,
      });
    }

    // 성공한 원본 데이터 클라이언트로 전달
    return res.status(200).json(parsedData);
  } catch (error) {
    // 네트워크 오류 또는 서버 내부 예외 처리
    return res.status(500).json({
      error: `서버 내부 오류가 발생했습니다: ${error.message}`,
    });
  }
};

