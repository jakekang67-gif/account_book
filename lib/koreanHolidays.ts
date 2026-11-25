/**
 * 대한민국 공휴일 판별 (양력 고정 + 설·추석·부처님오신날 + 대체공휴일)
 * 음력 기준일은 2020–2035년 표를 사용합니다.
 */

type LunarAnchors = {
  /** 설날 당일 YYYY-MM-DD */
  seollal: string;
  /** 부처님오신날 YYYY-MM-DD */
  buddha: string;
  /** 추석 당일 YYYY-MM-DD */
  chuseok: string;
};

/** 설·추석·부처님오신날 당일 (음력 → 양력) */
const LUNAR_ANCHORS: Record<number, LunarAnchors> = {
  2020: { seollal: "2020-01-25", buddha: "2020-04-30", chuseok: "2020-10-01" },
  2021: { seollal: "2021-02-12", buddha: "2021-05-19", chuseok: "2021-09-21" },
  2022: { seollal: "2022-02-01", buddha: "2022-05-08", chuseok: "2022-09-10" },
  2023: { seollal: "2023-01-22", buddha: "2023-05-27", chuseok: "2023-09-29" },
  2024: { seollal: "2024-02-10", buddha: "2024-05-15", chuseok: "2024-09-17" },
  2025: { seollal: "2025-01-29", buddha: "2025-05-05", chuseok: "2025-10-06" },
  2026: { seollal: "2026-02-17", buddha: "2026-05-24", chuseok: "2026-09-25" },
  2027: { seollal: "2027-02-06", buddha: "2027-05-13", chuseok: "2027-09-15" },
  2028: { seollal: "2028-01-26", buddha: "2028-05-02", chuseok: "2028-10-03" },
  2029: { seollal: "2029-02-13", buddha: "2029-05-20", chuseok: "2029-09-22" },
  2030: { seollal: "2030-02-03", buddha: "2030-05-09", chuseok: "2030-09-12" },
  2031: { seollal: "2031-01-23", buddha: "2031-05-28", chuseok: "2031-10-01" },
  2032: { seollal: "2032-02-11", buddha: "2032-05-16", chuseok: "2032-09-19" },
  2033: { seollal: "2033-01-31", buddha: "2033-05-06", chuseok: "2033-09-08" },
  2034: { seollal: "2034-02-19", buddha: "2034-05-25", chuseok: "2034-09-27" },
  2035: { seollal: "2035-02-08", buddha: "2035-05-15", chuseok: "2035-09-16" },
};

const holidayCache = new Map<number, Set<string>>();

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(ymd: string, delta: number): string {
  const date = parseYmd(ymd);
  date.setDate(date.getDate() + delta);
  return toYmd(date);
}

function weekday(ymd: string): number {
  return parseYmd(ymd).getDay(); // 0=일 … 6=토
}

function nextWeekdayNotIn(set: Set<string>, fromYmd: string): string {
  let cur = addDays(fromYmd, 1);
  for (let i = 0; i < 14; i++) {
    const wd = weekday(cur);
    if (wd !== 0 && wd !== 6 && !set.has(cur)) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

/** 해당 연도의 공휴일 Set (YYYY-MM-DD) */
function holidaysForYear(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const set = new Set<string>();
  const add = (ymd: string) => set.add(ymd);

  // 양력 고정 공휴일
  add(`${year}-01-01`);
  add(`${year}-03-01`);
  add(`${year}-05-05`);
  add(`${year}-06-06`);
  add(`${year}-08-15`);
  add(`${year}-10-03`);
  add(`${year}-10-09`);
  add(`${year}-12-25`);

  const anchors = LUNAR_ANCHORS[year];
  if (anchors) {
    // 설날 연휴: 전날·당일·다음날
    add(addDays(anchors.seollal, -1));
    add(anchors.seollal);
    add(addDays(anchors.seollal, 1));
    // 부처님오신날
    add(anchors.buddha);
    // 추석 연휴: 전날·당일·다음날
    add(addDays(anchors.chuseok, -1));
    add(anchors.chuseok);
    add(addDays(anchors.chuseok, 1));
  }

  // 대체공휴일 (공휴일에 관한 법률)
  // · 어린이날: 토·일이면 대체
  // · 삼일절·광복절·개천절·한글날: 토·일이면 대체
  // · 설·추석 연휴: 연휴 중 토·일(또는 다른 공휴일)과 겹치면 연휴 다음 평일에 대체
  // · 부처님오신날이 다른 공휴일과 겹치면 대체
  const weekendSubstituteTargets = [
    `${year}-03-01`,
    `${year}-05-05`,
    `${year}-08-15`,
    `${year}-10-03`,
    `${year}-10-09`,
  ];

  for (const ymd of weekendSubstituteTargets) {
    const wd = weekday(ymd);
    if (wd === 0 || wd === 6) {
      add(nextWeekdayNotIn(set, ymd));
    }
  }

  if (anchors) {
    const seollalRange = [
      addDays(anchors.seollal, -1),
      anchors.seollal,
      addDays(anchors.seollal, 1),
    ];
    const chuseokRange = [
      addDays(anchors.chuseok, -1),
      anchors.chuseok,
      addDays(anchors.chuseok, 1),
    ];

    for (const range of [seollalRange, chuseokRange]) {
      const overlapsWeekendOrOther = range.some((d) => {
        const wd = weekday(d);
        if (wd === 0 || wd === 6) return true;
        // 연휴 날짜가 다른 고정 공휴일과 겹침(예: 개천절)
        const fixedAlone = new Set([
          `${year}-01-01`,
          `${year}-03-01`,
          `${year}-05-05`,
          `${year}-06-06`,
          `${year}-08-15`,
          `${year}-10-03`,
          `${year}-10-09`,
          `${year}-12-25`,
          anchors.buddha,
        ]);
        // 연휴 자체 구성원끼리의 겹침은 제외하고, 연휴 밖 공휴일과 겹칠 때
        return fixedAlone.has(d);
      });
      if (overlapsWeekendOrOther) {
        add(nextWeekdayNotIn(set, range[range.length - 1]));
      }
    }

    // 부처님오신날이 이미 다른 공휴일과 겹치면 대체
    if (
      [
        `${year}-01-01`,
        `${year}-03-01`,
        `${year}-05-05`,
        `${year}-06-06`,
        `${year}-08-15`,
        `${year}-10-03`,
        `${year}-10-09`,
        `${year}-12-25`,
        addDays(anchors.seollal, -1),
        anchors.seollal,
        addDays(anchors.seollal, 1),
        addDays(anchors.chuseok, -1),
        anchors.chuseok,
        addDays(anchors.chuseok, 1),
      ].includes(anchors.buddha)
    ) {
      add(nextWeekdayNotIn(set, anchors.buddha));
    }
  }

  holidayCache.set(year, set);
  return set;
}

/** YYYY-MM-DD 가 한국 공휴일인지 */
export function isKoreanHoliday(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  return holidaysForYear(year).has(date);
}
