# 🎛️ 프롬프트 튜닝 가이드

test-pipeline.ts를 활용한 프롬프트 최적화 방법입니다.

## 📋 **전체 프로세스**

```
1. 현재 결과 확인
   ↓
2. 결과 백업
   ↓
3. 프롬프트 수정
   ↓
4. 재실행 & 결과 비교
   ↓
5. 만족하면 적용, 아니면 2번으로
```

---

## 🔄 **단계별 실행 방법**

### **Step 1: 현재 결과 확인**

```bash
# 테스트 실행
npx tsx server/test-pipeline.ts

# 결과 요약 보기
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test_outputs/1_output.json', 'utf-8'));
console.log(JSON.stringify(data.summary, null, 2));
"
```

**출력 예시:**
```json
{
  "totalMessages": 20,
  "highCount": 6,
  "mediumCount": 12,
  "lowCount": 2,
  "highPercent": "30.0",
  "mediumPercent": "60.0"
}
```

---

### **Step 2: 현재 결과 백업**

```bash
# V1으로 백업
cp test_outputs/1_output.json test_outputs/1_output_v1.json

# 또는 날짜별 백업
cp test_outputs/1_output.json test_outputs/1_output_$(date +%Y%m%d_%H%M).json
```

---

### **Step 3: 프롬프트 수정**

각 Stage의 프롬프트 위치:

| Stage | 프롬프트 파일 | 함수명 |
|-------|-------------|--------|
| 1 | `server/services/gemini-filter.ts` | `createFilterPrompt()` |
| 2 | `server/services/gemini-batch-summary.ts` | `createBatchSummaryPrompt()` |
| 3 | `server/services/gemini-summarizer.ts` | `createSummaryPrompt()` |
| 4 | `client/src/utils/claudeInputBuilder.ts` | `createSystemPrompt()` |
| 5 | `server/services/claude-coach-tea.ts` | `createTeaCoachSystemPrompt()` |

**예시: Stage 1 필터링 기준 변경**

```typescript
// server/services/gemini-filter.ts

// 원본:
**1. 증거를 놓치지 마라**
- 애매하면 MEDIUM으로
- 중요할 것 같으면 올려서 분류
- "덜 중요한 것 포함" > "중요한 것 놓침"

// 수정 (더 엄격한 기준):
**1. 엄격한 증거 선별**
- 애매하면 LOW로
- 명백한 증거만 HIGH로 분류
- "정밀도 우선" > "재현율 우선"
```

---

### **Step 4: 재실행 & 비교**

```bash
# 1. 재실행
npx tsx server/test-pipeline.ts

# 2. 비교 스크립트 실행
node -e "
const fs = require('fs');
const v1 = JSON.parse(fs.readFileSync('test_outputs/1_output_v1.json', 'utf-8'));
const v2 = JSON.parse(fs.readFileSync('test_outputs/1_output.json', 'utf-8'));

console.log('📊 프롬프트 변경 전/후 비교\n');
console.log('🔹 V1 (원본):');
console.log('   HIGH: ' + v1.summary.highCount + ' (' + v1.summary.highPercent + '%)');
console.log('   MEDIUM: ' + v1.summary.mediumCount + ' (' + v1.summary.mediumPercent + '%)');

console.log('\n🔹 V2 (수정):');
console.log('   HIGH: ' + v2.summary.highCount + ' (' + v2.summary.highPercent + '%)');
console.log('   MEDIUM: ' + v2.summary.mediumCount + ' (' + v2.summary.mediumPercent + '%)');

console.log('\n🔄 변화:');
console.log('   HIGH: ' + (v2.summary.highCount - v1.summary.highCount));
console.log('   MEDIUM: ' + (v2.summary.mediumCount - v1.summary.mediumCount));
"
```

**출력 예시:**
```
📊 프롬프트 변경 전/후 비교

🔹 V1 (원본):
   HIGH: 6 (30.0%)
   MEDIUM: 12 (60.0%)

🔹 V2 (수정):
   HIGH: 0 (0.0%)
   MEDIUM: 16 (80.0%)

🔄 변화:
   HIGH: -6
   MEDIUM: 4
```

---

### **Step 5: 상세 차이 분석**

```bash
# 메시지별 분류 변화 확인
node -e "
const fs = require('fs');
const v1 = JSON.parse(fs.readFileSync('test_outputs/1_output_v1.json', 'utf-8'));
const v2 = JSON.parse(fs.readFileSync('test_outputs/1_output.json', 'utf-8'));

const v1High = new Set(v1.merged.high.map(m => m.index));
const v2High = new Set(v2.merged.high.map(m => m.index));

// HIGH에서 제외된 메시지
const removed = [...v1High].filter(idx => !v2High.has(idx));
if (removed.length > 0) {
  console.log('❌ HIGH → MEDIUM/LOW 강등:');
  removed.forEach(idx => {
    const msg = v1.merged.high.find(m => m.index === idx);
    console.log('  [' + idx + '] ' + msg.user + ': ' + msg.message.substring(0, 40));
    console.log('      이유: ' + msg.reason.substring(0, 60) + '...\n');
  });
}

// HIGH로 승격된 메시지
const added = [...v2High].filter(idx => !v1High.has(idx));
if (added.length > 0) {
  console.log('\n✅ MEDIUM/LOW → HIGH 승격:');
  added.forEach(idx => {
    const msg = v2.merged.high.find(m => m.index === idx);
    console.log('  [' + idx + '] ' + msg.user + ': ' + msg.message.substring(0, 40));
  });
}
"
```

---

## 💡 **실전 튜닝 예시**

### **예시 1: HIGH 비율 조정**

**목표:** HIGH 30% → 10%로 줄이기

**방법:**
```typescript
// gemini-filter.ts 수정
**목표 비율:**
- HIGH: 7% → 5%로 변경
- MEDIUM: 13% → 10%로 변경
- 분류 기준을 더 엄격하게
```

**검증:**
```bash
npx tsx server/test-pipeline.ts
# 결과가 목표에 가까워질 때까지 반복
```

---

### **예시 2: 관계 전환점 감지 개선**

**목표:** "다음에 같이 먹자" 같은 메시지를 HIGH로

**방법:**
```typescript
// gemini-filter.ts 수정
**1. 관계 전환점**
- 호칭 변화
- 관계 정의
- 고백/거절
+ 미래 약속 ("다음에", "언제", "같이") ← 추가
```

**검증:**
```bash
npx tsx server/test-pipeline.ts
# HIGH 메시지에 약속 관련 내용 포함되는지 확인
```

---

### **예시 3: Claude 분석 깊이 향상**

**목표:** 애착 스타일 분석을 더 구체적으로

**방법:**
```typescript
// client/src/utils/claudeInputBuilder.ts 수정

// 원본:
- 안정 애착: 균형적 소통
- 불안 애착: 확인 요구
- 회피 애착: 거리 두기

// 수정:
- 안정 애착: 
  * 갈등 시 감정 표현 + 해결 시도
  * 거절 시 존중하는 태도
  * 친밀감과 독립성 균형
- 불안 애착:
  * "어디야?" "뭐해?" 반복 질문
  * 답장 없을 때 불안 표출
  * 버림받음 두려움 암시
```

---

## 🔍 **결과 분석 도구**

### **1. JSON 경로 탐색**

```bash
# HIGH 메시지만 보기
node -e "
const data = JSON.parse(require('fs').readFileSync('test_outputs/1_output.json', 'utf-8'));
console.log(JSON.stringify(data.merged.high, null, 2));
" | head -50
```

### **2. 통계 비교**

```bash
# 여러 버전 비교
for file in test_outputs/1_output_v*.json; do
  echo "=== $file ===="
  node -e "console.log(JSON.parse(require('fs').readFileSync('$file')).summary)"
done
```

### **3. 특정 메시지 추적**

```bash
# 인덱스 12번 메시지가 어떻게 분류되었는지
node -e "
const data = JSON.parse(require('fs').readFileSync('test_outputs/1_output.json', 'utf-8'));
const msg = data.merged.high.find(m => m.index === 12) || 
            data.merged.medium.find(m => m.index === 12);
console.log(msg || '메시지를 찾을 수 없음');
"
```

---

## ⚠️ **주의사항**

### **1. 백업 필수**
```bash
# 좋은 결과는 반드시 백업
cp test_outputs/1_output.json test_outputs/1_output_GOOD_$(date +%Y%m%d).json
```

### **2. 점진적 변경**
- 한 번에 한 가지만 수정
- 큰 변화보다 작은 조정 반복
- 각 변경의 영향 확인 후 다음 진행

### **3. API 비용 고려**
```bash
# 작은 샘플로 먼저 테스트
# server/sample.txt에 50-100개 메시지만 넣고 테스트
```

### **4. 프로덕션 반영 전 검증**
```bash
# 1. 작은 샘플 (20개)
# 2. 중간 샘플 (500개)
# 3. 큰 샘플 (5,000개)
# 4. 전체 데이터
# 순서로 검증 후 반영
```

---

## 📊 **최적화 체크리스트**

### **Stage 1 (필터링)**
- [ ] HIGH 비율이 5-10% 사이인가?
- [ ] MEDIUM 비율이 10-15% 사이인가?
- [ ] 중요한 전환점이 HIGH로 분류되는가?
- [ ] 일상 대화가 MEDIUM으로 분류되는가?

### **Stage 2 (배치 요약)**
- [ ] 각 배치 요약이 500토큰 이하인가?
- [ ] 핵심 패턴이 잘 추출되는가?
- [ ] Top Events가 의미있는가?

### **Stage 3 (FBI 프로파일)**
- [ ] Timeline이 시간순으로 정렬되는가?
- [ ] Turning Points가 실제 전환점인가?
- [ ] 관계 건강도가 합리적인가?

### **Stage 4 (Claude 분석)**
- [ ] 심리학적 분석이 깊이있는가?
- [ ] 메시지 인용이 3개 이상인가?
- [ ] 애착 스타일이 합리적인가?

### **Stage 5 (Tea Coach)**
- [ ] 6개 인사이트가 모두 생성되는가?
- [ ] 실천 가능한 조언이 포함되는가?
- [ ] AS-IS/TO-BE가 구체적인가?

---

## 🎯 **Best Practice**

1. **버전 관리**
   ```bash
   # Git으로 프롬프트 변경 추적
   git diff server/services/gemini-filter.ts
   ```

2. **A/B 테스트**
   ```bash
   # 같은 샘플로 여러 프롬프트 비교
   # v1, v2, v3 결과를 나란히 비교
   ```

3. **문서화**
   ```bash
   # 변경 이유와 결과를 기록
   echo "2024-10-10: HIGH 기준 완화, 30% → 10%" >> CHANGELOG.md
   ```

4. **롤백 준비**
   ```bash
   # 언제든 원래대로 돌아갈 수 있게
   git checkout server/services/gemini-filter.ts
   ```

---

## 📚 **참고 자료**

- 각 Stage 프롬프트: `server/services/*.ts`
- 테스트 스크립트: `server/test-pipeline.ts`
- 실행 가이드: `server/TEST_PIPELINE_README.md`
- 전체 플로우: `PROMPT_TUNING_GUIDE.md` (이 문서)
