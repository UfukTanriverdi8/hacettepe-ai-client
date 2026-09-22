# HULLM API Documentation

## Endpoints

| Endpoint | URL | Backend | Timeout | Aciklama |
|---|---|---|---|---|
| Primitive (v1) | `POST /primitive` | hullm_backend_v1 | 30s | Tek ajan, tek KB. Hizli, basit. |
| Agentic (v2) | `POST` Function URL | hullm_orchestrator | **Limitsiz** | Multi-ajan, orchestrator. Detayli. |
| Agentic (eski) | `POST /agentic` | hullm_backend_v2 | 30s | Eski endpoint, timeout riski var. |

### URL'ler

```
# Primitive (API Gateway)
POST https://q82k342s8l.execute-api.us-east-1.amazonaws.com/primitive

# Agentic - Orchestrator (Lambda Function URL, ONERILEN)
POST https://qckicd34rob6c3allg2gyvf2zu0kovic.lambda-url.us-east-1.on.aws/

# Agentic - Eski (API Gateway, 30s timeout riski)
POST https://q82k342s8l.execute-api.us-east-1.amazonaws.com/agentic
```

Her iki endpoint ayni request/response formatini kullanir. Frontend hangi endpoint'e istek atarsa, DynamoDB'ye o versiyonla (`v1` veya `v2`) kaydedilir.

---

## 1. Chat (Soru Sorma)

### Request

```http
POST https://qckicd34rob6c3allg2gyvf2zu0kovic.lambda-url.us-east-1.on.aws/
Content-Type: application/json

{
  "action": "chat",
  "prompt": "Hacettepe yaz okulunda devam zorunlulugu nedir?",
  "session_id": "optional-session-id"
}
```

| Alan | Tip | Zorunlu | Aciklama |
|---|---|---|---|
| `action` | string | Evet | `"chat"` olmali |
| `prompt` | string | Evet | Kullanicinin sorusu |
| `session_id` | string | Hayir | Konusma oturumu ID'si. Verilmezse otomatik olusturulur. Ayni session_id ile yapilan ardisik sorularda baglam korunur. |

### Response (200 OK)

Orchestrator (v2) response'u `statusCode` + `body` icinde gelir:

```json
{
  "statusCode": 200,
  "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
  "body": "{\"response\": \"Hacettepe...\", \"session_id\": \"abc\", \"timestamp\": \"2026-...\", \"domain\": \"prospective\", \"steps\": [\"Sorunuz analiz ediliyor...\", \"Alan: prospective\", \"Ogrenci hizmetlerinde araniyor...\"]}"
}
```

Body (parsed):

```json
{
  "response": "Hacettepe Universitesi Yaz Okulu Yonetmeligi'ne gore...",
  "session_id": "optional-session-id",
  "timestamp": "2026-04-11T14:31:09.267248+00:00",
  "domain": "formal",
  "steps": [
    "Sorunuz analiz ediliyor...",
    "Alan: formal",
    "Bolum belirleniyor...",
    "Computer Engineering ajani cagriliyor..."
  ]
}
```

| Alan | Tip | Aciklama |
|---|---|---|
| `response` | string | Ajanin cevabi (Markdown formatinda) |
| `session_id` | string | Oturum ID'si (feedback icin saklanmali) |
| `timestamp` | string | ISO 8601 zaman damgasi (feedback icin saklanmali) |
| `domain` | string | `"formal"`, `"prospective"`, veya `"both"` (sadece v2) |
| `steps` | list | Routing adimlari (sadece v2, UI'da gosterilebilir) |

Primitive (v1) response'u direkt JSON doner (wrapper yok):

```json
{
  "response": "...",
  "session_id": "...",
  "timestamp": "..."
}
```

### Error Responses

| Status | Body | Neden |
|---|---|---|
| 400 | `{"error": "Prompt cannot be empty"}` | `prompt` alani bos |
| 429 | `{"error": "Sistem su an yogun..."}` | Bedrock throttling |
| 500 | `{"error": "AI modeline ulasilirken bir hata olustu."}` | Bedrock hatasi |
| 500 | `{"error": "Internal server error"}` | Genel hata |

---

## 2. Feedback (Geri Bildirim)

### Request

Ayni endpoint'e `action: "feedback"` ile gonderilir:

```http
POST https://qckicd34rob6c3allg2gyvf2zu0kovic.lambda-url.us-east-1.on.aws/
Content-Type: application/json

{
  "action": "feedback",
  "session_id": "onceki-chat-session-id",
  "timestamp": "onceki-chat-timestamp",
  "feedback_value": "Positive",
  "rating": 8,
  "feedback_reason": "Dogru ve detayli cevap"
}
```

| Alan | Tip | Zorunlu | Aciklama |
|---|---|---|---|
| `action` | string | Evet | `"feedback"` olmali |
| `session_id` | string | Evet | Chat response'undaki `session_id` |
| `timestamp` | string | Evet | Chat response'undaki `timestamp` |
| `feedback_value` | string | Evet | `"Positive"` veya `"Negative"` |
| `rating` | number | Hayir | 0-10 arasi puan |
| `feedback_reason` | string | Hayir | Aciklama metni |

### Response (200 OK)

```json
{
  "statusCode": 200,
  "message": "Feedback saved"
}
```

---

## 3. Session Yonetimi

### Primitive (v1)
- Bedrock Agent'in built-in session memory'si kullanilir.
- Session idle timeout: **10 dakika**.
- Session memory saklama suresi: **30 gun**.
- Ayni `session_id` ile ardisik sorularda ajan onceki konusmayi hatirlar.

### Agentic (v2 Orchestrator)
- Her istek bagimsiz bir ajan oturumu olusturur (Bedrock Flow session yok).
- `session_id` DynamoDB loglama icin kullanilir.
- Frontend cok turlu konusma istiyorsa, onceki soru-cevaplari `prompt`'a context olarak eklemeli.

### Her iki backend icin:
- Frontend yeni konusma baslatmak istediginde yeni `session_id` uretmeli (UUID v4).
- `session_id` gonderilmezse otomatik olusturulur.

---

## 4. Mimari

### Primitive Backend (v1)

```
Frontend
  |
  POST /primitive (API Gateway, 30s timeout)
  |
  hullm_backend_v1 (Lambda, 60s timeout)
  |
  hacettepe-llm-agent (Bedrock Agent, tek ajan)
  |
  hacettepellm-kb-v1 (tek KB, tum data)
  |
  DynamoDB (hu_llm_logs, version="v1")
```

### Agentic Backend (v2 Orchestrator)

```
Frontend
  |
  POST Function URL (timeout yok)
  |
  hullm_orchestrator (Lambda, 300s timeout)
  |
  1. domain_decision_agent -> "formal" / "prospective" / "both"
  |
  2a. formal:
  |   department_decision_agent -> "computer_engineering" / "electrical_engineering" / "unknown"
  |   |
  |   bilinen bolum -> direkt o ajan (hizli, ~15s)
  |   unknown -> tum bolum ajanlari paralel (CENG + EE, ~25s)
  |
  2b. prospective:
  |   tum servis ajanlari paralel (student_affairs, ~15s)
  |
  2c. both:
  |   formal + prospective paralel calisir, sonuclar birlestirilir
  |
  3. En iyi cevap secilir ([NO_INFO] prefix ile negatif cevaplar filtrelenir)
  |
  DynamoDB (hu_llm_logs, version="v2")
```

Ajanlar:
- `domain_decision_agent` — formal/prospective/both routing
- `department_decision_agent` — bolum routing (CENG/EE/unknown)
- `computer_engineering_agent` — CENG KB'lerden cevap uretir
- `electrical_engineering_agent` — EE KB'lerden cevap uretir
- `student_affairs_agent` — Ogrenci isleri KB'lerden cevap uretir

---

## 5. DynamoDB Semasi

**Tablo:** `hu_llm_logs`

| Alan | Tip | Aciklama |
|---|---|---|
| `session_id` | String (PK) | Oturum ID |
| `timestamp` | String (SK) | ISO 8601 zaman damgasi |
| `version` | String | `"v1"` veya `"v2"` |
| `question` | String | Kullanici sorusu |
| `answer` | String | Sistem cevabi |
| `feedback` | String | `"Pending"`, `"Positive"`, `"Negative"` |
| `feedback_reason` | String | Feedback aciklamasi |
| `rating` | Number | 0-10 puan |
| `domain` | String | Hangi domain (v2) |
| `expire_at` | Number | TTL - 180 gun sonra otomatik silinir |

---

## 6. CORS

Tum endpoint'ler `Access-Control-Allow-Origin: *` header'i doner.

Orchestrator Function URL'de CORS yapilandirilmistir:
- AllowOrigins: `*`
- AllowMethods: `POST`
- AllowHeaders: `content-type`

---

## 7. Postman Test Koleksiyonu

### Chat — Primitive (v1)
```
POST https://q82k342s8l.execute-api.us-east-1.amazonaws.com/primitive
Body (raw JSON):
{
  "action": "chat",
  "prompt": "Hacettepe yaz okulunda devam zorunlulugu nedir?",
  "session_id": "postman-v1-001"
}
```

### Chat — Agentic Orchestrator (v2, onerilen)
```
POST https://qckicd34rob6c3allg2gyvf2zu0kovic.lambda-url.us-east-1.on.aws/
Body (raw JSON):
{
  "action": "chat",
  "prompt": "Ilyas Cicekli kimdir?",
  "session_id": "postman-v2-001"
}
```

### Feedback
```
POST https://qckicd34rob6c3allg2gyvf2zu0kovic.lambda-url.us-east-1.on.aws/
Body (raw JSON):
{
  "action": "feedback",
  "session_id": "postman-v2-001",
  "timestamp": "<chat response'undaki timestamp>",
  "feedback_value": "Positive",
  "rating": 9,
  "feedback_reason": "Cok detayli ve dogru cevap"
}
```

### Follow-up (session test)
```
POST https://q82k342s8l.execute-api.us-east-1.amazonaws.com/primitive
Body (raw JSON):
{
  "action": "chat",
  "prompt": "Peki F2 notu alan ogrenci ne yapmali?",
  "session_id": "postman-v1-001"
}
```
