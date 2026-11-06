// H03 synthetic fixture: one scenario (2 blocks), a 3-question shared-source group (2 open-ended + 1 multiple choice)
// that carries one image, and one standalone open-ended question. Entirely invented teaching text; no personal data,
// no real MEB content (outcome codes are marked SYN). Used by the unit test and the isolated-stack test.
import { deflateSync, crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';

/** Deterministic 24×16 RGB PNG (mint/purple stripes) — a real, decodable image file. */
export function syntheticPng() {
  const w = 24, h = 16;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const purple = Math.floor(x / 6) % 2 === 1;
      raw[o] = purple ? 0x6b : 0x3f; raw[o + 1] = purple ? 0x4f : 0xbf; raw[o + 2] = purple ? 0xd8 : 0x9f;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return { bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]), width: w, height: h };
}

export const SOURCE_SHA = createHash('sha256').update('h03-synthetic-scenario-source').digest('hex');
export const CATALOGUE_ID = '00000000-0000-4000-8000-0000000000a3';

export function fixtureScenarioCandidate() {
  return {
    key: 'syn-h03-g5-turkce', label: 'Sentetik senaryo (H03)', academic_year: '2026-2027', term: 1, exam: 1, grade: 5, subject: 'Türkçe',
    sheet: 'Sentetik', header_cell: 'C6', question_count: 4, source_sha256: SOURCE_SHA, source_url: 'https://example.org/h03/synthetic-distribution.xlsx',
    blocks: [
      { count: 3, count_cell: 'C10', outcomes: [{ code: 'SYN.O.5.1', cell: 'B10', text: 'SYN.O.5.1. Metindeki ve görseldeki bilgiyi belirleyebilme (sentetik)' }] },
      { count: 1, count_cell: 'C11', outcomes: [{ code: 'SYN.Y.5.2', cell: 'B11', text: 'SYN.Y.5.2. Kısa bir paragraf yazabilme (sentetik)' }] },
    ],
  };
}

export const SHARED = {
  title: 'Sınıf bahçesi panosu',
  body: 'Sınıfımız bahçede üç sıra fide dikti. Birinci sıraya marul, ikinci sıraya fasulye, üçüncü sıraya nane dikildi. Panodaki görselde sulama sırası renklerle gösterilmiştir: yeşil şeritler pazartesi, mor şeritler perşembe sulanır.',
  alt: 'Yeşil ve mor dikey şeritlerden oluşan sulama panosu',
};

/** Rows exactly as the scenario-bound generator stores them (stem = title\nbody\n\nprompt for group members). */
export function fixtureQuestions({ versionTag }) {
  const scenario_version = `${CATALOGUE_ID}@2:${versionTag}`;
  const base = (block, outcome, cells) => ({ generator: 'ai', model: 'synthetic-fixture', prompt_version: 'h03-fixture/v1', scenario_version, catalogue_id: CATALOGUE_ID, catalogue_revision: 2, source_sha256: SOURCE_SHA, block_id: block, outcome_ids: [outcome], source_cells: { sheet: 'Sentetik', count_cell: cells[0], outcome_cells: [cells[1]] }, content_fit: 'pending_human_review' });
  const grouped = (prompt, extra) => ({ stem: `${SHARED.title}\n${SHARED.body}\n\n${prompt}`, provenance: { ...base('B1', 'SYN.O.5.1', ['C10', 'B10']), shared_source_id: 'S1', shared_source_title: SHARED.title, shared_prompt: prompt, shared_source: { kind: 'text', content: SHARED.body }, ...extra.provenance }, ...extra.row, prompt });
  const rub = (assesses, criteria, alts = []) => ({ rubric: { assesses, criteria, alternative_answers: alts } });
  return [
    grouped('Metne göre ikinci sıraya hangi fide dikilmiştir? Kısaca yazınız.', { row: { kind: 'open_ended', expected_answer: 'İkinci sıraya fasulye dikilmiştir.' }, provenance: rub('result', [{ text: 'Fasulye cevabını vermesi', points: 80 }, { text: 'Tam cümle kurması', points: 20 }], ['Fasulye.']) }),
    grouped('Panodaki görsele göre mor şeritler hangi gün sulanır?', { row: { kind: 'multiple_choice', choices: [{ key: 'A', text: 'Pazartesi' }, { key: 'B', text: 'Salı' }, { key: 'C', text: 'Perşembe' }, { key: 'D', text: 'Cuma' }], correct_key: 'C' }, provenance: {} }),
    grouped('Metindeki bilgilere göre bahçede kaç sıra fide vardır ve son sırada ne yetişir?', { row: { kind: 'open_ended', expected_answer: 'Üç sıra fide vardır; son sırada nane yetişir.' }, provenance: rub('process', [{ text: 'Sıra sayısını doğru yazması', points: 50 }, { text: 'Son sıradaki bitkiyi doğru yazması', points: 50 }]) }),
    { stem: 'Okul bahçesinde geçirdiğiniz bir günü en az bir benzetme kullanarak iki üç cümleyle anlatınız.', kind: 'open_ended', expected_answer: 'Örnek: Bahçe sabah güneşinde bir tablo gibi parlıyordu. Fideleri suladık ve toprağın kokusunu içimize çektik.', provenance: { ...base('B2', 'SYN.Y.5.2', ['C11', 'B11']), ...rub('process', [{ text: 'En az bir benzetme kullanması', points: 50 }, { text: 'Konuya bağlı 2-3 cümle yazması', points: 50 }]) } },
  ];
}
