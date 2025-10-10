# 🔬 Maltcha Pipeline Test Guide

test-pipeline.ts를 사용하여 각 단계를 독립적으로 테스트하고 검증하는 방법입니다.

## 📋 준비사항

### 1. 테스트 파일 준비
`server/sample.txt`에 카카오톡 대화 파일을 넣어주세요.

**지원 형식:**
```
2024. 1. 15. 오후 9:30, 지우 : 오늘 뭐했어?
2024. 1. 15. 오후 9:32, 민수 : 회사에서 일하다가 막 퇴근했어
```

### 2. test_outputs 폴더 확인
결과가 저장될 폴더입니다 (자동 생성됨).

---

## 🚀 실행 방법

### Step 1: Stage 0 (파싱) 테스트

**1-1. test-pipeline.ts 열기**
- Stage 0 코드만 활성화되어 있는지 확인
- 나머지는 모두 주석 처리

**1-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**1-3. 결과 확인**
```bash
cat test_outputs/0_output.json
```

**검증 항목:**
- [ ] 메시지가 올바르게 파싱되었는가?
- [ ] 참여자 이름이 정확한가?
- [ ] 타임스탬프 형식이 맞는가?
- [ ] 메시지 수가 정확한가?

---

### Step 2: Stage 1 (Gemini 필터링) 테스트

**2-1. test-pipeline.ts 수정**
```typescript
// Stage 1 주석 해제
console.log('Stage 1: Gemini 필터링 중...');
const stage0Data = await loadStageResult<typeof stage0Output>(0);
// ... (주석 해제)
```

**2-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**2-3. 결과 확인**
```bash
cat test_outputs/1_output.json
```

**검증 항목:**
- [ ] HIGH 비율이 7% 근처인가?
- [ ] MEDIUM 비율이 13% 근처인가?
- [ ] 중요한 메시지가 HIGH로 분류되었는가?
- [ ] 일상 대화가 MEDIUM으로 분류되었는가?

---

### Step 3: Stage 2 (배치 요약) 테스트

**3-1. test-pipeline.ts 수정**
```typescript
// Stage 2 주석 해제
console.log('Stage 2: Gemini 배치 요약 중...');
const stage1Data = await loadStageResult<typeof stage1Output>(1);
// ... (주석 해제)
```

**3-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**3-3. 결과 확인**
```bash
cat test_outputs/2_output.json
```

**검증 항목:**
- [ ] 배치 수가 올바른가? (메시지 수 ÷ 2000)
- [ ] 각 배치 요약이 500토큰 이하인가?
- [ ] Pattern Groups가 의미있는가?
- [ ] Top Events가 올바른가?

---

### Step 4: Stage 3 (FBI 프로파일러) 테스트

**4-1. test-pipeline.ts 수정**
```typescript
// Stage 3 주석 해제
console.log('Stage 3: Gemini 프로파일러 중...');
const stage1Data3 = await loadStageResult<typeof stage1Output>(1);
// ... (주석 해제)
```

**4-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**4-3. 결과 확인**
```bash
cat test_outputs/3_output.json
```

**검증 항목:**
- [ ] Timeline이 의미있는가?
- [ ] Turning Points가 관계 전환점을 잘 찾았는가?
- [ ] HIGH indices가 모두 포함되었는가?
- [ ] 관계 건강도 점수가 합리적인가?

---

### Step 5: Stage 4 (Claude 심층 분석) 테스트

**5-1. test-pipeline.ts 수정**
```typescript
// Stage 4 주석 해제
console.log('Stage 4: Claude 심층 분석 중...');
const stage0Data4 = await loadStageResult<typeof stage0Output>(0);
// ... (주석 해제)
```

**5-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**5-3. 결과 확인**
```bash
cat test_outputs/4_output.json
```

**검증 항목:**
- [ ] 심리학적 분석이 깊이있는가?
- [ ] 메시지 인용이 3개 이상 포함되었는가?
- [ ] 관계 역학(추격-도피 등)이 정확한가?
- [ ] 애착 스타일 분석이 합리적인가?

---

### Step 6: Stage 5 (Tea Coach) 테스트

**6-1. test-pipeline.ts 수정**
```typescript
// Stage 5 주석 해제
console.log('Stage 5: Tea Coach 보고서 생성 중...');
const stage3Data5 = await loadStageResult<typeof stage3Output>(3);
// ... (주석 해제)
```

**6-2. 실행**
```bash
npx tsx server/test-pipeline.ts
```

**6-3. 결과 확인**
```bash
cat test_outputs/5_output.json
```

**검증 항목:**
- [ ] 6개 인사이트가 모두 생성되었는가?
- [ ] 티키타카 지수가 합리적인가?
- [ ] 실천 가능한 조언이 포함되었는가?
- [ ] AS-IS/TO-BE 스크립트가 구체적인가?
- [ ] 3주 플랜이 현실적인가?

---

## 🐛 디버깅 팁

### 에러 발생 시

**1. API 키 확인**
```bash
# Gemini API 키
echo $GEMINI_API_KEY

# Anthropic API 키  
echo $ANTHROPIC_API_KEY
```

**2. 이전 단계 결과 확인**
```bash
# Stage N-1의 출력을 확인
cat test_outputs/<N-1>_output.json | jq
```

**3. 토큰 제한 확인**
- Gemini Free: 250K TPM
- Claude Tier 1: 50K ITPM
- 큰 파일은 작은 샘플로 먼저 테스트

**4. 로그 확인**
```bash
# 전체 로그 출력
npx tsx server/test-pipeline.ts 2>&1 | tee test.log
```

---

## 📊 결과 파일 구조

```
test_outputs/
├── 0_output.json    # 파싱 결과
├── 1_output.json    # Gemini 필터링 결과
├── 2_output.json    # 배치 요약 결과
├── 3_output.json    # FBI 프로파일 결과
├── 4_output.json    # Claude 심층 분석 결과
└── 5_output.json    # Tea Coach 보고서 결과
```

---

## 💡 활용 예시

### 프롬프트 튜닝
1. Stage N의 프롬프트 수정
2. `npx tsx server/test-pipeline.ts` 실행
3. `test_outputs/N_output.json` 확인
4. 결과 비교 후 개선

### 배치 크기 실험
```typescript
// test-pipeline.ts에서 수정
const BATCH_SIZE = 5000; // 2000 → 5000
```

### 특정 단계만 재실행
```typescript
// Stage 4만 다시 테스트
// Stage 0-3 주석 처리
// Stage 4만 활성화
```

---

## 🚨 주의사항

1. **API 비용**: 각 실행마다 API 호출이 발생합니다
2. **Rate Limit**: 너무 빠르게 반복 실행 시 제한 걸릴 수 있음
3. **파일 크기**: 큰 대화 파일은 작은 샘플로 먼저 테스트
4. **민감정보**: test_outputs/*.json에 실제 대화 내용 포함됨

---

## 🎯 Best Practice

1. **작은 샘플부터**: 20-50개 메시지로 먼저 테스트
2. **단계별 검증**: 각 단계 완벽히 검증 후 다음 단계 진행
3. **결과 비교**: 프롬프트 수정 전/후 결과를 diff로 비교
4. **버전 관리**: 좋은 결과는 별도 폴더에 백업

```bash
# 좋은 결과 백업
cp -r test_outputs test_outputs_v1_good
```

---

## 📚 참고

- 각 Stage의 상세 프롬프트는 `server/services/*.ts` 참고
- 배치 크기 최적화는 `routes.ts` 참고
- API Rate Limit은 Gemini/Claude 공식 문서 참고
