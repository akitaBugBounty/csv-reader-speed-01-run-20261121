// Fast drop-in for csv-reader 1.0.0 (make.fun): run(input) returns exactly
// csv-reader's {columns, rows, errors} for {text, header}, but parsed with
// slice/indexOf scans instead of one character at a time.
//
// Semantics (mirroring the reference, character for character):
// - U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (stray_cr).
// - A field opening with a quote runs to the next quote that is not doubled;
//   "" inside is one quote; each CRLF or lone CR inside is read as LF.
// - What follows the closing quote up to the next comma or line break is
//   appended as it stands (quote_junk, when the field ends).
// - A quote that never closes is a literal character and the text after it
//   is read again as unquoted (unterminated_quote).
// - A quote inside an unquoted field is a literal character.
// - Fields stay strings, never trimmed or converted.
// - columns is the first record when header is true, else null; rows are the
//   records after it, each padded with "" (short_row) or cut (long_row) to
//   the first record's width.
// - Each error is {code, line, row} in the order met; line is the 1-based
//   line its record starts on, row its record's index in rows (null for
//   the header). A record's short_row/long_row is recorded when it ends.

const CR = 13;
const LF = 10;
const COMMA = 44;
const QUOTE = 34;
const CRLF_RE = /\r\n?/g;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  outer: while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = 0;
    let quotedLast = false;

    for (;;) {
      // --- one field ---
      let prefix = '';
      let isJunk = false;
      if (text.charCodeAt(pos) === QUOTE) {
        quotedLast = true;
        const open = pos;
        const openLine = line;
        let p = pos + 1;
        let closeIdx = -1;
        let hasDoubled = false;
        for (;;) {
          const q = text.indexOf('"', p);
          if (q === -1) break;
          if (text.charCodeAt(q + 1) === QUOTE) {
            hasDoubled = true;
            p = q + 2;
            continue;
          }
          closeIdx = q;
          break;
        }
        if (closeIdx === -1) {
          // The quote never closes: literal, text after it read as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          prefix = '"';
        } else {
          const raw = text.slice(open + 1, closeIdx);
          let lineInc = 0;
          let hasCR = false;
          if (raw.indexOf('\n') !== -1 || raw.indexOf('\r') !== -1) {
            for (let i = 0; i < raw.length; i++) {
              const c = raw.charCodeAt(i);
              if (c === LF) {
                lineInc += 1;
              } else if (c === CR) {
                lineInc += 1;
                hasCR = true;
                if (raw.charCodeAt(i + 1) === LF) i += 1;
              }
            }
          }
          line += lineInc;
          let value = raw;
          if (hasDoubled) value = value.replaceAll('""', '"');
          if (hasCR) value = value.replace(CRLF_RE, '\n');
          pos = closeIdx + 1;
          if (pos >= n) {
            fields.push(value);
            ended = 2;
            break;
          }
          const c = text.charCodeAt(pos);
          if (c === COMMA) {
            pos += 1;
            fields.push(value);
            ended = 0;
          } else if (c === LF) {
            pos += 1;
            line += 1;
            fields.push(value);
            ended = 1;
          } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
            pos += 2;
            line += 1;
            fields.push(value);
            ended = 1;
          } else {
            prefix = value;
            isJunk = true;
          }
          if (!isJunk) {
            if (ended !== 0) break;
            continue;
          }
        }
      } else {
        quotedLast = false;
      }

      // --- unquoted read from pos, starting from prefix ---
      // (a plain unquoted field, the re-read after an unterminated quote,
      // or the junk after a closing quote). The field ends at the first
      // comma or line break, or the end of the text; a CR not followed by
      // LF inside it is dropped (stray_cr).
      let value = prefix;
      let added = 0;
      let ci = text.indexOf(',', pos);
      let ni = text.indexOf('\n', pos);
      if (ci === -1) ci = n;
      if (ni === -1) ni = n;
      let k;
      if (ci < ni) {
        k = ci;
        ended = 0;
      } else if (ni < ci) {
        k = ni;
        ended = 1;
      } else {
        k = n;
        ended = 2;
      }
      const seg = text.slice(pos, k);
      if (seg.indexOf('\r') === -1) {
        value += seg;
        added += seg.length;
      } else {
        let content = seg;
        if (ended === 1 && seg.charCodeAt(seg.length - 1) === CR) content = seg.slice(0, -1);
        const parts = content.split('\r');
        for (let j = 0; j < parts.length - 1; j++) {
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        }
        const kept = parts.join('');
        value += kept;
        added += kept.length;
      }
      pos = ended === 2 ? n : k + 1;
      if (ended === 1) line += 1;
      if (isJunk && added > 0) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      fields.push(value);
      if (ended !== 0) break;
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quotedLast) continue outer;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
